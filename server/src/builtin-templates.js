// Beépített sablonok különféle üzletekhez. Kétnyelvűek (L(angol, magyar)), a téma színeit követik,
// a dátumok relatívak ({{date+N}}, esemény day: N), a {{org_name}} a szervezet nevére cserélődik.
import { FORMAT } from './templates.js';

const L = (en, hu) => ({ en, hu });
const GRAD = 'linear-gradient(135deg, var(--bg2), var(--bg))';

// tartalom segédek
const text = (ref, name, d, duration = 10) => ({ ref, name, type: 'text', duration, data: { align: 'left', bg: GRAD, font_scale: 100, ...d } });
const cards = (ref, name, title, subtitle, list, columns = 3, duration = 15) => ({ ref, name, type: 'cards', duration, data: { title, subtitle, columns, cards: list } });
const card = (icon, title, txt, badge, target) => ({ icon, title, text: txt, ...(badge ? { badge } : {}), ...(target ? { target_slide: target } : {}) });
const clock = (ref, title) => ({ ref, name: L('Clock & weather', 'Óra és időjárás'), type: 'clock', duration: 10, data: { style: 'digital', show_seconds: false, show_date: true, show_weather: true, show_forecast: true, title } });
const calendar = (ref, name, title, cal, view = 'list', days = 14) => ({ ref, name, type: 'calendar', duration: 15, data: { title, calendar_ids: [cal], view, days_ahead: days, max_items: 7 } });
const qr = (ref, name, url, title, txt) => ({ ref, name, type: 'qr', duration: 12, data: { url, title, text: txt } });
const countdown = (ref, name, title, target, done) => ({ ref, name, type: 'countdown', duration: 10, data: { title, target, done_text: done, bg: GRAD } });
const formSlide = (ref, name, form) => ({ ref, name, type: 'form', duration: 45, data: { form_id: form } });
const menu = (ref, name, title, subtitle, buttons) => ({ ref, name, type: 'menu', duration: 30, data: { title, subtitle, columns: Math.min(3, buttons.length), buttons } });
const btn = (icon, label, sub, target) => ({ icon, label, sub, target_slide: target });
const zones = (ref, name, layout, size, parts) => ({ ref, name, type: 'zones', duration: 30, data: { layout, size, gap: true, zones: parts.map((p) => ({ transition: 'fade', items: p.map((s) => ({ slide_id: s })) })) } });
const playlist = (name, refs) => ({ name, transition: 'fade', items: refs.map((r) => ({ slide: r, duration: null })) });
const wifi = (ref) => qr(ref, L('Guest Wi-Fi', 'Vendég Wi-Fi'), 'WIFI:T:WPA;S:{{org_name}} Guest;P:change-me;;', L('Free Wi-Fi', 'Ingyenes Wi-Fi'), L('Scan with your phone camera to connect', 'Olvasd be a telefonod kamerájával a csatlakozáshoz'));

const feedbackForm = (ref) => ({
  ref, name: L('Feedback', 'Visszajelzés'), title: L('How was your visit?', 'Milyen volt nálunk?'), intro: L('Your opinion helps us improve. Thank you!', 'Véleményed segít nekünk fejlődni. Köszönjük!'),
  submit_text: L('Send', 'Küldés'), thanks_text: L('Thank you for your feedback! 🧡', 'Köszönjük a visszajelzést! 🧡'),
  fields: [
    { type: 'smiley', label: L('Overall', 'Összességében'), required: true },
    { type: 'rating', label: L('Service', 'Kiszolgálás') },
    { type: 'textarea', label: L('Anything we could do better?', 'Min javíthatnánk?') },
  ],
});
const feedback = (ref, form) => formSlide(ref, L('Feedback form', 'Visszajelzés űrlap'), form);

const PREVIEW = {'restaurant': 's4', 'office': 's4', 'retail': 's3', 'clinic': 's2', 'school': 's3', 'hotel': 's5', 'gym': 's2', 'conference': 's4', 'bar': 's2', 'salon': 's2'}; // a galéria előnézet ezzel a tartalommal indul
const T = (id, icon, category, name, description, body) => ({
  id, icon, category,
  template: { format: FORMAT, version: 1, meta: { name, description, category, author: 'Narancs Signage', license: 'CC0-1.0', preview: PREVIEW[id] }, forms: [], calendars: [], media: [], ...body },
});

