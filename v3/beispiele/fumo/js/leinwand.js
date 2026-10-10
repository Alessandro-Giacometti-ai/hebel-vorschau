/* Fumo, ein Abend am Feuer (v3b, filmisch): Bildfolgen, WebGL-Leinwand mit Blenden und Glut,
   Titelzeilen, Kreidekarte, Tischplan, Zeitleiste, Karte, Abend und Reservierung (Demo).
   Grundlage: docs/webstudio-2026-10/master-prompts/02b-fumo-filmisch.md */
import * as THREE from 'three';

/* ================= Helfer ================= */
const $ = (s, k) => (k || document).querySelector(s);
const $$ = (s, k) => Array.from((k || document).querySelectorAll(s));
const html = document.documentElement;
/* Ruhig nur auf Wunsch des Besuchers (Klasse ruhig, localStorage hebel-ruhig). Die Systemeinstellung wird nicht gelesen. */
let ruhig = html.classList.contains('ruhig');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const schmalMq = matchMedia('(max-width: 760px)');
const istMobil = () => innerWidth < 760 || innerHeight > innerWidth * 1.05;
const kopfHoehe = () => (schmalMq.matches ? 56 : 60) + 28;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(23);
const FARBE = { flamme: [247, 178, 74], glut: [226, 85, 43], glutHell: [240, 122, 82], asche: [237, 231, 223] };
const mischRgb = (a, b, t) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

function scrolleZu(el, versatz) {
  if (!el) return;
  const v = typeof versatz === 'number' ? versatz : -(kopfHoehe() + 8);
  scrollTo({ top: el.getBoundingClientRect().top + scrollY + v, behavior: ruhig ? 'auto' : 'smooth' });
}

const film = $('#film');
const buehne = $('#buehne');
const keinWebgl = () => html.classList.contains('no-webgl');

/* ================= Kapitel (p von 0 bis 1 über 800vh) ================= */
/* fokus: Bildausschnitt (x, y von oben, Bild-Koordinaten); zone: Funken-Startzone (x von, x bis, y von oben);
   hitze: Flimmermaske (x, y von oben, Radius x, Radius y); d = Desktop, m = Handy */
const KAP = [
  { a: 0, b: .08, min: 17 * 60, marke: null, still: 'feuer', d: { fokus: [.5, .5], zone: [.45, .88, .5], hitze: [.68, .4, .26, .2] }, m: { fokus: [.5, .5], zone: [.12, .9, .52], hitze: [.5, .45, .45, .2] }, feuer: 1, rate: 48, leben: 1.35, aus: .8, staub: .55, typ: null },
  { a: .08, b: .20, min: 17 * 60 + 20, marke: 'Holz', still: 'holz', d: { fokus: [.5, .58], schwenk: .08, zone: [.5, .95, .64], hitze: [.75, .6, .3, .14] }, m: { fokus: [.55, .56], schwenk: .05, zone: [.5, .95, .64], hitze: [.75, .6, .3, .14] }, feuer: 1, rate: 14, rauch: 1, staub: .8, typ: 'rauch' },
  { a: .20, b: .36, min: 17 * 60 + 40, marke: 'Feuer', folge: 'video-holz-feuer', d: { fokus: [.5, .5], zone: [.4, .85, .55], hitze: [.62, .4, .3, .2], iris: [.64, .46], kalt: 1 }, m: { fokus: [.5, .5], zone: [.2, .85, .55], hitze: [.5, .45, .4, .2], iris: [.5, .5] }, feuer: 1, rate: 40, rampe: [.12, .4], vorderRauch: 1, staub: .8, typ: 'iris' },
  { a: .36, b: .48, min: 18 * 60 + 30, marke: 'Glut', folge: 'video-glut', d: { fokus: [.5, .5], zone: [.32, .98, .62], hitze: [.66, .64, .4, .18] }, m: { fokus: [.5, .5], zone: [.1, .9, .62], hitze: [.5, .6, .45, .2] }, feuer: 1, rate: 30, rauch: 1, staub: .8, typ: 'schnitt' },
  { a: .48, b: .62, min: 19 * 60 + 30, marke: 'Pfanne', folge: 'video', d: { fokus: [.5, .5], zone: [.4, .95, .78], hitze: [.62, .56, .34, .3] }, m: { fokus: [.5, .5], zone: [.15, .85, .76], hitze: [.5, .6, .45, .25] }, feuer: 1, rate: 22, vorderRauch: 1, staub: .7, typ: 'schnitt' },
  { a: .62, b: .72, min: 20 * 60 + 30, marke: 'Karte', still: 'wand', d: { fokus: [.5, .5] }, m: { fokus: [.5, .5] }, feuer: 0, abgang: [.28, .4], belichtung: .45, mitte: .38, staub: .5, typ: 'schwarz' },
  { a: .72, b: .82, min: 21 * 60 + 30, marke: 'Tisch', folge: 'video-gastraum', d: { fokus: [.5, .5] }, m: { fokus: [.5, .5] }, feuer: 0, staub: .6, typ: 'unschaerfe' },
  { a: .82, b: .94, min: 21 * 60 + 45, marke: 'Ihr Abend', still: 'gastraum', d: { fokus: [.5, .5] }, m: { fokus: [.55, .5] }, feuer: 0, belichtung: .3, unschaerfe: 3.6, staub: .6, typ: 'unschaerfe' },
  { a: .94, b: 1, min: 24 * 60, marke: 'Ende', folge: 'video-glut', rueck: true, d: { fokus: [.5, .5], zone: [.32, .98, .62], hitze: [.66, .64, .4, .18] }, m: { fokus: [.5, .5], zone: [.1, .9, .62], hitze: [.5, .6, .45, .2] }, feuer: 1, rate: 10, rauch: 1, staub: .4, typ: 'rauch' },
];
const BLENDE = { ueber: 0, rauch: 1, iris: 2, schnitt: 3, schwarz: 4, unschaerfe: 5 };
const HALB = 0.0125; // jede Blende ist 0.025 p lang, mittig auf der Kapitelgrenze
const kapT = (i, p) => (p - KAP[i].a) / (KAP[i].b - KAP[i].a);
function kapitelBei(p) { for (let i = KAP.length - 1; i >= 0; i--) if (p >= KAP[i].a) return i; return 0; }
function lage(p) {
  for (let j = 1; j < KAP.length; j++) {
    const g = KAP[j].a;
    if (p >= g - HALB && p <= g + HALB) return { A: j - 1, B: j, m: (p - (g - HALB)) / (2 * HALB), grenze: j };
  }
  const k = kapitelBei(p);
  return { A: k, B: k, m: 0, grenze: 0 };
}
function uhrBei(p) {
  const k = kapitelBei(p);
  const bis = k < KAP.length - 1 ? KAP[k + 1].min : KAP[k].min;
  const min = Math.floor(lerp(KAP[k].min, bis, clamp(kapT(k, p))));
  return Math.floor(min / 60) + '.' + String(min % 60).padStart(2, '0');
}
const range = () => Math.max(1, film.offsetHeight - buehne.clientHeight);
const pFilm = () => clamp(-film.getBoundingClientRect().top / range());
function zuP(p) { scrollTo({ top: film.offsetTop + p * range(), behavior: ruhig ? 'auto' : 'smooth' }); }

/* ================= Kopf, Menü, Anker ================= */
(function kopfUndMenue() {
  const menue = $('[data-menue]');
  const knopf = $('[data-menue-knopf]');
  const text = $('[data-menue-text]');
  function setzen(offen) {
    menue.hidden = !offen;
    knopf.setAttribute('aria-expanded', String(offen));
    text.textContent = offen ? 'Menü schliessen' : 'Menü öffnen';
    html.classList.toggle('menue-offen', offen);
    ['main', '.hinweis', '.fuss', '.sprung'].forEach((s) => { const el = $(s); if (el) el.inert = offen; });
    if (offen) { const a = $('a', menue); if (a) a.focus(); }
  }
  knopf.addEventListener('click', () => setzen(menue.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menue.hidden) { setzen(false); knopf.focus(); } });
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const ziel = $(id);
    if (!ziel) return;
    e.preventDefault();
    if (!menue.hidden) setzen(false);
    if (id === '#film') scrollTo({ top: 0, behavior: ruhig ? 'auto' : 'smooth' });
    else scrolleZu(ziel);
    history.replaceState(null, '', id);
    if (a.classList.contains('sprung')) { ziel.setAttribute('tabindex', '-1'); ziel.focus({ preventScroll: true }); }
  }));
  const vorbeiPruefen = () => document.body.classList.toggle('vorbei', film.getBoundingClientRect().bottom < kopfHoehe() + 2);
  addEventListener('scroll', vorbeiPruefen, { passive: true });
  vorbeiPruefen();
})();

/* ================= Titelzeilen in Buchstaben ================= */
const KAPEL = $$('.kap', buehne).sort((x, y) => x.dataset.kap - y.dataset.kap);
const TITEL = KAPEL.map((kap, ki) => {
  const tz = $('.tz', kap);
  const text = tz.textContent.replace(/\s+/g, ' ').trim();
  const zeilen = $$(':scope > .z', tz);
  const quellen = zeilen.length ? zeilen : [tz];
  const L = [];
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  const r = rng(101 + ki * 17);
  quellen.forEach((q, zi) => {
    const zeile = document.createElement('span');
    if (zeilen.length) zeile.className = 'z';
    const woerter = q.textContent.trim().split(/\s+/);
    woerter.forEach((w, wi) => {
      const wort = document.createElement('span');
      wort.className = 'w';
      for (const ch of w) {
        const b = document.createElement('span');
        b.className = 'b';
        b.textContent = ch;
        wort.appendChild(b);
        L.push({ el: b, r: r(), basis: zi === 1 && ki === 0 ? FARBE.glut : FARBE.asche, funke: false, gezuendet: false, schluessel: '' });
      }
      zeile.appendChild(wort);
      if (wi < woerter.length - 1) zeile.appendChild(document.createTextNode(' '));
    });
    vis.appendChild(zeile);
    if (zeilen.length && zi < quellen.length - 1) vis.appendChild(document.createTextNode(' '));
  });
  tz.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = text;
  tz.append(sr, vis);
  // 6 bis 10 Buchstaben je Zeile lösen beim Verbrennen einen Funken
  const anzahl = Math.min(L.length, 6 + Math.floor(r() * 5));
  for (let i = 0; i < anzahl; i++) L[Math.floor((i + .5) * L.length / anzahl)].funke = true;
  return { kap, tz, ut: $('.ut', kap), L, zuletzt: '' };
});
const heroUnter = $('#hero-unter');
const scrollenEl = $('#scrollen');
let heroIntroStart = performance.now();

/* Auftritt (0 bis 1, an den Scroll oder beim Hero an die Ladezeit gekoppelt) und Abgang (Verbrennen von unten) */
function titelSetzen(T, auf, ab, beimBrennen) {
  const key = auf.toFixed(3) + '|' + ab.toFixed(3);
  if (key === T.zuletzt) return;
  T.zuletzt = key;
  T.tz.classList.toggle('frei', auf >= 1 && ab <= 0);
  T.tz.style.setProperty('--s', (Math.min(1, auf * 1.6) * (1 - smooth(.2, .9, ab))).toFixed(3));
  const n = T.L.length, D = 450 + 18 * (n - 1);
  for (let i = 0; i < n; i++) {
    const b = T.L[i];
    const li = clamp((auf * D - 18 * i) / 450);
    const e = 1 - Math.pow(1 - li, 3);
    const bi = clamp(ab * 1.45 - b.r * .45);
    let farbe = li < 1 ? mischRgb(FARBE.flamme, b.basis, smooth(.4, 1, li)) : null;
    let schatten = '';
    if (li < 1 && li > 0) schatten = `0 0 22px rgba(247,178,74,${(.55 * (1 - li)).toFixed(3)})`;
    let maske = '';
    if (bi > 0) {
      const k = -18 + bi * 136;
      maske = `linear-gradient(to top, transparent ${k.toFixed(1)}%, #000 ${(k + 16).toFixed(1)}%)`;
      farbe = mischRgb(b.basis, FARBE.glutHell, smooth(0, .35, bi));
      schatten = `0 0 14px rgba(226,85,43,${(.85 * (1 - bi)).toFixed(3)}), 0 0 3px rgba(247,178,74,${(.9 * (1 - bi)).toFixed(3)})`;
    }
    const s = `${e.toFixed(3)}|${farbe}|${schatten}|${maske}`;
    if (s !== b.schluessel) {
      b.schluessel = s;
      b.el.style.transform = e >= 1 ? 'none' : `translateY(${((1 - e) * 150).toFixed(1)}%)`;
      b.el.style.color = farbe || '';
      b.el.style.textShadow = schatten;
      b.el.style.webkitMaskImage = maske;
      b.el.style.maskImage = maske;
    }
    if (b.funke) {
      if (bi > .38 && !b.gezuendet) { b.gezuendet = true; if (beimBrennen) beimBrennen(b.el); }
      else if (bi < .1) b.gezuendet = false;
    }
  }
}

