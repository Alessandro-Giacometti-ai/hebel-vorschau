/* Quader Bau, v3c Bauplan: Projekte als Bohrkerne. Unter dem Karussell eine Projekttabelle in
   IBM Plex Mono, die aktive Zeile schwarz; Klick auf eine Zeile dreht das Karussell dorthin.
   Sieben Betonzylinder auf einer Bahn (Vorlage Halbton-Discs 3 bis 13): Stirnseite im Halbton-Raster
   (Schwarz auf #EDEAE4, Zelle 0.02, gegen Moiré geglättet), Mantel aus Beton mit schwarzer Randschrift, Hover mit Neigung
   und Magnet, Greifen und Werfen, feiner Markierspray-Kreis (4 px, das einzige Orange im Abschnitt)
   als Band-Mesh in eigener Ortho-Szene, geschichtetes Rendern ohne Durchdringung, Übergang zur
   Detailseite mit Bruchkante und Scroll-Übergang zum nächsten Projekt. */
import * as THREE from 'three';

const html = document.documentElement;
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => Array.from(w.querySelectorAll(s));
/* Ruhig nur, wenn der Besucher es selbst gewählt hat (Klasse ruhig aus localStorage hebel-ruhig, gesetzt im Kopf).
   Die Systemeinstellung "reduzierte Bewegung" schaltet nichts ab. Der Knopf "Bewegung" schaltet live um. */
let REDUZIERT = html.classList.contains('ruhig');
document.addEventListener('hebel-ruhig', e => { REDUZIERT = !!e.detail; });
const FEIN = matchMedia('(hover: hover) and (pointer: fine)').matches;
const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function rnd(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }

/* Daten wörtlich aus dem Master-Prompt. Bilder nach Sichtung umgeordnet:
   Tiefgarage zur Betonpumpe, Werkhalle zu Schalung und Armierung, Bauernhaus zum Plan, Schulhaus zum Rohbau am Abend. */
const PROJEKTE = [
  { jahr: 2026, titel: 'Mehrfamilienhaus, 14 Wohnungen', region: 'Zürcher Unterland', leistung: 'Hochbau', bild: 'ring-1', gross: 'fertiger-bau',
    text: 'Vier Geschosse in Ortbeton, Sichtbeton im Treppenhaus. Die Schalung wanderte in neun Wochen vom Keller bis zum Dach.' },
  { jahr: 2025, titel: 'Werkhalle mit Bürotrakt', region: 'Limmattal', leistung: 'Hochbau', bild: 'ring-4', gross: 'schalung-armierung',
    text: 'Eine Halle ohne Stützen im Inneren, daneben drei Geschosse Büro. Gegossen in zwei Etappen, damit der Betrieb nebenan weiterlief.' },
  { jahr: 2025, titel: 'Bauernhaus zu drei Wohnungen', region: 'Zürcher Oberland', leistung: 'Umbau', bild: 'ring-3', gross: 'haende-plan',
    text: 'Alte Mauern, neue Decken. Das Fundament wurde abschnittweise unterfangen, die Fassade blieb stehen.' },
  { jahr: 2024, titel: 'Tiefgarage, 48 Plätze', region: 'Glattal', leistung: 'Betonarbeiten', bild: 'ring-2', gross: 'betonpumpe',
    text: 'Weisse Wanne gegen das Grundwasser, Rampe mit Heizung. Die Pumpe stand drei Wochen auf dem Platz.' },
  { jahr: 2024, titel: 'Erweiterung Schulhaus', region: 'Knonauer Amt', leistung: 'Hochbau', bild: 'ring-5',
    text: 'Gebaut in den Sommerferien und an Nachmittagen. Lärm nur, wenn keine Schule war.' },
  { jahr: 2023, titel: 'Stützmauer am Hang, 120 m', region: 'Pfannenstiel', leistung: 'Betonarbeiten', bild: 'ring-6',
    text: 'Sichtbeton in Brettschalung, jede Etappe zwölf Meter. Die Fugen liegen dort, wo der Plan sie wollte.' },
  { jahr: 2023, titel: 'Aufstockung Wohnhaus', region: 'Zimmerberg', leistung: 'Umbau', bild: 'ring-7',
    text: 'Zwei Geschosse mehr auf einem Haus von 1964. Die Bewohner blieben während der ganzen Bauzeit im Haus.' },
];
const N = PROJEKTE.length;
const BILD = p => `/hebel-vorschau/v3/beispiele/quader-bau/bilder/${p.bild}.webp`;
const GROSS = p => `/hebel-vorschau/v3/beispiele/quader-bau/bilder/${p.gross || p.bild}.webp`;
const META = p => `${p.jahr} · ${p.region} · ${p.leistung}`;

const buehne = $('[data-kerne-buehne]');
const canvas = $('[data-kerne-canvas]');
const indexNr = $('[data-index-nr]');
const tabelle = $('[data-kern-tabelle]'), ansage = $('[data-kern-ansage]');
const zwei = n => String(n).padStart(2, '0');
const zeiger = $('[data-zeiger]'), zeigerWort = $('[data-zeiger-wort]');
const detail = $('[data-detail]'), detailZu = $('[data-detail-zu]');
const main = $('#inhalt');
const kopf = $('[data-oben]');
const takt = () => (window.__quader && window.__quader.takt) || null;
const lenis = () => (window.__quader && window.__quader.lenis) || null;
const params = new URLSearchParams(location.search);

