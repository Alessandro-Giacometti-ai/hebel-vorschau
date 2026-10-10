/* Quader Bau im Kleinen für die Hebel-Welt (Station 2): ein Haus wächst Geschoss für Geschoss.
   Vorbild ist das Haus der Beispielseite (beispiele/quader-bau/js/stapel.js), hier vereinfacht:
   Bodenplatte und Pfeiler wachsen aus der Schalung, Deckenplatten kommen am Kran und setzen auf,
   orange Schalungstafeln klettern mit, am Ende gleiten die Fenster ein und die Schalung fährt weg.
   Masse in Metern wie dort (Massstab 1:3); die Welt skaliert die Gruppe.

   const haus = baueHaus(THREE, { beton })   beton: Textur oder null (dann Betongrau)
   haus.gruppe        THREE.Group, Boden bei y = 0, Mitte des Hauses bei x = z = 0
   haus.setzen(t, dt) Bauzeit 0 (leerer Platz) bis 1 (fertig, Kran in Ruhe); dt für den Kran
   haus.ruhig()       true, wenn der Kran sein Ziel erreicht hat */

const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const aus3 = k => 1 - Math.pow(1 - k, 3);
const mix = (a, b, k) => a + (b - a) * k;

const GESCHOSSE = 4;
const SOCKEL_H = 0.35;
const GESCHOSS_H = 1.25;
const DECKE_H = 0.24;
const WAND_H = GESCHOSS_H - DECKE_H;
const PFEILER = 0.46;
const BRUESTUNG_H = 0.32;
const DACH_Y = SOCKEL_H + GESCHOSSE * GESCHOSS_H;
const KRAN = { x: -5.6, z: -2.4, hoehe: 7.6, ausleger: 7.6 };
const STAPEL = { x: 5.4, z: 1.2 };

// Bauzeit: Bodenplatte, vier Geschosse, Hülle, Übergabe
const ROH_START = 0.12;
const ROH_DAUER = 0.165;
const HUELLE_START = ROH_START + GESCHOSSE * ROH_DAUER; // 0.78
const UEBERGABE_START = 0.93;

const PFEILER_ORTE = [
  [-3.75, 2.25], [-1.25, 2.25], [1.25, 2.25], [3.75, 2.25],
  [3.75, 0], [3.75, -2.25],
  [1.25, -2.25], [-1.25, -2.25], [-3.75, -2.25],
  [-3.75, 0],
];
const FELDER = PFEILER_ORTE.map((a, i) => {
  const b = PFEILER_ORTE[(i + 1) % PFEILER_ORTE.length];
  const entlangX = Math.abs(a[1] - b[1]) < 0.01;
  const laenge = (entlangX ? Math.abs(a[0] - b[0]) : Math.abs(a[1] - b[1])) - PFEILER;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  const n = entlangX ? [0, Math.sign(mz)] : [Math.sign(mx), 0];
  return { mx, mz, laenge, entlangX, n };
});

function leinwand(b, h, malen) {
  const c = document.createElement('canvas');
  c.width = b; c.height = h;
  malen(c.getContext('2d'), b, h);
  return c;
}

