/* Hebel v4, Startseite: Kopf, Menü, Helfer neben dem Logo, Namensfeld, Anker, Arbeiten-Kacheln, Fakten,
   Preise und Formular. Auftrag: docs/webstudio-2026-10/master-prompts/v4-01-hebel.md (dazu v4-00-gemeinsam.md);
   seit v4-05-foerderband.md Abschnitt 9 steht oben rechts das Förderband (ablauf-band.js) statt der
   Bildschirm-Szene mit drei Helfern und Reitern. Die Szene ist hier entfernt (im Git-Verlauf bis 06739ba);
   das Namensfeld meldet den Namen an das Band (Station 6). Formular aus werkstatt.js (v3), Logik unverändert.
   Referenz Lenis wie Mailerbot; Feder mit Dämpfung 1.0 (Kacheln). Nichts hält den Scroll. */

import { zeichneVorschau, schriftenLaden } from './vorschau-zeichnen.js';

/* ---------- Grundlagen ---------- */
const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
/* Ruhig nur, wenn der Besucher es selbst gewählt hat (Klasse ruhig aus localStorage hebel-ruhig).
   Die Systemeinstellung "reduzierte Bewegung" wird bewusst nicht ausgewertet. */
let RUHIG = html.classList.contains('ruhig');
const FEIN = window.matchMedia('(pointer: fine)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const jetztMs = () => performance.now();

const KONFIG = {
  supabaseUrl: 'https://dvbqxlakemsjdrcdkfxc.supabase.co',
  // Öffentlicher Anon-Schlüssel wie auf der bisherigen Seite (Rechte regelt die Datenbank).
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YnF4bGFrZW1zamRyY2RrZnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODcwMjYsImV4cCI6MjA5MzM2MzAyNn0._QdYsO4Ns3-oFOxUvGaD-qjcuSUr1iDRWRydr7BAPkg',
};

/* Feder mit Dämpfung 1.0 (kritisch gedämpft), exakt gelöst, damit sie bei jedem dt stabil bleibt.
   antwort = Periode in Sekunden (apple-design §4), beschl = äussere Beschleunigung (Stoss). */
function feder(f, ziel, antwort, dt, beschl = 0) {
  const w = (2 * Math.PI) / antwort;
  const z = ziel + beschl / (w * w);
  const x0 = f.x - z, v0 = f.v, c = v0 + w * x0, e = Math.exp(-w * dt);
  f.x = z + (x0 + c * dt) * e;
  f.v = (v0 - w * c * dt) * e;
}
const ruht = (f, ziel, eps = 1e-3) => Math.abs(f.x - ziel) < eps && Math.abs(f.v) < eps * 10;

/* ======================================================================
   Lenis (wie Mailerbot), im Ruhig-Modus aus. window.hebelLenis: das Förderband scrollt damit zum Stationsblock.
   ====================================================================== */
let lenis = null;
function lenisStart() {
  if (lenis || RUHIG || typeof window.Lenis !== 'function') return;
  try {
    lenis = new window.Lenis({
      duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true, syncTouch: false, touchMultiplier: 2, wheelMultiplier: 1, autoRaf: true,
      // Lenis wertet sonst die Systemeinstellung aus und springt bei Ankern ohne Bewegung (Prompt D verbietet das)
      respectReducedMotion: false,
    });
  } catch (e) { lenis = null; }
  window.hebelLenis = lenis;
}
function lenisStopp() { if (lenis) { lenis.destroy(); lenis = null; } window.hebelLenis = null; }
lenisStart();

/* ======================================================================
   Kopf und Menü
   ====================================================================== */
const kopf = $('#kopf');
const KOPF_ABSTAND = 80;
function kopfPruefen() { kopf.classList.toggle('fest', window.scrollY > 24); }
addEventListener('scroll', kopfPruefen, { passive: true });
kopfPruefen();

const menueKnopf = $('#menue-knopf'), blatt = $('#menue'), schleier = $('#schleier');
let menueOffen = false;
/* Solange das Blatt offen ist, bleibt der Rest der Seite für Tastatur und Vorleser zu */
function hinterMenue(zu) { ['main', '.fuss'].forEach(sel => { const el = $(sel); if (el) el.inert = zu; }); }
function menueAuf() {
  if (menueOffen) return;
  menueOffen = true;
  blatt.hidden = false; schleier.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => { blatt.classList.add('offen'); schleier.classList.add('offen'); }));
  menueKnopf.setAttribute('aria-expanded', 'true');
  menueKnopf.textContent = 'Schliessen';
  hinterMenue(true);
  if (lenis) lenis.stop();
  const erster = $('a', blatt); if (erster) erster.focus({ preventScroll: true });
}
function menueZu(fokusZurueck) {
  if (!menueOffen) return;
  menueOffen = false;
  blatt.classList.remove('offen'); schleier.classList.remove('offen');
  menueKnopf.setAttribute('aria-expanded', 'false');
  menueKnopf.textContent = 'Menü';
  hinterMenue(false);
  if (lenis) lenis.start();
  const weg = () => { if (!menueOffen) { blatt.hidden = true; schleier.hidden = true; } };
  blatt.addEventListener('transitionend', weg, { once: true });
  setTimeout(weg, 420);
  if (fokusZurueck) menueKnopf.focus();
}
menueKnopf.addEventListener('click', () => (menueOffen ? menueZu(true) : menueAuf()));
schleier.addEventListener('click', () => menueZu(true));
addEventListener('keydown', e => { if (e.key === 'Escape' && menueOffen) menueZu(true); });
function aufMedium(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }
aufMedium(matchMedia('(min-width: 820px)'), e => { if (e.matches) menueZu(false); });

