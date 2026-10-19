import { companyInfo } from './lib/match.js';

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function ago(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

async function render() {
  const st = await chrome.runtime.sendMessage({ type: 'get', tabId: tab.id });
  $('site').textContent = st.site || '';

  // Group by company, so TikTok's two domains count once. Names are looked up live
  // so older leaks pick up newly added companies.
  const nameOf = (x) => companyInfo(x.host ?? x.domain)?.name ?? x.domain;
  const byCompany = Object.groupBy(st.leaks, nameOf);
  const names = Object.keys(byCompany);
  const leakedDomains = new Set(st.leaks.map((l) => l.domain));

  const summary = $('summary');
  summary.className = names.length ? 'bad' : '';
  summary.textContent = names.length
    ? `${names.length} compan${names.length === 1 ? 'y' : 'ies'} received your data from this page.`
    : st.watching.length || st.saved.length
      ? 'No leaks seen yet for the values below.'
      : 'Type your email or phone into a form on this page, or save them in Settings.';
  $('share').disabled = !names.length;

  $('watching').replaceChildren(
    ...st.watching.map((m) => el('span', { className: 'chip', textContent: `watching ${m}` })),
    ...st.saved.map((m) => el('span', { className: 'chip', textContent: `saved ${m}` })),
  );

  $('leaks-section').hidden = !names.length;
  $('leaks').replaceChildren(...names.map((name) => {
    const leaks = byCompany[name];
    const first = leaks[0];
    const info = companyInfo(first.host ?? first.domain);
    const domains = [...new Set(leaks.map((l) => l.domain))];
    return el('li', { className: 'leak' },
      el('div', { className: 'head' },
        el('span', { className: 'name', textContent: name }),
        el('span', { className: 'category', textContent: info?.category ?? 'Unknown company' })),
      info ? el('div', { className: 'domain', textContent: domains.join(', ') }) : '',
      el('div', {}, ...[...new Set(leaks.map((l) => `${l.masked} · ${l.encoding}`))]
        .map((t) => el('span', { className: 'chip bad', textContent: t }))),
      el('details', {},
        el('summary', { textContent: `${first.method} ${first.type} · ${ago(first.time)}` }),
        el('code', { textContent: first.url }),
      ),
    );
  }));

  const unreadable = Object.values(st.parties).reduce((n, p) => n + (p.opaque ?? 0), 0);
  $('opaque-note').hidden = !unreadable;
  $('opaque-note').textContent = `${unreadable} request${unreadable === 1 ? '' : 's'} had unreadable binary bodies (likely encrypted), so DataTag can't rule out that they contain your data.`;

  const others = Object.values(st.parties)
    .filter((p) => !leakedDomains.has(p.domain))
    .sort((a, b) => b.count - a.count);
  $('parties-section').hidden = !others.length;
  $('parties').replaceChildren(...others.map((p) => {
    const info = companyInfo(p.domain);
    return el('li', { className: 'party' },
      el('span', {},
        el('span', { textContent: info ? info.name : p.domain }),
        el('span', { className: 'muted', textContent: info ? ` · ${info.category}` : '' })),
      el('span', { className: 'count', textContent: p.opaque ? `${p.count} req · ${p.opaque} unreadable` : `${p.count} req` }),
    );
  }));
}

$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('share').addEventListener('click', () => {
  chrome.tabs.create({ url: `report.html?tab=${tab.id}` });
});

$('reset').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'reset', tabId: tab.id });
  render();
});

render();
setInterval(render, 1500);
