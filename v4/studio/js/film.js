/* Film "Wie eine Website entsteht": die 3D-Bühne der Hebel-Startseite.
   Grundlage: docs/webstudio-2026-10/10-bau-brief-v3.md, Drehbuch Hebel, Kapitel 1 bis 6.

   Schnittstelle (die Seite kennt nur diese):
     const film = await erstelleFilm(canvas, { ebene, schmal, maxDpr, ruhig, beiBild })
     film.setProgress(p)    Filmzeit 0 bis 6. Ganze Zahlen sind Kapitelgrenzen:
                            0 bis 1 Wort, 1 Skizze, 2 Bau, 3 Leben, 4 Bruch, 5 bis 6 Ihr Betrieb.
     film.setPointer(x, y)  Zeiger -1 bis 1 (nur Desktop), die Kamera neigt sich leicht mit
     film.setSchmal(b)      Bildaufbau für Handy (Objekt oben, Text unten) oder Desktop (Text links)
     film.resize(), film.pause(), film.resume(), film.dispose(), film.zustand()
     film.rechteckLeer()    Bildschirmrechteck der leeren Seite aus Kapitel 6 (für die Schwarzblende)
   ebene: Element für Notizen und Koten. Die Szene legt sie dort an und setzt sie bei jedem Bild,
          damit Schrift und Bild nie auseinanderlaufen. Alles darin ist Schmuck (aria-hidden).
   ruhig: reduzierte Bewegung. Dann läuft nichts von selbst (kein Funkenflug im Leerlauf, kein
          Puls, keine Glättung). Alles, was am Scroll hängt, bleibt.
   beiBild(p) meldet nach jedem gezeichneten Bild die Filmzeit, damit die Texte im DOM mitgehen. */

import * as THREE from 'three';
import { baueHaus } from './welt-bau.js';
import { SEITE, welt, SKIZZE_FUMO, NOTIZEN_FUMO, BLOECKE, SKIZZE_LEER, NOTIZEN_LEER } from './skizze-daten.js';

const W = SEITE.weltB, H = SEITE.weltH;
const FARBE = { grund: 0xf4f4f2, kobalt: '#2340FF', tinte: 0x0b0b0c };
const BILD = {
  seite: '/hebel-vorschau/v4/studio/welt/fumo-einstieg.webp',
  seiteKlein: '/hebel-vorschau/v4/studio/welt/fumo-einstieg-klein.webp',
  handy: '/hebel-vorschau/v4/studio/welt/fumo-handy-reservierung.webp',
  handyKlein: '/hebel-vorschau/v4/studio/welt/fumo-handy-reservierung-klein.webp',
  beton: '/hebel-vorschau/v4/beispiele/quader-bau/bilder/beton-textur.webp',
  video: i => `/hebel-vorschau/v4/beispiele/fumo/video/bild-${String(i).padStart(4, '0')}.webp`,
  serif: '/hebel-vorschau/v4/beispiele/fumo/fonts/newsreader-latin-opsz-normal.woff2',
  grotesk: '/hebel-vorschau/v4/beispiele/fumo/fonts/schibsted-grotesk-latin-wght-normal.woff2',
};
// Texte der Videostrecke, wie auf der Fumo-Seite (beispiele/fumo/video/meta.json)
const VIDEO_TEXTE = [[0, 'Angebraten über Buchenholz.'], [0.42, 'Angerichtet am Pass.'], [0.78, 'Gemüse vom Feuer, Kräuteröl, Fleur de Sel.']];
const VIDEO_BILDER = 64;

/* Masse des Hauses aus welt-bau.js (dort in Metern im Massstab 1:3) */
const HAUS = { sockel: 0.35, geschoss: 1.25, wand: 1.01, rohStart: 0.12, rohDauer: 0.165, massstab: 3 };
const HANDY = { w: 1.33, h: 2.87, rand: 0.064, r: 0.225, tiefe: 0.16, status: 0.16 };
const RAHMEN = { rand: 0.064, leiste: 0.21, r: 0.14, tiefe: 0.09 };
const KNOPF = { y: 1.275 - 0.9386 * 2.71, b: 1.144, h: 0.175 }; // "Tisch reservieren" im Handy
const BREITE = { haupt: 2.3, fein: 1.25, mass: 1.05, strich: 1.7 };

