/* Hebel Webstudio, Startseite: der Film "Wie eine Website entsteht" und alles danach.
   Grundlage: docs/webstudio-2026-10/10-bau-brief-v3.md, Drehbuch Hebel und "Was Wow heisst".

   Aufgaben dieser Datei:
   - Scroll in Filmzeit übersetzen (0 bis 6, ganze Zahlen sind Kapitelgrenzen) und film.js treiben.
   - Kapitel 1 (Wort) im DOM: riesige Schrift, die zerfällt, Punkt, durch den die Kamera taucht.
   - Texte der Kapitel 2 bis 6 bauen sich Zeichen für Zeichen auf und zerfallen wieder.
   - Drei Ebenen (hinten, Mitte, vorne) reagieren auf Zeiger, Scroll-Tempo und am Handy auf Ziehen.
   - Zeiger, Magnetknöpfe, Projektindex mit Vorschau, Blende in die Beispiele, Formular.
   Reduzierte Bewegung: alles am Scroll bleibt, Selbstlaufendes und Zeigerreaktion fallen weg. */

const KONFIG = {
  film: '/hebel-vorschau/v3/studio/js/film.js',
  maxDpr: 1.5,
  supabaseUrl: 'https://dvbqxlakemsjdrcdkfxc.supabase.co',
  // Öffentlicher Anon-Schlüssel wie auf der bisherigen Seite (Rechte regelt die Datenbank).
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YnF4bGFrZW1zamRyY2RrZnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODcwMjYsImV4cCI6MjA5MzM2MzAyNn0._QdYsO4Ns3-oFOxUvGaD-qjcuSUr1iDRWRydr7BAPkg',
};

/* Länge jeder Filmeinheit in Bildschirmhöhen. Kapitel 3 (Bau mit Video) bekommt am meisten Weg. */
const GEWICHT = [1.15, 1.35, 1.9, 1.45, 1.5, 1.3];
/* Fenster der Kapiteltexte in Filmzeit und Ziel beim Springen */
const FENSTER = { 2: [1.0, 1.96], 3: [2.12, 3.04], 4: [3.16, 3.98], 5: [4.2, 5.0], 6: [5.26, 5.92] };
const ZIEL = { 'kapitel-wort': 0, 'kapitel-skizze': 1.55, 'station-fumo': 2.86, 'kapitel-leben': 3.62, 'station-quader': 4.8, 'station-ihre': 5.62 };

