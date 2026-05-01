const https = require('https');
const http = require('http');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-roblox-cookie, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.query.url;
  const asImage = req.query.img === '1';
  const cookie = req.headers['x-roblox-cookie'] || '';

  if (!url) {
    res.status(400).json({ error: 'No URL' });
    return;
  }

  let decoded;
  try { decoded = decodeURIComponent(url); } catch(e) { decoded = url; }

  return doFetch(decoded, cookie, asImage, 0, res);
};

function doFetch(url, cookie, asImage, redirects, res) {
  if (redirects > 5) { res.status(508).json({ error: 'Too many redirects' }); return; }
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const hdrs = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': asImage ? 'image/*' : 'application/json,*/*',
      'Referer': 'https://www.roblox.com/',
      'Origin': 'https://www.roblox.com'
    };
    if (cookie) hdrs['Cookie'] = '.ROBLOSECURITY=' + cookie;

    const req = lib.get(url, { headers: hdrs }, (response) => {
      const loc = response.headers.location;
      if ([301,302,303,307,308].includes(response.statusCode) && loc) {
        const next = loc.startsWith('http') ? loc : 'https://www.roblox.com' + loc;
        doFetch(next, '', asImage, redirects + 1, res);
        resolve();
        return;
      }
      const chunks = [];
      response.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      response.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (asImage) {
          const ct = response.headers['content-type'] || 'image/png';
          res.status(200).json({ dataUrl: 'data:' + ct + ';base64,' + buf.toString('base64') });
        } else {
          res.status(response.statusCode).setHeader('Content-Type', 'application/json').end(buf.toString('utf8'));
        }
        resolve();
      });
    });
    req.on('error', (e) => { res.status(500).json({ error: e.message }); resolve(); });
    req.setTimeout(15000, () => { req.destroy(); res.status(504).json({ error: 'Timeout' }); resolve(); });
  });
}
