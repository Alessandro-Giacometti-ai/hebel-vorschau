/* Fumo, Pizzeria e Cucina (Beispielseite von Hebel, erfundener Betrieb).
   Bildfolgen in Bögen, Ebenen mit Zeiger und Scroll, Karte, Mittagstafel, Take-away und Reservierung (Demo).
   Grundlage: docs/webstudio-2026-10/master-prompts/02c-fumo-pizzeria.md */

const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const klemm = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const weich = (t) => t * t * (3 - 2 * t);
const sanft = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Ruhig nur, wenn der Besucher es selbst gewählt hat (Klasse ruhig, gesetzt im Kopf der Seite) */
let ruhig = html.classList.contains('ruhig');
const handyMq = matchMedia('(max-width: 760px)');
let handy = handyMq.matches;
const vorschauMq = matchMedia('(min-width: 1400px) and (hover: hover)');
const dpr = () => Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 1.75);
const kopf = $('[data-kopf]');
const kopfH = () => (kopf ? kopf.offsetHeight : 76);

/* ---------- Weiches Scrollen (Lenis), im ruhigen Modus aus ---------- */
let lenis = null;
function lenisAn() {
  if (lenis || ruhig || !window.Lenis) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
}
function lenisAus() { if (lenis) { lenis.destroy(); lenis = null; } }
lenisAn();

function scrolleZu(ziel, versatz) {
  const el = typeof ziel === 'string' ? $(ziel) : ziel;
  if (!el) return;
  const off = versatz != null ? versatz : -(kopfH() + 8);
  if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.4 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + off, behavior: ruhig ? 'auto' : 'smooth' });
}
function springeZu(el, abstand) {
  const y = Math.max(0, el.getBoundingClientRect().top + scrollY - abstand);
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
}

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const ziel = $(id);
  if (!ziel) return;
  e.preventDefault();
  menueZu();
  if (id === '#start') { if (lenis) lenis.scrollTo(0, { duration: 1.4 }); else scrollTo({ top: 0, behavior: ruhig ? 'auto' : 'smooth' }); }
  else scrolleZu(ziel);
  history.replaceState(null, '', id);
});

document.addEventListener('hebel-ruhig', (e) => {
  ruhig = !!e.detail;
  if (ruhig) lenisAus(); else lenisAn();
  mehlLeeren();
  hero.dirty = true;
});

/* ---------- Kopf und Menü ---------- */
const menueKnopf = $('[data-menue-knopf]');
const menue = $('[data-menue]');
function menueAuf() {
  html.classList.add('menue-offen');
  menueKnopf.setAttribute('aria-expanded', 'true');
  if (lenis) lenis.stop();
  const erster = $('a', menue); if (erster) setTimeout(() => erster.focus(), 80);
}
function menueZu() {
  if (!html.classList.contains('menue-offen')) return;
  html.classList.remove('menue-offen');
  menueKnopf.setAttribute('aria-expanded', 'false');
  if (lenis) lenis.start();
}
if (menueKnopf) menueKnopf.addEventListener('click', () => (html.classList.contains('menue-offen') ? menueZu() : menueAuf()));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && html.classList.contains('menue-offen')) { menueZu(); menueKnopf.focus(); } });

/* ---------- Bildfolgen: Laden in Stufen, Handy-Reihe m-bild- ---------- */
class Bildfolge {
  constructor(ordner) {
    this.basis = `/hebel-vorschau/v3/beispiele/fumo/${ordner}/`;
    this.meta = null; this.satz = null; this.N = 0;
    this.bilder = []; this.bereit = []; this.gestartet = false; this.beiBild = null; this.lauf = 0;
  }
  async init() {
    try { this.meta = await fetch(this.basis + 'meta.json').then((r) => r.json()); } catch (e) { this.meta = null; }
    this.waehlen();
  }
  waehlen() {
    if (!this.meta) return;
    const satz = handy ? this.meta.mobil : this.meta.desktop;
    if (this.satz === satz) return;
    this.satz = satz; this.N = satz.anzahl; this.bilder = []; this.bereit = []; this.lauf++;
    if (this.gestartet) { this.gestartet = false; this.starten(); }
  }
  adresse(i) { return this.basis + this.satz.praefix + String(i + 1).padStart(4, '0') + this.satz.endung; }
  laden(i) {
    if (this.bilder[i]) return Promise.resolve();
    const lauf = this.lauf;
    return new Promise((fertig) => {
      const im = new Image();
      im.decoding = 'async';
      this.bilder[i] = im;
      im.onload = () => {
        const weiter = () => { if (lauf === this.lauf) { this.bereit[i] = true; if (this.beiBild) this.beiBild(i); } fertig(); };
        if (im.decode) im.decode().then(weiter, weiter); else weiter();
      };
      im.onerror = () => fertig();
      im.src = this.adresse(i);
    });
  }
  async starten() {
    if (this.gestartet || !this.satz) return;
    this.gestartet = true;
    const lauf = this.lauf, N = this.N, reihe = [0, N - 1];
    [8, 4, 2, 1].forEach((schritt) => { for (let i = 0; i < N; i += schritt) if (reihe.indexOf(i) === -1) reihe.push(i); });
    let pos = 0;
    const arbeiter = async () => { while (pos < reihe.length && lauf === this.lauf) { await this.laden(reihe[pos++]); } };
    await Promise.all([arbeiter(), arbeiter(), arbeiter()]);
  }
  bild(i) {
    if (!this.N) return null;
    i = Math.round(klemm(i, 0, this.N - 1));
    if (this.bereit[i]) return this.bilder[i];
    for (let d = 1; d < this.N; d++) {
      if (i - d >= 0 && this.bereit[i - d]) return this.bilder[i - d];
      if (i + d < this.N && this.bereit[i + d]) return this.bilder[i + d];
    }
    return null;
  }
}

/* Bild in ein Rechteck legen (cover), Fokuspunkt fx/fy als Anteil des Bildes.
   z vergrössert über cover hinaus, ax/ay sagt, wo im Rechteck der Fokuspunkt landen soll. */
function cover(ctx, img, x, y, w, h, fx, fy, z = 1, ax = 0.5, ay = 0.5) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const s = Math.max(w / iw, h / ih) * z;
  const dw = iw * s, dh = ih * s;
  const dx = klemm(x + w * ax - fx * dw, x + w - dw, x);
  const dy = klemm(y + h * ay - fy * dh, y + h - dh, y);
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* ---------- Zeiger, Ziehen, Scroll-Tempo ---------- */
const zeiger = { x: 0, y: 0, zx: 0, zy: 0 };
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  zeiger.zx = (e.clientX / innerWidth) * 2 - 1;
  zeiger.zy = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });
