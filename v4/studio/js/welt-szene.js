/* Hebel-Welt: fast weisser Raum, darin schweben Beispiel-Websites als Browser und Handys.
   Grundlage: docs/webstudio-2026-10/09-bau-brief-v2.md, Abschnitt 1, Referenz referenz/hebel-welt.png.

   Schnittstelle (die Seite kennt nur diese):
     const welt = await erstelleWelt(canvas, { schmal, maxDpr, beiBild })
     welt.setProgress(f)      Station als Kommazahl 0 bis 4 (0 Einstieg, 1 Fumo, 2 Quader Bau,
                              3 Ihre Website, 4 Reihe). Die Szene gleitet weich dorthin.
     welt.setPointer(x, y)    Zeiger -1 bis 1, neigt die Szene leicht (nur Desktop)
     welt.setSchmal(bool)     Bildaufbau für Handy oder Desktop
     welt.resize()            Grösse aus dem Canvas übernehmen
     welt.pause(), welt.resume(), welt.dispose(), welt.zustand()
     welt.eintauchen(id)      fliegt in den Bildschirm id, bis er das Bild füllt; Promise, wenn fertig.
                              Die Bildschirmbilder zeigen den echten Einstieg der Beispiele, darum
                              geht danach die echte Seite ohne Bruch auf.
     welt.auftauchen()        zurück aus dem Bildschirm (Rückkehr mit dem Zurück-Knopf)
     welt.messen()            Prüfhilfe: Grösse jedes Bildschirms auf dem Canvas in Gerätepixeln
                              neben der sichtbaren Texturgrösse (Schärfe der Bildschirmbilder)
   beiBild(f) meldet nach jedem gezeichneten Bild die geglättete Station, damit die Texte im DOM
   genau mit dem Bild gehen. Gezeichnet wird nur, solange sich etwas bewegt: Auftritt, Scroll,
   Zeiger oder Schweben. In Station 4 hört das Schweben auf, dann steht die Szene still. */

import * as THREE from 'three';
import { BILDSCHIRME } from './welt-bildschirme.js';
import { baueHaus } from './welt-bau.js';

const FARBE = { grund: 0xf4f4f2, tinte: 0x0b0b0c, kobalt: 0x2340ff, grau: 0xc9cac6 };
const BROWSER = { w: 2.4, h: 1.5, leiste: 0.105, rand: 0.032, r: 0.07, tiefe: 0.045 };
const HANDY = { w: 0.62, h: 1.343, rand: 0.03, r: 0.105, tiefe: 0.075, status: 0.075 };
// status: Statusleiste oben im Handy (47 von 844 Punkten). Die Seite beginnt darunter, wie auf einem
// echten Gerät; die Bildschirmbilder der Handys sind darum 390 x 797 Punkte gross.
const FERN = { w: 2.2, h: 1.4 };
const BODEN = -1.75;