/* Helfer als Markenzeichen neben dem Logo (Prompt 4; Ale 10.10.: "diese Männchen auch als Branding nutzen").
   Hover (nur feiner Zeiger): der rechte Arm winkt zweimal, 0, 18, 0, 18, 0 Grad in 700 ms power1.inOut.
   Klick oder Tipp: Hüpfer 6 px mit Feder (Dämpfung 0.6, Antwort 0.35 s), dann folgt der Link.
   Ruhig-Modus: kein Winken, kein Hüpfer, der Link folgt sofort. */
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
/* Unterdämpfte Feder, exakt gelöst: Start in Ruhe mit Schwung nach oben, so bemessen, dass der Scheitel genau
   `hoehe` px erreicht; danach schwingt sie mit Dämpfung 0.6 aus. */
function huepfer(el, hoehe, daempfung, antwort) {
  const w0 = (2 * Math.PI) / antwort, wd = w0 * Math.sqrt(1 - daempfung * daempfung), ab = daempfung * w0;
  const tScheitel = Math.atan2(wd, ab) / wd;
  const amp = hoehe / (Math.exp(-ab * tScheitel) * Math.sin(wd * tScheitel));
  const start = jetztMs();
  const schritt = jetzt => {
    const t = Math.max(0, (jetzt - start) / 1000);
    if (t >= 0.6) { el.style.transform = ''; return; }
    const y = -amp * Math.exp(-ab * t) * Math.sin(wd * t);
    el.style.transform = `translateY(${y.toFixed(2)}px)`;
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}
if (marke && markeHelfer) {
  marke.addEventListener('click', e => {
    if (RUHIG || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const jetzt = jetztMs();
    if (jetzt < huepftBis) return;   // ein zweiter Klick während des Hüpfers startet nichts Neues
    huepftBis = jetzt + 350;
    huepfer(markeHelfer, 6, 0.6, 0.35);
    setTimeout(() => { location.href = marke.href; }, 350);   // nach dem Scheitel und dem Zurückfedern
  });
}

/* ======================================================================
   Sprünge zu Ankern, mit Vorbefüllen des Formulars
   ====================================================================== */
let autoFirma = '', betriebName = '';
function betriebVorbefuellen(name) {
  const f = $('#f-firma');
  if (!f) return;
  if (!f.value || f.value === autoFirma) { f.value = name; autoFirma = name; }
}
function paketVorbefuellen(paket) {
  const a = $('#f-anliegen');
  if (a && !a.value.trim()) a.value = `Paket: ${paket}`;
}
/* Ziele mit scroll-margin-top (Stationsblöcke am Handy liegen unter der klebenden Bühne): genau so weit unter den
   oberen Rand, als Zahl gerechnet (Lenis zöge bei einem Element als Ziel scroll-margin und das scroll-padding der
   Seite noch einmal ab). Alle anderen Ziele wie bisher. */
function springeZu(ziel) {
  const rand = parseFloat(getComputedStyle(ziel).scrollMarginTop) || 0;
  if (rand > 0) {
    const y = Math.max(0, ziel.getBoundingClientRect().top + window.scrollY - rand);
    if (lenis) lenis.scrollTo(y); else window.scrollTo({ top: y, behavior: 'auto' });
  } else if (lenis) lenis.scrollTo(ziel, { offset: -KOPF_ABSTAND });
  else ziel.scrollIntoView({ block: 'start' });
  if (!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex', '-1');
  ziel.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
  if (!a || a.classList.contains('sprung')) return;
  const id = decodeURIComponent(a.getAttribute('href').slice(1));
  const ziel = id && document.getElementById(id);
  if (!ziel) return;
  if (a.dataset.paket) paketVorbefuellen(a.dataset.paket);
  if (a.hasAttribute('data-mit-namen')) betriebVorbefuellen(betriebName);
  menueZu(false);
  e.preventDefault();
  springeZu(ziel);
  if (history.pushState) history.pushState(null, '', `#${id}`);
});

/* ======================================================================
   Namensfeld "Wie heisst Ihr Betrieb?" (v4-05-foerderband.md, Abschnitt 9.3)
   Der Name erscheint auf dem Bildschirm "Ihr Betrieb" an Station 6 im Förderband (ablauf-band.js). Hier wird nur
   gelesen, gehalten und gemeldet: höchstens 40 Zeichen, nur als Text (das Band zeichnet ihn auf eine Canvas-Textur,
   nie als HTML), sessionStorage hebel-betrieb, füllt später das Formularfeld "Betrieb" vor. Gemeldet wird mit dem
   Ereignis hebel-betrieb { name, zeigen } und in window.hebelBetrieb (für ein Band, das erst später startet).
   ====================================================================== */
const feld = $('#betrieb-name');
function nameLesen() { return feld ? feld.value.replace(/\s+/g, ' ').trim().slice(0, 40) : ''; }
function nameMelden(zeigen) {
  window.hebelBetrieb = betriebName;
  document.dispatchEvent(new CustomEvent('hebel-betrieb', { detail: { name: betriebName, zeigen: !!zeigen } }));
}
/* zeigen = Enter oder "Zeigen": die Kamera fährt auch mit leerem Feld zu Station 6 */
function nameAnwenden(zeigen) {
  const n = nameLesen();
  betriebName = n;
  try { if (n) sessionStorage.setItem('hebel-betrieb', n); else sessionStorage.removeItem('hebel-betrieb'); } catch (e) { /* ohne Speicher geht es auch */ }
  betriebVorbefuellen(n);
  nameMelden(zeigen);
}
if (feld) {
  let entprellt = 0, letzterLauf = -1e9;
  feld.addEventListener('input', () => {
    // Entprellung 120 ms: das erste Zeichen wirkt sofort, schnelles Weitertippen wird gebündelt
    clearTimeout(entprellt);
    const jetzt = jetztMs();
    if (jetzt - letzterLauf > 120) { letzterLauf = jetzt; nameAnwenden(false); }
    else entprellt = setTimeout(() => { letzterLauf = jetztMs(); nameAnwenden(false); }, 120);
  });
  const nameForm = $('#name-form');
  if (nameForm) nameForm.addEventListener('submit', e => {
    e.preventDefault();
    clearTimeout(entprellt);
    nameAnwenden(true);
  });
  try {
    const gespeichert = sessionStorage.getItem('hebel-betrieb');
    if (gespeichert) { feld.value = gespeichert.slice(0, 40); nameAnwenden(false); }
  } catch (e) { /* kein sessionStorage */ }
}

/* Schriften: Kacheln neu zeichnen, sobald Archivo und Mono geladen sind */
schriftenLaden().then(() => { kachelnNeu(); });

/* ======================================================================
   Arbeiten: gezeichnete Vorschau, t läuft einmal beim Hereinscrollen
   ====================================================================== */
const kacheln = $$('[data-kachel]').map(el => {
  const cv = $('canvas', el), ctx = cv.getContext('2d');
  const k = { el, cv, ctx, art: el.dataset.kachel, start: -1, t: 0, hub: { x: 0, v: 0 }, pfeil: { x: 0, v: 0 }, hubZiel: 0, laeuft: false };
  k.zeichnen = () => { ctx.clearRect(0, 0, cv.width, cv.height); zeichneVorschau(ctx, k.art, k.t, ''); };
  return k;
});
function kachelnNeu() { kacheln.forEach(k => { if (RUHIG && k.start >= 0) k.t = 1; k.zeichnen(); }); }
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
} else kacheln.forEach(k => { k.start = 0; k.t = 1; k.zeichnen(); });

/* Hover (fein): Kachel hebt sich 4 px, Pfeil rückt 4 px (Feder, Dämpfung 1.0, Antwort 0.35) */
if (FEIN) {
  kacheln.forEach(k => {
    let letzteZeit = 0;
    const schritt = jetzt => {
      const dt = Math.min(0.05, (jetzt - letzteZeit) / 1000); letzteZeit = jetzt;
      feder(k.hub, k.hubZiel, 0.35, dt); feder(k.pfeil, -k.hubZiel, 0.35, dt);
      k.el.style.setProperty('--hub', `${k.hub.x.toFixed(2)}px`);
      k.el.style.setProperty('--pfeil', `${k.pfeil.x.toFixed(2)}px`);
      if (!ruht(k.hub, k.hubZiel, 0.01)) requestAnimationFrame(schritt);
      else { k.laeuft = false; k.el.style.setProperty('--hub', `${k.hubZiel}px`); k.el.style.setProperty('--pfeil', `${-k.hubZiel}px`); }
    };
    const los = ziel => { k.hubZiel = ziel; if (!k.laeuft) { k.laeuft = true; letzteZeit = jetztMs(); requestAnimationFrame(schritt); } };
    k.el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') los(-4); });
    k.el.addEventListener('pointerleave', () => los(0));
  });
}

/* ======================================================================
   Fakten und Preise: einmal beim Hereinscrollen
   ====================================================================== */
function einmalZeigen(sel, schwelle) {
  const els = $$(sel);
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('gezeigt')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('gezeigt'); io.unobserve(e.target); } }), { threshold: schwelle });
  els.forEach(el => io.observe(el));
}
// Einblendungen erst hier verstecken, direkt vor den Beobachtern: bricht das Modul vorher ab, bleibt alles sichtbar
html.classList.add('bewegt');
einmalZeigen('.fakten-panel', 0.25);
einmalZeigen('.preise-panel', 0.2);

