/* Hebel v4, Startseite: ruhiger Einstieg mit den Helfern.
   Auftrag: docs/webstudio-2026-10/master-prompts/v4-01-hebel.md (dazu v4-00-gemeinsam.md).
   Teile aus werkstatt.js (v3) sind kopiert, nicht importiert: rgeo und Materialcache, Helfer
   (glied, makeBot, setArm, updateBot), blockweiser Aufbau, Raycast, Sprechblase, Schatten,
   Schriften nachzeichnen, Formular. Die Kamera ist fest; nichts fliegt, nichts hält den Scroll.
   Referenzen (Technik, eigener Code): Mailerbot (Szene an einer Zahl t, Überblendung 200 ms
   power4.out), Butter (Stoss mit quadratischer Abnahme, Feder mit Dämpfung 1.0). */

import { zeichneVorschau, schriftenLaden, VORSCHAUEN } from './vorschau-zeichnen.js';

/* three kommt erst beim Bau der Szene (dynamischer Import). Fehlt es oder die Importmap (ältere
   Browser), greift der Rückfall, und Menü, Formular und Anker funktionieren trotzdem. */
let THREE = null;

/* ---------- Grundlagen ---------- */
const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
/* Ruhig nur, wenn der Besucher es selbst gewählt hat (Klasse ruhig aus localStorage hebel-ruhig).
   Die Systemeinstellung "reduzierte Bewegung" wird bewusst nicht ausgewertet. */
let RUHIG = html.classList.contains('ruhig');
const FEIN = window.matchMedia('(pointer: fine)').matches;
/* Ab 1024 px steht die Szene rechts vom Text, darunter unter ihm (wie im CSS); danach richtet sich "Links" / "Oben" */
const BREIT = window.matchMedia('(min-width: 1024px)');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
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
const winkel = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/* ======================================================================
   Lenis (wie Mailerbot), im Ruhig-Modus aus
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
}
function lenisStopp() { if (lenis) { lenis.destroy(); lenis = null; } }
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
let autoFirma = '';
function betriebVorbefuellen(name) {
  const f = $('#f-firma');
  if (!f) return;
  if (!f.value || f.value === autoFirma) { f.value = name; autoFirma = name; }
}
function paketVorbefuellen(paket) {
  const a = $('#f-anliegen');
  if (a && !a.value.trim()) a.value = `Paket: ${paket}`;
}
function springeZu(ziel) {
  if (lenis) lenis.scrollTo(ziel, { offset: -KOPF_ABSTAND });
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
  if (a.hasAttribute('data-mit-namen')) betriebVorbefuellen(V.name);
  menueZu(false);
  e.preventDefault();
  springeZu(ziel);
  if (history.pushState) history.pushState(null, '', `#${id}`);
});

/* ======================================================================
   Vorschau: Zustand, Kompositor (Überblendung und blockweiser Aufbau)
   ====================================================================== */
const ARTEN = ['restaurant', 'architekt', 'betrieb'];
const V = { art: 'restaurant', name: '', autoPause: 0, letzterWechsel: jetztMs(), hoverPause: false };
const GEHAEUSE = '#F4F0E8';
const power4aus = p => 1 - Math.pow(1 - p, 5);   // GSAP power4.out
const quartAus = p => 1 - Math.pow(1 - p, 4);

function kompositorBauen() {
  const neueCanvas = () => { const c = document.createElement('canvas'); c.width = 1600; c.height = 960; return c; };
  const cv = neueCanvas(), ctx = cv.getContext('2d');
  const alt = neueCanvas(), altCtx = alt.getContext('2d');
  const seiten = {};
  ARTEN.forEach(art => { const c = neueCanvas(); seiten[art] = { cv: c, ctx: c.getContext('2d'), start: jetztMs(), tGez: -1, nameGez: null, fassung: -1 }; });
  const k = {
    cv, aktuell: V.art, wechselStart: -1, schnell: false, name: '', fassung: 0, letzteAusgabe: -1e9,
    lift: 40, schmutzig: true, bereit: false, leer: false,
    tVon(art, jetzt) { return RUHIG ? 1 : clamp((jetzt - seiten[art].start) / 3000, 0, 1); },
    wechsel(art, opt = {}) {
      // vom sichtbaren Stand aus weiter (unterbrechbar): Momentaufnahme des Bildschirms
      altCtx.drawImage(cv, 0, 0);
      k.aktuell = art; k.wechselStart = jetztMs(); k.schnell = !!opt.schnell;
      seiten[art].start = k.wechselStart + (RUHIG || k.schnell ? 0 : 200);
      seiten[art].tGez = -1;
    },
    nameSetzen(n) { if (n !== k.name) { k.name = n; seiten.betrieb.nameGez = null; } },
    /* Schrift geladen (oder Frist um): erst jetzt wird gezeichnet, und t beginnt jetzt */
    freigeben() { if (k.bereit) return; k.bereit = true; seiten[k.aktuell].start = Math.max(seiten[k.aktuell].start, jetztMs()); k.schmutzig = true; },
    neuZeichnen() { k.fassung++; k.schmutzig = true; },
    /* ein Schritt; liefert, ob sich das Bild geändert hat und ob noch etwas läuft */
    schritt(jetzt) {
      if (!k.bereit) {
        // bis die Schrift da ist: leerer Bildschirm in der Farbe des Gehäuses, keine Ersatzschrift
        if (k.leer) return { geaendert: false, laeuft: true };
        k.leer = true; ctx.fillStyle = GEHAEUSE; ctx.fillRect(0, 0, 1600, 960);
        return { geaendert: true, laeuft: true };
      }
      const s = seiten[k.aktuell];
      const t = clamp(k.tVon(k.aktuell, jetzt), 0, 1);
      const imWechsel = k.wechselStart >= 0;
      const seiteAlt = s.tGez !== t || s.fassung !== k.fassung || (k.aktuell === 'betrieb' && s.nameGez !== k.name);
      const laeuft = imWechsel || t < 1 || seiteAlt || k.schmutzig;
      if (!laeuft) return { geaendert: false, laeuft: false };
      if (jetzt - k.letzteAusgabe < 33) return { geaendert: false, laeuft: true };   // höchstens 30 Mal pro Sekunde
      k.letzteAusgabe = jetzt;
      if (seiteAlt) {
        s.ctx.clearRect(0, 0, 1600, 960);
        zeichneVorschau(s.ctx, k.aktuell, t, k.name);
        s.tGez = t; s.fassung = k.fassung; s.nameGez = k.name;
      }
      k.schmutzig = false;
      if (!imWechsel) { ctx.globalAlpha = 1; ctx.drawImage(s.cv, 0, 0); return { geaendert: true, laeuft: t < 1 }; }
      const e = jetzt - k.wechselStart;
      let fertig;
      ctx.globalAlpha = 1;
      if (RUHIG) {
        // Ruhig: einfache Überblendung 200 ms
        const a = clamp(e / 200, 0, 1);
        ctx.drawImage(alt, 0, 0); ctx.globalAlpha = a; ctx.drawImage(s.cv, 0, 0);
        fertig = a >= 1;
      } else {
        // Alte Textur 200 ms power4.out auf 0.6, dann sechs Blöcke von oben, je 90 ms versetzt, je 260 ms
        ctx.fillStyle = GEHAEUSE; ctx.fillRect(0, 0, 1600, 960);
        ctx.globalAlpha = 1 - 0.4 * power4aus(clamp(e / 200, 0, 1));
        ctx.drawImage(alt, 0, 0);
        const b0 = k.schnell ? 0 : 200, hoehe = 960 / 6;
        for (let i = 0; i < 6; i++) {
          const p = clamp((e - b0 - i * 90) / 260, 0, 1);
          if (p <= 0) continue;
          const q = quartAus(p), y0 = i * hoehe, versatz = (1 - q) * k.lift;
          ctx.globalAlpha = q;
          ctx.drawImage(s.cv, 0, y0, 1600, hoehe, 0, y0 + versatz, 1600, hoehe);
        }
        fertig = e >= b0 + 5 * 90 + 260;
      }
      ctx.globalAlpha = 1;
      if (fertig) { k.wechselStart = -1; ctx.drawImage(s.cv, 0, 0); }
      return { geaendert: true, laeuft: true };
    },
  };
  return k;
}
const kompositor = kompositorBauen();

