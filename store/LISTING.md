# Chrome Web Store listing: DataTag

Copy each section into the matching field in the developer dashboard
(https://chrome.google.com/webstore/devconsole). Upload `dist/datatag-<version>.zip`
built by `tools/package.sh`.

---

## Store listing tab

**Name**
DataTag

**Summary** (max 132 characters)
See which companies get your email or phone number the moment you type it into a form, even when it's hashed or hidden.

**Category**
Privacy & Security

**Language**
English

**Description**

```
Many websites share your email address with ad platforms, data brokers and analytics companies the moment you type it into a form, often before you press submit. DataTag shows you who, live.

HOW IT WORKS
• Fill in a signup or checkout form as usual.
• DataTag checks every request the page sends to other companies for your email or phone number.
• The icon shows how many companies received it. Click it to see who they are and exactly how your data was sent.

FINDS YOUR DATA EVEN WHEN IT'S DISGUISED
Trackers rarely send your email as plain text. DataTag recognises it when it's:
• hashed (SHA-256, SHA-1, MD5), the format ad platforms use to match you across sites
• base64 or URL-encoded
• inside compressed (gzip/deflate) payloads used by session-recording tools
Requests it can't read (for example, encrypted ones) are flagged so you know they exist.

KNOW WHO YOU'RE DEALING WITH
Each company is labelled by what it does: advertising, data broker, session recording, marketing, fraud prevention and more.

WATCH FOR YOUR DETAILS EVERYWHERE
Save your email and phone in Settings and DataTag watches for them on every site, even when you're already signed in and don't type anything.

SHARE WHAT YOU FIND
Create a shareable image or text summary of a site's results. Your email and phone number are never included.

PRIVATE BY DESIGN
• Everything runs inside your browser. DataTag has no servers, no accounts and no analytics.
• It never sends anything anywhere.
• Detection results are cleared when you close the tab or the browser.
• DataTag only observes. It never blocks or changes anything, so sites keep working normally.

WHAT IT CAN'T SEE
DataTag sees what your browser sends. It can't see what a company's own servers do with your data after you sign up.
```

**Graphic assets** (see "Assets still needed" below)
- Store icon: `icons/icon128.png`
- Screenshots: 1280×800, 1–5 of them
- Small promo tile: 440×280

---

## Privacy practices tab

**Single purpose**

```
DataTag shows users which third-party companies receive the email address or phone number they enter on a website, by checking the network requests that page sends to other domains.
```

**Permission justifications**

`webRequest`
```
Used to observe (never block or modify) the requests a page sends to third-party domains, so DataTag can check whether they contain the user's email address or phone number. This is the extension's core function.
```

`storage`
```
Stores detection results for each tab in session storage (cleared when the tab or browser closes) and the email addresses or phone numbers the user chooses to save in Settings, in local storage on their device.
```

Host permission `<all_urls>` (also covers the content script)
```
Data sharing with third parties can happen on any website where the user fills in a form, so DataTag needs to observe third-party requests and detect email and phone fields on all sites. All processing happens locally. No data is collected, transmitted or modified.
```

**Remote code**
No, I am not using remote code. (All JavaScript is included in the package.)

**Data usage**

Data types: tick **Personally identifiable information** (DataTag reads email addresses and
phone numbers typed into forms) and **Website content** (it reads the content of outgoing requests).

> Note: these are only ever processed on the user's device. Read the dashboard's definition
> of each data type before submitting. If it covers only data transmitted off the device, these
> may not need ticking. When unsure, declaring is the safer choice: under-declaring is a
> common rejection reason.

Certifications (tick all three):
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**
_Needs a public URL: see "Assets still needed"._

---

## Account tab

- Contact email: datatag.extension@gmail.com (verify it)
- Trader status: non-trader (DataTag is free). Revisit if it ever charges.

---

## Assets still needed

- [ ] Public URL for the privacy policy (`privacy.html`)
- [x] Screenshots: `store/screenshots/screenshot-1..4.png` (regenerate with `tools/make-store-assets.sh`)
- [x] Small promo tile: `store/screenshots/promo-tile-440x280.png`
- [x] Name: DataTag
