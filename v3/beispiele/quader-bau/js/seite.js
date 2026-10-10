/* Quader Bau v3: "Vom Loch zum Haus". Eine klebende Bühne, der Scroll ist die Bauzeit.
   Drehbuch (P = Fortschritt der Bühnenstrecke, 0 bis 1):
     Auftakt     Buchstaben fallen in die Grube, "zum Haus." steigt in den Himmel
     Aushub      Zeitraffer vom leeren Grundstück zur Grube, die Kote fällt ins Minus
     Fundament   Achsen und Umriss werden auf den Boden geschlagen, Kote zurück auf ±0.00
     Wisch       Eine Schalungstafel fährt durchs Bild, dahinter steht das 3D-Modell
     Rohbau      Stapeln in 3D, die Kamera steigt durch das Treppenloch, die Latte misst mit
     Rückkehr    Der Zeitraffer giesst sich von unten wieder ins Bild
     Übergabe    Fertiges Haus, der Kran bringt den Schlüssel
     Ausgang     Das Bild schrumpft zur ersten Karte im Ring
   Ebenen reagieren: Zeiger (vorne mehr, hinten weniger), Scroll-Tempo (kurzes Strecken),
   am Handy Ziehen. Bei reduzierter Bewegung bleibt nur die Scroll-Kopplung. */
import { zerlege } from './kinetik.js';
import { GESCHOSSE, ROH_START, ROH_DAUER, HUELLE_START, koteBei, koteText } from './ablauf-zeit.js';

const html = document.documentElement;
let IST_3D = html.classList.contains('modus-3d');
const REDUZIERT = html.classList.contains('bewegung-reduziert');
const FEIN = html.classList.contains('zeiger-fein');
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => Array.from(w.querySelectorAll(s));
const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (x, a, b) => klemmen((x - a) / (b - a));
const mix = (a, b, k) => a + (b - a) * k;
const glatt = k => k * k * (3 - 2 * k);
const aus3 = k => 1 - Math.pow(1 - k, 3);
const karte = (x, a, b, c, d) => mix(c, d, seg(x, a, b));
const HOCHFORMAT = () => window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
const MOBIL = () => window.matchMedia('(max-width: 760px)').matches;

/* ---------- Drehbuch ---------- */
const D = {
  auftakt: { aus: [0.004, 0.05] },
  aushub: { ein: [0.03, 0.07], aus: [0.168, 0.198], film: [0.04, 0.2, 0, 0.22] },
  fundament: { ein: [0.2, 0.235], aus: [0.292, 0.318], film: [0.2, 0.31, 0.22, 0.4], plan: [0.204, 0.272] },
  wisch: [0.304, 0.324, 0.33, 0.352],
  rohbau: { ein: [0.348, 0.39], aus: [0.7, 0.732], t: [0.334, 0.74, 0.06, 0.92] },
  rueck: [0.732, 0.776],
  uebergabe: { ein: [0.786, 0.83], aus: [0.938, 0.968], film: [0.776, 0.912, 0.75, 1], schluessel: [0.824, 0.9] },
  ausgang: [0.952, 1],
};
/* Sprungziele in der Bühne: wo das Kapitel ganz steht */
const SPRUNG_P = { 'kapitel-aushub': 0.11, 'kapitel-fundament': 0.262, 'kapitel-rohbau': 0.47, 'kapitel-uebergabe': 0.885 };
/* Kapitelgrenzen, an denen die Schnur schlägt */
const GRENZEN = [0.03, 0.2, 0.348, 0.786];
const AUSHUB_TIEFE = 3.2;

let lenis = null;

function kopfHoehe() {
  return parseFloat(getComputedStyle(html).getPropertyValue('--kopf-h')) || 88;
}

/* ---------- Elemente ---------- */
const bau = $('[data-bau]');
const buehne = $('[data-buehne]');
const filmEbene = $('[data-film-ebene]');
const filmCanvas = $('[data-film]');
const modellEbene = $('[data-modell]');
const geschossBand = $('[data-geschoss-band]');
const geschossGross = $('[data-geschoss-gross]');
const planEbene = $('[data-plan]');
const planFlaeche = $('[data-plan-flaeche]');
const achsen = $$('[data-achse]');
const umriss = $('[data-umriss]');
const marken = $$('[data-marke]');
const auftaktEbene = $('.ebene--auftakt');
const auftaktText = $('[data-auftakt-text]');
const grube = $('[data-grube]');
const schnur = $('[data-schnur]');
const latte = $('[data-latte]');
const latteBand = $('[data-latte-band]');
const koteBox = $('[data-kote-box]');
const koteFeld = $('[data-kote]');
const koteOrt = $('[data-kote-ort]');
const wisch = $('[data-wisch]');
const schluessel = $('[data-schluessel]');
const himmel = $('[data-himmel]');
const kapitel = Object.fromEntries($$('[data-kapitel]').map(k => [k.dataset.kapitel, {
  el: k, satzEl: $('.kapitel__satz', k), lauf: $('.kapitel__lauf', k),
}]));

/* ---------- Weiches Scrollen (nur 3D, nur ohne reduzierte Bewegung) ---------- */
function ladeSkript(src) {
  return new Promise(fertig => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => fertig(true);
    s.onerror = () => fertig(false);
    document.head.appendChild(s);
  });
}
async function weichesScrollen() {
  if (!IST_3D || REDUZIERT) return;
  const ok = await ladeSkript('/hebel-vorschau/v3/studio/vendor/lenis.min.js');
  if (!ok || !window.Lenis) return;
  lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', beimScrollen);
  const takt = zeit => { lenis.raf(zeit); requestAnimationFrame(takt); };
  requestAnimationFrame(takt);
}