/* ---------- Reiter, Zeile, Eingabe ---------- */
const reiterKnoepfe = $$('[data-vorschau]');
const zeile = $('#vorschau-zeile'), zeileName = $('#vorschau-name'), zeileLink = $('#vorschau-link'), zeileLinkText = $('#vorschau-link-text');
const feld = $('#betrieb-name');
let szene = null;   // Schnittstelle der 3D-Szene, sobald gebaut
let rueckfallWecken = null;

function wecken() { if (szene) szene.wecken(); else if (rueckfallWecken) rueckfallWecken(); }

function zeileAktualisieren(auto) {
  const d = VORSCHAUEN[V.art];
  // Automatische Wechsel nicht vorlesen (alle 8 s wäre störend), Wechsel durch den Besucher schon
  zeile.setAttribute('aria-live', auto ? 'off' : 'polite');
  const text = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  if (V.art === 'betrieb') {
    text(zeileName, V.name || d.name);
    text(zeileLinkText, 'Anfrage mit diesem Namen');
    zeileLink.setAttribute('href', '#kontakt');
    zeileLink.setAttribute('data-mit-namen', '');
  } else {
    text(zeileName, d.name);
    text(zeileLinkText, 'Beispiel öffnen');
    zeileLink.setAttribute('href', d.pfad);
    zeileLink.removeAttribute('data-mit-namen');
  }
  if (auto) setTimeout(() => zeile.setAttribute('aria-live', 'polite'), 50);
}
function reiterAktualisieren() {
  reiterKnoepfe.forEach(b => b.setAttribute('aria-pressed', b.dataset.vorschau === V.art ? 'true' : 'false'));
}
function vorschauSetzen(art, opt = {}) {
  if (art === V.art && !opt.erzwingen) { zeileAktualisieren(false); return; }
  V.art = art; V.letzterWechsel = jetztMs();
  kompositor.wechsel(art, { schnell: !!opt.schnell });
  reiterAktualisieren(); zeileAktualisieren(!!opt.auto);
  if (szene) szene.jubel();
  wecken();
}
function oeffnen() {
  if (V.art === 'betrieb') { betriebVorbefuellen(V.name); const k = $('#kontakt'); if (k) springeZu(k); return; }
  location.href = VORSCHAUEN[V.art].pfad;
}

reiterKnoepfe.forEach(b => b.addEventListener('click', () => {
  vorschauSetzen(b.dataset.vorschau);
  V.autoPause = jetztMs() + 20000;   // Klick hält den Wechsel 20 s an
}));

/* Automatischer Wechsel alle 8 s, solange das Feld leer ist und niemand mit der Szene arbeitet */
setInterval(() => {
  const jetzt = jetztMs();
  if (RUHIG || V.name || V.hoverPause || document.hidden || jetzt < V.autoPause) { if (V.hoverPause || jetzt < V.autoPause) V.letzterWechsel = Math.max(V.letzterWechsel, jetzt - 6000); return; }
  if (szene && !szene.sichtbar()) return;
  if (jetzt - V.letzterWechsel < 8000) return;
  vorschauSetzen(V.art === 'restaurant' ? 'architekt' : 'restaurant', { auto: true });
}, 200);
const szeneSpalte = $('.einstieg-szene');
/* Fokus hält den Wechsel nur an, wenn er sichtbar ist (Tastatur). Ein Reiter behält nach einem Mausklick
   den Fokus; der soll nicht über die 20 s hinaus anhalten. */
const fokusSichtbar = el => { if (!el || !el.matches) return false; try { return el.matches(':focus-visible'); } catch (e) { return true; } };
szeneSpalte.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') V.hoverPause = true; });
szeneSpalte.addEventListener('pointerleave', () => { const a = document.activeElement; V.hoverPause = szeneSpalte.contains(a) && fokusSichtbar(a); });
szeneSpalte.addEventListener('focusin', e => { if (fokusSichtbar(e.target)) V.hoverPause = true; });
szeneSpalte.addEventListener('focusout', e => { if (!szeneSpalte.contains(e.relatedTarget)) V.hoverPause = false; });

/* Eingabe "Wie heisst Ihr Betrieb?": Name höchstens 40 Zeichen, nur als Text */
function nameLesen() { return feld.value.replace(/\s+/g, ' ').trim().slice(0, 40); }
/* leise = beim Tippen: die Zeile unter den Reitern ändert sich, wird aber nicht bei jedem Zeichen vorgelesen;
   Enter, "Zeigen" und Reiter werden angesagt. */
