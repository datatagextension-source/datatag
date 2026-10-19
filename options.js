const MAX = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const $ = (id) => document.getElementById(id);

async function load() {
  const { identifiers = [] } = await chrome.storage.local.get('identifiers');
  return identifiers;
}

function classify(raw) {
  const value = raw.trim();
  if (EMAIL_RE.test(value)) return { kind: 'email', value };
  if (/^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7) return { kind: 'phone', value };
  return null;
}

async function render() {
  const ids = await load();
  $('empty').hidden = ids.length > 0;
  $('list').replaceChildren(...ids.map((id) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    const kind = Object.assign(document.createElement('span'), { className: 'kind', textContent: id.kind });
    const value = Object.assign(document.createElement('span'), { className: 'value', textContent: id.value });
    label.append(kind, value);
    const remove = Object.assign(document.createElement('button'), { textContent: 'Remove' });
    remove.addEventListener('click', async () => {
      const next = (await load()).filter((x) => x.id !== id.id);
      await chrome.storage.local.set({ identifiers: next });
      render();
    });
    li.append(label, remove);
    return li;
  }));
}

$('add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('error');
  const found = classify($('value').value);
  if (!found) {
    error.textContent = "That doesn't look like an email address or phone number.";
    return;
  }
  const ids = await load();
  if (ids.some((x) => x.value.toLowerCase() === found.value.toLowerCase())) {
    error.textContent = 'Already saved.';
    return;
  }
  if (ids.length >= MAX) {
    error.textContent = `You can save up to ${MAX}. Remove one first.`;
    return;
  }
  ids.push({ id: crypto.randomUUID(), ...found });
  await chrome.storage.local.set({ identifiers: ids });
  error.textContent = '';
  $('value').value = '';
  render();
});

render();