/* ================= Detailseite (auch ohne WebGL) ================= */
const D = {
  titel: $('[data-d-titel]'), nr: $('[data-d-nr]'), region: $('[data-d-region]'), leistung: $('[data-d-leistung]'), jahr: $('[data-d-jahr]'),
  text: $('[data-d-text]'), bild: $('[data-d-bild]'),
  next: $('[data-d-next]'), nTitel: $('[data-n-titel]'), nHuelle: $('[data-n-huelle]'), nKern: $('[data-n-kern]'), nSpray: $('[data-n-spray]'),
};
let detailIndex = 0, detailOffen = false, wechselLaeuft = false;
let profil = [];
function bruchProfil(i) {
  /* Gebrochener Beton statt Sägezahn: Punkte in ungleichen Abständen, die Höhe wandert in langen
     Wellen und springt nur selten (Abplatzer). Zwei grössere Ausbrüche mit unregelmässigem Grund.
     Ergebnis: Liste [x, y] in Prozent, y relativ zur wandernden Grundlinie. */
  const r = rnd(4111 + i * 733);
  const welle = [];
  for (let k = 0; k <= 6; k++) welle.push((r() - 0.5) * 5);
  const grob = x => { const u = x / 100 * 6, k = Math.min(5, Math.floor(u)), f = u - k, s = f * f * (3 - 2 * f); return lerp(welle[k], welle[k + 1], s); };
  const p = [];
  let x = 0, fein = 0;
  while (x < 100) {
    /* schräge Facetten statt flacher Stufen: die Höhe läuft weiter, wird nur leicht zurückgeholt */
    fein = fein * 0.82 + (r() - 0.5) * 2.8;
    p.push([x, grob(x) + fein]);
    if (r() < 0.16) { /* Abplatzer: ein kurzer, harter Sprung */
      fein += (r() < 0.5 ? -1 : 1) * (1 + r() * 1.8);
      p.push([Math.min(100, x + 0.2 + r() * 0.4), grob(x) + fein]);
    }
    x += 0.7 + Math.pow(r(), 1.4) * 4.6;
  }
  p.push([100, grob(100) + fein]);
  for (let b = 0; b < 2; b++) {
    const a = 8 + r() * 76, breite = 5 + r() * 9, tief = 3 + r() * 4;
    p.forEach(q => {
      const t = (q[0] - a) / breite;
      if (t > 0 && t < 1) q[1] += tief * Math.min(1, Math.min(t, 1 - t) * (3 + r() * 2)) * (0.75 + r() * 0.25);
    });
  }
  return p;
}
/* Lange Titel ("MEHRFAMILIENHAUS,") passen sonst nicht in die Breite: verkleinern, bis es passt */
function einpassen(el, min = 30) {
  el.style.fontSize = ''; el.style.maxWidth = '';
  if (el.scrollWidth > el.clientWidth + 1) el.style.maxWidth = 'none';
  let fs = parseFloat(getComputedStyle(el).fontSize) || 60, n = 0;
  while (el.scrollWidth > el.clientWidth + 1 && fs > min && n++ < 40) { fs *= 0.94; el.style.fontSize = fs.toFixed(1) + 'px'; }
}
function detailFuellen(i) {
  const p = PROJEKTE[i];
  detailIndex = i;
  D.titel.textContent = p.titel;
  D.nr.textContent = `${zwei(i + 1)} / ${zwei(N)}`;
  D.region.textContent = p.region;
  D.leistung.textContent = p.leistung;
  D.jahr.textContent = String(p.jahr);
  D.text.textContent = p.text;
  D.bild.style.backgroundImage = `url("${GROSS(p)}")`;
  D.bild.setAttribute('aria-label', 'Projektbild: ' + p.titel + ' (Bild mit KI erzeugt, erfundenes Projekt)');
  profil = bruchProfil(i);
  letzteReveal = -1;
  const n = PROJEKTE[(i + 1) % N];
  D.nTitel.textContent = n.titel;
  D.titel.classList.toggle('mit-umlaut', /[ÄÖÜäöü]/.test(p.titel));
  D.nTitel.classList.toggle('mit-umlaut', /[ÄÖÜäöü]/.test(n.titel));
  einpassen(D.titel); einpassen(D.nTitel, 26);
  D.nKern.style.backgroundImage = `url("${BILD(n)}")`;
  naechstSeed = Math.random() * 10;
}
function einblenden() {
  detail.classList.remove('spielt');
  void detail.offsetWidth;
  detail.classList.add('spielt');
}
let vorherFokus = null;
function detailZeigen(i) {
  detailFuellen(i);
  detail.scrollTop = 0;
  detail.inert = false;
  detail.setAttribute('aria-hidden', 'false');
  detail.classList.add('ist-offen');
  main.inert = true;
  kopf.inert = true;
  const l = lenis(); if (l) l.stop();
  einblenden();
  detailOffen = true;
  detailZu.focus({ preventScroll: true });
}
function detailVerbergen() {
  detail.classList.remove('ist-offen', 'spielt');
  detail.setAttribute('aria-hidden', 'true');
  detail.inert = true;
  main.inert = false;
  kopf.inert = false;
  const l = lenis(); if (l) l.start();
  detailOffen = false;
}