function nameAnwenden(leise = false) {
  const n = nameLesen();
  V.name = n;
  try { if (n) sessionStorage.setItem('hebel-betrieb', n); else sessionStorage.removeItem('hebel-betrieb'); } catch (e) { /* ohne Speicher geht es auch */ }
  kompositor.nameSetzen(n);
  betriebVorbefuellen(n);
  if (n) { if (V.art !== 'betrieb') vorschauSetzen('betrieb', { schnell: true, auto: leise }); else zeileAktualisieren(leise); }
  else if (V.art === 'betrieb') { vorschauSetzen('restaurant', { auto: leise }); V.letzterWechsel = jetztMs(); }
  wecken();
}
let entprellt = 0, letzterLauf = -1e9;
feld.addEventListener('input', () => {
  // Entprellung 120 ms: das erste Zeichen wirkt sofort, schnelles Weitertippen wird gebündelt
  clearTimeout(entprellt);
  const jetzt = jetztMs();
  if (jetzt - letzterLauf > 120) { letzterLauf = jetzt; nameAnwenden(true); }
  else entprellt = setTimeout(() => { letzterLauf = jetztMs(); nameAnwenden(true); }, 120);
});
$('#name-form').addEventListener('submit', e => {
  e.preventDefault();
  clearTimeout(entprellt);
  nameAnwenden(false);
  if (!V.name) { vorschauSetzen('betrieb', { schnell: true }); V.autoPause = jetztMs() + 20000; }
});
try {
  const gespeichert = sessionStorage.getItem('hebel-betrieb');
  if (gespeichert) { feld.value = gespeichert.slice(0, 40); nameAnwenden(true); }
} catch (e) { /* kein sessionStorage */ }
reiterAktualisieren(); zeileAktualisieren(false);

/* ======================================================================
   Die Szene: feste Kamera, drei Helfer an einem grossen Bildschirm
   ====================================================================== */
