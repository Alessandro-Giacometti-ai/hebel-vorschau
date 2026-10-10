/* Quader Bau, v3c Bauplan: Motor (Takt und Lenis), Kopf mit Uhr, Menü, Hero mit Zeitraffer und
   Bemassung, Satz, Leistungen, Bauzeitenplan, Fuss und die Offerte aus v2.
   Bewegung der Identität: hart, schnell, präzise (160 bis 240 ms, Wischen von links, nichts federt). Die Bohrkerne rechnen in bohrkerne.js und hängen sich an
   den Takt (window.__quader.takt).
   Bewegung läuft immer. Im ruhigen Modus (Knopf "Bewegung") fällt nur selbstlaufende Bewegung weg:
   Lenis, Intro, Zeiger-Versatz, Auftritte. Alles, was am Scroll hängt, bleibt. */

const html = document.documentElement;
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => Array.from(w.querySelectorAll(s));
let RUHIG = html.classList.contains('ruhig');
const FEIN = matchMedia('(hover: hover) and (pointer: fine)').matches;
const istMobil = () => innerWidth <= 760;
const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const bereich = (x, a, b) => klemmen((x - a) / (b - a));
const koteText = m => (m < 0.005 ? '±0.00' : '+' + m.toFixed(2));

/* ================= Takt und Lenis ================= */
const takt = new Set();
let zeit = 0;
let lenis = null;
const scroll = { y: window.scrollY, tempo: 0 };

function lenisSetzen() {
  if (RUHIG && lenis) { lenis.destroy(); lenis = null; }
  else if (!RUHIG && !lenis && window.Lenis) {
    /* respectReducedMotion aus: die Systemeinstellung wird nicht ausgewertet */
    lenis = new window.Lenis({ duration: 0.7, smoothWheel: true, respectReducedMotion: false });
  }
  if (window.__quader) window.__quader.lenis = lenis;
}
document.addEventListener('hebel-ruhig', e => { RUHIG = !!e.detail; lenisSetzen(); });