const klemme = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const linear = (a, b, v) => klemme((v - a) / (b - a));
const glatt = (a, b, v) => { const t = linear(a, b, v); return t * t * (3 - 2 * t); };
const aus3 = t => 1 - Math.pow(1 - t, 3);
const zurueck = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const mix = (a, b, t) => a + (b - a) * t;
const zufallsquelle = saat => { let s = saat; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

/* ---------- Kamera: Posen über die Filmzeit ----------
   az, el: Blickwinkel um das Ziel (rad); gr: Weltgrösse, die in den Bildbereich passen muss;
   dolly: Abstand relativ zu dieser Passung; seite: 0 Bildmitte, 1 Bildbereich neben dem Text. */
const KAMERA = [
  { p: 0.8, az: 0, el: 0, ziel: [0, 0, 0], gr: [6.2, 4.2], dolly: 3.4, seite: 0 },
  { p: 1.06, az: 0, el: 0, ziel: [0, 0, 0], gr: [6.2, 4.2], dolly: 1.0, seite: 0 },
  { p: 1.36, az: 0, el: 0, ziel: [0, 0, 0], gr: [6.2, 4.2], dolly: 1.0, seite: 1 },
  { p: 1.96, az: 0, el: 0, ziel: [0, 0, 0], gr: [6.2, 4.2], dolly: 0.96, seite: 1 },
  { p: 2.28, az: -0.64, el: 0.3, ziel: [0, -0.05, 0.12], gr: [5.4, 3.8], dolly: 1.0, seite: 1 },
  { p: 2.46, az: -0.5, el: 0.22, ziel: [0, -0.05, 0.1], gr: [5.4, 3.8], dolly: 0.98, seite: 1 },
  { p: 2.64, az: 0, el: 0, ziel: [0, 0.05, 0], gr: [5.3, 3.55], dolly: 1.0, seite: 1 },
  { p: 3.0, az: 0.07, el: 0.02, ziel: [0, 0.05, 0], gr: [5.3, 3.55], dolly: 0.95, seite: 1 },
  { p: 3.22, az: 0.16, el: 0.06, ziel: [0, 0, 0], gr: [2.2, 3.5], dolly: 1.0, seite: 1 },
  { p: 3.52, az: 0.12, el: 0.05, ziel: [1.15, 0, 0.3], zielS: [0.2, -0.1, 0.3], gr: [4.6, 3.6], dolly: 1.0, seite: 1 },
  { p: 3.96, az: 0.02, el: 0.03, ziel: [1.1, 0, 0.3], zielS: [0.2, -0.1, 0.3], gr: [4.6, 3.6], dolly: 0.96, seite: 1 },
  { p: 4.12, az: 0, el: 0.06, ziel: [0, -0.1, 0], gr: [3.8, 3.8], dolly: 1.08, seite: 1 },
  { p: 4.44, az: 0.64, el: 0.36, ziel: [0, -0.32, 0], gr: [4.0, 3.0], dolly: 1.0, seite: 1 },
  { p: 4.96, az: 0.98, el: 0.3, ziel: [0, -0.28, 0], gr: [3.9, 2.9], dolly: 0.95, seite: 1 },
  { p: 5.3, az: 0, el: 0, ziel: [0, 0, 0], gr: [6.0, 4.0], dolly: 1.0, seite: 1 },
  { p: 5.84, az: 0, el: 0, ziel: [0, 0, 0], gr: [6.0, 4.0], dolly: 0.95, seite: 1 },
  { p: 6.0, az: 0, el: 0, ziel: [0, 0, 0], gr: [6.0, 4.0], dolly: 0.3, seite: 1 },
];
/* Bildbereich für das Objekt in Bruchteilen des Bildes [x, y, b, h]. Breit steht der Text links,
   schmal unten. */
const BEREICH = {
  breit: { mitte: [0.08, 0.12, 0.84, 0.76], seite: [0.39, 0.14, 0.5, 0.72] },
  schmal: { mitte: [0.04, 0.1, 0.92, 0.5], seite: [0.04, 0.1, 0.92, 0.44] },
};

/* ---------- Linien wie von Hand: Bänder mit fester Breite in Bildpunkten ---------- */
const LINIE_VERTEX = /* glsl */`
  attribute vec3 aRichtung;
  attribute float aSeite;
  attribute float aT;
  attribute vec2 aZeit;
  attribute float aBreite;
  attribute float aLaenge;
  attribute float aStrich;
  uniform float uPxWelt;
  varying float vT;
  varying float vSeite;
  varying vec2 vZeit;
  varying float vLaenge;
  varying float vStrich;
  #include <fog_pars_vertex>
  void main() {
    vT = aT; vSeite = aSeite; vZeit = aZeit; vLaenge = aLaenge; vStrich = aStrich;
    vec3 p = position + aRichtung * aSeite * aBreite * 0.5 * uPxWelt;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const LINIE_FRAGMENT = /* glsl */`
  uniform vec3 uFarbe;
  uniform float uAlpha;
  uniform float uZeichnen;
  uniform float uStrichLaenge;
  varying float vT;
  varying float vSeite;
  varying vec2 vZeit;
  varying float vLaenge;
  varying float vStrich;
  #include <fog_pars_fragment>
  void main() {
    float zeig = (uZeichnen - vZeit.x) / vZeit.y;
    if (vT > zeig) discard;
    float kante = 1.0 - smoothstep(0.45, 1.0, abs(vSeite));
    float korn = 0.86 + 0.14 * sin(vLaenge * 61.0 + vZeit.x * 40.0);
    float strich = vStrich > 0.5 ? step(0.42, fract(vLaenge / uStrichLaenge)) : 1.0;
    float a = uAlpha * kante * korn * strich;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uFarbe, a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

function baueLinien(striche, saat) {
  const zz = zufallsquelle(saat);
  const a = { pos: [], richt: [], seite: [], t: [], zeit: [], breite: [], laenge: [], strich: [] };
  const index = [];
  let v = 0;
  for (const s of striche) {
    let pts = s.p.map(p => p.slice());
    if (s.ueber && pts.length === 2) {
      const [p0, p1] = pts;
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
      const vor = 3 + zz() * 9, nach = 6 + zz() * 13;
      pts = [[p0[0] - dx / l * vor, p0[1] - dy / l * vor], [p1[0] + dx / l * nach, p1[1] + dy / l * nach]];
    }
    // Gerade Strecken verdichten und ganz leicht biegen, wie mit dem Lineal aus freier Hand
    const dicht = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
      const n = Math.max(1, Math.round(l / 14));
      const bogen = pts.length === 2 ? (zz() - 0.5) * Math.min(7, l * 0.009) : 0;
      const nx = -dy / l, ny = dx / l;
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const u = k / n, b = Math.sin(Math.PI * u) * bogen;
        dicht.push([p0[0] + dx * u + nx * b, p0[1] + dy * u + ny * b]);
      }
    }
    const w = dicht.map(([x, y]) => welt(x, y));
    const acc = [0];
    for (let i = 1; i < w.length; i++) acc.push(acc[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
    const L = acc[acc.length - 1] || 1;
    for (let i = 0; i < w.length; i++) {
      const p0 = w[Math.max(0, i - 1)], p1 = w[Math.min(w.length - 1, i + 1)];
      let tx = p1[0] - p0[0], ty = p1[1] - p0[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      if (i > 0) index.push(v - 2, v - 1, v, v - 1, v + 1, v);
      for (const sd of [-1, 1]) {
        a.pos.push(w[i][0], w[i][1], 0);
        a.richt.push(-ty, tx, 0);
        a.seite.push(sd);
        a.t.push(acc[i] / L);
        a.zeit.push(s.t0, Math.max(1e-4, s.t1 - s.t0));
        a.breite.push(BREITE[s.art] || 1.4);
        a.laenge.push(acc[i]);
        a.strich.push(s.art === 'strich' ? 1 : 0);
      }
      v += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
  g.setAttribute('aRichtung', new THREE.Float32BufferAttribute(a.richt, 3));
  g.setAttribute('aSeite', new THREE.Float32BufferAttribute(a.seite, 1));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(a.t, 1));
  g.setAttribute('aZeit', new THREE.Float32BufferAttribute(a.zeit, 2));
  g.setAttribute('aBreite', new THREE.Float32BufferAttribute(a.breite, 1));
  g.setAttribute('aLaenge', new THREE.Float32BufferAttribute(a.laenge, 1));
  g.setAttribute('aStrich', new THREE.Float32BufferAttribute(a.strich, 1));
  g.setIndex(index);
  const m = new THREE.ShaderMaterial({
    vertexShader: LINIE_VERTEX,
    fragmentShader: LINIE_FRAGMENT,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uFarbe: { value: new THREE.Color(FARBE.kobalt) },
      uAlpha: { value: 1 },
      uZeichnen: { value: 0 },
      uPxWelt: { value: 0.01 },
      uStrichLaenge: { value: 0.09 },
    }]),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

/* ---------- Formen ---------- */
function rundRechteck(w, h, r, oben = r, unten = r) {
  const s = new THREE.Shape();
  const x = w / 2, y = h / 2;
  const ecke = (cx, cy, rr, a0, a1, px, py) => (rr > 0 ? s.absarc(cx, cy, rr, a0, a1, false) : s.lineTo(px, py));
  s.moveTo(-x + unten, -y);
  s.lineTo(x - unten, -y);
  ecke(x - unten, -y + unten, unten, -Math.PI / 2, 0, x, -y);
  s.lineTo(x, y - oben);
  ecke(x - oben, y - oben, oben, 0, Math.PI / 2, x, y);
  s.lineTo(-x + oben, y);
  ecke(-x + oben, y - oben, oben, Math.PI / 2, Math.PI, -x, y);
  s.lineTo(-x, -y + unten);
  ecke(-x + unten, -y + unten, unten, Math.PI, Math.PI * 1.5, -x, -y);
  return s;
}
function flaeche(w, h, r, oben = r, unten = r) {
  const g = new THREE.ShapeGeometry(rundRechteck(w, h, r, oben, unten), 10);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}
function koerper(w, h, r, tiefe) {
  const b = Math.min(0.02, r * 0.35, tiefe * 0.3);
  const g = new THREE.ExtrudeGeometry(rundRechteck(w - 2 * b, h - 2 * b, Math.max(0.004, r - b)), {
    depth: tiefe - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 12,
  });
  g.translate(0, 0, -(tiefe - 2 * b) / 2);
  g.computeVertexNormals();
  return g;
}
function leinwand(b, h, malen) {
  const c = document.createElement('canvas');
  c.width = b; c.height = h;
  malen(c.getContext('2d'), b, h);
  return c;
}
function canvasTextur(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function weicheTextur(rgba, sx = 1, drehung = 0) {
  return canvasTextur(leinwand(256, 256, (g, b, h) => {
    g.translate(b / 2, h / 2);
    g.rotate(drehung);
    g.scale(sx, 1);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 120);
    r.addColorStop(0, `rgba(${rgba},0.9)`);
    r.addColorStop(0.45, `rgba(${rgba},0.38)`);
    r.addColorStop(1, `rgba(${rgba},0)`);
    g.fillStyle = r;
    g.fillRect(-128, -128, 256, 256);
  }));
}
function gitter(b, h, schritt, alpha, ebene = 'xy') {
  const p = [];
  for (let x = -b / 2; x <= b / 2 + 1e-6; x += schritt) ebene === 'xy' ? p.push(x, -h / 2, 0, x, h / 2, 0) : p.push(x, 0, -h / 2, x, 0, h / 2);
  for (let y = -h / 2; y <= h / 2 + 1e-6; y += schritt) ebene === 'xy' ? p.push(-b / 2, y, 0, b / 2, y, 0) : p.push(-b / 2, 0, y, b / 2, 0, y);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: FARBE.kobalt, transparent: true, opacity: alpha, depthWrite: false }));
}
function schriftLaden(name, url, gewicht = 'normal') {
  if (!window.FontFace) return Promise.resolve(false);
  const f = new FontFace(name, `url(${url})`, { weight: gewicht });
  return f.load().then(x => { document.fonts.add(x); return true; }).catch(() => false);
}
function rundRect(g, x, y, b, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + b, y, x + b, y + h, r);
  g.arcTo(x + b, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + b, y, r);
  g.closePath();
}

