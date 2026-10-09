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

export function createUser(username, password) {
  if (!username || !/^[\w.@-]{2,64}$/.test(username)) throw new HttpError(400, 'Érvénytelen felhasználónév');
  if (!password || password.length < 6) throw new HttpError(400, 'A jelszó legalább 6 karakter legyen');
  if (get('SELECT id FROM users WHERE username = ?', username)) throw new HttpError(409, 'Ez a felhasználónév foglalt');
  run('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?)', username, hashPassword(password), Date.now());
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

export function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const s = get('SELECT s.token, s.expires, u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', token);
  if (!s || s.expires < Date.now()) return null;
  return { id: s.id, username: s.username, token };
}

// Middleware: bejelentkezés + CSRF védelem (módosító kéréseknél egyedi fejléc kell)
export function requireAuth(req) {
  const u = currentUser(req);
  if (!u) throw new HttpError(401, 'Bejelentkezés szükséges');
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-signage'] !== '1') {
    throw new HttpError(403, 'Hiányzó CSRF fejléc');
  }
  req.user = u;
}

export const listUsers = () => all('SELECT id, username, created_at FROM users ORDER BY id');