function szeneBauen(rahmen, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('kein WebGL 2');
  const HANDY = !FEIN || window.innerWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HANDY ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const ZIEL = new THREE.Vector3(0, 1.4, 0);
  const DIR = new THREE.Vector3(-1, 1.08, 0.82).normalize();
  const RECHTS = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), DIR).normalize();
  const cam = new THREE.OrthographicCamera(-5, 5, 4, -4, 1, 200);
  cam.position.copy(ZIEL).addScaledVector(DIR, 60);
  cam.lookAt(ZIEL);
  cam.updateMatrixWorld();

  /* Szenen-Koordinaten (quer, tief) -> Welt: quer nach rechts im Bild, tief zur Kamera hin */
  const H_KAM = new THREE.Vector2(DIR.x, DIR.z).normalize();
  const H_RECHTS = new THREE.Vector2(RECHTS.x, RECHTS.z).normalize();
  const kp = (quer, tief) => ({ x: quer * H_RECHTS.x + tief * H_KAM.x, z: quer * H_RECHTS.y + tief * H_KAM.y });
  const CAMF = Math.atan2(DIR.x, DIR.z);   // Blickrichtung "zur Kamera" als Drehung um y
  const Y_ACHSE = new THREE.Vector3(0, 1, 0);
  const faceTo = (dx, dz) => Math.atan2(dx, dz);

  /* Licht wie v3 (Hemisphere 1.9, Sonne 2.0), Sonne und Schattenbox einmal gesetzt */
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xE9E2D6, 1.9));
  const sonne = new THREE.DirectionalLight(0xFFFAF2, 2.0);
  sonne.position.copy(ZIEL).add(new THREE.Vector3(-2, 10, 4.5).normalize().multiplyScalar(30));
  sonne.target.position.copy(ZIEL);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(HANDY ? 1024 : 2048, HANDY ? 1024 : 2048);
  sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03; sonne.shadow.radius = 3;
  const sc = sonne.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 5; sc.far = 60; sc.updateProjectionMatrix();
  scene.add(sonne); scene.add(sonne.target);

  /* Parallaxe: das ganze Szenen-Objekt dreht sich um höchstens 2.5° um das Ziel */
  const dreh = new THREE.Group(); dreh.position.copy(ZIEL); scene.add(dreh);
  const welt = new THREE.Group(); welt.position.copy(ZIEL).multiplyScalar(-1); dreh.add(welt);

  /* Boden: nur Schatten, sonst unsichtbar */
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
  boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; boden.userData.istBoden = true; welt.add(boden);

  /* ---------- Geometrie-Helfer (aus v3) ---------- */
  const matCache = new Map();
  function mat(c, rough) {
    const k = `${c}|${rough || 0}`;
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough || 0.62, metalness: 0 }));
    return matCache.get(k);
  }
  const geoCache = new Map();
  const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
  function achse(c, half, r, seg) { const n = 2 * seg + 1, k = c * n, a = Math.abs(k); if (a <= 0.5) return k * 2 * (half - r); return Math.sign(k) * ((half - r) + (a - 0.5) / seg * r); }
  /* abgerundete Box: unterteilte Box, Aussenbänder auf Viertelkreise gebogen, steht auf y=0 */
  function rgeo(w, h, d, r, seg) {
    seg = seg || 2; r = Math.max(0.002, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
    return cached(`r${w}|${h}|${d}|${r.toFixed(4)}|${seg}`, () => {
      const n = 2 * seg + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, hs = [w / 2, h / 2, d / 2];
      const p = [0, 0, 0], inn = [0, 0, 0], off = [0, 0, 0];
      for (let i = 0; i < P.count; i++) {
        const o = [P.getX(i), P.getY(i), P.getZ(i)];
        for (let a = 0; a < 3; a++) p[a] = achse(o[a], hs[a], r, seg);
        const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i));
        const ua = nx > 0.5 ? 2 : 0, va = ny > 0.5 ? 2 : 1;
        U.setXY(i, achse(U.getX(i) - 0.5, hs[ua], r, seg) / (2 * hs[ua]) + 0.5, achse(U.getY(i) - 0.5, hs[va], r, seg) / (2 * hs[va]) + 0.5);
        let len = 0;
        for (let a = 0; a < 3; a++) { inn[a] = clamp(p[a], -(hs[a] - r), hs[a] - r); off[a] = p[a] - inn[a]; len += off[a] * off[a]; }
        len = Math.sqrt(len);
        if (len > 1e-6) { for (let a = 0; a < 3; a++) p[a] = inn[a] + off[a] / len * r; N.setXYZ(i, off[0] / len, off[1] / len, off[2] / len); }
        P.setXYZ(i, p[0], p[1], p[2]);
      }
      g.translate(0, h / 2, 0); return g;
    });
  }
  function pgeo(w, h, d) { return cached(`p${w}|${h}|${d}`, () => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }); }
  function rcgeo(r, h, f, s) {
    f = Math.min(f, r * 0.5, h * 0.5);
    return cached(`c${r}|${h}|${f}|${s}`, () => {
      const V2 = THREE.Vector2, pts = [new V2(0, 0), new V2(r - f, 0)];
      for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new V2(r - f + Math.cos(a) * f, f + Math.sin(a) * f)); }
      for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new V2(r - f + Math.cos(a) * f, h - f + Math.sin(a) * f)); }
      pts.push(new V2(0, h)); return new THREE.LatheGeometry(pts, s || 36);
    });
  }
  /* Kapsel, hängt am oberen Gelenk (y=0) und reicht bis y=-len */
  function capgeo(r, len) {
    return cached(`k${r}|${len}`, () => {
      const V2 = THREE.Vector2, pts = [];
      for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(new V2(Math.max(0, Math.cos(a) * r), -len + Math.sin(a) * r)); }
      for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new V2(Math.max(0, Math.cos(a) * r), Math.sin(a) * r)); }
      return new THREE.LatheGeometry(pts, 14);
    });
  }
  const sgeo = r => cached(`s${r}`, () => new THREE.SphereGeometry(r, 24, 16));
  function dreieckGeo(kante, tiefe) {
    return cached(`d${kante}|${tiefe}`, () => {
      const h = kante * Math.sqrt(3) / 2, s = new THREE.Shape();
      s.moveTo(-kante / 2, 0); s.lineTo(kante / 2, 0); s.lineTo(0, h); s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: tiefe, bevelEnabled: false });
    });
  }
  const M = c => (typeof c === 'number' ? mat(c) : c);
  function mk(g, m, x, y, z, parent) { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); parent.add(o); return o; }
  function box(w, h, d, c, x, y, z, parent, r) { return mk(rgeo(w, h, d, r === undefined ? Math.min(0.2, Math.min(w, h, d) * 0.3) : r), M(c), x, y, z, parent); }
  function cyl(r, h, c, x, y, z, parent, f) { return mk(rcgeo(r, h, f === undefined ? Math.min(0.08, r * 0.3, h * 0.3) : f), M(c), x, y, z, parent); }
  function sph(r, c, x, y, z, parent) { return mk(sgeo(r), M(c), x, y, z, parent); }
  function grp(x, y, z, parent) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; }
  const trefferMat = new THREE.MeshBasicMaterial({ visible: false });
  const ziele = [];   // unsichtbare Treffer-Boxen für Hover und Klick

  const C = { kobalt: 0x2340FF, emblem: 0xF3F5FF, gehaeuse: 0xF4F0E8, sockel: 0xDDD4C6, tinte: 0x15140F,
    tinte2: 0x2E2B25, butter: 0xF2C14E, gedaempft: 0x6E675C };

  /* ---------- Bildschirm mit der Vorschau ---------- */
  const SCHIRM_DREH = CAMF + THREE.MathUtils.degToRad(18);   // 18° neben der Blickrichtung der Kamera
  const schirm = grp(0, 0, 0, welt); schirm.rotation.y = SCHIRM_DREH;
  box(2.2, 0.5, 1.2, C.sockel, 0, 0, 0, schirm, 0.12);
  box(6.4, 4.0, 0.28, C.gehaeuse, 0, 0.5, 0, schirm, 0.22);
  const tex = new THREE.CanvasTexture(kompositor.cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  flaeche.position.set(0, 2.5, 0.142); flaeche.userData.ohneSchatten = true; schirm.add(flaeche);
  const schirmTreffer = mk(pgeo(6.4, 4.0, 0.5), trefferMat, 0, 0.5, 0, schirm);
  schirmTreffer.userData = { treffer: true, bildschirm: true }; ziele.push(schirmTreffer);
  // Breite des Bildschirms quer zur Kamera, daraus das Frustum (Bildschirm füllt 62 % der Breite)
  const SCHIRM_BREITE = (() => {
    schirm.updateMatrixWorld(true);
    let a = 1e9, b = -1e9; const p = new THREE.Vector3();
    for (const sx of [-3.2, 3.2]) for (const sz of [-0.14, 0.14]) {
      p.set(sx, 2.5, sz); schirm.localToWorld(p); const q = p.dot(RECHTS); a = Math.min(a, q); b = Math.max(b, q);
    }
    return b - a;
  })();

  /* ---------- Die Helfer (Bauplan aus v3) ---------- */
  const helfer = [];
  const helferMat = new THREE.MeshStandardMaterial({ color: C.kobalt, roughness: 0.45 });
  const emblemMat = new THREE.MeshStandardMaterial({ color: C.emblem, roughness: 0.55 });
  function glied(parent, x, y, z, r, l1, l2) {
    const a = grp(x, y, z, parent); mk(capgeo(r, l1), helferMat, 0, 0, 0, a);
    const b = grp(0, -l1, 0, a); mk(capgeo(r, l2), helferMat, 0, 0, 0, b);
    return { a, b };
  }
  function makeBot(o) {
    const S = o.scale || 0.92;
    const root = grp(o.x, o.y || 0, o.z, welt);
    const hop = grp(0, 0, 0, root), body = grp(0, 0, 0, hop);
    mk(rgeo(1.05, 1.05, 0.6, 0.24, 3), helferMat, 0, 0.55, 0, body);
    // Hebel-Zeichen vorne: Balken über dem Dreieck (Drehpunkt)
    const balkenM = mk(rgeo(0.62, 0.08, 0.03, 0.03), emblemMat, 0, 1.12, 0.31, body); balkenM.rotation.z = -0.24;
    mk(dreieckGeo(0.34, 0.03), emblemMat, 0, 0.86, 0.3, body);
    const armL = glied(body, -0.52, 1.0, 0, 0.055, 0.26, 0.24), armR = glied(body, 0.52, 1.0, 0, 0.055, 0.26, 0.24);
    sph(0.085, helferMat, 0, -0.27, 0, armL.b).scale.set(1, 1.1, 0.8); sph(0.085, helferMat, 0, -0.27, 0, armR.b).scale.set(1, 1.1, 0.8);
    const beine = [-0.2, 0.2].map(lx => { const L = glied(hop, lx, 0.62, 0, 0.065, 0.25, 0.25); const f = sph(0.12, helferMat, 0, -0.28, 0.05, L.b); f.scale.set(0.95, 0.55, 1.4); return L; });
    const hit = new THREE.Mesh(pgeo(1.5, 1.9, 1.1), trefferMat); root.add(hit);
    root.scale.setScalar(S); root.rotation.y = o.face;
    const b = { root, hop, body, armL, armR, beine, S, mode: o.mode || 'idle', grundMode: o.mode || 'idle', name: o.name, satz: o.satz,
      phase: Math.random() * 10, hopT: -1, cheer: 0, winken: 0, carry: false, sitzt: !!o.sitzt, hover: false, laeuft: false,
      px: o.x, pz: o.z, ox: { x: 0, v: 0 }, oz: { x: 0, v: 0 }, yaw: { x: o.face, v: 0 }, blick: o.face };
    if (o.carry !== undefined) { b.traglast = box(0.7, 0.07, 0.5, o.carry, 0, 1.62, 0, body, 0.03); b.traglast.visible = false; }
    hit.userData = { treffer: true, bot: b }; ziele.push(hit); helfer.push(b);
    return b;
  }
  function setArm(A, x, z, ex, ez, k) { A.a.rotation.x = lerp(A.a.rotation.x, x, k); A.a.rotation.z = lerp(A.a.rotation.z, z, k); A.b.rotation.x = lerp(A.b.rotation.x, ex, k); A.b.rotation.z = lerp(A.b.rotation.z, ez || 0, k); }
  /* updateBot aus v3: CUR und frame entfallen, wipp = 0; dazu Sitzen, Ruhig (ganz still) und Stoss */
  function updateBot(b, dt, rdt, T, still) {
    const t = T + b.phase;
    const moving = b.laeuft && dt > 0;
    const k = Math.min(1, rdt * 10 + 0.05);
    const p = t * 9;
    b.beine.forEach((L, i) => {
      if (b.sitzt) { L.a.rotation.x = lerp(L.a.rotation.x, -1.45, 0.35); L.b.rotation.x = lerp(L.b.rotation.x, 1.45, 0.35); return; }
      const ph = p + i * Math.PI;
      const hip = moving ? -Math.sin(ph) * 0.55 : 0;
      const knee = moving ? 0.1 + Math.max(0, Math.sin(ph + 1.3)) * 0.95 : 0.05;
      L.a.rotation.x = lerp(L.a.rotation.x, hip, 0.35); L.b.rotation.x = lerp(L.b.rotation.x, knee, 0.35);
    });
    let bob = still ? 0 : moving ? Math.abs(Math.sin(p)) * 0.07 : (Math.sin(t * 2) * 0.018 + 0.018);
    const neigung = moving ? 0.08 : 0;
    b.body.rotation.z = lerp(b.body.rotation.z, still ? 0 : moving ? Math.sin(p) * 0.06 : Math.sin(t * 1.3) * 0.02, 0.2);
    const sw = still ? 0 : moving ? Math.sin(p) * 0.5 : Math.sin(t * 1.6) * 0.05;
    let L = [sw, -0.2, -0.3, 0], R = [-sw, 0.2, -0.3, 0];
    if (!still) {
      switch (b.mode) {
        case 'type': L = [-1.15 + Math.sin(t * 15) * 0.12, -0.28, -0.75, 0]; R = [-1.15 + Math.sin(t * 15 + Math.PI) * 0.12, 0.28, -0.75, 0]; bob += Math.abs(Math.sin(t * 8)) * 0.015; break;
        case 'point': R = [-1.45, 0.35 + Math.sin(t * 2) * 0.12, -0.1, 0]; break;
      }
      if (b.winken > 0) { b.winken -= rdt; R = [0, 2.55, 0, 0.55 * Math.sin(t * 12)]; }
      if (b.carry) { L = [0, -2.7, 0, -0.9]; R = [0, 2.7, 0, 0.9]; }
      if (b.cheer > 0) { b.cheer -= rdt; L = [0, -2.6, 0, 0.4 * Math.sin(t * 14 + b.cheer * 20)]; R = [0, 2.6, 0, -0.4 * Math.sin(t * 14 + b.cheer * 20)]; bob += Math.abs(Math.sin(b.cheer * 9)) * 0.22; }
    }
    b.body.rotation.x = lerp(b.body.rotation.x, neigung, 0.1);
    setArm(b.armL, L[0], L[1], L[2], L[3], still ? Math.min(1, rdt * 6 + 0.02) : k);
    setArm(b.armR, R[0], R[1], R[2], R[3], still ? Math.min(1, rdt * 6 + 0.02) : k);
    b.body.position.y = bob;
    if (b.hopT >= 0) {
      b.hopT += rdt; const q = b.hopT / 0.55;
      if (q >= 1) { b.hopT = -1; b.hop.position.y = 0; b.hop.rotation.y = 0; }
      else { b.hop.position.y = Math.sin(Math.PI * q) * 0.75; b.hop.rotation.y = q * Math.PI * 2; }
    }
  }

  /* ---------- Aufstellung (quer, tief): Szene im Bild, Bildschirm in der Mitte ---------- */
  const STAPEL = kp(-4.15, 3.5);
  const WEG = [kp(-3.3, 3.05), kp(-4.15, 2.25), kp(-3.4, 1.15)];   // Träger: Stapel bis linke Bildschirmkante
  const ABLAGE = kp(-2.75, 1.75);
  const HOCKER = kp(3.45, 2.35);
  const ZEIGER_POS = kp(3.95, -0.7);
  const schirmPunkt = (u) => { const p = new THREE.Vector3(u, 0, 0.5); p.applyAxisAngle(Y_ACHSE, SCHIRM_DREH); return p; };
  const LINKE_KANTE = schirmPunkt(-3.0);
  // Blickrichtung in Szenen-Koordinaten: quer nach rechts, tief zur Kamera
  const blickKam = (quer, tief) => { const p = kp(quer, tief); return faceTo(p.x, p.z); };

  // Klötze als Instanzen-Netz (Butter: viele gleiche Teile in einem Netz)
  const KLOTZ = [{ c: C.tinte, y: 0, d: 0.12 }, { c: C.kobalt, y: 0.6, d: -0.2 }, { c: C.butter, y: 1.2, d: 0.32 }];
  const kloetze = new THREE.InstancedMesh(rgeo(0.6, 0.6, 0.6, 0.08), new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.62 }), KLOTZ.length);
  const farbe = new THREE.Color();
  KLOTZ.forEach((k, i) => { kloetze.setColorAt(i, farbe.setHex(k.c)); k.ox = { x: 0, v: 0 }; k.oz = { x: 0, v: 0 }; });
  welt.add(kloetze);
  const km = new THREE.Matrix4(), kq = new THREE.Quaternion(), ke = new THREE.Euler(), kpos = new THREE.Vector3(), keins = new THREE.Vector3(1, 1, 1);
  function kloetzeSetzen() {
    KLOTZ.forEach((k, i) => {
      const f = 1 + i * 0.5;   // oben wackelt es mehr
      kpos.set(STAPEL.x + k.ox.x * f, k.y, STAPEL.z + k.oz.x * f);
      ke.set(clamp(k.oz.v * 0.05, -0.25, 0.25), k.d, clamp(-k.ox.v * 0.05, -0.25, 0.25));
      km.compose(kpos, kq.setFromEuler(ke), keins);
      kloetze.setMatrixAt(i, km);
    });
    kloetze.instanceMatrix.needsUpdate = true;
  }
  kloetzeSetzen();

  // Ablage an der linken Bildschirmkante: zwei Blätter
  const ablage = grp(ABLAGE.x, 0, ABLAGE.z, welt); ablage.rotation.y = SCHIRM_DREH + 0.3;
  box(0.7, 0.05, 0.5, C.butter, 0, 0, 0, ablage, 0.02); box(0.7, 0.05, 0.5, C.gehaeuse, 0.04, 0.05, -0.03, ablage, 0.02).rotation.y = 0.2;
  let ablagePuls = 0;

  // Hocker und Tastatur-Platte für den Tipper
  const blickB = blickKam(-1, 0.6);   // Tipper schaut nach links vorne, Tastatur und Hände bleiben sichtbar
  const vorB = new THREE.Vector2(Math.sin(blickB), Math.cos(blickB));
  box(0.9, 0.5, 0.9, C.sockel, HOCKER.x, 0, HOCKER.z, welt, 0.14).rotation.y = blickB;
  const tastPos = { x: HOCKER.x + vorB.x * 0.85, z: HOCKER.z + vorB.y * 0.85 };
  cyl(0.06, 0.86, C.gedaempft, tastPos.x, 0, tastPos.z, welt);
  const taste = box(1.2, 0.08, 0.5, C.tinte2, tastPos.x, 0.86, tastPos.z, welt, 0.03); taste.rotation.y = blickB;
  taste.rotation.x = -0.12;

  const A = makeBot({ x: WEG[0].x, z: WEG[0].z, face: CAMF, mode: 'idle', carry: C.butter, name: 'Träger', satz: 'Ich bringe die Bausteine. Sie bringen Bilder und Worte.' });
  const B = makeBot({ x: HOCKER.x + vorB.x * 0.12, z: HOCKER.z + vorB.y * 0.12, face: blickB, mode: 'type', sitzt: true, name: 'Tipper', satz: 'Ich tippe, Sie sehen jeden Zwischenstand.' });
  const blickC = blickKam(-0.93, 0.37);   // Zeiger schaut zum Bildschirm, halb zur Kamera
  const Cz = makeBot({ x: ZEIGER_POS.x, z: ZEIGER_POS.z, face: blickC, mode: 'point', name: 'Zeiger', satz: () => `${BREIT.matches ? 'Links' : 'Oben'} Ihren Betrieb eintippen, dann zeige ich ihn hier.` });

  /* Träger: Stapel, Weg, Kante; ein Gang (hin und zurück) rund 6 s */
  const wegLaenge = WEG.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - WEG[i].x, p.z - WEG[i].z), 0);
  const TRAEGER = { idx: 0, richtung: 1, warte: 0.5, ablegen: 0, tempo: (2 * wegLaenge) / (6 - 0.8 - 0.5) };
  A.traglast.visible = true; A.carry = true;
  function traegerSchritt(dt) {
    const tr = TRAEGER;
    if (dt <= 0) { A.laeuft = false; return; }
    if (A.hover) { A.laeuft = false; return; }   // bleibt stehen und schaut zum Zeiger
    if (tr.ablegen > 0) {
      tr.ablegen -= dt;
      if (tr.ablegen <= 0) { A.mode = 'idle'; tr.richtung = -1; tr.idx = 1; }
      A.laeuft = false; return;
    }
    if (tr.warte > 0) {
      tr.warte -= dt; A.laeuft = false;
      if (tr.warte <= 0) { A.traglast.visible = true; A.carry = true; tr.richtung = 1; tr.idx = 1; }
      return;
    }
    const z = WEG[tr.idx], dx = z.x - A.px, dz = z.z - A.pz, dist = Math.hypot(dx, dz);
    if (dist < 0.03) {
      if (tr.idx === WEG.length - 1) { tr.ablegen = 0.8; A.mode = 'point'; A.carry = false; A.traglast.visible = false; ablagePuls = 0.35; }
      else if (tr.idx === 0) { tr.warte = 0.5; }
      else tr.idx += tr.richtung;
      A.laeuft = false; return;
    }
    const st = Math.min(dist, tr.tempo * dt);
    A.px += dx / dist * st; A.pz += dz / dist * st;
    A.blick = faceTo(dx, dz); A.laeuft = true;
  }
  function traegerZiel() {
    const tr = TRAEGER;
    if (tr.ablegen > 0) return faceTo(LINKE_KANTE.x - A.px, LINKE_KANTE.z - A.pz);
    if (tr.warte > 0) return faceTo(STAPEL.x - A.px, STAPEL.z - A.pz);
    return A.blick;
  }

  /* ---------- Schatten (aus v3) ---------- */
  welt.traverse(o => {
    if (!o.isMesh || o.userData.istBoden) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (o.userData.ohneSchatten || o.material === trefferMat || ms.some(m => m.transparent)) return;
    o.castShadow = true; o.receiveShadow = true;
  });
  kloetze.castShadow = true; kloetze.receiveShadow = true;

  /* ---------- Sprechblase (aus v3, relativ zum Szenen-Container) ---------- */
  const blase = $('#blase'), bText = $('.b-text', blase);
  let blaseBot = null, blaseUhr = 0;
  const wp = new THREE.Vector3(), pv = new THREE.Vector3();
  let BW = 1, BH = 1;
  function projiziere(p) { pv.copy(p).project(cam); return [(pv.x * 0.5 + 0.5) * BW, (-pv.y * 0.5 + 0.5) * BH]; }
  function sage(b) {
    blaseBot = b; bText.textContent = typeof b.satz === 'function' ? b.satz() : b.satz;
    blase.classList.add('zeigen');
    clearTimeout(blaseUhr);
    blaseUhr = setTimeout(() => { blase.classList.remove('zeigen'); blaseBot = null; }, 3200);
    blaseSetzen();
  }
  function blaseSetzen() {
    const b = blaseBot;
    if (!b) return;
    b.root.getWorldPosition(wp); const fussY = wp.y;
    wp.y = fussY + (1.75 + b.hop.position.y) * b.S;
    const [x, y] = projiziere(wp);
    wp.y = fussY; const [, fy] = projiziere(wp);
    const bw = blase.offsetWidth, bh = blase.offsetHeight;
    const halb = Math.min(BW / 2, bw / 2 + 4), xk = clamp(x, halb, BW - halb);
    let oben = y - 12 - bh, unten = false;
    if (oben < 4) { oben = Math.min(fy + 16, BH - bh - 4); unten = true; }
    blase.classList.toggle('unten', unten);
    blase.style.transform = `translate3d(${(xk - bw / 2).toFixed(1)}px,${oben.toFixed(1)}px,0)`;
    blase.style.setProperty('--zipfel', `${clamp(x - xk, -halb + 18, halb - 18).toFixed(1)}px`);
  }

  /* ---------- Zeiger, Raycast (Versatz des Canvas über getBoundingClientRect) ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8);
  const zeiger = { x: 0, y: 0, drin: false, welt: new THREE.Vector3(), weltOk: false, neu: false };
  const par = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, zx: 0, zy: 0 };
  function strahl(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
  }
  function trefferBei(cx, cy) { strahl(cx, cy); const h = ray.intersectObjects(ziele, false); return h.length ? h[0].object : null; }
  function bodenBei(cx, cy, out) {
    strahl(cx, cy);
    if (!ray.ray.intersectPlane(ebene, out)) return false;
    welt.worldToLocal(out); return true;
  }
  if (FEIN) {
    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = rahmen.getBoundingClientRect();
      par.zx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      par.zy = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      const drin = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (drin || zeiger.drin) { zeiger.x = e.clientX; zeiger.y = e.clientY; zeiger.drin = drin; zeiger.neu = true; }
      if (sichtbar) wecken();
    }, { passive: true });
    document.addEventListener('pointerleave', () => { zeiger.drin = false; par.zx = 0; par.zy = 0; wecken(); });
  }
  /* Stoss (Butter): Kraft Stärke × (1 - d / r)², r = 2.5 Einheiten, vom Zeiger weg */
  const STOSS_R = 2.5, STOSS_DAUER = 70, STOSS_TIPP = 9;
  const W2 = Math.pow(2 * Math.PI / 0.45, 2);   // Ruhelage unter Dauerstoss: Auslenkung = Kraft / w²
  const tmp = new THREE.Vector3();
  function stossKraft(px, pz, wx, wz) {
    const dx = px - wx, dz = pz - wz, d = Math.hypot(dx, dz);
    if (d >= STOSS_R) return null;
    const f = Math.pow(1 - d / STOSS_R, 2);
    const nx = d > 1e-3 ? dx / d : 1, nz = d > 1e-3 ? dz / d : 0;
    return [nx * f, nz * f];
  }
  function tippStoss(cx, cy) {
    if (!bodenBei(cx, cy, tmp)) return;
    for (const b of helfer) { const s = stossKraft(b.px, b.pz, tmp.x, tmp.z); if (s) { b.ox.v += s[0] * STOSS_TIPP; b.oz.v += s[1] * STOSS_TIPP; } }
    KLOTZ.forEach(k => { const s = stossKraft(STAPEL.x, STAPEL.z, tmp.x, tmp.z); if (s) { k.ox.v += s[0] * STOSS_TIPP * 0.6; k.oz.v += s[1] * STOSS_TIPP * 0.6; } });
  }
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { tippStoss(e.clientX, e.clientY); wecken(); } });
  canvas.addEventListener('click', e => {
    const o = trefferBei(e.clientX, e.clientY);
    if (!o) return;
    if (o.userData.bot) { const b = o.userData.bot; b.hopT = 0; sage(b); }
    else if (o.userData.bildschirm) oeffnen();
    wecken();
  });

  /* ---------- Sichtbarkeit: rendern nur, wenn Container und Tab sichtbar sind ---------- */
  let sichtbar = true, tabSichtbar = !document.hidden, laeuft = false, letzte = 0, T = 0, naechstesWinken = 14;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar) wecken(); }).observe(rahmen);
  document.addEventListener('visibilitychange', () => { tabSichtbar = !document.hidden; if (tabSichtbar) wecken(); });

  function groesse() {
    const w = rahmen.clientWidth, h = rahmen.clientHeight;
    if (!w || !h) return;
    BW = w; BH = h;
    renderer.setSize(w, h, false);
    const vw = SCHIRM_BREITE / 0.62, vh = vw * h / w;
    cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2; cam.updateProjectionMatrix();
    // 12 px Versatz beim Blockaufbau, umgerechnet in Textur-Pixel
    kompositor.lift = clamp(12 * 1600 / Math.max(120, w * 0.62 * (6.0 / 6.4)), 12, 90);
    wecken();
  }
  if ('ResizeObserver' in window) new ResizeObserver(groesse).observe(rahmen);
  else addEventListener('resize', groesse);

  function wecken() {
    if (laeuft || !sichtbar || !tabSichtbar) return;
    laeuft = true; letzte = jetztMs();
    requestAnimationFrame(bild);
  }

  function bild(jetzt) {
    if (!sichtbar || !tabSichtbar) { laeuft = false; return; }
    const rdt = Math.min(0.05, Math.max(0, (jetzt - letzte) / 1000));
    letzte = jetzt;
    const still = RUHIG;
    const dt = still ? 0 : rdt;   // selbstlaufende Zeit steht im Ruhig-Modus
    T += dt;
    let bewegt = !still;

    // Parallaxe, nur mit feinem Zeiger und nicht am Handy
    if (FEIN && !HANDY) {
      const MAX = THREE.MathUtils.degToRad(2.5);
      feder(par.x, par.zx * MAX, 0.6, rdt); feder(par.y, par.zy * MAX, 0.6, rdt);
      dreh.rotation.set(0, 0, 0);
      dreh.rotateOnWorldAxis(Y_ACHSE, par.x.x);
      dreh.rotateOnWorldAxis(RECHTS, par.y.x * 0.6);
      if (!ruht(par.x, par.zx * MAX, 1e-4) || !ruht(par.y, par.zy * MAX, 1e-4)) bewegt = true;
    }

    // Zeiger: Hover, Stoss
    zeiger.weltOk = FEIN && zeiger.drin && bodenBei(zeiger.x, zeiger.y, zeiger.welt);
    if (FEIN && zeiger.neu) {
      zeiger.neu = false;
      const o = zeiger.drin ? trefferBei(zeiger.x, zeiger.y) : null;
      canvas.style.cursor = o ? 'pointer' : '';
      helfer.forEach(b => { b.hover = !!(o && o.userData.bot === b); });
    }

    // Helfer: Zeiger (Wechsel jubeln, alle 14 s winken), Träger läuft
    if (!still) {
      naechstesWinken -= dt;
      if (naechstesWinken <= 0) { naechstesWinken = 14; Cz.winken = 2.2; }
    }
    traegerSchritt(dt);
    if (still) { A.laeuft = false; }
    for (const b of helfer) {
      // Blickrichtung: Feder (Dämpfung 1.0); bei Hover in 0.3 s zum Zeiger
      let ziel = b === A ? traegerZiel() : b.blick;
      let antwort = 0.3;
      if (b.hover && zeiger.weltOk) ziel = faceTo(zeiger.welt.x - b.px, zeiger.welt.z - b.pz);
      else if (b === A && A.laeuft) antwort = 0.25;
      const zielU = b.yaw.x + winkel(b.yaw.x, ziel);
      feder(b.yaw, zielU, antwort, rdt);
      // Stoss vom Zeiger, Rückkehr mit Feder (Dämpfung 1.0, Antwort 0.45 s)
      let ax = 0, az = 0;
      if (zeiger.weltOk) { const s = stossKraft(b.px, b.pz, zeiger.welt.x, zeiger.welt.z); if (s) { ax = s[0] * STOSS_DAUER; az = s[1] * STOSS_DAUER; } }
      feder(b.ox, 0, 0.45, rdt, ax); feder(b.oz, 0, 0.45, rdt, az);
      b.root.position.set(b.px + b.ox.x, 0, b.pz + b.oz.x);
      b.root.rotation.y = b.yaw.x;
      updateBot(b, dt, rdt, T, still);
      if (!ruht(b.ox, ax / W2) || !ruht(b.oz, az / W2) || Math.abs(b.yaw.v) > 1e-3 || b.hopT >= 0 || Math.abs(winkel(b.yaw.x, ziel)) > 1e-3) bewegt = true;
    }
    // Klötze
    let kAktiv = false;
    KLOTZ.forEach(k => {
      let ax = 0, az = 0;
      if (zeiger.weltOk) { const s = stossKraft(STAPEL.x, STAPEL.z, zeiger.welt.x, zeiger.welt.z); if (s) { ax = s[0] * STOSS_DAUER * 0.35; az = s[1] * STOSS_DAUER * 0.35; } }
      feder(k.ox, 0, 0.45, rdt, ax); feder(k.oz, 0, 0.45, rdt, az);
      if (!ruht(k.ox, ax / W2) || !ruht(k.oz, az / W2)) kAktiv = true;
    });
    if (kAktiv || k0Aktiv) { kloetzeSetzen(); bewegt = bewegt || kAktiv; }
    k0Aktiv = kAktiv;
    // Ablage zuckt kurz, wenn ein Blatt abgelegt wird
    if (ablagePuls > 0) { ablagePuls = Math.max(0, ablagePuls - rdt); const q = ablagePuls / 0.35; ablage.scale.set(1 + 0.12 * q, 1 + 0.5 * q, 1 + 0.12 * q); bewegt = true; }

    // Textur
    const k = kompositor.schritt(jetzt);
    if (k.geaendert) tex.needsUpdate = true;
    if (k.laeuft) bewegt = true;

    if (blaseBot) blaseSetzen();
    renderer.render(scene, cam);
    if (bewegt) requestAnimationFrame(bild); else laeuft = false;
  }
  let k0Aktiv = false;

  /* Ruhig: Helfer stehen ganz still im Modus idle, das Blatt des Trägers ist weg */
  function ruhigSetzen() {
    const tragend = TRAEGER.richtung > 0 && TRAEGER.ablegen <= 0;
    if (RUHIG) { A.mode = 'idle'; A.carry = false; A.traglast.visible = false; Cz.cheer = 0; Cz.winken = 0; }
    else { A.carry = tragend; A.traglast.visible = tragend; A.mode = TRAEGER.ablegen > 0 ? 'point' : 'idle'; }
    wecken();
  }
  if (RUHIG) ruhigSetzen();

  groesse();
  return {
    wecken,
    sichtbar: () => sichtbar && tabSichtbar,
    jubel() { if (!RUHIG) Cz.cheer = 0.9; wecken(); },
    ruhig: ruhigSetzen,
  };
}

