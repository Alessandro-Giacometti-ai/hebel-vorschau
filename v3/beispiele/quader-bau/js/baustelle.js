/* Quader Bau, v3: die Baustelle als Erzählung.
   Hero (Zeitraffer, betonierte Titelzeilen, Kranseil, Absperrband), Arc-Wipes zwischen den Kapiteln,
   der Plan, der sich zeichnet, der Rohbau in Three.js, Leistungen mit Folgebild und die Offerte aus v2.
   Selbstlaufende Bewegung fällt im ruhigen Modus (Knopf "Bewegung") weg, alles Scroll-Gekoppelte bleibt. */
import * as THREE from 'three';

const html = document.documentElement;
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => Array.from(w.querySelectorAll(s));
/* Ruhig nur, wenn der Besucher es selbst gewählt hat (Klasse ruhig aus localStorage hebel-ruhig, gesetzt im Kopf).
   Die Systemeinstellung "reduzierte Bewegung" schaltet nichts ab. Der Knopf "Bewegung" schaltet live um. */
let REDUZIERT = html.classList.contains('ruhig');
document.addEventListener('hebel-ruhig', e => { REDUZIERT = !!e.detail; lenisSetzen(); });
const FEIN = matchMedia('(hover: hover) and (pointer: fine)').matches;
const istMobil = () => innerWidth <= 760;
const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const bereich = (x, a, b) => klemmen((x - a) / (b - a));
const glatt = t => t * t * (3 - 2 * t);
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const koteText = (m, null0 = true) => (m < 0.005 && null0 ? '±0.00' : (m < 0 ? '-' : '+') + Math.abs(m).toFixed(2));

/* ================= Takt, Lenis, ScrollTrigger ================= */
const takt = new Set();
let zeit = 0;
let lenis = null;
const scroll = { y: window.scrollY, tempo: 0 };
let letzteY = window.scrollY;

function schritt(dt) {
  zeit += dt;
  const y = window.scrollY;
  const roh = lenis ? lenis.velocity * 60 : (y - letzteY) / Math.max(dt, 1e-3);
  scroll.tempo = damp(scroll.tempo, roh, 10, dt);
  scroll.y = y;
  letzteY = y;
  for (const f of takt) {
    try { f(dt, zeit); } catch (e) { console.warn('Takt:', e && e.message); takt.delete(f); }
  }
}

/* Weiches Scrollen nur ausserhalb des ruhigen Modus. respectReducedMotion: false, sonst schaltet
   Lenis bei der Systemeinstellung selbst ab. */
function lenisSetzen() {
  const ST = window.ScrollTrigger;
  if (REDUZIERT && lenis) { lenis.destroy(); lenis = null; }
  else if (!REDUZIERT && !lenis && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true, respectReducedMotion: false });
    if (ST) lenis.on('scroll', ST.update);
  }
  if (window.__quader) window.__quader.lenis = lenis;
}