/* ---------- Kopf ---------- */
const kopf = $('[data-kopf]');
function kopfPruefen() {
  const ende = bau ? bau.offsetTop + bau.offsetHeight - kopfHoehe() : 24;
  const y = window.scrollY;
  kopf.classList.toggle('kopf--fest', IST_3D ? y > ende : y > 24);
}

/* ---------- Menü ---------- */
const menue = $('[data-menue]');
const menueAuf = $('[data-menue-auf]');
let menueVorher = null;
function menueOeffnen() {
  menueVorher = document.activeElement;
  menue.hidden = false;
  menueAuf.setAttribute('aria-expanded', 'true');
  html.classList.add('ist-menue-offen');
  if (lenis) lenis.stop();
  $('[data-menue-zu]').focus();
}
function menueSchliessen(zurueck = true) {
  menue.hidden = true;
  menueAuf.setAttribute('aria-expanded', 'false');
  html.classList.remove('ist-menue-offen');
  if (lenis) lenis.start();
  if (zurueck && menueVorher) menueVorher.focus();
}
menueAuf.addEventListener('click', menueOeffnen);
$('[data-menue-zu]').addEventListener('click', () => menueSchliessen());
menue.addEventListener('keydown', e => {
  if (e.key === 'Escape') { menueSchliessen(); return; }
  if (e.key !== 'Tab') return;
  const fokus = $$('a, button', menue);
  const erst = fokus[0], letzt = fokus[fokus.length - 1];
  if (e.shiftKey && document.activeElement === erst) { e.preventDefault(); letzt.focus(); }
  else if (!e.shiftKey && document.activeElement === letzt) { e.preventDefault(); erst.focus(); }
});

/* ---------- Sprünge mit Blende im Arc-Stil ---------- */
const blende = $('[data-blende]');
const blendeWort = $('[data-blende-wort]');
let blendeLaeuft = false;

function zielY(id, ziel) {
  if (IST_3D && bau && (id in SPRUNG_P || id === 'bau' || id === 'oben')) {
    const p = SPRUNG_P[id] || 0;
    return bau.offsetTop + p * (bau.offsetHeight - window.innerHeight) + (p ? 0 : -kopfHoehe());
  }
  return ziel.getBoundingClientRect().top + window.scrollY - kopfHoehe() + 2;
}

function springe(y, sofort) {
  y = Math.max(0, y);
  if (lenis) lenis.scrollTo(y, { immediate: sofort, duration: sofort ? 0 : 1.2, force: true });
  else window.scrollTo({ top: y, behavior: sofort || REDUZIERT ? 'auto' : 'smooth' });
}

const warte = ms => new Promise(r => setTimeout(r, ms));
async function mitBlende(wort, mitte) {
  if (REDUZIERT || blendeLaeuft) { await mitte(); return; }
  blendeLaeuft = true;
  blendeWort.textContent = wort || '';
  blende.classList.remove('ist-weg');
  blende.classList.add('ist-da');
  await warte(560);
  await mitte();
  await warte(140);
  blende.classList.add('ist-weg');
  await warte(620);
  blende.classList.remove('ist-da', 'ist-weg');
  blendeLaeuft = false;
}

document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href.startsWith('#')) {
    const id = href.slice(1);
    const ziel = id ? document.getElementById(id) : null;
    if (!ziel) return;
    e.preventDefault();
    if (!menue.hidden) menueSchliessen(false);
    if (a.dataset.projektart) projektartVorwaehlen(a.dataset.projektart);
    const wort = a.dataset.ziel || a.textContent.trim();
    mitBlende(wort, () => {
      springe(zielY(id, ziel), true);
      if (id === 'offerte') {
        const erstes = $('[data-schritt]:not([hidden]) input, [data-schritt]:not([hidden]) select');
        if (erstes) erstes.focus({ preventScroll: true });
      } else if (ziel.matches('article, section')) {
        ziel.setAttribute('tabindex', '-1');
        ziel.focus({ preventScroll: true });
      }
      return warte(60);
    });
    return;
  }
  // Seitenwechsel innerhalb von Hebel: erst die Blende, dann die neue Seite
  if (href.startsWith('/') && !href.startsWith('//') && !REDUZIERT && !e.metaKey && !e.ctrlKey && !e.shiftKey && a.target !== '_blank') {
    e.preventDefault();
    const wort = a.dataset.ziel || (href.startsWith('/#') ? 'Hebel' : a.textContent.trim());
    mitBlende(wort, () => { location.href = href; return warte(900); });
  }
});

/* ---------- Ebenen und Zeiger ---------- */
const zeiger = { x: 0, y: 0, zx: 0, zy: 0, px: -100, py: -100, zpx: -100, zpy: -100 };
const tempo = { v: 0, letztY: window.scrollY };