/* ================= Karte (Abschnitt): ein grosses Bild, wechselt beim Gericht ================= */
(function karte() {
  const fig = $('#karte-bild');
  const [i1, i2] = $$('img', fig);
  let vorne = i1, hinten = i2, aktuell = 'gemuese';
  const quelle = (name) => `/hebel-vorschau/v3/beispiele/fumo/bilder/${name}${schmalMq.matches ? '-klein' : ''}.webp`;
  i1.src = quelle('gemuese');
  function zeigen(name) {
    if (!name || name === aktuell) return;
    aktuell = name;
    const ziel = quelle(name);
    const tauschen = () => { hinten.src = ziel; hinten.style.opacity = '1'; vorne.style.opacity = '0'; [vorne, hinten] = [hinten, vorne]; };
    const vor = new Image(); vor.src = ziel;
    (vor.decode ? vor.decode() : Promise.resolve()).then(tauschen, tauschen);
  }
  $$('.gericht').forEach((g) => {
    const an = () => { $$('.gericht').forEach((x) => x.classList.toggle('aktiv', x === g && !!g.dataset.bild)); zeigen(g.dataset.bild); };
    g.addEventListener('mouseenter', an);
    g.addEventListener('focus', an);
    g.addEventListener('click', an);
  });
})();

/* ================= Der Abend: Glutlinien füllen sich beim Scrollen ================= */
(function abend() {
  const linien = $$('#verlauf .glutlinie');
  let laeuft = false;
  function rechnen() {
    laeuft = false;
    const mitte = innerHeight * .62;
    linien.forEach((l) => {
      const r = l.getBoundingClientRect();
      l.style.setProperty('--f', clamp((mitte - r.top) / (innerHeight * .22)).toFixed(3));
    });
  }
  addEventListener('scroll', () => { if (!laeuft) { laeuft = true; requestAnimationFrame(rechnen); } }, { passive: true });
  addEventListener('resize', rechnen);
  rechnen();
})();

/* ================= Tischwahl: gemeinsamer Zustand von Plan und Formular ================= */
const TISCHE = [
  { n: 1, x: -6.5, z: -8.0, plaetze: 2, art: 'bald' },
  { n: 2, x: -3.0, z: -8.2, plaetze: 4, art: 'besetzt', gaeste: 4 },
  { n: 3, x: 3.0, z: -8.2, plaetze: 4, art: 'besetzt', gaeste: 3 },
  { n: 4, x: 6.5, z: -8.0, plaetze: 2, art: 'bald' },
  { n: 5, x: -6.6, z: -1.6, plaetze: 6, art: 'besetzt', gaeste: 6 },
  { n: 6, x: -3.2, z: -0.6, plaetze: 4, art: 'frei' },
  { n: 7, x: 3.2, z: -0.6, plaetze: 4, art: 'besetzt', gaeste: 2 },
  { n: 8, x: 6.6, z: -1.6, plaetze: 8, art: 'besetzt', gaeste: 7 },
];
const tischText = (n) => (n ? 'Tisch ' + n + (String(n) === '6' ? ', am Feuer' : '') : 'kein Wunsch');
const wahl = { tisch: null, hoerer: [], setzen(n, quelle) { this.tisch = n ? Number(n) : null; this.hoerer.forEach((f) => f(this.tisch, quelle)); } };

/* ================= Tischplan in Kreide ================= */
let tischFunken = null; // wird von der Glut-Ebene gesetzt
(function tischplan() {
  const flaeche = $('#plan-flaeche');
  const status = $('#plan-status');
  const knopf = $('#plan-knopf');
  const r = rng(61);
  const j = (v, s = .9) => (v + (r() - .5) * s).toFixed(2);
  // Unregelmässige Kreidelinie um ein Rechteck (zwei Striche, leicht versetzt)
  const kreideRechteck = (x, y, w, h, kl) => {
    const p = (dx) => `M${j(x + dx)} ${j(y)} L${j(x + w)} ${j(y + dx * .3)} L${j(x + w - dx * .2)} ${j(y + h)} L${j(x)} ${j(y + h - dx * .2)} Z`;
    return `<path class="${kl}" d="${p(0)}"/><path class="${kl} hauch" d="${p(.8)}"/>`;
  };
  const X = (x) => x * 10, Y = (z) => z * 10;
  let svg = `<svg viewBox="-96 -106 192 132" aria-hidden="true" focusable="false">
    <defs><pattern id="schraffur" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="3" height="3" fill="rgba(226,85,43,.12)"/><line x1="0" y1="0" x2="0" y2="3" stroke="rgba(240,122,82,.75)" stroke-width="1"/></pattern></defs>`;
  // Raum mit Eingang unten
  svg += `<path class="kl" d="M${j(-6)} ${j(20)} L${j(-90)} ${j(20)} L${j(-90)} ${j(-100)} L${j(90)} ${j(-100)} L${j(90)} ${j(20)} L${j(6)} ${j(20)}"/>`;
  svg += `<path class="kl hauch" d="M${j(-5)} ${j(20.8)} L${j(-89.2)} ${j(20.6)} L${j(-89.4)} ${j(-99.2)} L${j(89.3)} ${j(-99.4)} L${j(89.2)} ${j(20.6)} L${j(5)} ${j(20.8)}"/>`;
  svg += `<text class="raumtext" x="0" y="28" text-anchor="middle">Eingang</text>`;
  // Feuerstelle in der Mitte: 4.0 x 1.6 m, Glut-Schraffur
  svg += `<rect class="herd" x="${X(-2)}" y="${Y(-4.5) - 8}" width="40" height="16"/>`;
  svg += `<text class="raumtext" x="0" y="${Y(-4.5) + 16}" text-anchor="middle">Feuer</text>`;
  const knoepfe = [];
  TISCHE.forEach((t) => {
    const lang = t.plaetze === 8;
    const w = lang ? 10 : (t.plaetze === 2 ? 11 : t.plaetze === 4 ? 15 : 22);
    const h = lang ? 30 : (t.plaetze === 2 ? 8 : 10);
    const cx = X(t.x), cy = Y(t.z);
    let g = `<g class="${t.art}" id="plan-t${t.n}">`;
    g += `<path class="tisch" d="M${j(cx - w / 2, .6)} ${j(cy - h / 2, .6)} L${j(cx + w / 2, .6)} ${j(cy - h / 2, .6)} L${j(cx + w / 2, .6)} ${j(cy + h / 2, .6)} L${j(cx - w / 2, .6)} ${j(cy + h / 2, .6)} Z"/>`;
    // Stühle als kleine Kreise
    const seiten = lang ? 4 : Math.max(1, t.plaetze / 2);
    for (let s = 0; s < seiten; s++) {
      if (lang) {
        const yy = cy - h / 2 + (s + .5) * h / seiten;
        g += `<circle class="stuhl" cx="${j(cx - w / 2 - 4, .5)}" cy="${j(yy, .5)}" r="2.2"/><circle class="stuhl" cx="${j(cx + w / 2 + 4, .5)}" cy="${j(yy, .5)}" r="2.2"/>`;
      } else {
        const xx = cx - w / 2 + (s + .5) * w / seiten;
        g += `<circle class="stuhl" cx="${j(xx, .5)}" cy="${j(cy - h / 2 - 4, .5)}" r="2.2"/><circle class="stuhl" cx="${j(xx, .5)}" cy="${j(cy + h / 2 + 4, .5)}" r="2.2"/>`;
      }
    }
    if (t.art === 'besetzt') g += `<text class="gaeste" x="${cx}" y="${cy + h / 2 + 12}" text-anchor="middle">${t.gaeste} Gäste</text>`;
    else g += `<text x="${cx}" y="${cy + 2.2}" text-anchor="middle">${t.n}</text>`;
    if (t.art === 'bald') g += `<text class="notiz" x="${cx}" y="${cy + h / 2 + 12}" text-anchor="middle">ab 21.45</text>`;
    g += '</g>';
    svg += g;
    if (t.art !== 'besetzt') knoepfe.push({ t, cx, cy, w: w + 10, h: h + 10 });
  });
  svg += '</svg>';
  flaeche.innerHTML = svg;
  // Echte Knöpfe über den freien Tischen
  knoepfe.forEach(({ t, cx, cy, w, h }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tischknopf';
    b.style.left = ((cx + 96) / 192 * 100).toFixed(2) + '%';
    b.style.top = ((cy + 106) / 132 * 100).toFixed(2) + '%';
    b.style.width = (w / 192 * 100).toFixed(2) + '%';
    b.style.height = (h / 132 * 100).toFixed(2) + '%';
    b.setAttribute('aria-label', `Tisch ${t.n} wählen, ${t.plaetze} Plätze, ${t.art === 'bald' ? 'frei ab 21.45' : 'frei'}`);
    b.setAttribute('aria-pressed', 'false');
    b.dataset.tisch = t.n;
    b.addEventListener('click', () => {
      wahl.setzen(t.n, 'plan');
      if (tischFunken) { const rr = b.getBoundingClientRect(); tischFunken(rr.left + rr.width / 2, rr.top + rr.height / 2); }
    });
    flaeche.appendChild(b);
  });
  wahl.hoerer.push((n) => {
    TISCHE.forEach((t) => {
      const g = $('#plan-t' + t.n, flaeche);
      if (t.art !== 'besetzt') g.setAttribute('class', n === t.n ? 'ihr' : t.art);
    });
    $$('.tischknopf', flaeche).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.tisch) === n)));
    status.textContent = n ? `Tisch ${n} ist für Sie vorgemerkt.` : '';
    knopf.hidden = !n;
    knopf.textContent = n ? `Tisch ${n} reservieren` : 'Tisch reservieren';
  });
  knopf.addEventListener('click', () => {
    if (!wahl.tisch) return;
    scrolleZu($('#reservieren'));
    setTimeout(() => { const s = $('#res-tisch'); if (s) s.focus({ preventScroll: true }); }, ruhig ? 50 : 900);
  });
})();