document.addEventListener('mouseleave', () => { zeiger.zx = 0; zeiger.zy = 0; });
let zug = null;
window.addEventListener('touchstart', (e) => { const t = e.touches[0]; zug = { x: t.clientX, y: t.clientY }; }, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (!zug) return;
  const t = e.touches[0];
  zeiger.zx = klemm((t.clientX - zug.x) / 140, -1, 1);
  zeiger.zy = klemm((t.clientY - zug.y) / 220, -1, 1);
}, { passive: true });
window.addEventListener('touchend', () => { zug = null; zeiger.zx = 0; zeiger.zy = 0; }, { passive: true });
let tempo = 0, letztesY = scrollY;

/* ---------- Hero mit Ofen ---------- */
const hero = {
  sek: $('[data-hero]'), buehne: $('[data-hero-buehne]'), bogen: $('[data-hero-bogen]'), canvas: $('[data-hero-canvas]'),
  titel: $('[data-hero-titel]'), ki: $('[data-hero-ki]'), vorne: $$('[data-vorne]'),
  folge: new Bildfolge('video-ofen'), sichtbar: true, dirty: true, letzte: '', W: 0, H: 0, titelUnten: 0,
};
hero.ctx = hero.canvas ? hero.canvas.getContext('2d') : null;
/* Scharfe Standbilder für Anfang und Ende: das Ofenbild, aus dem die Folge entstand, und die gebackene
   Margherita, auf die der offene Bogen am Ende überblendet (die Folge zeigt die Pizza nur roh). */
function standbild(src) { const im = new Image(); im.decoding = 'async'; im.onload = () => { hero.dirty = true; }; im.src = src; return im; }
hero.anfang = standbild('/hebel-vorschau/v3/beispiele/fumo/pizzeria/ofen.webp');
hero.ende = standbild('/hebel-vorschau/v3/beispiele/fumo/pizzeria/margherita.webp');
const geladen = (im) => (im && im.complete && im.naturalWidth ? im : null);
hero.vorne.forEach((v) => { const o = v.getAttribute('data-ort').split(',').map(Number); v._ort = o; v._tiefe = parseFloat(v.getAttribute('data-tiefe')) || 1; v._s = v.offsetWidth; });

