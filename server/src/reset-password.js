// Jelszó visszaállítása a szerveren (ha valaki kizárta magát):
//   sudo signage-reset-password <felhasználónév> [új jelszó] [--admin]
// Jelszó nélkül véletlen jelszót generál; --admin esetén a felhasználó adminisztrátor is lesz.
import crypto from 'node:crypto';
import { all, get, run } from './db.js';
import { hashPassword } from './auth.js';

const args = process.argv.slice(2);
const makeAdmin = args.includes('--admin');
const [username, given] = args.filter((a) => a !== '--admin');
const users = all('SELECT username, role FROM users ORDER BY id');
if (!username) {
  console.log('Usage: signage-reset-password <username> [new password] [--admin]');
  console.log(`Users: ${users.map((u) => `${u.username} (${u.role})`).join(', ') || '(none)'}`);
  process.exit(1);
}
const u = get('SELECT id FROM users WHERE username = ?', username);
if (!u) {
  console.error(`No such user: ${username}. Users: ${users.map((x) => x.username).join(', ') || '(none)'}`);
  process.exit(1);
}
if (given && given.length < 6) { console.error('The password must be at least 6 characters'); process.exit(1); }
const password = given || crypto.randomBytes(9).toString('base64url');
run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(password), u.id);
if (makeAdmin) run("UPDATE users SET role = 'admin' WHERE id = ?", u.id);
run('DELETE FROM sessions WHERE user_id = ?', u.id); // minden munkamenet kijelentkezik
console.log(`Password reset for "${username}"${makeAdmin ? ' (now administrator)' : ''}.`);
if (!given) console.log(`New password: ${password}`);