const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const PARAM = new URLSearchParams(location.search);
const klemme = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const linear = (a, b, v) => klemme((v - a) / (b - a));
const glatt = (a, b, v) => { const t = linear(a, b, v); return t * t * (3 - 2 * t); };
const aus3 = t => 1 - Math.pow(1 - t, 3);
const ein3 = t => t * t * t;
const mix = (a, b, t) => a + (b - a) * t;
const warte = ms => new Promise(res => setTimeout(res, ms));
const zufall = saat => { let s = saat; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

const HINWEISE = {
  'kein-webgl': 'Dieser Browser zeigt den Film nicht in 3D. Die Kapitel stehen darum als Bilder untereinander.',
  fehler: 'Der Film liess sich nicht laden. Die Kapitel stehen darum als Bilder untereinander.',
};

const ruhig = html.classList.contains('ruhig');
const fein = matchMedia('(hover: hover) and (pointer: fine)').matches;
const zustand = {
  modus: html.classList.contains('modus-3d') ? '3d' : 'statisch',
  film: null,
  lenis: null,
  oben: 0,
  laenge: 1,
  p: 0,
  schmal: false,
  kopfH: 76,
  docMax: 1,
  B: innerWidth,
  H: innerHeight,
};

const filmEl = $('#film');
const buehne = $('.film__buehne');
const kopf = $('#kopf');
const istSchmal = () => innerWidth < 760 || innerWidth / innerHeight < 0.85;

/* ---------- Scroll und Filmzeit ---------- */
const summeGewicht = GEWICHT.reduce((a, b) => a + b, 0);
function pAusFortschritt(f) {
  let s = klemme(f) * summeGewicht;
  for (let i = 0; i < GEWICHT.length; i++) {
    if (s <= GEWICHT[i] || i === GEWICHT.length - 1) return klemme(i + s / GEWICHT[i], 0, 6);
    s -= GEWICHT[i];
  }
  return 6;
}
function scrollFuerP(p) {
  let s = 0;
  const k = Math.floor(klemme(p, 0, 5.999));
  for (let i = 0; i < k; i++) s += GEWICHT[i];
  s += (p - k) * GEWICHT[k];
  return zustand.oben + (s / summeGewicht) * zustand.laenge;
}
function fortschritt() { return klemme((scrollY - zustand.oben) / zustand.laenge); }

/* ---------- Zerlegen in Wörter und Zeichen ---------- */
function zerlegen(el, zeichenKlasse = 'wort__z') {
  const zeichen = [];
  const gehe = knoten => {
    Array.from(knoten.childNodes).forEach(n => {
      if (n.nodeType === 3) {
        const teile = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        teile.forEach(t => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'wort__w';
          for (const c of t) {
            const z = document.createElement('span');
            z.className = zeichenKlasse;
            z.textContent = c;
            w.appendChild(z);
            zeichen.push(z);
          }
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.hasAttribute('data-punkt')) gehe(n);
    });
  };
  gehe(el);
  return zeichen;
}

/* ---------- Kapitel 1: Wort ---------- */
const wort = {
  el: $('#kapitel-wort'),
  satz: $('[data-wort]'),
  punkt: $('[data-punkt]'),
  fuss: $('.wort__fuss'),
  zeichen: [],
  daten: [],
  intro: ruhig ? 1 : 0,
  introStart: 0,
  punktX: 0, punktY: 0, punktR: 6,
  aus: false,
};
const portal = { el: $('[data-portal]'), text: $('[data-portal-text]'), zeichen: [] };
const zirkel = $('[data-zirkel]');
const leiste = $('.kapitelleiste');
const notizPunkt = $('[data-notiz-punkt]');

function wortVorbereiten() {
  wort.zeichen = zerlegen(wort.satz);
  const zz = zufall(17);
  const n = wort.zeichen.length;
  wort.daten = wort.zeichen.map((z, i) => ({
    start: 0.03 + (1 - i / n) * 0.1 + zz() * 0.12,
    dx: (zz() - 0.5) * 0.7,
    dy: 0.1 + zz() * 0.5,
    dz: -(700 + zz() * 2600),
    rx: (zz() - 0.5) * 160,
    ry: (zz() - 0.5) * 120,
    rz: (zz() - 0.5) * 80,
    verz: i * 22,
  }));
  portal.zeichen = zerlegen(portal.text, 'portal__z');
}

function wortSetzen(p, jetzt) {
  const B = zustand.B, H = zustand.H;
  // Einstieg: die Zeichen steigen nacheinander auf (nur ohne reduzierte Bewegung)
  let introLaeuft = false;
  if (wort.intro < 1 && wort.introStart) {
    const t = jetzt - wort.introStart;
    wort.intro = klemme(t / (wort.zeichen.length * 22 + 950));
    introLaeuft = wort.intro < 1;
  }
  const sichtbar = p < 0.74;
  if (!sichtbar) {
    if (!wort.aus) { wort.el.style.visibility = 'hidden'; wort.aus = true; }
  } else {
    if (wort.aus) { wort.el.style.visibility = ''; wort.aus = false; }
    const zeilenH = wort.schrift || 100;
    wort.zeichen.forEach((z, i) => {
      const d = wort.daten[i];
      const t = ein3(linear(d.start, d.start + 0.3, p));
      let e = 1;
      if (wort.intro < 1) e = wort.introStart ? aus3(klemme((jetzt - wort.introStart - d.verz) / 950)) : 0;
      const ty = d.dy * H * t + (1 - e) * zeilenH * 0.9;
      const rz = d.rz * t + (1 - e) * 9;
      z.style.transform = `translate3d(${(d.dx * B * t).toFixed(1)}px, ${ty.toFixed(1)}px, ${(d.dz * t).toFixed(0)}px) rotateX(${(d.rx * t).toFixed(1)}deg) rotateY(${(d.ry * t).toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg)`;
      z.style.opacity = (e * (1 - glatt(0.5, 1, t))).toFixed(3);
    });
    const f = glatt(0.02, 0.2, p);
    wort.fuss.style.opacity = ((1 - f) * (wort.intro < 1 ? glatt(0.5, 1, wort.intro) : 1)).toFixed(3);
    wort.fuss.style.transform = `translate3d(0, ${(f * 40).toFixed(1)}px, 0)`;
    // Der Punkt bleibt, wächst ein wenig und wird zum Portal
    const pz = glatt(0.18, 0.4, p);
    wort.punkt.style.transform = `scale(${(1 + pz * 1.6).toFixed(3)})`;
    wort.punkt.style.opacity = p > 0.4 ? '0' : '1';
  }
  // Zirkel um den Punkt
  const zA = (1 - glatt(0.22, 0.5, p)) * (wort.intro < 1 ? glatt(0.2, 0.9, wort.intro) : 1);
  zirkel.style.opacity = zA.toFixed(3);
  if (zA > 0.001) zirkel.style.transform = `translate3d(${wort.punktX.toFixed(1)}px, ${wort.punktY.toFixed(1)}px, 0) rotate(${(p * 70).toFixed(2)}deg) scale(${(0.85 + p * 2.4 + (1 - (wort.intro < 1 ? aus3(wort.intro) : 1)) * 0.3).toFixed(3)})`;
  // Notiz "hier fängt es an": schreibt sich beim Einstieg, geht mit dem ersten Scroll
  if (notizPunkt) {
    const schreib = wort.intro < 1 ? linear(0.55, 1, wort.intro) : 1;
    const nA = 1 - glatt(0.06, 0.2, p);
    notizPunkt.style.opacity = (nA * (schreib > 0 ? 1 : 0)).toFixed(3);
    notizPunkt.style.clipPath = schreib >= 1 ? 'none' : `inset(-20% ${((1 - schreib) * 100).toFixed(1)}% -20% -4%)`;
    const nb = zustand.notizB || 200, nh = zustand.notizH || 50;
    // rechts oberhalb des Punkts, der Pfeil zeigt nach links unten auf ihn
    // rechts oberhalb des Punkts, der Pfeil zeigt nach links unten auf ihn; schmal unter dem Titel
    const nx = zustand.schmal ? klemme(wort.punktX - nb * 0.35, 8, zustand.B - nb - 8) : wort.punktX + wort.punktR * 1.2;
    const ny = zustand.schmal ? wort.punktY + wort.punktR * 2.4 : wort.punktY - nh - wort.punktR * 1.6;
    notizPunkt.style.transform = `translate3d(${nx.toFixed(1)}px, ${(ny - p * 120).toFixed(1)}px, 0) rotate(-4deg)`;
  }
  // Portal: der Punkt wächst über das ganze Bild, dann öffnet sich in seiner Mitte die Welt
  const diag = Math.hypot(Math.max(wort.punktX, B - wort.punktX), Math.max(wort.punktY, H - wort.punktY)) + 4;
  const zu = ein3(linear(0.36, 0.64, p));
  const loch = aus3(linear(0.66, 0.94, p));
  const portalAn = p > 0.36 && p < 0.95;
  portal.el.style.visibility = portalAn ? 'visible' : 'hidden';
  if (leiste) leiste.style.opacity = portalAn && zu > 0.3 && loch < 0.5 ? '0' : '';
  if (portalAn) {
    const r = mix(wort.punktR * 2.6, diag, zu);
    portal.el.style.clipPath = `circle(${r.toFixed(1)}px at ${wort.punktX.toFixed(1)}px ${wort.punktY.toFixed(1)}px)`;
    const h = loch * diag;
    const maske = loch > 0 ? `radial-gradient(circle at ${wort.punktX.toFixed(1)}px ${wort.punktY.toFixed(1)}px, transparent ${h.toFixed(1)}px, #000 ${(h + 1.5).toFixed(1)}px)` : 'none';
    portal.el.style.webkitMaskImage = maske;
    portal.el.style.maskImage = maske;
    const n = portal.zeichen.length;
    portal.zeichen.forEach((z, i) => {
      const a = aus3(linear(0.48 + i / n * 0.08, 0.58 + i / n * 0.08, p));
      const w = ein3(linear(0.66, 0.78, p));
      z.style.transform = `translate3d(0, ${((1 - a) * 60).toFixed(1)}px, 0) scale(${(1 + w * 2.2).toFixed(3)})`;
      z.style.opacity = (a * (1 - w)).toFixed(3);
    });
  }
  return introLaeuft;
}

/* ---------- Kapitel 2 bis 6: Texte ---------- */
const kapitel = $$('.kapitel').map(el => {
  const k = Number(el.dataset.kapitel);
  const titel = $('.kapitel__titel', el);
  const rest = $$('.kapitel__text, .kapitel__link, .kapitel__vermerk, .knopfreihe', el);
  return { el, k, titel, rest, zeichen: [], an: true, fenster: FENSTER[k] };
});
function kapitelVorbereiten() {
  kapitel.forEach(K => {
    K.titel.setAttribute('aria-label', K.titel.textContent.trim());
    const innen = document.createElement('span');
    innen.setAttribute('aria-hidden', 'true');
    innen.innerHTML = K.titel.innerHTML;
    K.titel.textContent = '';
    K.titel.appendChild(innen);
    K.zeichen = zerlegen(innen);
  });
}
function kapitelSetzen(p) {
  kapitel.forEach(K => {
    const [a, b] = K.fenster;
    const nah = p > a - 0.02 && p < b + 0.02;
    if (!nah) {
      if (K.an) {
        K.an = false;
        K.el.classList.remove('ist-sichtbar', 'ist-aktiv');
      }
      return;
    }
    K.an = true;
    const ein = linear(a, a + 0.26, p);
    const aus = linear(b - 0.16, b, p);
    const n = K.zeichen.length;
    K.zeichen.forEach((z, i) => {
      const v = i / n * 0.55;
      const ei = aus3(klemme(ein * 1.55 - v));
      const ai = ein3(klemme(aus * 1.55 - v));
      const ty = (1 - ei) * 105 - ai * 70;
      z.style.transform = `translate3d(0, ${ty.toFixed(1)}%, 0) rotate(${((1 - ei) * 8 - ai * 6).toFixed(2)}deg) skewX(${(ai * -14).toFixed(1)}deg)`;
      z.style.opacity = (ei * (1 - ai)).toFixed(3);
    });
    const rA = glatt(0.3, 0.75, ein) * (1 - glatt(0, 0.55, aus));
    K.rest.forEach((r, j) => {
      const ver = (1 - glatt(0.3 + j * 0.08, 0.8 + j * 0.06, ein)) * 34 - glatt(0, 0.6, aus) * 26;
      r.style.transform = `translate3d(0, ${ver.toFixed(1)}px, 0)`;
      r.style.opacity = rA.toFixed(3);
    });
    K.el.classList.add('ist-sichtbar');
    K.el.classList.toggle('ist-aktiv', rA > 0.6);
  });
}

/* ---------- Hintere und vordere Ebene ---------- */
const riesig = $$('[data-riesig]').map(el => {
  const [von, bis] = el.dataset.riesig.split(' ').map(Number);
  return { el, von, bis, b: 0, an: true };
});
const lineal = $('[data-lineal]');
const glut = $$('[data-glut]').map((el, i) => {
  const zz = zufall(40 + i * 7);
  const gr = 18 + zz() * 90;
  el.style.width = el.style.height = `${gr.toFixed(0)}px`;
  el.style.filter = `blur(${(gr / 7).toFixed(1)}px)`;
  return { el, x: zz(), phase: zz(), tempo: 0.7 + zz() * 1.3, gr };
});
const tippRinge = $$('[data-tipp]');
const notizTipp = $('[data-notiz-tipp]');
const risse = $('[data-risse]');
const marken = $$('[data-marke]');
const schwarz = $('[data-schwarz]');
const leisteLinks = $$('[data-zu-kapitel]');
let risseLaenge = [];

function linealBauen() {
  const g = $('[data-striche]', lineal);
  if (!g) return;
  let teile = '';
  for (let x = 20, i = 0; x < 1590; x += 10, i++) {
    const l = i % 10 === 0 ? 26 : i % 5 === 0 ? 17 : 10;
    teile += `<line x1="${x}" y1="1" x2="${x}" y2="${l}"/>`;
    if (i % 10 === 0) teile += `<text x="${x + 4}" y="44" font-size="13" fill="#2340FF" stroke="none" font-family="Atkinson Hyperlegible Mono, monospace">${i / 10}</text>`;
  }
  g.innerHTML = teile;
}
function risseBauen() {
  const zz = zufall(23);
  let pfade = '';
  for (let k = 0; k < 15; k++) {
    let a = (k / 15) * Math.PI * 2 + zz() * 0.35;
    let x = 0, y = 0, d = 'M0 0';
    for (let s = 0; s < 22; s++) {
      a += (zz() - 0.5) * 0.55;
      const l = 30 + zz() * 70;
      x += Math.cos(a) * l; y += Math.sin(a) * l;
      d += ` L${x.toFixed(0)} ${y.toFixed(0)}`;
      if (Math.abs(x) > 1150 || Math.abs(y) > 1150) break;
    }
    pfade += `<path d="${d}"/>`;
  }
  risse.innerHTML = pfade;
  risseLaenge = $$('path', risse).map(pf => {
    const l = pf.getTotalLength ? pf.getTotalLength() : 1500;
    pf.style.strokeDasharray = `${l} ${l}`;
    pf.style.strokeDashoffset = `${l}`;
    return l;
  });
}

function ebenenInhalt(p, zeit) {
  const B = zustand.B, H = zustand.H;
  // Grosse Wörter laufen von rechts nach links durch ihr Kapitel
  riesig.forEach(R => {
    const t = linear(R.von, R.bis, p);
    const a = glatt(0, 0.14, t) * (1 - glatt(0.86, 1, t));
    if (a < 0.002) { if (R.an) { R.el.style.opacity = '0'; R.an = false; } return; }
    R.an = true;
    const x = mix(B * 0.66, B * 0.34 - R.b, t);
    R.el.style.opacity = a.toFixed(3);
    R.el.style.transform = `translate3d(${x.toFixed(1)}px, -50%, 0)`;
  });
  // Kapitel 2: ein Lineal schiebt sich schräg über Skizze und Titel
  const lt = linear(0.98, 2.02, p);
  const lA = glatt(0, 0.1, lt) * (1 - glatt(0.88, 1, lt));
  lineal.style.opacity = lA.toFixed(3);
  if (lA > 0.001) lineal.style.transform = `translate3d(${mix(B * 0.3, -B * 0.95, lt).toFixed(1)}px, ${mix(H * 0.86, H * 0.4, lt).toFixed(1)}px, 0) rotate(-9deg)`;
  // Kapitel 3: Glut im Vordergrund, unscharf, sie steigt mit dem Scroll und im Leerlauf
  const gt = linear(2.5, 3.14, p);
  const gA = glatt(0, 0.12, gt) * (1 - glatt(0.85, 1, gt));
  glut.forEach(G => {
    if (gA < 0.002) { G.el.style.opacity = '0'; return; }
    const lauf = (G.phase + gt * G.tempo * 1.6 + (ruhig ? 0 : zeit * 0.06 * G.tempo)) % 1;
    const x = (0.38 + G.x * 0.62) * B + Math.sin(lauf * 6 + G.phase * 9) * 30;
    const y = H * (1.1 - lauf * 1.3);
    G.el.style.opacity = (gA * 0.85 * Math.sin(Math.PI * lauf)).toFixed(3);
    G.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  });
  // Kapitel 4: Ring um den Finger, Notiz, dann Risse über das ganze Bild
  const tippAn = p > 3.4 && p < 4.32 && zustand.film;
  const tipp = tippAn ? zustand.film.punktTipp() : null;
  tippRinge.forEach((r, i) => {
    const k1 = linear(3.43 + i * 0.05, 3.64 + i * 0.05, p);
    const k2 = linear(3.97 + i * 0.02, 4.06 + i * 0.02, p);
    const k = k2 > 0 ? k2 : k1;
    const a = tipp && k > 0 && k < 1 ? (1 - k) * 0.85 : 0;
    r.style.opacity = a.toFixed(3);
    if (a > 0) r.style.transform = `translate3d(${tipp.x.toFixed(1)}px, ${tipp.y.toFixed(1)}px, 0) scale(${(0.18 + aus3(k) * (k2 > 0 ? 6 : 2.4)).toFixed(3)})`;
  });
  if (notizTipp) {
    const w = linear(3.46, 3.56, p);
    const a = tipp ? glatt(3.46, 3.48, p) * (1 - glatt(3.9, 3.97, p)) : 0;
    notizTipp.style.opacity = a.toFixed(3);
    if (a > 0) {
      const nb = zustand.tippB || 160, nh = zustand.tippH || 50;
      notizTipp.style.clipPath = w >= 1 ? 'none' : `inset(-20% ${((1 - w) * 100).toFixed(1)}% -20% -4%)`;
      notizTipp.style.transform = `translate3d(${Math.max(8, tipp.x - nb - 70).toFixed(1)}px, ${(tipp.y - nh - 40).toFixed(1)}px, 0) rotate(-5deg)`;
    }
  }
  const rk = aus3(linear(3.985, 4.07, p));
  const rA = tipp && rk > 0 ? 1 - glatt(4.12, 4.3, p) : 0;
  risse.style.opacity = (rA * 0.9).toFixed(3);
  if (rA > 0) {
    risse.style.transform = `translate3d(${tipp.x.toFixed(1)}px, ${tipp.y.toFixed(1)}px, 0)`;
    $$('path', risse).forEach((pf, i) => { pf.style.strokeDashoffset = `${(risseLaenge[i] * (1 - rk)).toFixed(1)}`; });
  }
  // Kapitel 6: Schnittmarken um das leere Gitter, die Schwarzblende kommt aus ihm heraus
  const mA = glatt(5.32, 5.42, p) * (1 - glatt(5.86, 5.92, p));
  let rect = null;
  if ((mA > 0.001 || p > 5.86) && zustand.film) rect = zustand.film.rechteckLeer();
  marken.forEach((m, i) => {
    if (!rect || mA < 0.002) { m.style.opacity = '0'; return; }
    const schlag = ruhig ? 0 : (0.5 + 0.5 * Math.sin(zeit * 2.6)) * 6;
    const aus = 14 + schlag;
    const x = i % 2 === 0 ? rect.x0 - aus - 26 : rect.x1 + aus;
    const y = i < 2 ? rect.y0 - aus - 26 : rect.y1 + aus;
    m.style.opacity = mA.toFixed(3);
    m.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  });
  const sA = p > 5.86 && rect;
  schwarz.style.visibility = sA ? 'visible' : 'hidden';
  if (sA) {
    const e = ein3(linear(5.9, 6.0, p)) * 0.5 + aus3(linear(5.9, 6.0, p)) * 0.5;
    const fl = 1 - e;
    const o = Math.max(0, rect.y0) * fl, l = Math.max(0, rect.x0) * fl;
    const u = Math.max(0, rect.hoehe - rect.y1) * fl, r = Math.max(0, rect.breite - rect.x1) * fl;
    schwarz.style.clipPath = `inset(${o.toFixed(1)}px ${r.toFixed(1)}px ${u.toFixed(1)}px ${l.toFixed(1)}px)`;
    schwarz.style.opacity = glatt(5.86, 5.9, p).toFixed(3);
  }
  // Kapitelleiste
  const jetzt = Math.min(5, Math.floor(p + 0.02));
  leisteLinks.forEach((a, i) => a.classList.toggle('ist-jetzt', i === jetzt));
  filmEl.classList.toggle('film--dunkel', p > 5.95);
}

/* Alles, was an der Filmzeit hängt */
let letzteZeit = 0;
function domSetzen(p) {
  zustand.p = p;
  const jetzt = performance.now();
  const zeit = jetzt / 1000;
  const introLaeuft = wortSetzen(p, jetzt);
  kapitelSetzen(p);
  ebenenInhalt(p, zeit);
  kopfSetzen();
  letzteZeit = jetzt;
  return introLaeuft;
}

/* ---------- Ebenen reagieren: Zeiger, Scroll-Tempo, Ziehen ---------- */
const ebenen = $$('[data-ebene]').map(el => ({ el, tiefe: Number(el.dataset.ebene) }));
const reaktion = { zx: 0, zy: 0, x: 0, y: 0, tempo: 0, letzteY: scrollY, letzteT: 0, laeuft: false };
function reaktionWecken() {
  if (reaktion.laeuft || zustand.modus !== '3d') return;
  reaktion.laeuft = true;
  reaktion.letzteT = 0;
  requestAnimationFrame(reaktionBild);
}
function reaktionBild(jetzt) {
  reaktion.laeuft = false;
  const dt = reaktion.letzteT ? Math.min(0.05, (jetzt - reaktion.letzteT) / 1000) : 1 / 60;
  reaktion.letzteT = jetzt;
  const y = scrollY;
  const roh = (y - reaktion.letzteY) / Math.max(dt, 1 / 240);
  reaktion.letzteY = y;
  if (!ruhig) {
    reaktion.tempo += (klemme(roh / 2600, -1, 1) - reaktion.tempo) * (1 - Math.exp(-dt / 0.09));
    const k = 1 - Math.exp(-dt / 0.14);
    reaktion.x += (reaktion.zx - reaktion.x) * k;
    reaktion.y += (reaktion.zy - reaktion.y) * k;
  }
  const filmSichtbar = y < zustand.oben + zustand.laenge + zustand.H;
  if (filmSichtbar) {
    ebenen.forEach(E => {
      const d = E.tiefe;
      const tx = -reaktion.x * d * 28;
      const ty = -reaktion.y * d * 18 + reaktion.tempo * d * 46;
      const skew = reaktion.tempo * d * 2.4;
      const streck = 1 + Math.abs(reaktion.tempo) * d * 0.035;
      E.el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) skewY(${skew.toFixed(3)}deg) scaleY(${streck.toFixed(4)})`;
    });
    if (zustand.film) zustand.film.setPointer(reaktion.x, reaktion.y);
  }
  // Intro des Titels läuft ohne Scroll weiter
  let intro = false;
  if (wort.intro < 1 && zustand.p < 0.8) intro = domSetzen(zustand.film ? zustand.p : pAusFortschritt(fortschritt()));
  const ruht = Math.abs(reaktion.tempo) < 0.0015 && Math.abs(reaktion.zx - reaktion.x) < 0.001 && Math.abs(reaktion.zy - reaktion.y) < 0.001;
  if (!ruht || intro || Math.abs(roh) > 1) reaktionWecken();
}

function zeigerReaktion() {
  if (ruhig || zustand.modus !== '3d') return;
  if (fein) {
    addEventListener('pointermove', e => {
      reaktion.zx = e.clientX / innerWidth * 2 - 1;
      reaktion.zy = -(e.clientY / innerHeight * 2 - 1);
      reaktionWecken();
    }, { passive: true });
  } else {
    // Handy: Ziehen verschiebt die Ebenen, beim Loslassen federn sie zurück
    let x0 = 0, y0 = 0;
    addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    addEventListener('touchmove', e => {
      const t = e.touches[0];
      reaktion.zx = klemme((t.clientX - x0) / innerWidth * 2.4, -1, 1);
      reaktion.zy = klemme(-(t.clientY - y0) / innerHeight * 0.8, -1, 1);
      reaktionWecken();
    }, { passive: true });
    const los = () => { reaktion.zx = 0; reaktion.zy = 0; reaktionWecken(); };
    addEventListener('touchend', los, { passive: true });
    addEventListener('touchcancel', los, { passive: true });
  }
}

/* ---------- Vermessen ---------- */
function vermessen() {
  zustand.B = innerWidth;
  zustand.H = innerHeight;
  zustand.schmal = istSchmal();
  if (zustand.modus === '3d') {
    const fak = zustand.schmal ? 0.9 : 1;
    filmEl.style.setProperty('--film-hoehe', `calc(100svh + ${(summeGewicht * fak * 100).toFixed(1)}svh)`);
  }
  const r = filmEl.getBoundingClientRect();
  zustand.oben = r.top + scrollY;
  zustand.laenge = Math.max(1, filmEl.offsetHeight - innerHeight);
  if (zustand.modus === '3d') {
    // Ort des Punkts ohne Ebenenverschiebung: Abstand zur Bühne
    const rb = buehne.getBoundingClientRect();
    const alt = wort.punkt.style.transform;
    wort.punkt.style.transform = 'none';
    const rp = wort.punkt.getBoundingClientRect();
    wort.punkt.style.transform = alt;
    wort.punktX = rp.left + rp.width / 2 - rb.left;
    wort.punktY = rp.top + rp.height / 2 - rb.top;
    wort.punktR = rp.width / 2 || 6;
    wort.schrift = parseFloat(getComputedStyle($('.wort__titel')).fontSize) || 100;
    riesig.forEach(R => { R.b = R.el.offsetWidth; });
  }
  zustand.kopfH = kopf.offsetHeight;
  zustand.docMax = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  if (notizPunkt) { zustand.notizB = notizPunkt.offsetWidth; zustand.notizH = notizPunkt.offsetHeight; }
  if (notizTipp) { zustand.tippB = notizTipp.offsetWidth; zustand.tippH = notizTipp.offsetHeight; }
  dunkleFlaechen = $$('.dunkel').map(el => {
    const q = el.getBoundingClientRect();
    return [q.top + scrollY, q.bottom + scrollY];
  });
}

/* ---------- Kopf ---------- */
let dunkleFlaechen = [];
const fortschrittBalken = $('[data-fortschritt]');
function kopfSetzen() {
  const y = scrollY;
  const mitte = y + zustand.kopfH / 2;
  const ende = zustand.oben + zustand.laenge;
  const imFilm = zustand.modus === '3d' && y < ende - 2;
  let dunkel = dunkleFlaechen.some(([a, b]) => mitte >= a && mitte < b);
  if (zustand.modus === '3d' && y >= ende - 2 && y < ende + innerHeight && zustand.p > 5.95) dunkel = true;
  if (imFilm && zustand.p > 5.95) dunkel = true;
  kopf.classList.toggle('kopf--dunkel', dunkel);
  kopf.classList.toggle('kopf--hinterlegt', !imFilm && y > 8);
  if (fortschrittBalken) fortschrittBalken.style.transform = `scaleX(${klemme(y / zustand.docMax).toFixed(4)})`;
}

/* ---------- Scroll ---------- */
function beimScroll() {
  if (zustand.modus !== '3d') { kopfSetzen(); return; }
  const p = pAusFortschritt(fortschritt());
  if (zustand.film) {
    zustand.film.setProgress(p);
    const r = filmEl.getBoundingClientRect();
    if (r.bottom < -50 || r.top > innerHeight + 50) zustand.film.pause();
    else zustand.film.resume();
    if (r.bottom < 0) kopfSetzen();
  } else domSetzen(p);
  reaktionWecken();
}

function scrolleZu(y, sofort = false) {
  if (zustand.lenis) zustand.lenis.scrollTo(y, sofort ? { immediate: true, force: true } : { duration: 1.6 });
  else window.scrollTo({ top: y, behavior: sofort || ruhig ? 'auto' : 'smooth' });
}

/* ---------- Links, Menü, Fokus ---------- */
let menueKnopf;
function menueZu() {
  if (!menueKnopf || menueKnopf.getAttribute('aria-expanded') !== 'true') return;
  menueKnopf.setAttribute('aria-expanded', 'false');
  $('[data-menue-text]').textContent = 'Menü öffnen';
  kopf.classList.remove('kopf--offen');
}
function menue() {
  menueKnopf = $('[data-menue]');
  if (!menueKnopf) return;
  menueKnopf.addEventListener('click', () => {
    const offen = menueKnopf.getAttribute('aria-expanded') === 'true';
    if (offen) { menueZu(); return; }
    menueKnopf.setAttribute('aria-expanded', 'true');
    $('[data-menue-text]').textContent = 'Menü schliessen';
    kopf.classList.add('kopf--offen');
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || menueKnopf.getAttribute('aria-expanded') !== 'true') return;
    menueZu();
    menueKnopf.focus();
  });
}

function links() {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const ziel = id ? document.getElementById(id) : null;
    if (!ziel) return;
    menueZu();
    if (zustand.modus === '3d' && ZIEL[id] !== undefined) {
      e.preventDefault();
      scrolleZu(scrollFuerP(ZIEL[id]));
      return;
    }
    if (zustand.lenis) {
      e.preventDefault();
      zustand.lenis.scrollTo(ziel, { offset: -kopf.offsetHeight + 1, duration: 1.4 });
      history.replaceState(null, '', `#${id}`);
    }
  });
  // Tastatur: springt der Fokus in ein Kapitel, springt der Film dorthin
  document.addEventListener('focusin', e => {
    if (zustand.modus !== '3d') return;
    const k = e.target.closest('.kapitel, .wort');
    if (k && ZIEL[k.id] !== undefined) {
      const ziel = ZIEL[k.id];
      if (Math.abs(zustand.p - ziel) > 0.35) {
        scrolleZu(scrollFuerP(ziel), true);
        if (zustand.film) zustand.film.springe(ziel);
      }
    } else if (zustand.lenis && zustand.lenis.isScrolling) zustand.lenis.reset();
  });
}

/* ---------- Blende in die Beispiele ---------- */
function blende() {
  const flaeche = $('[data-blende-flaeche]');
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-blende]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || ruhig || !flaeche.animate) return;
    e.preventDefault();
    let weg = false;
    const gehe = () => { if (!weg) { weg = true; location.href = a.href; } };
    const x = e.clientX || innerWidth / 2, y = e.clientY || innerHeight / 2;
    flaeche.style.visibility = 'visible';
    html.classList.add('taucht');
    const anim = flaeche.animate([
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      { clipPath: `circle(${Math.hypot(innerWidth, innerHeight)}px at ${x}px ${y}px)` },
    ], { duration: 640, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', fill: 'forwards' });
    anim.onfinish = gehe;
    setTimeout(gehe, 1300);
  });
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    flaeche.getAnimations().forEach(x => x.cancel());
    flaeche.style.visibility = 'hidden';
    html.classList.remove('taucht');
  });
}