/* ================= Reservierung (Logik aus v2, plus Tisch und Funkenregen) ================= */
(function reservierung() {
  var TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var FENSTER_TAGE = 60;
  var SPEICHER = 'fumo-demo-reservierung';

  function heute0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ausIso(s) { var t = s.split('-'); return new Date(+t[0], +t[1] - 1, +t[2]); }
  function zu(d) { var w = d.getDay(); return w === 1 || w === 2; }
  function imFenster(d) { var h = heute0(); var ende = new Date(h); ende.setDate(h.getDate() + FENSTER_TAGE); return d >= h && d <= ende; }
  function langDatum(d) { return TAGE_LANG[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear(); }
  function personenText(n) { return n + (n === 1 ? ' Person' : ' Personen'); }

  function zeitenFuer(d) {
    var liste = d.getDay() === 0 ? ['12.00', '12.30', '13.00', '13.30', '14.00'] : ['18.00', '18.30', '19.00', '19.30', '20.00', '20.30', '21.00'];
    return liste;
  }
  /* Gleichbleibend "ausgebucht" je Tag und Zeit, damit die Demo echt wirkt, ohne Zufall bei jedem Laden */
  function ausgebucht(d, z) {
    var s = iso(d) + z, h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
    var w = d.getDay();
    var schwelle = (w === 5 || w === 6) && (z === '19.00' || z === '19.30' || z === '20.00') ? 560 : 260;
    return h < schwelle;
  }
  function vorbei(d, z) {
    var jetzt = new Date();
    if (iso(d) !== iso(jetzt)) return false;
    var t = z.split('.');
    var slot = new Date(d); slot.setHours(+t[0], +t[1], 0, 0);
    return slot.getTime() - jetzt.getTime() < 60 * 60 * 1000;
  }
  function freieZeiten(d) { return zeitenFuer(d).filter(function (z) { return !ausgebucht(d, z) && !vorbei(d, z); }); }
  function offeneTage(anzahl) {
    var r = [], d = heute0();
    for (var i = 0; i <= FENSTER_TAGE && r.length < anzahl; i++) {
      var t = new Date(d); t.setDate(d.getDate() + i);
      if (!zu(t) && freieZeiten(t).length) r.push(t);
    }
    return r;
  }

  var zustand = { datum: null, zeit: null, personen: 2, monat: null, tisch: null };
  var form = $('[data-res-form]');
  if (!form) return;
  // Ohne JavaScript bleibt der Knopf gesperrt, sonst gingen die Eingaben als Adresszeile an den Server
  var sendenKnopf = $('[data-res-senden]');
  if (sendenKnopf) sendenKnopf.disabled = false;
  var kalTage = $('[data-kal-tage]');
  var kalMonat = $('[data-kal-monat]');
  var kalZurueck = $('[data-kal-zurueck]');
  var kalVor = $('[data-kal-vor]');
  var zeitenBox = $('[data-zeiten]');
  var zeitenHilfe = $('[data-zeiten-hilfe]');
  var pWert = $('[data-personen-wert]');
  var pText = $('[data-personen-text]');
  var pMinus = $('[data-personen-minus]');
  var pPlus = $('[data-personen-plus]');
  var fehlerAllg = $('[data-fehler-allgemein]');
  var best = $('[data-bestaetigung]');
  var tischWahl = $('[data-tisch-wahl]');

  function kalenderZeichnen() {
    var h = heute0();
    if (!zustand.monat) zustand.monat = new Date(h.getFullYear(), h.getMonth(), 1);
    var m = zustand.monat;
    kalMonat.textContent = MONATE[m.getMonth()] + ' ' + m.getFullYear();
    kalTage.innerHTML = '';
    var erster = new Date(m.getFullYear(), m.getMonth(), 1);
    var versatz = (erster.getDay() + 6) % 7;
    for (var i = 0; i < versatz; i++) { var leer = document.createElement('span'); leer.className = 'kal__leer'; kalTage.appendChild(leer); }
    var tageImMonat = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (var t = 1; t <= tageImMonat; t++) {
      var d = new Date(m.getFullYear(), m.getMonth(), t);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kal__tag';
      b.textContent = String(t);
      b.setAttribute('data-iso', iso(d));
      var geschlossen = zu(d);
      var frei = imFenster(d) && !geschlossen && freieZeiten(d).length > 0;
      var label = langDatum(d);
      if (geschlossen) { b.classList.add('kal__tag--zu'); label += ', geschlossen'; }
      else if (imFenster(d) && !frei) label += ', ausgebucht';
      if (iso(d) === iso(h)) { b.classList.add('kal__tag--heute'); label += ', heute'; }
      b.setAttribute('aria-label', label);
      b.disabled = !frei;
      b.setAttribute('aria-pressed', String(zustand.datum === iso(d)));
      kalTage.appendChild(b);
    }
    var minMonat = new Date(h.getFullYear(), h.getMonth(), 1);
    var ende = new Date(h); ende.setDate(h.getDate() + FENSTER_TAGE);
    var maxMonat = new Date(ende.getFullYear(), ende.getMonth(), 1);
    kalZurueck.disabled = m <= minMonat;
    kalVor.disabled = m >= maxMonat;
  }
  kalTage.addEventListener('click', function (e) {
    var b = e.target.closest('.kal__tag');
    if (!b || b.disabled) return;
    tagWaehlen(b.getAttribute('data-iso'));
  });
  kalZurueck.addEventListener('click', function () { zustand.monat = new Date(zustand.monat.getFullYear(), zustand.monat.getMonth() - 1, 1); kalenderZeichnen(); });
  kalVor.addEventListener('click', function () { zustand.monat = new Date(zustand.monat.getFullYear(), zustand.monat.getMonth() + 1, 1); kalenderZeichnen(); });

  function tagWaehlen(isoTag, wunschZeit) {
    zustand.datum = isoTag;
    var d = ausIso(isoTag);
    zustand.monat = new Date(d.getFullYear(), d.getMonth(), 1);
    var frei = freieZeiten(d);
    var hinweis = '';
    if (wunschZeit && frei.indexOf(wunschZeit) !== -1) zustand.zeit = wunschZeit;
    else if (wunschZeit) { zustand.zeit = null; hinweis = 'Um ' + wunschZeit + ' Uhr ist es an diesem Tag voll. Bitte wählen Sie eine andere Zeit.'; }
    else if (zustand.zeit && frei.indexOf(zustand.zeit) === -1) zustand.zeit = null;
    kalenderZeichnen();
    zeitenZeichnen(hinweis);
    belegAktualisieren();
  }

  function zeitenZeichnen(hinweis) {
    zeitenBox.innerHTML = '';
    if (!zustand.datum) {
      zeitenHilfe.textContent = 'Wählen Sie zuerst einen Tag im Kalender.';
      return;
    }
    var d = ausIso(zustand.datum);
    zeitenHilfe.textContent = hinweis || ('Freie Zeiten am ' + langDatum(d) + (d.getDay() === 0 ? ', Mittag am Feuer.' : '.'));
    zeitenFuer(d).forEach(function (z) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zeit-k';
      b.textContent = z;
      var weg = ausgebucht(d, z) || vorbei(d, z);
      b.disabled = weg;
      b.setAttribute('aria-label', z + ' Uhr' + (weg ? ', nicht mehr frei' : ''));
      b.setAttribute('aria-pressed', String(zustand.zeit === z));
      b.setAttribute('data-zeit', z);
      zeitenBox.appendChild(b);
    });
  }
  zeitenBox.addEventListener('click', function (e) {
    var b = e.target.closest('.zeit-k');
    if (!b || b.disabled) return;
    zustand.zeit = b.getAttribute('data-zeit');
    $$('.zeit-k', zeitenBox).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    var d = ausIso(zustand.datum);
    zeitenHilfe.textContent = 'Freie Zeiten am ' + langDatum(d) + (d.getDay() === 0 ? ', Mittag am Feuer.' : '.');
    fehlerAllg.textContent = '';
    belegAktualisieren();
  });

  function personenSetzen(n) {
    zustand.personen = Math.max(1, Math.min(8, n));
    pWert.textContent = String(zustand.personen);
    pText.textContent = zustand.personen === 1 ? 'Person' : (zustand.personen === 8 ? 'Personen, für mehr schreiben Sie uns einen Wunsch' : 'Personen');
    pMinus.disabled = zustand.personen <= 1;
    pPlus.disabled = zustand.personen >= 8;
    belegAktualisieren();
  }
  pMinus.addEventListener('click', function () { personenSetzen(zustand.personen - 1); });
  pPlus.addEventListener('click', function () { personenSetzen(zustand.personen + 1); });

  // Neu: Tisch aus dem Tischplan im Film, änderbar über die Auswahl
  tischWahl.addEventListener('change', function () { wahl.setzen(tischWahl.value || null, 'formular'); });
  wahl.hoerer.push(function (n) {
    zustand.tisch = n ? String(n) : null;
    tischWahl.value = zustand.tisch || '';
    belegAktualisieren();
  });

  function belegAktualisieren() {
    var tag = $('[data-beleg-tag]'), zeit = $('[data-beleg-zeit]'), pers = $('[data-beleg-personen]'), tisch = $('[data-beleg-tisch]');
    tag.textContent = zustand.datum ? langDatum(ausIso(zustand.datum)) : 'noch offen';
    tag.classList.toggle('ist-offen', !zustand.datum);
    zeit.textContent = zustand.zeit ? zustand.zeit + ' Uhr' : 'noch offen';
    zeit.classList.toggle('ist-offen', !zustand.zeit);
    pers.textContent = personenText(zustand.personen);
    tisch.textContent = tischText(zustand.tisch);
    tisch.classList.toggle('ist-offen', !zustand.tisch);
  }

  function fehler(id, text) {
    var feld = document.getElementById(id);
    var ziel = $('[data-fehler-fuer="' + id + '"]');
    ziel.textContent = text || '';
    if (text) feld.setAttribute('aria-invalid', 'true'); else feld.removeAttribute('aria-invalid');
    return !text;
  }
  ['res-name', 'res-telefon'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () { fehler(id, ''); });
  });

  function lesen() { try { return JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch (e) { return null; } }
  function schreiben(o) { try { localStorage.setItem(SPEICHER, JSON.stringify(o)); return true; } catch (e) { return false; } }
  function loeschen() { try { localStorage.removeItem(SPEICHER); } catch (e) { /* privat */ } }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#res-name').value.trim();
    var tel = $('#res-telefon').value.trim();
    var wunsch = $('#res-wunsch').value.trim();
    var ok = true, erstesFeld = null;
    fehlerAllg.textContent = '';
    if (!zustand.datum || !zustand.zeit) {
      fehlerAllg.textContent = !zustand.datum ? 'Bitte wählen Sie zuerst einen Tag im Kalender.' : 'Bitte wählen Sie eine Uhrzeit.';
      ok = false;
    }
    if (name.length < 2) { fehler('res-name', 'Bitte geben Sie Ihren Namen an.'); ok = false; erstesFeld = erstesFeld || 'res-name'; } else fehler('res-name', '');
    var ziffern = tel.replace(/\D/g, '');
    if (!tel) { fehler('res-telefon', 'Bitte geben Sie eine Telefonnummer an, unter der wir Sie erreichen.'); ok = false; erstesFeld = erstesFeld || 'res-telefon'; }
    else if (ziffern.length < 9 || /[^\d\s+()\/.-]/.test(tel)) { fehler('res-telefon', 'Diese Nummer sieht unvollständig aus. Bitte mit Vorwahl, im Format 044 000 00 00.'); ok = false; erstesFeld = erstesFeld || 'res-telefon'; }
    else fehler('res-telefon', '');
    if (!ok) {
      if (!zustand.datum || !zustand.zeit) { scrolleZu(zustand.datum ? zeitenBox : $('[data-kal]'), -110); }
      else if (erstesFeld) document.getElementById(erstesFeld).focus();
      return;
    }
    var zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', nummer = 'FU-';
    for (var i = 0; i < 5; i++) nummer += zeichen[Math.floor(Math.random() * zeichen.length)];
    var res = { datum: zustand.datum, zeit: zustand.zeit, personen: zustand.personen, tisch: zustand.tisch, name: name, telefon: tel, wunsch: wunsch, nummer: nummer, angelegt: new Date().toISOString(), demo: true };
    schreiben(res);
    sendenKnopf.disabled = true;
    funkenregen(sendenKnopf, form, function () { sendenKnopf.disabled = false; bestaetigungZeigen(res); });
  });

  function bestaetigungZeigen(res) {
    $('[data-best-name]').textContent = res.name;
    $('[data-best-tag]').textContent = langDatum(ausIso(res.datum));
    $('[data-best-zeit]').textContent = res.zeit + ' Uhr';
    $('[data-best-personen]').textContent = personenText(res.personen);
    $('[data-best-tisch]').textContent = tischText(res.tisch);
    $('[data-best-telefon]').textContent = res.telefon;
    $('[data-best-wunsch]').textContent = res.wunsch;
    $('[data-best-wunsch-zeile]').hidden = !res.wunsch;
    $('[data-best-nummer]').textContent = res.nummer + ' (Demo)';
    form.hidden = true;
    best.hidden = false;
    springeZu(best, 130);
    best.focus({ preventScroll: true });
  }
  function springeZu(el, abstand) {
    var y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - abstand);
    window.scrollTo(0, y);
  }

  $('[data-res-neu]').addEventListener('click', function () {
    best.hidden = true;
    form.hidden = false;
    zustand.zeit = null;
    if (zustand.datum) zeitenZeichnen();
    belegAktualisieren();
    springeZu($('[data-kal]'), 140);
    var erste = $('.kal__tag[aria-pressed="true"]') || $('.kal__tag:not([disabled])');
    if (erste) erste.focus({ preventScroll: true });
  });
  $('[data-res-loeschen]').addEventListener('click', function () {
    loeschen();
    $('#res-name').value = '';
    $('#res-telefon').value = '';
    $('#res-wunsch').value = '';
    best.hidden = true;
    form.hidden = false;
    zustand.zeit = null;
    zeitenZeichnen();
    belegAktualisieren();
    fehlerAllg.textContent = '';
    springeZu($('.res__angaben'), 140);
    $('#res-name').focus({ preventScroll: true });
  });

  /* Start: frühester freier Tag vorgewählt, gespeicherte Angaben zurück */
  var alt = lesen();
  if (alt) {
    if (alt.name) $('#res-name').value = alt.name;
    if (alt.telefon) $('#res-telefon').value = alt.telefon;
  }
  var tage = offeneTage(24);
  if (tage.length) tagWaehlen(iso(tage[0])); else { kalenderZeichnen(); zeitenZeichnen(); }
  personenSetzen(2);
})();

