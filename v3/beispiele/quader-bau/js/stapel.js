/* Kapitel "Rohbau" in 3D: Betonquader stapeln sich beim Scrollen Geschoss für Geschoss zum Haus.
   Jedes Teil hat eine eigene Handlung: Bodenplatte und Wände wachsen aus der Schalung, Deckenplatten
   kommen am Kran und setzen auf, orange Schalung klettert mit, Fenster gleiten ein, am Ende fährt die
   Schalung weg und der Kran schwenkt in Ruhe.
   v3: Die Kamera fliegt durch das Haus. Sie senkt sich ins Erdgeschoss, steigt durch das Treppenloch
   (in jeder Decke fehlt dieselbe Platte) Geschoss für Geschoss nach oben, dreht sich dabei langsam und
   tritt oben aus dem Dach, bevor der Treppenhauskern das Loch schliesst. Gerendert wird nur, solange
   sich etwas bewegt und die Ebene sichtbar ist. */
import * as THREE from 'three';
import { GESCHOSSE, ROH_START, ROH_DAUER, HUELLE_START, UEBERGABE_START } from './ablauf-zeit.js';

const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const aus3 = k => 1 - Math.pow(1 - k, 3);
const glatt = (a, b, x) => { const k = klemmen((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const mix = (a, b, k) => a + (b - a) * k;

/* Masse in Metern, ungefähr ein Mehrfamilienhaus im Massstab 1:3 */
const SOCKEL_H = 0.35;
const GESCHOSS_H = 1.25;
const DECKE_H = 0.24;
const WAND_H = GESCHOSS_H - DECKE_H;
const PFEILER = 0.46;
const BRUESTUNG_H = 0.32;
const DACH_Y = SOCKEL_H + GESCHOSSE * GESCHOSS_H;
const KRAN = { x: -6.1, z: -4.3, hoehe: 7.6, ausleger: 12.6 };
const STAPEL = { x: 3.4, z: -5.4 };
/* Treppenloch: diese Deckenplatte fehlt in jedem Geschoss, der Kern auf dem Dach schliesst es */
const LOCH = { x: -1.05, z: 0 };

const PFEILER_ORTE = [
  [-3.75, 2.25], [-1.25, 2.25], [1.25, 2.25], [3.75, 2.25],
  [3.75, 0], [3.75, -2.25],
  [1.25, -2.25], [-1.25, -2.25], [-3.75, -2.25],
  [-3.75, 0],
];

/* Felder zwischen zwei Pfeilern, in Umlaufrichtung */
const FELDER = PFEILER_ORTE.map((a, i) => {
  const b = PFEILER_ORTE[(i + 1) % PFEILER_ORTE.length];
  const entlangX = Math.abs(a[1] - b[1]) < 0.01;
  const laenge = (entlangX ? Math.abs(a[0] - b[0]) : Math.abs(a[1] - b[1])) - PFEILER;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  // Aussennormale: vom Hauszentrum weg
  const n = entlangX ? [0, Math.sign(mz)] : [Math.sign(mx), 0];
  return { mx, mz, laenge, entlangX, n };
});

/* Box mit Weltmass-UV, damit die Betontextur auf jedem Quader gleich gross erscheint */
function quader(b, h, t, dichte = 0) {
  const g = new THREE.BoxGeometry(b, h, t);
  if (dichte > 0) {
    const uv = g.attributes.uv;
    const masse = [[t, h], [t, h], [b, t], [b, t], [b, h], [b, h]];
    for (let f = 0; f < 6; f++) {
      const ox = (f * 0.37) % 1, oy = (f * 0.61) % 1;
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, ox + uv.getX(k) * masse[f][0] * dichte, oy + uv.getY(k) * masse[f][1] * dichte);
      }
    }
  }
  return g;
}

function leinwand(b, h, malen) {
  const c = document.createElement('canvas');
  c.width = b; c.height = h;
  malen(c.getContext('2d'), b, h);
  return c;
}

function schalungsTextur() {
  const c = leinwand(256, 256, (g, b, h) => {
    g.fillStyle = '#FF6A13'; g.fillRect(0, 0, b, h);
    g.fillStyle = '#D9520A';
    g.fillRect(0, 0, b, 14); g.fillRect(0, h - 14, b, 14); g.fillRect(0, 0, 14, h); g.fillRect(b - 14, 0, 14, h);
    for (let i = 1; i < 4; i++) g.fillRect(0, i * h / 4 - 4, b, 8);
    g.fillRect(b / 2 - 4, 0, 8, h);
    g.fillStyle = '#8F8C86';
    for (let i = 1; i < 4; i++) { g.fillRect(4, i * h / 4 - 9, 18, 18); g.fillRect(b - 22, i * h / 4 - 9, 18, 18); }
    // Betonspritzer
    let s = 7;
    const z = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = 'rgba(205, 200, 192, .45)';
    for (let i = 0; i < 46; i++) { g.beginPath(); g.arc(z() * b, h * 0.55 + z() * h * 0.45, 1 + z() * 4, 0, 6.3); g.fill(); }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* Bauplatz als Plan: Magerbeton mit Achsraster (Strich-Punkt), Achskreisen A bis D und 1 bis 3, Massketten.
   18 x 14 m, 128 px je Meter; Ränder weich auslaufend, damit keine Plattenkante im Raum steht. */
const PLAN = { b: 18, t: 14, px: 128 };
const ACHSEN_X = [['A', -3.75], ['B', -1.25], ['C', 1.25], ['D', 3.75]];
const ACHSEN_Z = [['1', -2.25], ['2', 0], ['3', 2.25]];
function planTextur() {
  const W = PLAN.b * PLAN.px, H = PLAN.t * PLAN.px;
  const X = x => (x + PLAN.b / 2) * PLAN.px, Z = z => (z + PLAN.t / 2) * PLAN.px;
  const c = leinwand(W, H, (g) => {
    g.fillStyle = '#E9E7E2'; g.fillRect(0, 0, W, H);
    let s = 3;
    const z = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = z() < 0.5 ? 'rgba(90, 86, 80, .07)' : 'rgba(255, 255, 255, .10)';
      const r = 1 + z() * 3.2;
      g.fillRect(z() * W, z() * H, r, r);
    }
    // Achslinien
    g.strokeStyle = 'rgba(48, 47, 45, .62)'; g.lineWidth = 3.2; g.setLineDash([34, 12, 5, 12]);
    for (const [, x] of ACHSEN_X) { g.beginPath(); g.moveTo(X(x), Z(-5.6)); g.lineTo(X(x), Z(4.6)); g.stroke(); }
    for (const [, zz] of ACHSEN_Z) { g.beginPath(); g.moveTo(X(-7.6), Z(zz)); g.lineTo(X(6.6), Z(zz)); g.stroke(); }
    g.setLineDash([]);
    // Achskreise vorne und rechts
    const kreis = (x, zz, name) => {
      g.beginPath(); g.arc(X(x), Z(zz), 0.3 * PLAN.px, 0, Math.PI * 2);
      g.fillStyle = '#F4F3F0'; g.fill();
      g.lineWidth = 5; g.strokeStyle = '#2E2D2B'; g.stroke();
      g.fillStyle = '#1C1B1A'; g.font = '800 50px Archivo, Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, X(x), Z(zz) + 2);
    };
    for (const [n, x] of ACHSEN_X) kreis(x, 4.9, n);
    for (const [n, zz] of ACHSEN_Z) kreis(6.9, zz, n);
    // Massketten mit Schrägstrichen
    const mass = (x0, z0, x1, z1, text, quer) => {
      g.strokeStyle = '#2E2D2B'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke();
      g.lineWidth = 5;
      for (const [x, zz] of [[x0, z0], [x1, z1]]) {
        g.beginPath(); g.moveTo(X(x) - 14, Z(zz) + 14); g.lineTo(X(x) + 14, Z(zz) - 14); g.stroke();
      }
      g.save();
      g.translate((X(x0) + X(x1)) / 2, (Z(z0) + Z(z1)) / 2);
      if (quer) g.rotate(-Math.PI / 2);
      g.fillStyle = '#1C1B1A'; g.font = '700 44px Archivo, Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(text, 0, -10);
      g.restore();
    };
    mass(-3.75, 4.15, 3.75, 4.15, '17.70', false);
    mass(-1.25, 4.15, 1.25, 4.15, '', false);
    mass(5.95, -2.25, 5.95, 2.25, '10.62', true);
    // weicher Rand: alles ausserhalb eines unscharfen Rechtecks ausblenden
    const maske = leinwand(W, H, (m) => {
      m.filter = 'blur(60px)'; m.fillStyle = '#000';
      m.fillRect(110, 110, W - 220, H - 220);
    });
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(maske, 0, 0);
    g.globalCompositeOperation = 'source-over';
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function gitterTextur() {
  const c = leinwand(128, 128, (g, b, h) => {
    g.clearRect(0, 0, b, h);
    g.strokeStyle = '#FF6A13';
    g.lineWidth = 14; g.strokeRect(0, 0, b, h);
    g.lineWidth = 9;
    g.beginPath(); g.moveTo(0, h); g.lineTo(b, 0); g.stroke();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export async function starteStapel({ canvas, rahmen, mobil = false, ruhig = false, fehler }) {
  // Kantenglättung nur bis Pixeldichte 2 (darüber glätten die feinen Pixel selbst), keine Hochleistungs-GPU erzwingen
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (fehler) fehler(); }, { once: true });

  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(30, 1, 0.04, 220);

  /* Licht: Morgensonne von rechts vorne, viel Himmel, warmer Rückwurf vom Boden; keine schwarzen Seiten */
  szene.add(new THREE.HemisphereLight(0xf4f2ef, 0xc9c2b8, 1.5));
  szene.add(new THREE.AmbientLight(0xffffff, 0.2));
  const sonne = new THREE.DirectionalLight(0xfff1e2, 2.4);
  sonne.position.set(13, 11, 6);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(mobil ? 1024 : 2048, mobil ? 1024 : 2048);
  Object.assign(sonne.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 2, far: 45 });
  sonne.shadow.bias = -0.0004;
  sonne.shadow.normalBias = 0.025;
  sonne.shadow.radius = 3;
  szene.add(sonne);

  const laden = new THREE.TextureLoader();
  const beton = await laden.loadAsync('/hebel-vorschau/v3/beispiele/quader-bau/bilder/beton-textur.webp');
  beton.colorSpace = THREE.SRGBColorSpace;
  beton.wrapS = beton.wrapT = THREE.RepeatWrapping;
  beton.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;

  const betonStoff = new THREE.MeshStandardMaterial({ map: beton, color: 0xffffff, roughness: 0.92, metalness: 0 });
  const schalungStoff = new THREE.MeshStandardMaterial({ map: schalungsTextur(), roughness: 0.62, metalness: 0.05 });
  const glasStoff = new THREE.MeshStandardMaterial({ color: 0xb4c4cc, roughness: 0.18, metalness: 0.05 });
  const orangeStoff = new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.55 });
  const stahlStoff = new THREE.MeshStandardMaterial({ color: 0x77736d, roughness: 0.5, metalness: 0.3 });
  const gitter = gitterTextur();
  const gitterStoff = new THREE.MeshStandardMaterial({ map: gitter, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 });

  /* Boden und Bauplatz */
  // Boden: nur Schatten, der Raum selbst ist die Fläche des Abschnitts
  const boden = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 64),
    new THREE.ShadowMaterial({ color: 0x2a2826, opacity: 0.14, transparent: true, depthWrite: false })
  );
  boden.rotation.x = -Math.PI / 2;
  boden.receiveShadow = true;
  boden.renderOrder = -1;
  szene.add(boden);

  try { await document.fonts.load('800 50px Archivo'); } catch (e) { /* Ersatzschrift reicht */ }
  const plan = new THREE.Mesh(
    new THREE.PlaneGeometry(PLAN.b, PLAN.t),
    new THREE.MeshStandardMaterial({ map: planTextur(), transparent: true, roughness: 1, metalness: 0 })
  );
  plan.rotation.x = -Math.PI / 2;
  plan.position.y = 0.012;
  plan.receiveShadow = true;
  szene.add(plan);

  // Absteckung: Schnurgerüst in Orange
  const absteckung = new THREE.Group();
  const pflockGeo = quader(0.09, 0.6, 0.09);
  const schnurGeo = new THREE.BoxGeometry(1, 0.025, 0.025);
  const ecken = [[-4.9, 3.4], [4.9, 3.4], [4.9, -3.4], [-4.9, -3.4]];
  ecken.forEach((e, i) => {
    const p = new THREE.Mesh(pflockGeo, orangeStoff); p.position.set(e[0], 0.3, e[1]); p.castShadow = true; absteckung.add(p);
    const f = ecken[(i + 1) % 4];
    const s = new THREE.Mesh(schnurGeo, orangeStoff);
    const lx = f[0] - e[0], lz = f[1] - e[1];
    s.scale.x = Math.hypot(lx, lz);
    s.position.set((e[0] + f[0]) / 2, 0.42, (e[1] + f[1]) / 2);
    s.rotation.y = -Math.atan2(lz, lx);
    absteckung.add(s);
  });
  szene.add(absteckung);

  /* Teile des Hauses als instanzierte Quader */
  const teile = []; // {gruppe, index, art, x, y, z, h, rotY, t0, d, kran}
  const gruppen = [];
  function gruppe(geo, stoff, anzahl) {
    const m = new THREE.InstancedMesh(geo, stoff, anzahl);
    m.castShadow = true; m.receiveShadow = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    szene.add(m);
    const g = { mesh: m, n: 0 };
    gruppen.push(g);
    return g;
  }
  let saat = 11;
  const zufall = () => (saat = (saat * 16807) % 2147483647) / 2147483647;
  const ton = new THREE.Color();
  function teil(g, angaben) {
    const index = g.n++;
    const hell = 0.9 + zufall() * 0.16;
    ton.setRGB(hell, hell * 0.995, hell * 0.985);
    if (g.mesh.material === betonStoff) g.mesh.setColorAt(index, ton);
    teile.push({ g, index, rotY: 0, ...angaben });
  }

  const D = 0.34; // Texturdichte: eine Betontextur auf rund drei Meter
  const sockel = gruppe(quader(2.1, SOCKEL_H, 1.8, D), betonStoff, 12);
  const pfeiler = gruppe(quader(PFEILER, WAND_H, PFEILER, D), betonStoff, GESCHOSSE * 10);
  const bruestungX = gruppe(quader(1, BRUESTUNG_H, 0.3, D), betonStoff, GESCHOSSE * 10);
  const decke = gruppe(quader(2.1, DECKE_H, 1.8, D), betonStoff, GESCHOSSE * 12 + 12);
  const fenster = gruppe(quader(1, 1, 0.05), glasStoff, GESCHOSSE * 10);
  const attika = gruppe(quader(1, 0.36, 0.22, D), betonStoff, 12);
  const kern = gruppe(quader(2.1, 0.95, 1.8, D), betonStoff, 1);

  const kacheln = [];
  for (const z of [-1.8, 0, 1.8]) for (const x of [-3.15, -1.05, 1.05, 3.15]) kacheln.push([x, z]);

  // Phase 1: Bodenplatte wächst Feld für Feld aus der Grube
  kacheln.forEach(([x, z], i) => teil(sockel, { art: 'wachsen', x, y: SOCKEL_H / 2, z, h: SOCKEL_H, t0: 0.045 + i * 0.0095, d: 0.04, kran: true }));

  // Phase 2: Geschosse
  for (let f = 0; f < GESCHOSSE; f++) {
    const fs = ROH_START + f * ROH_DAUER;
    const yb = SOCKEL_H + f * GESCHOSS_H;
    const schritt = 0.05 / 20;
    PFEILER_ORTE.forEach(([x, z], i) => {
      teil(pfeiler, { art: 'wachsen', x, y: yb + WAND_H / 2, z, h: WAND_H, t0: fs + 0.028 + (2 * i) * schritt, d: 0.02, kran: true });
      const fe = FELDER[i];
      teil(bruestungX, {
        art: 'wachsen', x: fe.mx, y: yb + BRUESTUNG_H / 2, z: fe.mz, h: BRUESTUNG_H, sx: fe.laenge,
        rotY: fe.entlangX ? 0 : Math.PI / 2, t0: fs + 0.028 + (2 * i + 1) * schritt, d: 0.02, kran: true,
      });
      const fh = WAND_H - BRUESTUNG_H - 0.05;
      teil(fenster, {
        art: 'gleiten', x: fe.mx - fe.n[0] * 0.06, y: yb + BRUESTUNG_H + fh / 2 + 0.01, z: fe.mz - fe.n[1] * 0.06,
        h: fh, sx: fe.laenge - 0.02, rotY: fe.entlangX ? 0 : Math.PI / 2,
        t0: HUELLE_START + 0.04 + f * 0.024 + i * 0.0014, d: 0.022,
      });
    });
    kacheln.forEach(([x, z], i) => {
      if (Math.abs(x - LOCH.x) < 0.01 && Math.abs(z - LOCH.z) < 0.01) return; // Treppenloch bleibt offen
      teil(decke, {
        art: 'fallen', x, y: yb + WAND_H + DECKE_H / 2, z, h: DECKE_H,
        t0: fs + 0.083 + i * 0.0029, d: 0.016, kran: true, dreh: (i % 2 ? 1 : -1) * 0.5,
      });
    });
  }

  // Phase 3: Dachrand und Treppenhauskern
  const attikaOrte = [];
  for (const x of [-3.15, -1.05, 1.05, 3.15]) attikaOrte.push([x, 2.59, 2.1, 0], [x, -2.59, 2.1, 0]);
  for (const z of [-1.24, 1.24]) attikaOrte.push([4.09, z, 2.26, Math.PI / 2], [-4.09, z, 2.26, Math.PI / 2]);
  attikaOrte.forEach(([x, z, l, r], i) => teil(attika, {
    art: 'wachsen', x, y: DACH_Y + 0.18, z, h: 0.36, sx: l, rotY: r, t0: HUELLE_START + 0.004 + i * 0.0024, d: 0.018, kran: true,
  }));
  teil(kern, { art: 'fallen', x: LOCH.x, y: DACH_Y + 0.475, z: LOCH.z, h: 0.95, t0: HUELLE_START + 0.036, d: 0.03, kran: true, dreh: 0.8 });

  // nur so viele Instanzen zeichnen, wie es Teile gibt (sonst stehen leere Einheitsquader im Ursprung)
  for (const g of gruppen) g.mesh.count = g.n;

  // Kranreihenfolge nach Startzeit
  const kranTeile = teile.filter(t => t.kran).sort((a, b) => a.t0 - b.t0);

  /* Schalung: zehn orange Tafeln, eine je Feld, klettern mit dem Rohbau */
  const tafeln = [];
  const tafelGeo = quader(1, 1.1, 0.07);
  FELDER.forEach((fe, i) => {
    const m = new THREE.Mesh(tafelGeo, schalungStoff);
    m.castShadow = true; m.receiveShadow = true;
    m.scale.x = fe.laenge - 0.06;
    szene.add(m);
    tafeln.push({ m, fe, i });
  });
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qLiegend = new THREE.Quaternion();
  qLiegend.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const tafelZiel = (tafel, f, ziel) => {
    if (f < 0) {
      // liegend auf dem Stapel neben dem Haus
      ziel.p.set(STAPEL.x, 0.05 + tafel.i * 0.08, STAPEL.z + (tafel.i % 2) * 0.05);
      ziel.q.copy(qLiegend);
      return;
    }
    const fe = tafel.fe;
    ziel.p.set(fe.mx + fe.n[0] * 0.36, SOCKEL_H + f * GESCHOSS_H + 0.55, fe.mz + fe.n[1] * 0.36);
    ziel.q.setFromEuler(new THREE.Euler(0, fe.entlangX ? 0 : Math.PI / 2, 0));
  };
  const zielA = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const zielB = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  function tafelnSetzen(t) {
    for (const tafel of tafeln) {
      // Zustand: welches Geschoss, und wie weit unterwegs
      let von = -1, nach = -1, k = 0;
      for (let f = 0; f < GESCHOSSE; f++) {
        const fs = ROH_START + f * ROH_DAUER + tafel.i * 0.0012;
        if (t >= fs) { von = f - 1; nach = f; k = klemmen((t - fs) / 0.026); }
      }
      const runter = HUELLE_START + 0.002 + tafel.i * 0.0032;
      if (t >= runter) { von = GESCHOSSE - 1; nach = -1; k = klemmen((t - runter) / 0.03); }
      tafelZiel(tafel, von, zielA);
      tafelZiel(tafel, nach, zielB);
      const e = aus3(k);
      tafel.m.position.lerpVectors(zielA.p, zielB.p, e);
      tafel.m.position.y += Math.sin(Math.PI * e) * 1.1;
      tafel.m.quaternion.slerpQuaternions(zielA.q, zielB.q, e);
      // Übergabe: der Stapel fährt zum nächsten Bauplatz
      const weg = glatt(UEBERGABE_START + 0.03, 1, t);
      tafel.m.position.x += weg * 9;
      tafel.m.visible = weg < 0.98;
    }
  }

  /* Kran */
  const kran = new THREE.Group();
  kran.position.set(KRAN.x, 0, KRAN.z);
  szene.add(kran);
  const fundament = new THREE.Mesh(quader(1.5, 0.5, 1.5, D), betonStoff);
  fundament.position.y = 0.25; fundament.castShadow = fundament.receiveShadow = true;
  kran.add(fundament);
  const gitterBox = (b, h, t, wieOft) => {
    const g = quader(b, h, t, 1 / wieOft);
    return new THREE.Mesh(g, gitterStoff);
  };
  const mast = gitterBox(0.5, KRAN.hoehe, 0.5, 0.5);
  mast.position.y = KRAN.hoehe / 2; mast.castShadow = true;
  kran.add(mast);
  const dreh = new THREE.Group();
  dreh.position.y = KRAN.hoehe;
  kran.add(dreh);
  const ausleger = gitterBox(KRAN.ausleger, 0.42, 0.42, 0.42);
  ausleger.position.set(KRAN.ausleger / 2, 0.21, 0);
  dreh.add(ausleger);
  const gegen = gitterBox(3.8, 0.42, 0.42, 0.42);
  gegen.position.set(-1.9, 0.21, 0);
  dreh.add(gegen);
  for (let i = 0; i < 2; i++) {
    const gw = new THREE.Mesh(quader(0.62, 0.95, 0.62, D), betonStoff);
    gw.position.set(-3.2 + i * 0.66, -0.3, 0);
    dreh.add(gw);
  }
  const spitze = gitterBox(0.42, 1.7, 0.42, 0.42);
  spitze.position.set(0, 0.42 + 0.85, 0);
  dreh.add(spitze);
  const kabine = new THREE.Mesh(quader(0.7, 0.62, 0.62), orangeStoff);
  kabine.position.set(0.3, -0.36, 0.56); kabine.castShadow = true;
  dreh.add(kabine);
  // Abspannung von der Spitze zu den Enden
  const seilStoff = new THREE.LineBasicMaterial({ color: 0x5b5a56 });
  const abspannung = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 2.1, 0), new THREE.Vector3(KRAN.ausleger * 0.66, 0.42, 0),
    new THREE.Vector3(0, 2.1, 0), new THREE.Vector3(-3.7, 0.42, 0),
  ]);
  dreh.add(new THREE.LineSegments(abspannung, seilStoff));
  const katze = new THREE.Mesh(quader(0.55, 0.18, 0.5), stahlStoff);
  dreh.add(katze);
  const seilGeo = new THREE.BoxGeometry(0.035, 1, 0.035); seilGeo.translate(0, -0.5, 0);
  const seil = new THREE.Mesh(seilGeo, stahlStoff);
  dreh.add(seil);
  const haken = new THREE.Group();
  const flasche = new THREE.Mesh(quader(0.3, 0.26, 0.2), orangeStoff);
  flasche.castShadow = true;
  haken.add(flasche);
  const kuebel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.17, 0.55, 18), stahlStoff);
  kuebel.position.y = -0.55; kuebel.castShadow = true;
  haken.add(kuebel);
  dreh.add(haken);

  const kranIst = { winkel: Math.atan2(-(0 - KRAN.z), 0 - KRAN.x), weite: 6, hakenY: 7.5 };
  const kranSoll = { ...kranIst };
  const ruhe = { winkel: Math.atan2(-(-2 - KRAN.z), 4 - KRAN.x) + 0.75, weite: 4.2, hakenY: KRAN.hoehe - 1.6 };

  /* Haltung je Teil aus der Bauzeit berechnen */
  const hilfe = new THREE.Object3D();
  const leer = new THREE.Matrix4().makeScale(0, 0, 0);
  const posDazu = new THREE.Vector3();
  function teilSetzen(tl, t) {
    const k = klemmen((t - tl.t0) / tl.d);
    const m = tl.g.mesh;
    if (t < tl.t0) { m.setMatrixAt(tl.index, leer); tl.oben = null; return; }
    hilfe.rotation.set(0, tl.rotY, 0);
    hilfe.position.set(tl.x, tl.y, tl.z);
    hilfe.scale.set(tl.sx || 1, 1, 1);
    if (tl.art === 'wachsen') {
      const e = aus3(k);
      hilfe.scale.y = Math.max(0.001, e);
      hilfe.position.y = tl.y - tl.h / 2 * (1 - e);
      tl.oben = tl.y + tl.h / 2 + 1.0;
    } else if (tl.art === 'fallen') {
      const e = aus3(k);
      const hub = (1 - e) * 2.8;
      hilfe.position.y = tl.y + hub;
      hilfe.rotation.y = tl.rotY + (1 - e) * (tl.dreh || 0);
      tl.oben = hilfe.position.y + tl.h / 2 + 0.2;
    } else if (tl.art === 'gleiten') {
      const e = aus3(k);
      hilfe.scale.x = Math.max(0.001, (tl.sx || 1) * e);
      hilfe.scale.y = tl.h;
    }
    hilfe.updateMatrix();
    m.setMatrixAt(tl.index, hilfe.matrix);
  }

  function kranSollSetzen(t) {
    // jüngstes Teil, das gerade gebaut wird
    let aktiv = null;
    for (const tl of kranTeile) {
      if (tl.t0 > t) break;
      if (t - tl.t0 <= tl.d + 0.012) aktiv = tl;
    }
    const weg = glatt(UEBERGABE_START, UEBERGABE_START + 0.07, t);
    if (aktiv && aktiv.oben != null && weg < 0.01) {
      const dx = aktiv.x - KRAN.x, dz = aktiv.z - KRAN.z;
      kranSoll.winkel = Math.atan2(-dz, dx);
      kranSoll.weite = klemmen(Math.hypot(dx, dz), 2, KRAN.ausleger - 0.6);
      kranSoll.hakenY = Math.min(KRAN.hoehe - 0.75, aktiv.oben);
      kuebel.visible = aktiv.art !== 'fallen';
    } else {
      kuebel.visible = true;
      // zwischen den Arbeiten über dem Haus warten, bei der Übergabe in Ruhestellung
      const hoehe = t < ROH_START ? SOCKEL_H : SOCKEL_H + klemmen(Math.floor((t - ROH_START) / ROH_DAUER) + 1, 0, GESCHOSSE) * GESCHOSS_H;
      const warten = { winkel: Math.atan2(-(0.4 - KRAN.z), 0.6 - KRAN.x), weite: Math.hypot(0.6 - KRAN.x, 0.4 - KRAN.z), hakenY: Math.min(KRAN.hoehe - 0.75, hoehe + 2.2) };
      kranSoll.winkel = mix(warten.winkel, ruhe.winkel, weg);
      kranSoll.weite = mix(warten.weite, ruhe.weite, weg);
      kranSoll.hakenY = mix(warten.hakenY, ruhe.hakenY, weg);
    }
  }

  let zeit = 0;
  function kranNachfuehren(dt) {
    const f = 1 - Math.exp(-dt * 5.5);
    let dw = kranSoll.winkel - kranIst.winkel;
    dw = Math.atan2(Math.sin(dw), Math.cos(dw));
    kranIst.winkel += dw * f;
    kranIst.weite += (kranSoll.weite - kranIst.weite) * f;
    kranIst.hakenY += (kranSoll.hakenY - kranIst.hakenY) * f;
    dreh.rotation.y = kranIst.winkel;
    katze.position.set(kranIst.weite, -0.09, 0);
    const pendel = Math.sin(zeit * 1.7) * 0.035 * klemmen(Math.abs(dw) * 6);
    const seilLaenge = Math.max(0.3, -0.18 - (kranIst.hakenY - KRAN.hoehe) - 0.13);
    seil.position.set(kranIst.weite, -0.18, 0);
    seil.scale.y = seilLaenge;
    haken.position.set(kranIst.weite + pendel, kranIst.hakenY - KRAN.hoehe, 0);
    return Math.abs(dw) + Math.abs(kranSoll.weite - kranIst.weite) + Math.abs(kranSoll.hakenY - kranIst.hakenY);
  }

  /* Kamera: Flug durch das Haus.
     Anflug (Kurve) bis ins Erdgeschoss, dann senkrecht im Treppenloch von Geschoss zu Geschoss,
     mit langsamer Drehung, oben aus dem Dach und in einem Bogen zurück auf die Ansicht von aussen. */
  const zeiger = { x: 0, y: 0, zx: 0, zy: 0 };
  let breite = 1, hoehe = 1;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const AUGE = 0.62; // Augenhöhe über dem Boden eines Geschosses (Massstab der Szene)
  const ebeneY = f => SOCKEL_H + f * GESCHOSS_H + AUGE;
  const FLUG_INNEN = ROH_START + 0.085; // ab hier steht die Kamera im Erdgeschoss
  const FLUG_AUS = ROH_START + (GESCHOSSE - 1) * ROH_DAUER + 0.118; // letzte Decke liegt, Kamera steigt aus
  const DREH0 = 0.74; // Blickrichtung im Erdgeschoss: nach vorn rechts
  const drehBei = t => DREH0 - (t - FLUG_INNEN) / ROH_DAUER * 1.2;
  const richtung = (w, neig = 0.04) => V(Math.cos(w), neig, Math.sin(w)).multiplyScalar(3.2);
  const lochPunkt = (y) => V(LOCH.x, y, LOCH.z);

  const innen0 = lochPunkt(ebeneY(0));
  const anflugPos = new THREE.CatmullRomCurve3([
    V(10.5, 6.8, 15.5), V(7.6, 3.8, 10.8), V(3.6, 3.3, 6.0), V(-0.3, 2.35, 1.7), innen0,
  ], false, 'centripetal');
  const anflugZiel = new THREE.CatmullRomCurve3([
    V(0, 0.6, 0), V(-0.2, 0.7, 0), V(-0.9, 0.9, -0.2), V(-1.5, 0.95, -1.2), innen0.clone().add(richtung(DREH0)),
  ], false, 'centripetal');
  const oben = lochPunkt(ebeneY(GESCHOSSE - 1));
  // Austritt mit festen Zeitpunkten: das Loch ist frei, bevor der Kern (HUELLE_START + 0.036) herunterkommt
  const AUSTRITT_ZEITEN = [FLUG_AUS, FLUG_AUS + 0.026, HUELLE_START + 0.045, 0.84, 0.92, 1];
  const austrittPos = new THREE.CatmullRomCurve3([
    oben, lochPunkt(DACH_Y + 1.6), V(2.4, 8.6, 6.2), V(8.6, 7.6, 12.4), V(12.8, 6.9, 16.6), V(14.6, 6.5, 19.4),
  ], false, 'centripetal');
  const austrittZiel = new THREE.CatmullRomCurve3([
    oben.clone().add(richtung(drehBei(FLUG_AUS))), V(0.6, DACH_Y - 0.2, 1.2), V(0.1, 3.6, 0), V(0.3, 3.0, 0), V(0.3, 2.95, 0), V(0.3, 3.0, 0),
  ], false, 'centripetal');
  const sanft = k => k * k * (3 - 2 * k);
  /* Punkt auf einer Kurve, deren Stützpunkte zu festen Zeiten erreicht werden */
  function kurveBei(kurve, zeiten, t, ziel) {
    const n = zeiten.length;
    let k = 0;
    while (k < n - 2 && t > zeiten[k + 1]) k++;
    const lokal = klemmen((t - zeiten[k]) / (zeiten[k + 1] - zeiten[k]));
    return kurve.getPoint((k + lokal) / (n - 1), ziel);
  }
  const pos = V(0, 0, 0), ziel = V(0, 0, 0), hilfsV = V(0, 0, 0);

  function kameraSetzen(t) {
    let fov;
    if (t < FLUG_INNEN) {
      const u = sanft(klemmen(t / FLUG_INNEN));
      anflugPos.getPoint(u, pos);
      anflugZiel.getPoint(u, ziel);
      fov = mix(34, 58, glatt(0.25, 1, u));
    } else if (t < FLUG_AUS) {
      // im Loch: in jedem Geschoss warten, solange gebaut wird, dann eine Ebene höher
      let y = ebeneY(0);
      for (let f = 1; f < GESCHOSSE; f++) {
        const start = ROH_START + (f - 1) * ROH_DAUER + 0.116;
        y = mix(y, ebeneY(f), sanft(klemmen((t - start) / 0.03)));
      }
      pos.copy(lochPunkt(y));
      ziel.copy(pos).add(richtung(drehBei(t)));
      fov = 58;
    } else {
      // Austritt: zuerst steil nach oben, dann im Bogen nach aussen
      kurveBei(austrittPos, AUSTRITT_ZEITEN, t, pos);
      kurveBei(austrittZiel, AUSTRITT_ZEITEN, t, ziel);
      fov = mix(58, 30, glatt(FLUG_AUS + 0.02, 0.86, t));
    }
    // Ansicht von aussen: mobil weiter weg, damit das Haus ins Hochformat passt
    if (mobil) {
      const aussen = 1 - glatt(0.12, 0.26, t) + glatt(FLUG_AUS + 0.03, FLUG_AUS + 0.12, t);
      hilfsV.copy(pos).sub(ziel).multiplyScalar(1 + 0.5 * klemmen(aussen));
      pos.copy(ziel).add(hilfsV);
      fov *= 1.22;
    }
    if (!ruhig) { ziel.x += zeiger.x * 0.35; ziel.y -= zeiger.y * 0.22; }
    if (Math.abs(kamera.fov - fov) > 0.01) { kamera.fov = fov; kamera.updateProjectionMatrix(); }
    kamera.position.copy(pos);
    kamera.lookAt(ziel);
  }

  function groesse() {
    const b = rahmen.clientWidth || 1, h = rahmen.clientHeight || 1;
    if (b === breite && h === hoehe) return;
    breite = b; hoehe = h;
    renderer.setSize(b, h, false);
    kamera.aspect = b / h;
    if (!mobil && b > 900) {
      // Bildmitte etwas nach rechts, links unten steht der Kapiteltext
      kamera.setViewOffset(b, h, -b * 0.11, -h * 0.02, b, h);
    } else if (mobil) {
      // Haus etwas tiefer, die obere Fläche gehört Kopf und Geschossanzeige
      kamera.setViewOffset(b, h, 0, -h * 0.05, b, h);
    } else {
      kamera.clearViewOffset();
    }
    kamera.updateProjectionMatrix();
  }

  /* Takt: nur rendern, solange sich etwas bewegt und die Ebene gezeigt wird */
  let zielZeit = 0, zeigeZeit = 0, imBild = false, gezeigt = true, raf = 0, letzt = 0, erstes = true;
  const laeuft = () => imBild && gezeigt;
  function schritt(jetzt) {
    raf = 0;
    const dt = Math.min(0.05, letzt ? (jetzt - letzt) / 1000 : 0.016);
    letzt = jetzt;
    zeit += dt;
    groesse();
    const f = 1 - Math.exp(-dt * (ruhig ? 14 : 6.5));
    zeigeZeit += (zielZeit - zeigeZeit) * f;
    if (Math.abs(zielZeit - zeigeZeit) < 0.00004) zeigeZeit = zielZeit;
    zeiger.x += (zeiger.zx - zeiger.x) * f;
    zeiger.y += (zeiger.zy - zeiger.y) * f;
    const t = zeigeZeit;

    for (const tl of teile) teilSetzen(tl, t);
    for (const g of gruppen) {
      g.mesh.instanceMatrix.needsUpdate = true;
      if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = erstes;
    }
    tafelnSetzen(t);
    const sicht = 1 - glatt(0.1, 0.2, t);
    absteckung.visible = sicht > 0.01;
    absteckung.scale.y = Math.max(0.01, sicht);
    kranSollSetzen(t);
    const kranRest = kranNachfuehren(dt);
    kameraSetzen(t);
    renderer.render(szene, kamera);
    erstes = false;
    if (!canvas.dataset.bereit) canvas.dataset.bereit = '1';
    canvas.dataset.t = t.toFixed(3);

    const stillstand = zeigeZeit === zielZeit && kranRest < 0.002 && Math.abs(zeiger.zx - zeiger.x) + Math.abs(zeiger.zy - zeiger.y) < 0.002;
    if (!stillstand && laeuft()) raf = requestAnimationFrame(schritt);
    else letzt = 0;
  }
  function anstossen() {
    if (!raf && laeuft()) raf = requestAnimationFrame(schritt);
  }

  const beobachter = new IntersectionObserver(eintraege => {
    imBild = eintraege.some(e => e.isIntersecting);
    anstossen();
  }, { rootMargin: '10% 0px' });
  beobachter.observe(rahmen);
  const groessenWaechter = new ResizeObserver(() => { breite = 0; anstossen(); });
  groessenWaechter.observe(rahmen);

  if (!mobil && !ruhig) {
    window.addEventListener('pointermove', e => {
      if (!laeuft()) return;
      zeiger.zx = (e.clientX / window.innerWidth - 0.5) * 2;
      zeiger.zy = (e.clientY / window.innerHeight - 0.5) * 2;
      anstossen();
    }, { passive: true });
  }

  // Erstes Bild sofort, auch wenn der Abschnitt noch nicht im Blick ist (für Vorschaubilder)
  imBild = true; schritt(performance.now()); imBild = false;

  return {
    setzeZeit(t) {
      zielZeit = klemmen(t);
      anstossen();
    },
    /** Ebene gezeigt oder verdeckt: verdeckt wird nicht gerendert */
    zeigen(an) {
      if (gezeigt === an) return;
      gezeigt = an;
      if (an) { breite = 0; zeigeZeit = zielZeit; anstossen(); }
    },
    zerstoeren() {
      beobachter.disconnect(); groessenWaechter.disconnect();
      if (raf) cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}