if (!REDUZIERT) {
  if (FEIN) {
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      zeiger.zx = (e.clientX / window.innerWidth - 0.5) * 2;
      zeiger.zy = (e.clientY / window.innerHeight - 0.5) * 2;
      zeiger.zpx = e.clientX; zeiger.zpy = e.clientY;
      anstossen();
    }, { passive: true });
  } else {
    // Handy: Ziehen verschiebt die Ebenen, nach dem Loslassen gleiten sie zurück
    let start = null;
    window.addEventListener('touchstart', e => { const t = e.touches[0]; start = { x: t.clientX, y: t.clientY }; }, { passive: true });
    window.addEventListener('touchmove', e => {
      if (!start) return;
      const t = e.touches[0];
      zeiger.zx = klemmen((t.clientX - start.x) / 140, -1, 1);
      zeiger.zy = klemmen((t.clientY - start.y) / 260, -1, 1) * 0.6;
      anstossen();
    }, { passive: true });
    const ende = () => { start = null; zeiger.zx = 0; zeiger.zy = 0; anstossen(); };
    window.addEventListener('touchend', ende, { passive: true });
    window.addEventListener('touchcancel', ende, { passive: true });
  }
}

/* Eigener Zeiger mit Beschriftung, Magnet-Knöpfe */
const zeigerEl = $('[data-zeiger]');
const zeigerText = $('[data-zeiger-text]');
let zeigerUeber = null;
if (FEIN && !REDUZIERT && zeigerEl) {
  html.classList.add('hat-zeiger');
  document.addEventListener('pointerover', e => {
    const ziel = e.target.closest('a, button, label, .ring__karte, [data-ring], input, select, textarea');
    if (ziel === zeigerUeber) return;
    zeigerUeber = ziel;
    const eingabe = !!ziel && ziel.matches('input:not([type="radio"]), select, textarea');
    zeigerEl.classList.toggle('ist-weg', eingabe);
    let text = '';
    if (ziel && !eingabe) {
      if (ziel.matches('[data-ring], .ring__karte')) text = 'Ziehen';
      else text = ziel.dataset.ziel || '';
    }
    zeigerText.textContent = text;
    zeigerEl.classList.toggle('ist-gross', !!ziel && !eingabe);
    zeigerEl.classList.toggle('hat-text', !!text);
  });
  document.documentElement.addEventListener('pointerleave', () => zeigerEl.classList.add('ist-weg'));
  document.documentElement.addEventListener('pointerenter', () => zeigerEl.classList.remove('ist-weg'));
}
const magnete = [];
function magneteSammeln() {
  if (!FEIN || REDUZIERT) return;
  for (const el of $$('[data-magnet]')) if (!magnete.some(m => m.el === el)) magnete.push({ el, x: 0, y: 0 });
}

/* ---------- Kinetik ---------- */
const saetze = {};
function kinetikVorbereiten() {
  if (!IST_3D) return;
  saetze.a = zerlege($('.auftakt__a'), 'fallen');
  saetze.b = zerlege($('.auftakt__b'), 'heben');
  for (const [name, k] of Object.entries(kapitel)) saetze[name] = zerlege(k.satzEl);
  saetze.wisch = zerlege($('.wisch__wort'), 'stapeln');
}
/* Titel ausserhalb der Bühne bauen sich beim Hereinkommen auf */
const freieSaetze = [];
function freieSaetzeVorbereiten() {
  $$('.projekte__titel, .offerte__titel').forEach(el => freieSaetze.push({ el, satz: zerlege(el) }));
}

/* Intro: einmal beim Laden, nicht bei reduzierter Bewegung und nicht bei Ankunft aus Hebel */
let intro = REDUZIERT || html.classList.contains('ankunft') ? 1 : 0;
const introStart = performance.now() + 250;

/* ---------- Film und Modell ---------- */
let film = null, stapel = null, stapelLaedt = false, modellAn = false;
let grubeY = 0, fallHoehe = 600, latteM = 64, lesezeile = 0, latteOben = 0;

async function filmStarten() {
  if (!IST_3D) return;
  try {
    const { starteFilm } = await import('./film.js');
    film = await starteFilm({ canvas: filmCanvas, basis: '/hebel-vorschau/v3/beispiele/quader-bau/video-zeitraffer/', hoch: HOCHFORMAT(), fokus: [0.5, 0.62] });
    film.beiLayout(lage => {
      // Vorderkante der Grube im Bild: dort verschwinden die fallenden Buchstaben
      grubeY = lage.y + lage.h * (HOCHFORMAT() ? 0.87 : 0.85);
      buehne.style.setProperty('--grube-y', Math.round(grubeY) + 'px');
      vermessen();
      anstossen();
    });
    filmEbene.classList.add('ist-bereit');
    anstossen();
  } catch (fehler) {
    console.warn('Zeitraffer nicht verfügbar:', fehler && fehler.message);
  }
}

async function stapelLaden() {
  if (stapel || stapelLaedt || !IST_3D) return;
  stapelLaedt = true;
  try {
    const { starteStapel } = await import('./stapel.js');
    stapel = await starteStapel({
      canvas: $('[data-canvas]'),
      rahmen: modellEbene,
      mobil: MOBIL(),
      ruhig: REDUZIERT,
      fehler: () => { modellEbene.classList.add('ist-kaputt'); },
    });
    stapel.zeigen(modellAn);
    html.dataset.stapel = 'bereit';
    anstossen();
  } catch (fehler) {
    console.warn('3D-Rohbau nicht verfügbar, der Zeitraffer läuft weiter:', fehler && fehler.message);
    modellEbene.classList.add('ist-kaputt');
  }
}