/* Bestätigung mit Funkenregen: 140 Funken aus dem Knopf über den ganzen Bildschirm, 1.8 s; ruhig nur ein warmes Aufleuchten */
function funkenregen(knopf, rahmen, fertig) {
  if (ruhig) {
    rahmen.classList.add('leuchtet');
    setTimeout(() => { rahmen.classList.remove('leuchtet'); fertig(); }, 650);
    return;
  }
  const c = $('#funkenregen');
  const pr = Math.min(devicePixelRatio || 1, 1.5);
  c.width = Math.round(innerWidth * pr); c.height = Math.round(innerHeight * pr);
  const x = c.getContext('2d');
  const kr = knopf.getBoundingClientRect();
  const ox = kr.left + kr.width / 2, oy = kr.top + kr.height / 2;
  const F = [];
  for (let i = 0; i < 140; i++) {
    const w = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const v = 420 + Math.random() * 900;
    F.push({ x: ox + (Math.random() - 0.5) * kr.width * 0.8, y: oy, vx: Math.cos(w) * v * 0.75, vy: Math.sin(w) * v, r: 1.2 + Math.random() * 2.2, farbe: Math.random() < 0.55 ? '247,178,74' : '226,85,43', ph: Math.random() * 6 });
  }
  const start = performance.now();
  let zuletzt = start;
  function schritt(jetzt) {
    const dt = Math.min(0.05, (jetzt - zuletzt) / 1000); zuletzt = jetzt;
    const t = (jetzt - start) / 1000;
    x.setTransform(pr, 0, 0, pr, 0, 0);
    x.clearRect(0, 0, innerWidth, innerHeight);
    x.globalCompositeOperation = 'lighter';
    for (const f of F) {
      f.vy -= 60 * dt; // Schwerkraft leicht negativ: die Funken steigen weiter
      f.vx *= 1 - 0.9 * dt; f.vy *= 1 - 0.6 * dt;
      f.x += (f.vx + Math.sin(t * 6 + f.ph) * 30) * dt; f.y += f.vy * dt;
      const a = clamp(1 - t / 1.8) * (0.6 + 0.4 * Math.sin(t * 25 + f.ph));
      x.strokeStyle = `rgba(${f.farbe},${a.toFixed(3)})`;
      x.lineWidth = f.r; x.lineCap = 'round';
      x.beginPath(); x.moveTo(f.x, f.y); x.lineTo(f.x - f.vx * 0.025, f.y - f.vy * 0.025); x.stroke();
    }
    if (t < 1.8) requestAnimationFrame(schritt);
    else { x.clearRect(0, 0, innerWidth, innerHeight); c.width = 1; c.height = 1; fertig(); }
  }
  requestAnimationFrame(schritt);
}

/* ================= Zeitleiste ================= */
const uhrEl = $('#uhr');
const spur = $('#spur');
const marker = $('#marker');
const zeitleiste = $('#zeitleiste');
const MARKEN = KAP.map((k, i) => {
  if (!k.marke) return null;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'marke';
  b.style.left = (k.a * 100) + '%';
  const uhr = Math.floor(k.min / 60) + '.' + String(k.min % 60).padStart(2, '0');
  b.setAttribute('aria-label', `Zu ${uhr} Uhr springen, ${k.marke}`);
  b.innerHTML = `<span>${uhr} ${k.marke}</span>`;
  b.addEventListener('click', () => zuP(k.a + (k.b - k.a) * .3));
  spur.appendChild(b);
  return b;
});

/* ================= Kreidekarte (Canvas 2D, Caveat, schreibt sich am Scroll) ================= */
const KREIDE_ZEILEN = [
  { art: 'kopf', text: 'Heute am Feuer' },
  { art: 'gruppe', text: 'Aus der Glut' },
  { art: 'gericht', text: 'Gemüse vom Feuer', preis: '22', bild: 'gemuese' },
  { art: 'gericht', text: 'Lauch aus der Glut', preis: '19', bild: 'lauch' },
  { art: 'gericht', text: 'Brot aus dem Holzofen', preis: '9' },
  { art: 'linie' },
  { art: 'gruppe', text: 'Vom Rost' },
  { art: 'gericht', text: 'Felchen aus der Pfanne', preis: '42', bild: 'felchen' },
  { art: 'gericht', text: 'Rinderrippe, sechs Stunden', preis: '58', bild: 'rippe' },
  { art: 'linie' },
  { art: 'gruppe', text: 'Zum Schluss' },
  { art: 'gericht', text: 'Apfel aus der Glut', preis: '16', bild: 'apfel' },
  { art: 'linie' },
  { art: 'gericht', text: 'Am Feuer, das ganze Menü', preis: '96', menue: true },
];
const kreide = (function () {
  const huelle = $('#kreide');
  const cv = $('#kreide-flaeche');
  const kreis = $('#kreis');
  const [k1, k2] = $$('img', kreis);
  let vorne = k1, hinten = k2, bildJetzt = 'gemuese';
  let voll = null, baender = [], gesamt = 1, bereit = false, letzteW = -1;
  const korn = document.createElement('canvas');
  korn.width = korn.height = 128;
  (function () {
    const x = korn.getContext('2d'), d = x.createImageData(128, 128), r = rng(7);
    for (let i = 0; i < d.data.length; i += 4) { const v = r(); d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = Math.round(Math.pow(v, 3) * 210); }
    x.putImageData(d, 0, 0);
  })();
  function bauen() {
    const breite = huelle.clientWidth;
    if (!breite) return;
    const mobil = schmalMq.matches;
    const g = mobil ? { kopf: 30, gruppe: 18, gericht: 19.5, abstand: 1.42 } : { kopf: Math.max(34, breite * .075), gruppe: Math.max(20, breite * .04), gericht: Math.max(21, breite * .044), abstand: 1.45 };
    const pr = Math.min(devicePixelRatio || 1, 2);
    const rechtsFrei = mobil ? 96 : 0; // Platz für das Gerichtsbild am Handy (nur in der Kopfzeile)
    // Höhe vorab berechnen
    let y = 0;
    const plan = KREIDE_ZEILEN.map((z) => {
      const gr = z.art === 'kopf' ? g.kopf : z.art === 'gruppe' ? g.gruppe : z.art === 'linie' ? 0 : g.gericht;
      const h = z.art === 'linie' ? gr + 14 : gr * (z.art === 'gruppe' ? 1.7 : g.abstand);
      const o = { z, y0: y, h, gr };
      y += h;
      return o;
    });
    const hoehe = Math.ceil(y + 8);
    voll = document.createElement('canvas');
    voll.width = Math.round(breite * pr); voll.height = Math.round(hoehe * pr);
    const x = voll.getContext('2d');
    x.scale(pr, pr);
    x.fillStyle = 'rgba(237,231,223,.92)';
    x.strokeStyle = 'rgba(237,231,223,.7)';
    x.textBaseline = 'alphabetic';
    const r = rng(19);
    baender = [];
    plan.forEach(({ z, y0, h, gr }) => {
      let x0 = 0, laenge = breite;
      const grund = y0 + h * .72;
      if (z.art === 'kopf') {
        x.font = `700 ${gr}px Caveat`;
        x.fillText(z.text, 0, grund);
        laenge = Math.min(breite - rechtsFrei, x.measureText(z.text).width + 6);
      } else if (z.art === 'gruppe') {
        x.font = `400 ${gr}px Caveat`;
        x.globalAlpha = .72;
        x.fillText(z.text, 0, grund + gr * .2);
        x.globalAlpha = 1;
        laenge = x.measureText(z.text).width + 6;
      } else if (z.art === 'linie') {
        x.lineWidth = 1.6;
        x.beginPath();
        const ly = y0 + h / 2;
        x.moveTo(0, ly + (r() - .5) * 2);
        for (let s = 1; s <= 12; s++) x.lineTo(breite * .62 * s / 12, ly + (r() - .5) * 2.4);
        x.stroke();
        laenge = breite * .62;
      } else {
        x0 = mobil ? 0 : gr * .7;
        x.font = `${z.menue ? 700 : 400} ${gr}px Caveat`;
        x.fillText(z.text, x0, grund);
        const tw = x.measureText(z.text).width;
        const pw = x.measureText(z.preis).width;
        x.fillText(z.preis, breite - pw - 2, grund);
        // Punkte zum Preis
        const von = x0 + tw + 10, bis = breite - pw - 12;
        for (let px = von; px < bis; px += gr * .32) { x.beginPath(); x.arc(px, grund - 2 + (r() - .5), 1.05, 0, 6.283); x.fill(); }
        laenge = breite - x0;
      }
      baender.push({ y0, h, x0, laenge, bild: z.bild || null });
    });
    // Kreidekorn: Fehlstellen ausstanzen
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = x.createPattern(korn, 'repeat');
    x.fillRect(0, 0, voll.width, voll.height);
    x.globalCompositeOperation = 'source-over';
    gesamt = baender.reduce((s, b) => s + b.laenge, 0);
    cv.width = voll.width; cv.height = voll.height;
    cv.style.aspectRatio = `${breite} / ${hoehe}`;
    bereit = true;
    letzteW = -1;
  }
  function zeigeBild(name) {
    if (!name || name === bildJetzt) return;
    bildJetzt = name;
    const ziel = `/hebel-vorschau/v3/beispiele/fumo/bilder/${name}-klein.webp`;
    const tauschen = () => { hinten.src = ziel; hinten.style.opacity = '1'; vorne.style.opacity = '0'; [vorne, hinten] = [hinten, vorne]; };
    const v = new Image(); v.src = ziel;
    (v.decode ? v.decode() : Promise.resolve()).then(tauschen, tauschen);
  }
  function setzen(w, sicht) {
    huelle.style.opacity = sicht.toFixed(3);
    kreis.style.opacity = (sicht * smooth(.02, .12, w)).toFixed(3);
    if (!bereit || sicht <= 0) return;
    if (Math.abs(w - letzteW) < .0005) return;
    letzteW = w;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    const pr = cv.width / huelle.clientWidth;
    let rest = w * gesamt, bild = null;
    for (const b of baender) {
      if (rest <= 0) break;
      const sichtbar = Math.min(b.laenge, rest);
      rest -= b.laenge;
      const sx = 0, sw = Math.ceil((b.x0 + sichtbar) * pr), sy = Math.floor(b.y0 * pr), sh = Math.ceil(b.h * pr);
      if (sw > 0) x.drawImage(voll, sx, sy, sw, sh, sx, sy, sw, sh);
      if (b.bild) bild = b.bild;
    }
    zeigeBild(bild || 'gemuese');
  }
  return { bauen, setzen };
})();