/* ---------- Zeiger und Magnetknöpfe ---------- */
function zeiger() {
  if (!fein) return;
  const el = $('.zeiger');
  const ring = $('.zeiger__ring', el), punkt = $('.zeiger__punkt', el), text = $('[data-zeiger-text]', el);
  html.classList.add('zeiger-an');
  el.classList.add('zeiger--weg');
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, laeuft = false;
  const bild = () => {
    laeuft = false;
    rx += (x - rx) * (ruhig ? 1 : 0.2);
    ry += (y - ry) * (ruhig ? 1 : 0.2);
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    punkt.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (Math.abs(x - rx) > 0.2 || Math.abs(y - ry) > 0.2) { laeuft = true; requestAnimationFrame(bild); }
  };
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    el.classList.remove('zeiger--weg');
    if (!laeuft) { laeuft = true; requestAnimationFrame(bild); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => el.classList.add('zeiger--weg'));
  document.addEventListener('pointerover', e => {
    const mitText = e.target.closest('[data-zeiger]');
    const klickbar = e.target.closest('a, button, label, summary');
    const feld = e.target.closest('input, textarea');
    el.classList.toggle('zeiger--text', !!mitText);
    el.classList.toggle('zeiger--gross', !mitText && !!klickbar);
    el.classList.toggle('zeiger--weg', !!feld);
    if (mitText) text.textContent = mitText.dataset.zeiger;
  });
  if (ruhig) return;
  $$('[data-magnet]').forEach(k => {
    k.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.25s, box-shadow 0.25s';
    k.addEventListener('pointermove', e => {
      const r = k.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      k.style.transform = `translate(${(dx * 0.22).toFixed(1)}px, ${(dy * 0.34).toFixed(1)}px)`;
    });
    k.addEventListener('pointerleave', () => { k.style.transform = ''; });
  });
}