/* Statusleiste eines Handys: Farbe vom oberen Rand des Bildes, Uhrzeit links, Akku rechts */
function statusTextur(bild) {
  let farbe = [20, 17, 16];
  try {
    const p = leinwand(1, 1, (g) => g.drawImage(bild, 0, 0, 8, 4, 0, 0, 1, 1));
    farbe = Array.from(p.getContext('2d').getImageData(0, 0, 1, 1).data).slice(0, 3);
  } catch (e) { /* Standardfarbe */ }
  return canvasTextur(leinwand(512, 62, (x, b, h) => {
    x.fillStyle = `rgb(${farbe.join(',')})`;
    x.fillRect(0, 0, b, h);
    x.fillStyle = '#F4F4F2';
    x.font = '600 22px "Archivo Variable", system-ui, sans-serif';
    x.textBaseline = 'middle';
    x.fillText('20:14', 52, 33);
    [0, 1, 2, 3].forEach(i => x.fillRect(372 + i * 8, 38 - (i + 1) * 4, 5, (i + 1) * 4));
    x.globalAlpha = 0.45;
    x.strokeStyle = '#F4F4F2';
    x.lineWidth = 2;
    x.strokeRect(416, 24, 36, 17);
    x.globalAlpha = 1;
    x.fillRect(419, 27, 26, 11);
  }));
}

/* Risse im Glas, vom Aufprallpunkt aus. Wird über einen Radius aufgedeckt. */
function rissLeinwand(u, v) {
  return leinwand(512, 1024, (g, b, h) => {
    const zz = zufallsquelle(31);
    const x0 = u * b, y0 = v * h;
    const zug = (x, y, winkel, laenge, dicke) => {
      const p = [[x, y]];
      let a = winkel;
      for (let s = 0; s < laenge; s++) {
        a += (zz() - 0.5) * 0.5;
        const l = 18 + zz() * 46;
        x += Math.cos(a) * l; y += Math.sin(a) * l;
        p.push([x, y]);
        if (dicke > 1.2 && zz() < 0.16) zug(x, y, a + (zz() < 0.5 ? 0.7 : -0.7), 3 + Math.floor(zz() * 5), dicke * 0.6);
        if (x < -40 || x > b + 40 || y < -40 || y > h + 40) break;
      }
      for (const [farbe, versatz, breite] of [['rgba(0,0,0,0.55)', 1.2, dicke + 1], ['rgba(255,255,255,0.92)', 0, dicke]]) {
        g.strokeStyle = farbe;
        g.lineWidth = breite;
        g.beginPath();
        p.forEach(([px, py], i) => (i ? g.lineTo(px + versatz, py + versatz) : g.moveTo(px + versatz, py + versatz)));
        g.stroke();
      }
    };
    g.lineJoin = 'round';
    for (let k = 0; k < 13; k++) zug(x0, y0, (k / 13) * Math.PI * 2 + zz() * 0.4, 20, 2.4);
    // Ringe ums Zentrum wie bei einem Steinschlag
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1.4;
    for (const r of [26, 58, 104]) {
      g.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.5 + zz() * 0.4) {
        const r2 = r * (0.85 + zz() * 0.3);
        g.moveTo(x0 + Math.cos(a) * r2, y0 + Math.sin(a) * r2);
        g.lineTo(x0 + Math.cos(a + 0.35) * r2, y0 + Math.sin(a + 0.35) * r2);
      }
      g.stroke();
    }
  });
}