function heroMessen() {
  if (!hero.sek) return;
  hero.W = hero.buehne.clientWidth; hero.H = hero.buehne.clientHeight;
  hero.titelUnten = hero.titel.offsetTop + hero.titel.offsetHeight;
  const g = heroGeometrie(1);
  const d = dpr();
  hero.cw = Math.ceil(Math.max(g.w, Math.min(hero.W * 0.46, 560)));
  hero.ch = Math.ceil(Math.max(g.h, Math.min(hero.H * 0.64, 640)));
  hero.canvas.width = Math.round(hero.cw * d); hero.canvas.height = Math.round(hero.ch * d);
  hero.canvas.style.width = hero.cw + 'px'; hero.canvas.style.height = hero.ch + 'px';
  hero.vorne.forEach((v) => { v._s = v.offsetWidth; });
  hero.dirty = true; hero.letzte = '';
}
function heroFortschritt() {
  const r = hero.sek.getBoundingClientRect();
  const weg = Math.max(1, hero.sek.offsetHeight - hero.H);
  return { h: klemm(-r.top / weg), weg };
}
function heroGeometrie(h) {
  const W = hero.W, H = hero.H, k = kopfH();
  const w0 = Math.min(W * 0.46, 560), h0 = Math.min(H * 0.64, 640);
  const w1 = W * 0.92, h1 = Math.min(H * 0.86, H - k - 40);
  const top1 = Math.max(k + 6, H - 34 - h1);
  const top0 = Math.max(hero.titelUnten + 28, H * 0.5);
  const weg = Math.max(1, hero.sek.offsetHeight - H);
  const s = h * weg, s15 = 0.15 * weg;
  if (h <= 0.15) return { x: (W - w0) / 2, y: top0 - s, w: w0, h: h0, r: w0 / 2 };
  const t = sanft(klemm((h - 0.15) / 0.55));
  const w = mix(w0, w1, t), hh = mix(h0, h1, t);
  return { x: (W - w) / 2, y: mix(top0 - s15, top1, t), w, h: hh, r: Math.min(mix(w0 / 2, 18, t), w / 2) };
}
function heroAktualisieren() {
  if (!hero.sek || !hero.sichtbar || !hero.W) return;
  const { h, weg } = heroFortschritt();
  const g = heroGeometrie(h);
  const bewegt = !ruhig;
  const px = bewegt ? zeiger.x : 0, py = bewegt ? zeiger.y : 0;
  const tv = bewegt ? -klemm(tempo * 0.012, -18, 18) : 0;

  // Titel: hintere Ebene, gleitet mit Faktor 0.6, Zeiger-Tiefe 0.4
  const s = h * weg;
  hero.titel.style.transform = `translate3d(${(px * 14 * 0.4).toFixed(1)}px, ${(-0.6 * s + py * 10 * 0.4 + tv * 0.25).toFixed(1)}px, 0)`;
  hero.titel.style.opacity = String(1 - weich(klemm((h - 0.14) / 0.3)));

  // Bogen: mittlere Ebene, Tiefe 1
  const ox = px * 14, oy = py * 10 + tv * 0.6;
  const b = hero.bogen.style;
  b.left = g.x.toFixed(1) + 'px'; b.top = g.y.toFixed(1) + 'px';
  b.width = g.w.toFixed(1) + 'px'; b.height = g.h.toFixed(1) + 'px';
  b.borderRadius = `${g.r.toFixed(1)}px ${g.r.toFixed(1)}px 18px 18px`;
  b.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0)`;
  hero.ki.style.top = (g.y + g.h + 8).toFixed(1) + 'px';
  hero.ki.style.bottom = 'auto';
  hero.ki.style.opacity = g.y + g.h + 26 > hero.H ? '0' : '1';

  // Vordere Ebene: Kräuter und Tomaten am Rand des Bogens. Am Handy füllt der offene Bogen fast die
  // ganze Breite, dort treten sie zurück, damit nichts auf der Pizza liegt.
  const vorneSicht = handy ? String(1 - weich(klemm((h - 0.18) / 0.22))) : '1';
  hero.vorne.forEach((v) => {
    const [ax, ay, dx, dy] = v._ort, t = v._tiefe, sz = v._s;
    const x = g.x + ax * g.w + dx - sz / 2 + px * 14 * t;
    const y = g.y + ay * g.h + dy - sz / 2 + py * 10 * t + tv * (t / 1.6);
    v.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    v.style.opacity = vorneSicht;
  });

  // Bild im Bogen: Anfang scharfes Ofenbild, nah an der Pizza (vom Bogen ist anfangs nur die obere
  // Hälfte zu sehen), dann die Bildfolge, am Ende Überblendung auf die gebackene Pizza.
  if (!hero.ctx) return;
  const f = hero.folge;
  const spanne = handy ? 0.8 : 1; // am Handy endet die Folge, bevor die Pizza grösser als der Ausschnitt wird
  const idx = f.N ? Math.round(h * (f.N - 1) * spanne) : 0;
  const img = f.N ? f.bild(idx) : null;
  const anfang = geladen(hero.anfang), ende = geladen(hero.ende);
  const nah = 1 - weich(klemm(h / 0.35));
  const z = 1 + (handy ? 0.5 : 0.83) * nah, ay = 0.5 - (handy ? 0.15 : 0.2) * nah;
  const aAnfang = anfang ? 1 - weich(klemm((h - 0.1) / 0.2)) : 0;
  const aEnde = ende ? weich(klemm((h - 0.56) / 0.22)) : 0;
  const key = `${idx}|${img ? img.src : ''}|${g.w.toFixed(0)}|${g.h.toFixed(0)}|${z.toFixed(3)}|${aAnfang.toFixed(3)}|${aEnde.toFixed(3)}`;
  if ((!img && !anfang) || (key === hero.letzte && !hero.dirty)) return;
  hero.letzte = key; hero.dirty = false;
  const c = hero.ctx, d = dpr();
  const w = Math.min(g.w, hero.cw), hh = Math.min(g.h, hero.ch);
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, hero.cw, hero.ch);
  // Handy-Reihe m-bild- ist schon so geschnitten, dass sie der Pizza folgt: dort mittig
  if (img && aAnfang < 1 && aEnde < 1) cover(c, img, 0, 0, w, hh, handy ? 0.5 : 0.6, 0.62, z, 0.5, ay);
  if (aAnfang > 0) { c.globalAlpha = aAnfang; cover(c, anfang, 0, 0, w, hh, handy ? 0.57 : 0.59, 0.62, z, 0.5, ay); }
  if (aEnde > 0) { c.globalAlpha = aEnde; cover(c, ende, 0, 0, w, hh, 0.5, 0.5, 1.12 - 0.12 * aEnde); }
  c.globalAlpha = 1;
  hero.bogen.classList.add('gezeichnet');
}
hero.folge.beiBild = () => { hero.dirty = true; };

/* ---------- Teig und Abends: Bildfolge im Bogen, an den Scroll gekoppelt ---------- */
function folgeBuehne(sek, bogenSel, ordner, fokus) {
  const bogen = $(bogenSel);
  if (!sek || !bogen) return null;
  const canvas = $('[data-folge-canvas]', bogen);
  const o = { sek, bogen, canvas, ctx: canvas.getContext('2d'), folge: new Bildfolge(ordner), fokus, sichtbar: false, dirty: true, letzte: '', w: 0, h: 0, p: 0 };
  o.folge.beiBild = () => { o.dirty = true; };
  return o;
}
const teig = folgeBuehne($('[data-teig]'), '[data-teig-bogen]', 'video-teig', [0.52, 0.56]);
// Abends: ruhiges Standbild statt Bildfolge, weil die Kamerafahrt die Tische wegziehen liess (Ale, 03.10.2026)
const abends = null;
if (teig) teig.spur = $('[data-teig-spur]');

function buehneMessen(o) {
  if (!o) return;
  o.w = o.bogen.clientWidth; o.h = o.bogen.clientHeight;
  const d = dpr();
  o.canvas.width = Math.round(o.w * d); o.canvas.height = Math.round(o.h * d);
  o.dirty = true; o.letzte = '';
}
function buehneFortschritt(o) {
  if (o === teig && handy) {
    // Am Handy: der Bogen klebt in seiner Spur, Fortschritt über die Spur
    const r = o.spur.getBoundingClientRect();
    const oben = kopfH() + 16;
    return klemm((oben - r.top) / Math.max(1, r.height - o.h));
  }
  const r = o.sek.getBoundingClientRect();
  // Schon beim Hereinkommen ein wenig vorlaufen, dann über die verankerte Strecke
  return klemm((innerHeight * 0.35 - r.top) / Math.max(1, o.sek.offsetHeight - innerHeight * 0.65));
}
function buehneZeichnen(o) {
  if (!o || !o.sichtbar || !o.folge.N) return;
  o.p = buehneFortschritt(o);
  const idx = Math.round(o.p * (o.folge.N - 1));
  const img = o.folge.bild(idx);
  if (!img) return;
  const key = idx + '|' + img.src;
  if (key === o.letzte && !o.dirty) return;
  o.letzte = key; o.dirty = false;
  const c = o.ctx, d = dpr();
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, o.w, o.h);
  cover(c, img, 0, 0, o.w, o.h, o.fokus[0], o.fokus[1]);
}

/* ---------- Mehlstaub im Teig-Bogen ---------- */
const mehl = { canvas: $('[data-mehl]'), teile: [], w: 0, h: 0, wirbel: 0 };
mehl.ctx = mehl.canvas ? mehl.canvas.getContext('2d') : null;
function mehlMessen() {
  if (!mehl.canvas || !teig) return;
  mehl.w = teig.w; mehl.h = teig.h;
  const d = dpr();
  mehl.canvas.width = Math.round(mehl.w * d); mehl.canvas.height = Math.round(mehl.h * d);
  if (!mehl.teile.length) {
    for (let i = 0; i < 60; i++) {
      mehl.teile.push({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, r: 0.6 + Math.random() * 1.3, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.8 });
    }
  }
}
function mehlLeeren() { if (mehl.ctx) { mehl.ctx.setTransform(1, 0, 0, 1, 0, 0); mehl.ctx.clearRect(0, 0, mehl.canvas.width, mehl.canvas.height); } }
function mehlSchritt(dt, zeit) {
  if (!mehl.ctx || !teig || !teig.sichtbar || ruhig || !mehl.w) return;
  // Scroll-Tempo wirbelt kurz auf und klingt weich ab
  mehl.wirbel = Math.max(mehl.wirbel * Math.exp(-dt * 1.6), klemm(Math.abs(tempo) / 1400));
  const c = mehl.ctx, d = dpr(), w = mehl.w, h = mehl.h;
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.4)';
  for (const t of mehl.teile) {
    const wx = Math.sin(zeit * 0.5 * t.sp + t.ph) * 6;
    const wy = -4 * t.sp;
    t.vx += (Math.random() - 0.5) * mehl.wirbel * 260 * dt;
    t.vy += (Math.random() - 0.62) * mehl.wirbel * 260 * dt;
    t.vx *= Math.exp(-dt * 1.2); t.vy *= Math.exp(-dt * 1.2);
    t.x += ((wx + t.vx) * dt) / w; t.y += ((wy + t.vy) * dt) / h;
    if (t.y < -0.02) t.y = 1.02; if (t.y > 1.02) t.y = -0.02;
    if (t.x < -0.02) t.x = 1.02; if (t.x > 1.02) t.x = -0.02;
    c.beginPath(); c.arc(t.x * w, t.y * h, t.r, 0, 6.2832); c.fill();
  }
}

/* ---------- Mittagstafel: schreibt sich Zeile für Zeile, an den Scroll gekoppelt ---------- */
const tafel = $('[data-tafel]');
const tafelZeilen = tafel ? $$('li', tafel) : [];
let tafelSichtbar = false, tafelLetzt = -1;
function tafelSchreiben() {
  if (!tafel || !tafelSichtbar) return;
  const r = tafel.getBoundingClientRect();
  const p = klemm((innerHeight * 0.9 - r.top) / (innerHeight * 0.62));
  if (Math.abs(p - tafelLetzt) < 0.001) return;
  tafelLetzt = p;
  const n = tafelZeilen.length;
  tafelZeilen.forEach((li, i) => {
    const lp = klemm(p * n - i);
    li.style.clipPath = lp >= 1 ? 'none' : `inset(-10px ${((1 - lp) * 100).toFixed(2)}% -10px -10px)`;
  });
}

/* ---------- Sichtbarkeit ---------- */
const io = new IntersectionObserver((eintraege) => {
  eintraege.forEach((e) => {
    const el = e.target;
    if (el === hero.sek) hero.sichtbar = e.isIntersecting;
    else if (teig && el === teig.sek) { teig.sichtbar = e.isIntersecting; if (e.isIntersecting) teig.folge.starten(); }
    else if (abends && el === abends.sek) { abends.sichtbar = e.isIntersecting; if (e.isIntersecting) abends.folge.starten(); }
    else if (el === tafel) tafelSichtbar = e.isIntersecting;
  });
}, { rootMargin: '60% 0px 60% 0px' });
[hero.sek, teig && teig.sek, abends && abends.sek, tafel].forEach((el) => el && io.observe(el));

const ioTrenner = new IntersectionObserver((eintraege) => {
  eintraege.forEach((e) => e.target.classList.toggle('an', e.isIntersecting));
}, { rootMargin: '0px 0px -18% 0px', threshold: 1 });
$$('[data-trenner]').forEach((t) => ioTrenner.observe(t));
const terrasse = $('[data-terrasse]');
if (terrasse) new IntersectionObserver((eintraege) => { eintraege.forEach((e) => { if (e.isIntersecting) terrasse.classList.add('da'); }); }, { threshold: 0.12 }).observe(terrasse);

/* ---------- Hauptschleife ---------- */
let letzteZeit = performance.now();
function schleife(jetzt) {
  const dt = Math.min(0.05, (jetzt - letzteZeit) / 1000);
  letzteZeit = jetzt;
  if (lenis) lenis.raf(jetzt);
  const y = scrollY;
  const v = dt > 0 ? (y - letztesY) / dt : 0;
  letztesY = y;
  tempo = mix(tempo, klemm(v, -4000, 4000), Math.min(1, dt * 6));
  const k = Math.min(1, dt * 3.2);
  zeiger.x += (zeiger.zx - zeiger.x) * k;
  zeiger.y += (zeiger.zy - zeiger.y) * k;
  if (kopf) kopf.classList.toggle('gescrollt', y > 4);
  heroAktualisieren();
  buehneZeichnen(teig);
  buehneZeichnen(abends);
  mehlSchritt(dt, jetzt / 1000);
  tafelSchreiben();
  requestAnimationFrame(schleife);
}

function allesMessen() {
  const war = handy;
  handy = handyMq.matches;
  if (war !== handy) { hero.folge.waehlen(); if (teig) teig.folge.waehlen(); if (abends) abends.folge.waehlen(); }
  heroMessen(); buehneMessen(teig); buehneMessen(abends); mehlMessen();
  tafelLetzt = -1;
}
let messTimer = 0;
window.addEventListener('resize', () => { clearTimeout(messTimer); messTimer = setTimeout(allesMessen, 120); });

(async function start() {
  await hero.folge.init();
  hero.folge.starten();
  if (teig) teig.folge.init();
  if (abends) abends.folge.init();
  const schriften = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  await Promise.race([schriften, new Promise((r) => setTimeout(r, 700))]);
  allesMessen();
  requestAnimationFrame(() => { hero.sek && hero.sek.classList.add('geladen'); });
  requestAnimationFrame(schleife);
})();
// Falls die Schrift später kommt: Titelhöhe neu messen
if (document.fonts) document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { heroMessen(); });

/* ---------- Karte: Vorschau im Bogen (Desktop), Aufklappen (Handy) ---------- */
const bildPfad = (name) => `/hebel-vorschau/v3/beispiele/fumo/pizzeria/${name}-klein.webp`;
function karteModus() {
  const vorschau = vorschauMq.matches;
  $$('.gericht').forEach((li) => {
    const b = $('.gericht__zeile', li);
    if (vorschau) { b.removeAttribute('aria-expanded'); li.classList.remove('offen'); }
    else b.setAttribute('aria-expanded', li.classList.contains('offen') ? 'true' : 'false');
  });
  if (vorschau) $$('[data-vorschau]').forEach((v) => v.classList.remove('sichtbar'));
}
vorschauMq.addEventListener('change', karteModus);
karteModus();

$$('.karte__spalte').forEach((spalte) => {
  const v = $('[data-vorschau]', spalte);
  const lagen = $$('img', v);
  let oben = 0, aktuell = 'margherita';
  function zeigen(li) {
    if (!vorschauMq.matches) return;
    const name = li.getAttribute('data-bild');
    const rs = spalte.getBoundingClientRect(), rl = li.getBoundingClientRect();
    v.style.top = Math.max(0, rl.top - rs.top + rl.height / 2 - 130).toFixed(0) + 'px';
    v.classList.toggle('warm', li.hasAttribute('data-warm'));
    if (name !== aktuell) {
      aktuell = name;
      const neu = lagen[1 - oben], alt = lagen[oben];
      neu.onload = () => { neu.style.opacity = '1'; alt.style.opacity = '0'; oben = 1 - oben; };
      neu.style.opacity = '0';
      neu.src = bildPfad(name);
    }
    v.classList.add('sichtbar');
  }
  function weg() { v.classList.remove('sichtbar'); }
  lagen[1].style.opacity = '0';
  $$('.gericht', spalte).forEach((li) => {
    const b = $('.gericht__zeile', li);
    li.addEventListener('mouseenter', () => zeigen(li));
    b.addEventListener('focus', () => zeigen(li));
    b.addEventListener('blur', weg);
    b.addEventListener('click', () => {
      if (vorschauMq.matches) return;
      let fig = $('.gericht__bild', li);
      if (!fig) {
        fig = document.createElement('div');
        fig.className = 'gericht__bild';
        fig.id = 'bild-' + Math.random().toString(36).slice(2, 8);
        fig.innerHTML = `<div><div class="gericht__bildrahmen${li.hasAttribute('data-warm') ? ' warm' : ''}"><div class="bogen"><img alt="" src="${bildPfad(li.getAttribute('data-bild'))}" decoding="async"></div><div class="dampf"><i></i><i></i><i></i></div></div></div>`;
        li.appendChild(fig);
        b.setAttribute('aria-controls', fig.id);
        void fig.offsetHeight;
      }
      const auf = !li.classList.contains('offen');
      li.classList.toggle('offen', auf);
      b.setAttribute('aria-expanded', String(auf));
    });
  });
  spalte.addEventListener('mouseleave', weg);
});

/* ---------- Gemeinsame Formular-Helfer ---------- */
function fehler(id, text) {
  const feld = document.getElementById(id);
  const ziel = $(`[data-fehler-fuer="${id}"]`);
  if (ziel) ziel.textContent = text || '';
  if (text) feld.setAttribute('aria-invalid', 'true'); else feld.removeAttribute('aria-invalid');
  return !text;
}
function telefonPruefen(id) {
  const tel = document.getElementById(id).value.trim();
  const ziffern = tel.replace(/\D/g, '');
  if (!tel) return fehler(id, 'Bitte geben Sie eine Telefonnummer an, unter der wir Sie erreichen.');
  if (ziffern.length < 9 || /[^\d\s+()\/.-]/.test(tel)) return fehler(id, 'Diese Nummer sieht unvollständig aus. Bitte mit Vorwahl, im Format 044 000 00 00.');
  return fehler(id, '');
}
function namePruefen(id) {
  return fehler(id, document.getElementById(id).value.trim().length < 2 ? 'Bitte geben Sie Ihren Namen an.' : '');
}
const TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function heute0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function ausIso(s) { const t = s.split('-'); return new Date(+t[0], +t[1] - 1, +t[2]); }
function langDatum(d) { return TAGE_LANG[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear(); }
function lesen(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function schreiben(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); return true; } catch (e) { return false; } }
function entfernen(k) { try { localStorage.removeItem(k); } catch (e) { /* privat */ } }

/* ---------- Take-away (Demo) ---------- */
(function takeaway() {
  const form = $('[data-take-form]');
  if (!form) return;
  const SPEICHER = 'fumo-takeaway';
  const PIZZEN = [['Margherita', 19], ['Marinara', 16], ['Diavola', 23], ['Quattro formaggi', 24], ['Funghi e salsiccia', 25], ['Mortadella e pistacchio', 26]];
  const mengen = PIZZEN.map(() => 0);
  const liste = $('[data-take-liste]'), summe = $('[data-take-summe]'), fehlerListe = $('[data-take-fehler-liste]');
  const zeitSel = $('#take-zeit'), zeitHilfe = $('[data-take-zeit-hilfe]');
  const buehne = $('[data-schachtel-buehne]'), schachtel = $('[data-schachtel]');
  const best = $('[data-take-best]'), bestText = $('[data-take-best-text]');
  const senden = $('[data-take-senden]');
  senden.disabled = false;
  const chf = (n) => n.toFixed(2);
  const mz = (min) => String(Math.floor(min / 60)).padStart(2, '0') + '.' + String(min % 60).padStart(2, '0');

  PIZZEN.forEach(([name, preis], i) => {
    const li = document.createElement('li');
    li.innerHTML = `<div><span class="name">${name}</span><span class="preis">${chf(preis)}</span></div>
      <div class="menge"><button type="button" data-minus aria-label="Eine ${name} weniger" disabled><svg aria-hidden="true"><use href="#minus"/></svg></button><output aria-label="Anzahl ${name}">0</output><button type="button" data-plus aria-label="Eine ${name} mehr"><svg aria-hidden="true"><use href="#plus"/></svg></button></div>`;
    $('[data-minus]', li).addEventListener('click', () => setzen(i, mengen[i] - 1));
    $('[data-plus]', li).addEventListener('click', () => setzen(i, mengen[i] + 1));
    liste.appendChild(li);
  });
  function setzen(i, n) {
    mengen[i] = klemm(n, 0, 9);
    const li = liste.children[i];
    $('output', li).textContent = String(mengen[i]);
    $('[data-minus]', li).disabled = mengen[i] <= 0;
    $('[data-plus]', li).disabled = mengen[i] >= 9;
    zusammenfassen();
  }
  function zusammenfassen() {
    const anzahl = mengen.reduce((a, b) => a + b, 0);
    const betrag = mengen.reduce((a, m, i) => a + m * PIZZEN[i][1], 0);
    summe.classList.toggle('leer', anzahl === 0);
    summe.textContent = anzahl === 0 ? 'Noch keine Pizza gewählt.' : `${anzahl} ${anzahl === 1 ? 'Pizza' : 'Pizzen'}, CHF ${chf(betrag)}`;
    if (anzahl) fehlerListe.textContent = '';
  }

  /* Abholzeiten: Montag geschlossen; Dienstag bis Samstag 11.30 bis 13.45 und 17.30 bis 21.45; Sonntag nur abends (Öffnungszeiten 17 bis 22 Uhr) */
  function fenster(d) {
    const w = d.getDay();
    if (w === 1) return [];
    const f = [];
    if (w !== 0) f.push([690, 825]);
    f.push([1050, 1305]);
    return f;
  }
  function zeitenAm(d, abMin) {
    const r = [];
    fenster(d).forEach(([a, b]) => { for (let m = a; m <= b; m += 15) if (m >= abMin) r.push(m); });
    return r;
  }
  function zeitenFuellen() {
    const jetzt = new Date();
    const ab = Math.ceil((jetzt.getHours() * 60 + jetzt.getMinutes() + 20) / 15) * 15;
    const alt = zeitSel.value;
    zeitSel.innerHTML = '';
    const heute = zeitenAm(jetzt, ab);
    if (heute.length) {
      // Vor der ersten Abholzeit (etwa Sonntag am Nachmittag) die Zeit nennen, sonst "in 20 Minuten"
      zeitHilfe.textContent = heute[0] > ab ? `Heute ab ${mz(heute[0])} Uhr.` : 'Frühestens in 20 Minuten.';
      heute.forEach((m) => { const o = new Option(mz(m) + ' Uhr', iso(jetzt) + '|' + m); zeitSel.add(o); });
    } else {
      let d = heute0(), tage = 0, liste2 = [];
      while (tage < 8 && !liste2.length) { d.setDate(d.getDate() + 1); tage++; liste2 = zeitenAm(d, 0); }
      const wann = tage === 1 ? 'morgen' : 'am ' + TAGE_LANG[d.getDay()];
      // Geschlossen nur an Ruhetagen; an offenen Tagen nach 21.45 gibt es bloss keine Abholung mehr
      const anfang = fenster(jetzt).length ? 'Heute keine Abholung mehr' : 'Heute geschlossen';
      zeitHilfe.textContent = `${anfang}, ${wann} ab ${mz(liste2[0])} Uhr.`;
      liste2.forEach((m) => { const o = new Option(`${wann}, ${mz(m)} Uhr`, iso(d) + '|' + m); zeitSel.add(o); });
    }
    if (alt && $$('option', zeitSel).some((o) => o.value === alt)) zeitSel.value = alt;
  }
  zeitenFuellen();
  zeitSel.addEventListener('focus', zeitenFuellen);
  ['take-name', 'take-telefon'].forEach((id) => document.getElementById(id).addEventListener('input', () => fehler(id, '')));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const anzahl = mengen.reduce((a, b) => a + b, 0);
    let ok = true, erstes = null;
    if (!anzahl) { fehlerListe.textContent = 'Bitte wählen Sie mindestens eine Pizza.'; ok = false; erstes = erstes || $('[data-plus]', liste); }
    if (!namePruefen('take-name')) { ok = false; erstes = erstes || $('#take-name'); }
    if (!telefonPruefen('take-telefon')) { ok = false; erstes = erstes || $('#take-telefon'); }
    // Abholzeit beim Absenden neu prüfen: ist die gewählte inzwischen vorbei, nicht stillschweigend ersetzen
    const gewaehlt = zeitSel.value;
    zeitenFuellen();
    if (!gewaehlt || zeitSel.value !== gewaehlt) {
      ok = false; erstes = erstes || zeitSel;
      if (gewaehlt) zeitHilfe.textContent = 'Diese Abholzeit ist vorbei. Bitte wählen Sie eine neue.';
    }
    if (!ok) { if (erstes) erstes.focus(); return; }
    const [tag, min] = zeitSel.value.split('|');
    const d = ausIso(tag);
    const istHeute = tag === iso(new Date());
    const morgen = heute0(); morgen.setDate(morgen.getDate() + 1);
    const wann = istHeute ? '' : (tag === iso(morgen) ? 'morgen, ' : TAGE_LANG[d.getDay()] + ', ');
    const nummer = 'F-' + String(1000 + Math.floor(Math.random() * 9000));
    const name = $('#take-name').value.trim();
    const bestellung = { name, telefon: $('#take-telefon').value.trim(), tag, zeit: mz(+min), positionen: PIZZEN.map((p, i) => [p[0], mengen[i]]).filter((p) => p[1] > 0), nummer, demo: true, angelegt: new Date().toISOString() };
    schreiben(SPEICHER, bestellung);
    bestText.textContent = `Danke, ${name}. Ihre Bestellung ${nummer} ist für ${wann}${bestellung.zeit} Uhr bereit.`;
    form.hidden = true;
    schachtel.classList.remove('zu');
    buehne.classList.add('an');
    springeZu(buehne, kopfH() + 40);
    requestAnimationFrame(() => requestAnimationFrame(() => schachtel.classList.add('zu')));
    setTimeout(() => { best.hidden = false; best.focus({ preventScroll: true }); }, 950);
  });
  function zurueck() {
    best.hidden = true; buehne.classList.remove('an'); schachtel.classList.remove('zu');
    form.hidden = false;
    PIZZEN.forEach((p, i) => setzen(i, 0));
    zeitenFuellen();
    springeZu($('#take-away'), kopfH() + 8);
  }
  $('[data-take-neu]').addEventListener('click', () => { zurueck(); const p = $('[data-plus]', liste); if (p) p.focus({ preventScroll: true }); });
  $('[data-take-loeschen]').addEventListener('click', () => {
    entfernen(SPEICHER);
    $('#take-name').value = ''; $('#take-telefon').value = '';
    zurueck();
    $('#take-name').focus({ preventScroll: true });
  });
  const alt = lesen(SPEICHER);
  if (alt) { if (alt.name) $('#take-name').value = alt.name; if (alt.telefon) $('#take-telefon').value = alt.telefon; }
})();

/* ---------- Reservierung (Demo), Logik aus v2 mit den Zeiten der Pizzeria ---------- */
(function reservierung() {
  const FENSTER_TAGE = 60;
  const SPEICHER = 'fumo-demo-reservierung';
  const MAX_P = 10;
  function zu(d) { return d.getDay() === 1; }
  function imFenster(d) { const h = heute0(); const ende = new Date(h); ende.setDate(h.getDate() + FENSTER_TAGE); return d >= h && d <= ende; }
  function personenText(n) { return n + (n === 1 ? ' Person' : ' Personen'); }
  function zeitenFuer(d) {
    if (d.getDay() === 0) return ['17.00', '17.30', '18.00', '18.30', '19.00', '19.30', '20.00', '20.30'];
    return ['11.30', '12.00', '12.30', '13.00', '17.30', '18.00', '18.30', '19.00', '19.30', '20.00', '20.30', '21.00', '21.30'];
  }
  /* Gleichbleibend "ausgebucht" je Tag und Zeit, damit die Demo echt wirkt, ohne Zufall bei jedem Laden */
  function ausgebucht(d, z) {
    const s = iso(d) + z; let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
    const w = d.getDay();
    const schwelle = (w === 5 || w === 6) && (z === '19.00' || z === '19.30' || z === '20.00') ? 560 : 260;
    return h < schwelle;
  }
  function vorbei(d, z) {
    const jetzt = new Date();
    if (iso(d) !== iso(jetzt)) return false;
    const t = z.split('.');
    const slot = new Date(d); slot.setHours(+t[0], +t[1], 0, 0);
    return slot.getTime() - jetzt.getTime() < 60 * 60 * 1000;
  }
  function freieZeiten(d) { return zeitenFuer(d).filter((z) => !ausgebucht(d, z) && !vorbei(d, z)); }
  function ersterOffenerTag() {
    const d = heute0();
    for (let i = 0; i <= FENSTER_TAGE; i++) { const t = new Date(d); t.setDate(d.getDate() + i); if (!zu(t) && freieZeiten(t).length) return t; }
    return null;
  }

  const zustand = { datum: null, zeit: null, personen: 2, monat: null };
  const form = $('[data-res-form]');
  if (!form) return;
  const sendenKnopf = $('[data-res-senden]');
  if (sendenKnopf) sendenKnopf.disabled = false;
  const kalTage = $('[data-kal-tage]'), kalMonat = $('[data-kal-monat]'), kalZurueck = $('[data-kal-zurueck]'), kalVor = $('[data-kal-vor]');
  const zeitenBox = $('[data-zeiten]'), zeitenHilfe = $('[data-zeiten-hilfe]');
  const pWert = $('[data-personen-wert]'), pText = $('[data-personen-text]'), pMinus = $('[data-personen-minus]'), pPlus = $('[data-personen-plus]');
  const fehlerAllg = $('[data-fehler-allgemein]');
  const best = $('[data-bestaetigung]');
  const blaetter = $('[data-blaetter]');
  const hilfeText = (d) => 'Freie Zeiten am ' + langDatum(d) + (d.getDay() === 0 ? ', nur abends.' : '.');

  function kalenderZeichnen() {
    const h = heute0();
    if (!zustand.monat) zustand.monat = new Date(h.getFullYear(), h.getMonth(), 1);
    const m = zustand.monat;
    kalMonat.textContent = MONATE[m.getMonth()] + ' ' + m.getFullYear();
    kalTage.innerHTML = '';
    const erster = new Date(m.getFullYear(), m.getMonth(), 1);
    const versatz = (erster.getDay() + 6) % 7;
    for (let i = 0; i < versatz; i++) { const leer = document.createElement('span'); kalTage.appendChild(leer); }
    const tageImMonat = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (let t = 1; t <= tageImMonat; t++) {
      const d = new Date(m.getFullYear(), m.getMonth(), t);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kal__tag'; b.textContent = String(t);
      b.setAttribute('data-iso', iso(d));
      const geschlossen = zu(d);
      const frei = imFenster(d) && !geschlossen && freieZeiten(d).length > 0;
      let label = langDatum(d);
      if (geschlossen) { b.classList.add('kal__tag--zu'); label += ', geschlossen'; }
      else if (imFenster(d) && !frei) label += ', ausgebucht';
      if (iso(d) === iso(h)) { b.classList.add('kal__tag--heute'); label += ', heute'; }
      b.setAttribute('aria-label', label);
      b.disabled = !frei;
      b.setAttribute('aria-pressed', String(zustand.datum === iso(d)));
      kalTage.appendChild(b);
    }
    const minMonat = new Date(h.getFullYear(), h.getMonth(), 1);
    const ende = new Date(h); ende.setDate(h.getDate() + FENSTER_TAGE);
    const maxMonat = new Date(ende.getFullYear(), ende.getMonth(), 1);
    kalZurueck.disabled = m <= minMonat;
    kalVor.disabled = m >= maxMonat;
  }
  kalTage.addEventListener('click', (e) => { const b = e.target.closest('.kal__tag'); if (!b || b.disabled) return; tagWaehlen(b.getAttribute('data-iso')); });
  kalZurueck.addEventListener('click', () => { zustand.monat = new Date(zustand.monat.getFullYear(), zustand.monat.getMonth() - 1, 1); kalenderZeichnen(); });
  kalVor.addEventListener('click', () => { zustand.monat = new Date(zustand.monat.getFullYear(), zustand.monat.getMonth() + 1, 1); kalenderZeichnen(); });

  function tagWaehlen(isoTag) {
    zustand.datum = isoTag;
    const d = ausIso(isoTag);
    zustand.monat = new Date(d.getFullYear(), d.getMonth(), 1);
    if (zustand.zeit && freieZeiten(d).indexOf(zustand.zeit) === -1) zustand.zeit = null;
    kalenderZeichnen(); zeitenZeichnen(); belegAktualisieren();
  }
  function zeitenZeichnen() {
    zeitenBox.innerHTML = '';
    if (!zustand.datum) { zeitenHilfe.textContent = 'Wählen Sie zuerst einen Tag im Kalender.'; return; }
    const d = ausIso(zustand.datum);
    zeitenHilfe.textContent = hilfeText(d);
    zeitenFuer(d).forEach((z) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'zeit'; b.textContent = z;
      const weg = ausgebucht(d, z) || vorbei(d, z);
      b.disabled = weg;
      b.setAttribute('aria-label', z + ' Uhr' + (weg ? ', nicht mehr frei' : ''));
      b.setAttribute('aria-pressed', String(zustand.zeit === z));
      b.setAttribute('data-zeit', z);
      zeitenBox.appendChild(b);
    });
  }
  zeitenBox.addEventListener('click', (e) => {
    const b = e.target.closest('.zeit');
    if (!b || b.disabled) return;
    zustand.zeit = b.getAttribute('data-zeit');
    $$('.zeit', zeitenBox).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    fehlerAllg.textContent = '';
    belegAktualisieren();
  });
  function personenSetzen(n) {
    zustand.personen = Math.max(1, Math.min(MAX_P, n));
    pWert.textContent = String(zustand.personen);
    pText.textContent = zustand.personen === 1 ? 'Person' : (zustand.personen === MAX_P ? 'Personen. Für grössere Gruppen schreiben Sie uns einen Wunsch.' : 'Personen');
    pMinus.disabled = zustand.personen <= 1;
    pPlus.disabled = zustand.personen >= MAX_P;
    belegAktualisieren();
  }
  pMinus.addEventListener('click', () => personenSetzen(zustand.personen - 1));
  pPlus.addEventListener('click', () => personenSetzen(zustand.personen + 1));
  function belegAktualisieren() {
    const tag = $('[data-beleg-tag]'), zeit = $('[data-beleg-zeit]'), pers = $('[data-beleg-personen]');
    tag.textContent = zustand.datum ? langDatum(ausIso(zustand.datum)) : 'noch offen';
    tag.classList.toggle('ist-offen', !zustand.datum);
    zeit.textContent = zustand.zeit ? zustand.zeit + ' Uhr' : 'noch offen';
    zeit.classList.toggle('ist-offen', !zustand.zeit);
    pers.textContent = personenText(zustand.personen);
  }
  ['res-name', 'res-telefon'].forEach((id) => document.getElementById(id).addEventListener('input', () => fehler(id, '')));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#res-name').value.trim();
    const tel = $('#res-telefon').value.trim();
    const wunsch = $('#res-wunsch').value.trim();
    let ok = true, erstesFeld = null;
    fehlerAllg.textContent = '';
    if (!zustand.datum || !zustand.zeit) {
      fehlerAllg.textContent = !zustand.datum ? 'Bitte wählen Sie zuerst einen Tag im Kalender.' : 'Bitte wählen Sie eine Uhrzeit.';
      ok = false;
    }
    if (!namePruefen('res-name')) { ok = false; erstesFeld = erstesFeld || 'res-name'; }
    if (!telefonPruefen('res-telefon')) { ok = false; erstesFeld = erstesFeld || 'res-telefon'; }
    if (!ok) {
      if (!zustand.datum || !zustand.zeit) scrolleZu(zustand.datum ? zeitenBox : $('[data-kal]'), -(kopfH() + 40));
      else if (erstesFeld) document.getElementById(erstesFeld).focus();
      return;
    }
    const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let nummer = 'FU-';
    for (let i = 0; i < 5; i++) nummer += zeichen[Math.floor(Math.random() * zeichen.length)];
    const res = { datum: zustand.datum, zeit: zustand.zeit, personen: zustand.personen, name, telefon: tel, wunsch, nummer, angelegt: new Date().toISOString(), demo: true };
    schreiben(SPEICHER, res);
    bestaetigungZeigen(res);
  });
  function bestaetigungZeigen(res) {
    $('[data-best-name]').textContent = res.name;
    $('[data-best-tag]').textContent = langDatum(ausIso(res.datum));
    $('[data-best-zeit]').textContent = res.zeit + ' Uhr';
    $('[data-best-personen]').textContent = personenText(res.personen);
    $('[data-best-telefon]').textContent = res.telefon;
    $('[data-best-wunsch]').textContent = res.wunsch;
    $('[data-best-wunsch-zeile]').hidden = !res.wunsch;
    $('[data-best-nummer]').textContent = res.nummer + ' (Demo)';
    form.hidden = true;
    best.hidden = false;
    // Weiches Aufleuchten in Pomodoro, dazu drei aufsteigende Basilikumblätter (ruhig: nur Aufleuchten)
    best.classList.remove('leuchten'); blaetter.classList.remove('los');
    void best.offsetWidth;
    best.classList.add('leuchten');
    if (!ruhig) blaetter.classList.add('los');
    if (lenis) lenis.resize();
    springeZu(best, kopfH() + 60);
    best.focus({ preventScroll: true });
  }
  $('[data-res-neu]').addEventListener('click', () => {
    best.hidden = true; form.hidden = false;
    zustand.zeit = null;
    if (zustand.datum) zeitenZeichnen();
    belegAktualisieren();
    if (lenis) lenis.resize();
    springeZu($('[data-kal]'), kopfH() + 60);
    const erste = $('.kal__tag[aria-pressed="true"]') || $('.kal__tag:not([disabled])');
    if (erste) erste.focus({ preventScroll: true });
  });
  $('[data-res-loeschen]').addEventListener('click', () => {
    entfernen(SPEICHER);
    $('#res-name').value = ''; $('#res-telefon').value = ''; $('#res-wunsch').value = '';
    best.hidden = true; form.hidden = false;
    zustand.zeit = null;
    zeitenZeichnen(); belegAktualisieren();
    fehlerAllg.textContent = '';
    if (lenis) lenis.resize();
    springeZu($('.res__angaben'), kopfH() + 60);
    $('#res-name').focus({ preventScroll: true });
  });

  /* Start: frühester freier Tag vorgewählt, gespeicherte Angaben zurück */
  const alt = lesen(SPEICHER);
  if (alt) { if (alt.name) $('#res-name').value = alt.name; if (alt.telefon) $('#res-telefon').value = alt.telefon; }
  const erster = ersterOffenerTag();
  if (erster) tagWaehlen(iso(erster)); else { kalenderZeichnen(); zeitenZeichnen(); }
  personenSetzen(2);
})();

/* ---------- Nur für die Sichtprüfung: ?pruefung=formulare füllt beide Demo-Formulare aus und zeigt eine Vorschau der Karte ---------- */
if (/[?&]pruefung=formulare/.test(location.search)) {
  setTimeout(() => {
    const plus = $$('[data-take-liste] [data-plus]');
    if (plus.length > 2) { plus[0].click(); plus[2].click(); }
    $('#take-name').value = 'Anna Muster'; $('#take-telefon').value = '044 000 00 00';
    $('[data-take-form]').requestSubmit();
    const z = $('.zeit:not([disabled])'); if (z) z.click();
    $('#res-name').value = 'Anna Muster'; $('#res-telefon').value = '044 000 00 00';
    $('[data-res-form]').requestSubmit();
    const li = $('.gericht[data-bild="diavola"]');
    if (vorschauMq.matches) li.dispatchEvent(new MouseEvent('mouseenter')); else $('.gericht__zeile', li).click();
    window.scrollTo(0, 0); if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  }, 400);
}
/* Nur für die Sichtprüfung: meldet eine horizontale Scrollleiste und zu kleine Tippziele als Konsolenfehler */
if (/[?&]pruefung=/.test(location.search)) {
  setTimeout(() => {
    const sw = document.documentElement.scrollWidth;
    if (sw > innerWidth) console.error(`Prüfung: horizontale Scrollleiste, scrollWidth ${sw} > ${innerWidth}`);
    const klein = $$('a, button, select, input, textarea').filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.hinweis, .sprung, .fuss nav, .gericht') && (r.height < 44 || r.width < 44);
    }).map((el) => (el.textContent || el.id || el.tagName).trim().slice(0, 24));
    if (klein.length) console.error('Prüfung: Tippziele unter 44 px: ' + klein.slice(0, 6).join(' | '));
  }, 1500);
}