/* ---------- Latte: Meterteilung bauen ---------- */
const LATTE_OBEN = 16, LATTE_UNTEN = -6;
function latteBauen() {
  if (!latteBand) return;
  const frag = document.createDocumentFragment();
  for (let m = LATTE_OBEN; m > LATTE_UNTEN; m--) {
    const d = document.createElement('div');
    d.className = 'latte__meter';
    const z = document.createElement('span');
    z.textContent = m === 0 ? '±0' : (m > 0 ? '+' : '−') + Math.abs(m);
    d.append(z);
    frag.append(d);
  }
  latteBand.append(frag);
}
function vermessen() {
  if (!IST_3D || !buehne) return;
  latteM = parseFloat(getComputedStyle(buehne).getPropertyValue('--m')) || 64;
  lesezeile = koteBox.offsetTop + koteBox.offsetHeight / 2;
  latteOben = latte.offsetTop;
  const t = $('.auftakt__titel', grube);
  if (t) fallHoehe = Math.max(300, (grubeY || buehne.clientHeight * 0.85) - t.offsetTop + 160);
}

/* ---------- Bühnen-Fortschritt ---------- */
function buehnenP() {
  const r = bau.getBoundingClientRect();
  const strecke = r.height - window.innerHeight;
  if (strecke <= 0) return 0;
  return klemmen(-r.top / strecke);
}
function kap(def, P) {
  return { ein: seg(P, def.ein[0], def.ein[1]), aus: seg(P, def.aus[0], def.aus[1]) };
}
function ortBei(t) {
  if (t < ROH_START) return 'Bodenplatte';
  if (t >= HUELLE_START) return 'Dach';
  const f = klemmen(Math.floor((t - ROH_START) / ROH_DAUER), 0, GESCHOSSE - 1);
  return f === 0 ? 'Erdgeschoss' : f + '. Obergeschoss';
}
function geschossIndex(t) {
  if (t < ROH_START + 0.04) return 0;
  if (t >= HUELLE_START - 0.02) return GESCHOSSE;
  return klemmen(Math.floor((t - ROH_START - 0.04) / ROH_DAUER) + 1, 0, GESCHOSSE - 1);
}
function koteFormat(m) {
  if (m < -0.005) return '−' + Math.abs(m).toFixed(2);
  return koteText(m);
}

let letzteKote = '', letzterOrt = '', letzterGeschoss = -1;