/* ---------- Projektindex: Vorschau folgt dem Zeiger und verzieht sich mit dem Tempo ---------- */
function projektindex() {
  const box = $('[data-vorschau-bild]');
  if (!fein || !box) return;
  const img = $('img', box);
  let x = 0, y = 0, bx = 0, by = 0, an = false, laeuft = false, alpha = 0;
  const bild = () => {
    laeuft = false;
    const vx = x - bx;
    bx += (x - bx) * (ruhig ? 1 : 0.16);
    by += (y - by) * (ruhig ? 1 : 0.16);
    alpha += ((an ? 1 : 0) - alpha) * (ruhig ? 1 : 0.18);
    const dreh = ruhig ? 0 : klemme(vx * 0.06, -12, 12);
    const schief = ruhig ? 0 : klemme(vx * 0.03, -8, 8);
    box.style.opacity = alpha.toFixed(3);
    box.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) rotate(${dreh.toFixed(2)}deg) skewX(${schief.toFixed(2)}deg) scale(${(0.86 + alpha * 0.14).toFixed(3)})`;
    if (Math.abs(x - bx) > 0.3 || Math.abs(y - by) > 0.3 || Math.abs(alpha - (an ? 1 : 0)) > 0.01) { laeuft = true; requestAnimationFrame(bild); }
  };
  const wecken = () => { if (!laeuft) { laeuft = true; requestAnimationFrame(bild); } };
  $$('.projekt__link').forEach(a => {
    a.addEventListener('pointerenter', e => {
      const q = a.dataset.vorschau;
      if (!q) { an = false; wecken(); return; }
      if (img.getAttribute('src') !== q) img.src = q;
      if (!an) { bx = x = e.clientX; by = y = e.clientY; }
      an = true; wecken();
    });
    a.addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; wecken(); });
    a.addEventListener('pointerleave', () => { an = false; wecken(); });
  });
}

/* ---------- Nach dem Film: Zeilen bauen sich am Scroll auf ---------- */
function nachDemFilm() {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  if (!gsap || !ST) return;
  gsap.registerPlugin(ST);
  $$('[data-zeilen]').forEach(h => {
    h.setAttribute('aria-label', h.textContent.trim());
    const woerter = h.textContent.trim().split(/\s+/);
    h.innerHTML = '';
    const innen = document.createElement('span');
    innen.setAttribute('aria-hidden', 'true');
    woerter.forEach((w, i) => {
      const m = document.createElement('span');
      m.className = 'zeile-m';
      const s = document.createElement('span');
      s.className = 'zeile-w';
      s.textContent = w;
      m.appendChild(s);
      innen.appendChild(m);
      if (i < woerter.length - 1) innen.appendChild(document.createTextNode(' '));
    });
    h.appendChild(innen);
    gsap.fromTo($$('.zeile-w', h), { yPercent: 112, rotate: 5 }, {
      yPercent: 0, rotate: 0, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: h, start: 'top 92%', end: 'top 52%', scrub: ruhig ? true : 0.6 },
    });
  });
  // Grosse Zahlen der Stufen laufen gegen den Scroll
  $$('.stufe__zahl span').forEach(z => {
    gsap.fromTo(z, { yPercent: 34 }, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: z.closest('.stufe'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  // Fuss: "Hebel" steigt Buchstabe für Buchstabe auf
  const gross = $('.fuss__gross');
  if (gross) {
    const t = gross.textContent.trim();
    gross.innerHTML = [...t].map(c => `<span>${c}</span>`).join('');
    gsap.fromTo($$('span', gross), { yPercent: 70 }, { yPercent: 0, ease: 'none', stagger: 0.08, scrollTrigger: { trigger: gross, start: 'top bottom', end: 'bottom 85%', scrub: true } });
  }
  // Ablauf: am Desktop laufen die Schritte quer durch das Bild
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1081px)', () => {
    const spur = $('[data-spur]'), band = $('[data-band]');
    if (!spur || !band) return undefined;
    const weite = () => Math.max(0, band.scrollWidth - innerWidth);
    const tw = gsap.to(band, { x: () => -weite(), ease: 'none', scrollTrigger: { trigger: spur, start: 'top top', end: 'bottom bottom', scrub: ruhig ? true : 0.5, invalidateOnRefresh: true } });
    return () => tw.kill();
  });
  addEventListener('load', () => ST.refresh());
}

/* ---------- Ohne 3D: Skizzen als Zeichnung ---------- */
async function statischeSkizzen() {
  const ziele = $$('[data-statisch-skizze]');
  if (!ziele.length) return;
  let d;
  try { d = await import('/hebel-vorschau/v3/studio/js/skizze-daten.js'); } catch (e) { return; }
  const BREITE = { haupt: 2.6, fein: 1.4, mass: 1.1, strich: 1.8 };
  const bauen = (striche, notizen) => {
    const linien = striche.map(s => `<polyline points="${s.p.map(q => q.join(',')).join(' ')}" stroke-width="${BREITE[s.art] || 1.5}"${s.art === 'strich' ? ' stroke-dasharray="12 9"' : ''}/>`).join('');
    const texte = notizen.map(n => `<text x="${n.x}" y="${n.y}" font-size="${n.gr}" transform="rotate(${n.dreh} ${n.x} ${n.y})" font-family="${n.mass ? 'Atkinson Hyperlegible Mono, monospace' : 'Hebel Notiz, cursive'}">${n.text}</text>`).join('');
    return `<svg viewBox="-40 -120 1620 1140" role="presentation"><g fill="none" stroke="#2340FF" stroke-linecap="round" stroke-linejoin="round">${linien}</g><g fill="#2340FF">${texte}</g></svg>`;
  };
  ziele.forEach(z => {
    z.innerHTML = z.dataset.statischSkizze === 'leer' ? bauen(d.SKIZZE_LEER, d.NOTIZEN_LEER) : bauen(d.SKIZZE_FUMO, d.NOTIZEN_FUMO);
  });
}

/* ---------- Rückfall ---------- */
function hinweisZeigen(grund) {
  const h = $('[data-hinweis]');
  if (!h || !HINWEISE[grund]) return;
  h.textContent = HINWEISE[grund];
  h.hidden = false;
}
function zuStatisch(grund) {
  if (zustand.film) { try { zustand.film.dispose(); } catch (e) { /* schon weg */ } }
  zustand.film = null;
  if (zustand.lenis) { zustand.lenis.destroy(); zustand.lenis = null; }
  zustand.modus = 'statisch';
  html.classList.remove('modus-3d');
  html.classList.add('modus-statisch');
  html.dataset.grund = grund;
  filmEl.style.removeProperty('--film-hoehe');
  $$('[style]', filmEl).forEach(el => {
    if (el.classList.contains('glut-punkt')) return;
    el.removeAttribute('style');
  });
  kapitel.forEach(K => K.el.classList.remove('ist-sichtbar', 'ist-aktiv'));
  hinweisZeigen(grund);
  statischeSkizzen();
  vermessen();
  kopfSetzen();
}

/* ---------- 3D ---------- */
async function start3d() {
  wortVorbereiten();
  kapitelVorbereiten();
  linealBauen();
  risseBauen();
  vermessen();
  const anker = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : '';
  if (ZIEL[anker] !== undefined && ZIEL[anker] > 0) window.scrollTo(0, scrollFuerP(ZIEL[anker]));
  addEventListener('scroll', beimScroll, { passive: true });
  zeigerReaktion();

  // Schrift abwarten, dann steigt der Titel auf
  await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), warte(2000)]);
  vermessen();
  if (!ruhig) wort.introStart = performance.now();
  domSetzen(pAusFortschritt(fortschritt()));
  reaktionWecken();

  if (window.hebelLenis) {
    await Promise.race([window.hebelLenis, warte(3000)]);
    if (window.Lenis && zustand.modus === '3d') zustand.lenis = new window.Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true, syncTouch: false });
  }

  let modul;
  try { modul = await import(KONFIG.film); } catch (e) { zuStatisch('fehler'); return; }
  const canvas = $('#film-canvas');
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); zuStatisch('fehler'); }, { once: true });
  try {
    zustand.film = await modul.erstelleFilm(canvas, {
      schmal: zustand.schmal,
      maxDpr: KONFIG.maxDpr,
      ruhig,
      ebene: $('[data-beschriftung]'),
      beiBild: p => domSetzen(p),
    });
  } catch (e) {
    zuStatisch('fehler');
    return;
  }
  if (zustand.modus !== '3d') { if (zustand.film) zustand.film.dispose(); return; }
  html.classList.add('film-laeuft');

  const start = PARAM.get('kapitel');
  if (start !== null && !Number.isNaN(Number(start))) {
    // Prüfhilfe: ?kapitel=2.8 springt an diese Filmzeit
    const p = klemme(Number(start), 0, 6);
    window.scrollTo(0, scrollFuerP(p));
    zustand.film.springe(p);
  } else {
    zustand.film.springe(pAusFortschritt(fortschritt()));
  }

  let altSchmal = zustand.schmal;
  new ResizeObserver(() => {
    if (!zustand.film) return;
    vermessen();
    if (zustand.schmal !== altSchmal) { altSchmal = zustand.schmal; zustand.film.setSchmal(zustand.schmal); }
    zustand.film.resize();
    beimScroll();
  }).observe(buehne);
  window.__film = zustand.film;
  beimScroll();
}

/* ---------- Formular ---------- */
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
      // Weiterleitung an die Auswertung, ohne Rückmeldung an die Seite
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
    vermessen();
  });
}

/* ---------- Start ---------- */
menue();
links();
blende();
zeiger();
projektindex();
formular();
vermessen();
kopfSetzen();
addEventListener('resize', () => { vermessen(); kopfSetzen(); }, { passive: true });
// GSAP lädt mit defer und steht vor DOMContentLoaded bereit; das Modul läuft danach
if (window.gsap) nachDemFilm(); else addEventListener('DOMContentLoaded', nachDemFilm, { once: true });
if (zustand.modus === '3d') {
  start3d();
} else {
  addEventListener('scroll', kopfSetzen, { passive: true });
  hinweisZeigen(html.dataset.grund);
  statischeSkizzen();
}
