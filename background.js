import { buildNeedles, scan, baseDomain, trackerName, isSameOwner, mask } from './lib/match.js';
import { joinParts, unpackBody, unpackEmbedded } from './lib/unpack.js';

const MAX_BUFFER = 200;     // recent third-party requests kept per tab for re-scanning
const MAX_VALUES = 10;

// tabId -> Promise<state>. State is mirrored to storage.session (cleared when
// the browser closes) so the popup still works after the worker sleeps.
const states = new Map();
const persistTimers = new Map();
const storeKey = (tabId) => `tab-${tabId}`;

chrome.action.setBadgeBackgroundColor({ color: '#d93025' });

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'welcome.html' });
});

// Identifiers saved on the settings page are watched on every site, not just
// where you type them. Kept in chrome.storage.local (this browser only, never synced).
let saved = { values: [], needles: [] };
let savedReady = loadSaved();

async function loadSaved() {
  const { identifiers = [] } = await chrome.storage.local.get('identifiers');
  saved = { values: identifiers, needles: await buildNeedles(identifiers) };
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.identifiers) savedReady = loadSaved();
});

function freshState(pageUrl, values = []) {
  let host = '';
  try { host = new URL(pageUrl).hostname; } catch {}
  return { pageUrl, site: baseDomain(host), values, needles: [], buffer: [], leaks: [], parties: {} };
}

function getState(tabId) {
  if (!states.has(tabId)) states.set(tabId, restore(tabId));
  return states.get(tabId);
}

async function restore(tabId) {
  const key = storeKey(tabId);
  const saved = (await chrome.storage.session.get(key))[key];
  if (saved) return { ...saved, buffer: [], needles: await buildNeedles(saved.values) };
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  return freshState(tab?.url ?? '');
}

function setBadge(tabId, st) {
  const companies = new Set(st.leaks.map((l) => l.domain)).size;
  chrome.action.setBadgeText({ tabId, text: companies ? String(companies) : '' }).catch(() => {});
}

function persist(tabId, st) {
  clearTimeout(persistTimers.get(tabId));
  persistTimers.set(tabId, setTimeout(() => {
    const { buffer, needles, ...rest } = st;
    chrome.storage.session.set({ [storeKey(tabId)]: rest });
  }, 250));
  setBadge(tabId, st);
}

// -> { text, unpacked: [{ via, text }], opaque }
async function readRequest(d) {
  let text = d.url;
  const unpacked = [];
  let opaque = false;
  const body = d.requestBody;
  if (body?.formData) {
    text += '\n' + Object.entries(body.formData).map(([k, v]) => `${k}=${v.join(',')}`).join('&');
  }
  if (body?.raw) {
    const result = await unpackBody(joinParts(body.raw.map((p) => p.bytes)));
    text += '\n' + result.text;
    unpacked.push(...result.unpacked);
    opaque = result.opaque;
  }
  unpacked.push(...await unpackEmbedded(text));
  return { text, unpacked, opaque };
}

function check(st, requests, needles) {
  let found = false;
  for (const req of requests) {
    const hits = [
      ...scan(req.text, needles),
      ...req.unpacked.flatMap((u) => scan(u.text, needles).map((h) => ({ ...h, encoding: `${h.encoding}, ${u.via}` }))),
    ];
    for (const hit of hits) {
      const v = st.values.find((x) => x.id === hit.id) ?? saved.values.find((x) => x.id === hit.id);
      if (!v) continue;
      const key = `${req.domain}|${hit.id}|${hit.encoding}`;
      const existing = st.leaks.find((l) => l.key === key);
      if (existing) { existing.count++; continue; }
      st.leaks.push({
        key, domain: req.domain, host: req.host, company: trackerName(req.host),
        kind: v.kind, masked: mask(v), encoding: hit.encoding,
        type: req.type, method: req.method, url: req.url.slice(0, 300), time: req.time, count: 1,
      });
      found = true;
    }
  }
  return found;
}

async function onRequest(d) {
  if (d.tabId < 0) return;
  await savedReady;

  if (d.type === 'main_frame') {
    const prev = await getState(d.tabId);
    const next = freshState(d.url, prev.values);
    // Same site (e.g. signup -> "thanks" page): keep everything, since conversion
    // pixels on the confirmation page are a common place for your email to leak.
    if (next.site === prev.site) { prev.pageUrl = d.url; return; }
    next.needles = prev.needles;
    states.set(d.tabId, Promise.resolve(next));
    persist(d.tabId, next);
    return;
  }

  const st = await getState(d.tabId);
  let host;
  try { host = new URL(d.url).hostname; } catch { return; }
  const domain = baseDomain(host);
  if (!domain || isSameOwner(st.site, domain)) return;

  const party = (st.parties[domain] ??= { domain, company: trackerName(host), count: 0, opaque: 0 });
  party.count++;

  const { text, unpacked, opaque } = await readRequest(d);
  if (opaque) party.opaque = (party.opaque ?? 0) + 1;
  const req = { url: d.url, host, domain, type: d.type, method: d.method, time: d.timeStamp, text, unpacked };
  st.buffer.push(req);
  if (st.buffer.length > MAX_BUFFER) st.buffer.shift();
  check(st, [req], [...st.needles, ...saved.needles]);
  persist(d.tabId, st);
}

async function addValue(tabId, { kind, value }) {
  const st = await getState(tabId);
  const norm = value.trim().toLowerCase();
  if ([...st.values, ...saved.values].some((v) => v.value.toLowerCase() === norm)) return;
  const entry = { id: crypto.randomUUID(), kind, value: value.trim() };
  st.values.push(entry);
  if (st.values.length > MAX_VALUES) st.values.shift();
  st.needles = await buildNeedles(st.values);
  // Trackers often fire on blur, before or alongside this message — re-check what already went out.
  check(st, st.buffer, st.needles.filter((n) => n.id === entry.id));
  persist(tabId, st);
}

chrome.webRequest.onBeforeRequest.addListener(
  (d) => { onRequest(d).catch(console.error); },
  { urls: ['<all_urls>'] },
  ['requestBody'],
);

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'value' && sender.tab) {
    addValue(sender.tab.id, msg).catch(console.error);
    return;
  }
  if (msg.type === 'get') {
    Promise.all([getState(msg.tabId), savedReady]).then(([{ buffer, needles, values, ...rest }]) =>
      reply({ ...rest, watching: values.map(mask), saved: saved.values.map(mask) }));
    return true;
  }
  if (msg.type === 'reset') {
    getState(msg.tabId).then((prev) => {
      const next = freshState(prev.pageUrl);
      states.set(msg.tabId, Promise.resolve(next));
      persist(msg.tabId, next);
      reply();
    });
    return true;
  }
});

// Chrome clears per-tab badges on navigation; put the count back once the page loads.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete') getState(tabId).then((st) => setBadge(tabId, st));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  states.delete(tabId);
  chrome.storage.session.remove(storeKey(tabId));
});