function buehneSetzen(P) {
  const zx = zeiger.x, zy = zeiger.y;
  const zug = klemmen(tempo.v / 2600, -1, 1); // Scroll-Tempo, -1 bis 1

  /* Film: Zeit und Sichtbarkeit */
  let vt;
  if (P < D.fundament.film[0]) vt = karte(P, ...D.aushub.film);
  else if (P < D.rueck[0] - 0.05) vt = karte(P, ...D.fundament.film);
  else vt = karte(P, ...D.uebergabe.film);
  if (film) film.setze(vt);

  // Film weg, solange das Modell steht; die Rückkehr giesst sich von unten ins Bild
  const modellZeit = P >= D.wisch[1] && P < D.rueck[1];
  const rueck = seg(P, D.rueck[0], D.rueck[1]);
  const aus = glatt(seg(P, D.ausgang[0], D.ausgang[1]));
  let clip = '';
  if (modellZeit) clip = 'inset(' + ((1 - aus3(rueck)) * 100).toFixed(2) + '% 0 0 0)';
  if (aus > 0) {
    const ix = MOBIL() ? 9 : 30, iy = MOBIL() ? 24 : 21;
    clip = 'inset(' + (aus * iy).toFixed(2) + '% ' + (aus * ix).toFixed(2) + '% ' + (aus * iy).toFixed(2) + '% ' + (aus * ix).toFixed(2) + '%)';
  }
  filmEbene.style.clipPath = clip;
  // Ken Burns je Kapitel, plus Zeiger (hinten wenig) und Tempo (kurzes Strecken)
  const ruhe = P < 0.2 ? karte(P, 0, 0.2, 1.1, 1.04) : P < 0.4 ? karte(P, 0.2, 0.32, 1.06, 1.02) : karte(P, 0.74, 0.95, 1.08, 1.04);
  filmEbene.style.transform = 'translate3d(' + (zx * -10).toFixed(2) + 'px,' + (zy * -7 - zug * 10).toFixed(2) + 'px,0) scale(' + ruhe.toFixed(4) + ',' + (ruhe * (1 + Math.abs(zug) * 0.014)).toFixed(4) + ')';

  /* Modell: von Wisch bis Rückkehr */
  const modellSoll = P >= D.wisch[1] - 0.002 && P < D.rueck[1] + 0.004;
  if (modellSoll !== modellAn) {
    modellAn = modellSoll;
    modellEbene.classList.toggle('ist-an', modellAn);
    if (stapel) stapel.zeigen(modellAn);
  }
  if (P > D.wisch[0] - 0.08) stapelLaden();
  const t3 = klemmen(karte(P, ...D.rohbau.t));
  if (stapel) stapel.setzeZeit(t3);
  const gi = geschossIndex(t3);
  if (gi !== letzterGeschoss && geschossBand) {
    letzterGeschoss = gi;
    geschossBand.style.transform = 'translate3d(0,' + (-gi * 20) + '%,0)';
  }
  if (geschossGross) geschossGross.style.transform = 'translate3d(' + (zx * -16).toFixed(1) + 'px,' + (zy * -10 + zug * 18).toFixed(1) + 'px,0)';

  /* Plan: Achsen schlagen sich auf den Boden */
  const plan = seg(P, D.fundament.plan[0], D.fundament.plan[1]);
  const planWeg = seg(P, D.fundament.aus[0], D.wisch[1]);
  planEbene.style.opacity = (plan > 0 ? 1 - planWeg : 0).toFixed(3);
  achsen.forEach((a, i) => { a.style.strokeDashoffset = (1 - aus3(seg(plan, i * 0.07, i * 0.07 + 0.45))).toFixed(4); });
  if (umriss) umriss.style.strokeDashoffset = (1 - aus3(seg(plan, 0.45, 0.95))).toFixed(4);
  marken.forEach((m, i) => { m.style.opacity = seg(plan, 0.35 + i * 0.05, 0.5 + i * 0.05).toFixed(3); });
  planFlaeche.style.setProperty('--zx', (zx * -22).toFixed(1) + 'px');
  planFlaeche.style.setProperty('--zy', (zy * -12).toFixed(1) + 'px');

  /* Auftakt */
  const auftaktAus = seg(P, D.auftakt.aus[0], D.auftakt.aus[1]);
  if (saetze.a) {
    saetze.a.setze(intro, auftaktAus, fallHoehe);
    saetze.b.setze(seg(intro, 0.25, 1), seg(auftaktAus, 0.15, 1));
  }
  auftaktEbene.style.transform = 'translate3d(' + (zx * -26).toFixed(1) + 'px,' + (zy * -16).toFixed(1) + 'px,0)';
  if (auftaktText) {
    const k = seg(P, 0, 0.022), ein = seg(intro, 0.5, 1);
    auftaktText.style.opacity = (ein * (1 - k)).toFixed(3);
    auftaktText.style.transform = 'translate3d(0,' + (k * -60 + (1 - ein) * 24).toFixed(1) + 'px,0)';
  }

  /* Kapitel: Titel und Lauftext laufen in zwei Tiefen */
  for (const name of ['aushub', 'fundament', 'rohbau', 'uebergabe']) {
    const k = kapitel[name];
    if (!k) continue;
    const s = kap(D[name], P);
    k.el.classList.toggle('ist-da', s.ein > 0 && s.aus < 1);
    if (saetze[name]) saetze[name].setze(s.ein, s.aus, fallHoehe);
    const weg = s.aus * -90 + (1 - s.ein) * 40;
    k.satzEl.style.transform = 'translate3d(' + (zx * -30).toFixed(1) + 'px,' + (zy * -18 + weg * 0.5 - zug * 26).toFixed(1) + 'px,0)';
    const sicht = seg(s.ein, 0.35, 1) * (1 - seg(s.aus, 0, 0.6));
    k.lauf.style.opacity = sicht.toFixed(3);
    k.lauf.style.transform = 'translate3d(' + (zx * -14).toFixed(1) + 'px,' + ((1 - seg(s.ein, 0.35, 1)) * 46 + s.aus * -70 + zy * -8 - zug * 12).toFixed(1) + 'px,0)';
  }

  /* Wisch: eine Schalungstafel fährt durchs Bild */
  const wEin = seg(P, D.wisch[0], D.wisch[1]);
  const wAus = seg(P, D.wisch[2], D.wisch[3]);
  const wischDa = wEin > 0 && wAus < 1;
  wisch.classList.toggle('ist-da', wischDa);
  if (wischDa) wisch.style.clipPath = 'inset(' + ((1 - aus3(wEin)) * 100).toFixed(2) + '% 0 ' + (aus3(wAus) * 100).toFixed(2) + '% 0)';
  if (saetze.wisch) saetze.wisch.setze(seg(P, D.wisch[0] + 0.006, D.wisch[1] + 0.004), seg(P, D.wisch[2] - 0.002, D.wisch[3] - 0.004));

  /* Kote und Latte */
  let kote = 0, ort = 'Bauplatz';
  if (P < D.aushub.film[0]) { kote = 0; ort = 'Bauplatz'; }
  else if (P < D.fundament.film[0]) { kote = -AUSHUB_TIEFE * glatt(seg(P, D.aushub.film[0], D.aushub.film[1])); ort = 'Baugrube'; }
  else if (P < D.wisch[1]) { kote = -AUSHUB_TIEFE * (1 - glatt(seg(P, D.fundament.film[0] + 0.02, D.fundament.film[1]))); ort = kote < -0.01 ? 'Fundament' : 'Bodenplatte'; }
  else if (P < D.rueck[1]) { kote = koteBei(t3); ort = ortBei(t3); }
  else { kote = koteBei(1); ort = P > D.uebergabe.schluessel[1] ? 'Übergeben' : 'Hülle und Fenster'; }
  const kt = koteFormat(kote);
  if (kt !== letzteKote) { koteFeld.textContent = kt; letzteKote = kt; }
  if (ort !== letzterOrt) { koteOrt.textContent = ort; letzterOrt = ort; }
  // die Teilung der Latte steht so, dass die aktuelle Kote auf der Lesezeile liegt
  const bandY = lesezeile - latteOben - (LATTE_OBEN - kote) * latteM;
  latteBand.style.transform = 'translate3d(0,' + bandY.toFixed(1) + 'px,0)';
  latte.style.transform = 'translate3d(' + (zx * -46 + aus * 280).toFixed(1) + 'px,' + (zy * -14).toFixed(1) + 'px,0) skewY(' + (zug * -2.4).toFixed(2) + 'deg)';
  koteBox.style.transform = 'translate3d(' + (zx * -40 + aus * 280).toFixed(1) + 'px,' + (zy * -12).toFixed(1) + 'px,0)';
  koteBox.style.opacity = (1 - seg(aus, 0, 0.45)).toFixed(3);
  latte.style.opacity = (1 - seg(aus, 0.2, 0.7)).toFixed(3);

  /* Schnur: schlägt an jeder Kapitelgrenze einmal über die Bühne, auf Höhe der Lesezeile */
  let schlag = 0;
  for (const g of GRENZEN) {
    const k = seg(P, g - 0.006, g + 0.022);
    if (k > 0 && k < 1) schlag = Math.max(schlag, Math.sin(Math.PI * k));
  }
  schnur.style.transform = 'translate3d(0,' + (lesezeile + zy * -12).toFixed(1) + 'px,0) scaleX(' + Math.max(0.001, schlag).toFixed(3) + ')';

  /* Schlüssel: der Kran bringt ihn herunter, er pendelt mit dem Tempo */
  const sk = seg(P, D.uebergabe.schluessel[0], D.uebergabe.schluessel[1]);
  const sAus = seg(P, D.uebergabe.aus[0], D.uebergabe.aus[1]);
  schluessel.style.setProperty('--runter', (aus3(sk) - aus3(sAus)).toFixed(4));
  schluessel.style.setProperty('--pendel', (zug * -10 + zx * 4 + (1 - sk) * 7).toFixed(2) + 'deg');
  schluessel.style.setProperty('--sx', (zx * -60).toFixed(1) + 'px');
  schluessel.classList.toggle('ist-da', sk > 0 && sAus < 1);

  if (himmel) himmel.style.opacity = (1 - aus).toFixed(3);
  buehne.style.setProperty('--ausgang', aus.toFixed(4));
}

