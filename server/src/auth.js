// Felhasználókezelés és munkamenetek (scrypt jelszó hash, HttpOnly süti)
import crypto from 'node:crypto';
import { get, run, all } from './db.js';
import { HttpError, parseCookies } from './http.js';

const SESSION_DAYS = 30;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [, saltHex, hashHex] = String(stored).split('$');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

export const userCount = () => get('SELECT COUNT(*) AS n FROM users').n;

// Szerepkörök: admin = minden; editor = tartalmak, listák, képernyők, vészjelzés; viewer = csak megtekintés
export const ROLES = ['admin', 'editor', 'viewer'];
const checkRole = (role) => { if (!ROLES.includes(role)) throw new HttpError(400, 'Ismeretlen szerepkör'); return role; };

export function createUser(username, password, role = 'admin') {
  if (!username || !/^[\w.@-]{2,64}$/.test(username)) throw new HttpError(400, 'Érvénytelen felhasználónév');
  if (!password || password.length < 6) throw new HttpError(400, 'A jelszó legalább 6 karakter legyen');
  if (get('SELECT id FROM users WHERE username = ?', username)) throw new HttpError(409, 'Ez a felhasználónév foglalt');
  run('INSERT INTO users (username, pass_hash, role, created_at) VALUES (?, ?, ?, ?)', username, hashPassword(password), checkRole(role), Date.now());
}

export function login(username, password) {
  const u = get('SELECT * FROM users WHERE username = ?', username);
  if (!u || !verifyPassword(password, u.pass_hash)) throw new HttpError(401, 'Hibás felhasználónév vagy jelszó');
  const token = crypto.randomBytes(32).toString('hex');
  run('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)', token, u.id, Date.now() + SESSION_DAYS * 864e5);
  run('DELETE FROM sessions WHERE expires < ?', Date.now());
  return token;
}

export function sessionCookie(token, req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${token ? SESSION_DAYS * 86400 : 0}${secure}`;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function currentUser(req) {
  // API kulcs: Authorization: Bearer ns_… (a kulcs saját szerepkörével, süti és CSRF fejléc nélkül)
  const bearer = /^Bearer\s+(ns_[a-f0-9]{40,})$/i.exec(req.headers.authorization || '')?.[1];
  if (bearer) {
    const t = get('SELECT t.id tid, t.role, u.id, u.username FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ?', sha256(bearer));
    if (!t) return null;
    run('UPDATE api_tokens SET last_used = ? WHERE id = ?', Date.now(), t.tid);
    return { id: t.id, username: t.username, role: t.role, api: true };
  }
  const token = parseCookies(req).sid;
  if (!token) return null;
  const s = get('SELECT s.token, s.expires, u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', token);
  if (!s || s.expires < Date.now()) return null;
  return { id: s.id, username: s.username, role: s.role || 'admin', token };
}

// csak adminisztrátornak: felhasználók, API kulcsok, rendszerbeállítások, mentés, párosítás, képernyő törlése
function adminOnly(method, p) {
  return /^\/api\/(users|tokens)(\/|$)/.test(p) || ['/api/backup', '/api/samples', '/api/screens/pair', '/api/slides/brandify'].includes(p)
    || (method === 'PUT' && p === '/api/settings') || (method === 'DELETE' && /^\/api\/screens\/\d+$/.test(p));
}
const SELF_SERVICE = ['/api/account/password', '/api/auth/logout'];
export function authorize(req) {
  const role = req.user.role, p = req.url.split('?')[0];
  if (role === 'admin') return;
  if (adminOnly(req.method, p) || (role === 'viewer' && req.method !== 'GET' && !SELF_SERVICE.includes(p))) {
    throw new HttpError(403, 'Ehhez nincs jogosultságod');
  }
}

export function createToken(userId, name, role) {
  if (!name || String(name).length > 80) throw new HttpError(400, 'Adj nevet a kulcsnak');
  const token = `ns_${crypto.randomBytes(24).toString('hex')}`;
  run('INSERT INTO api_tokens (name, hash, role, user_id, created_at) VALUES (?, ?, ?, ?, ?)', String(name), sha256(token), checkRole(role || 'editor'), userId, Date.now());
  return token;
}
export const listTokens = () => all('SELECT t.id, t.name, t.role, t.created_at, t.last_used, u.username FROM api_tokens t JOIN users u ON u.id = t.user_id ORDER BY t.id');
export function setRole(id, role) { run('UPDATE users SET role = ? WHERE id = ?', checkRole(role), id); }

// Middleware: bejelentkezés + CSRF védelem (módosító kéréseknél egyedi fejléc kell)
export function requireAuth(req) {
  const u = currentUser(req);
  if (!u) throw new HttpError(401, 'Bejelentkezés szükséges');
  if (!u.api && req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-signage'] !== '1') {
    throw new HttpError(403, 'Hiányzó CSRF fejléc');
  }
  req.user = u;
}

export const listUsers = () => all('SELECT id, username, role, created_at FROM users ORDER BY id');
