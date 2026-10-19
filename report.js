import { companyInfo, CATEGORIES, countRecipients, describeRecipients, plural } from './lib/match.js';

const $ = (id) => document.getElementById(id);
const tabId = Number(new URLSearchParams(location.search).get('tab'));

// Most concerning first.
const ORDER = [CATEGORIES.identity, CATEGORIES.replay, CATEGORIES.ads, CATEGORIES.marketing,
  CATEGORIES.analytics, CATEGORIES.affiliate, CATEGORIES.fraud, CATEGORIES.support,
  CATEGORIES.payments, CATEGORIES.monitoring, CATEGORIES.consent];

function summarize(st) {
  const companies = new Map();
  for (const leak of st.leaks) {
    const info = companyInfo(leak.host ?? leak.domain);
    const name = info?.name ?? leak.domain;
    const entry = companies.get(name) ?? { name, category: info?.category ?? 'Unknown company', kinds: new Set(), how: new Set() };
    entry.kinds.add(leak.kind);
    entry.how.add(leak.encoding);
    companies.set(name, entry);
  }
  const rank = (c) => (ORDER.includes(c.category) ? ORDER.indexOf(c.category) : ORDER.length);
  const list = [...companies.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const kinds = new Set(st.leaks.map((l) => l.kind));
  const what = kinds.has('email') && kinds.has('phone') ? 'my email and phone number'
    : kinds.has('phone') ? 'my phone number' : 'my email';
  return { site: st.site || 'this site', list, what, counts: countRecipients(st.leaks) };
}

function drawCard(canvas, { site, list, what, counts }, icon) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, P = 64;
  const font = (weight, size) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;

  ctx.fillStyle = '#16181d';
  ctx.fillRect(0, 0, W, H);

  ctx.drawImage(icon, P, P - 8, 44, 44);
  ctx.fillStyle = '#ececec';
  ctx.font = font(700, 26);
  ctx.textBaseline = 'middle';
  ctx.fillText('DataTag', P + 58, P + 14);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a6a8ad';
  ctx.font = font(500, 34);
  ctx.fillText(`On ${site}, ${what} was sent to`, P, 190);

  // Big red number = companies; services with an unknown owner get a quieter note.
  const big = counts.companies
    ? plural(counts.companies, 'company', 'companies')
    : plural(counts.unknown, 'unknown service', 'unknown services');
  ctx.fillStyle = '#ff6b5e';
  ctx.font = font(800, 76);
  ctx.fillText(big, P, 268);
  if (counts.companies && counts.unknown) {
    const x = P + ctx.measureText(big).width + 20;
    ctx.fillStyle = '#a6a8ad';
    ctx.font = font(500, 30);
    ctx.fillText(`+ ${plural(counts.unknown, 'service', 'services')} with an unknown owner`, x, 262);
  }

  const shown = list.length > 10 ? list.slice(0, 9) : list;
  const colW = (W - P * 2) / 2;
  shown.forEach((c, i) => {
    const x = P + (i % 2) * colW;
    const y = 340 + Math.floor(i / 2) * 46;
    ctx.fillStyle = '#ececec';
    ctx.font = font(650, 26);
    ctx.fillText(c.name, x, y);
    const nameW = ctx.measureText(c.name).width;
    ctx.fillStyle = '#7d8087';
    ctx.font = font(400, 20);
    ctx.fillText(c.category, x + nameW + 12, y);
  });
  if (list.length > shown.length) {
    const i = shown.length;
    ctx.fillStyle = '#7d8087';
    ctx.font = font(500, 24);
    ctx.fillText(`+${list.length - shown.length} more`, P + (i % 2) * colW, 340 + Math.floor(i / 2) * 46);
  }

  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  ctx.fillStyle = '#7d8087';
  ctx.font = font(400, 20);
  ctx.fillText(`Detected live in my browser with DataTag · ${date}`, P, H - P + 16);
}

function toText({ site, list, what, counts }) {
  const lines = [`On ${site}, ${what} was sent to ${describeRecipients(counts)}:`, ''];
  for (const c of list) lines.push(`• ${c.name} (${c.category}): ${[...c.how].join('; ')}`);
  lines.push('', 'Detected live in my browser with DataTag.');
  return lines.join('\n');
}

async function main() {
  const st = await chrome.runtime.sendMessage({ type: 'get', tabId }).catch(() => null);
  if (!st || !st.leaks.length) {
    $('title').textContent = 'Nothing to report';
    $('error').textContent = 'No leaks found for that tab. It may have been closed or reset.';
    for (const id of ['card', 'download', 'copy']) $(id).hidden = true;
    return;
  }
  const report = summarize(st);
  $('title').textContent = `${report.site}: ${describeRecipients(report.counts)}`;

  const icon = new Image();
  icon.src = new URL('icons/icon128.png', import.meta.url).href;
  await Promise.all([icon.decode(), document.fonts.ready]);
  drawCard($('card'), report, icon);
  $('text').value = toText(report);

  $('download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = `datatag-${report.site}.png`;
    a.href = $('card').toDataURL('image/png');
    a.click();
  });
  $('copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('text').value);
    $('copy').textContent = 'Copied';
    setTimeout(() => { $('copy').textContent = 'Copy text'; }, 1500);
  });
}

main();