/* ================= Bildfolgen: Laden in Stufen, nächstgelegenes geladenes Bild ================= */
const STILL_URL = {
  feuer: '/hebel-vorschau/v3/beispiele/fumo/bilder/feuer.webp', feuerHoch: '/hebel-vorschau/v3/beispiele/fumo/bilder/feuer-hoch.webp',
  holz: '/hebel-vorschau/v3/beispiele/fumo/bilder/holz.webp', wand: '/hebel-vorschau/v3/beispiele/fumo/bilder/wand.webp', gastraum: '/hebel-vorschau/v3/beispiele/fumo/bilder/gastraum.webp',
};
const ERSATZ_STILL = { 'video-holz-feuer': 'feuer', 'video-glut': 'holz', video: 'feuer', 'video-gastraum': 'gastraum' };
const stills = {};
let neuesBild = true; // erzwingt ein Bild im ruhigen Modus
function stillLaden(name) {
  if (stills[name]) return stills[name].p;
  const img = new Image();
  img.decoding = 'async';
  img.src = STILL_URL[name];
  const eintrag = { img, ok: false };
  eintrag.p = img.decode().then(() => { eintrag.ok = true; neuesBild = true; }, () => {});
  stills[name] = eintrag;
  return eintrag.p;
}
const FOLGEN = {};
let mobilModus = istMobil();
['video-holz-feuer', 'video-glut', 'video', 'video-gastraum'].forEach((name) => {
  FOLGEN[name] = { name, meta: null, n: 0, bilder: [], stand: [], ordnung: [], kaps: KAP.map((k, i) => (k.folge === name ? i : -1)).filter((i) => i >= 0) };
});
function folgeEinrichten(f) {
  const s = f.meta[mobilModus ? 'mobil' : 'desktop'] || f.meta.desktop;
  f.satz = s; f.n = s.anzahl; f.gen = (f.gen || 0) + 1;
  f.bilder = new Array(f.n).fill(null);
  f.stand = new Array(f.n).fill(0);
  const a = [], b = [], c = [];
  for (let i = 0; i < f.n; i++) (i % 8 === 0 || i === f.n - 1 ? a : i % 2 === 0 ? b : c).push(i);
  f.ordnung = a.concat(b, c);
}
const metaFertig = Promise.all(Object.values(FOLGEN).map((f) => fetch(`/hebel-vorschau/v3/beispiele/fumo/${f.name}/meta.json`).then((r) => r.json()).then((m) => { f.meta = m; folgeEinrichten(f); }).catch(() => { f.meta = null; })));
const bildUrl = (f, i) => `/hebel-vorschau/v3/beispiele/fumo/${f.name}/${f.satz.praefix}${String(i + 1).padStart(4, '0')}${f.satz.endung}`;
function folgenAbstand(f, p) { // in p; 1 Bildschirmhöhe = 1/8 p
  let d = 9;
  f.kaps.forEach((i) => { const k = KAP[i]; d = Math.min(d, p < k.a ? k.a - p : p > k.b ? p - k.b : 0); });
  return d;
}
let laufend = 0;
function pumpe(p) {
  if (keinWebgl()) return;
  const liste = Object.values(FOLGEN).filter((f) => f.meta && folgenAbstand(f, p) < 1.2 / 8).sort((x, y) => folgenAbstand(x, p) - folgenAbstand(y, p));
  for (const f of liste) {
    // höchstens zwei Folgen im Speicher: die entfernteste andere freigeben
    if (!f.stand.some((s) => s)) {
      const belegt = Object.values(FOLGEN).filter((g) => g !== f && g.stand.some((s) => s));
      if (belegt.length >= 2) {
        belegt.sort((x, y) => folgenAbstand(y, p) - folgenAbstand(x, p));
        if (folgenAbstand(belegt[0], p) >= 1.2 / 8) folgeEinrichten(belegt[0]); else continue;
      }
    }
    for (const i of f.ordnung) {
      if (laufend >= 6) return;
      if (f.stand[i]) continue;
      f.stand[i] = 1;
      laufend++;
      const img = new Image();
      img.decoding = 'async';
      const gen = f.gen;
      img.src = bildUrl(f, i);
      img.decode().then(() => { if (f.gen === gen) { f.bilder[i] = img; f.stand[i] = 2; neuesBild = true; } }, () => { if (f.gen === gen) f.stand[i] = 3; })
        .finally(() => { laufend--; });
    }
  }
}
function folgenBild(f, i) {
  if (!f.meta || !f.n) return null;
  i = clamp(i, 0, f.n - 1);
  for (let d = 0; d < f.n; d++) {
    if (i - d >= 0 && f.bilder[i - d]) return f.bilder[i - d];
    if (i + d < f.n && f.bilder[i + d]) return f.bilder[i + d];
  }
  return null;
}
function bildFuer(ki, t) {
  const k = KAP[ki];
  if (k.still) {
    const name = k.still === 'feuer' && mobilModus ? 'feuerHoch' : k.still;
    const s = stills[name];
    return s && s.ok ? s.img : null;
  }
  const f = FOLGEN[k.folge];
  const tt = k.rueck ? 1 - t : t;
  const img = f.n ? folgenBild(f, Math.round(tt * (f.n - 1))) : null;
  if (img) return img;
  const e = stills[ERSATZ_STILL[k.folge]];
  return e && e.ok ? e.img : null;
}

/* ================= Leinwand: WebGL2, ein Renderer, zwei Durchgänge ================= */
const bildCanvas = $('#bild');
const glutCanvas = $('#glut');
const rahmenlinie = $('#rahmenlinie');
let renderer = null;
if (!keinWebgl()) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: bildCanvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) throw new Error('kein WebGL2');
  } catch (e) {
    renderer = null;
    html.classList.add('no-webgl');
  }
}
if (keinWebgl()) {
  $$('[data-ersatz]').forEach((img) => { img.src = img.dataset.ersatz; });
  $$('.tz .b').forEach((b) => { b.style.transform = 'none'; });
  $('#plan').inert = false;
}

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = `
uniform sampler2D uA; uniform sampler2D uB; uniform sampler2D uKorn;
uniform vec4 uCropA; uniform vec4 uCropB;
uniform vec3 uLookA; uniform vec3 uLookB;
uniform vec2 uTexA; uniform vec2 uTexB;
uniform float uMix; uniform float uTyp;
uniform vec2 uRes; uniform float uDpr;
uniform vec2 uIris; uniform float uIrisMax; uniform vec2 uLicht;
uniform float uFlash;
uniform vec4 uHeat; uniform float uHeatAmt; uniform float uZeit;
uniform vec2 uKornOff; uniform float uKornAmt;
uniform vec2 uKalt;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
vec3 probe(sampler2D t, vec2 uv, vec2 tsz, float lod){
  if (lod < 0.05) return texture2D(t, uv).rgb;
  vec2 o = exp2(lod) * 0.8 / tsz;
  vec3 c = textureLod(t, uv, lod).rgb * 0.28;
  c += textureLod(t, uv + vec2( o.x,  o.y), lod).rgb * 0.18;
  c += textureLod(t, uv + vec2(-o.x,  o.y), lod).rgb * 0.18;
  c += textureLod(t, uv + vec2( o.x, -o.y), lod).rgb * 0.18;
  c += textureLod(t, uv + vec2(-o.x, -o.y), lod).rgb * 0.18;
  return c;
}
vec3 bild(sampler2D t, vec4 crop, vec2 tsz, vec3 look, vec2 suv, vec2 versatz, float kalt){
  vec2 uv = clamp(crop.xy + (suv - 0.5) * crop.zw + versatz, vec2(0.0005), vec2(0.9995));
  vec3 c = probe(t, uv, tsz, look.y) * look.x;
  if (kalt > 0.0) {
    // Die KI-Folge Holz zu Feuer hat in ihrer Mitte einen hellen, bläulichen Rauch links neben dem Feuer.
    // Dort werden mittelhelle, ungesättigte Bildteile zu einem dunklen, warmen Hauch (Rauchfarbe #3B342F).
    // Maske nur aus Ort, Helligkeit und weich gerampter Sättigung, damit die Farbblöcke der WebP-Bilder
    // keine Kanten erzeugen. Flammen, Glut und Holz rechts davon bleiben unberührt.
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    float m = (1.0 - smoothstep(0.33, 0.44, uv.x)) * smoothstep(0.04, 0.16, l) * (1.0 - smoothstep(0.15, 0.35, c.r - c.b)) * kalt;
    c = mix(c, vec3(0.231, 0.204, 0.184) * (0.3 + l * 0.5), m);
  }
  if (look.z > 0.0) c *= 1.0 + look.z * (1.0 - smoothstep(0.0, 0.8, length((suv - 0.5) * vec2(uRes.x / uRes.y, 1.0))));
  return c;
}
void main(){
  vec2 suv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 versatz = vec2(0.0);
  if (uHeatAmt > 0.0) {
    vec2 iuv = uCropA.xy + (suv - 0.5) * uCropA.zw;
    float maske = 1.0 - smoothstep(0.25, 1.0, length((iuv - uHeat.xy) / uHeat.zw));
    vec2 q = suv * asp;
    float n1 = noise(q * 9.0 + vec2(0.0, -uZeit * 2.2)) + 0.5 * noise(q * 23.0 + vec2(1.7, -uZeit * 3.9));
    float n2 = noise(q * 11.0 + vec2(4.3, -uZeit * 2.6)) + 0.5 * noise(q * 27.0 + vec2(8.1, -uZeit * 4.4));
    versatz = (vec2(n1, n2) / 1.5 - 0.5) * 2.0 * uHeatAmt * maske * uCropA.zw;
  }
  vec3 a = bild(uA, uCropA, uTexA, uLookA, suv, versatz, uKalt.x);
  vec3 col = a;
  if (uMix > 0.0001) {
    vec3 b = bild(uB, uCropB, uTexB, uLookB, suv, vec2(0.0), uKalt.y);
    vec2 px = gl_FragCoord.xy;
    if (uTyp < 0.5) {
      col = mix(a, b, uMix);
    } else if (uTyp < 1.5) {
      vec2 q = suv * asp * 2.4;
      float n = fbm(q + vec2(0.0, -uMix * 0.9)) * 0.78 + (1.0 - suv.y) * 0.22;
      float k = smoothstep(n - 0.08, n + 0.08, uMix * 1.3 - 0.12);
      col = mix(a, b, k);
      float saum = 1.0 - abs(k * 2.0 - 1.0);
      col = mix(col, vec3(0.31, 0.28, 0.26) * (0.55 + 0.7 * fbm(q * 2.3 + 3.0)), saum * 0.7);
    } else if (uTyp < 2.5) {
      float d = distance(px, uIris);
      float r = uMix * uIrisMax;
      float s = 18.0 * uDpr;
      float innen = 1.0 - smoothstep(r - 1.5, r + 1.5, d);
      col = mix(a, b, innen);
      float an = smoothstep(0.0, 0.03, uMix) * (1.0 - smoothstep(0.97, 1.0, uMix));
      float ring = smoothstep(r - 1.5, r + 1.0, d) * (1.0 - smoothstep(r + s - 2.0, r + s, d));
      vec3 rc = mix(vec3(0.969, 0.698, 0.290), vec3(0.886, 0.333, 0.169), clamp((d - r) / s, 0.0, 1.0));
      col = mix(col, rc, ring * 0.5 * an);
      col += vec3(0.886, 0.333, 0.169) * exp(-max(d - r - s, 0.0) / (s * 2.5)) * (1.0 - innen) * 0.18 * an;
    } else if (uTyp < 3.5) {
      col = uMix < 0.5 ? a : b;
    } else if (uTyp < 4.5) {
      float f = uMix < 0.5 ? 1.0 - uMix * 2.0 : uMix * 2.0 - 1.0;
      col = (uMix < 0.5 ? a : b) * f * f;
      vec2 dd = (px - uLicht) / uDpr;
      float amp = max(0.0, 1.0 - abs(uMix - 0.5) * 5.0);
      col += vec3(1.0, 0.72, 0.40) * (exp(-dot(dd, dd) / 700.0) * 1.4 + exp(-length(dd) / 240.0) * 0.2) * amp;
    } else {
      col = mix(a, b, smoothstep(0.25, 0.75, uMix));
    }
  }
  float v = length(suv - 0.5) * 1.4142;
  col *= 1.0 - 0.35 * smoothstep(0.35, 1.0, v);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(0.102, 0.059, 0.039), 0.15 * (1.0 - smoothstep(0.0, 0.5, l)));
  col = mix(col, vec3(1.0, 0.851, 0.659), 0.15 * smoothstep(0.5, 1.0, l));
  float g = texture2D(uKorn, gl_FragCoord.xy / (112.0 * uDpr) + uKornOff).r;
  vec3 ov = mix(2.0 * col * g, 1.0 - 2.0 * (1.0 - col) * (1.0 - g), step(0.5, col));
  col = mix(col, ov, uKornAmt);
  col = mix(col, vec3(1.0, 0.851, 0.659), uFlash * 0.3);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const FUNKEN_VERT = `
