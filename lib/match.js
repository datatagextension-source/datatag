// Turns the values you typed into every form trackers commonly send them in,
// and searches outgoing request text for any of those forms.

import { BY_DOMAIN } from './companies.js';

export { CATEGORIES } from './companies.js';

// Shared cloud hosting: every customer gets a subdomain, so the registrable domain
// (e.g. "on.aws") says nothing about who is behind it. We keep the full hostname.
const SHARED_HOSTING = {
  'on.aws': 'AWS', 'amazonaws.com': 'AWS', 'cloudfront.net': 'AWS',
  'herokuapp.com': 'Heroku', 'vercel.app': 'Vercel', 'netlify.app': 'Netlify',
  'workers.dev': 'Cloudflare', 'pages.dev': 'Cloudflare',
  'azurewebsites.net': 'Azure', 'azureedge.net': 'Azure',
  'appspot.com': 'Google Cloud', 'run.app': 'Google Cloud', 'cloudfunctions.net': 'Google Cloud',
  'web.app': 'Firebase', 'firebaseapp.com': 'Firebase', 'firebaseio.com': 'Firebase',
  'onrender.com': 'Render', 'fly.dev': 'Fly.io', 'github.io': 'GitHub Pages', 'supabase.co': 'Supabase',
};

function sharedHostingProvider(host) {
  for (const [suffix, provider] of Object.entries(SHARED_HOSTING)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return provider;
  }
  return null;
}

const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu', 'ne', 'or']);

// Rough registrable domain: "px.ads.linkedin.com" -> "linkedin.com", "shop.co.uk" stays.
export function baseDomain(host) {
  if (!host) return '';
  if (/^[\d.]+$/.test(host) || host.includes(':')) return host;
  if (sharedHostingProvider(host)) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const tld = parts[parts.length - 1];
  const n = tld.length === 2 && SECOND_LEVEL.has(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-n).join('.');
}

// Sites that serve their own assets from a differently named domain.
const SAME_OWNER = { 'wayfair.com': ['wfcdn.com', 'wayfair.io'] };

export function isSameOwner(site, domain) {
  if (domain === site || SAME_OWNER[site]?.includes(domain)) return true;
  // Same brand on another TLD: wayfair.com <-> wayfair.io
  const name = (d) => d.split('.')[0];
  return Boolean(site) && name(site).length > 3 && name(site) === name(domain);
}

export const OWNER_UNKNOWN = 'Owner unknown';

// -> { name, category } or null
export function companyInfo(host) {
  const provider = host && sharedHostingProvider(host);
  if (provider) return { name: `${provider}-hosted service`, category: OWNER_UNKNOWN };
  return BY_DOMAIN.get(baseDomain(host)) ?? null;
}

// Services on shared cloud hosting might be the site itself, so they're counted
// separately rather than inflating the number of companies.
export function countRecipients(leaks) {
  const owners = new Map();
  for (const l of leaks) {
    const info = companyInfo(l.host ?? l.domain);
    owners.set(info?.name ?? l.domain, info?.category === OWNER_UNKNOWN);
  }
  const unknown = [...owners.values()].filter(Boolean).length;
  return { companies: owners.size - unknown, unknown };
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function describeRecipients({ companies, unknown }) {
  const parts = [];
  if (companies) parts.push(plural(companies, 'company', 'companies'));
  if (unknown) parts.push(plural(unknown, 'service', 'services') + ' with an unknown owner');
  return parts.join(' and ');
}

export function trackerName(host) {
  return companyInfo(host)?.name ?? null;
}

export function mask(v) {
  if (v.kind === 'email') {
    const [user, domain] = v.value.split('@');
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return `***${v.value.replace(/\D/g, '').slice(-3)}`;
}

function phoneForms(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return [];
  const forms = new Set([digits, raw.trim()]);
  if (raw.trim().startsWith('+')) forms.add(`+${digits}`);
  return [...forms];
}

async function digest(algo, s) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Web Crypto has no MD5, but some ad platforms (e.g. Criteo) still use it.
export function md5(str) {
  const bytes = new TextEncoder().encode(str);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const len = bytes.length;
  const blocks = ((len + 8) >> 6) + 1;
  const w = new Uint32Array(blocks * 16);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[len >> 2] |= 0x80 << ((len % 4) * 8);
  w[blocks * 16 - 2] = (len * 8) >>> 0;
  w[blocks * 16 - 1] = Math.floor(len / 0x20000000);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let blk = 0; blk < blocks; blk++) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const s = S[(i >> 4) * 4 + (i % 4)];
      F = (F + A + K[i] + w[blk * 16 + g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0]
    .map((x) => [0, 8, 16, 24].map((sh) => ((x >>> sh) & 0xff).toString(16).padStart(2, '0')).join(''))
    .join('');
}

// needle: { id, encoding, s }. Base64 is handled in scan() by decoding payload chunks.
export async function buildNeedles(values) {
  const needles = [];
  for (const v of values) {
    const forms = v.kind === 'email' ? [v.value.trim().toLowerCase()] : phoneForms(v.value);
    for (const f of forms) {
      needles.push(
        { id: v.id, encoding: 'plain', s: f.toLowerCase() },
        { id: v.id, encoding: 'url-encoded', s: encodeURIComponent(f).toLowerCase() },
        { id: v.id, encoding: 'SHA-256 hash', s: await digest('SHA-256', f) },
        { id: v.id, encoding: 'SHA-1 hash', s: await digest('SHA-1', f) },
        { id: v.id, encoding: 'MD5 hash', s: md5(f) },
      );
    }
  }
  // "plain" and "url-encoded" are identical for values without special characters.
  const seen = new Set();
  return needles.filter((n) => !seen.has(n.id + n.s) && seen.add(n.id + n.s));
}

// Some trackers base64 the whole payload, which hides the value at an arbitrary offset.
function decodeBase64Chunks(text) {
  const chunks = text.match(/[A-Za-z0-9+/_-]{24,}={0,2}/g);
  if (!chunks) return '';
  let out = '';
  for (const c of chunks.slice(0, 50)) {
    try {
      const s = c.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(s.padEnd(s.length + ((4 - (s.length % 4)) % 4), '='));
      if (/[^\t\n\r\x20-\x7e]/.test(bin.slice(0, 64))) continue;
      out += bin.toLowerCase() + '\n';
    } catch {}
  }
  return out;
}

export function scan(text, needles) {
  if (!needles.length) return [];
  const lower = text.toLowerCase();
  let b64;
  const hits = [];
  const seen = new Set();
  for (const n of needles) {
    const key = n.id + n.encoding;
    if (seen.has(key)) continue;
    if (lower.includes(n.s)) {
      hits.push({ id: n.id, encoding: n.encoding });
      seen.add(key);
      continue;
    }
    b64 ??= decodeBase64Chunks(text);
    if (b64.includes(n.s)) {
      hits.push({ id: n.id, encoding: n.encoding === 'plain' ? 'base64-encoded' : `${n.encoding}, base64-encoded` });
      seen.add(key);
    }
  }
  return hits;
}
