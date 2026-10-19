// Turns request bodies into searchable text: plain bodies as-is, gzip / zlib /
// raw-deflate bodies decompressed, and gzip blobs embedded as base64 inside
// otherwise-text payloads (they start with "H4sI").

const MAX_RAW = 256 * 1024;      // compressed bytes we're willing to read
const MAX_TEXT = 64 * 1024;      // plain-text bytes scanned
const MAX_INFLATED = 256 * 1024; // cap on decompressed output (guards against zip bombs)

const decoder = new TextDecoder();

export function looksBinary(bytes) {
  const n = Math.min(bytes.length, 512);
  if (!n) return false;
  let control = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b < 9 || (b > 13 && b < 32) || b === 127) control++;
  }
  return control / n > 0.05;
}

function sniff(b) {
  if (b[0] === 0x1f && b[1] === 0x8b) return 'gzip';
  if (b[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(b[1])) return 'deflate';
  return null;
}

async function inflate(bytes, format) {
  const parts = [];
  let size = 0;
  try {
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader();
    while (size < MAX_INFLATED) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => {});
  } catch {
    // Truncated or corrupt input: keep whatever decompressed before the error.
  }
  if (!size) return null;
  const out = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out.subarray(0, MAX_INFLATED);
}

export function joinParts(parts) {
  const chunks = [];
  let size = 0;
  for (const p of parts) {
    if (!p || size >= MAX_RAW) continue;
    const bytes = new Uint8Array(p).subarray(0, MAX_RAW - size);
    chunks.push(bytes);
    size += bytes.length;
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

// -> { text, unpacked: [{ via, text }], opaque }
// opaque = binary body we couldn't turn into text (encrypted, or an unknown format).
export async function unpackBody(bytes) {
  if (!bytes.length) return { text: '', unpacked: [], opaque: false };
  const format = sniff(bytes);
  if (format) {
    const out = await inflate(bytes, format);
    return out
      ? { text: '', unpacked: [{ via: `${format}-compressed`, text: decoder.decode(out) }], opaque: false }
      : { text: '', unpacked: [], opaque: true };
  }
  // Binary formats like protobuf still carry strings as plain UTF-8, so scan the raw bytes too.
  const text = decoder.decode(bytes.subarray(0, MAX_TEXT));
  if (!looksBinary(bytes)) return { text, unpacked: [], opaque: false };
  const out = await inflate(bytes, 'deflate-raw');
  if (out && !looksBinary(out)) {
    return { text, unpacked: [{ via: 'deflate-compressed', text: decoder.decode(out) }], opaque: false };
  }
  return { text, unpacked: [], opaque: true };
}

function safeDecodeURI(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export async function unpackEmbedded(text) {
  const found = new Set([
    ...(text.match(/H4sI[A-Za-z0-9+/_-]{16,}={0,2}/g) ?? []),
    ...(safeDecodeURI(text).match(/H4sI[A-Za-z0-9+/_-]{16,}={0,2}/g) ?? []),
  ]);
  const out = [];
  for (const m of [...found].slice(0, 10)) {
    try {
      const s = m.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(s.padEnd(s.length + ((4 - (s.length % 4)) % 4), '='));
      const inflated = await inflate(Uint8Array.from(bin, (c) => c.charCodeAt(0)), 'gzip');
      if (inflated) out.push({ via: 'gzip-compressed, base64-encoded', text: decoder.decode(inflated) });
    } catch {}
  }
  return out;
}