/* Bruchkante und Übergang zum nächsten Projekt */
let letzteReveal = -1, naechstWinkel = 0, naechstSeed = 3;
const spray2d = D.nSpray.getContext('2d');
function detailTakt(dt, zeit) {
  if (!detailOffen) return;
  const vh = detail.clientHeight;
  const rb = D.bild.getBoundingClientRect();
  let rev = klemmen((vh - rb.top) / (vh * 0.85));
  rev = 1 - Math.pow(1 - rev, 3);
  if (Math.abs(rev - letzteReveal) > 0.0005) {
    letzteReveal = rev;
    const basis = lerp(40, 6, rev);
    let pts = '';
    for (const [px, py] of profil) pts += `${px.toFixed(2)}% ${klemmen(basis + py, 0.5, 99).toFixed(2)}%,`;
    D.bild.style.clipPath = `polygon(${pts}100% 100%,0% 100%)`;
  }
  /* aufrechter Bohrkern des nächsten Projekts */
  const top = D.next.offsetTop, hoehe = D.next.offsetHeight;
  const prog = klemmen((detail.scrollTop - top) / Math.max(1, hoehe - vh));
  const ep = prog * prog * (3 - 2 * prog);
  const dh = D.nHuelle.offsetHeight;
  if (!REDUZIERT) naechstWinkel += dt * (60 + prog * prog * 2400);
  const ty = vh - dh * 0.36 * (0.15 + 0.85 * ep);
  const neig = 14 - ep * 6;
  D.nHuelle.style.transform = `translate(-50%, ${ty.toFixed(1)}px)`;
  D.nKern.style.transform = `rotateX(${neig.toFixed(2)}deg) rotateZ(${naechstWinkel.toFixed(1)}deg)`;
  D.nTitel.style.transform = `translateY(${((1 - ep) * 12).toFixed(1)}px)`;
  /* Markierspray-Kreis um den drehenden Kern */
  const cw = D.nSpray.clientWidth, ch = D.nSpray.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  if (D.nSpray.width !== Math.round(cw * dpr)) { D.nSpray.width = Math.round(cw * dpr); D.nSpray.height = Math.round(ch * dpr); }
  spray2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  spray2d.clearRect(0, 0, cw, ch);
  const p = klemmen((prog - 0.62) / 0.3);
  if (p <= 0) naechstSeed = (naechstSeed + 0.37) % 10;
  else {
    const cx = cw / 2, cy = ty + dh / 2;
    const rx = dh / 2, ry = dh / 2 * Math.cos(neig * Math.PI / 180);
    sprayKreis2d(spray2d, cx, cy, rx, ry, p, naechstSeed, REDUZIERT ? 0 : Math.floor(zeit * 8), zeit);
  }
  if (prog > 0.995 && !wechselLaeuft) naechstesProjekt();
}
function sprayKreis2d(c, cx, cy, rx, ry, p, sd, boil) {
  const n = 300, total = Math.PI * 2 * 2.15, a0 = -0.5 + (sd % 1) * 0.6;
  const bis = Math.floor(n * easeInOut(p));
  if (bis < 2) return;
  const pts = [];
  for (let j = 0; j <= bis; j++) {
    const s = j / n * total, an = a0 - s;
    const k = 1.06 + 0.025 * Math.sin(1.6 * s + sd) + 0.014 * Math.sin(4.2 * s + 2.3 * sd) + (s / total) * 0.04 + 0.003 * Math.sin(1.9 * j + boil * 12.99);
    pts.push([cx + Math.cos(an) * rx * k, cy + Math.sin(an) * ry * k]);
  }
  const zug = () => {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    c.stroke();
  };
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#FF5A0A'; c.lineWidth = 4; zug();
}
function naechstesProjekt() {
  wechselLaeuft = true;
  detail.classList.add('ist-weg');
  setTimeout(() => {
    const n = (detailIndex + 1) % N;
    if (karussell) karussell.aufProjekt(n);
    detailFuellen(n);
    detail.scrollTop = 0;
    detail.classList.remove('ist-weg');
    einblenden();
    wechselLaeuft = false;
  }, REDUZIERT ? 60 : 200);
}