/* ---------- Rückfall ohne WebGL 2: Figure mit 2D-Vorschau und zwei SVG-Helfern ---------- */
function rueckfallBauen() {
  html.classList.add('no-webgl');
  const ort = $('#rueckfall-bild');
  if (!ort) return;
  kompositor.cv.setAttribute('aria-hidden', 'true');
  ort.appendChild(kompositor.cv);
  kompositor.cv.addEventListener('click', oeffnen);
  let laeuft = false;
  const schritt = jetzt => {
    const k = kompositor.schritt(jetzt);
    if (k.laeuft) requestAnimationFrame(schritt); else laeuft = false;
  };
  rueckfallWecken = () => { if (!laeuft) { laeuft = true; requestAnimationFrame(schritt); } };
  rueckfallWecken();
}

const rahmen = $('#szene-rahmen'), szeneCanvas = $('#szene');
if (!html.classList.contains('no-webgl') && rahmen && szeneCanvas) {
  // Der Rest dieses Moduls wartet nicht auf three: Menü, Formular und Anker sind sofort bereit
  import('three')
    .then(modul => {
      THREE = modul;
      try { szene = szeneBauen(rahmen, szeneCanvas); } catch (e) { szene = null; }
      if (!szene) rueckfallBauen();
    })
    .catch(() => { szene = null; rueckfallBauen(); });
} else rueckfallBauen();

