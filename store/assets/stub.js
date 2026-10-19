// Stands in for the chrome.* APIs so the real popup / report / settings pages can be
// rendered with demo data for store screenshots. Data mirrors a real test signup on a
// large online retailer; the site name is replaced with a neutral demo domain.
(() => {
  const now = Date.now();
  const L = (domain, host, encoding, type, method, secondsAgo) => ({
    key: `${domain}|${encoding}`, domain, host, kind: 'email', masked: 'ja***@example.com',
    encoding, type, method, url: `https://${host}/collect?…`, time: now - secondsAgo * 1000, count: 1,
  });

  const leaks = {
    clickagy: [L('clickagy.com', 'tag.clickagy.com', 'MD5 hash', 'sub_frame', 'GET', 194),
      L('clickagy.com', 'tag.clickagy.com', 'base64-encoded', 'sub_frame', 'GET', 194)],
    replay: [L('quantummetric.com', 'ingest.quantummetric.com', 'plain, deflate-compressed', 'xmlhttprequest', 'POST', 31),
      L('quantummetric.com', 'ingest.quantummetric.com', 'SHA-256 hash, deflate-compressed', 'xmlhttprequest', 'POST', 31)],
    attentive: [L('attentivemobile.com', 'events.attentivemobile.com', 'base64-encoded', 'ping', 'POST', 32)],
    tiktok: [L('tiktok.com', 'analytics.tiktok.com', 'SHA-256 hash', 'ping', 'POST', 24),
      L('tiktokw.us', 'analytics.tiktokw.us', 'SHA-256 hash', 'ping', 'POST', 24)],
    x: [L('t.co', 't.co', 'SHA-256 hash', 'image', 'GET', 33), L('twitter.com', 'analytics.twitter.com', 'SHA-256 hash', 'image', 'GET', 33)],
    spotify: [L('spotify.com', 'pixel.spotify.com', 'SHA-256 hash', 'xmlhttprequest', 'POST', 33)],
    applovin: [L('applovin.com', 'b.applovin.com', 'SHA-256 hash', 'ping', 'POST', 33)],
  };
  const order = new URLSearchParams(location.search).get('set') === 'encodings'
    ? ['replay', 'clickagy', 'attentive', 'tiktok', 'x', 'spotify', 'applovin']
    : ['clickagy', 'replay', 'attentive', 'tiktok', 'x', 'spotify', 'applovin'];

  const party = (domain, count) => ({ domain, count, opaque: 0 });
  const state = {
    site: 'shop.example',
    pageUrl: 'https://shop.example/account/signup',
    watching: ['ja***@example.com'],
    saved: [],
    leaks: order.flatMap((k) => leaks[k]),
    parties: Object.fromEntries([
      ...order.flatMap((k) => leaks[k]).map((l) => [l.domain, party(l.domain, 2)]),
      ['conviva.com', party('conviva.com', 7)],
      ['forter.com', party('forter.com', 4)],
      ['facebook.com', party('facebook.com', 1)],
      ['zoominfo.com', party('zoominfo.com', 1)],
    ]),
  };

  const identifiers = [
    { id: '1', kind: 'email', value: 'jane.doe@example.com' },
    { id: '2', kind: 'email', value: 'jane.work@example.org' },
    { id: '3', kind: 'phone', value: '+1 555 010 4477' },
  ];

  window.chrome = {
    tabs: { query: async () => [{ id: 1 }], create() {} },
    runtime: { sendMessage: async (m) => (m.type === 'get' ? state : undefined), openOptionsPage() {} },
    storage: { local: { get: async () => ({ identifiers }), set: async () => {} } },
  };
})();