attribute float aGroesse; attribute vec4 aFarbe; attribute vec3 aForm; attribute float aWeich;
uniform float uDpr;
varying vec4 vFarbe; varying vec3 vForm; varying float vWeich;
void main(){
  vFarbe = aFarbe; vForm = aForm; vWeich = aWeich;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aFarbe.a > 0.002 ? aGroesse * uDpr * max(1.0, aForm.z) * (1.0 + aWeich * 1.5) : 0.0;
}`;
const FUNKEN_FRAG = `
varying vec4 vFarbe; varying vec3 vForm; varying float vWeich;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0; c.y = -c.y;
  vec2 d = normalize(vForm.xy + vec2(0.0, 1e-4)); vec2 n = vec2(-d.y, d.x);
  float s = max(1.0, vForm.z), halo = 1.0 + vWeich * 1.5;
  vec2 q = vec2(dot(c, d) * halo, dot(c, n) * s * halo);
  float r = length(q);
  float kern = 1.0 - smoothstep(0.3 - vWeich * 0.28, 1.0, r);
  float a = vFarbe.a * kern * kern;
  if (a < 0.002) discard;
  vec3 col = mix(vFarbe.rgb, vec3(1.0, 0.95, 0.82), (1.0 - smoothstep(0.0, 0.45, r)) * 0.55 * (1.0 - vWeich));
  gl_FragColor = vec4(col * a, a);
}`;
const RAUCH_VERT = `
attribute float aGroesse; attribute float aAlpha; attribute float aSaat;
uniform float uDpr;
varying float vAlpha; varying float vSaat;
void main(){
  vAlpha = aAlpha; vSaat = aSaat;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aAlpha > 0.002 ? aGroesse * uDpr : 0.0;
}`;
const RAUCH_FRAG = `
varying float vAlpha; varying float vSaat;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0) discard;
  float n = noise(c * 2.6 + vSaat * 13.0) * 0.6 + noise(c * 5.3 - vSaat * 7.0) * 0.4;
  float a = vAlpha * pow(1.0 - r, 1.5) * (0.45 + 0.75 * n);
  gl_FragColor = vec4(vec3(0.231, 0.204, 0.184) * a, a);
}`;

const FUNKEN_MAX = 140;
const STAUB_LAGEN = [36, 22, 10];
const STAUB_MAX = STAUB_LAGEN.reduce((a, b) => a + b, 0);
const RAUCH_MAX = 24;
const PARALLAX = [6, 14, 28];

let W = 1, H = 1, DPR = 1;
let bildMat, bildSzene, glutSzene, kamera, glutKamera, funkenGeo, rauchGeo, glutCtx;
const texCache = new Map(); // Bild -> Textur, höchstens 8 auf der Grafikkarte
let leerTex, kornTex;
function texFuer(img) {
  if (!img) return leerTex;
  let t = texCache.get(img);
  if (t) { texCache.delete(img); texCache.set(img, t); return t; }
  t = new THREE.Texture(img);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  texCache.set(img, t);
  while (texCache.size > 8) { const [k, alt] = texCache.entries().next().value; alt.dispose(); texCache.delete(k); }
  return t;
}

/* Partikel (CPU), Bildschirm-Koordinaten in CSS-Pixeln, y nach unten */
const F = { aus: new Float32Array(FUNKEN_MAX), x: new Float32Array(FUNKEN_MAX), bx: new Float32Array(FUNKEN_MAX), y: new Float32Array(FUNKEN_MAX), vx: new Float32Array(FUNKEN_MAX), vy: new Float32Array(FUNKEN_MAX), alter: new Float32Array(FUNKEN_MAX), dauer: new Float32Array(FUNKEN_MAX), groesse: new Float32Array(FUNKEN_MAX), lage: new Uint8Array(FUNKEN_MAX), ph: new Float32Array(FUNKEN_MAX), amp: new Float32Array(FUNKEN_MAX), an: new Uint8Array(FUNKEN_MAX) };
const S = { x: new Float32Array(STAUB_MAX), y: new Float32Array(STAUB_MAX), vx: new Float32Array(STAUB_MAX), vy: new Float32Array(STAUB_MAX), groesse: new Float32Array(STAUB_MAX), lage: new Uint8Array(STAUB_MAX), ph: new Float32Array(STAUB_MAX), a: new Float32Array(STAUB_MAX) };
const Q = { x: new Float32Array(RAUCH_MAX), y: new Float32Array(RAUCH_MAX), vx: new Float32Array(RAUCH_MAX), vy: new Float32Array(RAUCH_MAX), alter: new Float32Array(RAUCH_MAX), dauer: new Float32Array(RAUCH_MAX), g0: new Float32Array(RAUCH_MAX), an: new Uint8Array(RAUCH_MAX), vorne: new Uint8Array(RAUCH_MAX) };
let funkeZeiger = 0, funkenSchuld = 0, rauchSchuld = 0, vorderSchuld = 0;

function staubVerteilen() {
  const r = rng(5);
  let i = 0;
  STAUB_LAGEN.forEach((n, l) => {
    for (let k = 0; k < n; k++, i++) {
      S.x[i] = r() * W; S.y[i] = r() * H; S.lage[i] = l; S.ph[i] = r() * 6.283;
      S.groesse[i] = l === 0 ? 1.2 + r() * .6 : l === 1 ? 1.8 + r() * .8 : 3.6 + r() * 2.6;
      const v = l === 0 ? 3 + r() * 5 : l === 1 ? 7 + r() * 8 : 16 + r() * 16;
      S.vy[i] = -v; S.vx[i] = (r() - .3) * v * .6;
      S.a[i] = l === 2 ? .22 + r() * .2 : .3 + r() * .35;
    }
  });
}
function funke(x, y, lage, opt = {}) {
  let i = -1;
  for (let k = 0; k < FUNKEN_MAX; k++) { const j = (funkeZeiger + k) % FUNKEN_MAX; if (!F.an[j]) { i = j; break; } }
  if (i < 0) { i = funkeZeiger; } // Pool voll: den ältesten überschreiben
  funkeZeiger = (i + 1) % FUNKEN_MAX;
  const f = lage === 0 ? .65 : lage === 1 ? 1 : 1.45;
  F.an[i] = 1; F.alter[i] = 0; F.dauer[i] = (1.2 + Math.random() * 1.8) * (opt.leben || 1); F.aus[i] = opt.aus || .55;
  F.x[i] = F.bx[i] = x; F.y[i] = y; F.lage[i] = lage;
  F.vy[i] = (opt.vy !== undefined ? opt.vy : -(55 + Math.random() * 110)) * f;
  F.vx[i] = (opt.vx !== undefined ? opt.vx : (Math.random() - .5) * 30) * f;
  F.groesse[i] = lage === 0 ? 2 + Math.random() * .6 : lage === 1 ? 2.6 + Math.random() * 1 : 3.8 + Math.random() * 1.2;
  F.ph[i] = Math.random() * 6.283; F.amp[i] = 4 + Math.random() * 12;
}
function zufallsLage() { const r = Math.random(); return r < .45 ? 0 : r < .85 ? 1 : 2; }
tischFunken = (x, y) => { if (ruhig || !renderer) return; for (let k = 0; k < 16; k++) { const w = -Math.PI / 2 + (Math.random() - .5) * 2.2; const v = 60 + Math.random() * 120; funke(x + (Math.random() - .5) * 20, y, Math.random() < .5 ? 1 : 2, { vx: Math.cos(w) * v, vy: Math.sin(w) * v }); } };
const brennFunke = (el) => { if (ruhig || !renderer) return; const r = el.getBoundingClientRect(); const br = buehne.getBoundingClientRect(); funke(r.left - br.left + r.width * (.2 + Math.random() * .6), r.top - br.top + r.height * (.45 + Math.random() * .3), 2, { vy: -(70 + Math.random() * 90), vx: (Math.random() - .3) * 40 }); };

function rauchSpawn(x, y, vorne) {
  let i = -1;
  for (let k = 0; k < RAUCH_MAX; k++) if (!Q.an[k]) { i = k; break; }
  if (i < 0) return;
  Q.an[i] = 1; Q.alter[i] = 0; Q.vorne[i] = vorne ? 1 : 0;
  Q.dauer[i] = vorne ? 5 + Math.random() * 3 : 6 + Math.random() * 4;
  Q.x[i] = x; Q.y[i] = y;
  Q.vx[i] = vorne ? 14 + Math.random() * 12 : 4 + (Math.random() - .3) * 10;
  Q.vy[i] = vorne ? -(4 + Math.random() * 6) : -(12 + Math.random() * 14);
  Q.g0[i] = vorne ? 90 + Math.random() * 50 : 140 + Math.random() * 90;
}

if (renderer) {
  renderer.setClearColor(0x141110, 1);
  renderer.autoClear = true;
  kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const data = new Uint8Array([20, 17, 16, 255]);
  leerTex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  leerTex.needsUpdate = true;
  kornTex = new THREE.TextureLoader().load('/hebel-vorschau/v3/beispiele/fumo/bilder/korn.png', () => { neuesBild = true; });
  kornTex.wrapS = kornTex.wrapT = THREE.RepeatWrapping;
  bildMat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      uA: { value: leerTex }, uB: { value: leerTex }, uKorn: { value: kornTex },
      uCropA: { value: new THREE.Vector4(.5, .5, 1, 1) }, uCropB: { value: new THREE.Vector4(.5, .5, 1, 1) },
      uLookA: { value: new THREE.Vector3(1, 0, 0) }, uLookB: { value: new THREE.Vector3(1, 0, 0) },
      uTexA: { value: new THREE.Vector2(1, 1) }, uTexB: { value: new THREE.Vector2(1, 1) },
      uMix: { value: 0 }, uTyp: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 },
      uIris: { value: new THREE.Vector2() }, uIrisMax: { value: 1 }, uLicht: { value: new THREE.Vector2() },
      uFlash: { value: 0 }, uHeat: { value: new THREE.Vector4(.5, .5, .3, .2) }, uHeatAmt: { value: 0 }, uZeit: { value: 0 },
      uKornOff: { value: new THREE.Vector2() }, uKornAmt: { value: .07 }, uKalt: { value: new THREE.Vector2() },
    },
  });
  bildSzene = new THREE.Scene();
  bildSzene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bildMat));

  glutSzene = new THREE.Scene();
  glutKamera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  const plus = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
  const ueber = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
  const N = FUNKEN_MAX + STAUB_MAX;
  funkenGeo = new THREE.BufferGeometry();
  funkenGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
  funkenGeo.setAttribute('aGroesse', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
  funkenGeo.setAttribute('aFarbe', new THREE.BufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage));
  funkenGeo.setAttribute('aForm', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
  funkenGeo.setAttribute('aWeich', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
  const funkenMat = new THREE.ShaderMaterial({ vertexShader: FUNKEN_VERT, fragmentShader: FUNKEN_FRAG, uniforms: { uDpr: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false, ...plus });
  const funkenPunkte = new THREE.Points(funkenGeo, funkenMat);
  funkenPunkte.frustumCulled = false;
  funkenPunkte.renderOrder = 2;
  rauchGeo = new THREE.BufferGeometry();
  rauchGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAUCH_MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
  rauchGeo.setAttribute('aGroesse', new THREE.BufferAttribute(new Float32Array(RAUCH_MAX), 1).setUsage(THREE.DynamicDrawUsage));
  rauchGeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(RAUCH_MAX), 1).setUsage(THREE.DynamicDrawUsage));
  const saat = new Float32Array(RAUCH_MAX); for (let i = 0; i < RAUCH_MAX; i++) saat[i] = Math.random();
  rauchGeo.setAttribute('aSaat', new THREE.BufferAttribute(saat, 1));
  const rauchMat = new THREE.ShaderMaterial({ vertexShader: RAUCH_VERT, fragmentShader: RAUCH_FRAG, uniforms: { uDpr: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false, ...ueber });
  const rauchPunkte = new THREE.Points(rauchGeo, rauchMat);
  rauchPunkte.frustumCulled = false;
  rauchPunkte.renderOrder = 1;
  glutSzene.add(rauchPunkte, funkenPunkte);
  glutSzene.userData = { funkenMat, rauchMat };
  glutCtx = glutCanvas.getContext('2d');

  stillLaden(mobilModus ? 'feuerHoch' : 'feuer').then(() => { stillLaden('holz'); stillLaden('wand'); stillLaden('gastraum'); stillLaden(mobilModus ? 'feuer' : 'feuerHoch'); });
}

/* ================= Grösse ================= */
function groesse() {
  W = Math.max(1, buehne.clientWidth); H = Math.max(1, buehne.clientHeight);
  const mobil = istMobil();
  if (mobil !== mobilModus) {
    mobilModus = mobil;
    Object.values(FOLGEN).forEach((f) => { if (f.meta) folgeEinrichten(f); });
    stillLaden(mobilModus ? 'feuerHoch' : 'feuer');
  }
  if (renderer) {
    DPR = Math.min(devicePixelRatio || 1, mobilModus ? 1.5 : 1.75);
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);
    const cw = renderer.domElement.width, ch = renderer.domElement.height;
    glutCanvas.width = cw; glutCanvas.height = ch;
    bildMat.uniforms.uRes.value.set(cw, ch);
    bildMat.uniforms.uDpr.value = DPR;
    glutSzene.userData.funkenMat.uniforms.uDpr.value = DPR;
    glutSzene.userData.rauchMat.uniforms.uDpr.value = DPR;
    glutKamera.left = 0; glutKamera.right = W; glutKamera.top = H; glutKamera.bottom = 0; glutKamera.updateProjectionMatrix();
    staubVerteilen();
  }
  kreide.bauen();
  neuesBild = true;
  letzteDom = -1;
}

/* ================= Bildausschnitt (cover) und Umrechnung Bild zu Bildschirm ================= */
function ausschnitt(ki, t, img, zeiger) {
  const k = KAP[ki], c = mobilModus ? k.m : k.d;
  const iw = img ? img.naturalWidth || img.width || 1 : 1, ih = img ? img.naturalHeight || img.height || 1 : 1;
  const ia = iw / ih, ca = W / H;
  const zoom = 1.025 * (1 + .08 * clamp(t));
  let cw = ia > ca ? ca / ia : 1, ch = ia > ca ? 1 : ia / ca;
  cw /= zoom; ch /= zoom;
  let fx = c.fokus[0], fy = 1 - c.fokus[1];
  if (c.schwenk) fy -= (clamp(t) - .5) * c.schwenk;
  fx -= zeiger.x * 6 / W * cw; fy += zeiger.y * 6 / H * ch;
  const cx = clamp(fx, cw / 2, 1 - cw / 2), cy = clamp(fy, ch / 2, 1 - ch / 2);
  return { cx, cy, cw, ch, iw, ih };
}
const bildZuSchirm = (a, u, vTop) => [((u - a.cx) / a.cw + .5) * W, (1 - (((1 - vTop) - a.cy) / a.ch + .5)) * H];

/* ================= Hauptschleife ================= */
let p = pFilm(), pVor = p, tempo = 0, kipp = 0;
const zeiger = { x: 0, y: 0, zx: 0, zy: 0 };
let rangeWert = 1;
let laeuft = false, sichtbar = true, zuletzt = performance.now(), zeit = 0, letzteDom = -1, vorherDominant = -1;
let wischStart = null;

addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  zeiger.zx = clamp((e.clientX / innerWidth - .5) * 2, -1, 1);
  zeiger.zy = clamp((e.clientY / innerHeight - .5) * 2, -1, 1);
}, { passive: true });
// Am Handy: Ziehen statt Zeiger, das Bild folgt dem Finger ein wenig
addEventListener('touchstart', (e) => { const t = e.touches[0]; wischStart = { x: t.clientX, y: t.clientY }; }, { passive: true });
addEventListener('touchmove', (e) => { if (!wischStart) return; const t = e.touches[0]; zeiger.zx = clamp((t.clientX - wischStart.x) / (innerWidth * .4), -1, 1); zeiger.zy = clamp((t.clientY - wischStart.y) / (innerHeight * .6), -1, 1) * .4; }, { passive: true });
addEventListener('touchend', () => { wischStart = null; zeiger.zx = 0; zeiger.zy = 0; }, { passive: true });

document.addEventListener('hebel-ruhig', (e) => {
  ruhig = !!e.detail;
  if (ruhig) { F.an.fill(0); Q.an.fill(0); zeiger.x = zeiger.y = 0; }
  neuesBild = true; letzteDom = -1;
  starten();
});

const plan = $('#plan');
const heroH = KAPEL[0];
let planAn = false;

function domSetzen(L, jetzt) {
  document.body.classList.toggle('im-hero', p < .05);
  // Titel und Untertitel
  const introDauer = (450 + 18 * TITEL[0].L.length) / 1000;
  const heroAuf = ruhig ? 1 : clamp((jetzt - heroIntroStart) / 1000 / introDauer);
  TITEL.forEach((T, i) => {
    const t = kapT(i, p);
    const auf = i === 0 ? heroAuf : clamp(t / .2);
    // Abgang in den letzten 15 Prozent; in der Karte früher, damit die Kreide allein im Vordergrund schreibt
    const [ab0, ab1] = KAP[i].abgang || [.85, 1];
    const ab = clamp((t - ab0) / (ab1 - ab0));
    const nah = i === 0 || Math.abs(i - L.A) <= 1 || Math.abs(i - L.B) <= 1;
    if (!nah && T.versteckt) return;
    titelSetzen(T, nah ? auf : 0, nah ? ab : 1, brennFunke);
    T.versteckt = !nah;
    if (i === 0) {
      const o = 1 - smooth(.5, .82, t);
      heroUnter.style.opacity = o.toFixed(3);
      heroUnter.style.transform = ruhig ? '' : `translateY(${(-t * 26).toFixed(1)}px)`;
      heroUnter.inert = o < .3;
    } else if (T.ut) {
      T.ut.style.opacity = (smooth(.05, .2, t) * (1 - smooth(ab0 - .05, ab0 + .08, t))).toFixed(3);
    }
    // Zeiger und Scroll-Tempo: Titelzeile 14 px, kippt höchstens 1.5 Grad nach
    if (nah && !ruhig) T.tz.style.transform = `translate3d(${(zeiger.x * 14).toFixed(1)}px,${(zeiger.y * 7).toFixed(1)}px,0) rotate(${kipp.toFixed(2)}deg)`;
    else if (T.tz.style.transform) T.tz.style.transform = '';
  });
  // Hero: Rahmen öffnet sich bis p 0.03, Hinweis "Scrollen" geht
  const q = smooth(0, .03, p);
  const rand = 16 * (1 - q), oben = 28 + rand;
  if (renderer) bildCanvas.style.clipPath = q >= 1 ? '' : `inset(${oben.toFixed(1)}px ${rand.toFixed(1)}px ${rand.toFixed(1)}px ${rand.toFixed(1)}px)`;
  rahmenlinie.style.inset = `${oben.toFixed(1)}px ${rand.toFixed(1)}px ${rand.toFixed(1)}px ${rand.toFixed(1)}px`;
  rahmenlinie.style.opacity = (1 - q).toFixed(3);
  scrollenEl.style.opacity = (1 - smooth(0, .012, p)).toFixed(3);
  // Zeitleiste
  zeitleiste.style.opacity = smooth(.008, .04, p).toFixed(3);
  uhrEl.textContent = uhrBei(p);
  marker.style.left = (p * 100).toFixed(3) + '%';
  MARKEN.forEach((b, i) => { if (b) b.classList.toggle('vorbei', p >= KAP[i].a); });
  // Kreidekarte (Kapitel 5)
  const tk = kapT(5, p);
  const sichtK = smooth(-.12, .06, tk) * (1 - smooth(.88, 1.06, tk));
  kreide.setzen(clamp((tk - .34) / .52), keinWebgl() ? 0 : sichtK);
  // Tischplan (Kapitel 7)
  if (!keinWebgl()) {
    const tp = kapT(7, p);
    const sichtP = smooth(-.05, .12, tp) * (1 - smooth(.8, .95, tp));
    plan.style.opacity = sichtP.toFixed(3);
    const an = sichtP > .5;
    if (an !== planAn) { planAn = an; plan.classList.toggle('an', an); plan.inert = !an; }
  }
}

function partikel(dt, L, dominant) {
  const kd = KAP[dominant];
  const tDom = clamp(kapT(dominant, p));
  // Umschlag des Kapitels: Funken nur in Feuer-Kapiteln, weich ein- und ausgeblendet
  const huelle = (i) => { const t = kapT(i, p); return smooth(-.1, .08, t) * (1 - smooth(.9, 1.1, t)); };
  const a = ausschnittCache[dominant === L.A ? 0 : 1];
  const c = mobilModus ? kd.m : kd.d;
  if (!ruhig && kd.feuer && c.zone && a) {
    let rate = kd.rate;
    if (kd.rampe) rate *= smooth(kd.rampe[0], kd.rampe[1], tDom);
    if (dominant === 8) rate = lerp(kd.rate, 1, tDom);
    rate *= Math.max(.2, dominant === 0 ? 1 : huelle(dominant)) * (mobilModus ? .6 : 1); // Hero: von Anfang an dicht
    funkenSchuld += rate * dt;
    while (funkenSchuld >= 1) {
      funkenSchuld -= 1;
      const u = lerp(c.zone[0], c.zone[1], Math.random());
      const [sx, sy] = bildZuSchirm(a, u, c.zone[2] + (Math.random() - .5) * .06);
      funke(sx, sy, zufallsLage(), kd.leben ? { leben: kd.leben, aus: kd.aus } : {});
    }
    // Rauch nur in Holz, Glut und Schluss
    if (kd.rauch) {
      rauchSchuld += 1.6 * dt * (dominant === 8 ? 1 - tDom * .7 : 1);
      while (rauchSchuld >= 1) {
        rauchSchuld -= 1;
        const [sx, sy] = bildZuSchirm(a, lerp(c.zone[0], c.zone[1], Math.random()), c.zone[2] - .05);
        rauchSpawn(sx, sy, false);
      }
    }
  }
  // Feuer und Pfanne: ein Teil des Rauchs zieht über die Titelzeile
  if (!ruhig && kd.vorderRauch) {
    const T = TITEL[dominant];
    const t = kapT(dominant, p);
    if (t > .15 && t < .85) {
      vorderSchuld += .35 * dt;
      if (vorderSchuld >= 1) {
        vorderSchuld = 0;
        const r = T.tz.getBoundingClientRect(), br = buehne.getBoundingClientRect();
        rauchSpawn(r.left - br.left - 40, r.top - br.top + r.height * (.55 + Math.random() * .4), true);
      }
    }
  }
  // Funken bewegen
  const strecken = clamp(Math.abs(tempo) / 1300, 0, 2);
  for (let i = 0; i < FUNKEN_MAX; i++) {
    if (!F.an[i]) continue;
    F.alter[i] += dt;
    if (F.alter[i] > F.dauer[i] || F.y[i] < -40) { F.an[i] = 0; continue; }
    F.vy[i] -= 14 * dt; // Auftrieb
    F.vx[i] += (12 - F.vx[i] * .4) * dt; // leichter Wind nach rechts
    F.bx[i] += F.vx[i] * dt;
    F.y[i] += F.vy[i] * dt - (F.lage[i] === 2 ? tempo * .18 : F.lage[i] === 1 ? tempo * .06 : 0) * dt;
    F.x[i] = F.bx[i] + Math.sin(F.ph[i] + F.alter[i] * 4.2) * F.amp[i] * Math.min(1, F.alter[i]);
  }
  // Staub schwebt
  for (let i = 0; i < STAUB_MAX; i++) {
    if (ruhig) continue;
    const l = S.lage[i];
    S.x[i] += (S.vx[i] + Math.sin(zeit * .5 + S.ph[i]) * 4) * dt;
    S.y[i] += (S.vy[i] - (l === 2 ? tempo * .14 : l === 1 ? tempo * .05 : tempo * .02)) * dt;
    if (S.y[i] < -10) { S.y[i] = H + 10; S.x[i] = Math.random() * W; }
    if (S.y[i] > H + 12) S.y[i] = -8;
    if (S.x[i] > W + 10) S.x[i] = -10; else if (S.x[i] < -12) S.x[i] = W + 8;
  }
  // Rauch
  for (let i = 0; i < RAUCH_MAX; i++) {
    if (!Q.an[i]) continue;
    Q.alter[i] += dt;
    if (Q.alter[i] > Q.dauer[i]) { Q.an[i] = 0; continue; }
    Q.x[i] += Q.vx[i] * dt; Q.y[i] += Q.vy[i] * dt;
  }
  // In die Puffer schreiben
  const pos = funkenGeo.attributes.position.array, gr = funkenGeo.attributes.aGroesse.array, fa = funkenGeo.attributes.aFarbe.array, fo = funkenGeo.attributes.aForm.array, we = funkenGeo.attributes.aWeich.array;
  for (let i = 0; i < FUNKEN_MAX; i++) {
    if (!F.an[i] || ruhig) { fa[i * 4 + 3] = 0; continue; }
    const l = F.lage[i], u = F.alter[i] / F.dauer[i];
    const px = F.x[i] + zeiger.x * PARALLAX[l], py = F.y[i] + zeiger.y * PARALLAX[l] * .5;
    pos[i * 3] = px; pos[i * 3 + 1] = H - py; pos[i * 3 + 2] = 0;
    gr[i] = F.groesse[i];
    const hell = smooth(0, .08, u) * (1 - smooth(F.aus[i], 1, u)) * (.72 + .28 * Math.sin(F.alter[i] * 31 + F.ph[i]));
    const k = smooth(.15, .9, u);
    fa[i * 4] = lerp(.969, .886, k); fa[i * 4 + 1] = lerp(.698, .333 * (1 - k * .4), k); fa[i * 4 + 2] = lerp(.29, .169, k);
    fa[i * 4 + 3] = hell * (l === 2 ? .8 : 1);
    // Richtung und Streckung (vordere Lage bis 3-fach)
    const vy = F.vy[i] - (l === 2 ? tempo * .18 : 0);
    fo[i * 3] = F.vx[i]; fo[i * 3 + 1] = -vy;
    fo[i * 3 + 2] = 1 + (l === 2 ? strecken : l === 1 ? strecken * .35 : 0);
    we[i] = l === 2 ? .75 : l === 1 ? .2 : 0;
  }
  const dichte = KAP[L.A].staub * (1 - L.m) + KAP[L.B].staub * L.m;
  const endeDimm = dominant === 8 ? 1 - tDom * .75 : 1;
  for (let i = 0; i < STAUB_MAX; i++) {
    const j = FUNKEN_MAX + i, l = S.lage[i];
    let x = S.x[i], y = S.y[i];
    if (ruhig) { // ruhig: kein Eigenleben, nur am Scroll gekoppelt
      y = ((S.y[i] - p * rangeWert * (l === 0 ? .02 : l === 1 ? .05 : .11)) % H + H) % H;
    }
    pos[j * 3] = x + zeiger.x * PARALLAX[l]; pos[j * 3 + 1] = H - (y + zeiger.y * PARALLAX[l] * .5); pos[j * 3 + 2] = 0;
    gr[j] = S.groesse[i];
    fa[j * 4] = .95; fa[j * 4 + 1] = .62; fa[j * 4 + 2] = .32;
    fa[j * 4 + 3] = S.a[i] * dichte * endeDimm * (ruhig ? .85 : .7 + .3 * Math.sin(zeit * 1.3 + S.ph[i]));
    fo[j * 3] = 0; fo[j * 3 + 1] = 1; fo[j * 3 + 2] = 1 + (l === 2 && !ruhig ? strecken * .5 : 0);
    we[j] = l === 2 ? .9 : .1;
  }
  ['position', 'aGroesse', 'aFarbe', 'aForm', 'aWeich'].forEach((n) => { funkenGeo.attributes[n].needsUpdate = true; });
  const rp = rauchGeo.attributes.position.array, rg = rauchGeo.attributes.aGroesse.array, ra = rauchGeo.attributes.aAlpha.array;
  for (let i = 0; i < RAUCH_MAX; i++) {
    if (!Q.an[i] || ruhig) { ra[i] = 0; continue; }
    const u = Q.alter[i] / Q.dauer[i];
    rp[i * 3] = Q.x[i] + zeiger.x * (Q.vorne[i] ? 28 : 14); rp[i * 3 + 1] = H - Q.y[i]; rp[i * 3 + 2] = 0;
    rg[i] = Q.g0[i] * (1 + u * 1.2);
    ra[i] = .18 * Math.sin(Math.PI * u) * (Q.vorne[i] ? .9 : 1);
  }
  rauchGeo.attributes.position.needsUpdate = rauchGeo.attributes.aGroesse.needsUpdate = rauchGeo.attributes.aAlpha.needsUpdate = true;
}

const ausschnittCache = [null, null];
let letzteSig = '';
function bildSetzen(L) {
  const u = bildMat.uniforms;
  const slot = (ki, t, n) => {
    const k = KAP[ki];
    const img = bildFuer(ki, clamp(t));
    const a = ausschnitt(ki, t, img, zeiger);
    ausschnittCache[n] = a;
    const tex = texFuer(img);
    let bel = k.belichtung || 1, uns = k.unschaerfe || 0;
    if (ki === 8) bel = lerp(.85, .06, smooth(0, 1, clamp(t)));
    return { tex, a, bel, uns, mitte: k.mitte || 0, img };
  };
  const tA = kapT(L.A, p), tB = kapT(L.B, p);
  const A = slot(L.A, tA, 0);
  const B = L.m > 0 ? slot(L.B, tB, 1) : null;
  let typ = 0;
  if (L.m > 0 && !ruhig) typ = BLENDE[KAP[L.B].typ] || 0;
  if (typ === BLENDE.unschaerfe && B) {
    A.uns += L.m * 5; A.bel *= 1 - L.m * .55;
    B.uns += (1 - L.m) * 5; B.bel *= 1 - (1 - L.m) * .55;
  }
  u.uA.value = A.tex; u.uCropA.value.set(A.a.cx, A.a.cy, A.a.cw, A.a.ch); u.uTexA.value.set(A.a.iw, A.a.ih); u.uLookA.value.set(A.bel, A.uns, A.mitte);
  // Rauchkorrektur nur für die Desktop-Folge (die Handy-Folge zeigt einen Ausschnitt ohne den Rauch)
  const kalt = (ki) => (mobilModus ? KAP[ki].m : KAP[ki].d).kalt || 0;
  u.uKalt.value.set(kalt(L.A), B ? kalt(L.B) : 0);
  if (B) { u.uB.value = B.tex; u.uCropB.value.set(B.a.cx, B.a.cy, B.a.cw, B.a.ch); u.uTexB.value.set(B.a.iw, B.a.ih); u.uLookB.value.set(B.bel, B.uns, B.mitte); }
  u.uMix.value = B ? L.m : 0;
  u.uTyp.value = typ;
  if (typ === BLENDE.iris && B) {
    const c = mobilModus ? KAP[L.B].m : KAP[L.B].d;
    const [sx, sy] = bildZuSchirm(B.a, c.iris[0], c.iris[1]);
    u.uIris.value.set(sx * DPR, (H - sy) * DPR);
    u.uIrisMax.value = Math.hypot(Math.max(sx, W - sx), Math.max(sy, H - sy)) * DPR + 40 * DPR;
  }
  if (typ === BLENDE.schwarz) u.uLicht.value.set(W * .62 * DPR, H * .55 * DPR);
  // Hitzeflimmern nur in Feuer-Kapiteln, nicht ruhig
  const kA = KAP[L.A], cA = mobilModus ? kA.m : kA.d;
  if (kA.feuer && cA.hitze && !ruhig) {
    u.uHeat.value.set(cA.hitze[0], 1 - cA.hitze[1], cA.hitze[2], cA.hitze[3]);
    u.uHeatAmt.value = .004 * (1 - L.m);
  } else u.uHeatAmt.value = 0;
  u.uZeit.value = zeit;
  if (!ruhig) u.uKornOff.value.set(Math.random(), Math.random());
  // Harter Schnitt: genau ein Bild Weissblitz, wenn das sichtbare Kapitel wechselt
  const dominant = L.m >= .5 ? L.B : L.A;
  u.uFlash.value = 0;
  if (vorherDominant >= 0 && dominant !== vorherDominant && !ruhig) {
    const g = Math.max(dominant, vorherDominant);
    if (Math.abs(dominant - vorherDominant) === 1 && KAP[g].typ === 'schnitt') u.uFlash.value = 1;
  }
  vorherDominant = dominant;
  return `${A.img ? A.img.src : ''}|${B && B.img ? B.img.src : ''}|${L.m.toFixed(4)}|${tA.toFixed(4)}`;
}

function bild(jetzt) {
  const dt = Math.min(.05, (jetzt - zuletzt) / 1000);
  zuletzt = jetzt;
  zeit += dt;
  rangeWert = range();
  const ziel = pFilm();
  p = ruhig ? ziel : lerp(p, ziel, 1 - Math.exp(-dt * 9));
  if (Math.abs(p - ziel) < 1e-5) p = ziel;
  const tempoJetzt = dt > 0 ? (p - pVor) * rangeWert / dt : 0;
  pVor = p;
  tempo = ruhig ? 0 : lerp(tempo, tempoJetzt, 1 - Math.exp(-dt * 6));
  kipp = ruhig ? 0 : lerp(kipp, clamp(-tempo / 2400 * 1.5, -1.5, 1.5), 1 - Math.exp(-dt * 5));
  // Zeiger mit Glättung 0.1 (bei 60 Bildern pro Sekunde); ruhig ohne Parallaxe
  const zf = 1 - Math.exp(-dt * 6.3);
  zeiger.x = ruhig ? 0 : lerp(zeiger.x, zeiger.zx, zf);
  zeiger.y = ruhig ? 0 : lerp(zeiger.y, zeiger.zy, zf);
  const L = lage(p);
  const dominant = L.m >= .5 ? L.B : L.A;
  pumpe(ziel);
  const heroLaeuft = !ruhig && (jetzt - heroIntroStart) < 2000;
  if (p !== letzteDom || !ruhig || heroLaeuft) { domSetzen(L, jetzt); letzteDom = p; }
  if (!renderer) return;
  const sig = bildSetzen(L);
  // Ruhig: nur zeichnen, wenn sich etwas geändert hat
  if (ruhig && sig === letzteSig && !neuesBild) return;
  letzteSig = sig; neuesBild = false;
  partikel(dt, L, dominant);
  // Durchgang 1: Glut (Funken, Rauch, Staub) transparent zeichnen und auf die vordere Leinwand kopieren
  renderer.setClearColor(0x000000, 0);
  renderer.render(glutSzene, glutKamera);
  glutCtx.clearRect(0, 0, glutCanvas.width, glutCanvas.height);
  glutCtx.drawImage(renderer.domElement, 0, 0);
  // Durchgang 2: das Bild mit Blenden, Flimmern, Vignette, Korn
  renderer.setClearColor(0x141110, 1);
  renderer.render(bildSzene, kamera);
}

function schleife(jetzt) {
  if (!laeuft) return;
  bild(jetzt);
  requestAnimationFrame(schleife);
}
function starten() {
  if (!renderer) return; // ohne WebGL 2 bleibt der Film eine Folge normaler Abschnitte
  const soll = sichtbar && !document.hidden;
  if (soll && !laeuft) { laeuft = true; zuletzt = performance.now(); requestAnimationFrame(schleife); }
  else if (!soll) laeuft = false;
}
new IntersectionObserver((e) => { sichtbar = e[0].isIntersecting; starten(); }, { rootMargin: '10% 0px' }).observe(film);
document.addEventListener('visibilitychange', starten);
addEventListener('resize', groesse);
metaFertig.then(() => { neuesBild = true; });
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('400 24px Caveat'), document.fonts.load('700 24px Caveat')]).then(() => { kreide.bauen(); letzteDom = -1; neuesBild = true; }, () => {});
}
groesse();
heroIntroStart = performance.now();
starten();
/* Prüfhilfe für die Sichtprüfung ohne Klick: ?wahl=6 wählt Tisch 6 vor (wie ein Klick im Plan) */
{ const m = location.search.match(/[?&]wahl=([1-8])/); if (m) wahl.setzen(Number(m[1]), 'plan'); }
