/* Hebel v4 auf der Grundlage von v3: was zur Werkstatt (werkstatt.js) dazukommt. Ale, 11.10.2026: "v3 als Basis,
   nur die Liste ändern". Hier stehen die Teile, die werkstatt.js nicht kennt:
   - Helfer neben dem Logo: winkt bei Hover, hüpft beim Klick (v4-01-hebel.md, Abschnitt 4)
   - Namensfeld "Wie heisst Ihr Betrieb?": meldet den Namen an werkstatt.js (Ereignis hebel-betrieb), die ihn auf den
     Bildschirm "Ihr Betrieb" an Station 6 zeichnet; füllt das Formularfeld "Betrieb" vor
   - Arbeiten: Pizzeria Tondo und Achsmass Architekten als gezeichnete Vorschau (vorschau-zeichnen.js)
   - Preise: Haarlinien beim Hereinscrollen, kleiner Helfer am Panel, "Anfragen" füllt das Anliegen vor
   Die Teile stammen aus einstieg.js (v4, Stand 2e3c473) und sind dort unverändert gelassen. */

import { zeichneVorschau, schriftenLaden } from './vorschau-zeichnen.js';

const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
/* Ruhig nur, wenn der Besucher es selbst gewählt hat; die Systemeinstellung wird bewusst nicht ausgewertet */
let RUHIG = html.classList.contains('ruhig');
document.addEventListener('hebel-ruhig', e => { RUHIG = !!e.detail; });
const FEIN = window.matchMedia('(pointer: fine)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const jetztMs = () => performance.now();

/* ---------- Helfer neben dem Logo ---------- */
const marke = $('.kopf .marke'), markeHelfer = marke && $('.marke-helfer', marke), markeArm = markeHelfer && $('.arm-r', markeHelfer);
const POWER1_INOUT = 'cubic-bezier(.455,.03,.515,.955)';
let markeWinkt = null, huepftBis = 0;
if (marke && markeArm && FEIN && typeof markeArm.animate === 'function') {
  marke.addEventListener('pointerenter', e => {
    if (RUHIG || e.pointerType === 'touch' || markeWinkt) return;
    markeWinkt = markeArm.animate([0, 18, 0, 18, 0].map(g => ({ transform: `rotate(${g}deg)`, easing: POWER1_INOUT })), { duration: 700 });
    markeWinkt.onfinish = markeWinkt.oncancel = () => { markeWinkt = null; };
  });
}
/* Unterdämpfte Feder, exakt gelöst: Scheitel genau `hoehe` px, danach schwingt sie mit Dämpfung 0.6 aus */
function huepfer(el, hoehe, daempfung, antwort) {
  const w0 = (2 * Math.PI) / antwort, wd = w0 * Math.sqrt(1 - daempfung * daempfung), ab = daempfung * w0;
  const tScheitel = Math.atan2(wd, ab) / wd;
  const amp = hoehe / (Math.exp(-ab * tScheitel) * Math.sin(wd * tScheitel));
  const start = jetztMs();
  const schritt = jetzt => {
    const t = Math.max(0, (jetzt - start) / 1000);
    if (t >= 0.6) { el.style.transform = ''; return; }
    el.style.transform = `translateY(${(-amp * Math.exp(-ab * t) * Math.sin(wd * t)).toFixed(2)}px)`;
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}
if (marke && markeHelfer) {
  marke.addEventListener('click', e => {
    if (RUHIG || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const jetzt = jetztMs();
    if (jetzt < huepftBis) return;
    huepftBis = jetzt + 350;
    huepfer(markeHelfer, 6, 0.6, 0.35);
    setTimeout(() => { location.href = marke.href; }, 350);
  });
}

/* ---------- Formular vorbefüllen ---------- */
let autoFirma = '';
function betriebVorbefuellen(name) {
  const f = $('#f-firma');
  if (f && (!f.value || f.value === autoFirma)) { f.value = name; autoFirma = name; }
}
document.addEventListener('click', e => {
  const a = e.target && e.target.closest && e.target.closest('a[data-paket]');
  if (!a) return;
  const anliegen = $('#f-anliegen');
  if (anliegen && !anliegen.value.trim()) anliegen.value = `Paket: ${a.dataset.paket}`;
});

/* ---------- Namensfeld ----------
   Höchstens 40 Zeichen, nur als Text (werkstatt.js zeichnet ihn auf eine Canvas-Textur, nie als HTML),
   sessionStorage hebel-betrieb. Gemeldet mit hebel-betrieb { name, zeigen } und in window.hebelBetrieb, für eine
   Werkstatt, die erst später fertig gebaut ist. zeigen = Enter oder "Zeigen": die Kamera fährt zu Station 6. */
const feld = $('#betrieb-name');
function nameAnwenden(zeigen) {
  const n = feld.value.replace(/\s+/g, ' ').trim().slice(0, 40);
  try { if (n) sessionStorage.setItem('hebel-betrieb', n); else sessionStorage.removeItem('hebel-betrieb'); } catch (e) { /* ohne Speicher geht es auch */ }
  betriebVorbefuellen(n);
  window.hebelBetrieb = n;
  document.dispatchEvent(new CustomEvent('hebel-betrieb', { detail: { name: n, zeigen: !!zeigen } }));
}
if (feld) {
  let entprellt = 0, letzterLauf = -1e9;
  feld.addEventListener('input', () => {
    // das erste Zeichen wirkt sofort, schnelles Weitertippen wird auf 120 ms gebündelt
    clearTimeout(entprellt);
    const jetzt = jetztMs();
    if (jetzt - letzterLauf > 120) { letzterLauf = jetzt; nameAnwenden(false); }
    else entprellt = setTimeout(() => { letzterLauf = jetztMs(); nameAnwenden(false); }, 120);
  });
  const nameForm = $('#name-form');
  if (nameForm) nameForm.addEventListener('submit', e => { e.preventDefault(); clearTimeout(entprellt); feld.blur(); nameAnwenden(true); });
  try {
    const gespeichert = sessionStorage.getItem('hebel-betrieb');
    if (gespeichert) { feld.value = gespeichert.slice(0, 40); nameAnwenden(false); }
  } catch (e) { /* kein sessionStorage */ }
}

/* ---------- Arbeiten: gezeichnete Vorschau, t läuft einmal beim Hereinscrollen (3 s) ---------- */
const kacheln = $$('canvas[data-vorschau]').map(cv => {
  const k = { cv, ctx: cv.getContext('2d'), art: cv.dataset.vorschau, start: -1, t: 0 };
  k.zeichnen = () => { k.ctx.clearRect(0, 0, cv.width, cv.height); zeichneVorschau(k.ctx, k.art, k.t, ''); };
  k.zeichnen();
  return k;
});
function kachelLauf(k) {
  let letzteZeit = 0;
  const schritt = jetzt => {
    k.t = RUHIG ? 1 : clamp((jetzt - k.start) / 3000, 0, 1);
    if (jetzt - letzteZeit >= 33 || k.t >= 1) { letzteZeit = jetzt; k.zeichnen(); }
    if (k.t < 1) requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const k = kacheln.find(x => x.cv === e.target);
    if (k) { k.start = jetztMs(); kachelLauf(k); }
  }), { threshold: 0.35 });
  kacheln.forEach(k => io.observe(k.cv));
} else kacheln.forEach(k => { k.t = 1; k.zeichnen(); });
schriftenLaden().then(() => kacheln.forEach(k => k.zeichnen()));

/* ---------- Preise ---------- */
html.classList.add('bewegt');   // erst hier verstecken: bricht das Modul vorher ab, bleibt alles sichtbar
const panel = $('.preise-panel');
if (panel) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { panel.classList.add('gezeigt'); io.disconnect(); } }), { threshold: 0.2 });
    io.observe(panel);
  } else panel.classList.add('gezeigt');
}
/* Kleiner Helfer am Preis-Panel: schaut nach links, dreht sich zur Spalte unter dem Zeiger */
const preisHelfer = $('.preis-helfer');
if (panel && preisHelfer && FEIN) {
  const grund = () => { preisHelfer.style.setProperty('--blick', '-1'); preisHelfer.style.setProperty('--neigung', '0deg'); };
  $$('.paket', panel).forEach(sp => {
    sp.addEventListener('pointerenter', e => {
      if (RUHIG || e.pointerType !== 'mouse') return;
      const h = preisHelfer.getBoundingClientRect(), r = sp.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - (h.left + h.width / 2);
      preisHelfer.style.setProperty('--blick', dx < 0 ? '-1' : '1');
      const n = clamp(1 - Math.abs(dx) / Math.max(1, r.width * 2.5), 0, 1);
      preisHelfer.style.setProperty('--neigung', `${(4 + n * 10).toFixed(1)}deg`);
    });
  });
  panel.addEventListener('pointerleave', grund);
}
