# DataTag

An "AirTag for your data", step 1: a Chrome extension that shows, in real time, which third parties
receive your email or phone number when you type it into a form.

## How it works

1. `content.js` notices when you enter an email or phone number into a field (on blur, autofill change or submit).
2. `background.js` watches every request the tab makes to a **different** site than the one you're on,
   including URLs, form bodies, JSON, beacons and pixels.
3. `lib/match.js` searches each request for your value as plain text, URL-encoded, base64,
   SHA-256, SHA-1 or MD5 (the hashes ad platforms use for "advanced matching").
4. The popup lists who received it and how, and the icon badge counts the companies.

Identifiers saved in **Settings** (`options.html`) are watched on every site, even when you don't type them
(e.g. when you're already signed in). They live in `chrome.storage.local` only.

Requests sent *before* the background worker learns the value are buffered and re-scanned,
and watched values carry over to the confirmation page on the same site, where conversion pixels often fire.

Everything stays local in `chrome.storage.session` (cleared when Chrome closes). Nothing is sent anywhere.

## Install

1. Open `chrome://extensions`, then turn on **Developer mode**.
2. Click **Load unpacked** and select this `datatag` folder.
3. Pin DataTag from the puzzle-piece menu.

## Try it

```bash
cd test && python3 -m http.server 8765
```

Open http://localhost:8765/signup-test.html, enter a fake email (e.g. `jane.test@example.com`) and phone,
tab out, submit, then open the popup. You should see example.net (SHA-256), httpbin.org (plain) and
example.org (base64) flagged, with example.com under "other third parties".

## Icons

`python3 tools/make-icons.py` regenerates `icons/` (no dependencies).

## Known limits

- Compressed (gzip/protobuf) request bodies and values encrypted client-side won't be detected.
- First-party servers that forward your data server-side are invisible from the browser.
  Steps 2–3 (per-site email aliases plus leak alerts) cover that.
- The domain → company list in `lib/match.js` is small; unknown domains show as "Unknown company".