function motorStarten() {
  window.__quader = { lenis: null, takt, scroll };
  lenisSetzen();
  let letzte = performance.now(), letzteY = window.scrollY;
  const tick = jetzt => {
    const dt = Math.min(0.05, Math.max(0, (jetzt - letzte) / 1000));
    letzte = jetzt;
    if (lenis) lenis.raf(jetzt);
    zeit += dt;
    const y = window.scrollY;
    scroll.tempo = (y - letzteY) / Math.max(dt, 1e-3);
    scroll.y = y; letzteY = y;
    for (const f of takt) {
      try { f(dt, zeit); } catch (e) { console.warn('Takt:', e && e.message); takt.delete(f); }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function sichtbar(el, rand = '0px') {
  const z = { an: false };
  new IntersectionObserver(e => { z.an = e[e.length - 1].isIntersecting; }, { rootMargin: rand }).observe(el);
  return z;
}
let tabSichtbar = !document.hidden;
document.addEventListener('visibilitychange', () => { tabSichtbar = !document.hidden; });

/* ================= Kopf: beim Scrollen nach unten weg, nach oben wieder da ================= */
function kopf() {
  const oben = $('[data-oben]');
  let letzte = window.scrollY, weg = false, unten = false;
  takt.add(() => {
    const y = window.scrollY, d = y - letzte;
    letzte = y;
    const fokusDrin = oben.contains(document.activeElement) && document.activeElement !== document.body;
    if (y < 80 || fokusDrin) weg = false;
    else if (d > 3) weg = true;
    else if (d < -3) weg = false;
    if (oben.classList.contains('ist-weg') !== weg) oben.classList.toggle('ist-weg', weg);
    const u = y > 20;
    if (u !== unten) { unten = u; oben.classList.toggle('ist-unten', u); }
  });
}

/* ================= Menü und Anker ================= */
function navigation() {
  const menue = $('[data-menue]'), auf = $('[data-menue-auf]'), zu = $('[data-menue-zu]');
  let vorher = null;
  const oeffnen = () => {
    vorher = document.activeElement; menue.hidden = false; auf.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop(); zu.focus();
  };
  const schliessen = (zurueck = true) => {
    menue.hidden = true; auf.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start(); if (zurueck && vorher) vorher.focus();
  };
  auf.addEventListener('click', oeffnen);
  zu.addEventListener('click', () => schliessen());
  menue.addEventListener('keydown', e => {
    if (e.key === 'Escape') { schliessen(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a, button', menue), a = f[0], b = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
    else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
  });
  function scrolleZu(ziel) {
    if (!ziel) return;
    const y = ziel.id === 'start' ? 0 : Math.max(0, ziel.getBoundingClientRect().top + window.scrollY);
    if (lenis) lenis.scrollTo(y, { duration: 0.9 });
    else window.scrollTo({ top: y, behavior: RUHIG ? 'auto' : 'smooth' });
  }
  window.__quaderScrolleZu = scrolleZu;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const ziel = id ? document.getElementById(id) : null;
    if (!ziel) return;
    e.preventDefault();
    if (!menue.hidden) schliessen(false);
    if (a.dataset.projektart && window.__quaderOfferte) window.__quaderOfferte.projektart(a.dataset.projektart);
    scrolleZu(ziel);
    if (id === 'offerte') setTimeout(() => {
      const erstes = $('[data-schritt]:not([hidden]) input, [data-schritt]:not([hidden]) select');
      if (erstes) erstes.focus({ preventScroll: true });
    }, lenis ? 1000 : 600);
  });
}

/* ================= Raster: Spaltenkanten aus der festen Ebene lesen ================= */
/* Die Linien der Ebene div.raster sind die Wahrheit. Wer im Raster stehen muss, misst hier. */
function kanten() {
  const ebene = $('body > .raster');
  const n = istMobil() ? 4 : 12;
  const L = [], R = [];
  const kinder = ebene ? ebene.children : [];
  for (let k = 0; k < n && k < kinder.length; k++) {
    const r = kinder[k].getBoundingClientRect();
    L.push(r.left); R.push(r.right);
  }
  if (!L.length) { L.push(16); R.push(innerWidth - 16); }
  return { L, R, n };
}

/* ================= Hero mit Zeitraffer ================= */
const hartAus = t => 1 - Math.pow(1 - t, 3);
async function held() {
  const sek = $('[data-held]'), buehne = $('[data-held-buehne]');
  const bild = $('[data-held-bild]'), film = $('[data-film]'), dunkel = $('[data-held-dunkel]');
  const kopfEl = $('[data-held-kopf]'), titel = $('[data-held-titel]'), unter = $('[data-held-unter]');
  const angabe = $('[data-held-angabe]'), koteFeld = $('[data-held-kote]');
  const bemass = $('[data-held-bemass]'), bemassZahl = $('[data-held-bemass-zahl]');
  const ctx = film.getContext('2d', { alpha: false });
  const sicht = sichtbar(buehne, '80px');

  /* Zeitraffer: Einzelbilder in Stufen laden (Anfang und Ende, jedes achte, jedes zweite, alle) */
  let meta = null;
  try { meta = await (await fetch('/hebel-vorschau/v3/beispiele/quader-bau/video-zeitraffer/meta.json')).json(); } catch (e) { meta = null; }
  if (!meta) meta = { desktop: { praefix: 'bild-', anzahl: 64, endung: '.webp' }, mobil: { praefix: 'm-bild-', anzahl: 32, endung: '.webp' } };
  const hoch = matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
  const cfg = hoch ? meta.mobil : meta.desktop;
  const N = cfg.anzahl;
  const bilder = new Array(N).fill(null);
  const pfad = i => `/hebel-vorschau/v3/beispiele/quader-bau/video-zeitraffer/${cfg.praefix}${String(i + 1).padStart(4, '0')}${cfg.endung}`;
  const reihe = [0, N - 1];
  const gesehen = new Set(reihe);
  for (const s of [8, 2, 1]) for (let i = 0; i < N; i += s) if (!gesehen.has(i)) { gesehen.add(i); reihe.push(i); }
  let neu = true;
  (async () => {
    let k = 0;
    const arbeiter = async () => {
      while (k < reihe.length) {
        const i = reihe[k++];
        const img = new Image();
        img.decoding = 'async';
        img.src = pfad(i);
        try { await img.decode(); bilder[i] = img; neu = true; } catch (e) { /* fehlt: das nächste geladene wird gezeigt */ }
      }
    };
    await Promise.all([arbeiter(), arbeiter(), arbeiter()]);
  })();
  const naechstes = i => {
    for (let d = 0; d < N; d++) {
      if (bilder[i - d]) return bilder[i - d];
      if (bilder[i + d]) return bilder[i + d];
    }
    return null;
  };

  /* Rechteck am Anfang, alles in Pixeln und auf Spaltenkanten:
     Desktop Spalte 5 bis 12 unter dem Titel, daneben in Spalte 1 bis 4 die Unterzeile.
     Handy Spalte 1 bis 4, die Unterzeile steht zwischen Titel und Bild. */
  let filmW = 0, filmH = 0, gezeigt = -1, gezeigtBild = null;
  let letzteH = -1, letzteKote = '', letzteZahl = -1;
  const start = { t: 0, r: 0, b: 0, l: 0 };
  function titelEinpassen() {
    titel.style.fontSize = '';
    const platz = kopfEl.clientWidth - 2 * (parseFloat(getComputedStyle(kopfEl).paddingLeft) || 0);
    const breite = Math.max(...$$('.held__zeile > span', titel).map(s => s.offsetWidth));
    const fs = parseFloat(getComputedStyle(titel).fontSize) || 100;
    if (breite > platz + 1) titel.style.fontSize = (fs * platz / breite * 0.99).toFixed(1) + 'px';
  }
  function groesse() {
    const dpr = Math.min(devicePixelRatio || 1, istMobil() ? 1.5 : 1.75);
    filmW = Math.round(film.clientWidth * dpr); filmH = Math.round(film.clientHeight * dpr);
    film.width = filmW; film.height = filmH;
    gezeigt = -1; neu = true;
    titelEinpassen();
    const W = buehne.clientWidth, H = buehne.clientHeight;
    const k = kanten();
    const titelUnten = kopfEl.offsetTop + kopfEl.offsetHeight;
    if (istMobil()) {
      unter.style.left = k.L[0] + 'px';
      unter.style.width = (k.R[k.n - 1] - k.L[0]) + 'px';
      unter.style.top = (titelUnten + 12) + 'px';
      start.t = titelUnten + 12 + unter.offsetHeight + 24;
      start.l = k.L[0]; start.r = W - k.R[k.n - 1]; start.b = 16;
    } else {
      start.t = titelUnten + 24;
      start.l = k.L[4]; start.r = W - k.R[11]; start.b = 24;
      unter.style.left = k.L[0] + 'px';
      unter.style.width = (k.R[3] - k.L[0]) + 'px';
      unter.style.top = start.t + 'px';
    }
    /* sehr flache Fenster: das Bild soll nicht zum Strich werden */
    start.t = Math.min(start.t, H * 0.62);
    letzteH = -1;
  }
  function zeichneFilm(f) {
    const i = Math.round(f * (N - 1));
    const img = naechstes(i);
    if (!img || (i === gezeigt && img === gezeigtBild && !neu)) return;
    neu = false; gezeigt = i; gezeigtBild = img;
    const s = Math.max(filmW / img.naturalWidth, filmH / img.naturalHeight);
    const w = img.naturalWidth * s, hh = img.naturalHeight * s;
    ctx.drawImage(img, (filmW - w) / 2, (filmH - hh) / 2, w, hh);
  }

  /* Zeiger: Bild höchstens 8 px, Kote 12 px, Glättung 0.1. Am Handy Ziehen. Ruhig: aus. */
  const zg = { x: 0, y: 0, sx: 0, sy: 0 };
  if (FEIN) addEventListener('pointermove', e => { zg.x = (e.clientX / innerWidth - 0.5) * 2; zg.y = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  else {
    let lx = 0, ly = 0;
    buehne.addEventListener('touchstart', e => { const t = e.touches[0]; lx = t.clientX; ly = t.clientY; }, { passive: true });
    buehne.addEventListener('touchmove', e => {
      const t = e.touches[0];
      zg.x = klemmen(zg.x + (t.clientX - lx) / 120, -1, 1); zg.y = klemmen(zg.y + (t.clientY - ly) / 240, -1, 1);
      lx = t.clientX; ly = t.clientY;
    }, { passive: true });
  }

  addEventListener('resize', groesse);
  await document.fonts.ready;
  groesse();

  takt.add(dt => {
    if (!sicht.an || !tabSichtbar) return;
    const r = sek.getBoundingClientRect();
    const weg = Math.max(1, sek.offsetHeight - 2 * buehne.offsetHeight);
    const h = klemmen(-r.top / weg);
    const f = klemmen(h / 0.95);
    zeichneFilm(f);
    if (RUHIG) { zg.sx = 0; zg.sy = 0; }
    else {
      const k = 1 - Math.exp(-6.3 * dt);
      zg.sx = lerp(zg.sx, zg.x, k); zg.sy = lerp(zg.sy, zg.y, k);
      if (!FEIN) { zg.x *= Math.exp(-3 * dt); zg.y *= Math.exp(-3 * dt); }
    }
    film.style.transform = `translate3d(${(-zg.sx * 8).toFixed(2)}px,${(-zg.sy * 8).toFixed(2)}px,0)`;
    angabe.style.transform = `translate3d(${(-zg.sx * 12).toFixed(2)}px,${(-zg.sy * 12).toFixed(2)}px,0)`;
    if (h === letzteH) return;
    letzteH = h;
    /* Zwei harte Takte statt eines weichen Wachsens:
       bis h 0.12 fährt das Bild seitlich und unten an den Rand (deckt die Unterzeile),
       bis h 0.35 schiebt sich die Oberkante wie ein Schieber über den Titel. */
    const a = hartAus(bereich(h, 0, 0.12));
    const b = hartAus(bereich(h, 0.12, 0.35));
    const il = start.l * (1 - a), ir = start.r * (1 - a), ib = start.b * (1 - a), it = start.t * (1 - b);
    bild.style.clipPath = `inset(${it.toFixed(1)}px ${ir.toFixed(1)}px ${ib.toFixed(1)}px ${il.toFixed(1)}px)`;
    angabe.style.left = (Math.max(il, istMobil() ? 16 : 24) + 16).toFixed(1) + 'px';
    angabe.style.bottom = (ib + 16).toFixed(1) + 'px';
    unter.style.visibility = a >= 1 ? 'hidden' : 'visible';
    kopfEl.style.visibility = b >= 1 ? 'hidden' : 'visible';
    /* Ende: das fertige Haus wird leicht abgedunkelt */
    dunkel.style.opacity = (0.32 * bereich(h, 0.95, 1)).toFixed(3);
    /* Kote in Metern, Bemassung in Zentimetern wie auf dem Plan */
    const kt = koteText(14.2 * f);
    if (kt !== letzteKote) { koteFeld.textContent = kt; letzteKote = kt; }
    bemass.style.setProperty('--bm', f.toFixed(4));
    bemass.style.visibility = f > 0.01 ? 'visible' : 'hidden';
    const z = Math.round(1420 * f);
    if (z !== letzteZahl) { bemassZahl.textContent = String(z); letzteZahl = z; }
  });
}

/* ================= Satz: Wort für Wort von links eingewischt, Zeile für Zeile (einmalig) ================= */
function satz() {
  const sek = $('[data-satz]');
  if (!sek || RUHIG) return;
  const teile = $$('[data-teilen]', sek);
  teile.forEach(el => {
    const woerter = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    woerter.forEach((w, i) => {
      const n = document.createElement('span'); n.className = 'wi'; n.textContent = w;
      el.appendChild(n);
      if (i < woerter.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });
  const zeilenSetzen = () => {
    let z = -1;
    teile.forEach(el => {
      let oben = null, w = 0;
      $$('.wi', el).forEach(m => {
        const t = m.offsetTop;
        if (oben === null || Math.abs(t - oben) > 4) { z++; oben = t; w = 0; }
        m.style.setProperty('--z', z); m.style.setProperty('--w', w++);
      });
      z++;
    });
  };
  zeilenSetzen();
  sek.classList.add('bereit');
  const io = new IntersectionObserver(e => {
    if (!e.some(x => x.isIntersecting)) return;
    zeilenSetzen();
    sek.classList.add('ist-da');
    io.disconnect();
  }, { threshold: 0.3 });
  io.observe(sek);
  document.addEventListener('hebel-ruhig', e => { if (e.detail) sek.classList.add('ist-da'); });
}

/* ================= Leistungen: Zeile wird schwarz, Bild wischt in Spalte 9 bis 11 ein ================= */
/* Das Bild hat eine eigene Fläche neben dem Text und bleibt sichtbar, solange der Zeiger auf der Zeile ist. */
function leistungen() {
  const zeilen = $$('[data-leistung]');
  if (new URLSearchParams(location.search).get('zustand') === 'leistungen') zeilen.forEach(z => z.classList.add('ist-hover', 'zeigt-bild'));
  if (!FEIN) return;
  zeilen.forEach(z => {
    z.addEventListener('pointerenter', () => z.classList.add('ist-hover', 'zeigt-bild'));
    z.addEventListener('pointerleave', () => z.classList.remove('ist-hover', 'zeigt-bild'));
  });
}

/* ================= Ablauf: Balken des Bauzeitenplans wischen beim Eintreten herein ================= */
function ablauf() {
  const zeilen = $$('.plan__zeile');
  if (RUHIG) { zeilen.forEach(z => z.classList.add('ist-da')); return; }
  const io = new IntersectionObserver(e => {
    e.forEach(x => { if (x.isIntersecting) { x.target.classList.add('ist-da'); io.unobserve(x.target); } });
  }, { threshold: 0.5 });
  zeilen.forEach(z => io.observe(z));
  document.addEventListener('hebel-ruhig', e => { if (e.detail) zeilen.forEach(z => z.classList.add('ist-da')); });
}

/* ================= Uhr im Kopf: ruhiges Detail, Stunden und Minuten ================= */
function uhr() {
  const el = $('[data-uhr]');
  if (!el) return;
  const setzen = () => {
    const d = new Date();
    const t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (el.textContent !== t) { el.textContent = t; el.dateTime = t; }
  };
  setzen();
  setInterval(setzen, 10000);
}

/* ================= Fuss: QUADER BAU genau über die Breite des Rasters ================= */
function fussWort() {
  const el = $('[data-fuss-wort]');
  if (!el) return;
  const span = el.firstElementChild;
  const passen = () => {
    el.style.fontSize = '100px';
    const w = span.offsetWidth, ziel = el.clientWidth;
    if (w > 0 && ziel > 0) el.style.fontSize = (100 * ziel / w * 0.998).toFixed(2) + 'px';
  };
  addEventListener('resize', passen);
  document.fonts.ready.then(passen);
  passen();
}

/* ================= Offerte (Logik aus v2) ================= */
function offerte() {
  const formular = $('[data-formular]');
  const schritte = $$('[data-schritt]', formular);
  const marken = $$('[data-schritt-marke]', formular);
  const ENTWURF = 'quader-bau-offerte-entwurf';
  const ERGEBNIS = 'quader-bau-offerte-demo';
  const buehneF = $('[data-buehne-formular]');
  const stand = $('[data-stand]'), standNr = $('[data-stand-nr]'), standName = $('[data-stand-name]'), standLinie = $('[data-stand-linie]');
  const NAMEN = ['Projektart', 'Umfang und Zeitraum', 'Kontakt', 'Zusammenfassung'];
  let schrittJetzt = 0;
  const kopfHoehe = () => 56 + 28;

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
      if (felder instanceof RadioNodeList) { for (const f of felder) if (f.type === 'radio') f.checked = f.value === v; }
      else if (felder.type === 'radio') felder.checked = felder.value === v;
      else felder.value = v;
    }
  }
  function projektartVorwaehlen(wert) {
    const feld = formular.querySelector('input[name="projektart"][value="' + wert + '"]');
    if (!feld) return;
    feld.checked = true;
    fehlerZeigen('projektart', false);
    if (schrittJetzt > 2) zeigeSchritt(0, false);
    entwurfSichern();
  }
  window.__quaderOfferte = { projektart: projektartVorwaehlen };
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
  function scrolleZuFormular() {
    const y = formular.getBoundingClientRect().top + window.scrollY - kopfHoehe() - 20;
    if (lenis) lenis.scrollTo(y, { duration: 0.6 }); else window.scrollTo({ top: y, behavior: RUHIG ? 'auto' : 'smooth' });
  }
  function zeigeSchrittSofort(i, fokus) {
    schrittJetzt = i;
    schritte.forEach((s, j) => { s.hidden = j !== i; });
    marken.forEach((m, j) => { if (j === Math.min(2, i)) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current'); });
    stand.hidden = i === 4;
    standNr.textContent = 'Schritt ' + Math.min(3, i + 1) + ' / 3';
    standName.textContent = NAMEN[Math.min(3, i)];
    standLinie.style.transform = `scaleX(${(Math.min(3, i + 1) / 3).toFixed(4)})`;
    if (i === 3) zusammenfassen();
    if (fokus) {
      const s = schritte[i];
      const ziel = i >= 3 ? s : s.querySelector('input:not([type="hidden"]), select, textarea');
      if (ziel) ziel.focus({ preventScroll: true });
      const oben = formular.getBoundingClientRect().top;
      if (oben < kopfHoehe() || oben > innerHeight * 0.6) scrolleZuFormular();
    }
  }
  /* Wechsel hart: der neue Schritt wischt in 200 ms von links herein, keine Überblendung */
  function zeigeSchritt(i, fokus = true) {
    zeigeSchrittSofort(i, fokus);
    if (RUHIG || !buehneF.animate) return;
    buehneF.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 200, easing: 'cubic-bezier(.2,0,0,1)' });
  }
  const TITEL = { projektart: 'Projektart', flaeche: 'Geschossfläche', planung: 'Planung', beginn: 'Baubeginn', gemeinde: 'Gemeinde', beschrieb: 'Beschrieb', name: 'Name', email: 'E-Mail', telefon: 'Telefon', kanal: 'Antwort per' };
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
      const div = document.createElement('div'); div.className = 'zf__gruppe';
      const dt = document.createElement('dt'); dt.textContent = g.titel;
      const dd = document.createElement('dd');
      const teile = g.felder.filter(f => d[f]).map(f => (g.felder.length > 1 ? TITEL[f] + ': ' : '') + d[f]);
      dd.textContent = teile.join(' · ') || 'nichts angegeben';
      const knopf = document.createElement('button'); knopf.type = 'button'; knopf.className = 'zf__aendern'; knopf.textContent = 'Ändern';
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
    if (name) { const regel = (PRUEFUNG[schrittJetzt] || {})[name]; if (regel && regel(daten())) fehlerZeigen(name, false); }
    entwurfSichern();
  });
  formular.addEventListener('input', e => {
    const regel = (PRUEFUNG[schrittJetzt] || {})[e.target.name];
    if (regel && e.target.getAttribute('aria-invalid') && regel(daten())) fehlerZeigen(e.target.name, false);
  });
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
  entwurfLaden();
  /* Testzustand nur für die Sichtprüfung: ?offerte=2 zeigt Schritt 2 */
  const t = new URLSearchParams(location.search).get('offerte');
  if (t && /^[0-4]$/.test(t)) zeigeSchrittSofort(Number(t), false);
}

/* ================= Start ================= */
function start() {
  motorStarten();
  kopf();
  navigation();
  uhr();
  offerte();
  leistungen();
  satz();
  ablauf();
  fussWort();
  held().catch(e => console.warn('Hero:', e && e.message));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