/* ---------- Takt: läuft nur, solange sich etwas bewegt ---------- */
let raf = 0, letzt = 0;
let ring = null;
function anstossen() { if (!raf) raf = requestAnimationFrame(takt); }

function takt(jetzt) {
  raf = 0;
  const dt = Math.min(0.05, letzt ? (jetzt - letzt) / 1000 : 0.016);
  letzt = jetzt;
  let weiter = false;

  // Scroll-Tempo, geglättet; fällt von selbst auf null zurück
  const y = window.scrollY;
  const roh = (y - tempo.letztY) / Math.max(0.008, dt);
  tempo.letztY = y;
  if (!REDUZIERT) {
    tempo.v += (roh - tempo.v) * (1 - Math.exp(-dt * 8));
    if (Math.abs(tempo.v) < 6 && roh === 0) tempo.v = 0; else weiter = true;
  }
  const f = 1 - Math.exp(-dt * 7);
  zeiger.x += (zeiger.zx - zeiger.x) * f;
  zeiger.y += (zeiger.zy - zeiger.y) * f;
  if (Math.abs(zeiger.zx - zeiger.x) + Math.abs(zeiger.zy - zeiger.y) > 0.001) weiter = true;

  if (intro < 1) {
    intro = klemmen((jetzt - introStart) / 1500);
    weiter = true;
  }

  if (IST_3D && bau && bau.getBoundingClientRect().bottom > -80) buehneSetzen(buehnenP());
  freieSetzen();
  if (ring) ring.scroll();

  // eigener Zeiger und Magnete
  if (html.classList.contains('hat-zeiger')) {
    const g = 1 - Math.exp(-dt * 22);
    zeiger.px += (zeiger.zpx - zeiger.px) * g;
    zeiger.py += (zeiger.zpy - zeiger.py) * g;
    zeigerEl.style.transform = 'translate3d(' + zeiger.px.toFixed(1) + 'px,' + zeiger.py.toFixed(1) + 'px,0)';
    if (Math.abs(zeiger.zpx - zeiger.px) + Math.abs(zeiger.zpy - zeiger.py) > 0.3) weiter = true;
    for (const m of magnete) {
      if (!m.el.isConnected) continue;
      const r = m.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) { if (m.x || m.y) { m.x = m.y = 0; m.el.style.translate = ''; } continue; }
      const cx = r.left + r.width / 2 - m.x, cy = r.top + r.height / 2 - m.y;
      const dx = zeiger.zpx - cx, dy = zeiger.zpy - cy;
      const nah = Math.abs(dx) < r.width * 0.75 + 30 && Math.abs(dy) < r.height * 0.75 + 30;
      const sx = nah ? dx * 0.2 : 0, sy = nah ? dy * 0.28 : 0;
      m.x += (sx - m.x) * g; m.y += (sy - m.y) * g;
      m.el.style.translate = Math.abs(m.x) + Math.abs(m.y) < 0.05 ? '' : m.x.toFixed(1) + 'px ' + m.y.toFixed(1) + 'px';
      if (Math.abs(sx - m.x) + Math.abs(sy - m.y) > 0.1) weiter = true;
    }
  }

  kopfPruefen();
  if (weiter) anstossen(); else letzt = 0;
}

