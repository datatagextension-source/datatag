// Watches form fields and tells the background worker which email / phone values
// you entered, so it can look for them in outgoing requests.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_HINT = /phone|tel|mobile|cell/i;
const reported = new Set();

function classify(el) {
  if (!(el instanceof HTMLInputElement) || el.type === 'password') return null;
  const value = el.value.trim();
  if (!value) return null;
  if (EMAIL_RE.test(value)) return { kind: 'email', value };
  const hint = [el.type, el.name, el.id, el.autocomplete, el.placeholder].join(' ');
  if ((el.type === 'tel' || PHONE_HINT.test(hint)) && value.replace(/\D/g, '').length >= 7) {
    return { kind: 'phone', value };
  }
  return null;
}

function report(el) {
  const found = classify(el);
  if (!found) return;
  const key = `${found.kind}:${found.value.toLowerCase()}`;
  if (reported.has(key)) return;
  reported.add(key);
  chrome.runtime.sendMessage({ type: 'value', ...found }).catch(() => {});
}

// Checked on leaving a field, on change (covers autofill) and on submit.
// Requests that already went out are kept in a buffer and re-scanned.
document.addEventListener('focusout', (e) => report(e.target), true);
document.addEventListener('change', (e) => report(e.target), true);
document.addEventListener('submit', (e) => {
  for (const el of e.target.querySelectorAll?.('input') ?? []) report(el);
}, true);
