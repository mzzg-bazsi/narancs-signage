// Adatbázis réteg – beépített node:sqlite, külső függőség nélkül.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.SIGNAGE_DATA || './data');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'signage.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 10,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  transition TEXT NOT NULL DEFAULT 'fade',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS screens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Új képernyő',
  approved INTEGER NOT NULL DEFAULT 0,
  playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
  schedule TEXT NOT NULL DEFAULT '[]',
  settings TEXT NOT NULL DEFAULT '{}',
  info TEXT NOT NULL DEFAULT '{}',
  last_seen INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS calendars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#f59e5b',
  ical_url TEXT NOT NULL DEFAULT '',
  ical_cache TEXT NOT NULL DEFAULT '[]',
  ical_fetched INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_id INTEGER NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  fields TEXT NOT NULL DEFAULT '[]',
  submit_text TEXT NOT NULL DEFAULT 'Küldés',
  thanks_text TEXT NOT NULL DEFAULT 'Köszönjük!',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  screen_id INTEGER,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  screen_ids TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  screen_id INTEGER,
  slide_id INTEGER,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stats_time ON stats(created_at);
CREATE INDEX IF NOT EXISTS idx_events_cal ON events(calendar_id);
`);

// sémabővítések a korábbi verziókkal létrehozott adatbázisokhoz
const addColumn = (table, col, def) => {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
};
addColumn('events', 'rrule', "TEXT NOT NULL DEFAULT ''"); // ismétlődés, pl. FREQ=WEEKLY;UNTIL=20261231

// JSON oszlopok automatikus kezelése
const JSON_COLS = new Set(['data', 'items', 'schedule', 'settings', 'info', 'fields', 'ical_cache', 'screen_ids']);

export function parseRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (JSON_COLS.has(k) && typeof out[k] === 'string') {
      try { out[k] = JSON.parse(out[k]); } catch { /* hagyjuk */ }
    }
  }
  return out;
}

export const all = (sql, ...p) => db.prepare(sql).all(...p).map(parseRow);
export const get = (sql, ...p) => parseRow(db.prepare(sql).get(...p));
export const run = (sql, ...p) => db.prepare(sql).run(...p);

// Általános CRUD segéd az egyszerű táblákhoz
export function crud(table, fields) {
  const enc = (k, v) => (JSON_COLS.has(k) && typeof v !== 'string' ? JSON.stringify(v ?? null) : v);
  const hasUpdated = fields.includes('updated_at');
  const editable = fields.filter((f) => f !== 'updated_at');
  return {
    list: (order = 'id DESC') => all(`SELECT * FROM ${table} ORDER BY ${order}`),
    get: (id) => get(`SELECT * FROM ${table} WHERE id = ?`, id),
    create(obj) {
      const cols = editable.filter((f) => obj[f] !== undefined);
      const vals = cols.map((c) => enc(c, obj[c]));
      if (hasUpdated) { cols.push('updated_at'); vals.push(Date.now()); }
      const r = run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...vals);
      return this.get(Number(r.lastInsertRowid));
    },
    update(id, obj) {
      const cols = editable.filter((f) => obj[f] !== undefined);
      const vals = cols.map((c) => enc(c, obj[c]));
      if (hasUpdated) { cols.push('updated_at'); vals.push(Date.now()); }
      if (cols.length) run(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`, ...vals, id);
      return this.get(id);
    },
    remove: (id) => run(`DELETE FROM ${table} WHERE id = ?`, id),
  };
}

export const Slides = crud('slides', ['name', 'type', 'duration', 'data', 'updated_at']);
export const Playlists = crud('playlists', ['name', 'items', 'transition', 'updated_at']);
export const Calendars = crud('calendars', ['name', 'color', 'ical_url']);
export const Events = crud('events', ['calendar_id', 'title', 'description', 'location', 'start', 'end', 'all_day', 'rrule']);
export const Forms = crud('forms', ['name', 'title', 'intro', 'fields', 'submit_text', 'thanks_text', 'updated_at']);
export const Screens = crud('screens', ['name', 'approved', 'playlist_id', 'schedule', 'settings']);

export function getSetting(key, def = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!r) return def;
  try { return JSON.parse(r.value); } catch { return def; }
}
export function setSetting(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}