function freieSetzen() {
  const h = window.innerHeight;
  for (const s of freieSaetze) {
    const r = s.el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > h + 200) continue;
    s.satz.setze(seg(h - r.top, h * 0.04, h * 0.5), 0);
  }
  if (offerteGross) {
    const r = offerte.getBoundingClientRect();
    if (r.bottom > 0 && r.top < h) {
      const k = (h - r.top) / (h + r.height);
      offerteGross.style.transform = 'translate3d(' + (zeiger.x * -20).toFixed(1) + 'px,' + ((0.5 - k) * 240 + zeiger.y * -12 - tempo.v * 0.012).toFixed(1) + 'px,0)';
      // vorne: die Latte läuft schneller als die Seite und verzieht sich mit dem Tempo
      if (offerteLatte) offerteLatte.style.transform = 'translate3d(' + (zeiger.x * -34).toFixed(1) + 'px,' + ((0.5 - k) * -260 + zeiger.y * -18).toFixed(1) + 'px,0) skewY(' + klemmen(tempo.v / 2600, -1, 1) * -3 + 'deg)';
    }
  }
}

function beimScrollen() { anstossen(); }
window.addEventListener('scroll', () => { if (!lenis) beimScrollen(); }, { passive: true });
window.addEventListener('resize', () => { vermessen(); anstossen(); });

/* ---------- Offerte ---------- */
const offerte = $('[data-offerte]');
const offerteGross = offerte ? $('.offerte__gross', offerte) : null;
const offerteZahl = $('[data-offerte-gross]');
const offerteLatte = $('[data-offerte-latte]');
const formular = $('[data-formular]');
const schritte = $$('[data-schritt]', formular);
const schrittMarken = $$('[data-schritt-marke]', formular);
const ENTWURF = 'quader-bau-offerte-entwurf';
const ERGEBNIS = 'quader-bau-offerte-demo';
let schrittJetzt = 0;