function motorStarten() {
  const G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  lenisSetzen();
  let letzte = performance.now();
  const tick = () => {
    const jetzt = performance.now();
    const dt = Math.min(0.05, (jetzt - letzte) / 1000);
    letzte = jetzt;
    if (lenis) lenis.raf(jetzt);
    schritt(dt);
  };
  if (G) { G.ticker.add(tick); G.ticker.lagSmoothing(0); }
  else { const loop = () => { tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  window.__quader = { lenis, takt, scroll };
}

/* Fortschritt einer Strecke: per ScrollTrigger, sonst aus dem Rechteck. */
function strecke(el, start, ende, beiP) {
  const ST = window.ScrollTrigger;
  if (ST) {
    ST.create({ trigger: el, start, end: ende, onUpdate: s => beiP(s.progress), onRefresh: s => beiP(s.progress) });
    return;
  }
  takt.add(() => {
    const r = el.getBoundingClientRect();
    if (start === 'top bottom') beiP(klemmen((innerHeight - r.top) / innerHeight));
    else beiP(klemmen(-r.top / Math.max(1, (typeof ende === 'function' ? parseFloat(String(ende()).replace('+=', '')) : r.height))));
  });
}

/* Sichtbarkeit einer Bühne: Rendern nur, wenn sie zu sehen ist. */
function sichtbar(el, rand = '0px') {
  const z = { an: false };
  new IntersectionObserver(e => { z.an = e[e.length - 1].isIntersecting; }, { rootMargin: rand }).observe(el);
  return z;
}

/* ================= Live-Kote im Kopf ================= */
const liveKoteFeld = $('[data-live-kote]');
let liveKoteText = '';
function liveKote(m) {
  const t = (m < 0 ? '-' : '+') + Math.abs(m).toFixed(2) + ' m';
  if (t !== liveKoteText) { liveKoteFeld.textContent = t; liveKoteText = t; }
}

/* ================= Absperrband: Laufschrift am Scroll ================= */
function baender() {
  const TEXT = 'QUADER BAU · BAUSTELLE · BETRETEN AUF EIGENE NEUGIER · ';
  const laeufe = $$('[data-lauf]').map(el => {
    for (let i = 0; i < 10; i++) { const s = document.createElement('span'); s.textContent = TEXT; el.appendChild(s); }
    return { el, dir: Number(el.dataset.lauf) || 1, breite: 0 };
  });
  const messen = () => laeufe.forEach(l => { l.breite = l.el.firstChild.getBoundingClientRect().width || 600; });
  document.fonts.ready.then(messen);
  addEventListener('resize', messen);
  let letztY = -1;
  takt.add(() => {
    if (scroll.y === letztY) return;
    letztY = scroll.y;
    for (const l of laeufe) {
      if (!l.breite) continue;
      const v = (scroll.y * 0.55) % l.breite;
      const x = l.dir < 0 ? -v : -(l.breite - v);
      l.el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    }
  });
}

/* ================= Arc-Wipe zwischen den Kapiteln ================= */
function wipes() {
  const wipe = $('[data-wipe]'), paneel = $('[data-wipe-paneel]'), kante = $('[data-wipe-kante]');
  const nr = $('[data-wipe-nr]'), name = $('[data-wipe-name]'), kote = $('[data-wipe-kote]');
  const stand = new Map();
  let aktiv = null;
  $$('[data-wechsel]').forEach(w => {
    stand.set(w, 0);
    strecke(w, 'top bottom', 'top top', p => { stand.set(w, p); });
  });
  let letzt = '';
  takt.add(() => {
    let w = null, p = 0;
    for (const [el, v] of stand) if (v > 0 && v < 1) { w = el; p = v; break; }
    if (!w) {
      if (letzt !== 'aus') { wipe.classList.remove('ist-an'); letzt = 'aus'; }
      return;
    }
    if (aktiv !== w) {
      aktiv = w;
      nr.textContent = w.dataset.nr;
      name.textContent = w.dataset.name;
      kote.textContent = w.dataset.kote;
    }
    const sig = w.dataset.nr + p.toFixed(4);
    if (sig === letzt) return;
    letzt = sig;
    wipe.classList.add('ist-an');
    const vh = innerHeight;
    if (REDUZIERT) {
      paneel.style.clipPath = 'none';
      /* Überblenden, aber vor dem Ende ganz weg, damit keine Reste hinter dem nächsten Kapitel stehen */
      paneel.style.opacity = (klemmen(p / 0.2) * klemmen((0.86 - p) / 0.16)).toFixed(3);
      kante.style.opacity = '0';
      return;
    }
    let kanteY;
    if (p < 0.5) {
      const a = (1 - p * 2) * 100;
      paneel.style.clipPath = `inset(${a.toFixed(3)}% 0 0 0)`;
      kanteY = a / 100 * vh;
    } else {
      const b = (p - 0.5) * 2 * 100;
      paneel.style.clipPath = `inset(0 0 ${b.toFixed(3)}% 0)`;
      kanteY = (1 - b / 100) * vh;
    }
    kante.style.transform = `translate3d(0,${kanteY.toFixed(1)}px,0)`;
    nr.style.transform = `translate3d(0,${((0.5 - p) * 80).toFixed(1)}px,0)`;
  });
}

/* ================= Kapitel 1: Grundstück ================= */
async function held() {
  const sek = $('[data-held]'), buehne = $('[data-held-buehne]'), film = $('[data-film]');
  const ctx = film.getContext('2d', { alpha: false });
  const titel = $('[data-titel]');
  const zeilen = $$('[data-zeile]', sek).map(z => ({ el: z, guss: $('.tz__guss', z) }));
  const pendel = $('[data-pendel]'), seil = $('[data-seil]');
  const bautafel = $('[data-bautafel]'), koteFeld = $('[data-held-kote]'), unterzeile = $('[data-held-zeile]');
  const bandhalter = $('[data-bandhalter]');
  const sicht = sichtbar(buehne, '100px');
  let h = 0;
  strecke(sek, 'top top', () => '+=' + Math.max(1, sek.offsetHeight - 2 * buehne.offsetHeight), p => { h = p; });

  /* Zeitraffer: Einzelbilder in Stufen laden */
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
        try { await img.decode(); bilder[i] = img; neu = true; } catch (e) { /* Bild fehlt, das nächste geladene wird gezeigt */ }
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
  let filmW = 0, filmH = 0, gezeigt = -1, gezeigtBild = null;
  function groesse() {
    const dpr = Math.min(devicePixelRatio || 1, istMobil() ? 1.5 : 1.75);
    filmW = Math.round(film.clientWidth * dpr); filmH = Math.round(film.clientHeight * dpr);
    film.width = filmW; film.height = filmH;
    gezeigt = -1; neu = true;
    basis();
  }
  function zeichneFilm() {
    const i = Math.round(h * (N - 1));
    const img = naechstes(i);
    if (!img || (i === gezeigt && img === gezeigtBild && !neu)) return;
    neu = false; gezeigt = i; gezeigtBild = img;
    const s = Math.max(filmW / img.naturalWidth, filmH / img.naturalHeight);
    const w = img.naturalWidth * s, hh = img.naturalHeight * s;
    ctx.drawImage(img, (filmW - w) / 2, (filmH - hh) / 2, w, hh);
  }

  /* Ebenen und Zeiger */
  const zg = { x: 0, y: 0, sx: 0, sy: 0 };
  if (FEIN) addEventListener('pointermove', e => { zg.x = (e.clientX / innerWidth - 0.5) * 2; zg.y = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  else {
    let lx = 0, ly = 0, lt = 0;
    buehne.addEventListener('touchstart', e => { const t = e.touches[0]; lx = t.clientX; ly = t.clientY; lt = performance.now(); }, { passive: true });
    buehne.addEventListener('touchmove', e => {
      const t = e.touches[0], j = performance.now(), dt = Math.max(8, j - lt);
      zg.x = klemmen(((t.clientX - lx) / dt) * 1.6, -1, 1);
      zg.y = klemmen(((t.clientY - ly) / dt) * 0.8, -1, 1);
      lx = t.clientX; ly = t.clientY; lt = j;
    }, { passive: true });
  }

  /* Basismasse für das Seil: Oberkante von "steht." in der Bühne */
  let wortOben = 0, titelUnten = 0, fs = 100, versetzt = false, kopfUnten = 122;
  function basis() {
    titel.style.transform = 'none';
    zeilen.forEach(z => { z.el.style.transform = 'none'; });
    /* "steht." rückt neben "was", damit das Gehänge am Kranseil kein Wort durchstreicht.
       Passt es nicht in die Breite, bleibt die Zeile links. */
    const z2 = zeilen[2].el, z1 = zeilen[1].el;
    z2.style.marginLeft = '0px';
    fs = parseFloat(getComputedStyle(titel).fontSize) || 100;
    const platz = titel.clientWidth, wasB = z1.offsetWidth, stehtB = z2.offsetWidth;
    const einzug = wasB + fs * 0.16;
    versetzt = einzug + stehtB <= platz;
    z2.style.marginLeft = (versetzt ? einzug : Math.max(0, Math.min(platz - stehtB, wasB * 0.35))).toFixed(1) + 'px';
    wortOben = titel.offsetTop + z2.offsetTop;
    const kopf = document.querySelector('.kopf');
    kopfUnten = kopf ? kopf.getBoundingClientRect().bottom : 122; /* Bühne klebt bei 0, der Kopf darunter fest */
    titelUnten = titel.offsetTop + titel.offsetHeight;
  }
  addEventListener('resize', groesse);
  await document.fonts.ready;
  groesse();

  const FUELL = [[0.05, 0.35], [0.25, 0.55], [0.45, 0.75]];
  const FAKTOR = [0.35, 0.6, 0.9];
  let amp = 1.5, letzteH = -1, letzteKote = '';
  takt.add((dt, t) => {
    if (!sicht.an) return;
    zeichneFilm();
    const kg = REDUZIERT ? 1 : 0.12;
    zg.sx = lerp(zg.sx, zg.x, kg); zg.sy = lerp(zg.sy, zg.y, kg);
    if (!FEIN) { zg.x *= Math.exp(-4 * dt); zg.y *= Math.exp(-4 * dt); }
    const vh = buehne.offsetHeight;
    if (h !== letzteH) {
      zeilen.forEach((z, i) => z.guss.style.setProperty('--fuell', (bereich(h, ...FUELL[i]) * 100).toFixed(2) + '%'));
      const kz = bereich(h, 0.75, 0.86);
      unterzeile.style.transform = `translate3d(0,${((1 - kz) * 160).toFixed(1)}%,0)`;
      unterzeile.style.opacity = kz.toFixed(3);
      const kt = koteText(14.2 * h);
      if (kt !== letzteKote) { koteFeld.textContent = kt; letzteKote = kt; }
      letzteH = h;
    }
    liveKote(14.2 * h);
    const ty = FAKTOR.map(f => -f * h * 0.4 * vh);
    /* Parallax nach Prompt (0.35, 0.6, 0.9), aber die Zeilen setzen aufeinander auf statt sich zu
       durchdringen: "was" darf nur bis an die Grundlinie von Zeile 1 steigen, "steht." nur bis an "was"
       bzw. (versetzt, neben "was") bis unter Zeile 1. */
    ty[1] = Math.max(ty[1], ty[0] - fs * 0.24);
    ty[2] = versetzt ? Math.max(ty[2], ty[0] - fs * 0.8) : Math.max(ty[2], ty[1] - fs * 0.04);
    /* Zeile 1 steigt nur, bis sie am Kopf ansteht; die Abstände der Zeilen bleiben */
    const hub = Math.max(0, titel.offsetTop - kopfUnten - fs * 0.12);
    if (ty[0] < -hub) { const d = -hub - ty[0]; for (let i = 0; i < 3; i++) ty[i] += d; }
    const aus = -glatt(bereich(h, 0.8, 1)) * (titelUnten + 60);
    titel.style.transform = `translate3d(${(zg.sx * 10).toFixed(2)}px,${(zg.sy * 10 + aus).toFixed(2)}px,0)`;
    zeilen.forEach((z, i) => { z.el.style.transform = `translate3d(0,${ty[i].toFixed(2)}px,0)`; });
    /* Kranseil: von der Bühnenoberkante bis zum Haken über "steht." */
    const oben = wortOben + ty[2] + aus;
    seil.style.height = Math.max(0, oben - 86 + 40).toFixed(1) + 'px';
    pendel.style.transformOrigin = `50% ${(-oben).toFixed(1)}px`;
    let winkel = 0;
    if (!REDUZIERT) {
      amp = damp(amp, 1.5 + Math.min(5, Math.abs(scroll.tempo) * 0.0035), 2.5, dt);
      winkel = Math.sin(t * 1.7) * amp;
    }
    pendel.style.transform = `rotate(${winkel.toFixed(3)}deg)`;
    film.style.transform = `translate3d(${(zg.sx * 4).toFixed(2)}px,${(zg.sy * 4).toFixed(2)}px,0)`;
    bandhalter.style.transform = `translate3d(${(zg.sx * 22).toFixed(2)}px,${(zg.sy * 22).toFixed(2)}px,0)`;
    bautafel.style.transform = `translate3d(${(zg.sx * 6).toFixed(2)}px,${(zg.sy * 6).toFixed(2)}px,0)`;
  });
}

/* ================= Kapitel 2: Plan ================= */
function rnd(seed) { let s = seed % 2147483647; return () => (s = s * 16807 % 2147483647) / 2147483647; }
function resample(P, step = 7) {
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
function Sk(seed) {
  const r = rnd(seed), S = [];
  const wob = (pts, amp) => {
    const a = r() * 6.3, b = r() * 6.3, f1 = 0.011 + r() * 0.012, f2 = 0.013 + r() * 0.012; let len = 0;
    return pts.map((p, i) => {
      if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      return [p[0] + Math.sin(len * f1 + a) * amp, p[1] + Math.sin(len * f2 + b) * amp];
    });
  };
  return {
    S,
    line(x1, y1, x2, y2, amp = 1.3) {
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, e1 = r() * 5, e2 = r() * 6;
      S.push({ pts: wob(resample([[x1 - dx / d * e1, y1 - dy / d * e1], [x2 + dx / d * e2, y2 + dy / d * e2]]), amp) });
    },
    linieGenau(x1, y1, x2, y2, amp = 0.5) { S.push({ pts: wob(resample([[x1, y1], [x2, y2]]), amp) }); },
    poly(P, amp = 1.2) { S.push({ pts: wob(resample(P), amp) }); },
    ell(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2.08, amp = 1.2) {
      const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) / 7)), P = [];
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
      S.push({ pts: wob(P, amp) });
    },
    text(text, x, y, size, rot = 0) { S.push({ text, x, y, size, rot }); },
  };
}

function planEntwurf(W, H, mobil, oben) {
  /* Meter-Ausdehnung inklusive Achsen, Bemassung und Nordpfeil */
  const mx0 = -5.3, mx1 = 29.6, my0 = -5.4, my1 = 15.6;
  let bx0, bx1, by0, by1;
  const rand = mobil ? 16 : Math.max(16, W * 0.044);
  if (mobil) { bx0 = rand; bx1 = W - rand; by0 = oben + 250; by1 = H - 150; }
  else { bx0 = rand + 10; bx1 = W - rand - 380 - 40; by0 = oben + 92; by1 = H - 112; }
  const s = Math.min((bx1 - bx0) / (mx1 - mx0), (by1 - by0) / (my1 - my0));
  const ox = bx0 + ((bx1 - bx0) - (mx1 - mx0) * s) / 2, oy = by0 + ((by1 - by0) - (my1 - my0) * s) / 2;
  const X = m => ox + (m - mx0) * s, Y = m => oy + (m - my0) * s;
  const k = Sk(41);
  const striche = [];
  const GRAPHIT = '#2B2B2E', PLAN = '#1B2A6B';
  const gruppe = (g, farbe, breite, fn) => {
    const a = k.S.length; fn(); for (let i = a; i < k.S.length; i++) striche.push(Object.assign(k.S[i], { g, farbe, breite }));
  };
  const schrift = Math.max(9, 0.42 * s), schriftKlein = Math.max(8.5, 0.36 * s);
  const AX = [0, 4.4, 9.6, 16.4, 21.6, 26], AY = [0, 5.2, 8.8, 14], AXN = 'ABCDEF';
  const AW = 0.35, IW = 0.18;
  const FNS = [2.2, 6.8, 11.2, 14.8, 19.2, 23.8], FB = 1.6, FOW = [2.6, 11.4], FBO = 1.4;

  const strichel = (x0, y0, x1, y1) => {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    for (let d = 0; d < L; d += 1.6) {
      const e = Math.min(L, d + 0.95);
      k.linieGenau(X(x0 + ux * d), Y(y0 + uy * d), X(x0 + ux * e), Y(y0 + uy * e), 0.4);
      const p = Math.min(L, d + 1.25);
      if (p < L - 0.05) k.linieGenau(X(x0 + ux * p), Y(y0 + uy * p), X(x0 + ux * (p + 0.08)), Y(y0 + uy * (p + 0.08)), 0.2);
    }
  };
  const textMitte = (t, x, y, size, rot = 0) => {
    /* Breite wird nach dem Messen korrigiert, siehe unten */
    k.text(t, X(x), Y(y), size, rot); k.S[k.S.length - 1].mitte = true;
  };
  /* Gruppe 0: Achsen */
  gruppe(0, PLAN, 1.2, () => {
    AX.forEach((x, i) => { strichel(x, -3.9, x, 15.2); k.ell(X(x), Y(-4.55), 0.55 * s, 0.55 * s, -1.6, -1.6 + Math.PI * 2.06, 0.5); textMitte(AXN[i], x, -4.55 + 0.2, schrift); });
    AY.forEach((y, i) => { strichel(-3.8, y, 27.4, y); k.ell(X(-4.45), Y(y), 0.55 * s, 0.55 * s, -1.6, -1.6 + Math.PI * 2.06, 0.5); textMitte(String(i + 1), -4.45, y + 0.2, schrift); });
  });
  /* Wände als Doppellinien mit Öffnungen */
  const wandH = (y, x0, x1, d, oeff, amp = 1) => {
    const ya = y - d / 2, yb = y + d / 2;
    const stuecke = [];
    let a = x0;
    for (const [o0, o1] of oeff.slice().sort((p, q) => p[0] - q[0])) { stuecke.push([a, o0]); a = o1; }
    stuecke.push([a, x1]);
    for (const [s0, s1] of stuecke) {
      if (s1 - s0 < 0.02) continue;
      k.line(X(s0), Y(ya), X(s1), Y(ya), amp); k.line(X(s0), Y(yb), X(s1), Y(yb), amp);
    }
    for (const [o0, o1] of oeff) { k.linieGenau(X(o0), Y(ya), X(o0), Y(yb), 0.3); k.linieGenau(X(o1), Y(ya), X(o1), Y(yb), 0.3); }
  };
  const wandV = (x, y0, y1, d, oeff, amp = 1) => {
    const xa = x - d / 2, xb = x + d / 2;
    const stuecke = [];
    let a = y0;
    for (const [o0, o1] of oeff.slice().sort((p, q) => p[0] - q[0])) { stuecke.push([a, o0]); a = o1; }
    stuecke.push([a, y1]);
    for (const [s0, s1] of stuecke) {
      if (s1 - s0 < 0.02) continue;
      k.line(X(xa), Y(s0), X(xa), Y(s1), amp); k.line(X(xb), Y(s0), X(xb), Y(s1), amp);
    }
    for (const [o0, o1] of oeff) { k.linieGenau(X(xa), Y(o0), X(xb), Y(o0), 0.3); k.linieGenau(X(xa), Y(o1), X(xb), Y(o1), 0.3); }
  };
  const fensterN = FNS.map(c => [c - FB / 2, c + FB / 2]);
  const fensterO = FOW.map(c => [c - FBO / 2, c + FBO / 2]);
  /* Gruppe 1: Aussenwände */
  gruppe(1, GRAPHIT, 2.2, () => {
    wandH(AW / 2, 0, 26, AW, fensterN, 1.1);
    wandV(26 - AW / 2, AW, 14 - AW, AW, fensterO, 1.1);
    wandH(14 - AW / 2, 0, 26, AW, fensterN, 1.1);
    wandV(AW / 2, AW, 14 - AW, AW, fensterO, 1.1);
  });
  /* Gruppe 2: Innenwände, Treppenhäuser */
  const tuerenGang = [7.6, 13.0, 18.4];
  const kerne = [[3.0, 6.4], [19.6, 23.0]];
  gruppe(2, GRAPHIT, 1.6, () => {
    wandH(5.2, AW, 26 - AW, IW, tuerenGang.map(c => [c - 0.5, c + 0.5]));
    wandH(8.8, AW, 26 - AW, IW, tuerenGang.map(c => [c - 0.5, c + 0.5]));
    wandV(9.6, AW, 5.2 - IW / 2, IW, []); wandV(16.4, AW, 5.2 - IW / 2, IW, []);
    wandV(9.6, 8.8 + IW / 2, 14 - AW, IW, []); wandV(16.4, 8.8 + IW / 2, 14 - AW, IW, []);
    kerne.forEach(([a, b], i) => {
      const tuerY = [[6.5, 7.5]];
      wandV(a, 5.2 + IW / 2, 8.8 - IW / 2, IW, i === 1 ? tuerY : []);
      wandV(b, 5.2 + IW / 2, 8.8 - IW / 2, IW, i === 0 ? tuerY : []);
    });
    /* Raumteilungen Nord und Süd */
    wandV(5.8, AW, 5.2 - IW / 2, 0.12, [[3.2, 4.1]]); wandH(2.4, 5.8, 9.6 - IW / 2, 0.12, [[8.2, 9.0]]);
    wandV(13.4, AW, 5.2 - IW / 2, 0.12, [[3.2, 4.1]]);
    wandV(20.2, AW, 5.2 - IW / 2, 0.12, [[3.2, 4.1]]); wandH(2.4, 16.4 + IW / 2, 20.2, 0.12, [[17.0, 17.8]]);
    wandV(5.8, 8.8 + IW / 2, 14 - AW, 0.12, [[9.9, 10.8]]); wandH(11.4, 5.8, 9.6 - IW / 2, 0.12, [[8.2, 9.0]]);
    wandV(13.4, 8.8 + IW / 2, 14 - AW, 0.12, [[9.9, 10.8]]);
    wandV(20.2, 8.8 + IW / 2, 14 - AW, 0.12, [[9.9, 10.8]]); wandH(11.4, 16.4 + IW / 2, 20.2, 0.12, [[17.0, 17.8]]);
  });
  gruppe(2, GRAPHIT, 1.2, () => {
    kerne.forEach(([a, b], i) => {
      const lauf0 = i === 0 ? a + 0.25 : b - 2.35, lauf1 = lauf0 + 2.1;
      for (let x = lauf0; x <= lauf1 + 0.01; x += 0.28) { k.linieGenau(X(x), Y(5.45), X(x), Y(6.85), 0.4); k.linieGenau(X(x), Y(7.15), X(x), Y(8.55), 0.4); }
      k.line(X(lauf0), Y(7.0), X(lauf1), Y(7.0), 0.6);
      const pf = i === 0 ? 1 : -1;
      k.poly([[X(lauf0 + (pf > 0 ? 0.2 : 1.9)), Y(6.15)], [X(lauf0 + (pf > 0 ? 1.9 : 0.2)), Y(6.15)]], 0.4);
    });
  });
  /* Gruppe 3: Türen und Fenster */
  const tuer = (hx, hy, w, wand, dir) => {
    /* Scharnier hx/hy, Türblatt senkrecht zur Wand, Viertelkreis bis zur anderen Laibung */
    if (wand === 'h') {
      k.linieGenau(X(hx), Y(hy), X(hx), Y(hy + dir * w), 0.3);
      const a0 = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      k.ell(X(hx), Y(hy), w * s, w * s, a0, 0, 0.4);
    } else {
      k.linieGenau(X(hx), Y(hy), X(hx + dir * w), Y(hy), 0.3);
      const a0 = dir > 0 ? 0 : Math.PI;
      k.ell(X(hx), Y(hy), w * s, w * s, a0, Math.PI / 2 * (dir > 0 ? 1 : 1) + (dir > 0 ? 0 : 0), 0.4);
    }
  };
  gruppe(3, GRAPHIT, 1.2, () => {
    tuerenGang.forEach(c => { tuer(c - 0.5, 5.2 - IW / 2, 1.0, 'h', -1); tuer(c - 0.5, 8.8 + IW / 2, 1.0, 'h', 1); });
    tuer(5.8, 3.2, 0.9, 'v', -1); tuer(13.4, 3.2, 0.9, 'v', -1); tuer(20.2, 3.2, 0.9, 'v', 1);
    tuer(5.8, 9.9, 0.9, 'v', -1); tuer(13.4, 9.9, 0.9, 'v', -1); tuer(20.2, 9.9, 0.9, 'v', 1);
    fensterN.forEach(([a, b]) => [0, AW / 2, AW].forEach(d => { k.linieGenau(X(a), Y(d), X(b), Y(d), 0.3); k.linieGenau(X(a), Y(14 - d), X(b), Y(14 - d), 0.3); }));
    fensterO.forEach(([a, b]) => [0, AW / 2, AW].forEach(d => { k.linieGenau(X(d), Y(a), X(d), Y(b), 0.3); k.linieGenau(X(26 - d), Y(a), X(26 - d), Y(b), 0.3); }));
  });
  /* Gruppe 4: Schraffur 45 Grad in den Aussenwänden */
  const inOeff = (v, oeff) => oeff.some(([a, b]) => v > a - 0.05 && v < b + 0.05);
  gruppe(4, GRAPHIT, 1.2, () => {
    for (let x = 0.05; x < 26 - AW; x += 0.32) {
      if (!inOeff(x + AW / 2, fensterN)) { k.linieGenau(X(x), Y(AW), X(x + AW), Y(0), 0.2); k.linieGenau(X(x), Y(14), X(x + AW), Y(14 - AW), 0.2); }
    }
    for (let y = AW + 0.05; y < 14 - AW; y += 0.32) {
      if (!inOeff(y + AW / 2, fensterO)) { k.linieGenau(X(0), Y(y + AW), X(AW), Y(y), 0.2); k.linieGenau(X(26 - AW), Y(y + AW), X(26), Y(y), 0.2); }
    }
  });
  /* Gruppe 5: Bemassung, Beschriftung, Nordpfeil, Kote */
  gruppe(5, PLAN, 1.2, () => {
    const kette = (pkte, y, txt = true) => {
      k.line(X(pkte[0]), Y(y), X(pkte[pkte.length - 1]), Y(y), 0.6);
      pkte.forEach(x => { k.linieGenau(X(x) - 0.22 * s, Y(y) + 0.22 * s, X(x) + 0.22 * s, Y(y) - 0.22 * s, 0.2); k.linieGenau(X(x), Y(y - 0.35), X(x), Y(y + 0.35), 0.2); });
      if (txt) for (let i = 1; i < pkte.length; i++) textMitte((pkte[i] - pkte[i - 1]).toFixed(2), (pkte[i] + pkte[i - 1]) / 2, y - 0.22, schriftKlein);
    };
    kette(AX, -1.9);
    kette([0, 26], -3.0, false); textMitte('26.00', 13, -3.22, schriftKlein);
    const ketteV = (pkte, x) => {
      k.line(X(x), Y(pkte[0]), X(x), Y(pkte[pkte.length - 1]), 0.6);
      pkte.forEach(y => { k.linieGenau(X(x) - 0.22 * s, Y(y) + 0.22 * s, X(x) + 0.22 * s, Y(y) - 0.22 * s, 0.2); k.linieGenau(X(x - 0.35), Y(y), X(x + 0.35), Y(y), 0.2); });
      for (let i = 1; i < pkte.length; i++) textMitte((pkte[i] - pkte[i - 1]).toFixed(2), x - 0.22, (pkte[i] + pkte[i - 1]) / 2, schriftKlein, -Math.PI / 2);
    };
    ketteV(AY, -1.9);
    ketteV([0, 14], -3.0);
    /* Nordpfeil */
    const nx = 28.4, ny = -2.6, nr = 0.8;
    k.ell(X(nx), Y(ny), nr * s, nr * s, 0, Math.PI * 2.05, 0.5);
    k.poly([[X(nx), Y(ny - nr * 1.25)], [X(nx + 0.35), Y(ny + 0.45)], [X(nx), Y(ny + 0.15)], [X(nx - 0.35), Y(ny + 0.45)], [X(nx), Y(ny - nr * 1.25)]], 0.3);
    textMitte('N', nx, ny - nr * 1.45, schrift);
    /* Höhenkote im Treppenhaus */
    const kx = 6.0, ky = 7.55;
    k.poly([[X(kx - 0.22), Y(ky - 0.3)], [X(kx + 0.22), Y(ky - 0.3)], [X(kx), Y(ky)], [X(kx - 0.22), Y(ky - 0.3)]], 0.2);
    k.line(X(kx - 0.4), Y(ky), X(kx + 0.4), Y(ky), 0.2);
    textMitte('+3.10', kx, ky + 0.55, schriftKlein);
  });
  gruppe(5, GRAPHIT, 1.2, () => {
    const raeume = [['Wohnen', 3.0, 2.8], ['Zimmer', 7.7, 1.4], ['Bad', 7.7, 3.9], ['Wohnen', 11.5, 2.8], ['Zimmer', 14.9, 2.8], ['Bad', 18.3, 3.9], ['Zimmer', 18.3, 1.4], ['Wohnen', 23.2, 2.8],
      ['Wohnen', 3.0, 11.6], ['Küche', 7.7, 10.2], ['Zimmer', 7.7, 12.8], ['Wohnen', 11.5, 11.6], ['Küche', 14.9, 11.6], ['Küche', 18.3, 10.2], ['Zimmer', 18.3, 12.8], ['Wohnen', 23.2, 11.6]];
    raeume.forEach(([t, x, y]) => textMitte(t, x, y, schrift));
  });
  return { striche, s, X, Y };
}

function planKapitel() {
  const sek = $('[data-plan]'), buehne = $('[data-plan-buehne]');
  const blatt = $('[data-blatt]'), eigen = $('[data-eigen]'), stift = $('[data-stift]');
  const papier = $('[data-plan-papier]'), ebene = $('[data-plan-ebene]'), lineal = $('[data-lineal]');
  const dock = $('[data-dock]'), mitKnopf = $('[data-mitzeichnen]');
  const cB = blatt.getContext('2d'), cE = eigen.getContext('2d');
  const sicht = sichtbar(buehne, '100px');
  let q = 0;
  /* Der Plan ist nach 80 Prozent der Strecke fertig gezeichnet; die restlichen rund 50vh (plus die
     erste Hälfte des Wipes) bleibt das Dock zum Selbstzeichnen offen */
  strecke(sek, 'top top', () => '+=' + Math.max(1, sek.offsetHeight - 2 * buehne.offsetHeight), p => { q = Math.min(1, p / 0.8); });

  /* Lineal-Striche */
  const g = $('[data-lineal-striche]');
  let svg = '';
  for (let i = 0; i <= 50; i++) {
    const x = 10 + i * 10, l = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9;
    svg += `<line x1="${x}" y1="1" x2="${x}" y2="${1 + l}" stroke="#3A2A18" stroke-width="1.3"/>`;
    if (i % 10 === 0) svg += `<text x="${x + 3}" y="36" font-family="Archivo" font-weight="600" font-size="11" fill="#3A2A18">${i / 10 * 10}</text>`;
  }
  g.innerHTML = svg;

  let W = 0, H = 0, dpr = 1, entwurf = null, gezeichnet = 0, gesamt = 0, gruppenLaenge = [0, 0, 0, 0, 0, 0];
  const GR = [[0, 0.12], [0.12, 0.35], [0.35, 0.55], [0.55, 0.7], [0.7, 0.8], [0.8, 0.95]];
  const schriftSetzen = (c, size) => { c.font = `500 ${size}px Archivo`; try { c.fontStretch = 'condensed'; } catch (e) { /* ältere Browser */ } };

  function bauen() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = buehne.clientWidth; H = buehne.clientHeight;
    for (const c of [blatt, eigen]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    cB.setTransform(dpr, 0, 0, dpr, 0, 0); cE.setTransform(dpr, 0, 0, dpr, 0, 0);
    const oben = parseFloat(getComputedStyle(html).getPropertyValue('--leiste')) + (istMobil() ? 64 : 88);
    entwurf = planEntwurf(W, H, istMobil(), oben);
    gesamt = 0; gruppenLaenge = [0, 0, 0, 0, 0, 0];
    entwurf.striche.sort((a, b) => a.g - b.g);
    for (const st of entwurf.striche) {
      if (st.text) {
        schriftSetzen(cB, st.size);
        st.w = cB.measureText(st.text).width;
        if (st.mitte) { if (st.rot) { st.x += 0; st.y += st.w / 2; } else st.x -= st.w / 2; }
        st.len = st.w;
      } else {
        st.d = [0];
        for (let j = 1; j < st.pts.length; j++) st.d.push(st.d[j - 1] + Math.hypot(st.pts[j][0] - st.pts[j - 1][0], st.pts[j][1] - st.pts[j - 1][1]));
        st.len = st.d[st.d.length - 1] || 0.001;
      }
      st.start = gesamt; gesamt += st.len; gruppenLaenge[st.g] += st.len;
    }
    gezeichnet = 0; cB.clearRect(0, 0, W, H); letztesZiel = -1;
    benutzerNeu();
  }

  function zielLaenge(qq) {
    let L = 0;
    for (let i = 0; i < 6; i++) L += gruppenLaenge[i] * bereich(qq, GR[i][0], GR[i][1]);
    return L;
  }
  function teil(st, a, b) {
    if (st.text) {
      cB.save();
      cB.translate(st.x, st.y);
      if (st.rot) cB.rotate(st.rot);
      const x0 = a <= 0 ? -14 : a, x1 = b >= st.len ? st.len + 14 : b;
      cB.beginPath(); cB.rect(x0, -st.size, x1 - x0, st.size * 1.7); cB.clip();
      schriftSetzen(cB, st.size);
      cB.fillStyle = st.farbe;
      cB.fillText(st.text, 0, 0);
      cB.restore();
      return;
    }
    const P = st.pts, D = st.d;
    cB.strokeStyle = st.farbe; cB.lineWidth = st.breite; cB.lineCap = 'round'; cB.lineJoin = 'round';
    cB.beginPath();
    let an = false;
    for (let j = 1; j < P.length; j++) {
      const d0 = D[j - 1], d1 = D[j];
      if (d1 <= a) continue;
      if (d0 >= b) break;
      const t0 = Math.max(0, (a - d0) / (d1 - d0 || 1)), t1 = Math.min(1, (b - d0) / (d1 - d0 || 1));
      const p0x = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * t0, p0y = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * t0;
      const p1x = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * t1, p1y = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * t1;
      if (!an) { cB.moveTo(p0x, p0y); an = true; }
      cB.lineTo(p1x, p1y);
    }
    cB.stroke();
  }
  function stiftPunkt(L) {
    for (const st of entwurf.striche) {
      if (L > st.start + st.len) continue;
      const a = L - st.start;
      if (st.text) {
        const c = Math.cos(st.rot || 0), sn = Math.sin(st.rot || 0), lx = a, ly = -0.24 * st.size;
        return [st.x + lx * c - ly * sn, st.y + lx * sn + ly * c];
      }
      const D = st.d, P = st.pts;
      for (let j = 1; j < P.length; j++) if (D[j] >= a) { const t = (a - D[j - 1]) / (D[j] - D[j - 1] || 1); return [P[j - 1][0] + (P[j][0] - P[j - 1][0]) * t, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * t]; }
      return P[P.length - 1];
    }
    const l = entwurf.striche[entwurf.striche.length - 1];
    return l.text ? [l.x + l.w, l.y] : l.pts[l.pts.length - 1];
  }
  let letztesZiel = -1;
  function zeichneBis(ziel) {
    if (ziel < gezeichnet - 0.01) { cB.clearRect(0, 0, W, H); gezeichnet = 0; }
    if (ziel <= gezeichnet) return;
    for (const st of entwurf.striche) {
      const s1 = st.start + st.len;
      if (s1 <= gezeichnet) continue;
      if (st.start >= ziel) break;
      teil(st, Math.max(0, gezeichnet - st.start), Math.min(st.len, ziel - st.start));
    }
    gezeichnet = ziel;
  }

  /* Selbst zeichnen */
  let farbe = '#FF6A13', mitzeichnen = false, fertig = false;
  const eigeneStriche = [];
  function benutzerNeu() {
    cE.clearRect(0, 0, W, H);
    cE.lineCap = 'round'; cE.lineJoin = 'round'; cE.lineWidth = 3;
    for (const s of eigeneStriche) { cE.strokeStyle = s.farbe; cE.beginPath(); s.pts.forEach((p, i) => (i ? cE.lineTo(p[0], p[1]) : cE.moveTo(p[0], p[1]))); cE.stroke(); }
  }
  $$('[data-farbe]').forEach(b => b.addEventListener('click', () => {
    farbe = b.dataset.farbe;
    $$('[data-farbe]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('[data-leeren]').addEventListener('click', () => { eigeneStriche.length = 0; benutzerNeu(); });
  mitKnopf.addEventListener('click', () => {
    mitzeichnen = !mitzeichnen;
    mitKnopf.setAttribute('aria-pressed', String(mitzeichnen));
    sek.classList.toggle('mitzeichnen', mitzeichnen);
  });
  let zug = null, zugT = 0, sx = 0, sy = 0;
  const darf = () => fertig && (FEIN || mitzeichnen);
  eigen.addEventListener('pointerdown', e => {
    if (!darf()) return;
    if (e.pointerType !== 'mouse' && !mitzeichnen) return;
    eigen.setPointerCapture(e.pointerId);
    const r = eigen.getBoundingClientRect();
    sx = e.clientX - r.left; sy = e.clientY - r.top;
    zug = { farbe, pts: [[sx, sy]] }; zugT = performance.now();
    eigeneStriche.push(zug);
    e.preventDefault();
  });
  eigen.addEventListener('pointermove', e => {
    if (!zug) return;
    const r = eigen.getBoundingClientRect();
    const j = performance.now(), dt = Math.max(0.001, (j - zugT) / 1000); zugT = j;
    const kk = 1 - Math.exp(-dt * 22);
    const nx = lerp(sx, e.clientX - r.left, Math.max(kk, 0.35)), ny = lerp(sy, e.clientY - r.top, Math.max(kk, 0.35));
    cE.strokeStyle = zug.farbe; cE.lineWidth = 3; cE.lineCap = 'round';
    cE.beginPath(); cE.moveTo(sx, sy); cE.lineTo(nx, ny); cE.stroke();
    sx = nx; sy = ny; zug.pts.push([sx, sy]);
    stiftZiel = [sx, sy];
  });
  const loslassen = () => { zug = null; };
  eigen.addEventListener('pointerup', loslassen);
  eigen.addEventListener('pointercancel', loslassen);

  /* Zeiger-Parallaxe */
  const zg = { x: 0, y: 0, sx: 0, sy: 0 };
  let stiftZiel = null;
  if (FEIN) addEventListener('pointermove', e => { zg.x = (e.clientX / innerWidth - 0.5) * 2; zg.y = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  addEventListener('resize', () => { const alt = eigeneStriche.length; bauen(); if (alt) benutzerNeu(); });
  const schriftBereit = Promise.race([document.fonts.load('500 20px Archivo'), new Promise(r => setTimeout(r, 2500))]);
  schriftBereit.then(() => {
    bauen();
    let stiftAn = false;
    takt.add(() => {
      if (!sicht.an) return;
      const ziel = zielLaenge(q);
      if (Math.abs(ziel - letztesZiel) > 0.01) { zeichneBis(ziel); letztesZiel = ziel; }
      const istFertig = q > 0.95;
      if (istFertig !== fertig) {
        fertig = istFertig;
        sek.classList.toggle('ist-fertig', fertig);
        dock.inert = !fertig;
        if (!fertig && mitzeichnen) mitKnopf.click();
      }
      /* Bleistift folgt der Schreibposition, beim eigenen Zeichnen dem Zeiger */
      const p = zug && stiftZiel ? stiftZiel : stiftPunkt(Math.max(0.001, Math.min(gezeichnet, gesamt - 0.001)));
      const an = q > 0.003 && (q < 0.96 || !!zug);
      if (an !== stiftAn) { stift.classList.toggle('ist-an', an); stiftAn = an; }
      stift.style.transform = `translate3d(${p[0].toFixed(1)}px,${(p[1] - (stift.clientHeight || 36) / 2).toFixed(1)}px,0) rotate(-35deg)`;
      zg.sx = lerp(zg.sx, zg.x, REDUZIERT ? 1 : 0.1); zg.sy = lerp(zg.sy, zg.y, REDUZIERT ? 1 : 0.1);
      papier.style.transform = `translate3d(${(zg.sx * 3).toFixed(2)}px,${(zg.sy * 3).toFixed(2)}px,0)`;
      ebene.style.transform = `translate3d(${(zg.sx * 6).toFixed(2)}px,${(zg.sy * 6).toFixed(2)}px,0)`;
      lineal.style.transform = `translate3d(${(zg.sx * 18).toFixed(2)}px,${(zg.sy * 18).toFixed(2)}px,0) rotate(7deg)`;
    });
  });
}

/* ================= Kapitel 3: Rohbau (Three.js) ================= */
function box(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }
/* Eigene Zusammenführung (BufferGeometryUtils gibt es im Projekt nicht), mit Welt-UV für Beton */
function vereinen(liste, weltUV = 0) {
  let nP = 0, nI = 0;
  for (const g of liste) { nP += g.attributes.position.count; nI += g.index.count; }
  const pos = new Float32Array(nP * 3), nor = new Float32Array(nP * 3), uv = new Float32Array(nP * 2), idx = new Uint32Array(nI);
  let po = 0, io = 0;
  for (const g of liste) {
    const P = g.attributes.position.array, Nn = g.attributes.normal.array, U = g.attributes.uv.array, I = g.index.array, n = g.attributes.position.count;
    pos.set(P, po * 3); nor.set(Nn, po * 3);
    for (let i = 0; i < n; i++) {
      if (weltUV) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = Math.abs(Nn[i * 3]), ny = Math.abs(Nn[i * 3 + 1]);
        let u, v;
        if (ny > 0.5) { u = x; v = z; } else if (nx > 0.5) { u = z; v = y; } else { u = x; v = y; }
        uv[(po + i) * 2] = u / weltUV; uv[(po + i) * 2 + 1] = v / weltUV;
      } else { uv[(po + i) * 2] = U[i * 2]; uv[(po + i) * 2 + 1] = U[i * 2 + 1]; }
    }
    for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + po;
    po += n; io += I.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
/* Balken zwischen zwei Punkten (für Gitter) */
function stab(a, b, d) {
  const g = new THREE.BoxGeometry(d, 1, d);
  const v = new THREE.Vector3().subVectors(b, a), L = v.length();
  g.scale(1, L, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
function rauschTextur(groesse, a, b, seed = 7) {
  const c = document.createElement('canvas'); c.width = c.height = groesse;
  const x = c.getContext('2d'), d = x.createImageData(groesse, groesse), r = rnd(seed);
  for (let i = 0; i < groesse * groesse; i++) { const v = a + (b - a) * r(); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function rohbau() {
  const sek = $('[data-rohbau]'), buehne = $('[data-rohbau-buehne]'), canvas = $('[data-rohbau-canvas]');
  const paneele = $$('[data-paneel]'), paneelKoten = $$('[data-paneel-kote]');
  const schluss = $('[data-schluss]'), leiste = $('[data-rohbau-leiste]'), hilfe = $('[data-rohbau-hilfe]');
  let r = 0;
  strecke(sek, 'top top', () => '+=' + Math.max(1, sek.offsetHeight - 2 * buehne.offsetHeight), p => { r = p; });
  const sicht = sichtbar(buehne, '50px');

  /* Paneele und Koten laufen auch ohne WebGL */
  let phaseJetzt = 0, koteJetzt = '';
  function textStand() {
    const ph = r < 0.12 ? 0 : r < 0.62 ? 1 : r < 0.82 ? 2 : 3;
    if (ph !== phaseJetzt) {
      paneele.forEach((p, i) => { p.hidden = i !== ph; p.classList.toggle('ist-neu', i === ph); });
      phaseJetzt = ph;
    }
    const m = r < 0.12 ? 0 : r < 0.62 ? 3.1 + 9.3 * bereich(r, 0.12, 0.62) : lerp(12.4, 14.2, bereich(r, 0.62, 0.7));
    const kt = koteText(m);
    if (kt !== koteJetzt) { paneelKoten[ph].textContent = kt; koteJetzt = kt; }
    if (sicht.an) liveKote(m);
    const ks = bereich(r, 0.9, 0.97);
    schluss.style.transform = `translate3d(0,${((1 - ks) * 140).toFixed(1)}%,0)`;
    schluss.style.opacity = ks.toFixed(3);
    leiste.style.transform = `scaleX(${r.toFixed(4)})`;
    hilfe.style.opacity = (r > 0.37 && r < 0.6) || r > 0.88 ? '0' : '1';
  }
  if (!html.classList.contains('mit-webgl')) { takt.add(() => { if (sicht.an) textStand(); }); return; }

  const mobil = istMobil();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    html.classList.remove('mit-webgl'); html.classList.add('no-webgl');
    takt.add(() => { if (sicht.an) textStand(); });
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobil ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; /* r186: PCFSoftShadowMap ist entfernt, weich über shadow.radius */
  renderer.localClippingEnabled = true;
  const HIMMEL_TAG = new THREE.Color('#EBE9E4'), HIMMEL_ABEND = new THREE.Color('#E9C9B0');
  renderer.setClearColor(HIMMEL_TAG);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HIMMEL_TAG.clone(), 40, 230);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 900);

  const hemi = new THREE.HemisphereLight(0xF4F3F0, 0x8C8A85, 1.6);
  scene.add(hemi);
  /* Baulampe an der Kamera: nur im Treppenauge, damit der Innenraum nicht grau absäuft */
  const lampe = new THREE.PointLight(0xFFE2BC, 0, 0, 2);
  camera.add(lampe); lampe.position.set(0.4, 0.6, 0);
  scene.add(camera);

  /* Himmel: Kuppel mit Verlauf, Wolken und Sonnenschein, damit kein Blick nach oben leer ist */
  const himmelUni = {
    uHorizont: { value: new THREE.Color('#EBE9E4') }, uZenit: { value: new THREE.Color('#C3CBD3') },
    uBoden: { value: new THREE.Color('#D9D6CF') }, uWolke: { value: new THREE.Color('#FBFAF7') },
    uSonne: { value: new THREE.Vector3(-0.5, 0.7, 0.4) }, uSonneFarbe: { value: new THREE.Color('#FFF3E2') }, uZeit: { value: 0 },
  };
  const kuppel = new THREE.Mesh(new THREE.SphereGeometry(420, 40, 20), new THREE.ShaderMaterial({
    uniforms: himmelUni, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    vertexShader: `varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uHorizont, uZenit, uBoden, uWolke, uSonne, uSonneFarbe; uniform float uZeit; varying vec3 vDir;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir); float y = d.y;
        vec3 c = mix(uHorizont, uZenit, smoothstep(0.0, 0.6, y));
        c = mix(c, uBoden, smoothstep(0.0, -0.25, y));
        float sn = max(dot(d, normalize(uSonne)), 0.0);
        c += uSonneFarbe * (pow(sn, 6.0) * 0.16 + pow(sn, 90.0) * 0.5);
        if (y > 0.0) {
          vec2 q = d.xz / (y + 0.16) * 0.9 + vec2(uZeit * 0.004, uZeit * 0.002);
          float w = fbm(q * 1.4) * 0.75 + fbm(q * 4.2) * 0.25;
          float m = smoothstep(0.48, 0.74, w) * smoothstep(0.0, 0.18, y);
          vec3 wf = mix(uWolke, uHorizont, 0.25) + uSonneFarbe * pow(sn, 3.0) * 0.12;
          c = mix(c, wf, m * 0.82);
          c -= vec3(0.05) * smoothstep(0.62, 0.9, w) * m;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  kuppel.frustumCulled = false; kuppel.renderOrder = -10;
  scene.add(kuppel);
  const ZENIT_TAG = new THREE.Color('#C3CBD3'), ZENIT_ABEND = new THREE.Color('#8E97B4');
  const WOLKE_TAG = new THREE.Color('#FBFAF7'), WOLKE_ABEND = new THREE.Color('#F6D7C2');
  const HEMI_TAG = new THREE.Color('#F4F3F0'), HEMI_ABEND = new THREE.Color('#B3BBD0');
  const sonne = new THREE.DirectionalLight(0xFFF3E2, 2.6);
  sonne.position.set(-18, 30, 14);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(mobil ? 1024 : 2048, mobil ? 1024 : 2048);
  const sc = sonne.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 140;
  sonne.shadow.radius = 4; sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03;
  scene.add(sonne, sonne.target);
  const SONNE_TAG = new THREE.Color('#FFF3E2'), SONNE_ABEND = new THREE.Color('#FFB27A');
  const AZ = Math.atan2(14, -18);

  const welt = new THREE.Group();
  scene.add(welt);

  /* Texturen und Materialien */
  const lader = new THREE.TextureLoader();
  const betonTex = lader.load('/hebel-vorschau/v3/beispiele/quader-bau/bilder/beton-textur.webp');
  betonTex.colorSpace = THREE.SRGBColorSpace; betonTex.wrapS = betonTex.wrapT = THREE.RepeatWrapping;
  betonTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const platteTex = betonTex.clone(); platteTex.repeat.set(4, 2); platteTex.needsUpdate = true;
  const FRISCH = new THREE.Color('#BDB9B1'), HELL = new THREE.Color('#D6D3CC');
  const betonMat = new THREE.MeshStandardMaterial({ map: betonTex, color: HELL, roughness: 0.9 });
  const platteMat = new THREE.MeshStandardMaterial({ map: platteTex, color: HELL, roughness: 0.9 });
  const bodenTex = rauschTextur(256, 150, 205, 3); bodenTex.repeat.set(1, 1);
  const bodenMat = new THREE.MeshStandardMaterial({ color: '#C9C7C2', map: bodenTex, roughness: 1 });
  const erdeMat = new THREE.MeshStandardMaterial({ color: '#7A6A58', roughness: 1 });
  const kiesTex = rauschTextur(128, 120, 230, 9); kiesTex.repeat.set(10, 6);
  const kiesMat = new THREE.MeshStandardMaterial({ color: '#A39C91', map: kiesTex, roughness: 1 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: '#FF6A13', roughness: 0.55 });
  const schwarzMat = new THREE.MeshStandardMaterial({ color: '#0B0B0C', roughness: 0.6 });
  const grauMat = new THREE.MeshStandardMaterial({ color: '#9A968E', roughness: 0.85 });
  const glasMat = new THREE.MeshStandardMaterial({ color: '#2A2E33', roughness: 0.18, metalness: 0.35 });
  const schatten = m => { m.castShadow = true; m.receiveShadow = true; return m; };

  /* Gelände mit Baugrube 30 x 18 x 3 m */
  const GX = 15, GZ = 9, TIEF = 3;
  /* Rahmen aus vier Platten um ein Loch (innen ix, iz, aussen ax, az) */
  const rahmen = (ix, iz, ax, az, y, d, uv) => vereinen([
    box(ax * 2, d, az - iz, 0, y, -(iz + (az - iz) / 2)), box(ax * 2, d, az - iz, 0, y, iz + (az - iz) / 2),
    box(ax - ix, d, iz * 2, -(ix + (ax - ix) / 2), y, 0), box(ax - ix, d, iz * 2, ix + (ax - ix) / 2, y, 0)], uv);
  /* Baustelle (Kies, verdichtet) bis an den Bauzaun, aussen Wiese, Strasse und Nachbarschaft */
  const SX = 25, SZ = 17.5;
  const bodenMesh = new THREE.Mesh(rahmen(GX, GZ, SX, SZ, -0.1, 0.2, 4), bodenMat); bodenMesh.receiveShadow = true; welt.add(bodenMesh);
  const wieseTex = rauschTextur(256, 120, 190, 13); wieseTex.repeat.set(1, 1);
  const wieseMat = new THREE.MeshStandardMaterial({ color: '#A7AD93', map: wieseTex, roughness: 1 });
  const wiese = new THREE.Mesh(rahmen(SX, SZ, 260, 260, -0.12, 0.2, 6), wieseMat); wiese.receiveShadow = true; welt.add(wiese);
  const asphaltTex = rauschTextur(128, 95, 140, 21); asphaltTex.repeat.set(30, 1);
  const strasse = new THREE.Mesh(box(300, 0.06, 7, 0, 0.0, SZ + 5.5), new THREE.MeshStandardMaterial({ color: '#7A7873', map: asphaltTex, roughness: 0.95 }));
  strasse.receiveShadow = true; welt.add(strasse);
  { const t = []; for (let x = -146; x < 146; x += 6) t.push(box(3, 0.02, 0.16, x, 0.04, SZ + 5.5));
    welt.add(new THREE.Mesh(vereinen(t), new THREE.MeshStandardMaterial({ color: '#EDEBE6', roughness: 0.8 }))); }
  const grubenWand = vereinen([box(GX * 2, TIEF, 0.3, 0, -TIEF / 2, -GZ - 0.15), box(GX * 2, TIEF, 0.3, 0, -TIEF / 2, GZ + 0.15),
    box(0.3, TIEF, GZ * 2, -GX - 0.15, -TIEF / 2, 0), box(0.3, TIEF, GZ * 2, GX + 0.15, -TIEF / 2, 0)]);
  welt.add(schatten(new THREE.Mesh(grubenWand, erdeMat)));
  const kies = new THREE.Mesh(box(GX * 2, 0.2, GZ * 2, 0, -TIEF - 0.1, 0), kiesMat); kies.receiveShadow = true; welt.add(kies);

  /* Hinterfüllung: Nach dem Untergeschoss wird der Spalt zwischen Grube und Bau aufgefüllt */
  const fuellung = new THREE.Mesh(rahmen(14, 8, GX + 0.3, GZ + 0.3, -TIEF / 2, TIEF, 4), bodenMat);
  fuellung.receiveShadow = true; fuellung.visible = false; welt.add(fuellung);
  /* Kontaktschatten am Fuss des Baus (weicher, dunkler Rand) */
  const ksC = document.createElement('canvas'); ksC.width = 256; ksC.height = 160;
  { const x = ksC.getContext('2d'), d = x.createImageData(256, 160);
    const ix0 = 256 * 3 / 34, ix1 = 256 * 31 / 34, iz0 = 160 * 3 / 22, iz1 = 160 * 19 / 22;
    for (let j = 0; j < 160; j++) for (let i = 0; i < 256; i++) {
      const dx = Math.max(ix0 - i, 0, i - ix1) / (256 / 34), dz = Math.max(iz0 - j, 0, j - iz1) / (160 / 22);
      const dd = Math.hypot(dx, dz), a = dd <= 0 ? 0.55 : 0.55 * Math.pow(Math.max(0, 1 - dd / 3), 2.2);
      d.data[(j * 256 + i) * 4 + 3] = Math.round(a * 255);
    }
    x.putImageData(d, 0, 0); }
  const ksTex = new THREE.CanvasTexture(ksC);
  const kontakt = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), new THREE.MeshBasicMaterial({ map: ksTex, color: '#2A2622', transparent: true, depthWrite: false, opacity: 0 }));
  kontakt.rotation.x = -Math.PI / 2; kontakt.position.y = 0.03; kontakt.renderOrder = 1; welt.add(kontakt);

  /* Gebäude: 28 x 16 m, Wand 0.25, vier Geschosse à 3.1 m */
  const BX = 14, BZ = 8, WD = 0.25, GH = 3.1, DD = 0.25, WH = GH - DD;
  const F_LANG = [-12.25, -8.75, -5.25, -1.75, 1.75, 5.25, 8.75, 12.25], F_KURZ = [-4.5, 0, 4.5], FB = 1.6, BR = 0.9, ST = 2.4;
  const AUGE = { x: 2.2, z: 1.1, s: 2.4 };
  const STUETZEN = [];
  for (const x of [-9.2, -4.6, 7.0, 10.4]) for (const z of [-3.2, 3.2]) STUETZEN.push([x, z]);
  function wandLang(zc, teile, mitFenster) {
    let a = -BX;
    const fen = mitFenster ? F_LANG : [];
    for (const c of fen) {
      const f0 = c - FB / 2, f1 = c + FB / 2;
      teile.push(box(f0 - a, WH, WD, (a + f0) / 2, WH / 2, zc));
      teile.push(box(FB, BR, WD, c, BR / 2, zc));
      teile.push(box(FB, WH - ST, WD, c, ST + (WH - ST) / 2, zc));
      a = f1;
    }
    teile.push(box(BX - a, WH, WD, (a + BX) / 2, WH / 2, zc));
  }
  function wandKurz(xc, teile, mitFenster) {
    let a = -BZ + WD;
    const fen = mitFenster ? F_KURZ : [];
    for (const c of fen) {
      const f0 = c - FB / 2, f1 = c + FB / 2;
      teile.push(box(WD, WH, f0 - a, xc, WH / 2, (a + f0) / 2));
      teile.push(box(WD, BR, FB, xc, BR / 2, c));
      teile.push(box(WD, WH - ST, FB, xc, ST + (WH - ST) / 2, c));
      a = f1;
    }
    teile.push(box(WD, WH, BZ - WD - a, xc, WH / 2, (a + BZ - WD) / 2));
  }
  function geschossWaende(mitFenster = true, hoehe = WH) {
    const t = [];
    wandLang(-BZ + WD / 2, t, mitFenster); wandLang(BZ - WD / 2, t, mitFenster);
    wandKurz(-BX + WD / 2, t, mitFenster); wandKurz(BX - WD / 2, t, mitFenster);
    if (mitFenster) STUETZEN.forEach(([x, z]) => t.push(box(0.3, WH, 0.3, x, WH / 2, z)));
    const g = vereinen(t, 7);
    if (hoehe !== WH) g.scale(1, hoehe / WH, 1);
    return g;
  }
  function deckeGeo(y0) {
    const a0 = AUGE.x - AUGE.s / 2, a1 = AUGE.x + AUGE.s / 2, b0 = AUGE.z - AUGE.s / 2, b1 = AUGE.z + AUGE.s / 2;
    return vereinen([
      box(a0 + BX, DD, BZ * 2, (-BX + a0) / 2, y0 + DD / 2, 0),
      box(BX - a1, DD, BZ * 2, (a1 + BX) / 2, y0 + DD / 2, 0),
      box(AUGE.s, DD, b0 + BZ, AUGE.x, y0 + DD / 2, (-BZ + b0) / 2),
      box(AUGE.s, DD, BZ - b1, AUGE.x, y0 + DD / 2, (b1 + BZ) / 2),
    ], 7);
  }
  const bau = new THREE.Group();
  welt.add(bau);
  /* Bodenplatte und Untergeschoss */
  const platte = schatten(new THREE.Mesh(box(28, 0.4, 16, 0, 0.2, 0), platteMat));
  platte.position.y = -TIEF; platte.scale.y = 0.001;
  bau.add(platte);
  const ugEbene = new THREE.Plane(new THREE.Vector3(0, -1, 0), -TIEF);
  const ugMat = betonMat.clone(); ugMat.clippingPlanes = [ugEbene]; ugMat.clipShadows = true; ugMat.color.copy(FRISCH);
  const ugWand = schatten(new THREE.Mesh(geschossWaende(false, TIEF - 0.4), ugMat));
  ugWand.position.y = -TIEF + 0.4;
  bau.add(ugWand);
  const ugDeckenEbene = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -BX - 1);
  const ugDeckeMat = betonMat.clone(); ugDeckeMat.clippingPlanes = [ugDeckenEbene]; ugDeckeMat.clipShadows = true;
  const ugDecke = schatten(new THREE.Mesh(deckeGeo(-DD), ugDeckeMat));
  bau.add(ugDecke);
  /* Geschosse */
  const geschosse = [];
  const wandGeo = geschossWaende(true), deckGeo = deckeGeo(WH);
  for (let s = 0; s < 4; s++) {
    const basis = s * GH;
    const wEbene = new THREE.Plane(new THREE.Vector3(0, -1, 0), basis);
    const dEbene = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -BX - 1);
    const wMat = betonMat.clone(); wMat.clippingPlanes = [wEbene]; wMat.clipShadows = true; wMat.color.copy(FRISCH);
    const dMat = betonMat.clone(); dMat.clippingPlanes = [dEbene]; dMat.clipShadows = true; dMat.color.copy(FRISCH);
    const w = schatten(new THREE.Mesh(wandGeo, wMat)); w.position.y = basis;
    const d = schatten(new THREE.Mesh(deckGeo, dMat)); d.position.y = basis;
    bau.add(w, d);
    geschosse.push({ basis, w, d, wMat, dMat, wEbene, dEbene, wT: null, dT: null });
  }
  /* Hülle: Dachrand, Fenster, Geländer */
  const dachY = 4 * GH;
  const dachrand = schatten(new THREE.Mesh(vereinen([box(28, 0.6, 0.3, 0, 0.3, -BZ + 0.15), box(28, 0.6, 0.3, 0, 0.3, BZ - 0.15), box(0.3, 0.6, 16, -BX + 0.15, 0.3, 0), box(0.3, 0.6, 16, BX - 0.15, 0.3, 0)], 7), betonMat));
  dachrand.position.y = dachY; dachrand.scale.y = 0.001; dachrand.visible = false;
  bau.add(dachrand);
  const geländerTeile = [];
  for (let x = -BX + 0.6; x <= BX - 0.6; x += 1.4) { geländerTeile.push(box(0.05, 1.0, 0.05, x, 0.6 + 0.5, -BZ + 0.6), box(0.05, 1.0, 0.05, x, 0.6 + 0.5, BZ - 0.6)); }
  for (let z = -BZ + 0.6; z <= BZ - 0.6; z += 1.4) { geländerTeile.push(box(0.05, 1.0, 0.05, -BX + 0.6, 0.6 + 0.5, z), box(0.05, 1.0, 0.05, BX - 0.6, 0.6 + 0.5, z)); }
  geländerTeile.push(box(28 - 1.2, 0.06, 0.06, 0, 1.6, -BZ + 0.6), box(28 - 1.2, 0.06, 0.06, 0, 1.6, BZ - 0.6), box(0.06, 0.06, 16 - 1.2, -BX + 0.6, 1.6, 0), box(0.06, 0.06, 16 - 1.2, BX - 0.6, 1.6, 0));
  const gelaender = new THREE.Mesh(vereinen(geländerTeile), schwarzMat);
  gelaender.position.y = dachY; gelaender.visible = false; gelaender.castShadow = true;
  bau.add(gelaender);
  /* Fenster: dunkles Glas mit hellem Rahmen */
  const fc = document.createElement('canvas'); fc.width = 128; fc.height = 128;
  { const x = fc.getContext('2d'); x.fillStyle = '#E6E3DC'; x.fillRect(0, 0, 128, 128);
    const g = x.createLinearGradient(0, 10, 0, 118); g.addColorStop(0, '#9AA4AF'); g.addColorStop(0.45, '#4B535C'); g.addColorStop(1, '#2A2E33');
    x.fillStyle = g; x.fillRect(10, 10, 108, 108); x.fillStyle = '#E6E3DC'; x.fillRect(61, 10, 6, 108);
    x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.moveTo(14, 60); x.lineTo(40, 14); x.lineTo(54, 14); x.lineTo(14, 84); x.fill(); }
  const fensterTex = new THREE.CanvasTexture(fc); fensterTex.colorSpace = THREE.SRGBColorSpace;
  const fensterMat = new THREE.MeshStandardMaterial({ map: fensterTex, roughness: 0.25, metalness: 0.2 });
  const fensterListe = [];
  for (let s = 0; s < 4; s++) {
    const y = s * GH + (BR + ST) / 2;
    for (const c of F_LANG) { fensterListe.push([c, y, -BZ + WD / 2, 0]); fensterListe.push([c, y, BZ - WD / 2, 0]); }
    for (const c of F_KURZ) { fensterListe.push([-BX + WD / 2, y, c, 1]); fensterListe.push([BX - WD / 2, y, c, 1]); }
  }
  fensterListe.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const fenster = new THREE.InstancedMesh(new THREE.BoxGeometry(FB, ST - BR, 0.08), fensterMat, fensterListe.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    fensterListe.forEach(([x, y, z, quer], i) => { e.set(0, quer ? Math.PI / 2 : 0, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); fenster.setMatrixAt(i, m); }); }
  fenster.count = 0; fenster.receiveShadow = true;
  bau.add(fenster);
  /* Am Abend brennt in einigen Wohnungen Licht */
  const lc = document.createElement('canvas'); lc.width = 64; lc.height = 64;
  { const x = lc.getContext('2d'); const g = x.createRadialGradient(32, 40, 4, 32, 40, 44); g.addColorStop(0, '#FFE7B8'); g.addColorStop(1, '#F2A65E');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#3A3026'; x.fillRect(30, 0, 4, 64); }
  const lichtTex = new THREE.CanvasTexture(lc); lichtTex.colorSpace = THREE.SRGBColorSpace;
  const lichtMat = new THREE.MeshBasicMaterial({ map: lichtTex, transparent: true, opacity: 0, depthWrite: false });
  const lzf = rnd(29), lichtIdx = [];
  fensterListe.forEach((f, i) => { if (lzf() < 0.38) lichtIdx.push(i); });
  const lichter = new THREE.InstancedMesh(new THREE.BoxGeometry(FB * 0.86, (ST - BR) * 0.9, 0.1), lichtMat, lichtIdx.length);
  { const m = new THREE.Matrix4(); lichtIdx.forEach((fi, i) => { fenster.getMatrixAt(fi, m); lichter.setMatrixAt(i, m); }); }
  lichter.visible = false; lichter.renderOrder = 2;
  bau.add(lichter);
  /* Absturzsicherung um das Treppenauge in jeder Decke, Treppenhausaufbau auf dem Dach */
  const augeGel = [];
  { const a0 = AUGE.x - AUGE.s / 2 - 0.12, a1 = AUGE.x + AUGE.s / 2 + 0.12, b0 = AUGE.z - AUGE.s / 2 - 0.12, b1 = AUGE.z + AUGE.s / 2 + 0.12;
    const t = [];
    for (const [x, z] of [[a0, b0], [a1, b0], [a1, b1], [a0, b1], [(a0 + a1) / 2, b0], [(a0 + a1) / 2, b1], [a0, (b0 + b1) / 2], [a1, (b0 + b1) / 2]]) t.push(box(0.06, 1.05, 0.06, x, 0.525, z));
    for (const y of [0.55, 1.05]) { t.push(box(a1 - a0, 0.05, 0.05, (a0 + a1) / 2, y, b0), box(a1 - a0, 0.05, 0.05, (a0 + a1) / 2, y, b1), box(0.05, 0.05, b1 - b0, a0, y, (b0 + b1) / 2), box(0.05, 0.05, b1 - b0, a1, y, (b0 + b1) / 2)); }
    t.push(box(a1 - a0, 0.16, 0.03, (a0 + a1) / 2, 0.08, b0), box(a1 - a0, 0.16, 0.03, (a0 + a1) / 2, 0.08, b1), box(0.03, 0.16, b1 - b0, a0, 0.08, (b0 + b1) / 2), box(0.03, 0.16, b1 - b0, a1, 0.08, (b0 + b1) / 2));
    const geo = vereinen(t);
    for (let s2 = 0; s2 < 4; s2++) { const m = new THREE.Mesh(geo, orangeMat); m.position.y = s2 * GH + GH; m.visible = false; m.castShadow = true; bau.add(m); augeGel.push(m); }
  }
  const aufbau = schatten(new THREE.Mesh(box(3.4, 2.6, 3.4, AUGE.x, 1.3, AUGE.z), betonMat));
  aufbau.position.y = 4 * GH; aufbau.scale.y = 0.001; aufbau.visible = false; bau.add(aufbau);

  /* Armierung (InstancedMesh) bzw. am Handy nur Linien */
  let armierung, armAnzahl = 0;
  if (!mobil) {
    const liste = [];
    const umfang = [];
    for (let x = -BX + 0.2; x < BX - 0.1; x += 0.2) { umfang.push([x, -BZ + WD / 2]); umfang.push([x, BZ - WD / 2]); }
    for (let z = -BZ + 0.4; z < BZ - 0.3; z += 0.2) { umfang.push([-BX + WD / 2, z]); umfang.push([BX - WD / 2, z]); }
    umfang.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    const m = new THREE.Matrix4();
    for (const [x, z] of umfang) { m.makeScale(1, WH + 0.55, 1); m.setPosition(x, (WH + 0.55) / 2, z); liste.push(m.clone()); }
    const rot = new THREE.Matrix4();
    for (let y = 0.2; y < WH; y += 0.2) {
      rot.makeRotationZ(Math.PI / 2); m.makeScale(1, 28, 1); m.premultiply(rot); m.setPosition(0, y, -BZ + WD / 2); liste.push(m.clone()); m.setPosition(0, y, BZ - WD / 2); liste.push(m.clone());
      rot.makeRotationX(Math.PI / 2); m.makeScale(1, 16, 1); m.premultiply(rot); m.setPosition(-BX + WD / 2, y, 0); liste.push(m.clone()); m.setPosition(BX - WD / 2, y, 0); liste.push(m.clone());
    }
    armierung = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5, 1), new THREE.MeshStandardMaterial({ color: '#5B5A56', roughness: 0.6, metalness: 0.3 }), liste.length);
    liste.forEach((mm, i) => armierung.setMatrixAt(i, mm));
    armAnzahl = liste.length;
  } else {
    const pts = [];
    for (let x = -BX + 0.3; x < BX; x += 0.6) { pts.push(x, 0, -BZ + WD / 2, x, WH + 0.55, -BZ + WD / 2, x, 0, BZ - WD / 2, x, WH + 0.55, BZ - WD / 2); }
    for (let z = -BZ + 0.6; z < BZ; z += 0.6) { pts.push(-BX + WD / 2, 0, z, -BX + WD / 2, WH + 0.55, z, BX - WD / 2, 0, z, BX - WD / 2, WH + 0.55, z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    armierung = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#5B5A56' }));
    armAnzahl = pts.length / 3;
  }
  armierung.visible = false;
  bau.add(armierung);

  /* Schalung: orange Tafeln mit schwarzem Rahmen, beidseitig */
  const sc2 = document.createElement('canvas'); sc2.width = 128; sc2.height = 152;
  { const x = sc2.getContext('2d'); x.fillStyle = '#0B0B0C'; x.fillRect(0, 0, 128, 152); x.fillStyle = '#FF6A13'; x.fillRect(3, 3, 122, 146); x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 1; i < 4; i++) x.fillRect(3, i * 38, 122, 2); }
  const schalTex = new THREE.CanvasTexture(sc2); schalTex.colorSpace = THREE.SRGBColorSpace;
  const schalMat = new THREE.MeshStandardMaterial({ map: schalTex, roughness: 0.6 });
  const tafelPos = [];
  const reihe = (laenge, fn) => { const n = Math.ceil(laenge / 2.4), st = laenge / n; for (let i = 0; i < n; i++) fn(-laenge / 2 + st * (i + 0.5), st); };
  for (const seite of [-1, 1]) {
    reihe(28, (x, st) => { tafelPos.push({ x, z: -BZ + WD / 2, n: [0, -1], quer: 0, st, seite }); tafelPos.push({ x, z: BZ - WD / 2, n: [0, 1], quer: 0, st, seite }); });
    reihe(16 - 2 * WD, (z, st) => { tafelPos.push({ x: -BX + WD / 2, z, n: [-1, 0], quer: 1, st, seite }); tafelPos.push({ x: BX - WD / 2, z, n: [1, 0], quer: 1, st, seite }); });
  }
  tafelPos.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const schalung = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), schalMat, tafelPos.length);
  schalung.castShadow = true; schalung.receiveShadow = true;
  bau.add(schalung);
  const schalStand = { zu: -1, n: -1 };
  function schalungSetzen(zu, n) {
    if (Math.abs(zu - schalStand.zu) < 1e-4 && n === schalStand.n) return;
    schalStand.zu = zu; schalStand.n = n;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sk = new THREE.Vector3();
    tafelPos.forEach((t, i) => {
      const abstand = WD / 2 + 0.035 + (1 - zu) * 0.9;
      const s = t.seite; /* +1 aussen, -1 innen */
      v.set(t.x + t.n[0] * abstand * s, WH / 2, t.z + t.n[1] * abstand * s);
      e.set(0, t.quer ? Math.PI / 2 : 0, 0); q.setFromEuler(e);
      sk.set(t.st * 0.985, WH, 0.06);
      m.compose(v, q, sk);
      schalung.setMatrixAt(i, m);
    });
    schalung.count = n;
    schalung.instanceMatrix.needsUpdate = true;
  }

  /* Turmdrehkran: Turm 32 m, Ausleger 40 m, Gegengewicht, Katze, Seil, Haken */
  const TURM = new THREE.Vector3(-19.5, 0, -12.5), TH = 32;
  const kran = new THREE.Group(); kran.position.copy(TURM); welt.add(kran);
  {
    const t = [], Q = 0.8;
    const ecken = [[-Q, -Q], [Q, -Q], [Q, Q], [-Q, Q]];
    for (let y = 0; y < TH; y += 2.4) {
      const y1 = Math.min(TH, y + 2.4);
      ecken.forEach(([x, z]) => t.push(box(0.14, y1 - y, 0.14, x, (y + y1) / 2, z)));
      for (let i = 0; i < 4; i++) {
        const [ax, az] = ecken[i], [bx, bz] = ecken[(i + 1) % 4];
        t.push(stab(new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y1, bz), 0.07));
        t.push(stab(new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y, bz), 0.07));
      }
    }
    const turm = new THREE.Mesh(vereinen(t), orangeMat); turm.castShadow = true; kran.add(turm);
    kran.add(schatten(new THREE.Mesh(box(4, 1, 4, 0, -0.4, 0), grauMat)));
  }
  const drehteil = new THREE.Group(); drehteil.position.y = TH; kran.add(drehteil);
  {
    const t = [];
    const L = 40, H = 1.3;
    for (let x = 0; x < L; x += 2.5) {
      const x1 = Math.min(L, x + 2.5);
      t.push(box(x1 - x, 0.12, 0.12, (x + x1) / 2, 0, -0.55), box(x1 - x, 0.12, 0.12, (x + x1) / 2, 0, 0.55), box(x1 - x, 0.12, 0.12, (x + x1) / 2, H, 0));
      t.push(stab(new THREE.Vector3(x, 0, -0.55), new THREE.Vector3(x1, H, 0), 0.06), stab(new THREE.Vector3(x, 0, 0.55), new THREE.Vector3(x1, H, 0), 0.06), stab(new THREE.Vector3(x1, 0, -0.55), new THREE.Vector3(x1, 0, 0.55), 0.06));
    }
    for (let x = -12; x < 0; x += 2) t.push(box(2, 0.14, 0.14, x + 1, 0, -0.6), box(2, 0.14, 0.14, x + 1, 0, 0.6), stab(new THREE.Vector3(x, 0, -0.6), new THREE.Vector3(x + 2, 0, 0.6), 0.06));
    t.push(box(1.6, 7, 1.6, 0, 3.5 + 0.2, 0));
    t.push(stab(new THREE.Vector3(0, 7.2, 0), new THREE.Vector3(26, H, 0), 0.06), stab(new THREE.Vector3(0, 7.2, 0), new THREE.Vector3(-11, 0, 0), 0.08));
    const ausleger = new THREE.Mesh(vereinen(t), orangeMat); ausleger.castShadow = true; drehteil.add(ausleger);
    drehteil.add(schatten(new THREE.Mesh(vereinen([box(2.2, 2.4, 1.8, -10.4, -1.2, 0), box(2.2, 2.4, 1.8, -8.2, -1.2, 0)]), grauMat)));
    drehteil.add(schatten(new THREE.Mesh(vereinen([box(1.8, 2.0, 1.7, 1.6, -1.3, 1.6), box(1.6, 0.4, 1.6, 0, -0.2, 0)]), schwarzMat)));
  }
  const katze = new THREE.Mesh(box(1.2, 0.5, 1.4, 0, -0.35, 0), schwarzMat); katze.castShadow = true; drehteil.add(katze);
  const seilMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), schwarzMat); drehteil.add(seilMesh);
  const hakenGr = new THREE.Group(); drehteil.add(hakenGr);
  hakenGr.add(schatten(new THREE.Mesh(box(0.7, 0.9, 0.45, 0, -0.45, 0), orangeMat)));
  { const hk = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 18, Math.PI * 1.4), schwarzMat); hk.position.y = -1.15; hk.rotation.z = Math.PI * 0.8; hakenGr.add(hk); }
  const lastTafeln = new THREE.Group();
  lastTafeln.add(schatten(new THREE.Mesh(vereinen([box(2.4, 0.12, 1.2, 0, -2.6, 0), box(2.4, 0.12, 1.2, 0, -2.45, 0), box(2.4, 0.12, 1.2, 0, -2.3, 0)]), orangeMat)));
  lastTafeln.add(new THREE.Mesh(vereinen([stab(new THREE.Vector3(0, -1.2, 0), new THREE.Vector3(-1.1, -2.25, 0), 0.03), stab(new THREE.Vector3(0, -1.2, 0), new THREE.Vector3(1.1, -2.25, 0), 0.03)]), schwarzMat));
  const kuebel = new THREE.Group();
  { const k1 = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.4, 1.5, 18), grauMat); k1.position.y = -2.3; schatten(k1); kuebel.add(k1);
    const k2 = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 24), schwarzMat); k2.rotation.x = Math.PI / 2; k2.position.y = -1.55; kuebel.add(k2); }
  hakenGr.add(lastTafeln, kuebel);
  const kranTreffer = new THREE.Mesh(box(44, 4, 4, 15, 0.5, 0), new THREE.MeshBasicMaterial()); kranTreffer.visible = false; drehteil.add(kranTreffer);
  const kranTurmTreffer = new THREE.Mesh(box(3, TH, 3, 0, TH / 2, 0), new THREE.MeshBasicMaterial()); kranTurmTreffer.visible = false; kran.add(kranTurmTreffer);

  /* Betonstrom: graue Partikel */
  const PN = mobil ? 140 : 280;
  const strahlGeo = new THREE.BufferGeometry();
  const strahlPos = new Float32Array(PN * 3);
  strahlGeo.setAttribute('position', new THREE.BufferAttribute(strahlPos, 3));
  const strahl = new THREE.Points(strahlGeo, new THREE.PointsMaterial({ color: '#8C8A85', size: 0.12, sizeAttenuation: true }));
  strahl.frustumCulled = false; strahl.visible = false;
  welt.add(strahl);
  const zufall = rnd(5); const pz = Array.from({ length: PN }, () => [zufall(), (zufall() - 0.5) * 0.3, (zufall() - 0.5) * 0.3]);

  /* Bagger in Clay-Optik */
  const bagger = new THREE.Group(); welt.add(bagger);
  const clayGelb = new THREE.MeshStandardMaterial({ color: '#FF9257', roughness: 0.75 });
  const clayDunkel = new THREE.MeshStandardMaterial({ color: '#3A3A38', roughness: 0.8 });
  bagger.add(schatten(new THREE.Mesh(vereinen([box(3.4, 0.7, 0.8, 0, 0.35, -1.0), box(3.4, 0.7, 0.8, 0, 0.35, 1.0)]), clayDunkel)));
  const oberwagen = new THREE.Group(); oberwagen.position.y = 0.75; bagger.add(oberwagen);
  oberwagen.add(schatten(new THREE.Mesh(vereinen([box(2.8, 1.0, 2.3, -0.2, 0.5, 0), box(1.0, 0.9, 2.2, -1.5, 0.45, 0)]), clayGelb)));
  oberwagen.add(schatten(new THREE.Mesh(box(1.1, 1.2, 1.0, 0.5, 1.6, 0.55), clayDunkel)));
  const ausleger1 = new THREE.Group(); ausleger1.position.set(0.9, 1.0, -0.4); oberwagen.add(ausleger1);
  ausleger1.add(schatten(new THREE.Mesh(box(3.2, 0.35, 0.35, 1.6, 0, 0), clayGelb)));
  const stiel = new THREE.Group(); stiel.position.set(3.2, 0, 0); ausleger1.add(stiel);
  stiel.add(schatten(new THREE.Mesh(box(0.28, 2.2, 0.28, 0, -1.1, 0), clayGelb)));
  const loeffel = new THREE.Group(); loeffel.position.set(0, -2.2, 0); stiel.add(loeffel);
  loeffel.add(schatten(new THREE.Mesh(box(0.8, 0.6, 0.9, 0.3, -0.2, 0), clayDunkel)));

  /* Umgebung, damit die Baustelle nicht auf einer leeren Fläche steht */
  {
    const zr = rnd(61);
    /* Bauzaun: Pfosten, Gitterfelder, Betonfüsse; an der Strasse Banner und eine Einfahrt */
    const gc = document.createElement('canvas'); gc.width = 128; gc.height = 64;
    { const x = gc.getContext('2d'); x.strokeStyle = '#8F8C86'; x.lineWidth = 2;
      for (let i = 0; i <= 128; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); }
      for (let j = 0; j <= 64; j += 8) { x.beginPath(); x.moveTo(0, j); x.lineTo(128, j); x.stroke(); }
      x.lineWidth = 5; x.strokeRect(2, 2, 124, 60); }
    const gTex = new THREE.CanvasTexture(gc); gTex.colorSpace = THREE.SRGBColorSpace;
    const gMat = new THREE.MeshStandardMaterial({ map: gTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 });
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 96;
    { const x = bc.getContext('2d'); x.fillStyle = '#FF6A13'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#0B0B0C'; x.fillRect(0, 0, 512, 6); x.fillRect(0, 90, 512, 6);
      x.font = '900 52px Archivo, Arial, sans-serif'; x.textBaseline = 'middle'; x.fillText('QUADER BAU', 22, 50);
      x.font = '600 22px Archivo, Arial, sans-serif'; x.fillText('Hochbau · Umbau · Beton', 330, 50); }
    const bTex = new THREE.CanvasTexture(bc); bTex.colorSpace = THREE.SRGBColorSpace;
    const bMat = new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.8, side: THREE.DoubleSide });
    const felder = [], fuesse = [], banner = [];
    const feld = (x0, z0, x1, z1, mitBanner) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 3.5);
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n, xa = lerp(x0, x1, a), za = lerp(z0, z1, a), xb = lerp(x0, x1, b), zb = lerp(z0, z1, b);
        const cx = (xa + xb) / 2, cz = (za + zb) / 2, w = L / n, quer = Math.abs(z1 - z0) > Math.abs(x1 - x0);
        felder.push([cx, cz, w, quer]);
        fuesse.push(box(quer ? 0.3 : 0.7, 0.14, quer ? 0.7 : 0.3, xa, 0.07, za));
        if (mitBanner && i % 3 === 1) banner.push([cx, cz, w, quer]);
      }
    };
    feld(-SX + 1, -SZ + 1, SX - 1, -SZ + 1); feld(-SX + 1, -SZ + 1, -SX + 1, SZ - 1); feld(SX - 1, -SZ + 1, SX - 1, SZ - 1);
    feld(-SX + 1, SZ - 1, 4, SZ - 1, true); feld(11, SZ - 1, SX - 1, SZ - 1, true);
    const fm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), gMat, felder.length);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler();
    felder.forEach(([x, z, w, quer], i) => { e4.set(0, quer ? Math.PI / 2 : 0, 0); q4.setFromEuler(e4); m4.compose(new THREE.Vector3(x, 1.0, z), q4, new THREE.Vector3(w - 0.05, 2.0, 1)); fm.setMatrixAt(i, m4); });
    fm.castShadow = true; welt.add(fm);
    welt.add(schatten(new THREE.Mesh(vereinen(fuesse), grauMat)));
    const bm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), bMat, banner.length);
    banner.forEach(([x, z, w, quer], i) => { e4.set(0, quer ? Math.PI / 2 : 0, 0); q4.setFromEuler(e4); m4.compose(new THREE.Vector3(x, 1.05, z + (quer ? 0 : 0.03)), q4, new THREE.Vector3(w - 0.1, 0.66 * (w - 0.1) * 96 / 512 * 2.2, 1)); bm.setMatrixAt(i, m4); });
    welt.add(bm);
    welt.add(new THREE.Mesh(box(7, 0.2, 2.4, 7.5, -0.09, SZ + 0.8), bodenMat));
    /* Baucontainer, zwei übereinander und einer daneben, mit Fensterband und oranger Tür */
    const cc = document.createElement('canvas'); cc.width = 256; cc.height = 96;
    { const x = cc.getContext('2d'); x.fillStyle = '#ECEAE5'; x.fillRect(0, 0, 256, 96); x.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 256; i += 8) x.fillRect(i, 0, 2, 96);
      x.fillStyle = '#3B4148'; x.fillRect(30, 26, 60, 30); x.fillRect(150, 26, 60, 30); x.fillStyle = '#FF6A13'; x.fillRect(104, 20, 30, 70); x.fillStyle = '#0B0B0C'; x.fillRect(0, 0, 256, 4); x.fillRect(0, 92, 256, 4); }
    const cTex = new THREE.CanvasTexture(cc); cTex.colorSpace = THREE.SRGBColorSpace;
    const cMat = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.7 });
    for (const [x, y, z, ry] of [[19.5, 1.3, -12.2, 0], [19.5, 3.9, -12.2, 0], [19.5, 1.3, -9.4, 0]]) {
      const c = schatten(new THREE.Mesh(new THREE.BoxGeometry(6.06, 2.6, 2.44), cMat)); c.position.set(x, y, z); c.rotation.y = ry; welt.add(c);
    }
    welt.add(schatten(new THREE.Mesh(vereinen([box(0.08, 2.6, 0.08, 16.6, 3.9, -10.8), box(1.2, 0.08, 1.4, 16.0, 2.6, -10.8)]), schwarzMat)));
    /* Materiallager beim Kran: Schaltafeln auf Paletten, Armierungsbündel */
    const lager = [];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 5 + (i % 2) * 2; k++) lager.push(box(2.4, 0.11, 1.2, -11 + i * 2.7, 0.2 + k * 0.13, -15.6));
    welt.add(schatten(new THREE.Mesh(vereinen(lager), orangeMat)));
    const palette = []; for (let i = 0; i < 4; i++) palette.push(box(2.5, 0.14, 1.3, -11 + i * 2.7, 0.07, -15.6));
    welt.add(schatten(new THREE.Mesh(vereinen(palette), new THREE.MeshStandardMaterial({ color: '#B8946A', roughness: 0.9 }))));
    const stahl = [];
    for (let b = 0; b < 3; b++) for (let i = 0; i < 9; i++) stahl.push(box(9, 0.05, 0.05, 2 + (i % 3) * 0.07, 0.12 + Math.floor(i / 3) * 0.07, -14.6 + b * 0.6 + (i % 3) * 0.07));
    stahl.push(box(0.2, 0.1, 2.0, -2.2, 0.05, -13.9), box(0.2, 0.1, 2.0, 6.2, 0.05, -13.9));
    welt.add(schatten(new THREE.Mesh(vereinen(stahl), new THREE.MeshStandardMaterial({ color: '#5B4A3E', roughness: 0.6, metalness: 0.4 }))));
    /* Kies- und Sandhaufen */
    for (const [x, z, rr, hh, f] of [[20, 8, 2.4, 1.5, '#A39C91'], [21.5, 3.2, 1.7, 1.05, '#C7B79B'], [-21, 12.5, 2.0, 1.2, '#A39C91']]) {
      const g = new THREE.ConeGeometry(rr, hh, 20, 3); const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { if (pos.getY(i) < hh / 2 - 0.01) { const k = 1 + (zr() - 0.5) * 0.18; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); } }
      g.computeVertexNormals();
      const m = schatten(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: f, map: kiesTex, roughness: 1 }))); m.position.set(x, hh / 2, z); welt.add(m);
    }
    /* Bäume ausserhalb des Zauns */
    const stammMat = new THREE.MeshStandardMaterial({ color: '#5E5247', roughness: 1 });
    const laubMats = ['#7E8A6A', '#6F7C5E', '#8C9673'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
    const baeume = [[-31, 6], [-33.5, -3], [-30, -14], [-36, 15], [31, 6], [34, -4], [30.5, -15], [-12, -24], [-3, -26], [9, -24.5], [20, -25], [-40, 32], [16, 32], [34, 31]];
    for (const [x, z] of baeume) {
      const hoch = 6 + zr() * 4, kr = 2.2 + zr() * 1.4;
      /* Bäume und Nachbarhäuser werfen keine Schatten: bei tiefer Abendsonne lägen sie sonst über dem Bau */
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, hoch * 0.5, 7), stammMat); st.position.set(x, hoch * 0.25, z); welt.add(st);
      const kr1 = new THREE.Mesh(new THREE.IcosahedronGeometry(kr, 1), laubMats[Math.floor(zr() * 3)]); kr1.position.set(x, hoch * 0.62, z); kr1.scale.set(1, 1.15 + zr() * 0.3, 1); kr1.rotation.y = zr() * 3; welt.add(kr1);
    }
    /* Nachbarhäuser mit Satteldach, im Dunst */
    const hausMat = new THREE.MeshStandardMaterial({ color: '#DCD8D0', roughness: 0.95 });
    const dachMat = new THREE.MeshStandardMaterial({ color: '#6B605A', roughness: 0.9, flatShading: true });
    for (const [x, z, w, d, h, ry] of [[-48, -6, 11, 9, 7, 0.1], [-46, 22, 9, 12, 6.2, -0.05], [-10, -40, 16, 10, 9, 0.02], [22, -42, 12, 10, 7, -0.08], [46, 2, 10, 13, 7.5, 0.06], [38, 38, 12, 9, 6.5, 0.12], [-8, 44, 14, 10, 9, -0.04]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const haus = new THREE.Mesh(box(w, h, d, 0, h / 2, 0), hausMat); haus.receiveShadow = true; g.add(haus);
      /* Satteldach als Dreiecksprisma, First oben, längs zum Haus */
      const dg = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w + 0.6, 3, 1); dg.rotateZ(Math.PI / 2); dg.rotateX(-Math.PI / 2);
      const dach = new THREE.Mesh(dg, dachMat); dach.scale.y = 0.55; dach.position.y = h + d * 0.62 * 0.5 * 0.55;
      g.add(dach);
      welt.add(g);
    }
  }
  /* Bagger: Kabine mit Glas, Gegengewicht */
  oberwagen.add(new THREE.Mesh(box(0.9, 0.7, 1.02, 0.62, 1.75, 0.55), glasMat));
  oberwagen.add(schatten(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.9, 16, 1, false, Math.PI * 0.5, Math.PI), clayDunkel)).translateX(-1.45).translateY(0.5));

  /* Zusätzliche Schaltafeln per Klick */
  const extra = new THREE.Group(); bau.add(extra);
  const auftrag = { aktiv: false, t0: 0, ziel: new THREE.Vector3(), tafel: null, gelandet: false };
  let ruetteln = 0;

  /* Kamerafahrt: Catmull-Rom (zentripetal), wie Tableau E22 */
  const KF = [
    [0.00, [34, 20, 34], [0, -1, 0], 32],
    [0.12, [18, 6, 22], [0, 0, 0], 38],
    [0.30, [11, 5.5, 15.5], [0, 3.5, 0], 44],
    [0.36, [3.6, 2.0, 12.6], [1.9, 1.8, 6], 50],
    [0.405, [1.75, 1.7, 8.2], [2.1, 2.2, 2], 60],
    [0.45, [2.2, 1.6, 1.2], [2.75, 14, 1.75], 70],
    [0.49, [2.2, 5.0, 1.15], [2.75, 18, 1.75], 70],
    [0.535, [2.2, 9.4, 1.15], [1.2, 22, 0.4], 68],
    [0.58, [2.2, 13.6, 1.2], [-9, 17, -7], 62],
    [0.66, [-14, 22, 18], [0, 8, 0], 40],
    [0.85, [-26, 9, 26], [0, 7, 0], 34],
    [1.00, [-30, 6, 30], [0, 7, 0], 32],
  ];
  const V = (a) => new THREE.Vector3(...a);
  const posKurve = new THREE.CatmullRomCurve3(KF.map(k => V(k[1])), false, 'centripetal');
  const zielKurve = new THREE.CatmullRomCurve3(KF.map(k => V(k[2])), false, 'centripetal');
  const tgt = new THREE.Vector3(), richt = new THREE.Vector3();
  const zg = { x: 0, y: 0, sx: 0, sy: 0 };
  if (FEIN) buehne.addEventListener('pointermove', e => { zg.x = e.clientX / innerWidth - 0.5; zg.y = e.clientY / innerHeight - 0.5; });
  let kipp = 0;
  function kameraSetzen(p, dt) {
    let i = 0;
    while (i < KF.length - 2 && p > KF[i + 1][0]) i++;
    const u = klemmen((p - KF[i][0]) / (KF[i + 1][0] - KF[i][0]));
    const s = (i + u) / (KF.length - 1);
    posKurve.getPoint(s, camera.position);
    zielKurve.getPoint(s, tgt);
    zg.sx = damp(zg.sx, zg.x, 3, dt); zg.sy = damp(zg.sy, zg.y, 3, dt);
    const innen = bereich(p, 0.35, 0.4) * (1 - bereich(p, 0.58, 0.63));
    const pf = 1 - innen * 0.8;
    richt.copy(tgt).sub(camera.position).normalize();
    const vert = glatt(bereich(Math.abs(richt.y), 0.8, 0.97));
    camera.up.set(0, 1 - vert, -vert * Math.sign(richt.y || 1)).normalize();
    camera.lookAt(tgt);
    camera.translateX(zg.sx * 0.6 * 2 * pf);
    camera.translateY(-zg.sy * 0.3 * 2 * pf);
    kipp = damp(kipp, klemmen(scroll.tempo * 0.0006, -1, 1), 4, dt);
    camera.rotateX(THREE.MathUtils.degToRad(kipp));
    const asp = camera.aspect;
    camera.fov = lerp(KF[i][3], KF[i + 1][3], u) * (asp < 1 ? 1.32 : asp < 1.3 ? 1.12 : 1);
    camera.updateProjectionMatrix();
  }

  /* Ziehen dreht den Bau, Klick auf den Kran bringt eine Tafel */
  const ray = new THREE.Raycaster(), maus = new THREE.Vector2();
  let ziehen = null, dreh = 0, drehV = 0, drehZiel = 0;
  const darfDrehen = () => !(r > 0.34 && r < 0.62);
  canvas.addEventListener('pointerdown', e => {
    ziehen = { x: e.clientX, y: e.clientY, start: drehZiel, bewegt: false, id: e.pointerId };
  });
  addEventListener('pointermove', e => {
    if (!ziehen || e.pointerId !== ziehen.id) return;
    const dx = e.clientX - ziehen.x, dy = e.clientY - ziehen.y;
    if (!ziehen.bewegt && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) { ziehen.bewegt = true; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* egal */ } }
    if (ziehen.bewegt && darfDrehen()) drehZiel = klemmen(ziehen.start + dx * 0.0016, -0.436, 0.436);
  });
  const loslassen = e => {
    if (!ziehen) return;
    if (!ziehen.bewegt) {
      const rr = canvas.getBoundingClientRect();
      maus.set(((e.clientX - rr.left) / rr.width) * 2 - 1, -((e.clientY - rr.top) / rr.height) * 2 + 1);
      ray.setFromCamera(maus, camera);
      if (ray.intersectObjects([kranTreffer, kranTurmTreffer], false).length) tafelBringen();
    }
    ziehen = null;
    drehZiel = 0;
  };
  addEventListener('pointerup', loslassen);
  addEventListener('pointercancel', () => { ziehen = null; drehZiel = 0; });

  function tafelBringen() {
    if (auftrag.aktiv || kran.position.y < -2) return;
    const hoehe = aktuelleOberkante();
    auftrag.aktiv = true; auftrag.t0 = zeit; auftrag.gelandet = false;
    auftrag.ziel.set(-6 + Math.random() * 9, hoehe, -4 + Math.random() * 6);
    if (Math.abs(auftrag.ziel.x - AUGE.x) < 2 && Math.abs(auftrag.ziel.z - AUGE.z) < 2) auftrag.ziel.x -= 3.5;
  }
  let oberkante = 0;
  const aktuelleOberkante = () => oberkante;

  /* Grösse, Sichtbarkeit */
  function groesse() {
    const w = buehne.clientWidth, h = buehne.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', groesse);
  groesse();
  let tabSichtbar = !document.hidden;
  document.addEventListener('visibilitychange', () => { tabSichtbar = !document.hidden; });

  /* Kranstellung (geglättet) */
  const kranZ = { th: 0.8, d: 22, hy: 6, init: false };
  const LAGER = new THREE.Vector3(-8, 0, -16);
  const lokal = new THREE.Vector3();
  function kranZiel(x, z, hy, last) {
    const dx = x - TURM.x, dz = z - TURM.z;
    return { th: Math.atan2(-dz, dx), d: klemmen(Math.hypot(dx, dz), 4, 38), hy, last };
  }
  const himmel = new THREE.Color(), sFarbe = new THREE.Color();

  takt.add((dt, t) => {
    textStand();
    if (!sicht.an || !tabSichtbar) return;
    /* Ablauf an r */
    const rr = r;
    /* Bagger und Bodenplatte */
    const ausfahrt = bereich(rr, 0.06, 0.1);
    const graben = bereich(rr, 0, 0.06);
    bagger.position.set(lerp(lerp(-9, 7, graben), 20.5, ausfahrt), lerp(-TIEF, 0, ausfahrt), lerp(2, -4.5, ausfahrt));
    bagger.rotation.y = lerp(0, 0.35, ausfahrt);
    const ph = rr * 90 + (REDUZIERT ? 0 : t * 1.3);
    ausleger1.rotation.z = -0.55 + 0.35 * Math.sin(ph);
    stiel.rotation.z = -0.4 + 0.45 * Math.sin(ph + 1.2);
    loeffel.rotation.z = 0.3 + 0.6 * Math.sin(ph + 2.1);
    oberwagen.rotation.y = 0.25 * Math.sin(ph * 0.5) * (1 - ausfahrt);
    const pl = bereich(rr, 0.065, 0.095);
    platte.scale.y = Math.max(0.001, pl);
    platte.visible = pl > 0;
    const ug = bereich(rr, 0.09, 0.112);
    ugEbene.constant = -TIEF + 0.4 + ug * (TIEF - 0.4);
    ugWand.visible = ug > 0;
    ugMat.color.copy(FRISCH).lerp(HELL, bereich(rr, 0.112, 0.14));
    const ugd = bereich(rr, 0.105, 0.12);
    ugDecke.visible = ugd > 0;
    oberkante = ugd > 0.99 ? 0 : -TIEF + 0.4;
    /* Hinterfüllung steigt, sobald die Decke über dem Untergeschoss liegt; dann sitzt der Bau im Boden */
    const fu = bereich(rr, 0.112, 0.13);
    fuellung.visible = fu > 0; fuellung.position.y = -TIEF * (1 - fu);
    kontakt.material.opacity = bereich(rr, 0.125, 0.16);

    /* Geschosse */
    const sJetzt = Math.min(3, Math.max(0, Math.floor((rr - 0.12) / 0.125)));
    let kz = null;
    let schalY = 0, schalZu = 0, schalN = 0, armSichtbar = false, armN = 0, armY = 0;
    let gussAn = false, gussPunkt = null, gussY = 0;
    for (let s = 0; s < 4; s++) {
      const g = geschosse[s];
      const f = bereich(rr, 0.12 + s * 0.125, 0.12 + (s + 1) * 0.125);
      const guss = bereich(f, 0.35, 0.7), decke = bereich(f, 0.7, 0.85);
      g.w.visible = guss > 0;
      g.wEbene.constant = g.basis + guss * WH + (guss >= 1 ? 0.01 : 0);
      g.d.visible = decke > 0;
      g.dEbene.constant = -BX - 0.5 + decke * (2 * BX + 1);
      /* frisch gegossen dunkler, nach dem Guss über 1.5 s heller */
      if (guss >= 1) { if (g.wT === null) g.wT = t; } else g.wT = null;
      if (decke >= 1) { if (g.dT === null) g.dT = t; } else g.dT = null;
      g.wMat.color.copy(FRISCH).lerp(HELL, g.wT === null ? 0 : klemmen((t - g.wT) / 1.5));
      g.dMat.color.copy(FRISCH).lerp(HELL, g.dT === null ? 0 : klemmen((t - g.dT) / 1.5));
      if (decke >= 1) oberkante = g.basis + GH;
      augeGel[s].visible = decke >= 1 && rr < 0.8;
      if (s === sJetzt && rr >= 0.12) {
        const arm = bereich(f, 0, 0.25);
        armSichtbar = f < 0.85 && arm > 0; armN = Math.floor(arm * armAnzahl); armY = g.basis;
        schalZu = s === 0 ? bereich(f, 0.18, 0.35) : bereich(f, 0.12, 0.35);
        schalN = s === 0 ? Math.floor(bereich(f, 0.04, 0.3) * tafelPos.length) : tafelPos.length;
        const wandern = bereich(f, 0.85, 1);
        schalY = g.basis + (s < 3 ? wandern * GH : 0);
        if (s < 3 && wandern > 0) schalZu = 1 - Math.sin(wandern * Math.PI) * 0.6;
        if (guss > 0 && guss < 1) { gussAn = true; gussY = g.basis + guss * WH; gussPunkt = [lerp(-11, 11, guss), BZ - WD / 2]; }
        /* Kranziel je Teilphase */
        if (f < 0.05) kz = kranZiel(LAGER.x, LAGER.z, 2.5, 'tafeln');
        else if (f < 0.3) { const k = bereich(f, 0.05, 0.3); kz = kranZiel(lerp(LAGER.x, -6 + s * 3, k), lerp(LAGER.z, -BZ - 1.2, k), g.basis + WH + 3.5 - k * 0.8, 'tafeln'); }
        else if (f < 0.35) kz = kranZiel(-11, BZ - WD / 2, g.basis + WH + 4.2, 'kuebel');
        else if (f < 0.7) kz = kranZiel(gussPunkt ? gussPunkt[0] : 0, BZ - WD / 2, g.basis + WH + 3.4, 'kuebel');
        else if (f < 0.85) kz = kranZiel(-5, 2, g.basis + GH + 3, 'tafeln');
        else kz = kranZiel(-8, -BZ - 1, g.basis + GH + 3 + bereich(f, 0.85, 1) * 3, 'tafeln');
      }
    }
    if (rr < 0.12) kz = kranZiel(lerp(LAGER.x, -4, Math.sin(rr / 0.12 * Math.PI)), lerp(LAGER.z, -BZ - 2, Math.sin(rr / 0.12 * Math.PI)), 3.5, 'tafeln');
    /* Hülle */
    const huelle = bereich(rr, 0.62, 0.8);
    if (rr >= 0.62) {
      schalY = dachY + bereich(rr, 0.62, 0.68) * 14;
      schalN = rr < 0.68 ? tafelPos.length : 0;
      schalZu = 1;
      kz = kranZiel(lerp(0, LAGER.x, bereich(rr, 0.62, 0.7)), lerp(0, LAGER.z, bereich(rr, 0.62, 0.7)), lerp(dachY + 18, 4, bereich(rr, 0.66, 0.74)), 'tafeln');
    }
    dachrand.visible = huelle > 0; dachrand.scale.y = Math.max(0.001, bereich(huelle, 0, 0.3));
    fenster.count = Math.floor(bereich(huelle, 0.2, 0.85) * fensterListe.length);
    gelaender.visible = huelle > 0.85;
    gelaender.scale.y = Math.max(0.001, bereich(huelle, 0.85, 1));
    const ab = bereich(huelle, 0.05, 0.4);
    aufbau.visible = ab > 0; aufbau.scale.y = Math.max(0.001, ab);
    if (huelle > 0.3) oberkante = dachY;
    schalung.position.y = schalY;
    schalungSetzen(schalZu, schalN);
    armierung.visible = armSichtbar;
    armierung.position.y = armY;
    if (armierung.isInstancedMesh) armierung.count = armN; else armierung.geometry.setDrawRange(0, Math.floor(armN / 2) * 2);
    if (!kz) kz = kranZiel(LAGER.x, LAGER.z, 4, 'tafeln');

    /* Übergabe: Ausleger dreht weg, Turm senkt sich */
    const weg = bereich(rr, 0.82, 0.92);
    kz.th += weg * 1.4;
    kran.position.y = -glatt(bereich(rr, 0.86, 1)) * (TH + 10);
    kran.visible = rr < 0.995;

    /* Sonderauftrag: Tafel per Klick */
    let sonder = null;
    if (auftrag.aktiv) {
      const a = zeit - auftrag.t0;
      const zielL = auftrag.ziel;
      if (a < 1.1) sonder = kranZiel(zielL.x, zielL.z, lerp(oberkante + 8, zielL.y + 2.75, easeIO(bereich(a, 0.35, 1.1))), 'tafeln');
      else if (a < 1.8) sonder = kranZiel(zielL.x, zielL.z, lerp(zielL.y + 2.75, zielL.y + 9, easeIO(bereich(a, 1.25, 1.8))), 'leer');
      if (a >= 1.1 && !auftrag.gelandet) {
        auftrag.gelandet = true;
        const tf = schatten(new THREE.Mesh(box(2.4, 0.12, 1.2, 0, 0.06, 0), orangeMat));
        tf.position.set(zielL.x, zielL.y, zielL.z);
        tf.rotation.y = kranZ.th + (Math.random() - 0.5) * 0.4;
        extra.add(tf);
        if (extra.children.length > 10) extra.remove(extra.children[0]);
        ruetteln = REDUZIERT ? 0 : 0.35;
      }
      if (a >= 1.8) auftrag.aktiv = false;
    }
    const zz = sonder || kz;
    const lam = REDUZIERT ? 30 : (sonder ? 6 : 3);
    if (!kranZ.init) { Object.assign(kranZ, zz); kranZ.init = true; }
    let dth = zz.th - kranZ.th; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    kranZ.th += dth * (1 - Math.exp(-lam * dt));
    kranZ.d = damp(kranZ.d, zz.d, lam, dt);
    kranZ.hy = damp(kranZ.hy, zz.hy, lam, dt);
    drehteil.rotation.y = kranZ.th + (REDUZIERT ? 0 : Math.sin(t * 0.3) * 0.03);
    katze.position.x = kranZ.d;
    const hakenWeltY = kranZ.hy;
    const seilL = Math.max(1, TH - 0.6 - (hakenWeltY - 0));
    seilMesh.scale.y = seilL; seilMesh.position.set(kranZ.d, -0.6 - seilL / 2, 0);
    hakenGr.position.set(kranZ.d, -0.6 - seilL, 0);
    lastTafeln.visible = zz.last === 'tafeln';
    kuebel.visible = zz.last === 'kuebel';

    /* Betonstrom aus dem Kübel */
    strahl.visible = gussAn && kuebel.visible;
    if (strahl.visible) {
      drehteil.updateWorldMatrix(true, false);
      lokal.set(kranZ.d, -0.6 - seilL - 3.05, 0).applyMatrix4(drehteil.matrixWorld);
      welt.worldToLocal(lokal);
      const oben = lokal.y, unten = gussY;
      for (let i = 0; i < PN; i++) {
        const u = REDUZIERT ? pz[i][0] : (pz[i][0] + t * 1.6) % 1;
        strahlPos[i * 3] = lokal.x + pz[i][1] * (0.4 + u);
        strahlPos[i * 3 + 1] = lerp(oben, unten, u * u);
        strahlPos[i * 3 + 2] = lokal.z + pz[i][2] * (0.4 + u);
      }
      strahlGeo.attributes.position.needsUpdate = true;
    }

    /* Drehen per Ziehen, federt zurück */
    if (!darfDrehen()) drehZiel = 0;
    if (REDUZIERT) dreh = damp(dreh, drehZiel, 12, dt);
    else { drehV += ((drehZiel - dreh) * 60 - drehV * 11) * dt; dreh += drehV * dt; }
    welt.rotation.y = dreh;
    if (ruetteln > 0) { ruetteln = Math.max(0, ruetteln - dt); const a = ruetteln / 0.35; bau.position.set(Math.sin(t * 70) * 0.05 * a, 0, Math.cos(t * 63) * 0.04 * a); bau.rotation.z = Math.sin(t * 55) * 0.004 * a; }
    else { bau.position.set(0, 0, 0); bau.rotation.z = 0; }
    /* Deckenebenen folgen der Drehung der Welt */
    welt.updateMatrixWorld(true);
    /* Ebenen sind in Weltkoordinaten: x-Ebene der Decke mit der Drehung mitführen */
    const cs = Math.cos(dreh), sn = Math.sin(dreh);
    for (const g of geschosse) { const c = g.dEbene.constant; g.dEbene.normal.set(-cs, 0, sn); g.dEbene.constant = c; }
    ugDeckenEbene.normal.set(-cs, 0, sn);
    ugDeckenEbene.constant = -BX - 0.5 + ugd * (2 * BX + 1);

    /* Licht: Mittag zu Abend */
    /* Sonne wandert über den ganzen Rohbau, die Abendfarbe kommt erst mit Hülle und Übergabe */
    const lauf = glatt(rr);
    const abend = glatt(bereich(rr, 0.55, 1));
    const hoch = THREE.MathUtils.degToRad(lerp(55, 12, lauf));
    const D = 45;
    sonne.position.set(Math.cos(hoch) * Math.cos(AZ) * D, Math.sin(hoch) * D, Math.cos(hoch) * Math.sin(AZ) * D);
    /* Abend: warmes, helles Streiflicht auf dem Beton, kühler Himmel in den Schatten; so wird der
       Beton golden statt braun */
    sonne.color.copy(SONNE_TAG).lerp(SONNE_ABEND, abend * 0.5);
    sonne.intensity = lerp(2.6, 3.0, abend);
    hemi.intensity = lerp(1.6, 1.15, abend);
    himmel.copy(HIMMEL_TAG).lerp(HIMMEL_ABEND, abend);
    renderer.setClearColor(himmel);
    scene.fog.color.copy(himmel);
    hemi.color.copy(HEMI_TAG).lerp(HEMI_ABEND, abend);
    himmelUni.uHorizont.value.copy(himmel);
    himmelUni.uZenit.value.copy(ZENIT_TAG).lerp(ZENIT_ABEND, abend);
    himmelUni.uWolke.value.copy(WOLKE_TAG).lerp(WOLKE_ABEND, abend);
    himmelUni.uSonneFarbe.value.copy(sonne.color);
    himmelUni.uSonne.value.copy(sonne.position).normalize();
    himmelUni.uZeit.value = REDUZIERT ? 0 : t;
    /* Licht in den Wohnungen, sobald es dämmert */
    const la = bereich(rr, 0.8, 0.93) * (fenster.count >= fensterListe.length ? 1 : 0);
    lichter.visible = la > 0; lichtMat.opacity = la;

    kameraSetzen(rr, dt);
    kuppel.position.copy(camera.position);
    lampe.intensity = 46 * bereich(rr, 0.37, 0.43) * (1 - bereich(rr, 0.55, 0.59));
    renderer.render(scene, camera);
  });
}

/* ================= Kapitel 4: Leistungen ================= */
function leistungen() {
  const bild = $('[data-folgebild]');
  if (!bild || !FEIN) return;
  const img = $('img', bild);
  const zeilen = $$('[data-zeile-bild]');
  const z = { x: innerWidth / 2, y: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2, vx: 0, rot: 0, an: false };
  let lx = 0, lt = performance.now();
  zeilen.forEach(zeile => {
    zeile.addEventListener('pointerenter', e => {
      if (img.getAttribute('src') !== zeile.dataset.zeileBild) img.src = zeile.dataset.zeileBild;
      z.an = true; bild.classList.add('ist-an');
      if (!z.lauf) { z.sx = e.clientX; z.sy = e.clientY; }
    });
    zeile.addEventListener('pointerleave', () => { z.an = false; bild.classList.remove('ist-an'); });
  });
  addEventListener('pointermove', e => {
    const j = performance.now(), dt = Math.max(1, j - lt);
    z.vx = (e.clientX - lx) / dt; lx = e.clientX; lt = j;
    z.x = e.clientX; z.y = e.clientY;
  }, { passive: true });
  takt.add(dt => {
    if (!z.an && !bild.classList.contains('ist-an')) { z.lauf = false; return; }
    z.lauf = true;
    const k = REDUZIERT ? 1 : 1 - Math.exp(-12 * dt);
    z.sx = lerp(z.sx, z.x, k); z.sy = lerp(z.sy, z.y, k);
    z.rot = damp(z.rot, klemmen(z.vx * 4, -6, 6), 8, dt);
    z.vx *= Math.exp(-6 * dt);
    bild.style.transform = `translate3d(${z.sx.toFixed(1)}px,${z.sy.toFixed(1)}px,0) rotate(${z.rot.toFixed(2)}deg)`;
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
  window.__quaderScrolleZu = ziel => scrolleZu(ziel);
  function scrolleZu(ziel) {
    if (!ziel) return;
    const y = ziel.id === 'start' ? 0 : ziel.getBoundingClientRect().top + window.scrollY;
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y, behavior: REDUZIERT ? 'auto' : 'smooth' });
  }
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
    }, lenis ? 1500 : 700);
  });
}

/* ================= Kapitel 6: Offerte (Logik aus v2) ================= */
function offerte() {
  const formular = $('[data-formular]');
  const schritte = $$('[data-schritt]', formular);
  const marken = $$('[data-schritt-marke]', formular);
  const ENTWURF = 'quader-bau-offerte-entwurf';
  const ERGEBNIS = 'quader-bau-offerte-demo';
  const tafel = $('[data-tafel]'), haken = $('[data-tafel-haken]'), wisch = $('[data-wisch]');
  const standKote = $('[data-stand-kote]'), leiter = $$('[data-leiter] span'), stand = $('[data-stand]');
  let schrittJetzt = 0;
  const kopfHoehe = () => (istMobil() ? 64 : 88) + 34;

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
    if (lenis) lenis.scrollTo(y, { duration: 0.8 }); else window.scrollTo({ top: y, behavior: REDUZIERT ? 'auto' : 'smooth' });
  }
  function zeigeSchrittSofort(i, fokus) {
    schrittJetzt = i;
    schritte.forEach((s, j) => { s.hidden = j !== i; });
    marken.forEach((m, j) => {
      m.classList.toggle('ist-aktiv', j === i);
      m.classList.toggle('ist-erledigt', j < i);
      if (j === i) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
    });
    stand.hidden = i === 4;
    standKote.textContent = '+' + Math.min(3, i + 1);
    leiter.forEach((l, j) => l.classList.toggle('ist-voll', j <= Math.min(2, i)));
    if (i === 3) zusammenfassen();
    if (fokus) {
      const s = schritte[i];
      const ziel = i >= 3 ? s : s.querySelector('input:not([type="hidden"]), select, textarea');
      if (ziel) ziel.focus({ preventScroll: true });
      const oben = formular.getBoundingClientRect().top;
      if (oben < kopfHoehe() || oben > innerHeight * 0.6) scrolleZuFormular();
    }
  }
  /* Wechsel als kleiner Wipe: ein Paneel fährt seitlich durch (420 ms) */
  let wischt = false;
  function zeigeSchritt(i, fokus = true) {
    if (REDUZIERT || !wisch.animate || wischt) { zeigeSchrittSofort(i, fokus); return; }
    wischt = true;
    const rein = wisch.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], { duration: 210, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' });
    rein.onfinish = () => {
      zeigeSchrittSofort(i, fokus);
      const raus = wisch.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], { duration: 210, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
      raus.onfinish = () => { wisch.style.transform = 'translateX(-101%)'; rein.cancel(); raus.cancel(); wischt = false; };
    };
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
  /* Kran-Haken hebt die Bautafel an und setzt sie wieder ab */
  function hakenHebt() {
    if (REDUZIERT || !haken.animate) return Promise.resolve();
    const ein = { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' };
    return new Promise(fertig => {
      haken.style.opacity = '1';
      haken.animate([{ transform: 'translateY(-60vh)' }, { transform: 'translateY(-62px)' }], ein).onfinish = () => {
        const heb = { duration: 340, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' };
        tafel.animate([{ transform: 'none' }, { transform: 'translateY(-20px)' }, { transform: 'translateY(-20px)' }, { transform: 'none' }], { duration: 900, easing: 'ease-in-out' });
        haken.animate([{ transform: 'translateY(-62px)' }, { transform: 'translateY(-82px)' }, { transform: 'translateY(-82px)' }, { transform: 'translateY(-62px)' }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => {
          haken.animate([{ transform: 'translateY(-62px)' }, { transform: 'translateY(-60vh)' }], heb).onfinish = () => { haken.style.opacity = '0'; };
          fertig();
        };
      };
    });
  }
  formular.addEventListener('submit', async e => {
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
    await hakenHebt();
    zeigeSchritt(4);
  });
  entwurfLaden();
}

/* ================= Start ================= */
function start() {
  motorStarten();
  navigation();
  baender();
  wipes();
  offerte();
  leistungen();
  held().catch(e => console.warn('Hero:', e && e.message));
  planKapitel();
  rohbau().catch(e => console.warn('Rohbau:', e && e.message));
  if (window.ScrollTrigger) {
    addEventListener('load', () => window.ScrollTrigger.refresh());
    document.fonts.ready.then(() => window.ScrollTrigger.refresh());
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