export function baueHaus(THREE, { beton = null } = {}) {
  /* Box mit Weltmass-UV, damit die Betontextur auf jedem Quader gleich gross erscheint */
  const quader = (b, h, t, dichte = 0) => {
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
  };
  const textur = c => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  if (beton) { beton.wrapS = beton.wrapT = THREE.RepeatWrapping; }
  const betonStoff = new THREE.MeshStandardMaterial({ map: beton, color: beton ? 0xe9e7e2 : 0xc6c4bf, roughness: 0.92, metalness: 0 });
  const schalungStoff = new THREE.MeshStandardMaterial({
    map: textur(leinwand(128, 128, (g, b, h) => {
      g.fillStyle = '#FF6A13'; g.fillRect(0, 0, b, h);
      g.fillStyle = '#D9520A';
      g.fillRect(0, 0, b, 7); g.fillRect(0, h - 7, b, 7); g.fillRect(0, 0, 7, h); g.fillRect(b - 7, 0, 7, h);
      for (let i = 1; i < 4; i++) g.fillRect(0, i * h / 4 - 2, b, 4);
      g.fillRect(b / 2 - 2, 0, 4, h);
    })),
    roughness: 0.62,
  });
  const glasStoff = new THREE.MeshStandardMaterial({ color: 0x9fb2bc, roughness: 0.2, metalness: 0.1 });
  const orangeStoff = new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.55 });
  const stahlStoff = new THREE.MeshStandardMaterial({ color: 0x6f6b66, roughness: 0.5, metalness: 0.3 });
  const gitter = textur(leinwand(64, 64, (g, b, h) => {
    g.clearRect(0, 0, b, h);
    g.strokeStyle = '#FF6A13';
    g.lineWidth = 8; g.strokeRect(0, 0, b, h);
    g.lineWidth = 6; g.beginPath(); g.moveTo(0, h); g.lineTo(b, 0); g.stroke();
  }));
  gitter.wrapS = gitter.wrapT = THREE.RepeatWrapping;
  const gitterStoff = new THREE.MeshStandardMaterial({ map: gitter, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 });

  const gruppe = new THREE.Group();

  /* Teile als instanzierte Quader */
  const teile = [];
  const gruppen = [];
  const sammlung = (geo, stoff, anzahl) => {
    const m = new THREE.InstancedMesh(geo, stoff, anzahl);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    gruppe.add(m);
    const g = { mesh: m, n: 0 };
    gruppen.push(g);
    return g;
  };
  let saat = 11;
  const zufall = () => (saat = (saat * 16807) % 2147483647) / 2147483647;
  const ton = new THREE.Color();
  const teil = (g, angaben) => {
    const index = g.n++;
    if (g.mesh.material === betonStoff) {
      const hell = 0.9 + zufall() * 0.14;
      ton.setRGB(hell, hell * 0.995, hell * 0.985);
      g.mesh.setColorAt(index, ton);
    }
    teile.push({ g, index, rotY: 0, ...angaben });
  };

  const D = 0.34;
  const sockel = sammlung(quader(2.1, SOCKEL_H, 1.8, D), betonStoff, 12);
  const pfeiler = sammlung(quader(PFEILER, WAND_H, PFEILER, D), betonStoff, GESCHOSSE * 10);
  const bruestung = sammlung(quader(1, BRUESTUNG_H, 0.3, D), betonStoff, GESCHOSSE * 10);
  const decke = sammlung(quader(2.1, DECKE_H, 1.8, D), betonStoff, GESCHOSSE * 12);
  const fenster = sammlung(quader(1, 1, 0.05), glasStoff, GESCHOSSE * 10);
  const attika = sammlung(quader(1, 0.36, 0.22, D), betonStoff, 12);
  const kern = sammlung(quader(1.9, 0.95, 1.6, D), betonStoff, 1);

  const kacheln = [];
  for (const z of [-1.8, 0, 1.8]) for (const x of [-3.15, -1.05, 1.05, 3.15]) kacheln.push([x, z]);

  kacheln.forEach(([x, z], i) => teil(sockel, { art: 'wachsen', x, y: SOCKEL_H / 2, z, h: SOCKEL_H, t0: 0.01 + i * 0.006, d: 0.04, kran: true }));
  for (let f = 0; f < GESCHOSSE; f++) {
    const fs = ROH_START + f * ROH_DAUER;
    const yb = SOCKEL_H + f * GESCHOSS_H;
    PFEILER_ORTE.forEach(([x, z], i) => {
      teil(pfeiler, { art: 'wachsen', x, y: yb + WAND_H / 2, z, h: WAND_H, t0: fs + 0.02 + i * 0.0045, d: 0.03, kran: true });
      const fe = FELDER[i];
      teil(bruestung, {
        art: 'wachsen', x: fe.mx, y: yb + BRUESTUNG_H / 2, z: fe.mz, h: BRUESTUNG_H, sx: fe.laenge,
        rotY: fe.entlangX ? 0 : Math.PI / 2, t0: fs + 0.03 + i * 0.0045, d: 0.03,
      });
      const fh = WAND_H - BRUESTUNG_H - 0.05;
      teil(fenster, {
        art: 'gleiten', x: fe.mx - fe.n[0] * 0.06, y: yb + BRUESTUNG_H + fh / 2 + 0.01, z: fe.mz - fe.n[1] * 0.06,
        h: fh, sx: fe.laenge - 0.02, rotY: fe.entlangX ? 0 : Math.PI / 2,
        t0: HUELLE_START + 0.02 + f * 0.022 + i * 0.0016, d: 0.025,
      });
    });
    kacheln.forEach(([x, z], i) => teil(decke, {
      art: 'fallen', x, y: yb + WAND_H + DECKE_H / 2, z, h: DECKE_H,
      t0: fs + 0.085 + i * 0.0055, d: 0.022, kran: true, dreh: (i % 2 ? 1 : -1) * 0.5,
    }));
  }
  const attikaOrte = [];
  for (const x of [-3.15, -1.05, 1.05, 3.15]) attikaOrte.push([x, 2.59, 2.1, 0], [x, -2.59, 2.1, 0]);
  for (const z of [-1.24, 1.24]) attikaOrte.push([4.09, z, 2.26, Math.PI / 2], [-4.09, z, 2.26, Math.PI / 2]);
  attikaOrte.forEach(([x, z, l, r], i) => teil(attika, {
    art: 'wachsen', x, y: DACH_Y + 0.18, z, h: 0.36, sx: l, rotY: r, t0: HUELLE_START + 0.004 + i * 0.003, d: 0.025,
  }));
  teil(kern, { art: 'fallen', x: -1.3, y: DACH_Y + 0.475, z: -0.5, h: 0.95, t0: HUELLE_START + 0.05, d: 0.03, kran: true, dreh: 0.8 });
  gruppen.forEach(g => { if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true; });
  const kranTeile = teile.filter(t => t.kran).sort((a, b) => a.t0 - b.t0);

  /* Schalung: zehn orange Tafeln, eine je Feld, klettern mit dem Rohbau und fahren am Ende weg */
  const tafeln = FELDER.map((fe, i) => {
    const m = new THREE.Mesh(quader(1, 1.1, 0.07), schalungStoff);
    m.scale.x = fe.laenge - 0.06;
    gruppe.add(m);
    return { m, fe, i };
  });
  const qLiegend = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const zielA = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const zielB = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const tafelZiel = (tafel, f, ziel) => {
    if (f < 0) {
      ziel.p.set(STAPEL.x, 0.05 + tafel.i * 0.08, STAPEL.z + (tafel.i % 2) * 0.05);
      ziel.q.copy(qLiegend);
      return;
    }
    const fe = tafel.fe;
    ziel.p.set(fe.mx + fe.n[0] * 0.36, SOCKEL_H + f * GESCHOSS_H + 0.55, fe.mz + fe.n[1] * 0.36);
    ziel.q.setFromEuler(new THREE.Euler(0, fe.entlangX ? 0 : Math.PI / 2, 0));
  };
  function tafelnSetzen(t) {
    for (const tafel of tafeln) {
      let von = -1, nach = -1, k = 0;
      for (let f = 0; f < GESCHOSSE; f++) {
        const fs = ROH_START + f * ROH_DAUER + tafel.i * 0.0015;
        if (t >= fs) { von = f - 1; nach = f; k = klemmen((t - fs) / 0.03); }
      }
      const runter = UEBERGABE_START - 0.02 + tafel.i * 0.003;
      if (t >= runter) { von = GESCHOSSE - 1; nach = -1; k = klemmen((t - runter) / 0.03); }
      tafelZiel(tafel, von, zielA);
      tafelZiel(tafel, nach, zielB);
      const e = aus3(k);
      tafel.m.position.lerpVectors(zielA.p, zielB.p, e);
      tafel.m.position.y += Math.sin(Math.PI * e) * 1.1;
      tafel.m.quaternion.slerpQuaternions(zielA.q, zielB.q, e);
    }
  }

  /* Kran: Gittermast, Ausleger mit Gegengewicht, Kabine, Katze, Seil und Haken mit Kübel */
  const kran = new THREE.Group();
  kran.position.set(KRAN.x, 0, KRAN.z);
  gruppe.add(kran);
  const fundament = new THREE.Mesh(quader(1.5, 0.5, 1.5, D), betonStoff);
  fundament.position.y = 0.25;
  kran.add(fundament);
  const gitterBox = (b, h, t, wieOft) => new THREE.Mesh(quader(b, h, t, 1 / wieOft), gitterStoff);
  const mast = gitterBox(0.5, KRAN.hoehe, 0.5, 0.5);
  mast.position.y = KRAN.hoehe / 2;
  kran.add(mast);
  const dreh = new THREE.Group();
  dreh.position.y = KRAN.hoehe;
  kran.add(dreh);
  const ausleger = gitterBox(KRAN.ausleger, 0.42, 0.42, 0.42);
  ausleger.position.set(KRAN.ausleger / 2, 0.21, 0);
  dreh.add(ausleger);
  const gegen = gitterBox(3.2, 0.42, 0.42, 0.42);
  gegen.position.set(-1.6, 0.21, 0);
  dreh.add(gegen);
  const gewicht = new THREE.Mesh(quader(1.2, 0.95, 0.62, D), betonStoff);
  gewicht.position.set(-2.6, -0.3, 0);
  dreh.add(gewicht);
  const spitze = gitterBox(0.42, 1.6, 0.42, 0.42);
  spitze.position.set(0, 0.42 + 0.8, 0);
  dreh.add(spitze);
  const kabine = new THREE.Mesh(quader(0.7, 0.62, 0.62), orangeStoff);
  kabine.position.set(0.3, -0.36, 0.56);
  dreh.add(kabine);
  dreh.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 2.0, 0), new THREE.Vector3(KRAN.ausleger * 0.7, 0.42, 0),
      new THREE.Vector3(0, 2.0, 0), new THREE.Vector3(-3.1, 0.42, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0x5b5a56 })
  ));
  const katze = new THREE.Mesh(quader(0.55, 0.18, 0.5), stahlStoff);
  dreh.add(katze);
  const seilGeo = new THREE.BoxGeometry(0.05, 1, 0.05);
  seilGeo.translate(0, -0.5, 0);
  const seil = new THREE.Mesh(seilGeo, stahlStoff);
  dreh.add(seil);
  const haken = new THREE.Group();
  haken.add(new THREE.Mesh(quader(0.3, 0.26, 0.2), orangeStoff));
  const kuebel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.17, 0.55, 14), stahlStoff);
  kuebel.position.y = -0.55;
  haken.add(kuebel);
  dreh.add(haken);

  const ruhe = { winkel: Math.atan2(-(-1.5 - KRAN.z), 3.2 - KRAN.x) + 0.8, weite: 4.2, hakenY: KRAN.hoehe - 1.6 };
  const kranIst = { ...ruhe };
  const kranSoll = { ...ruhe };
  let zeit = 0, rest = 0;

  const hilfe = new THREE.Object3D();
  const leer = new THREE.Matrix4().makeScale(0, 0, 0);
  function teilSetzen(tl, t) {
    const k = klemmen((t - tl.t0) / tl.d);
    const m = tl.g.mesh;
    if (t < tl.t0) { m.setMatrixAt(tl.index, leer); tl.oben = null; return; }
    hilfe.rotation.set(0, tl.rotY, 0);
    hilfe.position.set(tl.x, tl.y, tl.z);
    hilfe.scale.set(tl.sx || 1, 1, 1);
    const e = aus3(k);
    if (tl.art === 'wachsen') {
      hilfe.scale.y = Math.max(0.001, e);
      hilfe.position.y = tl.y - tl.h / 2 * (1 - e);
      tl.oben = tl.y + tl.h / 2 + 1.0;
    } else if (tl.art === 'fallen') {
      hilfe.position.y = tl.y + (1 - e) * 2.8;
      hilfe.rotation.y = tl.rotY + (1 - e) * (tl.dreh || 0);
      tl.oben = hilfe.position.y + tl.h / 2 + 0.2;
    } else {
      hilfe.scale.x = Math.max(0.001, (tl.sx || 1) * e);
      hilfe.scale.y = tl.h;
    }
    hilfe.updateMatrix();
    m.setMatrixAt(tl.index, hilfe.matrix);
  }

  function kranSollSetzen(t) {
    let aktiv = null;
    for (const tl of kranTeile) {
      if (tl.t0 > t) break;
      if (t - tl.t0 <= tl.d + 0.01) aktiv = tl;
    }
    if (aktiv && aktiv.oben != null && t < UEBERGABE_START) {
      const dx = aktiv.x - KRAN.x, dz = aktiv.z - KRAN.z;
      kranSoll.winkel = Math.atan2(-dz, dx);
      kranSoll.weite = klemmen(Math.hypot(dx, dz), 2, KRAN.ausleger - 0.5);
      kranSoll.hakenY = Math.min(KRAN.hoehe - 0.75, aktiv.oben);
      kuebel.visible = aktiv.art !== 'fallen';
    } else {
      kuebel.visible = true;
      const weg = klemmen((t - UEBERGABE_START) / 0.05);
      const hoehe = t < ROH_START ? SOCKEL_H : SOCKEL_H + klemmen(Math.floor((t - ROH_START) / ROH_DAUER) + 1, 0, GESCHOSSE) * GESCHOSS_H;
      const warten = { winkel: Math.atan2(-(0.4 - KRAN.z), 0.6 - KRAN.x), weite: Math.hypot(0.6 - KRAN.x, 0.4 - KRAN.z), hakenY: Math.min(KRAN.hoehe - 0.75, hoehe + 2.2) };
      kranSoll.winkel = mix(warten.winkel, ruhe.winkel, weg);
      kranSoll.weite = mix(warten.weite, ruhe.weite, weg);
      kranSoll.hakenY = mix(warten.hakenY, ruhe.hakenY, weg);
    }
  }

  function kranNachfuehren(dt) {
    const f = 1 - Math.exp(-dt * 6);
    let dw = kranSoll.winkel - kranIst.winkel;
    dw = Math.atan2(Math.sin(dw), Math.cos(dw));
    kranIst.winkel += dw * f;
    kranIst.weite += (kranSoll.weite - kranIst.weite) * f;
    kranIst.hakenY += (kranSoll.hakenY - kranIst.hakenY) * f;
    dreh.rotation.y = kranIst.winkel;
    katze.position.set(kranIst.weite, -0.09, 0);
    const pendel = Math.sin(zeit * 1.7) * 0.035 * klemmen(Math.abs(dw) * 6);
    seil.position.set(kranIst.weite, -0.18, 0);
    seil.scale.y = Math.max(0.3, -0.18 - (kranIst.hakenY - KRAN.hoehe) - 0.13);
    haken.position.set(kranIst.weite + pendel, kranIst.hakenY - KRAN.hoehe, 0);
    return Math.abs(dw) + Math.abs(kranSoll.weite - kranIst.weite) + Math.abs(kranSoll.hakenY - kranIst.hakenY);
  }

  return {
    gruppe,
    // Grundfläche des Hauses mit Kran und Stapel, für den Kontaktschatten
    flaeche: [13.5, 7.5],
    setzen(t, dt = 0) {
      zeit += dt;
      for (const tl of teile) teilSetzen(tl, t);
      for (const g of gruppen) g.mesh.instanceMatrix.needsUpdate = true;
      tafelnSetzen(t);
      kranSollSetzen(t);
      rest = kranNachfuehren(dt);
    },
    ruhig() { return rest < 0.002; },
  };
}