/* Kleiner Helfer am Preis-Panel: schaut nach links, dreht sich zur Spalte unter dem Zeiger */
const preisHelfer = $('.preis-helfer');
if (preisHelfer && FEIN) {
  const grund = () => { preisHelfer.style.setProperty('--blick', '-1'); preisHelfer.style.setProperty('--neigung', '0deg'); };
  $$('.paket').forEach(sp => {
    sp.addEventListener('pointerenter', e => {
      if (RUHIG || e.pointerType !== 'mouse') return;
      const h = preisHelfer.getBoundingClientRect(), r = sp.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - (h.left + h.width / 2);
      preisHelfer.style.setProperty('--blick', dx < 0 ? '-1' : '1');
      // je näher die Spalte, desto steiler der Blick nach unten
      const n = clamp(1 - Math.abs(dx) / Math.max(1, r.width * 2.5), 0, 1);
      preisHelfer.style.setProperty('--neigung', `${(4 + n * 10).toFixed(1)}deg`);
    });
  });
  $('.preise-panel').addEventListener('pointerleave', grund);
}

/* ======================================================================
   Formular (aus v3, Logik unverändert; nur der vermessen()-Aufruf ist weg)
   ====================================================================== */
function formular() {
  const f = $('[data-formular]');
  if (!f) return;
  const felder = ['name', 'email', 'firma', 'anliegen'].map(n => f.elements[n]);
  const tel = f.elements.telefon;
  const sammel = $('#formular-sammel');
  const status = $('[data-formular-status]');
  const senden = $('[data-senden]');
  const fehlerMeldung = $('[data-meldung="fehler"]');
  const erfolg = $('[data-meldung="erfolg"]');
  let versucht = false;
  let sendet = false;
  // Ohne JavaScript bleibt der Knopf gesperrt, sonst gingen die Eingaben als Adresszeile an den Server
  senden.disabled = false;

  const hilfeId = feld => { const h = $(`#${feld.id}-hilfe`); return h ? h.id : ''; };
  const setzen = (feld, text) => {
    const fe = $(`#${feld.id}-fehler`);
    fe.textContent = text;
    fe.hidden = !text;
    if (text) feld.setAttribute('aria-invalid', 'true'); else feld.removeAttribute('aria-invalid');
    const ids = [hilfeId(feld), text ? fe.id : ''].filter(Boolean).join(' ');
    if (ids) feld.setAttribute('aria-describedby', ids); else feld.removeAttribute('aria-describedby');
  };
  const pruefe = feld => {
    const v = feld.value.trim();
    const fe = $(`#${feld.id}-fehler`);
    let text = '';
    if (!v) text = fe.dataset.leer;
    else if (feld.type === 'email' && !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(v)) text = fe.dataset.ungueltig;
    setzen(feld, text);
    return !text;
  };
  const sammelPruefen = () => {
    if (!versucht) return;
    sammel.hidden = felder.every(x => x.getAttribute('aria-invalid') !== 'true');
  };
  felder.forEach(feld => {
    feld.addEventListener('blur', () => { if (versucht || feld.value.trim()) { pruefe(feld); sammelPruefen(); } });
    feld.addEventListener('input', () => { if (feld.getAttribute('aria-invalid') === 'true') { pruefe(feld); sammelPruefen(); } });
  });

  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (sendet) return;
    versucht = true;
    const ok = felder.map(pruefe);
    const erstesFalsch = ok.indexOf(false);
    if (erstesFalsch >= 0) {
      sammel.hidden = false;
      felder[erstesFalsch].focus();
      return;
    }
    sammel.hidden = true;
    fehlerMeldung.hidden = true;
    const daten = {
      firma: f.elements.firma.value.trim(),
      name: f.elements.name.value.trim(),
      email: f.elements.email.value.trim(),
      telefon: tel.value.trim(),
      region: 'CH',
      paket: 'webstudio',
      anliegen: f.elements.anliegen.value.trim(),
    };
    sendet = true;
    senden.disabled = true;
    senden.textContent = 'Wird gesendet';
    f.setAttribute('aria-busy', 'true');
    status.textContent = 'Wird gesendet';
    let angekommen = false;
    try {
      const abbruch = new AbortController();
      const frist = setTimeout(() => abbruch.abort(), 15000);
      const r = await fetch(`${KONFIG.supabaseUrl}/rest/v1/anfragen`, {
        method: 'POST',
        headers: {
          apikey: KONFIG.supabaseKey,
          Authorization: `Bearer ${KONFIG.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(daten),
        signal: abbruch.signal,
      });
      clearTimeout(frist);
      angekommen = r.ok;
    } catch (err) {
      angekommen = false;
    }
    sendet = false;
    f.removeAttribute('aria-busy');
    status.textContent = '';
    senden.disabled = false;
    senden.textContent = 'Anfrage senden';
    if (angekommen) {
      // Weiterleitung an die Auswertung, ohne Rückmeldung an die Seite (Brief 08, Abschnitt 6)
      fetch('/api/n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
        keepalive: true,
      }).catch(() => {});
      f.hidden = true;
      erfolg.hidden = false;
      erfolg.focus();
    } else {
      fehlerMeldung.hidden = false;
      fehlerMeldung.focus();
    }
  });
}
formular();
if (betriebName) betriebVorbefuellen(betriebName);

/* ======================================================================
   Schalter "Bewegung: an / ruhig" (der Kopf setzt Klasse und Speicher und meldet hier)
   ====================================================================== */
document.addEventListener('hebel-ruhig', e => {
  RUHIG = !!e.detail;
  if (RUHIG && markeWinkt) markeWinkt.cancel();
  if (RUHIG) { lenisStopp(); preisHelfer && preisHelfer.style.setProperty('--blick', '-1'); preisHelfer && preisHelfer.style.setProperty('--neigung', '0deg'); }
  else lenisStart();
  kachelnNeu();
});
