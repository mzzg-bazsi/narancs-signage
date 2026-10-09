// Szerver oldali fordítások (hibaüzenetek, CSV fejléc, minták). A kulcs a magyar eredeti szöveg,
// a felület fordításai a public/shared/i18n.js-ben vannak.
import { getSetting } from './db.js';

export const LANGS = ['en', 'hu'];
export const DEFAULT_LANG = 'en';
export const lang = () => (LANGS.includes(getSetting('language')) ? getSetting('language') : DEFAULT_LANG);
export const locale = () => ({ en: 'en-GB', hu: 'hu-HU' })[lang()];

const EN = {
  // hitelesítés, általános
  'Érvénytelen felhasználónév': 'Invalid username',
  'A jelszó legalább 6 karakter legyen': 'The password must be at least 6 characters',
  'Ez a felhasználónév foglalt': 'This username is already taken',
  'Hibás felhasználónév vagy jelszó': 'Wrong username or password',
  'Bejelentkezés szükséges': 'Sign-in required',
  'Hiányzó CSRF fejléc': 'Missing CSRF header',
  'Túl nagy kérés': 'Request too large',
  'Hibás JSON': 'Invalid JSON',
  'A rendszer már be van állítva': 'The system is already set up',
  'Túl sok próbálkozás, várj egy percet': 'Too many attempts, please wait a minute',
  'Ismeretlen végpont': 'Unknown endpoint',
  'Nem engedélyezett': 'Not allowed',
  'Nem található': 'Not found',
  'Szerverhiba': 'Server error',
  'Csak http(s) URL engedélyezett': 'Only http(s) URLs are allowed',
  // lejátszó
  'Érvénytelen eszközazonosító': 'Invalid device ID',
  'Ismeretlen eszköz': 'Unknown device',
  'Ismeretlen űrlap': 'Unknown form',
  'Kötelező mező: {label}': 'Required field: {label}',
  'Érvénytelen e-mail: {label}': 'Invalid e-mail: {label}',
  'Nem engedélyezett hírfolyam': 'Feed not allowed',
  'Hiányzó koordináták': 'Missing coordinates',
  // admin
  'Nincs ilyen képernyő': 'No such screen',
  'Csak kép, videó, hang vagy PDF tölthető fel': 'Only images, videos, audio or PDF files can be uploaded',
  'A fájl túl nagy': 'The file is too large',
  'Nincs ilyen fájl': 'No such file',
  'Ismeretlen tartalomtípus': 'Unknown content type',
  'Adj nevet a tartalomnak': 'Give the content a name',
  'Adj nevet a listának': 'Give the playlist a name',
  'Nincs ilyen párosító kód. Ellenőrizd a képernyőn megjelenő számot.': 'No such pairing code. Check the number shown on the screen.',
  'Ismeretlen parancs': 'Unknown command',
  'Az üzenet nem lehet üres': 'The message cannot be empty',
  'Érvénytelen arculat': 'Invalid branding',
  'Érvénytelen nyelv': 'Invalid language',
  'Saját magadat nem törölheted': 'You cannot delete yourself',
  'A jelenlegi jelszó hibás': 'The current password is wrong',
  'Az új jelszó legalább 6 karakter legyen': 'The new password must be at least 6 characters',
  // nevek, CSV
  'Képernyő {n}': 'Screen {n}',
  ' (másolat)': ' (copy)',
  'Előnézet': 'Preview',
  'Időpont': 'Time',
  'Képernyő': 'Screen',
  'igen': 'yes',
  'nem': 'no',
  'urlap': 'form',
  '(névtelen)': '(untitled)',
  // arculat bemutató
  'Arculat előnézet': 'Branding preview',
  'Arculat': 'Branding',
  'Hirdetmény': 'Announcement',
  'Közlemény': 'Notice',
  'Üdvözlünk!': 'Welcome!',
  'Így néz ki egy hirdetmény az új arculattal. A színek, a betűtípus és a logó mindenhol egységes.': 'This is how an announcement looks with the new branding. Colours, fonts and the logo are consistent everywhere.',
  'Kártyák': 'Cards',
  'Szolgáltatásaink': 'Our services',
  'Minta kártyák az arculat színeivel': 'Sample cards in the brand colours',
  'Kávézó': 'Café',
  'Földszint, 7:00–18:00': 'Ground floor, 7:00–18:00',
  'ÚJ': 'NEW',
  'Könyvtár': 'Library',
  '2. emelet': '2nd floor',
  'Edzőterem': 'Gym',
  '-1. szint': 'Level -1',
  'Menü': 'Menu',
  'Miben segíthetünk?': 'How can we help?',
  'Érintsd meg a témát': 'Tap a topic',
  'Térkép': 'Map',
  'Programok': 'Events',
  'Visszajelzés': 'Feedback',
  'Naptár': 'Calendar',
  'Közelgő események': 'Upcoming events',
  'Óra': 'Clock',
  'Csapatmegbeszélés': 'Team meeting',
  'Tárgyaló 2': 'Meeting room 2',
  'Aula': 'Hall',
  'Családi nap': 'Family day',
  'Park': 'Park',
};
const DICTS = { en: EN };

export function tr(key, vars) {
  const l = lang();
  let s = l === 'hu' ? key : (DICTS[l]?.[key] ?? key);
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
