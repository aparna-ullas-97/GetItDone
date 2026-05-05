const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const WEEKS_DIR = path.join(DATA_DIR, 'weeks');
const GLOBAL_FILE = path.join(DATA_DIR, 'global.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TEMPLATE_FILE = path.join(WEEKS_DIR, '_template.json');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const { weekDates, fmtMD, weekLabel, WD_LABELS } = require('./scripts/week-dates');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon'
};

function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('Bad JSON in', file, e.message);
    return fallback;
  }
}

function writeJsonAtomic(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function loadAllWeeks() {
  if (!fs.existsSync(WEEKS_DIR)) return [];
  const files = fs.readdirSync(WEEKS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_') && !f.startsWith('.'));
  const weeks = [];
  for (const f of files) {
    const w = readJsonSafe(path.join(WEEKS_DIR, f), null);
    if (w && typeof w.weekNumber === 'number') weeks.push(w);
  }
  weeks.sort((a, b) => a.weekNumber - b.weekNumber);
  return weeks;
}

function defaultWeekState() {
  return { checks:{}, hydration:{}, vibes:{}, actuals:{}, dailyKcal:{}, nsv:'',
           weight:null, measurements:{}, period:{}, recovery:{}, photo:null };
}

function createNextWeek() {
  const existing = loadAllWeeks();
  const nextNum = (existing.length ? existing[existing.length - 1].weekNumber : 0) + 1;
  const seed = existing.length
    ? existing[existing.length - 1]
    : readJsonSafe(TEMPLATE_FILE, { days: [] });
  const w = JSON.parse(JSON.stringify(seed));
  delete w._comment;
  w.weekNumber = nextNum;
  w.weekLabel  = weekLabel(nextNum);
  const dates  = weekDates(nextNum);
  w.weekStrip  = dates.map((d, i) => ({ wd: WD_LABELS[i], date: fmtMD(d) }));
  if (Array.isArray(w.days)) {
    w.days.forEach((d, i) => {
      const dt = dates[i];
      if (dt) d.date = dt.getUTCDate();
    });
  }
  const file = path.join(WEEKS_DIR, `week-${String(nextNum).padStart(2, '0')}.json`);
  fs.writeFileSync(file, JSON.stringify(w, null, 2) + '\n');
  return w;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-cache' }, headers));
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > 5 * 1024 * 1024) { req.destroy(); reject(new Error('too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'forbidden');
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'not found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/plan') {
      const global = readJsonSafe(GLOBAL_FILE, {});
      const weeks = loadAllWeeks();
      return send(res, 200, JSON.stringify({ global, weeks }), { 'Content-Type': MIME['.json'] });
    }
    if (req.method === 'GET' && req.url === '/api/state') {
      const state = readJsonSafe(STATE_FILE, { weeks: {} });
      return send(res, 200, JSON.stringify(state), { 'Content-Type': MIME['.json'] });
    }
    if (req.method === 'PUT' && req.url === '/api/state') {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      writeJsonAtomic(STATE_FILE, parsed);
      return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': MIME['.json'] });
    }
    if (req.method === 'POST' && req.url === '/api/weeks/new') {
      const week = createNextWeek();
      return send(res, 200, JSON.stringify(week), { 'Content-Type': MIME['.json'] });
    }
    if (req.method === 'POST' && req.url.startsWith('/api/photo/')) {
      const wn = parseInt(req.url.slice('/api/photo/'.length));
      if (!Number.isFinite(wn) || wn < 1) return send(res, 400, 'bad week');
      const body = await readBody(req);
      const { dataUrl } = JSON.parse(body || '{}');
      const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(dataUrl || '');
      if (!m) return send(res, 400, JSON.stringify({error:'bad image'}), {'Content-Type':MIME['.json']});
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 6 * 1024 * 1024) return send(res, 413, JSON.stringify({error:'too large (max 6MB)'}), {'Content-Type':MIME['.json']});
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const wkTag = `wk-${String(wn).padStart(2,'0')}`;
      for (const e of ['jpg','png','webp']) {
        const f = path.join(PHOTOS_DIR, `${wkTag}.${e}`);
        if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (_) {}
      }
      const filename = `${wkTag}.${ext}`;
      fs.writeFileSync(path.join(PHOTOS_DIR, filename), buf);
      return send(res, 200, JSON.stringify({ filename }), { 'Content-Type': MIME['.json'] });
    }
    if (req.method === 'DELETE' && req.url.startsWith('/api/photo/')) {
      const wn = parseInt(req.url.slice('/api/photo/'.length));
      if (!Number.isFinite(wn) || wn < 1) return send(res, 400, 'bad week');
      const wkTag = `wk-${String(wn).padStart(2,'0')}`;
      for (const e of ['jpg','png','webp']) {
        const f = path.join(PHOTOS_DIR, `${wkTag}.${e}`);
        if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (_) {}
      }
      return send(res, 200, JSON.stringify({ ok:true }), { 'Content-Type': MIME['.json'] });
    }
    if (req.method === 'GET' && req.url.startsWith('/photos/')) {
      const filename = path.basename(req.url.split('?')[0]);
      const f = path.join(PHOTOS_DIR, filename);
      if (!f.startsWith(PHOTOS_DIR) || !fs.existsSync(f)) return send(res, 404, 'not found');
      const ext = path.extname(f).toLowerCase();
      const ct = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-cache' });
      return fs.createReadStream(f).pipe(res);
    }
    if (req.method === 'GET') return serveStatic(req, res);
    send(res, 405, 'method not allowed');
  } catch (e) {
    console.error(e);
    send(res, 500, JSON.stringify({ error: e.message }), { 'Content-Type': MIME['.json'] });
  }
});

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(WEEKS_DIR)) fs.mkdirSync(WEEKS_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
if (!fs.existsSync(STATE_FILE)) writeJsonAtomic(STATE_FILE, { weeks: {} });

function getLanIps() {
  const nets = require('os').networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌿 Glow Plan running`);
  console.log(`   Local:    http://localhost:${PORT}`);
  for (const ip of getLanIps()) {
    console.log(`   Network:  http://${ip}:${PORT}   ← open on your phone`);
  }
  console.log(`   Logs →    ${STATE_FILE}\n`);
});

module.exports = { defaultWeekState };