export const CATEGORIES = {
  food: L('Food & drink', 'Vendéglátás'), office: L('Office', 'Iroda'), retail: L('Retail', 'Kereskedelem'), health: L('Health & beauty', 'Egészség, szépség'),
  education: L('Education', 'Oktatás'), hospitality: L('Hotels', 'Szálláshely'), sport: L('Sport', 'Sport'), events: L('Events', 'Rendezvény'),
};

export const BUILTIN_TEMPLATES = [
  // ------------------------------------------------------------- étterem
  T('restaurant', '🍽️', 'food', L('Restaurant & café', 'Étterem és kávézó'), L('Welcome, today’s menu with the clock alongside, daily special, opening hours, Wi-Fi and a feedback form.', 'Üdvözlés, mai menü az órával egymás mellett, napi ajánlat, nyitvatartás, Wi-Fi és visszajelzés űrlap.'), {
    slides: [
      text('s1', L('Welcome', 'Üdvözlés'), { kicker: L('Welcome to', 'Üdvözlünk!'), title: '{{org_name}}', body: L('Fresh, seasonal dishes made in our kitchen every day. Take a seat – we will be right with you!', 'Friss, szezonális ételek, minden nap a saját konyhánkból. Foglalj helyet, mindjárt jövünk!'), show_logo: true }),
      cards('s2', L('Today’s menu', 'Mai menü'), L('Today’s menu', 'Mai menü'), L('Served 11:30–15:00', 'Tálalás 11:30–15:00'), [
        card('🥣', L('Soup of the day', 'Napi leves'), L('Creamy pumpkin soup with roasted seeds', 'Sütőtökkrémleves pirított magokkal'), L('€4.90', '1 490 Ft')),
        card('🍝', L('Main course', 'Főétel'), L('Chicken paprikash with homemade dumplings', 'Csirkepaprikás galuskával'), L('€11.50', '3 290 Ft')),
        card('🥗', L('Vegetarian', 'Vegetáriánus'), L('Grilled vegetables with feta and couscous', 'Grillezett zöldségek fetával és kuszkusszal'), L('€10.90', '2 990 Ft')),
        card('🍰', L('Dessert', 'Desszert'), L('Cottage cheese dumplings with sour cream', 'Túrógombóc tejföllel'), L('€4.50', '1 290 Ft')),
      ], 2),
      clock('s3', L('Enjoy your meal!', 'Jó étvágyat!')),
      zones('s4', L('Menu with the clock', 'Menü órával'), 'right', 30, [['s2'], ['s3']]),
      text('s5', L('Daily special', 'Napi ajánlat'), { kicker: L('Chef’s special', 'A séf ajánlata'), title: L('Lunch menu: soup + main + drink', 'Menü: leves + főétel + ital'), body: L('Only €13.90 on weekdays between 11:30 and 15:00.', 'Hétköznap 11:30 és 15:00 között mindössze 3 990 Ft.'), align: 'center' }),
      cards('s6', L('Opening hours', 'Nyitvatartás'), L('Opening hours', 'Nyitvatartás'), '', [
        card('📅', L('Monday – Friday', 'Hétfő – péntek'), '07:00 – 22:00'), card('🌤️', L('Saturday', 'Szombat'), '09:00 – 23:00'), card('☀️', L('Sunday', 'Vasárnap'), '09:00 – 21:00'),
      ]),
      wifi('s7'),
      feedback('s8', 'f1'),
    ],
    forms: [feedbackForm('f1')],
    playlist: playlist(L('Restaurant', 'Étterem'), ['s1', 's4', 's5', 's6', 's7', 's8']),
  }),

  // ------------------------------------------------------------- iroda
  T('office', '🏢', 'office', L('Office lobby', 'Irodai előtér'), L('Visitor welcome, today’s meetings with the clock, touch check-in for guests, Wi-Fi and company news.', 'Vendégfogadás, mai megbeszélések órával, érintős vendégregisztráció, Wi-Fi és céges hírek.'), {
    slides: [
      text('s1', L('Welcome visitors', 'Vendégek üdvözlése'), { kicker: L('Welcome', 'Üdvözöljük'), title: '{{org_name}}', body: L('Please check in at the reception or on this screen. Your host will be notified.', 'Kérjük, jelentkezzen a recepción vagy ezen a képernyőn. Értesítjük, akihez érkezett.'), show_logo: true }),
      calendar('s2', L('Today’s meetings', 'Mai megbeszélések'), L('Meetings', 'Megbeszélések'), 'c1', 'list', 7),
      clock('s3', L('Have a great day!', 'Szép napot!')),
      zones('s4', L('Meetings with the clock', 'Megbeszélések órával'), 'right', 32, [['s2'], ['s3']]),
      formSlide('s5', L('Visitor check-in', 'Vendégregisztráció'), 'f1'),
      wifi('s6'),
      menu('s7', L('Visitor menu', 'Vendég menü'), L('How can we help?', 'Miben segíthetünk?'), L('Tap a topic', 'Érintsen meg egy témát'), [
        btn('✍️', L('Check in', 'Bejelentkezés'), L('Let your host know you are here', 'Jelezze érkezését'), 's5'), btn('📅', L('Meetings', 'Megbeszélések'), L('Today and this week', 'Ma és ezen a héten'), 's2'), btn('📶', 'Wi-Fi', L('Guest network', 'Vendéghálózat'), 's6'),
      ]),
      text('s8', L('Company news', 'Céges hírek'), { kicker: L('News', 'Hírek'), title: L('We are moving to the 3rd floor', 'Költözünk a 3. emeletre'), body: L('From next Monday the sales team works on the 3rd floor. The meeting rooms keep their names.', 'Jövő hétfőtől az értékesítési csapat a 3. emeleten dolgozik. A tárgyalók neve nem változik.') }),
    ],
    forms: [{ ref: 'f1', name: L('Visitor check-in', 'Vendégregisztráció'), title: L('Welcome! Please check in', 'Üdvözöljük! Kérjük, regisztráljon'), intro: L('We will let your host know you have arrived.', 'Értesítjük, akihez érkezett.'), submit_text: L('Check in', 'Bejelentkezés'), thanks_text: L('Thank you! Your host has been notified. 👋', 'Köszönjük! Értesítettük, akihez érkezett. 👋'),
      fields: [{ type: 'text', label: L('Your name', 'Név'), required: true }, { type: 'text', label: L('Company', 'Cég') }, { type: 'text', label: L('Visiting', 'Kihez érkezett?'), required: true }, { type: 'checkbox', label: L('I accept the visitor rules and privacy notice', 'Elfogadom a látogatói szabályzatot és az adatkezelési tájékoztatót'), required: true }] }],
    calendars: [{ ref: 'c1', name: L('Meeting rooms', 'Tárgyalók'), color: 'var(--accent)', events: [
      { title: L('Weekly team meeting', 'Heti csapatmegbeszélés'), location: L('Room 1', 'Tárgyaló 1'), day: 0, start: '09:30', end: '10:30', rrule: 'FREQ=WEEKLY' },
      { title: L('Client presentation', 'Ügyfélprezentáció'), location: L('Room 2', 'Tárgyaló 2'), day: 0, start: '14:00', end: '15:00' },
      { title: L('Budget review', 'Költségvetési egyeztetés'), location: L('Board room', 'Nagytárgyaló'), day: 1, start: '11:00', end: '12:00' },
      { title: L('Company breakfast', 'Céges reggeli'), location: L('Kitchen', 'Konyha'), day: 3, start: '08:30', end: '09:30' },
    ] }],
    playlist: playlist(L('Office lobby', 'Irodai előtér'), ['s1', 's4', 's7', 's8', 's6']),
  }),

  // ------------------------------------------------------------- bolt
  T('retail', '🛍️', 'retail', L('Shop', 'Üzlet'), L('Weekend sale with countdown, featured products, opening hours, loyalty QR code and customer feedback.', 'Hétvégi akció visszaszámlálóval, kiemelt termékek, nyitvatartás, törzsvásárlói QR kód és vásárlói visszajelzés.'), {
    slides: [
      text('s1', L('Weekend sale', 'Hétvégi akció'), { kicker: L('This weekend only', 'Csak ezen a hétvégén'), title: L('20% off everything', 'Mindenre 20% kedvezmény'), body: L('Show this screen at the checkout or use your loyalty card.', 'Mutasd fel a pénztárnál, vagy használd a törzsvásárlói kártyád.'), align: 'center', font_scale: 120 }),
      countdown('s2', L('Sale countdown', 'Akció visszaszámláló'), L('The sale starts in', 'Az akció kezdetéig'), '{{date+5}}T09:00', L('The sale has started! 🎉', 'Elkezdődött az akció! 🎉')),
      cards('s3', L('Featured products', 'Kiemelt termékek'), L('New arrivals', 'Új termékek'), L('Ask our staff for sizes and colours', 'Méretekért és színekért kérdezd kollégáinkat'), [
        card('👟', L('Running shoes', 'Futócipő'), L('Lightweight, breathable', 'Könnyű, szellőző'), L('NEW', 'ÚJ')), card('🧥', L('Rain jacket', 'Esőkabát'), L('Waterproof, packable', 'Vízálló, összehajtható'), '-20%'), card('🎒', L('City backpack', 'Városi hátizsák'), L('Laptop pocket, 22 L', 'Laptoptartó, 22 l')),
      ]),
      cards('s4', L('Opening hours', 'Nyitvatartás'), L('Opening hours', 'Nyitvatartás'), '', [
        card('📅', L('Monday – Friday', 'Hétfő – péntek'), '09:00 – 20:00'), card('🌤️', L('Saturday', 'Szombat'), '09:00 – 18:00'), card('☀️', L('Sunday', 'Vasárnap'), '10:00 – 16:00'),
      ]),
      qr('s5', L('Loyalty club', 'Törzsvásárlói klub'), 'https://example.com/club', L('Join our loyalty club', 'Csatlakozz a törzsvásárlói klubhoz'), L('Collect points with every purchase', 'Gyűjts pontokat minden vásárlással')),
      feedback('s6', 'f1'),
    ],
    forms: [feedbackForm('f1')],
    playlist: playlist(L('Shop', 'Üzlet'), ['s1', 's2', 's3', 's4', 's5', 's6']),
  }),

  // ------------------------------------------------------------- rendelő
  T('clinic', '🩺', 'health', L('Medical practice', 'Orvosi rendelő'), L('Welcome, doctors on duty, opening hours, patient information and online booking QR code.', 'Üdvözlés, rendelő orvosok, rendelési idő, betegtájékoztató és online időpontfoglalás QR kóddal.'), {
    slides: [
      text('s1', L('Welcome', 'Üdvözlés'), { kicker: L('Welcome to', 'Üdvözöljük!'), title: '{{org_name}}', body: L('Please take a seat. You will be called in by name.', 'Kérjük, foglaljon helyet, név szerint szólítjuk.'), show_logo: true }),
      cards('s2', L('Doctors today', 'Mai rendelés'), L('Doctors today', 'Ma rendel'), '', [
        card('👩‍⚕️', 'Dr. Anna Kovács', L('General practitioner · Room 1 · 08:00–12:00', 'Háziorvos · 1-es rendelő · 08:00–12:00')), card('👨‍⚕️', 'Dr. Péter Szabó', L('Paediatrician · Room 2 · 13:00–17:00', 'Gyermekorvos · 2-es rendelő · 13:00–17:00')), card('🦷', 'Dr. Eszter Nagy', L('Dentist · Room 3 · 09:00–15:00', 'Fogorvos · 3-as rendelő · 09:00–15:00')),
      ]),
      cards('s3', L('Opening hours', 'Rendelési idő'), L('Opening hours', 'Rendelési idő'), L('Emergency: call 112', 'Sürgős esetben hívja a 112-t'), [
        card('📅', L('Monday – Thursday', 'Hétfő – csütörtök'), '08:00 – 18:00'), card('📅', L('Friday', 'Péntek'), '08:00 – 14:00'), card('🚫', L('Weekend', 'Hétvége'), L('Closed', 'Zárva')),
      ]),
      text('s4', L('Patient information', 'Betegtájékoztató'), { kicker: L('Please note', 'Tájékoztatás'), title: L('Have your ID and insurance card ready', 'Kérjük, készítse elő személyi igazolványát és TAJ kártyáját'), body: L('If you have a fever or cough, please tell the assistant when you arrive.', 'Ha lázas vagy köhög, kérjük, érkezéskor jelezze az asszisztensnek.') }),
      qr('s5', L('Online booking', 'Online időpontfoglalás'), 'https://example.com/booking', L('Book your next appointment', 'Foglalja le következő időpontját'), L('Scan the code with your phone', 'Olvassa be a kódot a telefonjával')),
      clock('s6', L('Get well soon!', 'Jobbulást kívánunk!')),
    ],
    playlist: playlist(L('Medical practice', 'Rendelő'), ['s1', 's2', 's3', 's4', 's5', 's6']),
  }),

  // ------------------------------------------------------------- iskola
  T('school', '🎓', 'education', L('School', 'Iskola'), L('Upcoming school events, this week’s canteen menu, countdown to the holidays and an interactive info menu.', 'Iskolai események, a heti menza, visszaszámlálás a szünetig és interaktív információs menü.'), {
    slides: [
      text('s1', L('Announcement', 'Közlemény'), { kicker: L('Announcement', 'Közlemény'), title: L('Parents’ evening on Thursday', 'Szülői értekezlet csütörtökön'), body: L('17:00 in the assembly hall. Class teachers will be available afterwards in their classrooms.', '17:00-kor a díszteremben, utána az osztályfőnökök a tantermekben várják a szülőket.') }),
      calendar('s2', L('School events', 'Iskolai események'), L('Upcoming events', 'Közelgő események'), 'c1', 'list', 30),
      cards('s3', L('Canteen menu', 'Heti menza'), L('This week in the canteen', 'Heti menza'), '', [
        card('🥕', L('Monday', 'Hétfő'), L('Vegetable soup, chicken with rice', 'Zöldségleves, rizses hús')), card('🍝', L('Tuesday', 'Kedd'), L('Tomato soup, spaghetti bolognese', 'Paradicsomleves, bolognai spagetti')),
        card('🐟', L('Wednesday', 'Szerda'), L('Fish soup, potato salad', 'Halászlé, krumplisaláta')), card('🍗', L('Thursday', 'Csütörtök'), L('Chicken soup, schnitzel with mash', 'Húsleves, rántott hús pürével')),
        card('🥞', L('Friday', 'Péntek'), L('Bean soup, pancakes', 'Bableves, palacsinta')),
      ], 3),
      countdown('s4', L('Holiday countdown', 'Visszaszámlálás'), L('Until the holidays', 'A szünetig'), '{{date+40}}T13:00', L('Happy holidays! ☀️', 'Jó pihenést! ☀️')),
      menu('s5', L('Info menu', 'Információs menü'), L('What are you looking for?', 'Mit keresel?'), L('Tap a button', 'Érints meg egy gombot'), [
        btn('📅', L('Events', 'Események'), L('Trips, meetings, competitions', 'Kirándulás, értekezlet, verseny'), 's2'), btn('🍽️', L('Canteen', 'Menza'), L('This week’s menu', 'Heti menü'), 's3'), btn('📢', L('News', 'Hírek'), L('Latest announcement', 'Legfrissebb közlemény'), 's1'),
      ]),
      clock('s6', L('Have a good day at school!', 'Jó tanulást!')),
    ],
    calendars: [{ ref: 'c1', name: L('School events', 'Iskolai események'), color: 'var(--accent)', events: [
      { title: L('Parents’ evening', 'Szülői értekezlet'), location: L('Assembly hall', 'Díszterem'), day: 3, start: '17:00', end: '19:00' },
      { title: L('Sports day', 'Sportnap'), location: L('Sports field', 'Sportpálya'), day: 8, all_day: true },
      { title: L('Science fair', 'Tudományos vásár'), location: L('Library', 'Könyvtár'), day: 12, start: '10:00', end: '14:00' },
      { title: L('School trip – 7th grade', 'Osztálykirándulás – 7. évfolyam'), location: L('Lake Balaton', 'Balaton'), day: 20, all_day: true },
    ] }],
    playlist: playlist(L('School', 'Iskola'), ['s1', 's2', 's3', 's4', 's5', 's6']),
  }),

  // ------------------------------------------------------------- szálloda
  T('hotel', '🏨', 'hospitality', L('Hotel reception', 'Szálloda recepció'), L('Guest welcome, hotel services, tonight’s events, weather, Wi-Fi and a guest feedback form.', 'Vendégköszöntő, szolgáltatások, esti programok, időjárás, Wi-Fi és vendégvisszajelzés.'), {
    slides: [
      text('s1', L('Welcome guests', 'Vendégköszöntő'), { kicker: L('Welcome to', 'Üdvözöljük!'), title: '{{org_name}}', body: L('We wish you a pleasant stay. Our reception is open 24 hours a day.', 'Kellemes pihenést kívánunk! A recepció a nap 24 órájában a rendelkezésére áll.'), show_logo: true }),
      cards('s2', L('Hotel services', 'Szolgáltatások'), L('Our services', 'Szolgáltatásaink'), '', [
        card('🍳', L('Breakfast', 'Reggeli'), L('Restaurant · 07:00–10:30', 'Étterem · 07:00–10:30')), card('🧖', 'Spa & wellness', L('Level -1 · 09:00–21:00', '-1. szint · 09:00–21:00')),
        card('🏋️', L('Gym', 'Edzőterem'), L('Open 24/7 with your room key', 'Éjjel-nappal, a szobakulccsal')), card('🛎️', L('Room service', 'Szobaszerviz'), L('Dial 9 from your room', 'Hívja a 9-es melléket')),
      ], 2),
      calendar('s3', L('Hotel events', 'Esti programok'), L('Tonight and this week', 'Ma este és a héten'), 'c1', 'list', 7),
      clock('s4', L('Enjoy your stay!', 'Kellemes pihenést!')),
      zones('s5', L('Services with the weather', 'Szolgáltatások időjárással'), 'right', 32, [['s2', 's3'], ['s4']]),
      wifi('s6'),
      feedback('s7', 'f1'),
    ],
    forms: [feedbackForm('f1')],
    calendars: [{ ref: 'c1', name: L('Hotel events', 'Programok'), color: 'var(--accent)', events: [
      { title: L('Wine tasting', 'Borkóstoló'), location: L('Lobby bar', 'Lobby bár'), day: 0, start: '19:00', end: '21:00' },
      { title: L('Live piano music', 'Élő zongoraszó'), location: L('Restaurant', 'Étterem'), day: 1, start: '19:30', end: '22:00', rrule: 'FREQ=WEEKLY' },
      { title: L('Guided city walk', 'Városnéző séta'), location: L('Meet at reception', 'Találkozó a recepción'), day: 2, start: '10:00', end: '12:00' },
    ] }],
    playlist: playlist(L('Hotel', 'Szálloda'), ['s1', 's5', 's6', 's7']),
  }),

  // ------------------------------------------------------------- edzőterem
  T('gym', '💪', 'sport', L('Gym & fitness', 'Edzőterem'), L('Weekly class schedule (recurring), memberships, a monthly challenge with countdown and the member app.', 'Heti órarend ismétlődő órákkal, bérletek, havi kihívás visszaszámlálóval és tagsági app.'), {
    slides: [
      text('s1', L('Motivation', 'Motiváció'), { kicker: L('Today', 'Ma'), title: L('Stronger than yesterday 💪', 'Erősebb, mint tegnap 💪'), body: L('Remember to warm up and drink enough water.', 'Ne felejts el bemelegíteni és eleget inni.'), align: 'center', font_scale: 120 }),
      calendar('s2', L('Class schedule', 'Órarend'), L('This week’s classes', 'Heti órarend'), 'c1', 'week', 7),
      cards('s3', L('Memberships', 'Bérletek'), L('Memberships', 'Bérletek'), L('Ask at the reception', 'Érdeklődj a recepción'), [
        card('🎟️', L('Day pass', 'Napijegy'), L('Gym + classes', 'Terem + órák'), L('€12', '3 500 Ft')), card('📆', L('Monthly', 'Havi bérlet'), L('Unlimited entry', 'Korlátlan belépés'), L('€49', '14 900 Ft')), card('🏆', L('Annual', 'Éves bérlet'), L('2 months free', '2 hónap ajándék'), L('€490', '149 000 Ft')),
      ]),
      countdown('s4', L('Monthly challenge', 'Havi kihívás'), L('The 30-day challenge ends in', 'A 30 napos kihívás végéig'), '{{date+30}}T20:00', L('Well done, everyone! 🏅', 'Gratulálunk mindenkinek! 🏅')),
      qr('s5', L('Member app', 'Tagsági app'), 'https://example.com/app', L('Book classes in the app', 'Foglalj órát az appban'), L('Scan to download', 'Olvasd be a letöltéshez')),
      clock('s6', L('Train hard!', 'Jó edzést!')),
    ],
    calendars: [{ ref: 'c1', name: L('Classes', 'Órák'), color: 'var(--accent)', events: [
      { title: L('Yoga', 'Jóga'), location: L('Studio 1', '1-es terem'), day: 0, start: '18:00', end: '19:00', rrule: 'FREQ=WEEKLY' },
      { title: 'Spinning', location: L('Bike room', 'Bicikliterem'), day: 1, start: '07:00', end: '07:45', rrule: 'FREQ=WEEKLY' },
      { title: 'HIIT', location: L('Studio 2', '2-es terem'), day: 2, start: '18:30', end: '19:15', rrule: 'FREQ=WEEKLY' },
      { title: 'Pilates', location: L('Studio 1', '1-es terem'), day: 3, start: '09:00', end: '10:00', rrule: 'FREQ=WEEKLY' },
      { title: L('Boxing', 'Box'), location: L('Ring', 'Ring'), day: 4, start: '19:00', end: '20:00', rrule: 'FREQ=WEEKLY' },
    ] }],
    playlist: playlist(L('Gym', 'Edzőterem'), ['s1', 's2', 's3', 's4', 's5', 's6']),
  }),

  // ------------------------------------------------------------- rendezvény
  T('conference', '🎤', 'events', L('Conference & event', 'Konferencia, rendezvény'), L('Agenda next to the clock, speakers, countdown to the keynote, Wi-Fi and a session feedback form.', 'Program az órával, előadók, visszaszámlálás a nyitóelőadásig, Wi-Fi és előadás-értékelés.'), {
    slides: [
      text('s1', L('Welcome', 'Üdvözlés'), { kicker: L('Welcome to', 'Üdvözlünk!'), title: L('{{org_name}} Summit', '{{org_name}} Konferencia'), body: L('Registration is open in the foyer. Badges and the programme are at the desk.', 'A regisztráció az előtérben, a névkártyák és a program a pultnál.'), align: 'center', show_logo: true }),
      calendar('s2', L('Agenda', 'Program'), L('Agenda', 'Program'), 'c1', 'list', 2),
      clock('s3', ''),
      zones('s4', L('Agenda with the clock', 'Program órával'), 'right', 30, [['s2'], ['s3']]),
      cards('s5', L('Speakers', 'Előadók'), L('Speakers', 'Előadók'), '', [
        card('🎤', 'Laura Bennett', L('Keynote · The future of work', 'Nyitóelőadás · A munka jövője')), card('💡', 'Dávid Tóth', L('Product design that sticks', 'Termékdizájn, ami megmarad')), card('📊', 'Mira Lang', L('Data-driven decisions', 'Adatvezérelt döntések')),
      ]),
      countdown('s6', L('Keynote countdown', 'Visszaszámlálás'), L('The keynote starts in', 'A nyitóelőadásig'), '{{date+1}}T09:00', L('The keynote is starting – please take your seats!', 'Kezdődik a nyitóelőadás – kérjük, foglaljatok helyet!')),
      wifi('s7'),
      feedback('s8', 'f1'),
    ],
    forms: [{ ...feedbackForm('f1'), title: L('Rate the session', 'Értékeld az előadást') }],
    calendars: [{ ref: 'c1', name: L('Agenda', 'Program'), color: 'var(--accent)', events: [
      { title: L('Registration & coffee', 'Regisztráció és kávé'), location: L('Foyer', 'Előtér'), day: 1, start: '08:00', end: '09:00' },
      { title: L('Keynote: The future of work', 'Nyitóelőadás: A munka jövője'), location: L('Main hall', 'Nagyterem'), day: 1, start: '09:00', end: '10:00' },
      { title: L('Product design that sticks', 'Termékdizájn, ami megmarad'), location: L('Room A', 'A terem'), day: 1, start: '10:30', end: '11:30' },
      { title: L('Lunch', 'Ebéd'), location: L('Restaurant', 'Étterem'), day: 1, start: '12:00', end: '13:00' },
      { title: L('Data-driven decisions', 'Adatvezérelt döntések'), location: L('Room B', 'B terem'), day: 1, start: '13:30', end: '14:30' },
    ] }],
    playlist: playlist(L('Conference', 'Konferencia'), ['s1', 's4', 's5', 's6', 's7', 's8']),
  }),

  // ------------------------------------------------------------- bár
  T('bar', '🍹', 'food', L('Bar & pub', 'Bár, söröző'), L('Happy hour, drinks menu, weekly live music and quiz nights, countdown to the big match and a menu QR code.', 'Happy hour, itallap, heti élőzene és kvízest, visszaszámlálás a nagy meccsig és QR kódos étlap.'), {
    slides: [
      text('s1', 'Happy hour', { kicker: 'Happy hour', title: L('2 for 1 on cocktails', 'Koktélok 1+1 akcióban'), body: L('Every weekday from 17:00 to 19:00.', 'Minden hétköznap 17:00 és 19:00 között.'), align: 'center', font_scale: 125 }),
      cards('s2', L('Drinks menu', 'Itallap'), L('Drinks', 'Italok'), '', [
        card('🍺', L('Draught beer', 'Csapolt sör'), '0.5 l', L('€4.50', '1 290 Ft')), card('🍷', L('House wine', 'Házi bor'), '1 dl', L('€3.90', '990 Ft')),
        card('🍹', 'Mojito', L('Rum, lime, mint', 'Rum, lime, menta'), L('€8.50', '2 490 Ft')), card('🥤', L('Lemonade', 'Limonádé'), L('Homemade, 0.4 l', 'Házi, 0,4 l'), L('€3.50', '990 Ft')),
      ], 2),
      calendar('s3', L('Events', 'Programok'), L('Coming up', 'Programok'), 'c1', 'list', 14),
      countdown('s4', L('Match countdown', 'Meccs visszaszámláló'), L('Kick-off in', 'Kezdőrúgásig'), '{{date+3}}T20:45', L('The match is on – enjoy! ⚽', 'Megy a meccs – szurkoljunk! ⚽')),
      qr('s5', L('Food menu', 'Étlap'), 'https://example.com/menu', L('Hungry? See our food menu', 'Éhes vagy? Nézd meg az étlapot'), L('Scan with your phone', 'Olvasd be a telefonoddal')),
    ],
    calendars: [{ ref: 'c1', name: L('Bar events', 'Programok'), color: 'var(--accent)', events: [
      { title: L('Quiz night', 'Kvízest'), location: L('Main room', 'Nagyterem'), day: 1, start: '20:00', end: '22:00', rrule: 'FREQ=WEEKLY' },
      { title: L('Live music', 'Élőzene'), location: L('Stage', 'Színpad'), day: 3, start: '21:00', end: '23:30', rrule: 'FREQ=WEEKLY' },
      { title: L('Big match on the big screen', 'Nagy meccs kivetítőn'), location: L('Garden', 'Kert'), day: 3, start: '20:45', end: '22:45' },
    ] }],
    playlist: playlist(L('Bar', 'Bár'), ['s1', 's2', 's3', 's4', 's5']),
  }),

  // ------------------------------------------------------------- szalon
  T('salon', '💇', 'health', L('Salon & beauty', 'Szépségszalon'), L('Services with prices, this month’s offer, opening hours, online booking and a feedback form.', 'Szolgáltatások árakkal, havi ajánlat, nyitvatartás, online foglalás és visszajelzés.'), {
    slides: [
      text('s1', L('Welcome', 'Üdvözlés'), { kicker: L('Welcome to', 'Üdvözlünk!'), title: '{{org_name}}', body: L('Relax, we will be with you in a moment. Coffee or tea?', 'Helyezkedj el kényelmesen, mindjárt jövünk. Kávét vagy teát?'), show_logo: true }),
      cards('s2', L('Services', 'Szolgáltatások'), L('Services', 'Szolgáltatásaink'), L('Prices from', 'Árak -tól'), [
        card('✂️', L('Haircut', 'Hajvágás'), L('Wash, cut and styling', 'Mosás, vágás, szárítás'), L('€35', '8 900 Ft')), card('🎨', L('Colouring', 'Festés'), L('Full colour or highlights', 'Teljes festés vagy melír'), L('€65', '16 900 Ft')),
        card('💅', L('Manicure', 'Manikűr'), L('Gel polish included', 'Géllakkal'), L('€30', '7 500 Ft')), card('💆', L('Facial', 'Arckezelés'), L('Cleansing and mask, 60 min', 'Tisztítás és pakolás, 60 perc'), L('€55', '13 900 Ft')),
      ], 2),
      text('s3', L('Offer of the month', 'Havi ajánlat'), { kicker: L('Offer of the month', 'A hónap ajánlata'), title: L('Haircut + treatment −15%', 'Hajvágás + hajpakolás −15%'), body: L('Book this month and mention the offer.', 'Foglalj ebben a hónapban, és említsd az ajánlatot.'), align: 'center' }),
      cards('s4', L('Opening hours', 'Nyitvatartás'), L('Opening hours', 'Nyitvatartás'), '', [
        card('📅', L('Tuesday – Friday', 'Kedd – péntek'), '09:00 – 19:00'), card('🌤️', L('Saturday', 'Szombat'), '09:00 – 14:00'), card('🚫', L('Sunday – Monday', 'Vasárnap – hétfő'), L('Closed', 'Zárva')),
      ]),
      qr('s5', L('Online booking', 'Online foglalás'), 'https://example.com/booking', L('Book your next visit', 'Foglald le a következő időpontod'), L('Scan the code with your phone', 'Olvasd be a kódot a telefonoddal')),
      feedback('s6', 'f1'),
    ],
    forms: [feedbackForm('f1')],
    playlist: playlist(L('Salon', 'Szalon'), ['s1', 's2', 's3', 's4', 's5', 's6']),
  }),
];