/* ================= Projekttabelle (mit und ohne WebGL) ================= */
let zeileKlick = () => {};
const zeilen = [];
function tabelleBauen() {
  tabelle.textContent = '';
  PROJEKTE.forEach((p, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab__zeile';
    b.innerHTML = '<span class="k-nr"></span><span class="k-jahr"></span><span class="k-projekt"></span><span class="k-region"></span><span class="k-leistung"></span>'
      + '<span class="k-los" aria-hidden="true">Öffnen <svg width="22" height="14" viewBox="0 0 22 14"><path d="M14.8 0.4 21.4 7l-6.6 6.6-1.1-1.1 4.8-4.7H0.6V6.2h17.9l-4.8-4.7z"/></svg></span>';
    $('.k-nr', b).textContent = zwei(i + 1);
    $('.k-jahr', b).textContent = String(p.jahr);
    $('.k-projekt', b).textContent = p.titel;
    $('.k-region', b).textContent = p.region;
    $('.k-leistung', b).textContent = p.leistung;
    b.addEventListener('click', () => zeileKlick(i));
    li.appendChild(b); tabelle.appendChild(li); zeilen.push(b);
  });
}
function tabelleAktiv(a) {
  zeilen.forEach((b, j) => {
    b.classList.toggle('ist-aktiv', j === a);
    if (j === a) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
  indexNr.textContent = `${zwei(a + 1)} / ${zwei(N)}`;
  ansage.textContent = `Projekt ${a + 1} von ${N}: ${PROJEKTE[a].titel}, ${META(PROJEKTE[a])}`;
}
tabelleBauen();

/* Nur für die Sichtprüfung (kurz.py klickt nicht): ?klick=3 klickt Zeile 03 an, sobald die Tabelle
   sichtbar ist (echtes click-Ereignis auf den Knopf), mit &oeffnen=1 danach noch einmal, was öffnet.
   ?breite=1 zeigt oben links Scrollbreite und Fensterbreite. */
const pruefKlick = parseInt(params.get('klick') || '0', 10);
if (pruefKlick >= 1 && pruefKlick <= zeilen.length) {
  const io = new IntersectionObserver(e => {
    if (!e.some(x => x.isIntersecting)) return;
    io.disconnect();
    setTimeout(() => {
      zeilen[pruefKlick - 1].click();
      if (params.get('oeffnen') === '1') setTimeout(() => zeilen[pruefKlick - 1].click(), 1400);
    }, 300);
  }, { threshold: 0.6 });
  io.observe(tabelle);
}
if (params.get('breite') === '1') {
  const m = document.createElement('p');
  m.className = 'label';
  m.style.cssText = 'position:fixed;left:0;top:0;z-index:300;margin:0;padding:4px 8px;background:#111;color:#fff';
  document.body.appendChild(m);
  const messen = () => { m.textContent = `Scrollbreite ${document.documentElement.scrollWidth} / Fenster ${innerWidth}`; };
  addEventListener('scroll', messen, { passive: true }); setTimeout(messen, 2000);
}

/* ================= Fallback ohne WebGL ================= */
function ohneWebgl() {
  const liste = $('[data-kern-liste]');
  liste.innerHTML = '';
  PROJEKTE.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<img src="${BILD(p)}" alt="" width="600" height="400" loading="lazy" decoding="async">`;
    liste.appendChild(li);
  });
  tabelleAktiv(0);
  zeileKlick = i => { vorherFokus = document.activeElement; tabelleAktiv(i); detailZeigen(i); };
  detailZu.addEventListener('click', () => { detailVerbergen(); if (vorherFokus) vorherFokus.focus(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && detailOffen) { detailVerbergen(); if (vorherFokus) vorherFokus.focus(); } });
  let letzt = performance.now();
  const loop = () => { const j = performance.now(); detailTakt(Math.min(0.05, (j - letzt) / 1000), j / 1000); letzt = j; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

/* ================= Karussell ================= */
let karussell = null;

function halbtonMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex }, uMix: { value: 0 }, uCrop: { value: new THREE.Vector2(400 / 600, 1) },
      uPapier: { value: new THREE.Color('#EDEAE4') }, uTinte: { value: new THREE.Color('#111111') }, uLicht: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      /* Zelle 0.02 statt 0.026: auf dem grossen Kern waren die Punkte zu grob (Prüfung v3b) */
      #define ZELLE 0.02
      uniform sampler2D uMap; uniform float uMix; uniform vec2 uCrop; uniform vec3 uPapier; uniform vec3 uTinte; uniform float uLicht;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 bild(vec2 uv) { return texture2D(uMap, vec2(0.5) + (uv - 0.5) * uCrop).rgb; }
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float a = radians(15.0);
        float ca = cos(a), sa = sin(a);
        vec2 g = vec2(ca * c.x - sa * c.y, sa * c.x + ca * c.y) / ZELLE;
        vec2 zelle = floor(g) + 0.5;
        vec2 f = g - zelle;
        vec2 zm = zelle * ZELLE;
        vec2 zuv = vec2(ca * zm.x + sa * zm.y, -sa * zm.x + ca * zm.y) + 0.5;
        vec3 fz = bild(zuv);
        float lum = dot(fz, vec3(0.2126, 0.7152, 0.0722));
        float dunkel = 1.0 - pow(clamp(lum, 0.0, 1.0), 1.0 / 2.2);
        float rad = mix(sqrt(dunkel) * 0.6, 0.76, uMix);
        float d = length(f);
        float aa = fwidth(d) * 0.9 + 0.002;
        float punkt = 1.0 - smoothstep(rad - aa, rad + aa, d);
        vec3 foto = bild(vUv);
        /* Gegen Moiré: Ist eine Zelle auf dem Bildschirm kleiner als etwa vier Pixel (kleine, flach
           geneigte Kerne), wird das Raster zu seinem Mittelwert, dem Grauton gleicher Deckung. */
        vec2 fw = fwidth(g);
        float klein = smoothstep(0.2, 0.42, max(fw.x, fw.y));
        float lumP = dot(foto, vec3(0.2126, 0.7152, 0.0722));
        float radP = mix(sqrt(1.0 - pow(clamp(lumP, 0.0, 1.0), 1.0 / 2.2)) * 0.6, 0.76, uMix);
        punkt = mix(punkt, min(1.0, 3.14159 * radP * radP), klein);
        vec3 farbe = mix(uTinte, foto, uMix);
        vec3 col = mix(uPapier, farbe, punkt);
        col = mix(col, foto, smoothstep(0.8, 1.0, uMix));
        col += (hash(floor(vUv * 700.0)) - 0.5) * 0.04;
        float ring = smoothstep(0.952, 0.962, r);
        col = mix(col, uPapier * 1.06, ring * 0.8);
        col *= uLicht;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

function mantelTextur(p, nr) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#C9C5BD'; x.fillRect(0, 0, 1024, 256);
  const r = rnd(1000 + nr * 97);
  const a = [0x8C, 0x87, 0x7D], b = [0xE3, 0xDE, 0xD5];
  for (let i = 0; i < 900; i++) {
    const t = r(), rx = 1 + r() * 3.5, ry = rx * (0.55 + r() * 0.45);
    x.fillStyle = `rgba(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))},.9)`;
    x.beginPath(); x.ellipse(r() * 1024, r() * 256, rx, ry, r() * Math.PI, 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = 'rgba(0,0,0,.06)';
  for (let y = 0; y < 256; y += 6) x.fillRect(0, y, 1024, 1);
  /* Randschrift nahe der Stirnseite: schwarz, IBM Plex Mono 500, ohne Sprühnebel */
  const text = `PROJEKT ${zwei(nr)} · ${p.jahr} · ${p.region.toUpperCase()} · ${p.leistung.toUpperCase()}`;
  x.font = '500 26px "IBM Plex Mono"';
  try { x.letterSpacing = '2px'; } catch (e) { /* älterer Browser */ }
  x.textBaseline = 'middle';
  x.fillStyle = 'rgba(11,11,12,.88)'; x.fillText(text, 28, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function bruchGeometrie(R, seed) {
  const g = new THREE.CircleGeometry(R, 72);
  const pos = g.attributes.position, r = rnd(seed);
  for (let i = 1; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), d = Math.hypot(x, y);
    const k = d > R * 0.99 ? 1 - r() * 0.05 : 1;
    pos.setXYZ(i, x * k, y * k, (r() - 0.5) * 0.08);
  }
  g.computeVertexNormals();
  return g;
}

async function starteKarussell() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { html.classList.remove('mit-webgl'); html.classList.add('no-webgl'); ohneWebgl(); return; }
  const mobil = innerWidth <= 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobil ? 1.5 : 1.75));
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

  /* Umgebung für Spiegelungen wie Vorlage 4 */
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x6b6d70, side: THREE.BackSide })));
  [[12, 3, [0, 9, 8], 4], [3, 10, [-10, 1, 5], 2.5], [6, 6, [9, -3, 9], 1.6], [10, 2, [0, -9, 4], 1.2]].forEach(([w, h, p, s]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(s, s, s) }));
    m.position.set(...p); m.lookAt(0, 0, 0); env.add(m);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.035).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 0.72 * Math.PI));
  const dl = new THREE.DirectionalLight(0xffffff, 0.5 * Math.PI); dl.position.set(-4, 6, 10); scene.add(dl);

  await Promise.race([Promise.all([document.fonts.load('500 26px "IBM Plex Mono"')]), new Promise(r => setTimeout(r, 2500))]);

  /* Schattentextur */
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  { const x = sc.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(0.55, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  const schattenTex = new THREE.CanvasTexture(sc);
  const schattenGruppe = new THREE.Group(); scene.add(schattenGruppe);

  const R = 1.6, L = 2.6;
  const lader = new THREE.TextureLoader();
  const platzhalter = new THREE.DataTexture(new Uint8Array([180, 176, 168, 255]), 1, 1); platzhalter.needsUpdate = true;
  const rueckMat = new THREE.MeshStandardMaterial({ color: '#9D978D', roughness: 1, envMapIntensity: 0.2 });
  const kerne = PROJEKTE.map((p, i) => {
    const pivot = new THREE.Group(), spinner = new THREE.Group();
    pivot.add(spinner); scene.add(pivot);
    const mat = halbtonMaterial(platzhalter);
    lader.load(BILD(p), t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); mat.uniforms.uMap.value = t; });
    const stirn = new THREE.Mesh(new THREE.CircleGeometry(R, 128), mat); stirn.position.z = L / 2;
    const mantel = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 128, 1, true), new THREE.MeshStandardMaterial({ map: mantelTextur(p, i + 1), roughness: 0.92, envMapIntensity: 0.35 }));
    mantel.rotation.x = Math.PI / 2;
    const rueck = new THREE.Mesh(bruchGeometrie(R, 77 + i * 13), rueckMat); rueck.position.z = -L / 2; rueck.rotation.y = Math.PI;
    spinner.add(stirn, mantel, rueck);
    const schatten = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, opacity: 0.35, depthWrite: false }));
    schattenGruppe.add(schatten);
    const k = { i, p, pivot, spinner, stirn, mat, schatten, winkel: ((i * 1.3) % (Math.PI * 2)) - 0.6, spinVel: 0,
      tilt: { x: 0, y: 0 }, tiltZ: { x: 0, y: 0 }, off: new THREE.Vector3(), offZiel: new THREE.Vector3(), vel: new THREE.Vector3(), hover: 0, mix: 0, o: 0, rang: 0, sichtbar: true };
    [stirn, mantel, rueck].forEach(m => { m.userData.k = k; });
    return k;
  });
  const treffer = kerne.flatMap(k => k.spinner.children);

  /* Markierspray in eigener Ortho-Szene */
  const ortho = new THREE.OrthographicCamera(0, 1, 0, -1, -1, 1);
  const spray = new THREE.Scene();
  const NP = 261;
  function band(farbe, deckkraft) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(NP * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let j = 0; j < NP - 1; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: farbe, side: THREE.DoubleSide, depthTest: false, transparent: deckkraft < 1, opacity: deckkraft }));
    m.frustumCulled = false; spray.add(m);
    return m;
  }
  const linie = band(0xFF5A0A, 1);
  const kreis = { kern: null, p: 0, sd: 3, a0: 0 };
  const vtmp = new THREE.Vector3();
  const sPts = new Float32Array(NP * 2);

  /* Zustand */
  let W = 1, H = 1, portrait = false;
  const layout = { spx: 4.6, spy: 1.0, curve: 0.42 };
  let current = 0, target = 0, aktiv = -1;
  const seq = { p: 0, dir: 0, kern: null, wartet: 0 };
  let gezogen = null, wisch = null, hoverKern = null;
  const maus = new THREE.Vector2(-9, -9), ray = new THREE.Raycaster();
  let zeigerX = 0, zeigerY = 0, zeigerDrin = false;
  const wrap = o => ((o % N) + N * 1.5) % N - N / 2;
  const sicht = { an: false };
  new IntersectionObserver(e => { sicht.an = e[e.length - 1].isIntersecting; }, { rootMargin: '60px' }).observe(buehne);
  let tabSichtbar = !document.hidden;
  document.addEventListener('visibilitychange', () => { tabSichtbar = !document.hidden; });

  function groesse() {
    W = buehne.clientWidth; H = buehne.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / Math.max(1, H);
    portrait = camera.aspect < 0.85;
    const needW = portrait ? 5.4 : 11;
    const z = Math.max(15, needW / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    camera.position.set(0, 0, z);
    /* Vorlage: Blick auf (0, -0.2 | -0.35, 0); hier höher, damit die grossen Kerne rechts unter der Kopfzeile des Abschnitts bleiben */
    camera.lookAt(0, portrait ? 0.2 : 0.85, 0);
    camera.updateProjectionMatrix();
    layout.spx = portrait ? 2.2 : 4.6; layout.spy = portrait ? 3.4 : 1.0; layout.curve = 0.42;
    ortho.left = 0; ortho.right = W; ortho.top = 0; ortho.bottom = -H; ortho.updateProjectionMatrix();
  }
  addEventListener('resize', groesse);
  groesse();

  /* Blättern: "01 / 07" und zwei Pfeile, dazu die Tabelle. Zeile anklicken dreht dorthin,
     die aktive Zeile noch einmal anklicken öffnet das Projekt. */
  $('[data-vorher]').addEventListener('click', () => { if (!gesperrt()) target = Math.round(target) - 1; });
  $('[data-nachher]').addEventListener('click', () => { if (!gesperrt()) target = Math.round(target) + 1; });
  zeileKlick = i => {
    if (gesperrt()) return;
    const a = ((Math.round(target) % N) + N) % N;
    if (i === a) { target = Math.round(target); oeffnen(kerne[i]); }
    else target = Math.round(target) + Math.round(wrap(i - a));
  };
  function aktivSetzen(a) {
    if (a === aktiv) return;
    aktiv = a;
    tabelleAktiv(a);
  }
  const gesperrt = () => seq.p > 0 || seq.dir !== 0 || detailOffen;

  /* Zeiger */
  function mausSetzen(e) {
    const r = canvas.getBoundingClientRect();
    maus.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    zeigerX = e.clientX; zeigerY = e.clientY;
  }
  function trefferBei() {
    ray.setFromCamera(maus, camera);
    const hits = ray.intersectObjects(treffer.filter(m => m.userData.k.sichtbar), false);
    let best = null;
    for (const h of hits) { const k = h.object.userData.k; if (!best || k.rang > best.rang) best = k; }
    return best;
  }
  canvas.addEventListener('pointerenter', e => { zeigerDrin = true; mausSetzen(e); });
  canvas.addEventListener('pointerleave', () => { zeigerDrin = false; if (!gezogen) { hoverKern = null; maus.set(-9, -9); } });
  canvas.addEventListener('pointermove', e => {
    mausSetzen(e);
    if (gezogen) {
      const dx = e.clientX - gezogen.lx; gezogen.lx = e.clientX;
      gezogen.k.spinVel = klemmen(gezogen.k.spinVel - dx * 0.04, -14, 14);
      if (Math.hypot(e.clientX - gezogen.sx, e.clientY - gezogen.sy) > 6) gezogen.bewegt = true;
      /* Zeiger auf Ebene durch den Kern projizieren */
      ray.setFromCamera(maus, camera);
      const ebene = new THREE.Plane(new THREE.Vector3(0, 0, 1), -gezogen.ebeneZ);
      const pt = new THREE.Vector3();
      if (ray.ray.intersectPlane(ebene, pt)) {
        gezogen.k.offZiel.set(pt.x - gezogen.griff.x, pt.y - gezogen.griff.y, 0.8);
        const l = Math.hypot(gezogen.k.offZiel.x, gezogen.k.offZiel.y);
        if (l > 4.2) { gezogen.k.offZiel.x *= 4.2 / l; gezogen.k.offZiel.y *= 4.2 / l; }
      }
    } else if (wisch) {
      const dx = e.clientX - wisch.sx, dy = e.clientY - wisch.sy;
      if (Math.abs(dx) > 6) wisch.bewegt = true;
      target = wisch.start - dx / (W * (portrait ? 0.55 : 0.32)) - (portrait && e.pointerType === 'mouse' ? dy / (H * 0.4) : 0);
    }
  });
  canvas.addEventListener('pointerdown', e => {
    if (gesperrt()) return;
    mausSetzen(e);
    const k = trefferBei();
    if (k) {
      ray.setFromCamera(maus, camera);
      const ebeneZ = k.pivot.position.z;
      const pt = new THREE.Vector3();
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -ebeneZ), pt);
      gezogen = { k, sx: e.clientX, sy: e.clientY, lx: e.clientX, bewegt: false, ebeneZ, griff: { x: pt.x - k.off.x, y: pt.y - k.off.y }, id: e.pointerId };
    } else {
      wisch = { sx: e.clientX, sy: e.clientY, start: target, bewegt: false, id: e.pointerId };
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* egal */ }
  });
  function loslassen(e, abbruch) {
    if (gezogen) {
      const k = gezogen.k;
      k.offZiel.set(0, 0, 0);
      if (!gezogen.bewegt && !abbruch) {
        const o = Math.round(k.o);
        if (o !== 0) target = Math.round(target) + o;
        else oeffnen(k);
      }
      gezogen = null;
    } else if (wisch) {
      if (!wisch.bewegt && !abbruch) { /* Klick ins Leere */ }
      target = Math.round(target);
      wisch = null;
    }
  }
  canvas.addEventListener('pointerup', e => loslassen(e, false));
  canvas.addEventListener('pointercancel', e => loslassen(e, true));
  /* Mausrad: nur die waagrechte Achse blättert, die senkrechte scrollt die Seite weiter */
  let radTimer = 0;
  canvas.addEventListener('wheel', e => {
    if (gesperrt()) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) && !e.shiftKey) return;
    e.preventDefault();
    const d = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    target += klemmen(d, -60, 60) * 0.0045;
    clearTimeout(radTimer);
    radTimer = setTimeout(() => { target = Math.round(target); }, 160);
  }, { passive: false });
  canvas.addEventListener('keydown', e => {
    if (gesperrt()) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); target = Math.round(target) - 1; }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); target = Math.round(target) + 1; }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); target = Math.round(target); oeffnen(kerne[((Math.round(target) % N) + N) % N]); }
  });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (detailOffen) schliessen();
  });
  detailZu.addEventListener('click', () => schliessen());

  /* Übergang zur Detailseite */
  function oeffnen(k) {
    if (gesperrt()) return;
    vorherFokus = document.activeElement;
    seq.kern = k; seq.dir = 1; seq.wartet = 0;
    kreis.kern = null;
    const warten = REDUZIERT ? 40 : 1000;
    setTimeout(() => { if (seq.dir === 1) detailZeigen(k.i); }, warten);
  }
  function schliessen() {
    if (!detailOffen) return;
    detailVerbergen();
    seq.kern = kerne[detailIndex];
    current = target = Math.round(target);
    setTimeout(() => { seq.dir = -1; }, REDUZIERT ? 20 : 420);
    setTimeout(() => { canvas.focus({ preventScroll: true }); }, REDUZIERT ? 40 : 450);
  }
  karussell = {
    aufProjekt(n) {
      const a = ((Math.round(target) % N) + N) % N;
      target = Math.round(target) + Math.round(wrap(n - a));
      current = target;
      seq.kern = kerne[n];
    },
  };

  /* Testzustände nur für die Sichtprüfung (?zustand=hover|detail) */
  const zustand = params.get('zustand');
  if (zustand === 'detail') setTimeout(() => {
    oeffnen(kerne[0]);
    const ds = parseFloat(params.get('dscroll') || '0');
    if (ds) setTimeout(() => { detail.scrollTop = ds * (detail.scrollHeight - detail.clientHeight); }, 1300);
  }, 1500);

  /* Frame */
  const sortiert = [];
  function frame(dt, t) {
    if (!sicht.an || !tabSichtbar || detailOffen && seq.p >= 1) { zeigerAnzeigen(false); return; }
    const seqDauer = REDUZIERT ? 0.05 : 1.05;
    if (seq.dir !== 0) {
      seq.p = klemmen(seq.p + seq.dir * dt / seqDauer);
      if (seq.p <= 0 && seq.dir < 0) { seq.dir = 0; seq.kern = null; }
      if (seq.p >= 1 && seq.dir > 0) seq.dir = 0;
    }
    current = damp(current, target, 6.5, dt);
    aktivSetzen(((Math.round(current) % N) + N) % N);

    /* Hover */
    let neuHover = null;
    if (!gesperrt() && !gezogen && (zeigerDrin || zustand === 'hover')) {
      if (zustand === 'hover' && !zeigerDrin) { const k0 = kerne[aktiv]; vtmp.copy(k0.pivot.position).project(camera); maus.set(vtmp.x + 0.05, vtmp.y + 0.05); }
      neuHover = trefferBei();
    }
    if (gezogen) neuHover = gezogen.k;
    hoverKern = neuHover;

    const side = easeIO(klemmen(seq.p / 0.7));
    const shrink = easeIO(klemmen((seq.p - 0.22) / 0.78));
    sortiert.length = 0;
    for (const k of kerne) {
      const o = wrap(k.i - current);
      k.o = o;
      const op = Math.max(0, o), on = Math.min(0, o);
      let x, y, z, sc, slope;
      if (!portrait) {
        x = layout.spx * (op + op * op * 0.12 + on * 0.62);
        y = op * layout.spy + op * op * layout.curve + on * 0.55;
        z = o * 1.4 - Math.max(0, -o - 1) * 0.6;
        sc = 1.25 * Math.pow(1.12, klemmen(o, -3, 3));
        slope = Math.atan(o > 0 ? layout.spy + 2 * o * layout.curve : 0.55) * 0.18;
      } else {
        x = o * layout.spx + o * o * 0.28; y = o * layout.spy; z = -Math.abs(o) * 1.3;
        sc = 1.05 * Math.pow(1.12, klemmen(o, -3, 3)); slope = 0;
      }
      k.sichtbar = Math.abs(o) < 3.4;
      /* Hover-Zustand, Neigung zum Zeiger, Magnet */
      const istHover = hoverKern === k;
      k.hover = damp(k.hover, istHover ? 1 : 0, 8, dt);
      k.mix = klemmen(k.mix + (istHover ? 1 : -1) * dt / (REDUZIERT ? 0.01 : 0.4));
      k.mat.uniforms.uMix.value = k.mix * k.mix * (3 - 2 * k.mix);
      if (istHover && !gezogen) {
        vtmp.copy(k.pivot.position).project(camera);
        const mx = (vtmp.x + 1) / 2 * W, my = (1 - vtmp.y) / 2 * H;
        vtmp.set(k.pivot.position.x + R * k.pivot.scale.x, k.pivot.position.y, k.pivot.position.z).project(camera);
        const rad = Math.max(40, Math.abs((vtmp.x + 1) / 2 * W - mx));
        const zx = (maus.x + 1) / 2 * W, zy = (1 - maus.y) / 2 * H;
        const nx = klemmen((zx - mx) / rad, -1, 1), ny = klemmen((zy - my) / rad, -1, 1);
        k.tiltZ.x = ny * 0.38; k.tiltZ.y = nx * 0.42;
        k.offZiel.set(nx * 0.22, -ny * 0.22, 0.45);
      } else if (!gezogen || gezogen.k !== k) {
        k.tiltZ.x = 0; k.tiltZ.y = 0;
        k.offZiel.set(0, 0, 0);
      }
      k.tilt.x = damp(k.tilt.x, k.tiltZ.x, 7, dt); k.tilt.y = damp(k.tilt.y, k.tiltZ.y, 7, dt);
      k.vel.x += (k.offZiel.x - k.off.x) * 120 * dt; k.vel.y += (k.offZiel.y - k.off.y) * 120 * dt; k.vel.z += (k.offZiel.z - k.off.z) * 120 * dt;
      k.vel.multiplyScalar(Math.exp(-14 * dt));
      k.off.addScaledVector(k.vel, dt);
      /* Eigendrehung um die Längsachse, sehr langsam (Faktor 0.3) */
      k.winkel += ((REDUZIERT ? 0 : 0.06 * 0.3) + k.spinVel) * dt;
      k.spinVel *= Math.exp(-1.4 * dt);
      const near = Math.max(0, 1 - Math.abs(o));
      let rx = -0.58 + near * 0.2 + k.tilt.x, ry = -0.22 + o * 0.05 + k.tilt.y, rz = 0.03 * o + slope;
      let px = x + k.off.x, py = y + k.off.y, pz = z + k.off.z;
      let skal = sc * (1 + k.hover * 0.035);
      let schattenA = 0.3 - k.hover * 0.08;
      let spinZusatz = 0;
      /* Sequenz zur Detailseite */
      if (seq.kern) {
        if (k === seq.kern) {
          skal *= 1 - shrink; pz += shrink * 1.2;
          rx = lerp(rx, -0.15, shrink); ry = lerp(ry, 0, shrink);
          spinZusatz = -shrink * shrink * 14;
          schattenA *= 1 - shrink;
        } else {
          const dirX = o >= 0 ? 1 : -1;
          px += side * (15 + Math.abs(o) * 3) * dirX;
          py += side * dirX * 1.2;
          ry += -side * dirX * 0.5;
          schattenA *= 1 - side;
        }
      }
      k.pivot.position.set(px, py, pz);
      k.pivot.rotation.set(rx, ry, rz);
      k.pivot.scale.setScalar(Math.max(0.0001, skal));
      k.spinner.rotation.z = k.winkel + spinZusatz;
      k.mat.uniforms.uLicht.value = 0.96 + k.hover * 0.05;
      k.schatten.position.set(px + 0.3, py - 0.85, pz - 1.6);
      k.schatten.scale.setScalar(Math.max(0.0001, skal));
      k.schatten.material.opacity = Math.max(0, schattenA) * (k.sichtbar ? 1 : 0);
      k.schatten.visible = k.sichtbar && skal > 0.001;
      k.rang = pz + (gezogen && gezogen.k === k ? 100 : 0);
      if (k.sichtbar) sortiert.push(k);
    }
    sortiert.sort((a, b) => a.rang - b.rang);
    sortiert.forEach((k, i) => { k.rang = i; });

    /* Markierspray-Kreis */
    const kk = hoverKern;
    if (kk && kreis.kern !== kk) { kreis.kern = kk; kreis.p = 0; kreis.sd = Math.random() * 10; kreis.a0 = -0.5 + Math.random() * 0.6; }
    if (kreis.kern) {
      kreis.p = klemmen(kreis.p + (kk === kreis.kern ? 1.35 : -2.6) * dt);
      if (kreis.p <= 0 && kk !== kreis.kern) kreis.kern = null;
    }
    sprayAktualisieren(t, dt);

    /* Geschichtetes Rendern */
    renderer.clear();
    for (const k of kerne) k.pivot.visible = false;
    schattenGruppe.visible = true;
    renderer.render(scene, camera);
    schattenGruppe.visible = false;
    for (const k of sortiert) {
      k.pivot.visible = true;
      renderer.clearDepth();
      renderer.render(scene, camera);
      if (kreis.kern === k && kreis.p > 0) renderer.render(spray, ortho);
      k.pivot.visible = false;
    }
    for (const k of kerne) k.pivot.visible = true;
    schattenGruppe.visible = true;

    /* eigener Zeiger */
    zeigerAnzeigen(FEIN && zeigerDrin);
    if (FEIN && zeigerDrin) {
      zeiger.style.transform = `translate3d(${zeigerX}px,${zeigerY}px,0)`;
      const wort = gezogen ? 'Werfen' : hoverKern ? 'Greifen' : '';
      zeiger.classList.toggle('mit-wort', !!wort);
      if (wort && zeigerWort.textContent !== wort) zeigerWort.textContent = wort;
    }
  }
  function zeigerAnzeigen(an) { zeiger.classList.toggle('ist-an', !!an); }

  function sprayAktualisieren(t, dt) {
    const k = kreis.kern;
    linie.visible = false;
    if (!k || kreis.p <= 0) return;
    const n = 260, total = Math.PI * 2 * 2.15;
    const bis = Math.max(2, Math.floor(n * easeInOut(kreis.p)));
    const boil = REDUZIERT ? 0 : Math.floor(t * 8);
    k.pivot.updateMatrixWorld(true);
    for (let j = 0; j <= bis; j++) {
      const s = j / n * total, an = kreis.a0 - s;
      const kk = 1.07 + 0.03 * Math.sin(1.6 * s + kreis.sd) + 0.016 * Math.sin(4.2 * s + 2.3 * kreis.sd) + (s / total) * 0.045 + 0.004 * Math.sin(1.9 * j + boil * 12.99);
      vtmp.set(Math.cos(an) * R * kk * (1 + 0.018 * Math.sin(0.7 * s + kreis.sd)), Math.sin(an) * R * kk, L / 2);
      vtmp.applyMatrix4(k.pivot.matrixWorld).project(camera);
      sPts[j * 2] = (vtmp.x + 1) / 2 * W;
      sPts[j * 2 + 1] = -(1 - vtmp.y) / 2 * H;
    }
    const setze = (mesh, breite) => {
      const pos = mesh.geometry.attributes.position.array;
      for (let j = 0; j <= bis; j++) {
        const a = Math.max(0, j - 1), b = Math.min(bis, j + 1);
        let tx = sPts[b * 2] - sPts[a * 2], ty = sPts[b * 2 + 1] - sPts[a * 2 + 1];
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        let w = breite / 2;
        const ende = Math.min(j, bis - j);
        if (ende < 6) w *= 0.5 + 0.5 * (ende / 6);
        pos[j * 6] = sPts[j * 2] - ty * w; pos[j * 6 + 1] = sPts[j * 2 + 1] + tx * w; pos[j * 6 + 2] = 0;
        pos[j * 6 + 3] = sPts[j * 2] + ty * w; pos[j * 6 + 4] = sPts[j * 2 + 1] - tx * w; pos[j * 6 + 5] = 0;
      }
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.setDrawRange(0, bis * 6);
      mesh.visible = true;
    };
    setze(linie, 4);
  }

  const t = takt();
  if (t) t.add((dt, z) => { frame(dt, z); detailTakt(dt, z); });
  else {
    let letzt = performance.now(), z = 0;
    const loop = () => { const j = performance.now(), dt = Math.min(0.05, (j - letzt) / 1000); letzt = j; z += dt; frame(dt, z); detailTakt(dt, z); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}

if (html.classList.contains('mit-webgl')) starteKarussell().catch(e => { console.warn('Karussell:', e && e.message); });
else ohneWebgl();