const klemme = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const glatt = (a, b, v) => { const t = klemme((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const sanft = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ausExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const mix = (a, b, t) => a + (b - a) * t;

/* ---------- Posen je Station ----------
   [x, y, z, rx, ry, rz, s]; Kamera { pos, ziel, fov }. Station 4 ist die ruhige Reihe.
   Übergänge durch die Tiefe statt seitwärts: Die Bildschirme der nächsten Station kommen aus dem
   Dunst auf ihrem Sehstrahl heran ('tiefe': Startlage auf der Linie von der Kamera der nächsten
   Station durch die Ziellage, k-mal so weit weg), die der letzten Station fliegen an der Kamera
   vorbei, die Browser nach rechts, die Handys nach unten aus dem Bild, nie über die Texte links. Welche Bildschirme in einem
   Übergang gehen und kommen, steht in ROLLEN; sie bekommen eigene Zeitfenster. */
const T = (station, k = 3.6) => ({ tiefe: station, k });
const POSEN = {
  breit: {
    kamera: [
      { pos: [0.15, 0.2, 9.2], ziel: [0.3, 0.2, 0], fov: 30 },
      { pos: [-2.05, 0.82, 4.15], ziel: [-2.05, 0.82, -0.6], fov: 30 },
      { pos: [0.05, 0.35, 5.25], ziel: [0.05, 0.35, 0], fov: 30 },
      { pos: [0.95, -0.05, 4.5], ziel: [0.95, -0.05, -1.4], fov: 30 },
      { pos: [0, 0.75, 12.6], ziel: [0, 0.75, 0], fov: 30 },
    ],
    objekte: {
      // Station 0 nach referenz/hebel-welt.png: Fumo dunkel oben links, rechte Kante näher;
      // Quader Bau gross vorne rechts der Mitte; Handy ganz vorne rechts; dahinter hell
      // "Ihre Website" links, ein Handy und ferne Seiten oben, unscharf im Dunst.
      'fumo-browser': [
        [-1.22, 1.08, -0.65, 0.12, -0.5, -0.19, 1.2],
        [-1.45, 0.9, -0.6, 0, 0.04, 0, 0.92],
        [3.7, 0.75, 1.8, 0, -0.55, 0, 0.85], // vorbei, rechts aus dem Bild (nie über Text oder Kopf)
        [-2.6, 4.0, 6.6, 0.4, 0.2, 0, 0.9],
        [-2.9, 1.15, -1, 0, 0, 0, 0.82],
      ],
      'fumo-handy': [
        [2.42, -0.34, 2.2, 0.14, -0.42, -0.34, 1.18], // ganz vorne rechts, zeigt die Reservierung wie im Referenzbild
        [-0.85, 0.45, 0.62, 0.05, -0.38, 0.07, 0.6], // rechts vor dem Browser wie im Referenzbild, der Titel der Seite bleibt frei
        [0.6, -2.9, 2.0, -0.45, -0.2, 0, 0.6], // vorbei, unten aus dem Bild
        [-3.2, -2.8, 6.4, -0.3, 0.3, 0, 0.8],
        [-5.1, 1.12, -1, 0, 0, 0, 1.0],
      ],
      'quader-browser': [
        [1.32, 0.28, 0.45, -0.05, 0.33, 0.1, 1.2],
        T(2, 4.2), // hinter Fumo ganz im Dunst
        [0.38, 0.45, 0, 0, 0, 0, 0.85],
        [4.5, 0.2, 1.4, 0, -0.55, 0, 0.8], // vorbei, rechts aus dem Bild
        [2.9, 1.15, -1, 0, 0, 0, 0.82],
      ],
      'quader-handy': [
        [4.75, 1.55, -2.9, 0.06, -0.5, 0.12, 1.05],
        T(2, 5.4),
        [-0.32, -0.08, 1.2, -0.02, 0.3, -0.05, 0.72],
        [1.1, -2.9, 1.6, -0.45, 0.2, 0, 0.7], // vorbei, unten aus dem Bild
        [5.1, 1.12, -1, 0, 0, 0, 1.0],
      ],
      'ihre-website': [
        [-3.42, 0.95, -2.75, 0.08, -0.42, -0.12, 0.95],
        [-12, 2.0, -18, 0, 0.4, 0, 0.9], // ganz im Dunst, damit kein Schemen durchs Bild zieht
        T(3, 3.8),
        [1.3, -0.05, -1.4, 0, 0, 0, 1],
        [0, 1.15, -1, 0, 0, 0, 0.82],
      ],
      'fern-1': [
        [0.75, 2.8, -6.8, 0, -0.12, 0, 1],
        [6.5, 4.5, -9, 0, -0.3, 0, 1],
        [8, 4.5, -9, 0, -0.3, 0, 1],
        [9, 4.5, -10, 0, -0.3, 0, 1],
        [7, 15, -12, 0, 0, 0, 1],
      ],
      'fern-2': [
        [3.45, 2.6, -7.6, 0, -0.32, 0.01, 1],
        [-10.5, 3.5, -9, 0, 0.5, 0, 1],
        [-8, 3.5, -9, 0, 0.45, 0, 1],
        [-8, 3.5, -10, 0, 0.4, 0, 1],
        [-7, 15, -12, 0, 0, 0, 1],
      ],
      'fern-3': [
        [-1.9, 3.35, -9.5, 0, 0.15, 0, 1],
        [-9, -1, -8, 0, 0.5, 0, 1],
        [-9, -1, -8, 0, 0.5, 0, 1],
        [-9, -1, -9, 0, 0.4, 0, 1],
        [0, 16, -12, 0, 0, 0, 1],
      ],
    },
    // Haus von Quader Bau in Station 2: [x, y, z, Drehung, Massstab]
    bau: [3.0, BODEN, -5.4, 2.6, 0.21],
  },
  schmal: {
    kamera: [
      { pos: [0.1, 0.15, 10.6], ziel: [0.1, -0.85, 0], fov: 44 },
      { pos: [-1.35, -0.2, 6.6], ziel: [-1.35, -0.6, -0.6], fov: 44 },
      { pos: [0.45, 0.05, 7.0], ziel: [0.45, -0.35, 0], fov: 44 },
      { pos: [0.6, 0.4, 6.4], ziel: [0.6, 0.0, -1.4], fov: 44 },
      { pos: [0, 1.5, 9.6], ziel: [0, 1.0, 0], fov: 44 },
    ],
    objekte: {
      'fumo-browser': [
        [-0.72, 2.28, -1.5, 0.08, -0.3, -0.1, 0.9],
        [-1.35, 0.82, -0.6, 0, 0, 0, 1],
        [3.4, 0.9, 3.4, 0, -0.55, 0, 0.9],
        [-1.4, 4.6, 7.6, 0.4, 0.2, 0, 0.9],
        [-0.86, 1.95, -1, 0, 0, 0, 0.66],
      ],
      'fumo-handy': [
        [1.2, -0.42, 2.0, 0.12, -0.38, -0.3, 0.92],
        [-0.72, -0.05, 1.0, -0.02, 0.32, -0.06, 0.8],
        [3.0, 0.1, 3.8, 0, -0.55, 0, 0.8], // schmal: seitlich hinaus, unten stehen die Texte
        [-3.2, 0.2, 7.6, 0, 0.5, 0, 0.8], // schmal: kommt von links in die Reihe, nicht durch die Texte unten
        [-1.08, 0.42, -1, 0, 0, 0, 0.8],
      ],
      'quader-browser': [
        [0.38, 0.78, 0.4, -0.05, 0.3, 0.08, 1.0],
        T(2, 4.2),
        [0.2, 0.92, 0, 0, 0.14, 0, 0.62],
        [3.6, 0.9, 3.4, 0, -0.55, 0, 0.62],
        [0.86, 1.95, -1, 0, 0, 0, 0.66],
      ],
      'quader-handy': [
        [-1.0, -0.3, 1.6, 0.08, 0.4, 0.12, 0.88],
        T(2, 5.4),
        [-0.18, 0.12, 1.6, -0.02, 0.28, -0.05, 0.58],
        [3.2, 0.3, 3.6, 0, -0.55, 0, 0.58],
        [1.08, 0.42, -1, 0, 0, 0, 0.8],
      ],
      'ihre-website': [
        [1.6, 3.2, -3.5, 0.02, -0.4, 0.02, 0.62],
        [-8, 2.6, -18, 0, 0.5, 0, 0.9],
        T(3, 3.8),
        [0.6, 0.45, -1.4, 0, 0, 0, 1],
        [0, 0.42, -1, 0, 0, 0, 0.52],
      ],
      'fern-1': [
        [0.6, 6.8, -7, 0, -0.05, 0, 1],
        [6.5, 4.5, -9, 0, -0.3, 0, 1],
        [8, 4.5, -9, 0, -0.3, 0, 1],
        [9, 4.5, -10, 0, -0.3, 0, 1],
        [7, 15, -12, 0, 0, 0, 1],
      ],
      'fern-2': [
        [-6.4, 3.1, -8.4, 0, 0.4, 0.01, 1], // schmal: ausserhalb, sonst ragt ein dunkler Splitter in den Rand
        [-10.5, 3.5, -9, 0, 0.5, 0, 1],
        [-8, 3.5, -9, 0, 0.45, 0, 1],
        [-8, 3.5, -10, 0, 0.4, 0, 1],
        [-7, 15, -12, 0, 0, 0, 1],
      ],
      'fern-3': [
        [3.5, 2.4, -7.4, 0, -0.4, 0, 1],
        [-9, -1, -8, 0, 0.5, 0, 1],
        [-9, -1, -8, 0, 0.5, 0, 1],
        [-9, -1, -9, 0, 0.4, 0, 1],
        [0, 16, -12, 0, 0, 0, 1],
      ],
    },
    bau: [1.35, -1.05, -2.2, -0.55, 0.15],
  },
};

/* Wer in einem Übergang geht und wer kommt (Übergang i führt von Station i zu i + 1).
   Gehende fliegen in der ersten Hälfte beschleunigt hinaus, kommende bremsen aus der Tiefe heran. */
const ROLLEN = {
  1: { geht: ['fumo-browser', 'fumo-handy'], kommt: ['quader-browser', 'quader-handy'] },
  2: { geht: ['quader-browser', 'quader-handy'], kommt: ['ihre-website'] },
};
const FENSTER = { geht: [0, 0.6], kommt: [0.14, 1] };

// 'tiefe'-Einträge auflösen: Startlage auf dem Sehstrahl der Kamera der Zielstation
Object.values(POSEN).forEach(L => {
  Object.values(L.objekte).forEach(liste => {
    liste.forEach((e, i) => {
      if (Array.isArray(e)) return;
      const c = L.kamera[e.tiefe].pos, p = liste[e.tiefe];
      liste[i] = [c[0] + (p[0] - c[0]) * e.k, c[1] + (p[1] - c[1]) * e.k, c[2] + (p[2] - c[2]) * e.k, p[3], p[4], p[5], p[6]];
    });
  });
});

/* ---------- Geometrie ---------- */
function rundRechteck(w, h, r, oben = r, unten = r) {
  // oben und unten: Eckradius der oberen bzw. unteren Ecken (0 = eckig)
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

function flaeche(w, h, r, seg = 10, oben = r, unten = r) {
  const g = new THREE.ShapeGeometry(rundRechteck(w, h, r, oben, unten), seg);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}

function koerper(w, h, r, tiefe) {
  const b = Math.min(0.012, r * 0.35, tiefe * 0.3);
  const g = new THREE.ExtrudeGeometry(rundRechteck(w - 2 * b, h - 2 * b, Math.max(0.004, r - b)), {
    depth: tiefe - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 12,
  });
  g.translate(0, 0, -(tiefe - 2 * b) / 2);
  g.computeVertexNormals();
  return g;
}

function schattenTextur() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(24,24,28,0.5)');
  g.addColorStop(0.4, 'rgba(24,24,28,0.2)');
  g.addColorStop(1, 'rgba(24,24,28,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Glanz auf dem Glas: schwacher heller Verlauf von oben links, wie Licht auf einem Bildschirm */
function glanzTextur() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.07)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Statusleiste eines Handys: Farbe vom oberen Rand des Bildschirmbilds, Uhrzeit links, Akku rechts */
function statusTextur(bild) {
  let farbe = [20, 17, 16];
  try {
    const p = document.createElement('canvas');
    p.width = p.height = 1;
    const px = p.getContext('2d');
    px.drawImage(bild, 0, 0, 8, 4, 0, 0, 1, 1);
    farbe = Array.from(px.getImageData(0, 0, 1, 1).data).slice(0, 3);
  } catch (e) { /* Standardfarbe */ }
  const hell = 0.2126 * farbe[0] + 0.7152 * farbe[1] + 0.0722 * farbe[2] > 150;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 62;
  const x = c.getContext('2d');
  x.fillStyle = `rgb(${farbe.join(',')})`;
  x.fillRect(0, 0, c.width, c.height);
  const tinte = hell ? '#0B0B0C' : '#F4F4F2';
  x.fillStyle = tinte;
  x.strokeStyle = tinte;
  x.font = '600 22px "Archivo Variable", system-ui, sans-serif';
  x.textBaseline = 'middle';
  x.fillText('9:41', 52, 33);
  // Empfang: vier Balken, Akku: Rahmen mit Füllung
  [0, 1, 2, 3].forEach(i => x.fillRect(372 + i * 8, 38 - (i + 1) * 4, 5, (i + 1) * 4));
  x.lineWidth = 2;
  x.globalAlpha = 0.45;
  x.strokeRect(416, 24, 36, 17);
  x.fillRect(454, 29, 3, 7);
  x.globalAlpha = 1;
  x.fillRect(419, 27, 26, 11);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Leere Fläche "Ihre Website": hell, mit Beschriftung, die beim Aufbau verschwindet */
function leerTextur(schriftBereit) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const x = c.getContext('2d');
  x.strokeStyle = '#D9DAD6';
  x.lineWidth = 3;
  x.setLineDash([14, 12]);
  x.strokeRect(70, 60, c.width - 140, c.height - 120);
  x.setLineDash([]);
  x.fillStyle = '#9C9D99';
  x.font = `${schriftBereit ? '700' : '600'} 64px "Archivo Variable", system-ui, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('Ihre Website', c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Bausteine der Bildschirme ---------- */
function bildAusschnitt(tex, schirmAspekt) {
  // Seitenverhältnis des Bildes gegen den Bildschirm: breiter wird seitlich beschnitten,
  // höher zeigt oben den ersten Bildschirm und kann scrollen.
  const img = tex.image;
  const aspekt = img && img.width ? img.width / img.height : schirmAspekt;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  let sichtbar = 1;
  if (aspekt > schirmAspekt) {
    tex.repeat.x = schirmAspekt / aspekt;
    tex.offset.x = (1 - tex.repeat.x) / 2;
  } else {
    sichtbar = aspekt / schirmAspekt; // Anteil der Bildhöhe, der in den Bildschirm passt
    tex.repeat.y = sichtbar;
  }
  tex.offset.y = 1 - sichtbar;
  return sichtbar;
}

function setzeScroll(eintrag, s) {
  const t = eintrag.textur;
  if (!t || eintrag.sichtbar >= 0.999) return;
  t.offset.y = (1 - eintrag.sichtbar) * (1 - klemme(s));
}

function baueBrowser(def, tex, mats) {
  const B = BROWSER;
  const W = B.w + 2 * B.rand, H = B.h + B.leiste + B.rand;
  const g = new THREE.Group();
  const dunkel = def.rahmen === 'dunkel';
  const k = new THREE.Mesh(koerper(W, H, B.r, B.tiefe), dunkel ? mats.rahmenDunkel : mats.rahmenHell);
  g.add(k);
  const vorne = B.tiefe / 2 + 0.002;
  const yLeiste = H / 2 - B.leiste / 2 - 0.004;
  ['punktRot', 'punktGelb', 'punktGruen'].forEach((m, i) => {
    const p = new THREE.Mesh(mats.punktGeo, mats[m]);
    p.position.set(-W / 2 + 0.075 + i * 0.052, yLeiste, vorne);
    g.add(p);
  });
  const feld = new THREE.Mesh(mats.feldGeo, dunkel ? mats.feldDunkel : mats.feldHell);
  feld.position.set(0, yLeiste, vorne);
  g.add(feld);
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  if (!tex) mat.color.set(0xfbfbf9);
  const schirm = new THREE.Mesh(mats.browserSchirm, mat);
  schirm.position.set(0, -H / 2 + B.rand + B.h / 2, vorne + 0.001);
  g.add(schirm);
  if (tex) {
    const glanz = new THREE.Mesh(mats.browserSchirm, mats.glanz);
    glanz.position.copy(schirm.position);
    glanz.position.z += 0.0015;
    glanz.renderOrder = 2;
    g.add(glanz);
  }
  return { gruppe: g, schirm, breite: W, hoehe: H, tiefe: 0.55 };
}

function baueHandy(def, tex, mats) {
  const P = HANDY;
  const W = P.w + 2 * P.rand, H = P.h + 2 * P.rand;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(koerper(W, H, P.r, P.tiefe), mats.handy));
  const vorne = P.tiefe / 2 + 0.002;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  if (!tex) mat.color.set(0xfbfbf9);
  // Die Seite liegt unter der Statusleiste, die Leiste bleibt beim Scrollen stehen
  const schirm = new THREE.Mesh(mats.handyInhalt, mat);
  schirm.position.set(0, -P.status / 2, vorne);
  g.add(schirm);
  const leiste = new THREE.Mesh(mats.handyStatus, new THREE.MeshBasicMaterial({
    map: tex ? statusTextur(tex.image) : null, color: tex ? 0xffffff : 0x141110, toneMapped: false,
  }));
  leiste.position.set(0, P.h / 2 - P.status / 2, vorne);
  g.add(leiste);
  const glanz = new THREE.Mesh(mats.handySchirm, mats.glanz);
  glanz.position.z = vorne + 0.0035;
  glanz.renderOrder = 2;
  g.add(glanz);
  const insel = new THREE.Mesh(mats.inselGeo, mats.insel);
  insel.position.set(0, P.h / 2 - 0.045, vorne + 0.002);
  g.add(insel);
  return { gruppe: g, schirm, breite: W, hoehe: H, tiefe: 0.3 };
}

function baueFern(def, tex, mats) {
  const g = new THREE.Group();
  const rahmen = new THREE.Mesh(mats.fernRahmen, mats.rahmenHell);
  g.add(rahmen);
  // Ferne Bildschirme ohne Nebel, nur leicht aufgehellt: so behalten sie Kontrast und geben dem Raum Tiefe
  const schirm = new THREE.Mesh(mats.fernSchirm, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false, transparent: true, opacity: 0.86 }));
  schirm.position.z = 0.016;
  g.add(schirm);
  return { gruppe: g, schirm, breite: FERN.w, hoehe: FERN.h, tiefe: 0.4 };
}

/* "Ihre Website": Blöcke einer Seite, zuerst als Drahtgitter, dann gefüllt */
function baueAufbau() {
  const g = new THREE.Group();
  const T = FARBE.tinte, K = FARBE.kobalt, G = 0xcfd0cc, B = 0xe2e3df, L = 0xeef0ec;
  // [x, y, w, h, farbe] in Bildschirm-Koordinaten (2.4 x 1.5, Mitte 0)
  const teile = [
    [-0.98, 0.64, 0.24, 0.055, T],
    [0.2, 0.64, 0.13, 0.026, G], [0.42, 0.64, 0.13, 0.026, G], [0.64, 0.64, 0.13, 0.026, G],
    [0.96, 0.64, 0.25, 0.075, K],
    [-0.56, 0.33, 1.02, 0.12, T],
    [-0.66, 0.17, 0.82, 0.12, T],
    [-0.65, 0.01, 0.84, 0.032, G],
    [-0.77, -0.05, 0.6, 0.032, G],
    [-0.9, -0.22, 0.34, 0.095, K],
    [0.6, 0.15, 0.94, 0.78, B],
    [-0.76, -0.53, 0.72, 0.3, L], [0.0, -0.53, 0.72, 0.3, L], [0.76, -0.53, 0.72, 0.3, L],
  ];
  const bloecke = [];
  teile.forEach((t, i) => {
    const [x, y, w, h, c] = t;
    const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, toneMapped: false });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.018), mat);
    const linie = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)),
      new THREE.LineBasicMaterial({ color: FARBE.kobalt, transparent: true, opacity: 0, toneMapped: false })
    );
    linie.position.set(x, y, 0.004);
    g.add(linie);
    g.add(m);
    // Startlage: vor dem Bildschirm, leicht gedreht, je Block anders
    const h1 = Math.sin(i * 12.9898) * 43758.5453, zufall = h1 - Math.floor(h1);
    bloecke.push({
      m, linie, ziel: new THREE.Vector3(x, y, 0.012 + i * 0.0004),
      start: new THREE.Vector3(x * 1.25 + (zufall - 0.5) * 0.6, y * 1.3 + 0.25, 0.9 + zufall * 0.8),
      dreh: (zufall - 0.5) * 0.9,
      t0: 0.12 + (i / teile.length) * 0.55,
    });
  });
  return { gruppe: g, bloecke };
}

/* ---------- Szene ---------- */
export async function erstelleWelt(canvas, optionen = {}) {
  const { maxDpr = 1.5, beiBild = null } = optionen;
  let schmal = !!optionen.schmal;

  // Kantenglättung nur bis Pixeldichte 2 (darüber glätten die feinen Pixel selbst), keine Hochleistungs-GPU erzwingen
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7f7f5, 10, 26); // zwischen Grund und der hellen Mitte des Hintergrunds
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdedcd6, 2.1));
  const sonne = new THREE.DirectionalLight(0xffffff, 1.6);
  sonne.position.set(3, 6, 5);
  scene.add(sonne);

  const anisotropie = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mats = {
    rahmenHell: new THREE.MeshStandardMaterial({ color: 0xf5f5f3, roughness: 0.5, metalness: 0 }),
    rahmenDunkel: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.45, metalness: 0.15 }),
    handy: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.32, metalness: 0.25 }),
    punktRot: new THREE.MeshBasicMaterial({ color: 0xff5f57 }),
    punktGelb: new THREE.MeshBasicMaterial({ color: 0xfebc2e }),
    punktGruen: new THREE.MeshBasicMaterial({ color: 0x28c840 }),
    feldHell: new THREE.MeshBasicMaterial({ color: 0xe6e6e3 }),
    feldDunkel: new THREE.MeshBasicMaterial({ color: 0x2d2d30 }),
    insel: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    glanz: new THREE.MeshBasicMaterial({ map: glanzTextur(), transparent: true, depthWrite: false, toneMapped: false }),
    punktGeo: new THREE.CircleGeometry(0.017, 20),
    feldGeo: flaeche(0.66, 0.046, 0.023),
    browserSchirm: flaeche(BROWSER.w, BROWSER.h, 0.018),
    handySchirm: flaeche(HANDY.w, HANDY.h, HANDY.r - HANDY.rand),
    handyInhalt: flaeche(HANDY.w, HANDY.h - HANDY.status, HANDY.r - HANDY.rand, 10, 0, HANDY.r - HANDY.rand),
    handyStatus: flaeche(HANDY.w, HANDY.status, HANDY.r - HANDY.rand, 10, HANDY.r - HANDY.rand, 0),
    inselGeo: flaeche(0.17, 0.046, 0.023),
    fernSchirm: flaeche(FERN.w, FERN.h, 0.04),
    fernRahmen: flaeche(FERN.w + 0.08, FERN.h + 0.08, 0.07),
  };

  // Texturen laden; fehlt ein Bild, bleibt die Fläche hell statt die Szene zu kippen
  const lader = new THREE.TextureLoader();
  const laden = url => (url ? lader.loadAsync(url).then(t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropie;
    return t;
  }).catch(() => null) : Promise.resolve(null));
  // Schmal (Handy): die kleine Fassung reicht, die Bildschirme erscheinen dort klein
  const [betonTextur, ...texturen] = await Promise.all([
    laden('/hebel-vorschau/v4/beispiele/quader-bau/bilder/beton-textur.webp'),
    ...BILDSCHIRME.map(d => laden(schmal && d.klein ? d.klein : d.bild)),
  ]);

  const welt = new THREE.Group();
  scene.add(welt);
  const schattenTex = schattenTextur();
  const schattenGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const eintraege = new Map();

  BILDSCHIRME.forEach((def, i) => {
    let tex = texturen[i];
    let teil;
    let leer = null;
    if (def.art === 'handy') teil = baueHandy(def, tex, mats);
    else if (def.art === 'fern') teil = baueFern(def, tex, mats);
    else {
      if (!tex && def.bild === null) leer = leerTextur(document.fonts && document.fonts.check('700 64px "Archivo Variable"'));
      teil = baueBrowser(def, tex, mats);
      if (leer) {
        // Beschriftung "Ihre Website" als eigene Schicht, damit sie beim Aufbau ausblenden kann
        const etikett = new THREE.Mesh(mats.browserSchirm, new THREE.MeshBasicMaterial({ map: leer, transparent: true, depthWrite: false, toneMapped: false }));
        etikett.position.copy(teil.schirm.position);
        etikett.position.z += 0.002;
        teil.gruppe.add(etikett);
        teil.etikett = etikett;
      }
    }
    let sichtbar = 1;
    if (tex) {
      const aspekt = def.art === 'handy' ? HANDY.w / (HANDY.h - HANDY.status) : def.art === 'fern' ? FERN.w / FERN.h : BROWSER.w / BROWSER.h;
      sichtbar = bildAusschnitt(tex, aspekt);
    }
    const schatten = new THREE.Mesh(schattenGeo, new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false, opacity: 0.5 }));
    schatten.renderOrder = -1;
    scene.add(schatten);
    welt.add(teil.gruppe);
    const h = Math.sin((i + 1) * 78.233) * 12543.21;
    eintraege.set(def.id, {
      def, ...teil, textur: tex, sichtbar, schatten,
      phase: (h - Math.floor(h)) * Math.PI * 2,
      verzug: [0.05, 0.22, 0.12, 0.3, 0.38, 0.45, 0.5, 0.55][i % 8],
    });
  });

  // Station 2: das Haus von Quader Bau baut sich Geschoss für Geschoss, während man den Text liest
  const haus = baueHaus(THREE, { beton: betonTextur });
  const bauGruppe = haus.gruppe;
  scene.add(bauGruppe);
  let bauZeit = 0;
  const bauSchatten = new THREE.Mesh(schattenGeo, new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false, opacity: 0 }));
  scene.add(bauSchatten);

  const aufbau = baueAufbau();
  const ihre = eintraege.get('ihre-website');
  if (ihre) {
    aufbau.gruppe.position.copy(ihre.schirm.position);
    ihre.gruppe.add(aufbau.gruppe);
  }

  /* ---------- Zustand ---------- */
  let fZiel = 0, fIst = 0, hausArbeitet = false;
  const zeigerZiel = new THREE.Vector2(), zeiger = new THREE.Vector2();
  let zeit = 0, intro = 0, letzte = 0, takt = 0;
  let aktiv = true, laeuft = false, entsorgt = false;
  let breite = 1, hoehe = 1;
  const v = new THREE.Vector3(), w2 = new THREE.Vector3(), q = new THREE.Euler();
  const dummy = new THREE.Object3D();
  const ziel = new THREE.Vector3();
  // Eintauchen in einen Bildschirm (0 normal, 1 Bildschirm füllt das Bild)
  let tauchId = null, tauchWert = 0, tauchZiel = 0, tauchFertig = null;
  const tMitte = new THREE.Vector3(), tNormale = new THREE.Vector3(), tOben = new THREE.Vector3();
  const tQuat = new THREE.Quaternion(), tPos = new THREE.Vector3(), WELT_OBEN = new THREE.Vector3(0, 1, 0);

  function pose(id, f) {
    const liste = POSEN[schmal ? 'schmal' : 'breit'].objekte[id];
    const i = Math.min(3, Math.floor(f));
    const roh = klemme(f - i);
    const rolle = ROLLEN[i];
    let t;
    if (rolle && rolle.geht.includes(id)) {
      // beschleunigt hinaus, an der Kamera vorbei
      const u = klemme((roh - FENSTER.geht[0]) / (FENSTER.geht[1] - FENSTER.geht[0]));
      t = u * u * (2 - u * 0.6) / 1.4;
    } else if (rolle && rolle.kommt.includes(id)) {
      // aus der Tiefe heran, sanft abbremsen
      const u = klemme((roh - FENSTER.kommt[0]) / (FENSTER.kommt[1] - FENSTER.kommt[0]));
      t = 1 - Math.pow(1 - u, 3);
    } else {
      t = sanft(roh);
    }
    const a = liste[i], b = liste[i + 1];
    return a.map((x, k) => mix(x, b[k], t));
  }

  function kamera(f) {
    const liste = POSEN[schmal ? 'schmal' : 'breit'].kamera;
    const i = Math.min(3, Math.floor(f));
    const t = sanft(klemme(f - i));
    const a = liste[i], b = liste[i + 1];
    camera.up.copy(WELT_OBEN);
    camera.position.set(mix(a.pos[0], b.pos[0], t), mix(a.pos[1], b.pos[1], t), mix(a.pos[2], b.pos[2], t));
    ziel.set(mix(a.ziel[0], b.ziel[0], t), mix(a.ziel[1], b.ziel[1], t), mix(a.ziel[2], b.ziel[2], t));
    // Übergänge 1 und 2: die Kamera schiebt kurz nach vorn, als flöge sie durch den Raum
    if (i === 1 || i === 2) {
      const schub = Math.sin(Math.PI * klemme(f - i)) * 0.7;
      const dx = ziel.x - camera.position.x, dy = ziel.y - camera.position.y, dz = ziel.z - camera.position.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      camera.position.x += dx / l * schub; camera.position.y += dy / l * schub; camera.position.z += dz / l * schub;
    }
    const fov = mix(a.fov, b.fov, t);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // Zeiger: kleine Bahn um das Ziel, die Szene neigt sich mit
    camera.position.x += zeiger.x * 0.32;
    camera.position.y += zeiger.y * 0.2;
    camera.lookAt(ziel);
    const d = camera.position.distanceTo(ziel);
    // In der Reihe (Station 4) kein Dunst auf den Bildschirmen, sonst wirken sie milchig
    const klar = glatt(3.3, 3.9, f) * 4;
    scene.fog.near = d + 1.2 + klar;
    scene.fog.far = d + 15 + klar;
  }

  function aktualisieren(dt) {
    const f = fIst;
    kamera(f);
    const schweben = 1 - glatt(3.55, 3.98, f);
    const tauch = sanft(tauchWert);
    const tauchPose = tauchId && tauch > 0 ? pose(tauchId, f) : null;
    eintraege.forEach((e, id) => {
      const p = pose(id, f);
      if (tauchPose && id !== tauchId) {
        // Beim Eintauchen weichen die übrigen Bildschirme zur Seite und nach hinten aus
        const dx = p[0] - tauchPose[0], dy = p[1] - tauchPose[1];
        const l = Math.hypot(dx, dy) || 1;
        p[0] += (dx / l) * tauch * 3.2;
        p[1] += (dy / l) * tauch * 1.6;
        p[2] -= tauch * 1.2;
      }
      // Auftritt: das Standbild zeigt die fertige Szene, darum nur ein sanftes Einschweben
      const a = ausExpo(klemme((intro - e.verzug * 0.6) / 1.0));
      const ruhe = e.def.art === 'fern' ? 0.6 : 1;
      const sy = Math.sin(zeit * 0.7 + e.phase) * 0.055 * schweben * ruhe;
      const sr = Math.sin(zeit * 0.5 + e.phase * 1.3) * 0.014 * schweben * ruhe;
      e.gruppe.position.set(p[0], p[1] + sy - (1 - a) * 0.22, p[2] - (1 - a) * 0.5);
      e.gruppe.rotation.set(p[3] + sr, p[4] + sr * 0.8, p[5] + sr * 0.5);
      const s = p[6] * mix(0.975, 1, a);
      e.gruppe.scale.setScalar(s);
      // Ganz im Dunst: ausblenden. Der Grund hinter dem Canvas ist heller als der Nebel, ein voll
      // vernebelter Bildschirm stünde sonst als blasses Rechteck im Raum.
      e.gruppe.visible = s > 0.002 && camera.position.distanceTo(e.gruppe.position) < scene.fog.far + 0.6;
      // Kontaktschatten am Boden, weicher und heller, je höher der Bildschirm schwebt
      const hoeheUeber = e.gruppe.position.y - BODEN;
      e.schatten.position.set(e.gruppe.position.x, BODEN, e.gruppe.position.z + 0.15);
      e.schatten.rotation.y = e.gruppe.rotation.y;
      e.schatten.scale.set(e.breite * s * 1.15, 1, e.tiefe * s * 2 + hoeheUeber * 0.25);
      // In der Reihe schweben die Bildschirme hoch über dem Boden: dort keine Schatten, sie lägen neben dem Text
      e.schatten.material.opacity = klemme(0.62 - hoeheUeber * 0.14, 0.06, 0.55) * (e.def.art === 'fern' ? 0.4 : 1) * (1 - glatt(3.2, 3.7, f));
    });

    // Station 2: das Fumo-Handy scrollt zur Reservierung. Station 3: Quader-Handy zur Offerte.
    // Beim Eintauchen scrollt der Zielbildschirm zurück an den Anfang, wo die echte Seite aufgeht.
    const scroll = (id, wert) => {
      const e = eintraege.get(id);
      if (e) setzeScroll(e, wert * (id === tauchId ? 1 - tauch : 1));
    };
    // Das Fumo-Handy steht schon im Einstieg auf der Reservierung (Kalender vorne wie im Referenzbild)
    scroll('fumo-handy', eintraege.get('fumo-handy')?.def.scrollZiel ?? 1);
    scroll('fumo-browser', glatt(0.5, 1, f) * (eintraege.get('fumo-browser')?.def.scrollZiel ?? 0));
    scroll('quader-handy', glatt(1.5, 1.95, f) * (eintraege.get('quader-handy')?.def.scrollZiel ?? 1));
    scroll('quader-browser', glatt(1.5, 2, f) * (eintraege.get('quader-browser')?.def.scrollZiel ?? 0));
    mats.glanz.opacity = 1 - tauch;
    if (tauchPose) tauchKamera(tauch);

    // Station 2: das Haus baut sich, sobald Quader Bau vorn steht (auch während man liest),
    // beim Zurückscrollen baut es sich schnell zurück. Beim Weiterziehen fliegt es mit dem
    // Bau-Browser rechts an der Kamera vorbei.
    const L = POSEN[schmal ? 'schmal' : 'breit'];
    const bauZiel = f >= 1.72 ? 1 : 0;
    if (bauZeit !== bauZiel) {
      bauZeit = bauZiel > bauZeit ? Math.min(1, bauZeit + dt / 5.2) : Math.max(0, bauZeit - dt / 0.9);
    }
    const weg = glatt(2.02, 2.62, f);
    const kommt = 1 - Math.pow(1 - glatt(1.15, 1.95, f), 3);
    bauGruppe.position.set(L.bau[0] + weg * 4.6, L.bau[1] - (1 - kommt) * 0.6, L.bau[2] + weg * 5.2 - (1 - kommt) * 3);
    bauGruppe.visible = f > 1.15 && weg < 0.999;
    bauGruppe.rotation.y = L.bau[3] || 0;
    bauGruppe.scale.setScalar(L.bau[4] || 0.25);
    if (bauGruppe.visible) haus.setzen(bauZeit, dt);
    bauSchatten.position.set(bauGruppe.position.x, bauGruppe.position.y + 0.004, bauGruppe.position.z);
    bauSchatten.rotation.y = bauGruppe.rotation.y;
    bauSchatten.scale.set(haus.flaeche[0] * L.bau[4], 1, haus.flaeche[1] * L.bau[4]);
    bauSchatten.material.opacity = 0.55 * kommt * (1 - weg);
    hausArbeitet = bauGruppe.visible && (bauZeit !== bauZiel || !haus.ruhig());

    // Station 4: "Ihre Website" baut sich auf, Drahtgitter zu gefüllten Flächen
    const bauen = glatt(2.3, 3.0, f);
    aufbau.bloecke.forEach(b => {
      const lin = glatt(0, 0.2, bauen) * (1 - glatt(0.75, 1, bauen));
      b.linie.material.opacity = lin * 0.9;
      b.linie.visible = lin > 0.01;
      const t = ausExpo(klemme((bauen - b.t0) / 0.3));
      b.m.material.opacity = t;
      b.m.visible = t > 0.01;
      b.m.position.lerpVectors(b.start, b.ziel, t);
      b.m.rotation.set(0, (1 - t) * b.dreh, (1 - t) * b.dreh * 0.5);
    });
    if (ihre && ihre.etikett) {
      const o = 1 - glatt(0.04, 0.3, bauen);
      ihre.etikett.material.opacity = o;
      ihre.etikett.visible = o > 0.01;
    }
  }

  /* Kamera vor den Zielbildschirm: frontal, so nah, dass der Bildschirm das Bild ganz füllt */
  function tauchKamera(t) {
    const e = eintraege.get(tauchId);
    e.gruppe.updateMatrixWorld(true);
    e.schirm.getWorldPosition(tMitte);
    e.schirm.getWorldQuaternion(tQuat);
    tNormale.set(0, 0, 1).applyQuaternion(tQuat);
    tOben.set(0, 1, 0).applyQuaternion(tQuat);
    const s = e.gruppe.scale.x;
    const handy = e.def.art === 'handy';
    const w = (handy ? HANDY.w : BROWSER.w) * s;
    const h = (handy ? HANDY.h - HANDY.status : BROWSER.h) * s;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const d = Math.min(h / 2 / tan, w / 2 / (tan * camera.aspect)) * 0.985;
    tPos.copy(tMitte).addScaledVector(tNormale, d);
    camera.position.lerp(tPos, t);
    ziel.lerp(tMitte, t);
    camera.up.lerp(tOben, t).normalize();
    camera.lookAt(ziel);
    const abstand = camera.position.distanceTo(ziel);
    scene.fog.near = abstand + 1.2;
    scene.fog.far = abstand + 15;
  }

  function bild(jetzt) {
    laeuft = false;
    if (entsorgt) return;
    const dt = letzte ? Math.min(0.05, (jetzt - letzte) / 1000) : 1 / 60;
    letzte = jetzt;
    zeit += dt;
    intro = Math.min(1.6, intro + dt / 1.5);
    const k = 1 - Math.exp(-dt / 0.14);
    fIst += (fZiel - fIst) * k;
    if (Math.abs(fZiel - fIst) < 0.0004) fIst = fZiel;
    zeiger.lerp(zeigerZiel, 1 - Math.exp(-dt / 0.25));
    const zeigerRuht = zeiger.distanceTo(zeigerZiel) < 0.001;
    if (tauchWert !== tauchZiel) {
      // Eintauchen in 0.95 s, Auftauchen in 1.1 s, gleichmässig; die Kurve macht sanft()
      tauchWert = tauchZiel > tauchWert ? Math.min(1, tauchWert + dt / 0.95) : Math.max(0, tauchWert - dt / 1.1);
      if (tauchWert === 0) tauchId = null;
    }
    const taucht = tauchWert !== tauchZiel;
    // Schwebt nur noch etwas, reichen 30 Bilder pro Sekunde
    takt++;
    const nurSchweben = intro >= 1.6 && fIst === fZiel && zeigerRuht && !taucht && !hausArbeitet;
    if (nurSchweben && takt % 2 === 1 && aktiv) { laeuft = true; requestAnimationFrame(bild); return; }
    aktualisieren(dt);
    renderer.render(scene, camera);
    if (beiBild) beiBild(fIst);
    if (tauchFertig && tauchWert >= 1) { const f = tauchFertig; tauchFertig = null; f(); }
    const schwebt = fIst < 3.97;
    if (aktiv && (intro < 1.6 || fIst !== fZiel || !zeigerRuht || schwebt || taucht || hausArbeitet)) anfordern();
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
    setProgress(f) { fZiel = klemme(f, 0, 4); anfordern(); },
    springe(f, mitAuftritt = false) { fZiel = fIst = klemme(f, 0, 4); if (!mitAuftritt) intro = 1.6; anfordern(); },
    eintauchen(id) {
      if (!eintraege.has(id)) return Promise.resolve();
      tauchId = id;
      tauchZiel = 1;
      anfordern();
      return new Promise(fertig => { tauchFertig = fertig; });
    },
    auftauchen() { if (tauchWert > 0) { tauchZiel = 0; letzte = 0; anfordern(); } },
    setPointer(x, y) { zeigerZiel.set(klemme(x, -1, 1), klemme(y, -1, 1)); anfordern(); },
    setSchmal(s) { if (s !== schmal) { schmal = s; anfordern(); } },
    resize,
    pause() { aktiv = false; },
    resume() { if (!aktiv) { aktiv = true; letzte = 0; anfordern(); } },
    zustand() {
      return { f: fIst, ziel: fZiel, aktiv, laeuft, schmal, aufrufe: renderer.info.render.calls, dreiecke: renderer.info.render.triangles };
    },
    messen() {
      const pr = renderer.getPixelRatio();
      const p = new THREE.Vector3();
      const liste = [];
      eintraege.forEach((e, id) => {
        if (!e.textur || !e.gruppe.visible) return;
        const g = e.schirm.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const bb = g.boundingBox;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, vorne = true;
        [[bb.min.x, bb.min.y], [bb.max.x, bb.min.y], [bb.min.x, bb.max.y], [bb.max.x, bb.max.y]].forEach(([x, y]) => {
          p.set(x, y, 0);
          e.schirm.localToWorld(p);
          p.project(camera);
          if (p.z > 1) vorne = false;
          x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
        });
        const img = e.textur.image;
        liste.push({
          id,
          sichtbarImBild: vorne && x1 > -1 && x0 < 1 && y1 > -1 && y0 < 1,
          schirmPx: [Math.round((x1 - x0) / 2 * breite * pr), Math.round((y1 - y0) / 2 * hoehe * pr)],
          texturPx: [Math.round(img.width * e.textur.repeat.x), Math.round(img.height * e.sichtbar)],
          anisotropie: e.textur.anisotropy,
          mipmaps: e.textur.generateMipmaps,
        });
      });
      return { pixeldichte: pr, liste };
    },
    dispose() {
      entsorgt = true;
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
