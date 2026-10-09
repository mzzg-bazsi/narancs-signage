// Minimális HTTP keretrendszer: router, JSON body, statikus fájlok Range támogatással.
import fs from 'node:fs';
import path from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, ...handlers) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handlers });
  }
  get(p, ...h) { this.add('GET', p, ...h); }
  post(p, ...h) { this.add('POST', p, ...h); }
  put(p, ...h) { this.add('PUT', p, ...h); }
  del(p, ...h) { this.add('DELETE', p, ...h); }
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(pathname);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { handlers: r.handlers, params };
      }
    }
    return null;
  }
}

export function send(res, status, body, headers = {}) {
  if (res.headersSent) return;
  if (body !== undefined && typeof body !== 'string' && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
    headers['Content-Type'] ??= 'application/json; charset=utf-8';
  }
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

export function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Túl nagy kérés')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new HttpError(400, 'Hibás JSON')); }
    });
    req.on('error', reject);
  });
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Statikus fájl kiszolgálás, Range kérésekkel (videó lejátszáshoz szükséges)
export function serveFile(req, res, file, { cache = 'no-cache', mime } = {}) {
  let st;
  try { st = fs.statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const type = mime || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const etag = `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': cache, ETag: etag, 'Last-Modified': st.mtime.toUTCString() };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, base); res.end(); return true; }
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
    if (m && !m[1] && m[2]) { start = st.size - parseInt(m[2], 10); end = st.size - 1; }
    if (start >= st.size || end >= st.size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return true;
    }
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, { ...base, 'Content-Length': st.size });
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(file).pipe(res);
  return true;
}

export function serveStatic(req, res, rootDir, urlPath) {
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(rootDir, safe);
  if (!file.startsWith(rootDir)) return false;
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch { return false; }
  return serveFile(req, res, file);
}