const speicher = {
  lesen(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  schreiben(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  loeschen(k) { try { localStorage.removeItem(k); } catch (e) { /* nichts zu tun */ } },
};

function daten() {
  const fd = new FormData(formular);
  const d = {};
  for (const [k, v] of fd.entries()) d[k] = String(v).trim();
  return d;
}
function entwurfSichern() { speicher.schreiben(ENTWURF, { ...daten(), _schritt: Math.min(schrittJetzt, 2) }); }
function entwurfLaden() {
  const d = speicher.lesen(ENTWURF);
  if (!d) return;
  for (const [k, v] of Object.entries(d)) {
    if (k.startsWith('_')) continue;
    const felder = formular.elements[k];
    if (!felder) continue;
    if (felder instanceof RadioNodeList) {
      for (const f of felder) if (f.type === 'radio') f.checked = f.value === v;
    } else if (felder.type === 'radio') felder.checked = felder.value === v;
    else felder.value = v;
  }
}
function projektartVorwaehlen(wert) {
  const feld = formular.querySelector('input[name="projektart"][value="' + wert + '"]');
  if (!feld) return;
  feld.checked = true;
  fehlerZeigen('projektart', false);
  if (schrittJetzt !== 0) zeigeSchritt(0, false);
  entwurfSichern();
}
function fehlerZeigen(name, an) {
  const meldung = formular.querySelector('[data-fehler="' + name + '"]');
  if (meldung) meldung.hidden = !an;
  formular.querySelectorAll('[name="' + name + '"]').forEach(f => {
    if (f.type === 'radio') f.closest('.wahl').classList.toggle('ist-fehlerhaft', an);
    else if (an) f.setAttribute('aria-invalid', 'true');
    else f.removeAttribute('aria-invalid');
  });
}
const PRUEFUNG = {
  0: { projektart: d => !!d.projektart },
  1: { flaeche: d => !!d.flaeche, planung: d => !!d.planung, beginn: d => !!d.beginn },
  2: {
    name: d => (d.name || '').length >= 2,
    email: d => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email || ''),
    telefon: d => !d.telefon || (d.telefon.replace(/[^\d]/g, '').length >= 9),
  },
};
function schrittPruefen(i) {
  const regeln = PRUEFUNG[i];
  if (!regeln) return true;
  const d = daten();
  let erstesFalsch = null;
  for (const [name, ok] of Object.entries(regeln)) {
    const gut = ok(d);
    fehlerZeigen(name, !gut);
    if (!gut && !erstesFalsch) erstesFalsch = formular.querySelector('[name="' + name + '"]');
  }
  if (erstesFalsch) { erstesFalsch.focus(); return false; }
  return true;
}
function zeigeSchritt(i, fokus = true) {
  const vorher = schrittJetzt;
  schrittJetzt = i;
  schritte.forEach((s, j) => {
    const an = j === i;
    s.hidden = !an;
    s.classList.toggle('ist-neu', an);
    s.classList.toggle('von-hinten', an && i < vorher);
  });
  schrittMarken.forEach((m, j) => {
    m.classList.toggle('ist-aktiv', j === i);
    m.classList.toggle('ist-erledigt', j < i);
    if (j === i) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
  });
  $('[data-schritte]', formular).hidden = i === 4;
  // grosse Schrittzahl im Hintergrund: setzt von oben auf wie eine Platte am Kran
  if (offerteZahl) {
    const neu = String(Math.min(i, 2) + 1);
    offerte.classList.toggle('ist-fertig', i === 4);
    if (offerteZahl.textContent !== neu || i === 4) {
      offerteZahl.textContent = neu;
      offerteGross.classList.remove('setzt');
      void offerteGross.offsetWidth;
      offerteGross.classList.add('setzt');
    }
  }
  if (i === 3) zusammenfassen();
  if (fokus) {
    const s = schritte[i];
    const ziel = i >= 3 ? s : s.querySelector('input:not([type="hidden"]), select, textarea');
    if (ziel) ziel.focus({ preventScroll: true });
    const oben = formular.getBoundingClientRect().top;
    if (oben < kopfHoehe() || oben > window.innerHeight * 0.6) springe(oben + window.scrollY - kopfHoehe() - 16, false);
  }
}
const TITEL = {
  projektart: 'Projektart', flaeche: 'Geschossfläche', planung: 'Planung', beginn: 'Baubeginn',
  gemeinde: 'Gemeinde', beschrieb: 'Beschrieb', name: 'Name', email: 'E-Mail', telefon: 'Telefon', kanal: 'Antwort per',
};
const GRUPPEN = [
  { titel: 'Projektart', schritt: 0, felder: ['projektart'] },
  { titel: 'Umfang und Zeitraum', schritt: 1, felder: ['flaeche', 'planung', 'beginn', 'gemeinde', 'beschrieb'] },
  { titel: 'Kontakt', schritt: 2, felder: ['name', 'email', 'telefon', 'kanal'] },
];
function zusammenfassen() {
  const d = daten();
  const ziel = $('[data-zusammenfassung]', formular);
  ziel.textContent = '';
  for (const g of GRUPPEN) {
    const div = document.createElement('div');
    div.className = 'zf__gruppe';
    const dt = document.createElement('dt');
    dt.textContent = g.titel;
    const dd = document.createElement('dd');
    const teile = g.felder.filter(f => d[f]).map(f => (g.felder.length > 1 ? TITEL[f] + ': ' : '') + d[f]);
    dd.textContent = teile.join(' · ') || 'nichts angegeben';
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'zf__aendern';
    knopf.textContent = 'Ändern';
    knopf.setAttribute('aria-label', g.titel + ' ändern');
    knopf.addEventListener('click', () => zeigeSchritt(g.schritt));
    div.append(dt, dd, knopf);
    ziel.append(div);
  }
}
formular.addEventListener('click', e => {
  if (e.target.closest('[data-weiter]')) {
    if (schrittPruefen(schrittJetzt)) { entwurfSichern(); zeigeSchritt(schrittJetzt + 1); }
  } else if (e.target.closest('[data-zurueck]')) {
    zeigeSchritt(Math.max(0, schrittJetzt - 1));
  } else if (e.target.closest('[data-loeschen]')) {
    speicher.loeschen(ERGEBNIS); speicher.loeschen(ENTWURF);
    formular.reset();
    $('[data-loesch-meldung]', formular).hidden = false;
  } else if (e.target.closest('[data-neu]')) {
    formular.reset();
    speicher.loeschen(ENTWURF);
    $('[data-loesch-meldung]', formular).hidden = true;
    zeigeSchritt(0);
  }
});
formular.addEventListener('change', e => {
  const name = e.target.name;
  if (name) {
    const regel = (PRUEFUNG[schrittJetzt] || {})[name];
    if (regel && regel(daten())) fehlerZeigen(name, false);
  }
  entwurfSichern();
});
formular.addEventListener('input', e => {
  const regel = (PRUEFUNG[schrittJetzt] || {})[e.target.name];
  if (regel && e.target.getAttribute('aria-invalid') && regel(daten())) fehlerZeigen(e.target.name, false);
});
// Enter in einem Textfeld führt zum nächsten Schritt, statt das Formular abzuschicken
formular.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && schrittJetzt < 3) {
    e.preventDefault();
    const weiter = schritte[schrittJetzt].querySelector('[data-weiter]');
    if (weiter) weiter.click();
  }
});
formular.addEventListener('submit', e => {
  e.preventDefault();
  if (schrittJetzt !== 3) return;
  for (let i = 0; i < 3; i++) if (!schrittPruefen(i)) { zeigeSchritt(i); schrittPruefen(i); return; }
  const d = daten();
  const nummer = 'QB-' + new Date().getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000));
  speicher.schreiben(ERGEBNIS, { ...d, nummer, erfasst: new Date().toISOString(), demo: true });
  speicher.loeschen(ENTWURF);
  $('[data-nummer]', formular).textContent = nummer;
  const vorname = (d.name || '').split(/\s+/)[0];
  $('[data-danke]', formular).textContent = vorname ? 'Danke, ' + vorname + '. Ihre Anfrage ist erfasst.' : 'Danke. Ihre Anfrage ist erfasst.';
  $('[data-loesch-meldung]', formular).hidden = true;
  zeigeSchritt(4);
});

/* ---------- Start ---------- */
entwurfLaden();
latteBauen();
kinetikVorbereiten();
freieSaetzeVorbereiten();
magneteSammeln();
if (IST_3D) {
  filmStarten();
  // Das 3D-Modell erst nach dem ersten Bild laden, damit der Zeitraffer zuerst steht
  const spaeter = window.requestIdleCallback || (f => setTimeout(f, 900));
  spaeter(() => stapelLaden(), { timeout: 2500 });
}
import('./ring.js').then(({ starteRing }) => {
  ring = starteRing({ sektion: $('[data-projekte]'), reduziert: REDUZIERT, fein: FEIN, beiWechsel: () => magneteSammeln() });
  anstossen();
}).catch(f => console.warn('Ring nicht verfügbar, die Liste bleibt:', f && f.message));
vermessen();
weichesScrollen();
anstossen();
// Nach dem Laden der Schrift neu messen (Titelhöhe, Lesezeile)
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { vermessen(); anstossen(); });