/* Schriften: Vorschau-Texturen und Kacheln neu zeichnen, sobald Archivo und Mono geladen sind */
schriftenLaden().then(() => { kompositor.freigeben(); kompositor.neuZeichnen(); kachelnNeu(); wecken(); });
setTimeout(() => { kompositor.freigeben(); wecken(); }, 700);   // Frist, falls die Schrift hängt

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
   Ablauf: Linie füllt sich beim Scrollen (scroll-gekoppelt, ohne Festhalten)
   ====================================================================== */
const schrittListe = $('.schritte');
const schritte = $$('.schritt');
let ablaufGeplant = false;
function ablaufMessen() {
  ablaufGeplant = false;
  if (!schrittListe) return;
  const r = schrittListe.getBoundingClientRect(), vh = window.innerHeight;
  const waag = window.matchMedia('(min-width: 820px)').matches;   // gleiche Schwelle wie im CSS (Ablauf ab 820 px waagrecht)
  const p = waag ? clamp((vh * 0.85 - r.top) / (vh * 0.5), 0, 1) : clamp((vh * 0.62 - r.top) / Math.max(1, r.height - 40), 0, 1);
  const n = schritte.length - 1;
  schritte.forEach((s, i) => {
    s.style.setProperty('--f', clamp(p * n - i, 0, 1).toFixed(3));
    s.classList.toggle('erreicht', p * n >= i - 0.001 && p > 0);
  });
}
addEventListener('scroll', () => { if (!ablaufGeplant) { ablaufGeplant = true; requestAnimationFrame(ablaufMessen); } }, { passive: true });
addEventListener('resize', ablaufMessen);
ablaufMessen();

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
if (V.name) betriebVorbefuellen(V.name);

/* ======================================================================
   Schalter "Bewegung: an / ruhig" (der Kopf setzt Klasse und Speicher und meldet hier)
   ====================================================================== */
document.addEventListener('hebel-ruhig', e => {
  RUHIG = !!e.detail;
  if (RUHIG && markeWinkt) markeWinkt.cancel();
  if (RUHIG) { lenisStopp(); preisHelfer && preisHelfer.style.setProperty('--blick', '-1'); preisHelfer && preisHelfer.style.setProperty('--neigung', '0deg'); }
  else { lenisStart(); V.letzterWechsel = jetztMs(); }
  kompositor.neuZeichnen();
  kachelnNeu();
  if (szene) szene.ruhig();
  wecken();
});