/* ---------- Szene ---------- */
export async function erstelleFilm(canvas, optionen = {}) {
  const { maxDpr = 1.5, beiBild = null, ebene = null } = optionen;
  let schmal = !!optionen.schmal;
  const ruhig = !!optionen.ruhig;

  // Durchsichtig: hinter der Szene liegt die hintere Ebene der Seite (grosse Wörter, Zirkel)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: true, premultipliedAlpha: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(FARBE.grund, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FARBE.grund, 12, 40);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 120);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d4ce, 1.6));
  const sonne = new THREE.DirectionalLight(0xffffff, 2.0);
  sonne.position.set(-3.5, 5, 6);
  scene.add(sonne);

  const anisotropie = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const lader = new THREE.TextureLoader();
  const laden = url => lader.loadAsync(url).then(t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropie;
    return t;
  }).catch(() => null);
  const schriften = Promise.race([
    Promise.all([schriftLaden('Fumo Serif', BILD.serif, '200 800'), schriftLaden('Fumo Grotesk', BILD.grotesk, '400 900')]),
    new Promise(r => setTimeout(r, 2500)),
  ]);
  const [seiteTex, handyTex, betonTex] = await Promise.all([
    laden(schmal ? BILD.seiteKlein : BILD.seite),
    laden(schmal ? BILD.handyKlein : BILD.handy),
    laden(BILD.beton),
  ]);

  /* ===== Kapitel 1 und 2: Raster an der Wand, Skizze auf der Seitenebene ===== */
  const wand = gitter(44, 28, 0.3, 0.07);
  wand.position.z = -1.4;
  scene.add(wand);
  const wandFein = gitter(44, 28, 1.5, 0.08);
  wandFein.position.z = -1.399;
  scene.add(wandFein);

  const skizze = new THREE.Group();
  scene.add(skizze);
  const skizzeLinien = baueLinien(SKIZZE_FUMO, 7);
  skizze.add(skizzeLinien);

  /* ===== Kapitel 3: Blöcke, Bildausschnitte, echte Seite im Browser ===== */
  const bau = new THREE.Group();
  scene.add(bau);
  const weiss = new THREE.MeshStandardMaterial({ color: 0xfbfbf9, roughness: 0.86, metalness: 0 });
  const kanteStoff = new THREE.LineBasicMaterial({ color: FARBE.kobalt, transparent: true, opacity: 1 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const kantenGeo = new THREE.EdgesGeometry(boxGeo);
  const ebeneGeo = new THREE.PlaneGeometry(1, 1);
  const bloecke = BLOECKE.map((d, i) => {
    const [x0, y0, x1, y1] = d.r;
    const [cx, cy] = welt((x0 + x1) / 2, (y0 + y1) / 2);
    const b = (x1 - x0) / 300, h = (y1 - y0) / 300;
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);
    g.add(new THREE.Mesh(boxGeo, weiss));
    g.add(new THREE.LineSegments(kantenGeo, kanteStoff));
    bau.add(g);
    let front = null;
    if (d.bild && seiteTex) {
      const t = seiteTex.clone();
      t.repeat.set((x1 - x0) / 1440, (y1 - y0) / 900);
      t.offset.set(x0 / 1440, 1 - y1 / 900);
      t.needsUpdate = true;
      front = new THREE.Mesh(ebeneGeo, new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
      front.renderOrder = 3;
      bau.add(front);
    }
    return { d, g, front, cx, cy, b, h, i, dreh: (i % 2 ? 1 : -1) * (0.06 + (i % 3) * 0.03) };
  });
  const bildBloecke = bloecke.filter(b => b.front);

  // Die echte Seite: Bildschirmaufnahme oben, darunter die Videostrecke mit der Pfanne
  const seiteLeinwand = document.createElement('canvas');
  seiteLeinwand.width = schmal ? 960 : 1280;
  seiteLeinwand.height = schmal ? 600 : 800;
  const seiteMaler = seiteLeinwand.getContext('2d');
  const seiteTextur = canvasTextur(seiteLeinwand);
  seiteTextur.anisotropy = anisotropie;
  const seiteStoff = new THREE.MeshBasicMaterial({ map: seiteTextur, transparent: true, opacity: 0, toneMapped: false });

  const browser = new THREE.Group();
  scene.add(browser);
  const seiteMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), seiteStoff);
  seiteMesh.position.z = 0.006;
  seiteMesh.renderOrder = 4;
  browser.add(seiteMesh);
  const rahmenStoff = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.42, metalness: 0.15, transparent: true, opacity: 0 });
  const rahmen = new THREE.Group();
  browser.add(rahmen);
  {
    const KB = W + 2 * RAHMEN.rand, KH = H + RAHMEN.leiste + RAHMEN.rand;
    const k = new THREE.Mesh(koerper(KB, KH, RAHMEN.r, RAHMEN.tiefe), rahmenStoff);
    k.position.set(0, (RAHMEN.leiste - RAHMEN.rand) / 2, -RAHMEN.tiefe / 2 - 0.004);
    rahmen.add(k);
    const yl = H / 2 + RAHMEN.leiste / 2 - 0.006;
    [0xff5f57, 0xfebc2e, 0x28c840].forEach((c, i) => {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.034, 20), new THREE.MeshBasicMaterial({ color: c, transparent: true }));
      p.position.set(-W / 2 + 0.13 + i * 0.1, yl, 0.002);
      rahmen.add(p);
    });
    const feld = new THREE.Mesh(flaeche(1.32, 0.092, 0.046), new THREE.MeshBasicMaterial({ color: 0x2d2d30, transparent: true }));
    feld.position.set(0, yl, 0.002);
    rahmen.add(feld);
  }

  const videoBilder = new Array(VIDEO_BILDER).fill(null);
  let videoLaedt = false;
  function videoLaden() {
    if (videoLaedt) return;
    videoLaedt = true;
    // Jedes zweite Bild reicht für die Strecke; geladen wird nacheinander, nie alles auf einmal
    const liste = [];
    for (let i = 1; i <= VIDEO_BILDER; i += 2) liste.push(i);
    let n = 0;
    const naechstes = () => {
      if (n >= liste.length || entsorgt) return;
      const i = liste[n++];
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { videoBilder[i - 1] = img; seiteZustand = ''; naechstes(); };
      img.onerror = naechstes;
      img.src = BILD.video(i);
    };
    naechstes(); naechstes();
  }
  const videoBild = k => {
    const z = Math.round(k * (VIDEO_BILDER - 1));
    for (let d = 0; d < VIDEO_BILDER; d++) {
      if (videoBilder[z - d]) return videoBilder[z - d];
      if (videoBilder[z + d]) return videoBilder[z + d];
    }
    return null;
  };
  let seiteZustand = '';
  function seiteMalen(s, k) {
    const schluessel = `${s.toFixed(3)}|${Math.round(k * 63)}|${videoBilder.filter(Boolean).length > 0}`;
    if (schluessel === seiteZustand) return;
    seiteZustand = schluessel;
    const g = seiteMaler, b = seiteLeinwand.width, h = seiteLeinwand.height;
    g.fillStyle = '#100d0b';
    g.fillRect(0, 0, b, h);
    const y0 = -s * h;
    if (seiteTex && seiteTex.image && y0 > -h) g.drawImage(seiteTex.image, 0, y0, b, h);
    const vy = y0 + h;
    if (vy < h) {
      const bild = videoBild(k);
      const vh = b * 720 / 1280;
      const oy = vy + (h - vh) / 2;
      if (bild) g.drawImage(bild, 0, oy, b, vh);
      const v = g.createLinearGradient(0, oy + vh * 0.55, 0, oy + vh);
      v.addColorStop(0, 'rgba(16,13,11,0)');
      v.addColorStop(1, 'rgba(16,13,11,0.85)');
      g.fillStyle = v;
      g.fillRect(0, oy + vh * 0.55, b, vh * 0.45 + 2);
      let text = VIDEO_TEXTE[0][1];
      VIDEO_TEXTE.forEach(([ab, t]) => { if (k >= ab) text = t; });
      g.fillStyle = '#F3EDE6';
      g.font = `400 ${Math.round(b * 0.034)}px "Fumo Serif", Georgia, serif`;
      g.textBaseline = 'alphabetic';
      g.fillText(text, b * 0.05, oy + vh - b * 0.045);
    }
    seiteTextur.needsUpdate = true;
  }

  /* ===== Funken: springen aus dem Feuer in den weissen Raum ===== */
  const FUNKEN = 240;
  const fPos = new Float32Array(FUNKEN * 3), fAlter = new Float32Array(FUNKEN), fGroesse = new Float32Array(FUNKEN), fArt = new Float32Array(FUNKEN);
  const fVel = new Float32Array(FUNKEN * 3), fLeben = new Float32Array(FUNKEN);
  fAlter.fill(2);
  const funkenGeo = new THREE.BufferGeometry();
  funkenGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  funkenGeo.setAttribute('aAlter', new THREE.BufferAttribute(fAlter, 1));
  funkenGeo.setAttribute('aGroesse', new THREE.BufferAttribute(fGroesse, 1));
  funkenGeo.setAttribute('aArt', new THREE.BufferAttribute(fArt, 1));
  const funkenStoff = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aAlter; attribute float aGroesse; attribute float aArt;
      uniform float uPx;
      varying float vAlter; varying float vArt;
      void main() {
        vAlter = aAlter; vArt = aArt;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aAlter >= 1.0 ? 0.0 : aGroesse * uPx / max(0.2, -mv.z) * (1.0 - 0.45 * aAlter);
      }`,
    fragmentShader: /* glsl */`
      varying float vAlter; varying float vArt;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        if (r > 0.5 || vAlter >= 1.0) discard;
        float kern = 1.0 - smoothstep(0.12, 0.5, r);
        vec3 heiss = vec3(1.0, 0.86, 0.48), glut = vec3(1.0, 0.42, 0.08), asche = vec3(0.36, 0.17, 0.08);
        vec3 c = mix(heiss, glut, smoothstep(0.0, 0.3, vAlter));
        c = mix(c, asche, smoothstep(0.45, 0.95, vAlter));
        c = mix(c, vec3(0.55, 0.53, 0.5), vArt);
        float a = kern * (1.0 - smoothstep(0.7, 1.0, vAlter)) * (vArt > 0.5 ? 0.7 : 1.0);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const funken = new THREE.Points(funkenGeo, funkenStoff);
  funken.frustumCulled = false;
  funken.renderOrder = 6;
  scene.add(funken);
  let fNext = 0, funkenLebendig = 0, emitRest = 0;
  const hilfV = new THREE.Vector3();
  function funke(px, py, pz, vx, vy, vz, leben, groesse, art) {
    const i = fNext; fNext = (fNext + 1) % FUNKEN;
    fPos[i * 3] = px; fPos[i * 3 + 1] = py; fPos[i * 3 + 2] = pz;
    fVel[i * 3] = vx; fVel[i * 3 + 1] = vy; fVel[i * 3 + 2] = vz;
    fAlter[i] = 0; fLeben[i] = leben; fGroesse[i] = groesse; fArt[i] = art;
  }
  const zzF = zufallsquelle(91);
  function feuerFunke() {
    // Ursprung im Feuer der Seite (Bildschirmaufnahme 680 bis 1380 x 380 bis 700 Pixel)
    const [x, y] = welt(680 + zzF() * 700, 380 + zzF() * 320);
    hilfV.set(x, y, 0.04);
    browser.localToWorld(hilfV);
    funke(hilfV.x, hilfV.y, hilfV.z, (zzF() - 0.35) * 1.3, 0.5 + zzF() * 1.6, 1.0 + zzF() * 1.9, 0.9 + zzF() * 1.1, 26 + zzF() * 40, 0);
  }
  function funkenBewegen(dt) {
    funkenLebendig = 0;
    for (let i = 0; i < FUNKEN; i++) {
      if (fAlter[i] >= 1) continue;
      funkenLebendig++;
      fAlter[i] = Math.min(1, fAlter[i] + dt / fLeben[i]);
      const zaeh = Math.exp(-dt * (fArt[i] > 0.5 ? 1.6 : 0.7));
      fVel[i * 3] *= zaeh; fVel[i * 3 + 2] *= zaeh;
      fVel[i * 3 + 1] = fVel[i * 3 + 1] * zaeh - dt * (fArt[i] > 0.5 ? 2.6 : 1.5);
      // leichtes Flackern der Glut
      fVel[i * 3] += (Math.sin(zeit * 9 + i) * 0.3) * dt * (1 - fArt[i]);
      fPos[i * 3] += fVel[i * 3] * dt; fPos[i * 3 + 1] += fVel[i * 3 + 1] * dt; fPos[i * 3 + 2] += fVel[i * 3 + 2] * dt;
    }
    funkenGeo.attributes.position.needsUpdate = true;
    funkenGeo.attributes.aAlter.needsUpdate = true;
    funkenGeo.attributes.aGroesse.needsUpdate = true;
    funkenGeo.attributes.aArt.needsUpdate = true;
  }

  /* ===== Kapitel 4: das Handy, ein Finger, die Bestätigung ===== */
  const handy = new THREE.Group();
  scene.add(handy);
  const PW = HANDY.w + 2 * HANDY.rand, PH = HANDY.h + 2 * HANDY.rand;
  handy.add(new THREE.Mesh(koerper(PW, PH, HANDY.r, HANDY.tiefe), new THREE.MeshStandardMaterial({ color: 0x19191b, roughness: 0.3, metalness: 0.3 })));
  const vorne = HANDY.tiefe / 2 + 0.003;
  const inhaltH = HANDY.h - HANDY.status;
  let sichtbarAnteil = 1;
  if (handyTex) {
    handyTex.wrapS = handyTex.wrapT = THREE.ClampToEdgeWrapping;
    const aspekt = handyTex.image.width / handyTex.image.height;
    sichtbarAnteil = Math.min(1, aspekt / (HANDY.w / inhaltH));
    handyTex.repeat.y = sichtbarAnteil;
    handyTex.offset.y = 1 - sichtbarAnteil;
  }
  const rInnen = HANDY.r - HANDY.rand;
  const inhalt = new THREE.Mesh(flaeche(HANDY.w, inhaltH, rInnen, 0, rInnen), new THREE.MeshBasicMaterial({ map: handyTex, color: handyTex ? 0xffffff : 0x1a1614, toneMapped: false }));
  inhalt.position.set(0, -HANDY.status / 2, vorne);
  handy.add(inhalt);
  const leiste = new THREE.Mesh(flaeche(HANDY.w, HANDY.status, rInnen, rInnen, 0), new THREE.MeshBasicMaterial({ map: handyTex ? statusTextur(handyTex.image) : null, color: handyTex ? 0xffffff : 0x141110, toneMapped: false }));
  leiste.position.set(0, HANDY.h / 2 - HANDY.status / 2, vorne);
  handy.add(leiste);
  const insel = new THREE.Mesh(flaeche(0.36, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  insel.position.set(0, HANDY.h / 2 - 0.085, vorne + 0.002);
  handy.add(insel);
  // Drücken: der Knopf dunkelt ab, die Fingerkuppe liegt auf, ein Ring läuft aus
  const druck = new THREE.Mesh(flaeche(KNOPF.b, KNOPF.h, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  druck.position.set(0, KNOPF.y, vorne + 0.003);
  handy.add(druck);
  const kuppe = new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), new THREE.MeshBasicMaterial({ color: 0x0b0b0c, transparent: true, opacity: 0, depthWrite: false }));
  kuppe.position.set(0.12, KNOPF.y, vorne + 0.005);
  handy.add(kuppe);
  const welle = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  welle.position.copy(kuppe.position);
  welle.position.z += 0.001;
  handy.add(welle);
  const fingerSchatten = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: weicheTextur('8,8,10', 0.55, 0.62), transparent: true, opacity: 0, depthWrite: false }));
  fingerSchatten.renderOrder = 5;
  handy.add(fingerSchatten);
  const rissTex = canvasTextur(rissLeinwand(0.5 + 0.12 / HANDY.w, (HANDY.h / 2 - KNOPF.y) / HANDY.h));
  const riss = new THREE.Mesh(new THREE.PlaneGeometry(HANDY.w, HANDY.h), new THREE.ShaderMaterial({
    uniforms: { uKarte: { value: rissTex }, uRadius: { value: 0 }, uMitte: { value: new THREE.Vector2(0.5 + 0.12 / HANDY.w, (KNOPF.y + HANDY.h / 2) / HANDY.h) }, uAspekt: { value: HANDY.h / HANDY.w } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D uKarte; uniform float uRadius; uniform vec2 uMitte; uniform float uAspekt;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(uKarte, vUv);
        vec2 d = (vUv - uMitte) * vec2(1.0, uAspekt);
        float a = t.a * (1.0 - smoothstep(uRadius - 0.05, uRadius, length(d)));
        if (a < 0.01) discard;
        gl_FragColor = vec4(t.rgb, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  }));
  riss.position.z = vorne + 0.006;
  handy.add(riss);

  // Die Bestätigung fliegt aus dem Handy
  const karteLeinwand = leinwand(900, 520, () => {});
  const karteTextur = canvasTextur(karteLeinwand);
  function karteMalen() {
    const g = karteLeinwand.getContext('2d'), b = 900, h = 520;
    g.clearRect(0, 0, b, h);
    rundRect(g, 6, 6, b - 12, h - 12, 34);
    g.fillStyle = '#1b1715';
    g.fill();
    g.strokeStyle = 'rgba(243,237,230,0.12)';
    g.lineWidth = 2;
    g.stroke();
    // Haken im Kreis, Glutfarbe der Fumo-Seite
    g.fillStyle = '#C4501F';
    g.beginPath(); g.arc(96, 104, 38, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#FFF4EC'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(78, 105); g.lineTo(92, 119); g.lineTo(116, 91); g.stroke();
    g.fillStyle = '#B9AEA4';
    g.font = '500 26px "Fumo Grotesk", system-ui, sans-serif';
    g.fillText('fumo, Reservierung', 156, 96);
    g.fillStyle = '#F3EDE6';
    g.font = '400 64px "Fumo Serif", Georgia, serif';
    g.fillText('Ihr Tisch ist reserviert.', 56, 240);
    g.fillStyle = '#E8DFD6';
    g.font = '400 34px "Fumo Grotesk", system-ui, sans-serif';
    g.fillText('Samstag, 3. Oktober 2026, 20.00 Uhr', 58, 318);
    g.fillText('2 Personen', 58, 366);
    g.fillStyle = '#9C9189';
    g.font = '400 26px "Fumo Grotesk", system-ui, sans-serif';
    g.fillText('Die Bestätigung ist per E-Mail unterwegs.', 58, 452);
    karteTextur.needsUpdate = true;
  }
  karteMalen();
  schriften.then(() => { karteMalen(); seiteZustand = ''; anfordern(); });
  const karte = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 1.3), new THREE.MeshBasicMaterial({ map: karteTextur, transparent: true, toneMapped: false, depthWrite: false }));
  karte.renderOrder = 7;
  scene.add(karte);
  const karteSchatten = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), new THREE.MeshBasicMaterial({ map: weicheTextur('20,20,26', 1.3), transparent: true, opacity: 0, depthWrite: false }));
  karteSchatten.renderOrder = 6;
  scene.add(karteSchatten);

  /* ===== Kapitel 5: das Handy zerspringt in Betonquader, die das Haus von Quader Bau bauen ===== */
  const haus = baueHaus(THREE, { beton: betonTex });
  const bauplatz = haus.gruppe;
  const BAU = { pos: new THREE.Vector3(0, -1.3, 0), dreh: -0.42, s: 0.24 };
  bauplatz.position.copy(BAU.pos);
  bauplatz.rotation.y = BAU.dreh;
  bauplatz.scale.setScalar(BAU.s);
  scene.add(bauplatz);
  const boden = gitter(30, 20, 1, 0.09, 'xz');
  boden.position.y = 0.004;
  bauplatz.add(boden);
  const bauSchatten = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: weicheTextur('24,24,28', 1.6), transparent: true, opacity: 0, depthWrite: false }));
  bauSchatten.scale.set(17, 1, 10);
  bauSchatten.position.y = 0.01;
  bauplatz.add(bauSchatten);
  // Höhenkote an der Ecke vorne rechts
  const KOTE = { x: 4.75, z: 3.05 };
  const koteStoff = new THREE.MeshBasicMaterial({ color: FARBE.kobalt, transparent: true });
  const koteLinie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07).translate(0, 0.5, 0), koteStoff);
  koteLinie.position.set(KOTE.x, 0, KOTE.z);
  bauplatz.add(koteLinie);
  const koteFuss = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), koteStoff);
  koteFuss.position.set(KOTE.x + 0.1, 0.03, KOTE.z);
  bauplatz.add(koteFuss);
  const koteKopf = koteFuss.clone();
  bauplatz.add(koteKopf);

  // Scherben: 5 x 10 Quader über dem Glas, jeder zeigt seinen Teil der Seite
  const SPALTEN = 5, ZEILEN = 10, SCHERBEN = SPALTEN * ZEILEN;
  const zelleB = HANDY.w / SPALTEN, zelleH = HANDY.h / ZEILEN;
  const scherbenGeo = new THREE.BoxGeometry(1, 1, 1);
  const aUv = new Float32Array(SCHERBEN * 4), aB0 = new Float32Array(SCHERBEN), aZufall = new Float32Array(SCHERBEN);
  const zzS = zufallsquelle(53);
  const texV = y => 1 - ((HANDY.h / 2 - HANDY.status - y) / inhaltH) * sichtbarAnteil;
  const scherbenDaten = [];
  for (let r = 0; r < ZEILEN; r++) {
    for (let c = 0; c < SPALTEN; c++) {
      const i = r * SPALTEN + c;
      const x0 = -HANDY.w / 2 + c * zelleB, y0 = -HANDY.h / 2 + r * zelleH;
      aUv[i * 4] = (x0 + HANDY.w / 2) / HANDY.w;
      aUv[i * 4 + 1] = texV(y0);
      aUv[i * 4 + 2] = zelleB / HANDY.w;
      aUv[i * 4 + 3] = texV(y0 + zelleH) - texV(y0);
      aB0[i] = 4.12 + zzS() * 0.12;
      aZufall[i] = zzS();
      const mitte = new THREE.Vector3(x0 + zelleB / 2, y0 + zelleH / 2, 0);
      const weg = new THREE.Vector3(mitte.x - 0.12, mitte.y - KNOPF.y, 0).normalize();
      // Ziel: ein Geschoss des Hauses. Geschoss 0 ist die Bodenplatte.
      const stock = i % 5;
      const tBau = stock === 0 ? 0.05 : HAUS.rohStart + (stock - 1) * HAUS.rohDauer + 0.1;
      scherbenDaten.push({
        mitte,
        v: new THREE.Vector3(weg.x * (0.7 + zzS() * 0.9) + (zzS() - 0.5) * 0.4, weg.y * (0.5 + zzS() * 0.7) + 0.4 + zzS() * 0.5, 0.5 + zzS() * 1.2),
        achse: new THREE.Vector3(zzS() - 0.5, zzS() - 0.5, zzS() - 0.5).normalize(),
        drall: 2 + zzS() * 4,
        ziel: new THREE.Vector3((zzS() - 0.5) * 7.4, stock === 0 ? 0.2 : HAUS.sockel + (stock - 1) * HAUS.geschoss + HAUS.wand, (zzS() - 0.5) * 4),
        ankunft: 4.3 + tBau * 0.56,
      });
    }
  }
  scherbenGeo.setAttribute('aUv', new THREE.InstancedBufferAttribute(aUv, 4));
  scherbenGeo.setAttribute('aB0', new THREE.InstancedBufferAttribute(aB0, 1));
  scherbenGeo.setAttribute('aZufall', new THREE.InstancedBufferAttribute(aZufall, 1));
  let schirmTex = null;
  if (handyTex) {
    schirmTex = handyTex.clone();
    schirmTex.repeat.set(1, 1);
    schirmTex.offset.set(0, 0);
    schirmTex.needsUpdate = true;
  }
  if (betonTex) { betonTex.wrapS = betonTex.wrapT = THREE.RepeatWrapping; }
  const scherbenStoff = new THREE.ShaderMaterial({
    uniforms: { uSchirm: { value: schirmTex }, uBeton: { value: betonTex }, uHatSchirm: { value: schirmTex ? 1 : 0 }, uHatBeton: { value: betonTex ? 1 : 0 }, uP: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec4 aUv; attribute float aB0; attribute float aZufall;
      uniform float uP;
      varying vec2 vUvSchirm; varying vec2 vUvBox; varying float vVorne; varying float vBeton; varying vec3 vN; varying float vZufall;
      void main() {
        vUvBox = uv;
        vVorne = step(0.5, normal.z);
        vUvSchirm = aUv.xy + uv * aUv.zw;
        vBeton = clamp((uP - aB0) / 0.12, 0.0, 1.0);
        vZufall = aZufall;
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uSchirm; uniform sampler2D uBeton; uniform float uHatSchirm; uniform float uHatBeton;
      varying vec2 vUvSchirm; varying vec2 vUvBox; varying float vVorne; varying float vBeton; varying vec3 vN; varying float vZufall;
      void main() {
        vec3 l = normalize(vec3(-0.35, 0.75, 0.55));
        float licht = 0.55 + 0.5 * max(dot(normalize(vN), l), 0.0);
        vec3 schirm = uHatSchirm > 0.5 ? texture2D(uSchirm, vUvSchirm).rgb : vec3(0.02);
        vec3 alt = mix(vec3(0.012) * licht, schirm, vVorne);
        vec3 beton = (uHatBeton > 0.5 ? texture2D(uBeton, vUvBox * 0.4 + vZufall).rgb : vec3(0.6)) * vec3(0.95, 0.94, 0.92);
        gl_FragColor = vec4(mix(alt, beton * licht, vBeton), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const scherben = new THREE.InstancedMesh(scherbenGeo, scherbenStoff, SCHERBEN);
  scherben.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scherben.frustumCulled = false;
  scene.add(scherben);
  const sQ = new THREE.Quaternion(), sQ2 = new THREE.Quaternion(), sQZiel = new THREE.Quaternion(), sP = new THREE.Vector3(), sE = new THREE.Vector3(), sZ = new THREE.Vector3(), sS = new THREE.Vector3(), sM = new THREE.Matrix4();
  let staubFertig = false;

  /* ===== Kapitel 6: leeres Drahtgitter, das pulsiert ===== */
  const leer = new THREE.Group();
  scene.add(leer);
  const leerLinien = baueLinien(SKIZZE_LEER, 19);
  leer.add(leerLinien);
  const puls = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), new THREE.MeshBasicMaterial({ color: FARBE.kobalt, transparent: true, opacity: 0, depthWrite: false }));
  puls.position.z = 0.01;
  leer.add(puls);

  /* ===== Beschriftung im DOM: Notizen, Masse, Koten ===== */
  const labels = [];
  function label(text, klasse, objekt, x, y, z, gr, dreh, alpha, schreib) {
    if (!ebene) return null;
    const el = document.createElement('span');
    el.className = `film-label ${klasse}`;
    el.textContent = text;
    ebene.appendChild(el);
    const l = { el, objekt, lokal: new THREE.Vector3(x, y, z), gr, dreh, alpha, schreib, zuletzt: '' };
    labels.push(l);
    return l;
  }
  let zeichenFumo = 0, zeichenLeer = 0;
  NOTIZEN_FUMO.forEach(n => {
    const [x, y] = welt(n.x, n.y);
    label(n.text, n.mass ? 'film-label--mass' : 'film-label--notiz', skizze, x, y, 0.01, n.gr / 300, n.dreh,
      p => (p > 0.85 && p < 2.2 ? 1 - glatt(2.02, 2.14, p) : 0),
      () => linear(n.t, n.t + n.dauer, zeichenFumo));
  });
  NOTIZEN_LEER.forEach(n => {
    const [x, y] = welt(n.x, n.y);
    label(n.text, 'film-label--notiz', leer, x, y, 0.01, n.gr / 300, n.dreh,
      p => (p > 5.1 ? 1 - glatt(5.86, 5.95, p) : 0),
      () => linear(n.t, n.t + n.dauer, zeichenLeer));
  });
  const koteAlpha = p => glatt(4.3, 4.36, p) * (1 - glatt(4.98, 5.06, p));
  label('±0.00', 'film-label--kote', bauplatz, KOTE.x + 0.55, 0.3, KOTE.z, 0.42, 0, koteAlpha, () => 1);
  const koteOben = label('+0.00', 'film-label--kote film-label--kote-oben', bauplatz, KOTE.x + 0.55, 0, KOTE.z, 0.5, 0, koteAlpha, () => 1);

  /* ---------- Zustand ---------- */
  let pZiel = 0, pIst = 0, pVorher = 0;
  const zeigerZiel = new THREE.Vector2(), zeiger = new THREE.Vector2();
  let zeit = 0, letzte = 0, aktiv = true, laeuft = false, entsorgt = false;
  let breite = 1, hoehe = 1, pxProWelt = 100, bauZeit = 0, pulsAn = false;
  const kZiel = new THREE.Vector3(), hilf = new THREE.Vector3(), hilf2 = new THREE.Vector3();

  function kameraSetzen(p) {
    let i = 0;
    while (i < KAMERA.length - 2 && p > KAMERA[i + 1].p) i++;
    const a = KAMERA[i], b = KAMERA[i + 1];
    const t = glatt(a.p, b.p, p);
    const az = mix(a.az, b.az, t) + zeiger.x * 0.04;
    const el = mix(a.el, b.el, t) + zeiger.y * 0.025;
    const za = schmal && a.zielS ? a.zielS : a.ziel, zb = schmal && b.zielS ? b.zielS : b.ziel;
    kZiel.set(mix(za[0], zb[0], t), mix(za[1], zb[1], t), mix(za[2], zb[2], t));
    const grB = mix(a.gr[0], b.gr[0], t), grH = mix(a.gr[1], b.gr[1], t);
    const L = BEREICH[schmal ? 'schmal' : 'breit'];
    const s = mix(a.seite, b.seite, t);
    const ber = L.mitte.map((v, k) => mix(v, L.seite[k], s));
    const tan = Math.tan(camera.fov * Math.PI / 360);
    const rB = ber[2] * breite, rH = ber[3] * hoehe;
    const d = Math.max(grH * hoehe / (2 * tan * rH), grB * hoehe / (2 * tan * rB)) * mix(a.dolly, b.dolly, t);
    camera.position.set(kZiel.x + d * Math.sin(az) * Math.cos(el), kZiel.y + d * Math.sin(el), kZiel.z + d * Math.cos(az) * Math.cos(el));
    camera.lookAt(kZiel);
    const cx = (ber[0] + ber[2] / 2) * breite, cy = (ber[1] + ber[3] / 2) * hoehe;
    camera.setViewOffset(breite, hoehe, breite / 2 - cx, hoehe / 2 - cy, breite, hoehe);
    pxProWelt = hoehe / (2 * d * tan);
    return d;
  }

  function aktualisieren(p, dt, dP) {
    const d = kameraSetzen(p);
    const pxWelt = 1 / pxProWelt;

    // Kapitel 1 und 2: Raster und Skizze
    const wandA = glatt(0.78, 0.96, p) * (1 - glatt(1.9, 2.18, p));
    wand.visible = wandFein.visible = wandA > 0.001;
    wand.material.opacity = 0.07 * wandA;
    wandFein.material.opacity = 0.1 * wandA;
    zeichenFumo = linear(0.86, 1.62, p);
    skizze.visible = p > 0.78 && p < 2.16;
    skizzeLinien.material.uniforms.uZeichnen.value = zeichenFumo;
    skizzeLinien.material.uniforms.uAlpha.value = 1 - glatt(2.0, 2.14, p);
    skizzeLinien.material.uniforms.uPxWelt.value = pxWelt;

    // Kapitel 3: Blöcke wachsen aus der Skizze, Bilder rasten ein, die echte Seite übernimmt
    bau.visible = p > 1.98 && p < 2.64;
    if (bau.visible) {
      const flach = glatt(2.46, 2.6, p);
      kanteStoff.opacity = glatt(1.99, 2.05, p) * (1 - glatt(2.48, 2.58, p));
      bloecke.forEach(b => {
        const e = aus3(linear(2.0 + b.i * 0.016, 2.2 + b.i * 0.016, p));
        const tiefe = Math.max(0.0004, b.d.tiefe * e * (1 - flach));
        b.g.scale.set(b.b, b.h, tiefe);
        b.g.visible = e > 0.001;
        if (b.front) {
          const j = bildBloecke.indexOf(b);
          const s = linear(2.2 + j * 0.026, 2.3 + j * 0.026, p);
          const z = tiefe + 0.004 + (1 - aus3(s)) * 1.5;
          const gross = 1 + (1 - zurueck(s)) * 0.22;
          b.front.position.set(b.cx, b.cy, z);
          b.front.scale.set(b.b * gross, b.h * gross, 1);
          b.front.rotation.z = (1 - aus3(s)) * b.dreh;
          b.front.material.opacity = glatt(0, 0.3, s) * (1 - glatt(2.58, 2.63, p));
          b.front.visible = s > 0;
        }
      });
    }
    const seiteA = glatt(2.47, 2.6, p);
    const kipp = glatt(3.0, 3.11, p);
    browser.visible = p > 2.46 && p < 3.11;
    if (browser.visible) {
      seiteStoff.opacity = seiteA;
      const rahmenA = glatt(2.55, 2.66, p);
      rahmenStoff.opacity = rahmenA;
      rahmen.visible = rahmenA > 0.001;
      rahmen.children.forEach(c => { if (c.material !== rahmenStoff) c.material.opacity = rahmenA; });
      rahmen.scale.setScalar(mix(1.05, 1, aus3(rahmenA)));
      browser.rotation.y = kipp * Math.PI / 2;
      browser.position.x = -kipp * 0.25;
      seiteMalen(glatt(2.68, 2.8, p), linear(2.76, 3.0, p));
    }
    if (p > 1.3) videoLaden();

    // Funken: im Leerlauf ein stetiger Flug, beim Scrollen mehr; reduziert nur beim Scrollen
    const feuerFenster = p > 2.56 && p < 3.12;
    if (feuerFenster) {
      // Sprünge (Kapitelwahl, reduzierte Bewegung ohne Glättung) erzeugen nicht Hunderte Funken auf einmal
      emitRest += Math.min(Math.abs(dP), 0.012) * 700 + (ruhig ? 0 : dt * 38);
      while (emitRest >= 1) { feuerFunke(); emitRest -= 1; }
    } else emitRest = 0;
    // Staub, wenn das Handy zerspringt (einmal je Durchgang)
    if (p >= 4.08 && !staubFertig) {
      staubFertig = true;
      for (let k = 0; k < 70; k++) {
        const a = zzF() * Math.PI * 2, r = 0.3 + zzF() * 0.6;
        funke((zzF() - 0.5) * HANDY.w, KNOPF.y + (zzF() - 0.3) * 1.6, 0.1, Math.cos(a) * r, Math.sin(a) * r + 0.6, 0.6 + zzF() * 1.2, 1.2 + zzF(), 18 + zzF() * 26, 1);
      }
    }
    if (p < 4.0) staubFertig = false;
    funkenBewegen(dt);
    funken.visible = funkenLebendig > 0;
    funkenStoff.uniforms.uPx.value = renderer.getPixelRatio() * pxProWelt * 0.001 * d;

    // Kapitel 4: Kippen zum Handy, Finger tippt, Bestätigung fliegt heraus
    const auf = glatt(3.11, 3.24, p);
    handy.visible = p >= 3.11 && p < 4.08;
    if (handy.visible) {
      handy.rotation.y = -(1 - auf) * Math.PI / 2;
      handy.position.x = (1 - auf) * 0.25;
      const a1 = glatt(3.28, 3.42, p), a2 = glatt(3.86, 3.97, p);
      const nah = p < 3.7 ? a1 * (1 - glatt(3.47, 3.58, p)) : a2;
      const druck1 = glatt(3.42, 3.455, p) * (1 - glatt(3.47, 3.5, p));
      const druck2 = glatt(3.97, 3.99, p);
      const k = 1 - nah;
      fingerSchatten.position.set(0.12 + 0.46 * k, KNOPF.y - 0.62 * k, vorne + 0.01);
      fingerSchatten.scale.set(0.95 + k * 1.3, 0.95 + k * 1.3, 1);
      fingerSchatten.material.opacity = 0.42 * glatt(0, 0.3, nah) * (0.55 + 0.45 * nah);
      fingerSchatten.visible = nah > 0.001;
      druck.material.opacity = 0.32 * druck1;
      kuppe.material.opacity = 0.26 * Math.max(druck1, druck2);
      const w1 = linear(3.46, 3.62, p);
      welle.scale.setScalar(0.13 + w1 * 0.6);
      welle.material.opacity = w1 > 0 && w1 < 1 ? 0.75 * (1 - w1) : 0;
      const r = linear(3.985, 4.07, p);
      riss.visible = r > 0;
      riss.material.uniforms.uRadius.value = aus3(r) * 1.25;
    }
    const k1 = linear(3.5, 3.72, p), kRaus = glatt(3.96, 4.06, p);
    karte.visible = karteSchatten.visible = k1 > 0 && kRaus < 1;
    if (karte.visible) {
      hilf.set(0.12, KNOPF.y, 0.12);
      handy.localToWorld(hilf);
      const ziel = schmal ? hilf2.set(0.42, -0.35, 1.25) : hilf2.set(2.0, 0.42, 0.85);
      const e = aus3(k1);
      karte.position.set(mix(hilf.x, ziel.x, e) + kRaus * 1.6, mix(hilf.y, ziel.y, e) + Math.sin(Math.PI * k1) * 0.35 + kRaus * 2.2, mix(hilf.z, ziel.z, e) + kRaus * 0.6);
      karte.rotation.set(0.06 * e, -0.3 * e, 0.05 * e + kRaus * 0.4);
      karte.scale.setScalar(Math.max(0.001, mix(0.18, 1, zurueck(k1))));
      karte.material.opacity = glatt(0, 0.15, k1) * (1 - kRaus);
      karteSchatten.position.set(karte.position.x + 0.1, karte.position.y - 0.14, karte.position.z - 0.05);
      karteSchatten.rotation.copy(karte.rotation);
      karteSchatten.scale.copy(karte.scale);
      karteSchatten.material.opacity = 0.32 * karte.material.opacity;
    }

    // Kapitel 5: Scherben fliegen zum Bauplatz, das Haus wächst, die Kote zählt
    const sammeln = glatt(5.0, 5.26, p);
    bauplatz.visible = p > 4.1 && sammeln < 0.999;
    if (bauplatz.visible) {
      const da = glatt(4.1, 4.3, p);
      bauSchatten.material.opacity = 0.5 * da;
      boden.material.opacity = 0.09 * da;
      bauplatz.scale.setScalar(BAU.s * (1 - sammeln * 0.985));
      bauplatz.position.set(BAU.pos.x, mix(BAU.pos.y, 0, sammeln), BAU.pos.z);
      bauplatz.rotation.y = BAU.dreh + sammeln * 1.2;
      bauZeit = linear(4.3, 4.86, p);
      haus.setzen(bauZeit, dt);
      const hJetzt = bauZeit < HAUS.rohStart ? HAUS.sockel * linear(0, 0.06, bauZeit)
        : HAUS.sockel + klemme((bauZeit - HAUS.rohStart) / HAUS.rohDauer, 0, 4) * HAUS.geschoss;
      koteLinie.scale.y = Math.max(0.001, hJetzt);
      koteKopf.position.set(KOTE.x + 0.1, hJetzt, KOTE.z);
      const ka = koteAlpha(p);
      koteStoff.opacity = ka;
      koteLinie.visible = koteFuss.visible = koteKopf.visible = ka > 0.001;
      if (koteOben) {
        koteOben.lokal.y = hJetzt + 0.05;
        const text = `+${(hJetzt * HAUS.massstab).toFixed(2)}`;
        if (text !== koteOben.zuletzt) { koteOben.zuletzt = text; koteOben.el.textContent = text; }
      }
    }
    scherben.visible = p >= 4.08 && p < 5.1;
    if (scherben.visible) {
      scherbenStoff.uniforms.uP.value = p;
      const kA = aus3(linear(4.08, 4.28, p));
      bauplatz.updateMatrixWorld();
      bauplatz.getWorldQuaternion(sQZiel);
      scherbenDaten.forEach((s, i) => {
        sE.copy(s.v).multiplyScalar(kA).add(s.mitte);
        sE.y -= kA * kA * 0.35;
        const k2 = linear(s.ankunft - 0.2, s.ankunft, p);
        sQ.setFromAxisAngle(s.achse, kA * s.drall);
        if (k2 > 0) {
          const e = glatt(0, 1, k2);
          sZ.copy(s.ziel);
          bauplatz.localToWorld(sZ);
          sP.lerpVectors(sE, sZ, e);
          sP.y += Math.sin(Math.PI * e) * 0.7;
          sQ2.copy(sQ).slerp(sQZiel, e);
          const weg = 1 - glatt(0.82, 1, k2);
          sS.set(mix(zelleB, 0.42, e), mix(zelleH, 0.07, e), mix(HANDY.tiefe, 0.34, e)).multiplyScalar(Math.max(0.0001, weg) * (1 - sammeln));
          sM.compose(sP, sQ2, sS);
        } else {
          sS.set(zelleB * 0.985, zelleH * 0.985, HANDY.tiefe);
          sM.compose(sE, sQ, sS);
        }
        scherben.setMatrixAt(i, sM);
      });
      scherben.instanceMatrix.needsUpdate = true;
    }

    // Kapitel 6: alles zieht sich zusammen, das leere Gitter entfaltet sich und pulsiert
    leer.visible = p > 5.08;
    if (leer.visible) {
      const g = aus3(linear(5.1, 5.36, p));
      leer.scale.setScalar(mix(0.03, 1, g));
      zeichenLeer = linear(5.12, 5.48, p);
      pulsAn = !ruhig && p > 5.4 && p < 5.9;
      const schlag = pulsAn ? 0.5 + 0.5 * Math.sin(zeit * 2.6) : 1;
      const u = leerLinien.material.uniforms;
      u.uZeichnen.value = zeichenLeer;
      u.uPxWelt.value = pxWelt / Math.max(0.03, leer.scale.x);
      u.uAlpha.value = glatt(5.1, 5.16, p) * (0.72 + 0.28 * schlag);
      const phase = (zeit % 2.4) / 2.4;
      puls.visible = pulsAn;
      puls.scale.setScalar(1.3 + phase * 2.6);
      puls.material.opacity = pulsAn ? (1 - phase) * 0.35 * glatt(5.42, 5.5, p) : 0;
    } else pulsAn = false;
  }

  /* Notizen und Koten auf ihre Orte im Bild setzen */
  const tanHalb = () => Math.tan(camera.fov * Math.PI / 360);
  const wSkala = new THREE.Vector3();
  function labelsSetzen(p) {
    for (const l of labels) {
      const a = l.objekt.visible ? l.alpha(p) : 0;
      if (a < 0.01) {
        if (l.an !== false) { l.el.style.opacity = '0'; l.an = false; }
        continue;
      }
      hilf.copy(l.lokal);
      l.objekt.localToWorld(hilf);
      hilf2.copy(hilf).applyMatrix4(camera.matrixWorldInverse);
      const tiefe = -hilf2.z;
      if (tiefe < 0.1) { l.el.style.opacity = '0'; l.an = false; continue; }
      hilf.project(camera);
      const x = (hilf.x + 1) / 2 * breite, y = (1 - hilf.y) / 2 * hoehe;
      l.objekt.getWorldScale(wSkala);
      const pxLokal = hoehe / (2 * tiefe * tanHalb()) * wSkala.x;
      const s = l.gr * pxLokal / 100;
      const w = klemme(l.schreib(p));
      l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${l.dreh}deg) scale(${s.toFixed(4)})`;
      l.el.style.clipPath = w >= 1 ? 'none' : `inset(-40% ${((1 - w) * 100).toFixed(1)}% -40% -6%)`;
      l.el.style.opacity = (a * (w > 0 ? 1 : 0)).toFixed(3);
      l.an = true;
    }
  }

  function bild(jetzt) {
    laeuft = false;
    if (entsorgt) return;
    const dt = letzte ? Math.min(0.05, (jetzt - letzte) / 1000) : 1 / 60;
    letzte = jetzt;
    zeit += dt;
    pIst += (pZiel - pIst) * (ruhig ? 1 : 1 - Math.exp(-dt / 0.06));
    if (Math.abs(pZiel - pIst) < 0.0002) pIst = pZiel;
    zeiger.lerp(zeigerZiel, ruhig ? 1 : 1 - Math.exp(-dt / 0.3));
    const zeigerRuht = zeiger.distanceTo(zeigerZiel) < 0.001;
    const dP = pIst - pVorher;
    pVorher = pIst;
    aktualisieren(pIst, dt, dP);
    renderer.render(scene, camera);
    labelsSetzen(pIst);
    if (beiBild) beiBild(pIst);
    const hausArbeitet = bauplatz.visible && !haus.ruhig();
    if (aktiv && (pIst !== pZiel || !zeigerRuht || funkenLebendig > 0 || hausArbeitet || pulsAn || (!ruhig && pIst > 2.56 && pIst < 3.12))) anfordern();
    else letzte = 0;
  }
  function anfordern() {
    if (laeuft || entsorgt || !aktiv) return;
    laeuft = true;
    requestAnimationFrame(bild);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    breite = Math.max(1, Math.round(r.width));
    hoehe = Math.max(1, Math.round(r.height));
    renderer.setSize(breite, hoehe, false);
    camera.aspect = breite / hoehe;
    camera.updateProjectionMatrix();
    anfordern();
  }
  resize();

  return {
    setProgress(p) { pZiel = klemme(p, 0, 6); anfordern(); },
    springe(p) { pZiel = pIst = pVorher = klemme(p, 0, 6); anfordern(); },
    setPointer(x, y) { zeigerZiel.set(klemme(x, -1, 1), klemme(y, -1, 1)); anfordern(); },
    setSchmal(s) { if (s !== schmal) { schmal = s; anfordern(); } },
    resize,
    pause() { aktiv = false; },
    resume() { if (!aktiv) { aktiv = true; letzte = 0; anfordern(); } },
    /* Bildpunkt, an dem der Finger tippt (Kapitel 4), für Ring und Risse im DOM */
    punktTipp() {
      hilf.set(kuppe.position.x, kuppe.position.y, kuppe.position.z);
      handy.updateMatrixWorld();
      handy.localToWorld(hilf);
      hilf.project(camera);
      return { x: (hilf.x + 1) / 2 * breite, y: (1 - hilf.y) / 2 * hoehe };
    },
    rechteckLeer() {
      leer.updateMatrixWorld();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]].forEach(([x, y]) => {
        hilf.set(x, y, 0);
        leer.localToWorld(hilf);
        hilf.project(camera);
        const px = (hilf.x + 1) / 2 * breite, py = (1 - hilf.y) / 2 * hoehe;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      });
      return { x0, y0, x1, y1, breite, hoehe };
    },
    zustand() {
      return { p: pIst, ziel: pZiel, aktiv, laeuft, schmal, aufrufe: renderer.info.render.calls, dreiecke: renderer.info.render.triangles, funken: funkenLebendig, video: videoBilder.filter(Boolean).length };
    },
    dispose() {
      entsorgt = true;
      labels.forEach(l => l.el.remove());
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const m = Array.isArray(o.material) ? o.material : [o.material];
          m.forEach(x => { if (x.map) x.map.dispose(); x.dispose(); });
        }
      });
      renderer.dispose();
    },
  };
}
