/* Hebel v4, Abschnitt "Ablauf": das Förderband aus v3 in der Nahansicht, dazu die Tempo-Leiste im Kopf.
   Auftrag: docs/webstudio-2026-10/master-prompts/v4-05-foerderband.md, Abschnitt 8 (gilt vor 3 und 7),
   dazu v4-00-gemeinsam.md.
   Aus werkstatt.js (v3) kopiert, nicht importiert: STATIONEN, Leiste und Segmente, Karte mit
   Schreib-Notiz, Tempo, Geometrie-Helfer, Strecke, Boden, Band, Einlauf, Auslauf, Werkstücke,
   Blitz-Ringe, Pressen, Helfer, Stationen 1 bis 6, Beschriftungen, Sprechblase, Besucher-Aktionen,
   Raycast und Ziehen, und die Kamera (buildKeys, dwell, camAt, applyCam, werkstatt.js 1339 bis 1383).
   Neu gegenüber v3: Die Kamera hängt nicht am Scroll, sondern an einer Zahl u (Station 1 = 1 bis 6).
   Beim Laden steht u auf der Startstation (1 oder ?station=N), nichts fliegt herein. Ein Stationswechsel
   lässt u gleiten (power2.inOut, 1.2 s, je weitere Station 0.25 s mehr, höchstens 2.2 s); camAt zoomt
   dazwischen kurz heraus wie in v3. Scrollen bewegt nichts und hält nichts fest. */

import { zeichneVorschau, schriftenLaden } from './vorschau-zeichnen.js';

/* three kommt erst beim Bau (dynamischer Import, gleiche Importmap wie einstieg.js) */
let THREE = null;

/* ---------- Grundlagen ---------- */
const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
/* Ruhig nur, wenn der Besucher es selbst gewählt hat (Klasse ruhig aus localStorage hebel-ruhig).
   Die Systemeinstellung "reduzierte Bewegung" wird bewusst nicht ausgewertet (Auftrag D). */
let RUHIG = html.classList.contains('ruhig');
const FEIN = window.matchMedia('(pointer: fine)').matches;
const SCHMAL = window.matchMedia('(max-width: 819px)');   // gleiche Schwelle wie im CSS: darunter Handy-Aufbau
/* Unter 1080 px liegt nichts über dem Canvas: Tempo darüber, Leiste und Karte darunter (gleiche Schwelle wie
   im CSS). Vorher lag dort der Desktop-Aufbau und liess dem Band nur 3.2 bis 4.2 px je Einheit (Prüfung M3). */
const GESTAPELT = window.matchMedia('(max-width: 1079px)');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const pick = a => a[Math.random() * a.length | 0];
const zwei = n => String(n).padStart(2, '0');
const jetztMs = () => performance.now();
const power2aus = p => 1 - Math.pow(1 - p, 3);   // GSAP power2.out
const power2inOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);   // GSAP power2.inOut
function angLerp(a, b, t) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }

/* Gleiten zur Station: 1.2 s, bei Sprüngen über mehrere Stationen 0.25 s je weitere Station mehr, höchstens
   2.2 s (Auftrag 8.1). Von 1 nach 4 also 1.7 s. */
export function gleitDauer(von, nach) {
  const d = Math.abs(nach - von);
  return Math.min(2.2, 1.2 + 0.25 * Math.max(0, d - 1));
}
/* Startstation aus der Adresse (?station=N, 1 bis 6), sonst 1 (Auftrag 8.4 E) */
export function startStation(suche) {
  const m = /[?&]station=(\d+)/.exec(suche || '');
  const n = m ? parseInt(m[1], 10) : 1;
  return n >= 1 && n <= 6 ? n : 1;
}

const STATIONEN = [
  {name:'Gespräch', marke:'kostenlos',
   text:'Sie erzählen, was Ihr Betrieb macht und was die Website leisten soll. Reicht ein Baukasten oder Ihre vorhandene Software, sage ich Ihnen das.',
   aufwand:'das Gespräch', dinge:['Ihre Ziele','Ihre Fragen','Notiz'],
   notiz:'Was soll die Seite leisten?', aus:'✓ in Ihren Worten notiert'},
  {name:'Angebot', marke:'Festpreis',
   text:'Sie bekommen ein schriftliches Angebot mit Festpreis, vor Baubeginn. Was drin ist und was nicht, steht darin.',
   aufwand:'lesen, nachfragen, entscheiden', dinge:['Angebot','Festpreis','Umfang'],
   notiz:'Angebot schreiben, Festpreis', aus:'✓ schriftlich, vor Baubeginn'},
  {name:'Entwurf', marke:'Handy zuerst',
   text:'Aus Ihren Bildern und Ihren Worten entsteht der Plan der Seite: was wo steht und wie ein Besucher zu Ihnen findet. Zuerst für das Handy, dann für den Bildschirm.',
   aufwand:'Bilder und Angaben liefern', dinge:['Seitenplan','Ihre Bilder','Ihre Texte'],
   notiz:'Weg zur Anfrage zeichnen', aus:'✓ der Plan steht'},
  {name:'Bau', marke:'mit Zwischenständen',
   text:'Hebel baut aus Ihren Bildern und Ihren Worten. Sie sehen Zwischenstände, bevor etwas fertig ist.',
   aufwand:'Zwischenstände ansehen, Rückmeldung geben', dinge:['Zwischenstand','Formular','Ihre Inhalte'],
   notiz:'Zwischenstand schicken', aus:'✓ Sie sehen es, bevor es fertig ist'},
  {name:'Prüfung', marke:'vor der Übergabe',
   text:'Die Seite wird am Handy und am Bildschirm geprüft: lesbar, schnell, das Formular kommt an. Was durchfällt, geht zurück an die Werkbank.',
   aufwand:'keiner', dinge:['Handy','Bildschirm','Formular'],
   notiz:'Mit dem Daumen prüfen', aus:'✓ lesbar, schnell, Formular kommt an'},
  {name:'Übergabe', marke:'alles gehört Ihnen',
   text:'Domain, Inhalte, Code und Zugänge gehören Ihnen. Wechseln Sie später, nehmen Sie alles mit.',
   aufwand:'Zugänge übernehmen, die Seite abnehmen', dinge:['Domain','Code','Zugänge'],
   notiz:'Schlüssel übergeben', aus:'✓ alles gehört Ihnen'}
];

/* ======================================================================
   Die Welt (aus v3), Kamera wie v3 an der Zahl u statt am Scroll
   ein: { THREE, renderer, canvas, buehne, panel, schilderEl, blase, hud, start }
   hud: fokus(), tempo(), waehlen(k, eigen), weiter(), vorrang(), fortschritt(f), ihrBetrieb(), flaechen()
   ====================================================================== */
export function weltBauen(ein) {
  THREE = ein.THREE;
  const { renderer, canvas, buehne, panel, schilderEl, blase, hud } = ein;
  const HANDY = !FEIN || window.innerWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HANDY ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  /* Kamera wie v3: orthografisch, Blickrichtung DIR wie im Einstieg; applyCam setzt Ziel und Frustum je Bild */
  const DIR = new THREE.Vector3(-1, 1.08, 0.82).normalize();
  const RECHTS = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), DIR).normalize();
  const OBEN = new THREE.Vector3().crossVectors(DIR, RECHTS).normalize();
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 20, 320);

  /* Licht wie v3 (Hemisphere 1.9, Sonne 2.0); die Sonne folgt dem Kamera-Ziel (applyCam), wie in v3 */
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xE9E2D6, 1.9));
  const sonne = new THREE.DirectionalLight(0xFFFAF2, 2.0);
  const SUN_OFF = new THREE.Vector3(-2, 10, 4.5).normalize().multiplyScalar(60);
  sonne.castShadow = true;
  const SM = HANDY ? 1024 : 2048;
  sonne.shadow.mapSize.set(SM, SM);
  sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03; sonne.shadow.radius = 3;
  sonne.shadow.camera.near = 1; sonne.shadow.camera.far = 160;
  scene.add(sonne); scene.add(sonne.target);

  const welt = new THREE.Group(); scene.add(welt);

  /* Farben wie v3, Boden und Stationsflächen auf Palette A; Podeste in den Farben der Beispiele.
     Boden, Stationsflächen und Spuren sind Albedo-Werte: Halbkugellicht 1.9 und Sonne 2.0 ohne Tone-Mapping
     heben eine waagrechte Fläche auf rund das 1.14-Fache (three r186, Lambert mit Fresnel-Abzug, Blickrichtung
     DIR). Albedo #E9E2D6 erschien darum als #F8EEDE, heller als die Karte (Prüfung N5). Gerechnet zeigt
     0xDBD6CE den Sand #E9E2D6, 0xCFC9BE die Stationsfläche #DDD4C6, 0xCCC8BF die Spuren #D9D3C7.
     In der Sichtprüfung mit der Pipette nachmessen. */
  const C = { boden:0xDBD6CE, feld:0xCFC9BE, papier:0xFFFFFF, weiss:0xFAFAF8,
    sand:0xCCC8BF, karton:0xD8B07A, tinte:0x0B0B0C, schiefer:0x45474C, dunkel:0x26272B,
    kobalt:0x2340FF, kobaltTief:0x1730D6, himmel:0x7FA2FF,
    gruen:0x2E9E5B, salbei:0x8DB38A, rot:0xD93A2B, butter:0xF2C14E, strahl:0xF3F5FF,
    zitrone:0xFFD84A, roetel:0xC8462E };

  /* ---------- Geometrie-Helfer (aus v3) ---------- */
  const matCache = new Map();
  function mat(c, rough) {
    const k = c + '|' + (rough || 0);
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough || 0.62, metalness: 0 }));
    return matCache.get(k);
  }
  const geoCache = new Map();
  const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
  function achse(c, half, r, seg) { const n = 2 * seg + 1, k = c * n, a = Math.abs(k); if (a <= 0.5) return k * 2 * (half - r); return Math.sign(k) * ((half - r) + (a - 0.5) / seg * r); }
  /* abgerundete Box: unterteilte Box, Aussenbänder auf Viertelkreise gebogen, steht auf y=0 */
  function rgeo(w, h, d, r, seg) {
    r = Math.max(0.002, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
    /* Kanten unter 0.05 Einheiten sind auch in der Nahansicht (Desktop rund 43 px je Einheit) höchstens 2 px
       gross: dort reicht ein Segment (108 statt 300 Dreiecke je Box; aus der ersten Fassung, Prüfung Last). */
    seg = seg || (r < 0.05 ? 1 : 2);
    return cached(`r${w}|${h}|${d}|${r.toFixed(4)}|${seg}`, () => {
      const n = 2 * seg + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, hs = [w / 2, h / 2, d / 2];
      const p = [0, 0, 0], inn = [0, 0, 0], off = [0, 0, 0];
      for (let i = 0; i < P.count; i++) {
        const o = [P.getX(i), P.getY(i), P.getZ(i)];
        for (let a = 0; a < 3; a++) p[a] = achse(o[a], hs[a], r, seg);
        const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i));
        const ua = nx > 0.5 ? 2 : 0, va = ny > 0.5 ? 2 : 1;
        U.setXY(i, achse(U.getX(i) - 0.5, hs[ua], r, seg) / (2 * hs[ua]) + 0.5, achse(U.getY(i) - 0.5, hs[va], r, seg) / (2 * hs[va]) + 0.5);
        let len = 0;
        for (let a = 0; a < 3; a++) { inn[a] = clamp(p[a], -(hs[a] - r), hs[a] - r); off[a] = p[a] - inn[a]; len += off[a] * off[a]; }
        len = Math.sqrt(len);
        if (len > 1e-6) { for (let a = 0; a < 3; a++) p[a] = inn[a] + off[a] / len * r; N.setXYZ(i, off[0] / len, off[1] / len, off[2] / len); }
        P.setXYZ(i, p[0], p[1], p[2]);
      }
      g.translate(0, h / 2, 0); return g;
    });
  }
  function pgeo(w, h, d) { return cached(`p${w}|${h}|${d}`, () => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }); }
  function rcgeo(r, h, f, s) {
    f = Math.min(f, r * 0.5, h * 0.5);
    return cached(`c${r}|${h}|${f}|${s}`, () => {
      const V = THREE.Vector2, pts = [new V(0, 0), new V(r - f, 0)];
      for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new V(r - f + Math.cos(a) * f, f + Math.sin(a) * f)); }
      for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new V(r - f + Math.cos(a) * f, h - f + Math.sin(a) * f)); }
      pts.push(new V(0, h)); return new THREE.LatheGeometry(pts, s || (r < 0.15 ? 16 : 36));   // dünne Stäbe: 16 Segmente
    });
  }
  /* Kapsel, hängt am oberen Gelenk (y=0) und reicht bis y=-len */
  function capgeo(r, len) {
    return cached(`k${r}|${len}`, () => {
      const V = THREE.Vector2, pts = [];
      for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(new V(Math.max(0, Math.cos(a) * r), -len + Math.sin(a) * r)); }
      for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new V(Math.max(0, Math.cos(a) * r), Math.sin(a) * r)); }
      return new THREE.LatheGeometry(pts, r < 0.1 ? 8 : 14);   // Glieder der Helfer: in der Nahansicht rund 5 px dick, 8 Segmente reichen
    });
  }
  const sgeo = r => cached(`s${r}`, () => (r < 0.2 ? new THREE.SphereGeometry(r, 12, 8) : new THREE.SphereGeometry(r, 24, 16)));   // Hände, Füsse, Lampen: grob reicht
  function dreieckGeo(kante, tiefe) {
    return cached(`d${kante}|${tiefe}`, () => {
      const h = kante * Math.sqrt(3) / 2, s = new THREE.Shape();
      s.moveTo(-kante / 2, 0); s.lineTo(kante / 2, 0); s.lineTo(0, h); s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: tiefe, bevelEnabled: false });
    });
  }

  const M = c => typeof c === 'number' ? mat(c) : c;
  let CUR = welt;
  function mk(g, m, x, y, z, parent) { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); (parent || CUR).add(o); return o; }
  function box(w, h, d, c, x, y, z, parent, r) { return mk(rgeo(w, h, d, r === undefined ? Math.min(0.2, Math.min(w, h, d) * 0.3) : r), M(c), x, y, z, parent); }
  function pbox(w, h, d, c, x, y, z, parent) { return mk(pgeo(w, h, d), M(c), x, y, z, parent); }
  function cyl(r, h, c, x, y, z, parent, f) { return mk(rcgeo(r, h, f === undefined ? Math.min(0.08, r * 0.3, h * 0.3) : f), M(c), x, y, z, parent); }
  function sph(r, c, x, y, z, parent) { return mk(sgeo(r), M(c), x, y, z, parent); }
  function grp(x, y, z, parent) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); (parent || CUR).add(g); return g; }
  /* Box, bei der genau eine Seite (0=+x 1=-x 2=+y 3=-y 4=+z 5=-z) eine Canvas-Textur trägt */
  function tbox(w, h, d, c, face, tex, x, y, z, parent, lit) {
    const b = M(c); const ms = [b, b, b, b, b, b];
    ms[face] = lit ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }) : new THREE.MeshBasicMaterial({ map: tex });
    return mk(rgeo(w, h, d, Math.min(0.06, Math.min(w, h, d) * 0.3)), ms, x, y, z, parent);
  }
  const trefferMat = new THREE.MeshBasicMaterial({ visible: false });
  const ziele = [];   // unsichtbare Treffer-Boxen für Hover und Klick
  function treffer(w, h, d, x, y, z, parent, daten) {
    const m = mk(pgeo(w, h, d), trefferMat, x, y, z, parent);
    m.userData = Object.assign({ treffer: true }, daten);
    ziele.push(m); return m;
  }

  const MAXANI = renderer.capabilities.getMaxAnisotropy();
  const texDrawers = [];
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = MAXANI;
    const api = { cv, ctx, tex, w, h, draw() { ctx.save(); ctx.clearRect(0, 0, w, h); draw(ctx, w, h); ctx.restore(); tex.needsUpdate = true; } };
    api.draw(); texDrawers.push(api); return api;
  }
  /* Die Handschrift "Notiz" gibt es in v4 nicht mehr (v4-01, Abschnitt 3): Notizen stehen in Archivo */
  const F = { schrift: '"Archivo", system-ui, sans-serif', mono: '"Atkinson Hyperlegible Mono", ui-monospace, monospace' };
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function breit(x, v) { if ('fontStretch' in x) x.fontStretch = v; }
  function haken(x, cx, cy, r, an) {
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fillStyle = an ? '#2E9E5B' : '#E6E3DC'; x.fill();
    if (!an) return;
    x.strokeStyle = '#fff'; x.lineWidth = r * 0.28; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(cx - r * 0.45, cy + r * 0.02); x.lineTo(cx - r * 0.1, cy + r * 0.38); x.lineTo(cx + r * 0.5, cy - r * 0.35); x.stroke();
  }
  function kreuz(x, cx, cy, r) {
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = '#D93A2B'; x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = r * 0.26; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx - r * 0.38, cy - r * 0.38); x.lineTo(cx + r * 0.38, cy + r * 0.38);
    x.moveTo(cx + r * 0.38, cy - r * 0.38); x.lineTo(cx - r * 0.38, cy + r * 0.38); x.stroke();
  }

  /* ---------- Strecke: gerader Lauf, Kurve, gerader Lauf ---------- */
  const SX = [0, 18, 36, 54, 72, 90];
  const X0 = -9, LA = 55, RC = 7, LARC = Math.PI / 2 * RC, TX = X0 + LA, SB = LA + LARC;
  const BELT_LEN = SB + 59, BELT_Y = 0.69;
  function pathAt(s, o) {
    o = o || {};
    if (s <= LA) { o.x = X0 + s; o.z = 0; o.a = 0; }
    else if (s <= SB) { const t = (s - LA) / RC; o.x = TX + Math.sin(t) * RC; o.z = RC - Math.cos(t) * RC; o.a = -t; }
    else { o.x = TX + RC; o.z = RC + (s - SB); o.a = -Math.PI / 2; }
    return o;
  }
  const FB = new THREE.Group(); FB.rotation.y = -Math.PI / 2; FB.position.set(TX + RC, 0, RC + (81 - SB) - 54); welt.add(FB); FB.updateMatrix();
  const FR = [welt, welt, welt, FB, FB, FB], SOFF = [9, 9, 9, 27, 27, 27];
  const TH = SX.map(x => x + 1.2);
  const THS = SX.map((x, i) => x + 1.2 + SOFF[i]);
  /* Koordinaten im Raum der Welt-Gruppe (ohne Parallaxe) */
  function toW(frame, x, y, z) { const v = new THREE.Vector3(x, y, z); return frame === welt ? v : v.applyMatrix4(FB.matrix); }
  function inFrame(i, fn) { const prev = CUR; CUR = FR[i]; fn(); CUR = prev; }
  function atPath(s) { const p = pathAt(s); const g = grp(p.x, 0, p.z, welt); g.rotation.y = p.a; return g; }

  /* ---------- Boden: Sand, Punktraster, Stationsflächen ---------- */
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat(C.boden, 0.92));
  boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; boden.userData.istBoden = true; welt.add(boden);
  const punktTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = 'rgba(21,20,15,.10)'; x.beginPath(); x.arc(w / 2, h / 2, 1.2, 0, Math.PI * 2); x.fill(); });
  punktTex.tex.wrapS = punktTex.tex.wrapT = THREE.RepeatWrapping; punktTex.tex.repeat.set(350, 350);
  const raster = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: punktTex.tex, transparent: true, depthWrite: false }));
  raster.rotation.x = -Math.PI / 2; raster.position.y = 0.006; raster.userData.istBoden = true; welt.add(raster);
  SX.forEach((x, i) => inFrame(i, () => box(15.4, 0.05, 13.4, C.feld, x + 0.5, 0, -2, null, 0.02)));
  for (let x = -14; x < 44; x += 2.4) { box(1.1, 0.03, 0.16, C.sand, x, 0.05, 5.1, null, 0.012); box(1.1, 0.03, 0.16, C.sand, x, 0.05, 2.35, null, 0.012); }
  inFrame(3, () => { for (let x = 45; x < 106; x += 2.4) { box(1.1, 0.03, 0.16, C.sand, x, 0.05, 5.1, null, 0.012); box(1.1, 0.03, 0.16, C.sand, x, 0.05, 2.35, null, 0.012); } });

  /* ---------- Förderband ---------- */
  const beltSamples = []; for (let q = 0; q <= BELT_LEN + 1e-6; q += 0.5) beltSamples.push(pathAt(q, {}));
  const side = (p, o) => [p.x + Math.sin(p.a) * o, p.z + Math.cos(p.a) * o];
  (() => {
    const pts = beltSamples.map(p => side(p, 1.18)).concat(beltSamples.map(p => side(p, -1.18)).reverse());
    const shp = new THREE.Shape(); shp.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) shp.lineTo(pts[i][0], -pts[i][1]);
    const g = new THREE.ExtrudeGeometry(shp, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 5, steps: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, 0.18, 0); mk(g, mat(C.papier), 0, 0, 0, welt);
  })();
  for (let q = 2; q < BELT_LEN; q += 8) box(0.5, 0.08, 2.3, C.schiefer, 0, 0, 0, atPath(q));
  const beltTex = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#D7D3CA'; x.fillRect(0, 0, w, h); x.fillStyle = '#C9C4B9'; x.fillRect(0, 0, 14, h); x.fillRect(128, 0, 14, h); });
  beltTex.tex.wrapS = THREE.RepeatWrapping;
  (() => {
    const pos = [], uv = [], nor = [], idx = [];
    beltSamples.forEach((p, i) => {
      const l = side(p, -1.1), r = side(p, 1.1);
      pos.push(l[0], 0.684, l[1], r[0], 0.684, r[1]); nor.push(0, 1, 0, 0, 1, 0);
      const uu = i * 0.25; uv.push(uu, 0, uu, 1);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    mk(g, new THREE.MeshStandardMaterial({ map: beltTex.tex, roughness: 0.9 }), 0, 0, 0, welt);
  })();
  [-1.22, 1.22].forEach(o => {
    const pts = beltSamples.filter((_, i) => i % 2 === 0).map(p => { const q = side(p, o); return new THREE.Vector3(q[0], 0.66, q[1]); });
    mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 700, 0.09, 6, false), mat(C.papier), 0, 0, 0, welt);
  });
  [18, 36, 90, 108].forEach(q => {
    const g = atPath(q);
    const d = cyl(0.34, 0.1, C.kobalt, 0, 0.37, 1.28, g); d.rotation.x = Math.PI / 2;
    const d2 = cyl(0.13, 0.12, C.papier, 0, 0.37, 1.28, g); d2.rotation.x = Math.PI / 2;
  });
  // Einlauf "Ihre Anfrage" mit Briefkasten
  box(3.2, 2.3, 3.2, C.papier, -11, 0, 0, null, 0.4);
  box(3.3, 0.34, 3.3, C.kobalt, -11, 2.2, 0, null, 0.15);
  box(1.3, 0.9, 0.8, C.kobalt, -11, 2.55, 0, null, 0.2);
  pbox(0.8, 0.06, 0.02, C.tinte, -11, 3.1, 0.41);
  const SCHLITZ = new THREE.Vector3(-11, 3.05, 0.55);
  // Baum in der Innenseite der Kurve
  (() => {
    const cx = TX - 0.6, cz = RC + 0.6;
    cyl(1.1, 0.6, C.papier, cx, 0, cz, null, 0.2); cyl(1.14, 0.14, C.kobalt, cx, 0.5, cz, null, 0.06); cyl(0.14, 1.3, C.karton, cx, 0.6, cz);
    sph(0.95, C.salbei, cx, 2.3, cz); sph(0.7, C.salbei, cx + 0.6, 1.9, cz + 0.3); sph(0.6, C.salbei, cx - 0.55, 2.0, cz - 0.2); sph(0.55, 0x9DC59A, cx + 0.1, 2.95, cz + 0.1);
  })();
  // Auslauf "Übergabe" mit Kistenstapel
  inFrame(5, () => {
    box(3.4, 2.6, 3.4, C.papier, 98.8, 0, 0, null, 0.4);
    box(3.5, 0.34, 3.5, C.kobalt, 98.8, 2.5, 0, null, 0.15);
    [[101.8, 0, -3.2], [103.1, 0, -3.2], [102.4, 1.0, -3.2], [101.8, 0, -1.9]].forEach(p => {
      box(1.15, 0.95, 1.15, C.karton, p[0], p[1], p[2]); box(0.26, 0.97, 1.17, C.kobalt, p[0], p[1], p[2], null, 0.04);
    });
  });

  /* ---------- Bildschirm-Seiten (klein, für Werkstücke) ---------- */
  const seiteKlein = canvasTex(256, 160, (x, w, h) => {
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, 22);
    x.fillStyle = '#D9D6CE'; rr(x, 16, 34, 130, 70, 8); x.fill();
    x.fillStyle = '#C9C6BE'; rr(x, 160, 40, 80, 10, 5); x.fill(); rr(x, 160, 58, 64, 10, 5); x.fill();
    x.fillStyle = '#2340FF'; rr(x, 160, 84, 70, 22, 11); x.fill();
    x.fillStyle = '#C9C6BE'; rr(x, 16, 118, 220, 8, 4); x.fill(); rr(x, 16, 134, 170, 8, 4); x.fill();
  });
  const seiteSchmal = canvasTex(96, 176, (x, w, h) => {
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, 20);
    x.fillStyle = '#D9D6CE'; rr(x, 10, 30, 76, 54, 6); x.fill();
    x.fillStyle = '#C9C6BE'; rr(x, 10, 94, 70, 8, 4); x.fill(); rr(x, 10, 108, 52, 8, 4); x.fill();
    x.fillStyle = '#2340FF'; rr(x, 10, 132, 76, 24, 12); x.fill();
  });

  /* ---------- Werkstücke, die sich verwandeln ---------- */
  const ITEM_SPEED = 1.5, ITEM_GAP = 4.8, ITEM_S0 = -3;
  const N_ITEMS = Math.ceil((BELT_LEN + 1.2 - ITEM_S0) / ITEM_GAP), LOOP = N_ITEMS * ITEM_GAP;
  const klappeGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.55, 0.375); s.lineTo(0.55, 0.375); s.lineTo(0, -0.02); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; })();
  function hakenStehend(g, x, y, z, s) {   // grüner Haken aus zwei Balken, stehend
    const a = box(0.1 * s, 0.3 * s, 0.05, C.gruen, x, y, z, g, 0.02); a.rotation.z = 0.75;
    const b = box(0.1 * s, 0.58 * s, 0.05, C.gruen, x, y, z, g, 0.02); b.rotation.z = -0.6;
  }
  function variante(k, parent) {
    const g = grp(0, 0, 0, parent);
    switch (k) {
      case 0: {   // Anfrage: Briefumschlag
        const e = grp(0, 0.05, 0, g);
        box(1.1, 0.08, 0.75, C.weiss, 0, 0, 0, e, 0.03);
        mk(klappeGeo, mat(0xEDEDEA), 0, 0.081, 0, e);
        cyl(0.11, 0.03, C.kobalt, 0, 0.1, 0.02, e, 0.01);
        break;
      }
      case 1:     // Notiz: Blatt mit Linien und kobaltblauer Schrift
        box(1.0, 0.06, 1.3, C.weiss, 0, 0, 0, g, 0.03);
        [-0.42, -0.22, -0.02].forEach(z => pbox(0.64, 0.012, 0.07, 0xC9C6BE, 0, 0.06, z, g));
        [[-0.24, 0.26, 0.3], [-0.02, 0.24, -0.25], [0.18, 0.27, 0.35]].forEach(s => { const m = pbox(0.24, 0.014, 0.05, C.kobalt, s[0], 0.061, s[1], g); m.rotation.y = s[2]; });
        break;
      case 2: {   // Angebot: Blatt mit Stempel-Abdruck und Klebezettel
        box(1.0, 0.06, 1.3, C.weiss, 0, 0, 0, g, 0.03);
        [-0.42, -0.22].forEach(z => pbox(0.64, 0.012, 0.07, 0xC9C6BE, 0, 0.06, z, g));
        const ring = mk(cached('stempelring', () => new THREE.TorusGeometry(0.22, 0.025, 8, 32)), mat(C.kobalt), 0.08, 0.072, 0.26, g); ring.rotation.x = Math.PI / 2;
        pbox(0.22, 0.012, 0.06, C.kobalt, 0.08, 0.061, 0.26, g);
        const z = box(0.32, 0.012, 0.32, C.butter, -0.32, 0.061, 0.36, g, 0.005); z.rotation.y = 0.2;
        break;
      }
      case 3:     // Entwurf: Blaupause mit Drahtgitter-Blöcken
        box(1.25, 0.07, 1.25, C.kobalt, 0, 0, 0, g, 0.03);
        pbox(1.0, 0.012, 0.14, C.papier, 0, 0.07, -0.44, g);
        pbox(0.5, 0.012, 0.42, C.papier, -0.22, 0.07, -0.08, g);
        pbox(0.36, 0.012, 0.07, C.papier, 0.27, 0.07, -0.2, g); pbox(0.3, 0.012, 0.07, C.papier, 0.24, 0.07, -0.04, g);
        pbox(0.4, 0.012, 0.14, C.papier, 0.2, 0.07, 0.3, g);
        break;
      case 4:     // Seite: Bildschirm-Block
        tbox(1.2, 0.75, 0.12, C.dunkel, 4, seiteKlein.tex, 0, 0, 0, g);
        break;
      case 5:     // Geprüft: Bildschirm, Handy, Haken
        tbox(1.2, 0.75, 0.12, C.dunkel, 4, seiteKlein.tex, -0.2, 0, 0, g);
        tbox(0.34, 0.62, 0.06, C.tinte, 4, seiteSchmal.tex, 0.62, 0, 0.12, g);
        hakenStehend(g, 0.0, 0.86, 0.04, 1);
        break;
      case 6: {   // Übergabe: Kiste mit Band und Schlüssel
        box(1.15, 0.95, 1.15, C.karton, 0, 0, 0, g); box(0.26, 0.97, 1.17, C.kobalt, 0, 0, 0, g, 0.04);
        const s = grp(0.2, 0.985, 0.1, g); s.rotation.y = 0.5;
        const r = mk(cached('schluesselring', () => new THREE.TorusGeometry(0.12, 0.035, 10, 24)), mat(C.butter, 0.4), -0.2, 0.035, 0, s); r.rotation.x = Math.PI / 2;
        box(0.36, 0.05, 0.07, C.butter, 0.06, 0.01, 0, s, 0.02);
        box(0.06, 0.05, 0.12, C.butter, 0.2, 0.01, 0.07, s, 0.02);
        break;
      }
      case 7: {   // Zurück: roter Block mit weissem X
        box(1.05, 0.5, 1.05, C.rot, 0, 0, 0, g);
        const a = box(0.13, 0.04, 0.7, C.weiss, 0, 0.49, 0, g, 0.02); a.rotation.y = 0.785;
        const b = box(0.13, 0.04, 0.7, C.weiss, 0, 0.49, 0, g, 0.02); b.rotation.y = -0.785;
        break;
      }
    }
    g.visible = false; return g;
  }
  const items = [];
  for (let i = 0; i < N_ITEMS; i++) {
    const g = grp(0, BELT_Y, 0); const vs = [];
    for (let k = 0; k < 8; k++) vs.push(variante(k, g));
    items.push({ g, vs, s: ITEM_S0 + i * ITEM_GAP, v: -1, cur: -1, fail: Math.random() < 0.2, rej: null, gone: false });
  }
  const variantAt = q => { let v = 0; for (let i = 0; i < THS.length; i++) if (q > THS[i]) v = i + 1; return v; };

  /* ---------- Blitz-Ringe (Stempel-Aufschlag) ---------- */
  const ringGeo = new THREE.RingGeometry(0.5, 0.64, 40); ringGeo.rotateX(-Math.PI / 2);
  const ringe = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false }));
    m.userData.ohneSchatten = true; m.visible = false; welt.add(m); ringe.push({ m, t: 1 });
  }
  function blitz(frame, x, y, z) {
    const r = ringe.find(q => q.t >= 1) || ringe[0];
    r.t = 0; r.m.visible = true; r.m.position.copy(toW(frame, x, y, z));
  }

  /* ---------- Pressen und Stempel über dem Band ---------- */
  const pressen = [];
  SX.forEach((sx, i) => {
    if (i === 4) return;
    inFrame(i, () => {
      const x = TH[i];
      box(0.3, 2.7, 0.3, C.papier, x, 0, 1.62); box(0.3, 2.7, 0.3, C.papier, x, 0, -1.62); box(0.56, 0.4, 3.56, C.papier, x, 2.65, 0);
      const lampMat = new THREE.MeshStandardMaterial({ color: C.salbei, emissive: C.salbei, emissiveIntensity: 0.4 });
      sph(0.15, lampMat, x, 3.12, 0);
      const head = grp(x, 2.05, 0); cyl(0.07, 1.2, C.schiefer, 0, 0.3, 0, head); cyl(0.62, 0.32, C.kobalt, 0, 0, 0, head, 0.1);
      pressen.push({ i, x, s: THS[i], head, lampMat, unten: false });
    });
  });

  /* ---------- Die Helfer ---------- */
  const helfer = [];
  const schattenGeo = new THREE.CircleGeometry(0.6, 28);
  const schattenMat = new THREE.MeshBasicMaterial({ color: 0x1A1F4A, transparent: true, opacity: 0.12, depthWrite: false });
  const helferMat = new THREE.MeshStandardMaterial({ color: C.kobalt, roughness: 0.45 });
  const emblemMat = new THREE.MeshStandardMaterial({ color: C.strahl, roughness: 0.55 });
  const CAMF = Math.atan2(DIR.x, DIR.z);
  const faceTo = (dx, dz) => Math.atan2(dx, dz);
  function glied(parent, x, y, z, r, l1, l2) {
    const a = grp(x, y, z, parent); mk(capgeo(r, l1), helferMat, 0, 0, 0, a);
    const b = grp(0, -l1, 0, a); mk(capgeo(r, l2), helferMat, 0, 0, 0, b);
    return { a, b };
  }
  function makeBot(o) {
    const S = o.scale || 0.92;
    const root = grp(o.x, 0, o.z);
    const sh = new THREE.Mesh(schattenGeo, schattenMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.userData.ohneSchatten = true; root.add(sh);
    const hop = grp(0, 0, 0, root), body = grp(0, 0, 0, hop);
    mk(rgeo(1.05, 1.05, 0.6, 0.24, 3), helferMat, 0, 0.55, 0, body);
    // Hebel-Zeichen vorne: Balken über dem Dreieck (Drehpunkt)
    const balkenM = mk(rgeo(0.62, 0.08, 0.03, 0.03), emblemMat, 0, 1.12, 0.31, body); balkenM.rotation.z = -0.24;
    mk(dreieckGeo(0.34, 0.03), emblemMat, 0, 0.86, 0.3, body);
    const armL = glied(body, -0.52, 1.0, 0, 0.055, 0.26, 0.24), armR = glied(body, 0.52, 1.0, 0, 0.055, 0.26, 0.24);
    sph(0.085, helferMat, 0, -0.27, 0, armL.b).scale.set(1, 1.1, 0.8); sph(0.085, helferMat, 0, -0.27, 0, armR.b).scale.set(1, 1.1, 0.8);
    const beine = [-0.2, 0.2].map(lx => { const L = glied(hop, lx, 0.62, 0, 0.065, 0.25, 0.25); const f = sph(0.12, helferMat, 0, -0.28, 0.05, L.b); f.scale.set(0.95, 0.55, 1.4); return L; });
    const hit = new THREE.Mesh(pgeo(1.5, 1.9, 1.1), trefferMat); root.add(hit);
    const blick = o.face === undefined ? CAMF - CUR.rotation.y : o.face;
    root.scale.setScalar(S); root.rotation.y = blick;
    const b = { root, hop, body, armL, armR, beine, S, mode: o.mode || 'idle', lines: o.lines, name: o.name, station: o.station || 0,
      phase: Math.random() * 10, hopT: -1, path: o.path || null, pi: 0, at: 0, wait: 0, speed: o.speed || 1.4, cheer: 0,
      waitFace: o.waitFace, carry: o.carry !== undefined, blick, letzt: '', frame: CUR };
    if (o.carry !== undefined) b.traglast = box(0.7, 0.07, 0.5, o.carry, 0, 1.62, 0, body, 0.03);
    if (o.tool === 'lupe') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 10, 28), mat(C.tinte)); ring.position.set(0, -0.5, 0.08); armR.b.add(ring);
      const glas = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshStandardMaterial({ color: 0xDDE4FF, transparent: true, opacity: 0.75, roughness: 0.1 }));
      glas.position.copy(ring.position); glas.userData.ohneSchatten = true; armR.b.add(glas);
    }
    hit.userData = { treffer: true, bot: b }; ziele.push(hit); helfer.push(b);
    return b;
  }
  function setArm(A, x, z, ex, ez, k) { A.a.rotation.x = lerp(A.a.rotation.x, x, k); A.a.rotation.z = lerp(A.a.rotation.z, z, k); A.b.rotation.x = lerp(A.b.rotation.x, ex, k); A.b.rotation.z = lerp(A.b.rotation.z, ez || 0, k); }
  const wipp = 0;   // v3 wippte bei schnellem Scroll mit; hier ist Scrollen von der Welt getrennt
  function updateBot(b, dt, rdt, T) {
    const t = T + b.phase; let moving = false;
    if (b.path) {
      if (b.wait > 0) { b.wait -= dt; if (b.waitFace !== undefined) b.root.rotation.y = angLerp(b.root.rotation.y, b.waitFace[b.at], Math.min(1, dt * 5)); }
      else {
        const tg = b.path[b.pi], dx = tg[0] - b.root.position.x, dz = tg[1] - b.root.position.z, dist = Math.hypot(dx, dz);
        if (dist < 0.04) {
          if (b.tour) {
            if (b.pi === 1) { b.wait = 0.9; b.at = 1; b.pi = 0; b.tour.ab && b.tour.ab(); }
            else { const fertig = b.tour.fertig; b.path = null; b.tour = null; fertig && fertig(); }
          } else { b.wait = 1.6; b.at = b.pi; b.pi = (b.pi + 1) % b.path.length; }
        } else {
          const st = Math.min(dist, b.speed * dt); b.root.position.x += dx / dist * st; b.root.position.z += dz / dist * st;
          b.root.rotation.y = angLerp(b.root.rotation.y, faceTo(dx, dz), Math.min(1, dt * 8)); moving = dt > 0;
        }
      }
    } else if (dt > 0) b.root.rotation.y = angLerp(b.root.rotation.y, b.blick, Math.min(1, dt * 5));
    const k = Math.min(1, rdt * 10 + 0.05);
    const p = t * 9;
    b.beine.forEach((L, i) => {
      const ph = p + i * Math.PI;
      const hip = moving ? -Math.sin(ph) * 0.55 : 0;
      const knee = moving ? 0.1 + Math.max(0, Math.sin(ph + 1.3)) * 0.95 : 0.05;
      L.a.rotation.x = lerp(L.a.rotation.x, hip, 0.35); L.b.rotation.x = lerp(L.b.rotation.x, knee, 0.35);
    });
    let bob = moving ? Math.abs(Math.sin(p)) * 0.07 : (Math.sin(t * 2) * 0.018 + 0.018);
    let neigung = moving ? 0.08 : 0;
    b.body.rotation.z = lerp(b.body.rotation.z, moving ? Math.sin(p) * 0.06 : Math.sin(t * 1.3) * 0.02, 0.2);
    const sw = moving ? Math.sin(p) * 0.5 : Math.sin(t * 1.6) * 0.05;
    let L = [sw, -0.2, -0.3, 0], R = [-sw, 0.2, -0.3, 0];
    b.body.rotation.y = 0;
    switch (b.mode) {
      case 'type': L = [-1.15 + Math.sin(t * 15) * 0.12, -0.28, -0.75, 0]; R = [-1.15 + Math.sin(t * 15 + Math.PI) * 0.12, 0.28, -0.75, 0]; bob += Math.abs(Math.sin(t * 8)) * 0.015; break;
      case 'point': R = [-1.45, 0.35 + Math.sin(t * 2) * 0.12, -0.1, 0]; break;
      case 'write': R = [-1.9 + Math.sin(t * 6) * 0.2, 0.45 + Math.sin(t * 3) * 0.3, -0.5, 0]; break;
      case 'inspect': R = [-1.25, 0.25, -0.9, 0]; b.body.rotation.y = Math.sin(t * 0.9) * 0.45; break;
      case 'wave': if (Math.sin(t * 0.7) > 0.3) R = [0, 2.55, 0, 0.55 * Math.sin(t * 12)]; break;
      case 'stempeln': R = [-1.6 + Math.max(0, Math.sin(t * 5.2)) * 1.1, 0.3, -0.4, 0]; break;
      case 'ziehen': {
        const z = (Math.sin(t * 4) + 1) / 2;
        L = [-2.3 + z * 1.6, -0.2, -0.3, 0]; R = [-2.3 + z * 1.6, 0.2, -0.3, 0]; neigung = 0.08 + z * 0.22; break;
      }
    }
    if (b.carry) { L = [0, -2.7, 0, -0.9]; R = [0, 2.7, 0, 0.9]; }
    if (b.cheer > 0) { b.cheer -= rdt; L = [0, -2.6, 0, 0.4 * Math.sin(t * 14 + b.cheer * 20)]; R = [0, 2.6, 0, -0.4 * Math.sin(t * 14 + b.cheer * 20)]; bob += Math.abs(Math.sin(b.cheer * 9)) * 0.22; }
    b.body.rotation.x = lerp(b.body.rotation.x, neigung + wipp, 0.1);
    setArm(b.armL, L[0], L[1], L[2], L[3], k); setArm(b.armR, R[0], R[1], R[2], R[3], k);
    b.body.position.y = bob;
    if (b.hopT >= 0) {
      b.hopT += rdt; const q = b.hopT / 0.55;
      if (q >= 1) { b.hopT = -1; b.hop.position.y = 0; b.hop.rotation.y = 0; }
      else { b.hop.position.y = Math.sin(Math.PI * q) * 0.75; b.hop.rotation.y = q * Math.PI * 2; }
    }
  }

  /* ================= Station 1, Gespräch ================= */
  let notizHaken = 2;
  const notizTex = canvasTex(512, 320, (x, w, h) => {
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#0B0B0C'; x.font = `600 26px ${F.mono}`; x.fillText('Notiz, Erstgespräch', 26, 46);
    x.fillStyle = '#2340FF'; rr(x, 26, 58, 96, 7, 3.5); x.fill();
    x.fillStyle = '#F2C14E'; rr(x, 370, 150, 114, 114, 10); x.fill();
    x.fillStyle = '#0B0B0C'; x.font = `850 66px ${F.schrift}`; x.textAlign = 'center'; x.fillText('?', 427, 232); x.textAlign = 'left';
    ['Was macht Ihr Betrieb?', 'Was soll die Seite leisten?', 'Gibt es schon eine Seite?', 'Bilder vorhanden?'].forEach((t, i) => {
      const y = 112 + i * 50;
      haken(x, 38, y - 9, 12, i < notizHaken);
      x.fillStyle = '#1730D6'; x.font = `500 25px ${F.schrift}`; x.fillText(t, 62, y, i === 0 ? 420 : 296);
    });
  });
  // Notizwand zur Kamera gedreht (v3-Fix): flach zur Kamera war die Notiz kaum lesbar
  const notizWand = grp(-3.0, 0, -6.3); notizWand.rotation.y = -0.55;
  cyl(0.07, 0.85, C.schiefer, -2.1, 0, 0, notizWand); cyl(0.07, 0.85, C.schiefer, 2.1, 0, 0, notizWand);
  box(0.9, 0.08, 0.9, C.schiefer, -2.1, 0, 0, notizWand); box(0.9, 0.08, 0.9, C.schiefer, 2.1, 0, 0, notizWand);
  const notizTafel = tbox(4.6, 2.8, 0.16, C.kobalt, 4, notizTex.tex, 0, 0.8, 0, notizWand, true);
  treffer(4.6, 2.8, 0.5, 0, 0.8, 0, notizWand, { aktion: 'notiz', zeiger: 'klick', station: 1 });
  // Gesprächstisch, Stühle, Tassen
  cyl(0.1, 0.76, C.schiefer, 1.6, 0, -4.6); cyl(0.5, 0.05, C.schiefer, 1.6, 0, -4.6, null, 0.02);
  cyl(1.25, 0.1, C.papier, 1.6, 0.76, -4.6, null, 0.04);
  [[0.2, Math.PI / 2], [3.0, -Math.PI / 2]].forEach(([sx, ry]) => {
    const s = grp(sx, 0, -4.6); s.rotation.y = ry;
    [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(p => cyl(0.04, 0.45, C.schiefer, p[0], 0, p[1], s));
    box(0.7, 0.08, 0.7, C.weiss, 0, 0.45, 0, s, 0.03);
    box(0.7, 0.7, 0.08, C.weiss, 0, 0.5, -0.31, s, 0.03);
  });
  const tassen = [[1.15, -4.45], [2.05, -4.75]].map(p => {
    cyl(0.12, 0.2, C.weiss, p[0], 0.86, p[1], null, 0.03);
    const hk = mk(cached('henkel', () => new THREE.TorusGeometry(0.06, 0.018, 8, 16)), mat(C.weiss), p[0] + 0.13, 0.96, p[1]); hk.rotation.y = Math.PI / 2;
    return p;
  });
  const dampfMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6, roughness: 1, depthWrite: false });
  const dampf = [0, 1 / 3, 2 / 3].map(off => { const m = sph(0.06, dampfMat.clone(), tassen[0][0], 1.1, tassen[0][1]); m.userData.ohneSchatten = true; return { m, off }; });
  const zuhoeren = makeBot({ x: -1.2, z: -4.2, face: Math.PI * 1.1, mode: 'write', name: 'ZUHÖREN', station: 1,
    lines: ['Was macht Ihr Betrieb? Ich schreibe mit.', 'Erzählen Sie, die Technik kommt später.', 'Reicht ein Baukasten, sage ich Ihnen das.', 'Ihre Worte, nicht meine.'] });
  makeBot({ x: 3.4, z: -3.3, path: [[3.4, -3.3], [0.9, -2.05]], waitFace: [Math.PI, CAMF], carry: C.weiss, name: 'NOTIZ', station: 1,
    lines: ['Die Notiz geht aufs Band.', 'Ich bringe Ihre Ziele, keine Vermutungen.', 'Frisch notiert, noch warm.'] });
  const frageTex = canvasTex(64, 64, (x) => { x.fillStyle = '#2340FF'; x.font = `850 54px ${F.schrift}`; x.textAlign = 'center'; x.fillText('?', 32, 50); });
  const fragen = [0, 1 / 3, 2 / 3].map(off => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: frageTex.tex, transparent: true, depthWrite: false }));
    s.scale.setScalar(0.8); welt.add(s); return { s, off };
  });

  /* ================= Station 2, Angebot ================= */
  const angebotTex = canvasTex(512, 340, (x) => {
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, 512, 340);
    x.fillStyle = '#0B0B0C'; x.font = `850 34px ${F.schrift}`; breit(x, 'expanded'); x.fillText('Angebot', 28, 56); breit(x, 'normal');
    x.fillStyle = '#2340FF'; rr(x, 28, 70, 80, 6, 3); x.fill();
    ['Umfang', 'Was drin ist', 'Was nicht drin ist', 'Termine'].forEach((t, i) => {
      const y = 116 + i * 40;
      x.fillStyle = '#2B2C2F'; x.font = `18px ${F.mono}`; x.fillText(t, 28, y);
      x.fillStyle = '#D9D6CE'; rr(x, 230, y - 8, 230, 6, 3); x.fill();
    });
    x.save(); x.translate(392, 292); x.rotate(-12 * Math.PI / 180);
    x.strokeStyle = '#2340FF'; x.lineWidth = 5; x.beginPath(); x.ellipse(0, 0, 88, 34, 0, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.ellipse(0, 0, 78, 26, 0, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#2340FF'; x.font = `600 18px ${F.mono}`; x.textAlign = 'center'; x.fillText('FESTPREIS', 0, 6);
    x.restore();
  });
  [[14.3, -5.3], [16.9, -5.3], [14.3, -3.9], [16.9, -3.9]].forEach(p => cyl(0.06, 1.0, C.schiefer, p[0], 0, p[1]));
  const pult = tbox(3.0, 0.1, 1.9, C.papier, 2, angebotTex.tex, 15.6, 1.0, -4.6, null, true); pult.rotation.x = 0.3;
  // Grosser Stempel auf dem Sockel
  cyl(1.3, 0.38, C.papier, 21, 0, -5.4, null, 0.12); cyl(1.36, 0.12, C.kobalt, 21, 0.14, -5.4, null, 0.05);
  box(0.36, 4.0, 0.36, C.papier, 21, 0, -6.95, null, 0.12);
  box(0.36, 0.3, 1.9, C.papier, 21, 3.75, -6.1, null, 0.12);
  const stempelBlatt = box(1.3, 0.03, 0.95, C.weiss, 21, 0.39, -5.4, null, 0.01);
  const stempelG = grp(21, 1.7, -5.4);
  cyl(0.55, 0.35, C.kobalt, 0, 0, 0, stempelG, 0.1);
  cyl(0.2, 0.12, C.karton, 0, 0.35, 0, stempelG, 0.04);
  const griff = grp(0, 1.12, 0, stempelG); mk(capgeo(0.13, 0.62), mat(C.karton), 0, 0, 0, griff);
  sph(0.26, C.karton, 0, 1.18, 0, stempelG);
  cyl(0.05, 2.7, C.schiefer, 0, 1.3, 0, stempelG, 0.02);
  treffer(1.6, 2.2, 1.6, 21, 0.38, -5.4, null, { aktion: 'stempel', zeiger: 'klick', station: 2 });
  const stempel = { t: Math.random() * 2, blatt: 0 };
  const angebotBot = makeBot({ x: 19.2, z: -3.5, face: faceTo(1.2, -1.2), mode: 'stempeln', name: 'ANGEBOT', station: 2,
    lines: ['Festpreis, schriftlich, vor Baubeginn.', 'Was drin ist und was nicht, steht hier.', 'Erst lesen, dann entscheiden.', 'Fragen sind erlaubt, auch viele.'] });
  makeBot({ x: 15.6, z: -2.9, face: Math.PI * 0.9, mode: 'write', name: 'RECHNEN', station: 2,
    lines: ['Ich schreibe den Umfang auf, Zeile für Zeile.', 'Keine Überraschung auf der Rechnung.'] });

  /* ================= Station 3, Entwurf ================= */
  const eigeneStriche = [];
  function strichZeichnen(x, pts) {
    if (pts.length < 2) { if (pts.length) { x.beginPath(); x.arc(pts[0][0], pts[0][1], 1.5, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); } return; }
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; x.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const l = pts[pts.length - 1]; x.lineTo(l[0], l[1]); x.stroke();
  }
  function pfeil(x, x1, y1, x2, y2) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    x.beginPath(); x.moveTo(x2, y2); x.lineTo(x2 - Math.cos(a - 0.5) * 9, y2 - Math.sin(a - 0.5) * 9); x.moveTo(x2, y2); x.lineTo(x2 - Math.cos(a + 0.5) * 9, y2 - Math.sin(a + 0.5) * 9); x.stroke();
  }
  const planTex = canvasTex(740, 340, (x, w, h) => {
    x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1; x.beginPath();
    for (let i = 26; i < w; i += 26) { x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, h); }
    for (let j = 26; j < h; j += 26) { x.moveTo(0, j + 0.5); x.lineTo(w, j + 0.5); }
    x.stroke();
    x.strokeStyle = '#FFFFFF'; x.fillStyle = '#FFFFFF'; x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round';
    // Handyseite
    rr(x, 70, 30, 150, 280, 20); x.stroke();
    x.strokeRect(86, 52, 118, 22);
    x.strokeRect(86, 84, 118, 70); x.beginPath(); x.moveTo(86, 84); x.lineTo(204, 154); x.moveTo(204, 84); x.lineTo(86, 154); x.stroke();
    rr(x, 86, 166, 96, 12, 6); x.fill();
    rr(x, 86, 188, 118, 6, 3); x.fill(); rr(x, 86, 202, 90, 6, 3); x.fill();
    rr(x, 86, 238, 118, 40, 20); x.stroke();
    x.font = `600 15px ${F.mono}`; x.textAlign = 'center'; x.fillText('Anfrage', 145, 263); x.textAlign = 'left';
    // Bemassung am Knopf: Tippziel 44
    x.lineWidth = 2; x.beginPath(); x.moveTo(52, 238); x.lineTo(52, 278); x.moveTo(46, 238); x.lineTo(58, 238); x.moveTo(46, 278); x.lineTo(58, 278); x.stroke();
    pfeil(x, 52, 258, 52, 239); pfeil(x, 52, 258, 52, 277);
    x.font = `600 14px ${F.mono}`; x.textAlign = 'right'; x.fillText('44', 44, 263); x.textAlign = 'left';
    // Bildschirmseite
    x.lineWidth = 3;
    rr(x, 290, 30, 270, 176, 10); x.stroke();
    x.beginPath(); x.moveTo(290, 50); x.lineTo(560, 50); x.stroke();
    x.strokeRect(306, 64, 120, 84); x.beginPath(); x.moveTo(306, 64); x.lineTo(426, 148); x.moveTo(426, 64); x.lineTo(306, 148); x.stroke();
    rr(x, 440, 66, 100, 12, 6); x.fill();
    rr(x, 440, 88, 104, 6, 3); x.fill(); rr(x, 440, 102, 84, 6, 3); x.fill();
    rr(x, 440, 120, 96, 28, 14); x.stroke();
    x.font = `600 12px ${F.mono}`; x.textAlign = 'center'; x.fillText('Anfrage', 488, 139); x.textAlign = 'left';
    rr(x, 306, 160, 238, 6, 3); x.fill(); rr(x, 306, 174, 180, 6, 3); x.fill();
    // Notizen (v3 in Handschrift, in v4 in Archivo)
    x.font = `500 21px ${F.schrift}`;
    x.fillText('Handy zuerst', 578, 70, 150);
    x.fillText('Knopf gross', 578, 150, 150);
    x.fillText('Weg zur Anfrage', 300, 286, 220);
    x.lineWidth = 2.5; x.beginPath(); x.moveTo(296, 276); x.bezierCurveTo(262, 262, 250, 240, 214, 252); x.stroke();
    pfeil(x, 236, 246, 210, 254);
    x.beginPath(); x.moveTo(574, 142); x.bezierCurveTo(560, 132, 552, 132, 544, 134); x.stroke();
    // eigene Striche der Besucher
    x.lineWidth = 3; x.strokeStyle = '#FFFFFF';
    eigeneStriche.forEach(s => strichZeichnen(x, s));
  });
  // Blaupause zur Kamera gedreht (v3-Fix), etwas nach links hinten, damit sie das Hologramm nicht schneidet
  const planWand = grp(35.2, 0, -6.6); planWand.rotation.y = -0.45;
  cyl(0.08, 0.75, C.schiefer, -3.4, 0, 0.05, planWand); cyl(0.08, 0.75, C.schiefer, 3.4, 0, 0.05, planWand);
  const tafel = tbox(7.4, 3.4, 0.18, C.kobaltTief, 4, planTex.tex, 0, 0.7, 0, planWand, true);
  tafel.userData.tafel = true;
  // Drahtgitter-Hologramm: die einzige Stelle mit Linien
  cyl(1.3, 0.38, C.papier, 40.5, 0, -5.4, null, 0.12); cyl(1.36, 0.12, C.kobalt, 40.5, 0.14, -5.4, null, 0.05);
  const holo = grp(40.5, 0.38, -5.4);
  const holoMat = new THREE.MeshBasicMaterial({ color: C.himmel, transparent: true, opacity: 0.2, depthWrite: false });
  const holoLinie = new THREE.LineBasicMaterial({ color: C.kobalt });
  const holoTeile = [];
  [[pgeo(2.4, 1.5, 0.08), -0.35, 0.55, 0], [pgeo(2.2, 0.18, 0.1), -0.35, 1.82, 0], [pgeo(1.1, 0.62, 0.1), -0.82, 1.05, 0.02],
   [pgeo(0.8, 0.12, 0.1), 0.25, 1.48, 0.02], [pgeo(0.5, 0.2, 0.12), 0.1, 0.8, 0.03], [pgeo(0.7, 1.4, 0.08), 1.45, 0.55, 0.35]].forEach((d, i) => {
    const g = grp(d[1], d[2], d[3], holo);
    const m = mk(d[0], holoMat, 0, 0, 0, g); m.userData.ohneSchatten = true;
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(d[0], 28), holoLinie); g.add(l);
    holoTeile.push({ g, y: d[2], i });
  });
  const planBot = makeBot({ x: 33.2, z: -4.3, face: faceTo(-0.3, -1) + 0.9, mode: 'point', name: 'PLAN', station: 3,
    lines: ['Zuerst der Plan, dann das Bild.', 'Am Handy muss es zuerst funktionieren.', 'Der Knopf ist mindestens 44 Pixel gross.', 'Zeichnen Sie ruhig mit. Ich mag Skizzen.'] });
  makeBot({ x: 39.0, z: -3.7, path: [[39.0, -3.7], [37.4, -2.05]], waitFace: [Math.PI, CAMF], carry: C.kobalt, name: 'SKIZZE', station: 3,
    lines: ['Der Plan geht zur Werkbank.', 'Ihre Bilder kommen hier rein, nicht Fotos aus dem Netz.'] });

  /* ================= Station 4, Bau (Frame B) ================= */
  CUR = FB;
  /* Farben der Mini-Seiten nach v4-04-identitaeten.md: Pizzeria Tondo, Achsmass Architekten, Hebel */
  const STILE = {
    tondo: { grund: '#F2F4F0', kopf: '#11181B', bild: '#1E2B30', titel: '#11181B', text: '#B9C0BE', knopf: '#FFD84A', fuss: '#1E2B30' },
    achsmass: { grund: '#F5F6F4', kopf: '#121416', bild: '#DADDD8', titel: '#121416', text: '#A3A7AA', knopf: '#C8462E', fuss: '#121416' },
    hebel: { grund: '#F4F0E8', kopf: '#2340FF', bild: '#DCE1FF', titel: '#15140F', text: '#C9C2B4', knopf: '#2340FF', fuss: '#DDD4C6' },
  };
  const STIL_FOLGE = ['tondo', 'achsmass', 'hebel'];
  const BLOECKE = [[0, 0, 256, 16, 'kopf'], [12, 24, 232, 52, 'bild'], [12, 84, 150, 12, 'titel'], [12, 102, 200, 6, 'text'], [12, 112, 170, 6, 'text'], [12, 124, 70, 16, 'knopf'], [0, 150, 256, 20, 'fuss']];
  const monitore = [];
  const deskX = [50.5, 54, 57.5];
  deskX.forEach((dx, i) => {
    const m = { stil: STIL_FOLGE[i], n: 2 + i * 2, t: Math.random() * 0.4, phase: 'bau', scroll: 0, blitz: 0 };
    // Ohne nachgezeichnete Browserleiste (Hallmark-Regel im gemeinsamen Teil): die Mini-Seite füllt den Bildschirm
    m.api = canvasTex(256, 160, (x, w, h) => {
      const s = STILE[m.stil];
      x.fillStyle = s.grund; x.fillRect(0, 0, w, h);
      x.save(); x.beginPath(); x.rect(0, 0, w, h); x.clip(); x.translate(0, 1 - m.scroll); x.scale(1, 0.93);
      for (let b = 0; b < m.n && b < BLOECKE.length; b++) {
        const [bx, by, bw, bh, art] = BLOECKE[b];
        x.fillStyle = s[art];
        if (art === 'kopf' || art === 'fuss') x.fillRect(bx, by, bw, bh); else { rr(x, bx, by, bw, bh, Math.min(6, bh / 2)); x.fill(); }
        if (b === m.n - 1 && m.blitz > 0) { x.globalAlpha = m.blitz / 0.25; x.fillStyle = '#E6E9FF'; x.fillRect(bx, by, bw, bh); x.globalAlpha = 1; }
      }
      x.restore();
    });
    box(2.6, 0.12, 1.3, C.papier, dx, 0.76, -5);
    [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]].forEach(p => cyl(0.06, 0.76, C.schiefer, dx + p[0], 0, -5 + p[1]));
    cyl(0.07, 0.45, C.schiefer, dx, 0.88, -5.3); box(0.6, 0.05, 0.4, C.schiefer, dx, 0.88, -5.3);
    tbox(1.75, 1.08, 0.1, C.dunkel, 4, m.api.tex, dx, 1.2, -5.35);
    box(1.0, 0.05, 0.35, C.sand, dx, 0.88, -4.72, null, 0.02);
    treffer(1.9, 1.3, 0.5, dx, 1.15, -5.35, null, { aktion: 'monitor', m, zeiger: 'klick', station: 4 });
    monitore.push(m);
  });
  const bauZitate = [
    ['Zwischenstand kommt, bevor etwas fertig ist.', 'Ihre Texte, Ihre Bilder, mein Handwerk.', 'Ein Projekt nach dem anderen.'],
    ['Diese Seite lädt nichts von fremden Servern.', 'Schriften liegen bei uns, nicht bei Google.', 'Das Formular schreibt in eine Datenbank in Frankfurt.'],
    ['Der Reservierungsknopf sitzt jetzt richtig.', 'Ich baue zuerst das Handy.', 'Noch ein Zwischenstand, dann schauen Sie drüber.'],
  ];
  const bauBots = deskX.map((dx, i) => makeBot({ x: dx, z: -3.8, face: Math.PI, mode: 'type', name: `BAU-${i + 1}`, station: 4, lines: bauZitate[i] }));
  const bote2Blatt = box(0.7, 0.07, 0.5, C.weiss, 0, 1.62, 0, bauBots[1].body, 0.03); bote2Blatt.visible = false;
  // Zwischenstand-Leuchte mit Briefkasten "an Sie"
  let zwBlink = 0;
  const zwTex = canvasTex(360, 70, (x, w, h) => {
    const an = zwBlink > 0;
    x.fillStyle = an ? '#2340FF' : '#FAFAF8'; x.fillRect(0, 0, w, h);
    x.fillStyle = an ? '#FFFFFF' : '#0B0B0C'; x.font = `850 34px ${F.schrift}`; breit(x, 'expanded');
    x.textAlign = 'center'; x.fillText('Zwischenstand', w / 2, 47, 330);
  });
  cyl(0.05, 4.75, C.schiefer, 52.3, 0, -5.95); cyl(0.05, 4.75, C.schiefer, 55.7, 0, -5.95);
  box(3.7, 0.08, 0.14, C.schiefer, 54, 4.7, -5.95, null, 0.03);
  tbox(3.6, 0.7, 0.1, C.weiss, 4, zwTex.tex, 54, 3.95, -5.95);
  const anSieTex = canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, h); x.fillStyle = '#FFFFFF'; x.font = `600 22px ${F.mono}`; x.textAlign = 'center'; x.fillText('an Sie', w / 2, 40); });
  cyl(0.06, 0.9, C.schiefer, 56.4, 0, -1.75);
  tbox(0.62, 0.42, 0.42, C.kobalt, 4, anSieTex.tex, 56.4, 0.9, -1.75);
  let zwUhr = 0;
  // Roboterarm
  const arm = (() => {
    const g = grp(52.3, 0, -2.35);
    cyl(0.58, 0.38, C.papier, 0, 0, 0, g, 0.12);
    const turm = grp(0, 0.38, 0, g); cyl(0.42, 0.3, C.kobalt, 0, 0, 0, turm, 0.1);
    const schulter = grp(0, 0.45, 0, turm); sph(0.26, C.kobalt, 0, 0, 0, schulter); cyl(0.16, 1.5, C.papier, 0, 0, 0, schulter, 0.08);
    const ellbogen = grp(0, 1.5, 0, schulter); sph(0.22, C.kobalt, 0, 0, 0, ellbogen); cyl(0.13, 1.25, C.papier, 0, 0, 0, ellbogen, 0.07);
    const hand = grp(0, 1.25, 0, ellbogen); sph(0.16, C.kobalt, 0, 0, 0, hand);
    box(0.5, 0.16, 0.3, C.schiefer, 0, 0.05, 0, hand); box(0.1, 0.3, 0.14, C.schiefer, 0.18, -0.25, 0, hand); box(0.1, 0.3, 0.14, C.schiefer, -0.18, -0.25, 0, hand);
    const block = box(0.3, 0.06, 0.24, C.himmel, 0, -0.32, 0, hand, 0.02);
    return { turm, schulter, ellbogen, hand, block };
  })();

  /* ================= Station 5, Prüfung (Frame B) ================= */
  const QX = TH[4];
  box(1.4, 3.6, 0.7, C.papier, QX, 0, -1.95, null, 0.3); box(1.4, 3.6, 0.7, C.papier, QX, 0, 1.95, null, 0.3); box(1.4, 0.9, 4.6, C.papier, QX, 3.4, 0, null, 0.4);
  const kapsel = mk(capgeo(0.2, 1.6), mat(C.kobalt, 0.45), QX, 4.42, 0.8); kapsel.rotation.x = Math.PI / 2;
  const pruef = { zeilen: [true, true, true], fortschritt: 0, aus: false, alt: -1 };
  const pruefTex = canvasTex(256, 200, (x, w, h) => {
    x.fillStyle = '#0B0B0C'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#8C8E93'; x.font = `17px ${F.mono}`; x.fillText('PRÜFUNG', 18, 32);
    ['Lesbar am Handy', 'Lädt schnell', 'Formular kommt an'].forEach((t, i) => {
      const y = 66 + i * 30;
      if (pruef.zeilen[i]) haken(x, 28, y - 6, 9, true); else kreuz(x, 28, y - 6, 9);
      x.fillStyle = pruef.zeilen[i] ? '#EDEDEA' : '#FF8A7D'; x.font = `15px ${F.mono}`; x.fillText(t, 46, y);
    });
    x.fillStyle = '#2B2C2F'; rr(x, 18, 150, 220, 10, 5); x.fill();
    x.fillStyle = pruef.aus ? '#D93A2B' : '#2340FF'; rr(x, 18, 150, Math.max(10, 220 * pruef.fortschritt), 10, 5); x.fill();
    if (pruef.aus) { x.fillStyle = '#FF8A7D'; x.font = `14px ${F.mono}`; x.fillText('zurück an die Werkbank', 18, 186); }
  });
  tbox(1.3, 1.02, 0.06, C.dunkel, 4, pruefTex.tex, QX, 1.75, 2.3);   // v3-Fix: grösser, war unlesbar
  const knopf5 = cyl(0.12, 0.08, C.kobalt, QX + 0.35, 1.36, 2.3); knopf5.rotation.x = Math.PI / 2;
  const laserMat = new THREE.MeshBasicMaterial({ color: C.kobalt, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.7), laserMat); laser.rotation.y = Math.PI / 2; laser.position.set(QX, 2.05, 0); laser.userData.ohneSchatten = true; CUR.add(laser);
  const scanMat = new THREE.MeshBasicMaterial({ color: C.kobalt, transparent: true, opacity: 0.4 });
  const scan = box(0.12, 0.06, 3.2, scanMat, QX, 1, 0, null, 0.03); scan.userData.ohneSchatten = true;
  let laserRot = 0;
  const BIN = { x: 75.2, y: 0.9, z: -4.6 }; const BINW = toW(FB, BIN.x, BIN.y, BIN.z);
  box(1.9, 0.9, 1.7, C.karton, BIN.x, 0, BIN.z, null, 0.2); box(1.6, 0.03, 1.4, 0x9C6B3F, BIN.x, 0.89, BIN.z, null, 0.01);
  // Daumen-Test
  const daumen = { tipp: 0, gesendet: 0, druck: 0, zwang: 0 };
  const daumenTex = canvasTex(180, 340, (x, w, h) => {
    const sc = daumen.gesendet > 0 ? Math.min(1, (2.5 - daumen.gesendet) / 0.4) * 46 : 0;
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.save(); x.translate(0, -sc);
    x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, 46);
    x.fillStyle = '#FFFFFF'; x.font = `600 15px ${F.mono}`; x.fillText('Anfrage', 14, 29);
    x.fillStyle = '#E6E9FF'; rr(x, 14, 60, 152, 90, 10); x.fill();
    x.fillStyle = '#C9C6BE'; [168, 186, 204].forEach((y, i) => { rr(x, 14, y, [140, 120, 96][i], 8, 4); x.fill(); });
    x.fillStyle = daumen.druck > 0 ? '#1730D6' : '#2340FF'; rr(x, 14, 250, 152, 42, 21); x.fill();
    x.fillStyle = '#FFFFFF'; x.font = `600 14px ${F.mono}`; x.textAlign = 'center'; x.fillText('Anfrage senden', 90, 276); x.textAlign = 'left';
    x.fillStyle = '#C9C6BE'; rr(x, 14, 312, 110, 8, 4); x.fill(); rr(x, 14, 330, 80, 8, 4); x.fill();
    x.restore();
    if (daumen.gesendet > 0) {
      x.fillStyle = '#E8F5EE'; rr(x, 10, 230, 160, 96, 14); x.fill();
      haken(x, 34, 262, 13, true);
      x.fillStyle = '#0B0B0C'; x.font = `600 14px ${F.mono}`; x.fillText('Anfrage', 54, 258); x.fillText('gesendet', 54, 276);
      x.fillStyle = '#5B5D61'; x.font = `13px ${F.mono}`; x.fillText('(Demo)', 54, 300);
    }
  });
  // v3-Fix: Handy näher ans Tor, grösser und zur Kamera gedreht, damit der Daumen-Test lesbar ist
  const HX = 67.8, HZ = -2.5;
  const handyG = grp(HX, 0, HZ); handyG.rotation.y = 0.35;
  box(1.0, 0.08, 0.7, C.schiefer, 0, 0, -0.05, handyG); cyl(0.06, 1.0, C.schiefer, 0, 0.08, -0.12, handyG);
  const handyTafel = tbox(1.15, 2.17, 0.1, C.tinte, 4, daumenTex.tex, 0, 0.95, 0, handyG);
  treffer(1.4, 2.4, 1.0, 0, 0.9, 0.2, handyG, { aktion: 'handy', zeiger: 'klick', station: 5 });
  const daumenG = grp(0.42, 2.6, 0.7, handyG);   // seitlich, damit er die Handyseite nicht verdeckt
  const daumenMat = mat(C.weiss, 0.5);
  mk(capgeo(0.25, 0.44), daumenMat, 0, 0, 0, daumenG);
  const daumenSpitze = grp(0, -0.44, 0, daumenG); daumenSpitze.rotation.x = 0.28;
  mk(capgeo(0.23, 0.34), daumenMat, 0, 0, 0, daumenSpitze);
  sph(0.27, C.weiss, 0, 0.1, 0, daumenG);
  const pruefBot = makeBot({ x: 66.3, z: -3.4, face: faceTo(1.5, 0.9), mode: 'inspect', tool: 'lupe', name: 'PRÜFEN', station: 5,
    lines: ['Am Handy geprüft, mit dem Daumen.', 'Lesbar auch in der Sonne?', 'Kein Text über unruhigem Bild.', 'Das Formular kommt an. Ich habe es ausprobiert.'] });
  const zurueckBot = makeBot({ x: 76.8, z: -3.1, name: 'ZURÜCK', station: 5,
    lines: ['Das hier geht zurück. Der Knopf ist zu klein.', 'Lieber jetzt als bei Ihnen.', 'Zurück an die Werkbank, mit Begründung.'] });

  /* ================= Station 6, Übergabe (Frame B) ================= */
  /* Die Bildschirme zeigen Pizzeria Tondo und Achsmass Architekten, gezeichnet mit derselben Funktion wie
     die Vorschau im Einstieg (keine fremden Schriften, keine Fotos); der dritte bleibt "Ihr Betrieb". */
  const tondoTex = canvasTex(800, 500, (x) => zeichneVorschau(x, 'restaurant', 1, ''));
  const achsmassTex = canvasTex(800, 500, (x) => zeichneVorschau(x, 'architekt', 1, ''));
  const fuell = { t: 0, n: 0 };
  const ihrTex = canvasTex(440, 280, (x, w, h) => {
    const n = fuell.n;
    x.fillStyle = n > 0 ? '#FFFFFF' : '#FBFBFF'; x.fillRect(0, 0, w, h);
    const teile = [[20, 20, 400, 30, 'kopf'], [20, 62, 190, 120, 'bild'], [226, 70, 180, 22, 'titel'], [226, 104, 170, 10, 'z'], [226, 124, 140, 10, 'z'], [226, 150, 120, 32, 'knopf'], [20, 200, 400, 56, 'fuss']];
    teile.forEach((t, i) => {
      const [X, Y, bw, bh, art] = t;
      if (i < n) {
        x.fillStyle = art === 'kopf' || art === 'knopf' ? '#2340FF' : art === 'bild' ? '#E6E9FF' : art === 'titel' ? '#0B0B0C' : art === 'fuss' ? '#F4F0E8' : '#C9C6BE';
        rr(x, X, Y, bw, bh, art === 'knopf' ? 16 : 6); x.fill();
        if (art === 'kopf') { x.fillStyle = '#FFFFFF'; x.font = `850 16px ${F.schrift}`; x.fillText('Ihr Betrieb', 34, 41); }
        if (art === 'titel') { x.fillStyle = '#FFFFFF'; x.fillRect(X, Y, bw, bh); x.fillStyle = '#0B0B0C'; x.font = `850 24px ${F.schrift}`; x.fillText('Ihr Betrieb', X, Y + 20, bw); }
        if (art === 'knopf') { x.fillStyle = '#FFFFFF'; x.font = `600 14px ${F.mono}`; x.textAlign = 'center'; x.fillText('Anfrage', X + bw / 2, Y + 21); x.textAlign = 'left'; }
      } else {
        x.setLineDash([8, 6]); x.strokeStyle = 'rgba(35,64,255,.55)'; x.lineWidth = 2;
        rr(x, X, Y, bw, bh, 6); x.stroke(); x.setLineDash([]);
      }
    });
    if (n === 0) {
      x.fillStyle = 'rgba(251,251,255,.86)'; rr(x, 92, 98, 256, 92, 14); x.fill();
      x.fillStyle = '#2340FF'; x.font = `850 34px ${F.schrift}`; breit(x, 'expanded'); x.textAlign = 'center'; x.fillText('Ihre Website', w / 2, 142, 240); breit(x, 'normal');
      x.font = `15px ${F.mono}`; x.fillText('hier als Nächstes', w / 2, 172); x.textAlign = 'left';
    }
  });
  const rahmenMat = new THREE.MeshStandardMaterial({ color: C.kobalt, emissive: C.kobalt, emissiveIntensity: 0.15, roughness: 0.5 });
  const PX = [84.6, 88.4, 92.2], PZ = -5.7;
  const PFARBE = [C.zitrone, C.roetel, C.kobalt];
  const PTEX = [tondoTex, achsmassTex, ihrTex];
  const geraete = PX.map((px, i) => {
    box(2.6, 0.62, 1.7, C.papier, px, 0, PZ, null, 0.25);
    box(2.7, 0.16, 1.8, PFARBE[i], px, 0.6, PZ, null, 0.07);
    const g = grp(px, 0.76, PZ);
    box(0.8, 0.12, 0.5, C.schiefer, 0, 0, 0, g); cyl(0.06, 0.3, C.schiefer, 0, 0.1, 0, g);
    tbox(2.2, 1.4, 0.1, i === 2 ? rahmenMat : C.dunkel, 4, PTEX[i].tex, 0, 0.36, 0, g);
    treffer(2.6, 2.7, 1.8, px, 0, PZ, null, { aktion: 'podest', welches: i, zeiger: 'oeffnen', station: 6 });
    return g;
  });
  // Der grosse Hebel
  cyl(1.5, 0.32, C.papier, 96.2, 0, -6, null, 0.12); cyl(1.56, 0.12, C.kobalt, 96.2, 0.12, -6, null, 0.05);
  box(0.18, 1.2, 0.9, C.schiefer, 95.85, 0.32, -6, null, 0.06); box(0.18, 1.2, 0.9, C.schiefer, 96.55, 0.32, -6, null, 0.06);
  const achseM = cyl(0.12, 0.9, C.kobalt, 95.75, 1.22, -6, null, 0.04); achseM.rotation.z = -Math.PI / 2;
  const hebelArm = grp(96.2, 1.22, -6);
  cyl(0.11, 2.6, C.papier, 0, 0, 0, hebelArm, 0.05);
  sph(0.32, C.kobalt, 0, 2.7, 0, hebelArm);
  const dreieck = mk(dreieckGeo(1.1, 0.24), mat(C.weiss), 96.2, 0.0, -4.32); dreieck.position.z -= 0.12;
  treffer(2.2, 3.8, 2.4, 96.2, 0, -6, null, { aktion: 'hebel', zeiger: 'ziehen', station: 6 });
  const hebel = { w: 0.55, zustand: 'ruhe', t: 0, start: 0.55, auto: 0, zieh: -1 };
  const FRONT6 = CAMF - FB.rotation.y;          // Drehung, bei der ein Bildschirm in Frame B frontal zur Kamera steht
  const FUELL_DAUER = 5.2;                      // fertige Seite bleibt nach dem Aufbau rund 3 s stehen
  // Konfetti (Pool)
  const konfGeo = pgeo(0.16, 0.025, 0.1);
  const konfMats = [mat(C.kobalt, 0.5), mat(C.weiss, 0.5), mat(C.butter, 0.5)];
  const konfetti = [];
  for (let i = 0; i < 60; i++) {
    const m = mk(konfGeo, konfMats[i % 3], 0, 0, 0, FB); m.visible = false; m.userData.ohneSchatten = true;
    konfetti.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 });
  }
  let rahmenGlanz = 0;
  const uebergabe1 = makeBot({ x: 94.2, z: -4.0, face: faceTo(1, -1) - 0.6, name: 'ÜBERGABE-1', station: 6,
    lines: ['Domain, Inhalte, Code und Zugänge gehören Ihnen.', 'Ziehen Sie den Hebel, wenn Sie nicht warten wollen.', 'Wechseln Sie später, nehmen Sie alles mit.'] });
  const uebergabe2 = makeBot({ x: 90.3, z: -3.6, mode: 'wave',   // v3-Fix: zwischen den Podesten
    name: 'ÜBERGABE-2', station: 6,
    lines: ['Tondo ist fertig. Erfunden, aber fertig.', 'Achsmass Architekten steht auch. Ebenfalls erfunden.', 'Das leere Podest ist für Sie.', 'Klicken Sie auf einen Bildschirm, dann öffnet sich das Beispiel.'] });
  CUR = welt;

  /* ================= Helfer ausserhalb der Stationen ================= */
  makeBot({ x: 3, z: 3.7, path: [[3, 3.7], [44, 3.7]], waitFace: [CAMF, CAMF], speed: 2.1, carry: C.weiss, name: 'BOTE-1', station: 0,
    lines: ['Ich bringe Ihre Rückmeldung zur nächsten Station.', 'Nichts geht zwischen den Schritten verloren.'] });
  makeBot({ x: TX + RC - 3.7, z: 58, path: [[TX + RC - 3.7, 58], [TX + RC - 3.7, 15]], waitFace: [CAMF, CAMF], speed: 2.1, carry: C.butter, name: 'BOTE-2', station: 0,
    lines: ['Rückmeldung aus der Prüfung, zurück an die Werkbank.', 'Unterwegs zur nächsten Station.'] });
  makeBot({ x: -8.2, z: 3.2, mode: 'wave', name: 'EMPFANG', station: 0,
    lines: ['Grüezi! Hier kommt Ihre Anfrage aufs Band.', 'Klicken Sie eine Station an, dann sehen Sie, was dort passiert.', 'Jede Website beginnt mit einer Anfrage.'] });
  /* Wer bei einer Stationswahl jubelt (der erste Helfer der Station) */
  const hauptHelfer = [null, zuhoeren, angebotBot, planBot, bauBots[0], pruefBot, uebergabe1];

  /* ---------- Stationsflächen zum Anklicken und Fokus-Ring (neu) ---------- */
  const stationZiele = [];
  function rundRechteck(s, w, h, r) {
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  }
  const ringForm = new THREE.Shape(); rundRechteck(ringForm, 16.8, 14.8, 1.5);
  const ringLoch = new THREE.Path(); rundRechteck(ringLoch, 15.8, 13.8, 1.0); ringForm.holes.push(ringLoch);
  const fokusGeo = new THREE.ShapeGeometry(ringForm, 8); fokusGeo.rotateX(-Math.PI / 2);
  const fokusRinge = SX.map((x, i) => {
    let r = null;
    inFrame(i, () => {
      const z = mk(pgeo(15.4, 4.6, 13.4), trefferMat, x + 0.5, 0, -2);
      z.userData = { station: i + 1 }; stationZiele.push(z);
      const m = new THREE.Mesh(fokusGeo, new THREE.MeshBasicMaterial({ color: C.kobalt, transparent: true, opacity: 0, depthWrite: false }));
      m.position.set(x + 0.5, 0.1, -2); m.userData.ohneSchatten = true; m.visible = false; m.renderOrder = 2;
      CUR.add(m);
      r = { m, a: 0, s: 0.9, zielA: 0, von: null, bis: null, t0: 0, dauer: 1 };
    });
    return r;
  });
  function ringZiel(r, a, s, dauer) { r.von = { a: r.a, s: r.s }; r.bis = { a, s }; r.zielA = a; r.t0 = jetztMs(); r.dauer = dauer; }

  /* ---------- Schatten ---------- */
  welt.traverse(o => {
    if (!o.isMesh || o.userData.istBoden) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (o.userData.ohneSchatten || o.material === trefferMat || o.material === schattenMat || ms.some(m => m.transparent)) return;
    o.castShadow = true; o.receiveShadow = true;
  });

  /* ---------- Beschriftungen ---------- */
  const schilder = [];
  function schild(htmlText, x, y, z, cls, frame, station) {
    const el = document.createElement('div');
    el.className = 'wl ' + cls; el.innerHTML = htmlText;
    el.style.opacity = '0';   // erst sichtbar, wenn das erste Bild es an seinen Platz gesetzt hat
    schilderEl.appendChild(el);
    schilder.push({ el, p: toW(frame || welt, x, y, z), station: station || 0, w: 0, h: 0, weg: true, an: false });
  }
  STATIONEN.forEach((s, i) => schild(`<b>${zwei(i + 1)}</b>${s.name}`, SX[i] + 6, 0.1, -8.5, 'station', FR[i], i + 1));
  schild('Ihre Anfrage', -11, 4.2, 0, 'schild warm');
  schild('Übergabe', 98.8, 3.2, 0, 'schild', FB);
  schild('Zurück an die Werkbank', 75.2, 1.3, -4.6, 'schild', FB);
  schild('Zwischenstand', 54, 3.1, -5.6, 'schild', FB);
  schild('Seitenplan', 35.2, 4.5, -6.5, 'schild');
  schild('Festpreis', 21, 3.0, -5.4, 'schild');
  schild('Tondo, Pizzeria', PX[0], 2.75, PZ, 'schild', FB);
  schild('Achsmass, Architekturbüro', PX[1], 2.75, PZ, 'schild', FB);
  schild('Ihr Betrieb', PX[2], 2.75, PZ, 'schild kobalt', FB);
  schild('Hebel ziehen', 96.2, 4.5, -6, 'schild warm', FB);

  /* ---------- Kamera wie v3 (werkstatt.js 1339 bis 1383), nur ohne Scroll ----------
     buildKeys, dwell, camAt und applyCam mit den v3-Werten: Höhe h (Einheiten, die der Canvas hoch zeigt),
     Versätze ox und oy (Anteil von Breite und Höhe), die v3-Korrekturen für Station 5 und 6, die Handy-Werte,
     Schatten-Nachführung, zoom (Podest) und schub (Füllen an Station 6). K[0] ist der Einlauf (in v3 der
     Anfang der Seite), K[1] bis K[6] die Stationen; u = n zeigt Station n. "Handy" heisst hier wie im CSS
     unter 820 px (Canvas 4:5); v3 nahm die Fensterbreite unter 760 px, weil sein Canvas das ganze Fenster war. */
  let W = 1, H = 1, K = [], curH = 15.5, schattenGroesse = 0, zoom = null, ZIEL6 = null, schub = 0, fern = false;
  const kipp = 0;   // v3 kippte die Kamera bei schnellem Scroll mit; hier hängt nichts am Scroll
  const tgt = new THREE.Vector3();
  const par = { x: 0, y: 0, zx: 0, zy: 0 };   // Parallaxe wie v3: par.x und par.y laufen dem Zeiger nach (zx, zy)
  function buildKeys() {
    const a = W / H, mob = SCHMAL.matches;
    const stH = mob ? clamp(24 / a * 0.62, 20, 34) : 15.5;
    K = [mob ? { x: -6, z: 0, h: clamp(26 / a * 0.62, 22, 40), ox: 0.1, oy: -0.22 } : { x: -11, z: 0, h: 21, ox: -0.07, oy: 0.22 }];
    SX.forEach((x, i) => {
      // v3-Fix: Station 5 rückt das Handy ins Bild; Station 6 ist für die Kamera gebaut: näher, Hebel und "Ihr Betrieb" frei
      const s = i === 4 ? { x: 71.7, z: -3.4, h: stH * (mob ? 0.92 : 0.93), ox: mob ? 0.02 : 0.07, oy: mob ? -0.18 : 0.06 }
        : i === 5 ? (mob ? { x: 94.4, z: -5.6, h: clamp(7.85 / a, 14, 22), ox: 0, oy: -0.1 } : { x: 93.4, z: -5.4, h: clamp(10.5 * 1.6 / a, 9, 13), ox: 0.07, oy: 0.1 })
        : { x: x + 1.2, z: -3.4, h: stH, ox: mob ? 0.02 : 0.07, oy: mob ? -0.25 : -0.02 };
      const w = toW(FR[i], s.x, 0, s.z);
      K.push({ x: w.x, z: w.z, h: s.h, ox: s.ox, oy: s.oy });
    });
    ZIEL6 = toW(FB, PX[2], 0, PZ);
  }
  function dwell(f) { const d = 0.2; if (f <= d) return 0; if (f >= 1 - d) return 1; return smooth((f - d) / (1 - 2 * d)); }
  function camAt(u) {
    const i = Math.min(5, Math.floor(u)), f = u - i, e = dwell(f), A = K[i], B = K[i + 1];
    let h = lerp(A.h, B.h, e);
    if (i >= 1 && i <= 5) h += Math.sin(Math.PI * e) * 5;     // zwischen Stationen kurz rauszoomen (auch 5 bis 6), nach 6 nicht
    return { x: lerp(A.x, B.x, e), z: lerp(A.z, B.z, e), h, ox: lerp(A.ox, B.ox, e), oy: lerp(A.oy, B.oy, e) };
  }
  function applyCam(u) {
    const c = camAt(clamp(u, 0, 6));
    let h = c.h, cx = c.x, cz = c.z;
    if (zoom) { const q = smooth(clamp(zoom.t / 0.25, 0, 1)); h *= 1 - 0.3 * q; cx = lerp(cx, zoom.ziel.x, q * 0.6); cz = lerp(cz, zoom.ziel.z, q * 0.6); }
    else if (schub > 0.001 && ZIEL6) {   // Finale: beim Füllen ein Stück näher an "Ihr Betrieb", nur an Station 6
      const q = smooth(schub) * clamp((u - 5.7) / 0.3, 0, 1);
      h *= 1 - 0.16 * q; cx = lerp(cx, ZIEL6.x, q * 0.22); cz = lerp(cz, ZIEL6.z, q * 0.22);
    }
    const vw = h * W / H; curH = h;
    tgt.set(cx, 0, cz).addScaledVector(RECHTS, c.ox * vw).addScaledVector(OBEN, (c.oy + kipp) * h)
      .addScaledVector(RECHTS, par.x * 0.5).addScaledVector(OBEN, par.y * 0.35);
    cam.left = -vw / 2; cam.right = vw / 2; cam.top = h / 2; cam.bottom = -h / 2;
    cam.position.copy(tgt).addScaledVector(DIR, 150); cam.lookAt(tgt); cam.updateProjectionMatrix();
    cam.updateMatrixWorld();   // Raycast und Schilder im selben Bild brauchen die neue Lage
    const fx = tgt.x - tgt.y * DIR.x / DIR.y, fz = tgt.z - tgt.y * DIR.z / DIR.y;
    sonne.target.position.set(fx, 0, fz); sonne.position.set(fx, 0, fz).add(SUN_OFF);
    const s = Math.ceil(h * Math.max(1, W / H) * 0.6 / 2) * 2;
    if (s !== schattenGroesse) { schattenGroesse = s; const sc = sonne.shadow.camera; sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.updateProjectionMatrix(); }
  }

  /* ---------- Kamerafahrt: u gleitet zur Station oder blendet über ----------
     Gleiten: von der aktuellen Stelle aus (unterbrechbar), Kurve power2.inOut wie GSAP, Dauer gleitDauer.
     Gerechnet im Takt der Render-Schleife an der Uhr (performance.now): GSAP ist auf der Hebel-Seite nicht
     geladen, und die Fahrt steht so mit der Schleife still, wenn Bühne oder Tab nicht sichtbar sind.
     Überblenden: Bühne in der halben Dauer aus, dann springt u, in der anderen Hälfte wieder ein (Ruhig-Modus
     200 ms, automatischer Sprung von 6 auf 1 300 ms). */
  const kam = { u: ein.start || 1, von: 0, nach: 0, ende: 0, t0: 0, dauer: 0 };   // dauer 0: die Kamera steht
  let blende = null;
  function blendeFertig() { if (!blende) return; kam.u = blende.ziel; blende = null; buehne.style.opacity = ''; }
  /* camAt hält die Kamera in der Haltezone n ± 0.2 jeder Station still (dwell, wie v3 beim Scrollen). Liefe u von
     n bis k, stünde das Bild nach dem Klick erst still (von 1 nach 4: 0.43 s) und käme vor dem Ende der Fahrt an
     (1.27 s statt 1.7 s, in Node gemessen). Darum fährt u vom Rand der Haltezone der Startstation zum Rand der
     Haltezone der Zielstation und springt am Schluss auf k; das Bild ist an beiden Rändern dasselbe wie an n und k. */
  const HALT = 0.2;
  function gleiten(k) {
    blendeFertig();
    if (kam.dauer > 0 && kam.nach === k) return;   // fährt schon dorthin
    const r = Math.sign(k - kam.u);
    if (Math.abs(k - kam.u) <= HALT) { kam.u = k; kam.dauer = 0; return; }   // schon im Bild der Station
    const dauer = gleitDauer(kam.u, k) * 1000;
    const n = Math.round(kam.u);
    kam.von = Math.abs(kam.u - n) <= HALT ? n + r * HALT : kam.u;
    kam.u = kam.von; kam.nach = k; kam.ende = k - r * HALT; kam.t0 = jetztMs(); kam.dauer = dauer;
    wecken(kam.dauer + 400);
  }
  function ueberblenden(k, ms) {
    blendeFertig();
    kam.dauer = 0;   // eine laufende Fahrt endet dort, wo sie gerade ist
    blende = { t0: jetztMs(), dauer: ms, ziel: k, gesprungen: false };
    wecken(ms + 400);
  }
  function kameraSchritt(jetzt) {
    if (kam.dauer > 0) {
      const p = clamp((jetzt - kam.t0) / kam.dauer, 0, 1);
      kam.u = lerp(kam.von, kam.ende, power2inOut(p));
      if (p >= 1) { kam.u = kam.nach; kam.dauer = 0; }
    }
    if (blende) {
      const p = clamp((jetzt - blende.t0) / blende.dauer, 0, 1);
      if (p >= 0.5 && !blende.gesprungen) { blende.gesprungen = true; kam.u = blende.ziel; }
      if (p >= 1) { blende = null; buehne.style.opacity = ''; }
      else buehne.style.opacity = Math.abs(1 - 2 * p).toFixed(3);
    }
  }

  /* ---------- Sprechblase (aus v3, relativ zur Bühne) ---------- */
  const bName = $('.b-name', blase), bText = $('.b-text', blase);
  const PLAUDER_ABSTAND = 4.5;   // Sekunden zwischen zwei Sprechblasen
  let blaseBot = null, blaseZeit = 0, letztesPlaudern = 1.2 - PLAUDER_ABSTAND, uhr = 0;
  function sage(b, text) {
    blaseBot = b; blaseZeit = 3.8; bName.textContent = b.name; bText.textContent = text;
    blase.classList.add('zeigen'); letztesPlaudern = uhr;
    wecken(4200);
  }
  /* v3-Fix: Blase weicht aus. Sie rutscht nie unter Leiste, Karte oder Tempo-Leiste und legt sich nicht
     über das, was an der gewählten Station frei bleiben muss. */
  let hudFlaechen = [];
  const schneidet = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const SCHUTZ = [[1, notizTafel], [3, tafel], [5, handyTafel], [6, geraete[2]], [6, hebelArm]];
  const sbox = new THREE.Box3(), secke = new THREE.Vector3();
  function schutzFlaechen() {
    const out = [];
    for (const [st, obj] of SCHUTZ) {
      if (st !== hud.fokus()) continue;
      sbox.setFromObject(obj);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        secke.set(i & 1 ? sbox.max.x : sbox.min.x, i & 2 ? sbox.max.y : sbox.min.y, i & 4 ? sbox.max.z : sbox.min.z);
        const [x, y] = projiziere(secke); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      out.push([x0, y0, x1, y1]);
    }
    return out;
  }
  function blaseWeg() { blaseZeit = 0; blase.classList.remove('zeigen'); }
  function blaseSetzen() {
    const b = blaseBot;
    b.root.getWorldPosition(wp); const fussY = wp.y;
    wp.y = fussY + (1.75 + b.hop.position.y) * b.S;
    const [x, y] = projiziere(wp);
    wp.y = fussY; const [, fy] = projiziere(wp);
    if (x < 0 || x > W || y < 0 || fy > H) { blaseWeg(); return; }   // Helfer nicht im Bild
    const bw = blase.offsetWidth, bh = blase.offsetHeight;
    const halb = Math.min(W / 2, bw / 2 + 8), xk = clamp(x, halb, W - halb);
    const schutz = schutzFlaechen();
    const kandidaten = [[y - 12 - bh, false], [fy + 16, true]];
    const rechteck = t => [xk - bw / 2, t, xk + bw / 2, t + bh];
    const imBild = r => r[1] >= 0 && r[3] <= H;
    const frei = r => imBild(r) && !hudFlaechen.some(f => schneidet(r, f)) && !schutz.some(f => schneidet(r, f));
    let wahl = kandidaten.find(k => frei(rechteck(k[0])));
    if (!wahl) wahl = kandidaten.find(k => imBild(rechteck(k[0])) && !hudFlaechen.some(f => schneidet(rechteck(k[0]), f)));
    if (!wahl) { blaseWeg(); return; }
    blase.classList.toggle('unten', wahl[1]);
    blase.style.transform = `translate3d(${(xk - bw / 2).toFixed(1)}px,${wahl[0].toFixed(1)}px,0)`;
    blase.style.setProperty('--zipfel', `${clamp(x - xk, -halb + 18, halb - 18).toFixed(1)}px`);
  }
  function zitat(b) { let t; let n = 0; do { t = pick(b.lines); n++; } while (b.lines.length > 1 && t === b.letzt && n < 12); b.letzt = t; return t; }

  /* ---------- Aktionen der Besucher (aus v3) ---------- */
  function stempelAusloesen() { if (stempel.t < 2.2) { stempel.t = 2.2; stempel.manuell = true; sage(angebotBot, 'Danke, das Blatt war bereit.'); } }
  function handyTipp() { daumen.zwang = 0.32; daumen.gesendet = 2.5; }
  /* Podest öffnen wie v3: die Kamera zoomt 0.25 s auf das Gerät, die Bühne blendet aus, dann folgt der Link */
  function oeffne(i) {
    if (i === 2) { hud.ihrBetrieb(); return; }
    const url = i === 0 ? '/hebel-vorschau/v4/beispiele/tondo/' : '/hebel-vorschau/v4/beispiele/achsmass/';
    blendeFertig(); kam.dauer = 0;
    zoom = { t: 0, ziel: geraete[i].getWorldPosition(new THREE.Vector3()) };
    wecken(600);
    setTimeout(() => { location.href = url; }, 260);
  }
  addEventListener('pageshow', e => { if (e.persisted) { zoom = null; buehne.style.opacity = ''; wecken(); } });
  function effekteHebel() {
    fuell.t = 0.0001; fuell.n = 1; ihrTex.draw();
    rahmenGlanz = 0.9;   // Rahmen leuchtet rund 3 s nach
    // Konfetti auch im Ruhig-Modus: es folgt auf eine Handlung des Besuchers, es läuft nicht von selbst
    konfetti.forEach(p => {
      const r = Math.random, a = r(), b = r(), c = r();
      p.m.position.set(PX[2] + (a - 0.5) * 1.8, 0.85, PZ + (b - 0.5) * 1.1);
      p.v.set((a - 0.5) * 3.4, 4.4 + c * 3.6, (b - 0.5) * 3.4);
      p.w.set(r() * 10 - 5, r() * 10 - 5, r() * 10 - 5);
      p.life = 1.8 * (0.75 + 0.25 * r()); p.m.visible = true;
    });
    uebergabe1.cheer = 3; uebergabe2.cheer = 3;
    sage(uebergabe1, 'So schnell geht es bei Ihnen nicht. Aber genau so fühlt es sich an.');
    wecken(FUELL_DAUER * 1000 + 600);
  }
  function hebelAusloesen() {
    if (hebel.zustand === 'schwung' || hebel.zustand === 'halt') return;
    hebel.zustand = 'schwung'; hebel.t = 0; hebel.start = hebel.w; hebel.auto = 0;
    wecken();
  }
  function aktion(d) {
    if (d.bot) { d.bot.hopT = 0; sage(d.bot, zitat(d.bot)); return; }
    if (d.aktion === 'podest' && d.welches !== 2) { oeffne(d.welches); return; }
    if (d.station) hud.waehlen(d.station, true);
    switch (d.aktion) {
      case 'notiz': notizHaken = notizHaken >= 4 ? 1 : notizHaken + 1; notizTex.draw(); break;
      case 'stempel': stempelAusloesen(); break;
      case 'monitor': d.m.stil = STIL_FOLGE[(STIL_FOLGE.indexOf(d.m.stil) + 1) % 3]; d.m.api.draw(); break;
      case 'handy': handyTipp(); break;
      case 'podest': oeffne(d.welches); break;
      case 'hebel': hebelAusloesen(); break;
    }
  }

  /* ---------- Zeiger, Raycast, Ziehen (Versatz des Canvas über getBoundingClientRect) ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function strahl(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
  }
  function zielBei(cx, cy) { strahl(cx, cy); const h = ray.intersectObjects(ziele, false); return h.length ? h[0].object : null; }
  function stationBei(cx, cy) { strahl(cx, cy); const h = ray.intersectObjects(stationZiele, false); return h.length ? h[0].object.userData.station : 0; }
  function tafelBei(cx, cy) {
    strahl(cx, cy);
    const h = ray.intersectObject(tafel, false)[0];
    return h && h.face && h.face.materialIndex === 4 && h.uv ? [h.uv.x * 740, (1 - h.uv.y) * 340] : null;
  }
  /* Getroffen ist auch der nächste Helfer, dessen Körpermitte im Bild höchstens radius px vom Zeiger entfernt
     ist: Finger 22 px (Tippziel 44 px), Maus 14 px. Am Handy sind die Helfer in der Nahansicht rund 30 px hoch,
     die Treffer-Box allein wäre dort knapp (Prüfung M2 der ersten Fassung). */
  const hpos = new THREE.Vector3();
  function helferBei(cx, cy, radius) {
    const r = canvas.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    let best = null, bestD = radius * radius;
    for (const b of helfer) {
      b.root.getWorldPosition(hpos); hpos.y += 0.85 * b.S;
      const [x, y] = projiziere(hpos);
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }
  let zeigerArt = FEIN ? 'mouse' : 'touch';
  const maus = { x: -1, y: -1, drin: false };
  if (FEIN) {
    panel.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      // Parallaxe wie v3 (dort über das ganze Fenster, hier über das Panel): Ziel -1 bis 1 je Achse
      const r = panel.getBoundingClientRect();
      par.zx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      par.zy = -clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      maus.x = e.clientX; maus.y = e.clientY; maus.drin = e.target === canvas;
      wecken(1500);
    }, { passive: true });
    panel.addEventListener('pointerleave', () => { par.zx = 0; par.zy = 0; maus.drin = false; hoverBot = null; canvas.style.cursor = ''; wecken(1500); });
  }
  let zug = null, unterdrueckeKlick = false, hoverBot = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType) zeigerArt = e.pointerType;
    if (e.button !== 0) return;
    unterdrueckeKlick = false;
    const o = zielBei(e.clientX, e.clientY);
    if (o && o.userData.aktion === 'hebel') {
      if (hebel.zustand === 'schwung' || hebel.zustand === 'halt') return;   // läuft schon, nicht doppelt auslösen
      zug = { art: 'hebel', id: e.pointerId, y0: e.clientY, bewegt: false, anteil: 0 };
      hebel.zustand = 'zug';
      hud.waehlen(6, true);
    } else if (!(o && o.userData.bot)) {
      const p = tafelBei(e.clientX, e.clientY);
      if (!p) return;
      const strich = [p]; eigeneStriche.push(strich);
      if (eigeneStriche.length > 80) eigeneStriche.shift();
      zug = { art: 'zeichnen', id: e.pointerId, strich };
      planTex.draw();
      hud.waehlen(3, true);
    } else return;
    unterdrueckeKlick = true;
    canvas.style.touchAction = 'none';
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ohne Capture geht es auch */ }
    wecken();
  });
  canvas.addEventListener('pointermove', e => {
    if (!zug || e.pointerId !== zug.id) return;
    if (zug.art === 'hebel') {
      const dy = e.clientY - zug.y0;
      if (Math.abs(dy) > 6) zug.bewegt = true;
      zug.anteil = clamp(dy / (H * 0.16), 0, 1);
      hebel.w = 0.55 - 1.1 * zug.anteil;
    } else {
      const p = tafelBei(e.clientX, e.clientY);
      if (!p) return;
      const l = zug.strich[zug.strich.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 2.5) return;
      zug.strich.push([lerp(l[0], p[0], 0.7), lerp(l[1], p[1], 0.7)]);   // leichte Glättung
      planTex.draw();
    }
    wecken();
  });
  function zugEnde(e) {
    if (!zug || e.pointerId !== zug.id) return;
    if (zug.art === 'hebel') {
      if (!zug.bewegt || zug.anteil > 0.7) hebelAusloesen();
      else { hebel.zustand = 'zurueck'; hebel.t = 0; hebel.start = hebel.w; }
    }
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* schon frei */ }
    canvas.style.touchAction = '';
    zug = null;
    wecken();
  }
  canvas.addEventListener('pointerup', zugEnde);
  canvas.addEventListener('pointercancel', e => { if (zug && zug.art === 'hebel') { hebel.zustand = 'zurueck'; hebel.t = 0; hebel.start = hebel.w; } zugEnde(e); });
  /* Scrollen bleibt frei: kein wheel-Listener; touchmove wird nur während eines Ziehens an Tafel oder
     Hebel angehalten (wie v3), sonst scrollt der Finger die Seite */
  canvas.addEventListener('touchmove', e => { if (zug && e.cancelable) e.preventDefault(); }, { passive: false });
  canvas.addEventListener('click', e => {
    if (unterdrueckeKlick) { unterdrueckeKlick = false; return; }
    const o = zielBei(e.clientX, e.clientY);
    if (o && !o.userData.bot) aktion(o.userData);   // Requisiten (Stempel, Bildschirm, Podest, Hebel) zuerst
    else {
      // Helfer direkt oder im Umkreis; ein Tipp in einer Station wählt die Station auch dann, wenn er einen
      // Helfer trifft (am Handy stehen die Helfer in den Stationen, sonst verschluckte der Helfer die Wahl)
      const b = (o && o.userData.bot) || helferBei(e.clientX, e.clientY, zeigerArt === 'mouse' ? 14 : 22);
      const st = stationBei(e.clientX, e.clientY) || (b ? b.station : 0);
      if (b) aktion({ bot: b });
      if (st) hud.waehlen(st, true);
    }
    wecken();
  });

  /* ---------- Sichtbarkeit: rendern nur, wenn Bühne und Tab sichtbar sind; sonst steht die Uhr ---------- */
  let sichtbar = !('IntersectionObserver' in window), tabSichtbar = !document.hidden;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar) wecken(); }).observe(buehne);
  document.addEventListener('visibilitychange', () => { tabSichtbar = !document.hidden; if (tabSichtbar) wecken(); });

  /* ---------- Render-Schleife (aus v3; die Kamera hängt an u statt am Scroll) ---------- */
  const PT = {}, pv = new THREE.Vector3(), wp = new THREE.Vector3(), tmpW = new THREE.Vector3();
  let T = 0, letzte = jetztMs(), frame = 0, laeuft = false, aktivBis = 0;
  function projiziere(p) { pv.copy(p).project(cam); return [(pv.x * 0.5 + 0.5) * W, (-pv.y * 0.5 + 0.5) * H]; }
  const easeBack = q => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2); };
  /* Bei Pause läuft die Schleife nur, solange Antworten auf Handlungen ausklingen (Hüpfer, Jubel, Ring, Hebel) */
  function wecken(ms = 4000) {
    aktivBis = Math.max(aktivBis, jetztMs() + ms);
    if (laeuft || !sichtbar || !tabSichtbar) return;
    laeuft = true; letzte = jetztMs();
    requestAnimationFrame(bild);
  }

  /* Last (aus der ersten Fassung mit dem ganzen Band im Bild, Prüfung Funktion): Fällt ein Gerät über rund
     3 s unter 30 Bilder je Sekunde, wird in Stufen gespart: 1. Pixelverhältnis 1, 2. Schattenkarte nur jedes
     zweite Bild, 3. nur jedes dritte. In der Nahansicht ist meist nur eine Station im Bild. */
  const spar = { stufe: 0, n: 0, langsam: 0 };
  function lastMessen(ms) {
    if (ms <= 0 || ms > 200 || spar.stufe >= 3) return;   // Pausen und das erste Bild nach dem Wecken zählen nicht
    spar.n++; if (ms > 34) spar.langsam++;
    if (spar.n < 90) return;
    if (spar.langsam > 60) {
      spar.stufe++;
      if (spar.stufe === 1 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); renderer.setSize(W, H, false); }
      else { if (spar.stufe === 1) spar.stufe = 2; renderer.shadowMap.autoUpdate = false; }
    }
    spar.n = 0; spar.langsam = 0;
  }

  /* Automatischer Stationswechsel (Auftrag 8.3): bei 1x alle 8 s, 2x alle 4 s, 4x alle 2 s, bei Pause nie.
     Die Uhr zählt Weltzeit (dt) und steht in den 20 s nach einer eigenen Wahl und wenn die Bühne nicht
     sichtbar ist (dann steht die ganze Schleife). Jeder Wechsel stellt sie auf 0. */
  const AUTO_TAKT = 8;
  let autoUhr = 0;

  function bild(jetzt) {
    const bewegtSich = kam.dauer > 0 || blende || zoom;
    if (!sichtbar || !tabSichtbar || (hud.tempo() === 0 && jetzt > aktivBis && !zug && !bewegtSich)) { laeuft = false; return; }
    requestAnimationFrame(bild);
    lastMessen(jetzt - letzte);
    const rdt = Math.min(0.05, Math.max(0, (jetzt - letzte) / 1000));
    letzte = jetzt;
    const dt = rdt * hud.tempo();
    T += dt; uhr += rdt; frame++;

    /* 1. Kamera: Fahrt oder Überblendung, Parallaxe wie v3 (nur feiner Zeiger, nicht im Ruhig-Modus), applyCam */
    kameraSchritt(jetzt);
    if (FEIN) {
      const zx = RUHIG ? 0 : par.zx, zy = RUHIG ? 0 : par.zy;
      par.x += (zx - par.x) * Math.min(1, rdt * 3); par.y += (zy - par.y) * Math.min(1, rdt * 3);
    }
    if (zoom) {
      zoom.t += rdt;
      buehne.style.opacity = (1 - smooth(clamp(zoom.t / 0.25, 0, 1))).toFixed(3);   // v3: weisse Blende, hier blendet die Bühne aus
    }
    applyCam(kam.u);
    if ((curH > 30) !== fern) { fern = curH > 30; schilderEl.classList.toggle('fern', fern); }   // wie v3: aus der Ferne nur Stationsschilder
    if (!hud.vorrang()) autoUhr += dt;
    if (autoUhr >= AUTO_TAKT) { autoUhr = 0; hud.weiter(); }

    /* 2. Band, Briefkasten, Werkstücke, Pressen */
    beltTex.tex.offset.x -= dt * ITEM_SPEED / 2;
    for (const it of items) {
      it.s += dt * ITEM_SPEED;
      if (it.s > BELT_LEN + 1.2) {
        it.s -= LOOP; it.fail = Math.random() < 0.2; it.rej = null; it.gone = false; it.g.visible = true; it.cur = -1; it.v = -1;
      }
      const vv = variantAt(it.s);
      if (vv !== it.v) {
        if (it.v === 4 && vv === 5) {
          if (it.fail) {
            it.rej = { t: 0, x: it.g.position.x, z: it.g.position.z }; laserRot = 0.9;
            pruef.zeilen = [true, true, true]; pruef.zeilen[Math.random() * 3 | 0] = false; pruef.aus = true; pruefTex.draw();
            if (!blaseZeit && hud.fokus() === 5 && !SCHMAL.matches && !RUHIG) sage(zurueckBot, 'Das hier geht zurück. Der Knopf ist zu klein.');
          } else { pruef.zeilen = [true, true, true]; pruef.aus = false; pruefTex.draw(); }
        }
        it.v = vv;
      }
      if (it.gone) { if (it.g.visible) it.g.visible = false; continue; }
      let show = vv, px, py = BELT_Y, pz, sc = 1;
      pathAt(it.s, PT); px = PT.x; pz = PT.z;
      it.g.rotation.x = 0; it.g.rotation.z = 0;
      if (it.s < -0.9) { it.g.visible = false; continue; }
      it.g.visible = true;
      if (it.s < 0) {   // Briefumschlag fällt aus dem Schlitz aufs Band
        const q = (it.s + 0.9) / 0.9;
        px = lerp(SCHLITZ.x, X0, q); pz = lerp(SCHLITZ.z, 0, q); py = lerp(SCHLITZ.y, BELT_Y, q) + Math.sin(Math.PI * q) * 0.9;
        it.g.rotation.x = (1 - q) * 1.2; show = 0;
      }
      if (it.rej) {
        it.rej.t += dt / 1.1; const q = it.rej.t;
        if (q >= 1) { it.gone = true; it.g.visible = false; continue; }
        show = 7; px = lerp(it.rej.x, BINW.x, q); pz = lerp(it.rej.z, BINW.z, q); py = lerp(BELT_Y, BINW.y, q) + Math.sin(Math.PI * q) * 2.2; it.g.rotation.z = q * 3;
      }
      if (vv > 0 && !it.rej) { const d = it.s - THS[vv - 1]; if (d < 0.7) sc = 1 + 0.35 * Math.sin(Math.PI * d / 0.7); }
      if (show !== it.cur) { it.vs.forEach((g, i) => { g.visible = i === show; }); it.cur = show; }
      if (show === 0) it.vs[0].position.y = Math.sin(T * 3 + it.s) * 0.06;
      it.g.position.set(px, py, pz); if (!it.rej) it.g.rotation.y = PT.a; it.g.scale.setScalar(sc);
    }
    for (const p of pressen) {
      let near = 9;
      for (const it of items) if (!it.rej && !it.gone) near = Math.min(near, Math.abs(it.s - p.s));
      const pr = clamp(1 - near / 0.6, 0, 1);
      p.head.position.y = p.i === 1 ? 2.05 - 0.6 * smooth(pr) : 2.05 - 0.45 * smooth(pr);
      const warm = pr > 0.2, farbe = warm ? C.butter : C.salbei;
      if (p.warm !== warm) { p.warm = warm; p.lampMat.color.setHex(farbe); p.lampMat.emissive.setHex(farbe); }
      if (p.i === 1) { if (pr > 0.96 && !p.unten) { p.unten = true; blitz(FR[1], p.x, BELT_Y + 0.12, 0); } if (pr < 0.5) p.unten = false; }
    }
    for (const r of ringe) {
      if (r.t >= 1) continue;
      r.t += rdt / 0.35;
      const q = Math.min(1, r.t);
      r.m.scale.setScalar(lerp(0.6, 1.3, q)); r.m.material.opacity = 0.8 * (1 - q);
      if (q >= 1) r.m.visible = false;
    }

    /* 3. Helfer */
    for (const b of helfer) updateBot(b, dt, rdt, T);

    /* 4. Stationen */
    zuhoeren.root.getWorldPosition(wp); welt.worldToLocal(wp);
    for (const q of fragen) {
      const f = ((T * 0.45 + q.off) % 1);
      q.s.position.set(wp.x - 0.2 + Math.sin(f * 6 + q.off * 9) * 0.3, 1.9 + f * 1.8, wp.z + 0.3);
      q.s.material.opacity = Math.sin(Math.PI * f);
    }
    for (const d of dampf) {
      const f = ((T * 0.5 + d.off) % 1);
      d.m.position.set(tassen[0][0] + Math.sin(f * 5 + d.off * 7) * 0.06, 1.08 + f * 0.7, tassen[0][1]);
      d.m.material.opacity = 0.6 * Math.sin(Math.PI * f); d.m.scale.setScalar(1 + f * 1.2);
    }
    { // grosser Stempel
      const sdt = stempel.manuell ? rdt : dt;
      stempel.t += sdt;
      if (stempel.t >= 3) { stempel.t -= 3; stempel.manuell = false; }
      const t = stempel.t;
      let y = 1.7;
      if (t >= 2.2 && t < 2.45) y = lerp(1.7, 0.41, smooth((t - 2.2) / 0.25));
      else if (t >= 2.45) y = lerp(0.41, 1.7, smooth(clamp((t - 2.45) / 0.55, 0, 1)));
      stempelG.position.y = y;
      if (t >= 2.45 && !stempel.unten) { stempel.unten = true; blitz(welt, 21, 0.43, -5.4); stempel.blatt = 0.25; }
      if (t < 2.2) stempel.unten = false;
      stempel.blatt = Math.max(0, stempel.blatt - sdt);
      stempelBlatt.position.y = 0.39 + (stempel.blatt > 0 ? Math.sin(Math.PI * (1 - stempel.blatt / 0.25)) * 0.05 : 0);
    }
    holo.rotation.y += dt * 0.5;
    for (const p of holoTeile) p.g.position.y = p.y + Math.sin(T * 1.6 + p.i) * 0.06;
    for (const m of monitore) {
      let neu = false;
      if (m.blitz > 0 && dt > 0) { m.blitz -= dt; neu = true; }   // angehalten: kein Neuzeichnen
      m.t += dt;
      if (m.phase === 'bau') { if (m.t >= 0.4) { m.t = 0; m.n++; m.blitz = 0.25; neu = true; if (m.n >= BLOECKE.length) { m.phase = 'steht'; } } }
      else if (m.phase === 'steht') { if (m.t > 1.6) { m.phase = 'weg'; m.t = 0; } }
      else { m.scroll = smooth(clamp(m.t / 0.6, 0, 1)) * 160; neu = dt > 0; if (m.t >= 0.6) { m.stil = STIL_FOLGE[(STIL_FOLGE.indexOf(m.stil) + 1) % 3]; m.n = 0; m.scroll = 0; m.t = 0; m.phase = 'bau'; neu = true; } }
      if (neu) m.api.draw();
    }
    zwUhr += dt;
    if (zwUhr >= 7) {
      zwUhr = 0; zwBlink = 0.8; zwTex.draw();
      const b = bauBots[1];
      if (!b.path) {
        b.mode = 'idle'; b.carry = true; bote2Blatt.visible = true;
        b.path = [[54, -3.8], [56.4, -2.55]]; b.pi = 1; b.wait = 0;
        b.tour = { ab() { bote2Blatt.visible = false; b.carry = false; }, fertig() { b.mode = 'type'; } };
      }
    }
    if (zwBlink > 0) { zwBlink -= dt; if (zwBlink <= 0) zwTex.draw(); }
    { const ph = T * 1.1;
      arm.turm.rotation.y = -0.2 + Math.sin(ph) * 0.7; arm.schulter.rotation.x = 0.55 + Math.sin(ph * 2) * 0.18;
      arm.ellbogen.rotation.x = 1.05 + Math.sin(ph * 2 + 1) * 0.25; arm.hand.rotation.y = T * 2;
      arm.block.visible = Math.sin(ph) > -0.35; }
    // Prüfung
    if (laserRot > 0) { laserRot -= dt; laserMat.color.setHex(C.rot); scanMat.color.setHex(C.rot); laserMat.opacity = 0.32; }
    else { laserMat.color.setHex(C.kobalt); scanMat.color.setHex(C.kobalt); laserMat.opacity = 0.16 + Math.sin(T * 4) * 0.04; }
    scan.position.y = 0.75 + (Math.sin(T * 2.4) * 0.5 + 0.5) * 2.5;
    {
      let fo = 0;
      for (const it of items) { if (it.rej || it.gone) continue; const d = THS[4] - it.s; if (d >= 0 && d < ITEM_GAP) fo = Math.max(fo, 1 - d / ITEM_GAP); }
      if (Math.abs(fo - pruef.alt) > 0.04) { pruef.alt = fo; pruef.fortschritt = fo; pruefTex.draw(); }
    }
    { // Daumen-Test
      daumen.tipp += dt;
      let th = -0.12;
      const zyk = daumen.tipp % 1.6;
      if (zyk > 1.15 && zyk < 1.45) th = lerp(-0.12, 0.34, Math.sin(Math.PI * (zyk - 1.15) / 0.3));
      if (daumen.zwang > 0) { daumen.zwang -= rdt; th = lerp(-0.12, 0.34, Math.sin(Math.PI * clamp(1 - daumen.zwang / 0.32, 0, 1))); }
      daumenG.rotation.x = th;
      const druck = th > 0.28 ? 1 : 0;
      let neu = druck !== daumen.druck; daumen.druck = druck;
      if (daumen.gesendet > 0) { daumen.gesendet -= rdt; neu = true; if (daumen.gesendet <= 0) daumen.gesendet = 0; }
      if (neu) daumenTex.draw();
    }
    // Übergabe: Pendeln, Puls, Hebel, Füllen, Konfetti
    geraete.forEach((g, i) => { g.rotation.y = FRONT6 + Math.sin(T * 0.7 + i * 1.3) * (i === 2 ? 0.05 : 0.14); });
    rahmenGlanz = Math.max(0, rahmenGlanz - rdt / 3);
    rahmenMat.emissiveIntensity = 0.15 + (Math.sin(T * Math.PI) * 0.5 + 0.5) * 0.25 + rahmenGlanz;
    switch (hebel.zustand) {
      case 'ruhe': hebel.w = lerp(hebel.w, 0.55, Math.min(1, rdt * 10)); break;
      case 'schwung': { hebel.t += rdt; const q = Math.min(1, hebel.t / 0.35); hebel.w = lerp(hebel.start, -0.55, easeBack(q)); if (q >= 1) { hebel.zustand = 'halt'; hebel.t = 0; effekteHebel(); } break; }
      case 'halt': hebel.t += rdt; hebel.w = -0.55; if (hebel.t > 1.2) { hebel.zustand = 'zurueck'; hebel.t = 0; hebel.start = -0.55; } break;
      case 'zurueck': { hebel.t += rdt; const q = Math.min(1, hebel.t / 0.8); hebel.w = lerp(hebel.start, 0.55, easeBack(q)); if (q >= 1) { hebel.zustand = 'ruhe'; hebel.w = 0.55; } break; }
    }
    hebelArm.rotation.x = -hebel.w;
    if (hebel.zustand === 'ruhe') {
      hebel.auto += dt;
      if (hebel.auto >= 16 && hebel.zieh < 0) { hebel.zieh = 0; uebergabe1.mode = 'ziehen'; }
    }
    if (hebel.zieh >= 0) {
      hebel.zieh += dt;
      if (zug && zug.art === 'hebel') { hebel.zieh = -1; uebergabe1.mode = 'idle'; }   // der Besucher zieht schon
      else if (hebel.zieh > 1.1) { hebel.zieh = -1; uebergabe1.mode = 'idle'; hebelAusloesen(); }
    }
    if (fuell.t > 0) {   // Block für Block füllen, dann stehen lassen, damit man die fertige Seite sieht
      fuell.t += rdt;
      const n = fuell.t > FUELL_DAUER ? 0 : Math.min(7, 1 + Math.floor(fuell.t / 0.3));
      if (fuell.t > FUELL_DAUER) fuell.t = 0;
      if (n !== fuell.n) { fuell.n = n; ihrTex.draw(); }
    }
    // Kamera schiebt sich beim Füllen näher an "Ihr Betrieb" (wie v3, nicht im Ruhig-Modus)
    schub = lerp(schub, !RUHIG && fuell.t > 0 && fuell.t < FUELL_DAUER - 0.6 ? 1 : 0, Math.min(1, rdt * 2.2));
    for (const p of konfetti) {
      if (p.life <= 0) continue;
      p.life -= rdt; p.v.y -= 9.8 * rdt; p.v.multiplyScalar(1 - rdt * 0.6);
      p.m.position.addScaledVector(p.v, rdt);
      p.m.rotation.x += p.w.x * rdt; p.m.rotation.y += p.w.y * rdt; p.m.rotation.z += p.w.z * rdt;
      if (p.life <= 0 || p.m.position.y < 0.02) { p.life = 0; p.m.visible = false; }
    }

    /* 5. Fokus-Ringe: Deckkraft und Massstab vom aktuellen Wert aus (unterbrechbar), power2.out */
    for (const r of fokusRinge) {
      if (!r.bis) continue;
      const p = clamp((jetzt - r.t0) / r.dauer, 0, 1), q = power2aus(p);
      r.a = lerp(r.von.a, r.bis.a, q); r.s = lerp(r.von.s, r.bis.s, q);
      r.m.material.opacity = r.a; r.m.scale.set(r.s, 1, r.s); r.m.visible = r.a > 0.004;
      if (p >= 1) r.bis = null;
    }

    /* 6. Hover und Plaudern */
    if (FEIN && maus.drin && !zug && (frame & 1) === 0) {
      let art = '';
      const o = zielBei(maus.x, maus.y);
      const nah = o && !o.userData.bot ? null : ((o && o.userData.bot) || helferBei(maus.x, maus.y, 14));
      if (o && !o.userData.bot) { art = o.userData.zeiger || 'klick'; hoverBot = null; }
      else if (nah) { art = 'hallo'; if (hoverBot !== nah) { hoverBot = nah; nah.hopT = 0; } }
      else {
        hoverBot = null;
        if (tafelBei(maus.x, maus.y)) art = 'stift'; else if (stationBei(maus.x, maus.y)) art = 'klick';
      }
      canvas.style.cursor = art ? (art === 'stift' ? 'crosshair' : 'pointer') : '';
    }
    if (blaseZeit > 0) { blaseZeit = Math.max(0, blaseZeit - rdt); if (!blaseZeit) blase.classList.remove('zeigen'); }
    // Plaudern wie v3, hier an der gewählten Station; am Handy nur auf Tipp (der Canvas ist dort klein).
    // Nicht bei Pause und nicht im Ruhig-Modus: dort fallen Texte weg, die von selbst erscheinen (Prüfung N3)
    if (!SCHMAL.matches && !RUHIG && hud.tempo() > 0 && !blaseZeit && uhr - letztesPlaudern > PLAUDER_ABSTAND) {
      const kandidaten = helfer.filter(b => b.station === hud.fokus());
      if (kandidaten.length) { const b = pick(kandidaten); sage(b, zitat(b)); }
    }

    /* 7. Rendern (ab Sparstufe 2 die Schattenkarte nur jedes zweite oder dritte Bild) */
    if (spar.stufe >= 2) renderer.shadowMap.needsUpdate = frame % spar.stufe === 0;
    renderer.render(scene, cam);

    /* 8. Beschriftungen (wie v3 auch am Handy; die Kamera fährt, darum jedes Bild) und Sprechblase */
    if ((frame % 12) === 1) hudFlaechen = hud.flaechen();
    const fokus = hud.fokus();
    for (const s of schilder) {
      if (fern && !s.station) continue;
      welt.localToWorld(tmpW.copy(s.p));
      const [x, y] = projiziere(tmpW);
      s.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`;
      if (!s.w) { s.w = s.el.offsetWidth; s.h = s.el.offsetHeight; }
      const r = [x - s.w / 2, y - s.h, x + s.w / 2, y];
      // nicht unter Leiste, Karte, Tempo-Leiste oder am Rand
      const weg = r[0] < 4 || r[2] > W - 4 || r[1] < 4 || r[3] > H - 4 || hudFlaechen.some(f => schneidet(r, f));
      if (weg !== s.weg) { s.weg = weg; s.el.style.opacity = weg ? '0' : ''; }
      const an = s.station === fokus;
      if (an !== s.an) { s.an = an; s.el.classList.toggle('an', an); }
    }
    if (blaseBot && blaseZeit > 0) blaseSetzen();

    /* 9. Fortschritt im Balken der Karte: Zeit bis zum nächsten automatischen Wechsel */
    if ((frame % 6) === 0) hud.fortschritt(clamp(autoUhr / AUTO_TAKT, 0, 1));
  }

  /* ---------- Grösse ---------- */
  function groesse() {
    const w = buehne.clientWidth, h = buehne.clientHeight;
    if (!w || !h) return;
    W = w; H = h;
    renderer.setSize(W, H, false);
    buildKeys(); applyCam(kam.u);   // v3 rechnete die Schlüsselstellen bei jeder Grössenänderung neu, nie beim Scrollen
    schilder.forEach(s => { s.w = 0; });
    hudFlaechen = hud.flaechen();
    wecken();
  }

  /* ---------- Schriften: Canvas-Texturen neu zeichnen ---------- */
  const neuZeichnen = () => { texDrawers.forEach(t => t.draw()); schilder.forEach(s => { s.w = 0; }); wecken(); };
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load(`850 30px "Archivo"`), document.fonts.load(`500 25px "Archivo"`),
      document.fonts.load(`600 20px "Atkinson Hyperlegible Mono"`), document.fonts.load(`400 20px "Atkinson Hyperlegible Mono"`),
      schriftenLaden(),
    ]).then(neuZeichnen, neuZeichnen);
  }

  // Shader vorab übersetzen, solange der Abschnitt noch nicht im Bild ist (sonst ruckelt das erste Bild)
  if (typeof renderer.compileAsync === 'function') renderer.compileAsync(scene, cam).catch(() => {});

  return {
    wecken, groesse,
    /* Stationsfokus: Ring (Deckkraft 0 auf 0.5, Massstab 0.9 auf 1 in 400 ms power2.out) und Jubel nur bei
       eigener Wahl. Die Kamera gleitet zur Station; im Ruhig-Modus blendet sie über (200 ms), ebenso beim
       automatischen Sprung von 6 auf 1 (umlauf, 300 ms). */
    fokus(k, eigen, umlauf) {
      fokusRinge.forEach((r, i) => {
        if (eigen && i === k - 1) { if (r.zielA !== 0.5) { if (r.a < 0.01) r.s = 0.9; ringZiel(r, 0.5, 1, 400); } }
        else if (r.zielA > 0) ringZiel(r, 0, r.s, 200);
      });
      if (eigen && hauptHelfer[k]) hauptHelfer[k].cheer = 0.9;
      autoUhr = 0;
      if (RUHIG) ueberblenden(k, 200);
      else if (umlauf) ueberblenden(k, 300);
      else gleiten(k);
      wecken();
    },
    ruhig() { wecken(); },
    hebel() { hebelAusloesen(); },
    wischen() { eigeneStriche.length = 0; planTex.draw(); wecken(); },
    /* für die Prüfung ohne Browser */
    _intern: { cam, scene, welt, helfer, kam, K: () => K, camAt: x => camAt(x), applyCam: x => applyCam(x),
      bild: t => bild(t), hoehe: () => curH, groesse: () => [W, H], projiziere: p => projiziere(p) },
  };
}

/* ======================================================================
   Tempo-Leiste im Kopf der Website (Auftrag 8.3): gilt für die ganze Seite. Ein gemeinsamer Faktor
   window.hebelTempo (0 = Pause, 1, 2, 4) und das Ereignis hebel-tempo (detail = Faktor) für Einstieg und Band.
   Ruhig-Modus: Faktor 0, Pause aktiv markiert; zurück auf "Bewegung: an" heisst wieder 1x.
   Im Kontaktformular und im Fuss bleibt sie sichtbar, rückt aber nach oben aus, sobald sie dort etwas
   verdecken würde (200 ms, CSS-Klasse weg).
   ====================================================================== */
function tempoLeiste() {
  const el = $('#tempo');
  if (!el) return;
  const knoepfe = $$('[data-tempo]', el);
  function setzen(v) {
    window.hebelTempo = v;
    knoepfe.forEach(b => {
      const an = Number(b.dataset.tempo) === v;
      b.classList.toggle('an', an);
      b.setAttribute('aria-pressed', an ? 'true' : 'false');
    });
    document.dispatchEvent(new CustomEvent('hebel-tempo', { detail: v }));
  }
  knoepfe.forEach(b => b.addEventListener('click', () => setzen(Number(b.dataset.tempo))));
  document.addEventListener('hebel-ruhig', e => setzen(e.detail ? 0 : 1));
  setzen(html.classList.contains('ruhig') ? 0 : 1);

  /* Ausweichen: liegt die Leiste (Lage ohne Verschiebung, offsetLeft/Top eines fixen Elements) über Text oder
     Bedienelementen im Kontaktformular oder im Fuss, rückt sie aus. Gerechnet nur, wenn einer der zwei
     Bereiche den Streifen der Leiste berührt; nicht, solange der Fokus in der Leiste liegt. */
  const bereiche = [$('#kontakt'), $('.fuss')].filter(Boolean);
  const ziele = $$('#kontakt :is(h2,h3,p,li,label,input,textarea,select,button,a,svg), .fuss :is(h2,p,li,a,button,img)');
  let geplant = false, weg = false;
  function pruefen() {
    geplant = false;
    const x0 = el.offsetLeft - 8, y0 = el.offsetTop - 8, x1 = x0 + el.offsetWidth + 16, y1 = y0 + el.offsetHeight + 16;
    const trifft = r => r.width > 0 && r.left < x1 && r.right > x0 && r.top < y1 && r.bottom > y0;
    let neu = false;
    if (!el.contains(document.activeElement) && bereiche.some(b => trifft(b.getBoundingClientRect()))) {
      neu = ziele.some(z => trifft(z.getBoundingClientRect()));
    }
    if (neu !== weg) { weg = neu; el.classList.toggle('weg', weg); }
  }
  const planen = () => { if (!geplant) { geplant = true; requestAnimationFrame(pruefen); } };
  addEventListener('scroll', planen, { passive: true });
  addEventListener('resize', planen);
  el.addEventListener('focusin', planen);
  pruefen();
}

/* ======================================================================
   Abschnitt: Leiste und Karte (aus v3, in den Abschnitt statt fix am Bildschirmrand)
   ====================================================================== */
function start() {
  const abschnitt = $('#ablauf'), panel = $('#werkstatt'), buehne = $('#ab-buehne'), canvas = $('#band');
  if (!abschnitt || !panel || !buehne || !canvas) return;
  // Ohne WebGL 2 zeigt das CSS die Liste der sechs Stationen; hier gibt es dann nichts zu tun
  if (html.classList.contains('no-webgl')) return;
  const leiste = $('#ab-leiste'), tempoEl = $('#tempo'), karte = $('#ab-karte');
  const koerper = $('#ab-karte-koerper'), kNr = $('#ab-karte-nr'), kMarke = $('#ab-karte-marke'), kTitel = $('#ab-karte-titel');
  const kText = $('#ab-karte-text'), kAufwand = $('#ab-karte-aufwand'), kDinge = $('#ab-karte-dinge'), kKnopf = $('#ab-karte-knopf');
  const notizText = $('#ab-notiz-text'), notizAus = $('#ab-notiz-aus'), zeichnenEl = $('#ab-zeichnen'), s6El = $('#ab-s6'), balken = $('#ab-balken');
  const schilderEl = $('#ab-schilder'), blase = $('#ab-blase');
  const leisteKnoepfe = $$('[data-station]', leiste);

  /* Gemeinsamer Zustand zwischen Abschnitt und Welt. Startstation 1 oder ?station=N (Auftrag 8.4 E); mit N
     gilt sie wie eine eigene Wahl 20 s lang, damit die Sichtprüfung die Station sicher im Bild hat. */
  const START = startStation(location.search);
  const tempo0 = typeof window.hebelTempo === 'number' ? window.hebelTempo : (RUHIG ? 0 : 1);
  const Z = { zeitFaktor: tempo0, fokus: START, eigeneWahlBis: /[?&]station=/.test(location.search) ? jetztMs() + 20000 : 0, welt: null };

  /* ---------- Segmente im Balken der Karte ---------- */
  const segmente = STATIONEN.map((s, i) => {
    const g = document.createElement('button');
    g.type = 'button'; g.className = 'seg';
    g.setAttribute('aria-label', `Zu Station ${i + 1}: ${s.name}`);
    g.appendChild(document.createElement('i'));
    g.addEventListener('click', () => waehlen(i + 1, true));
    balken.appendChild(g);
    return g;
  });

  /* ---------- Karte mit Schreib-Notiz ---------- */
  let karteK = 0, schreibToken = 0;
  function karteFuellen(k) {
    const s = STATIONEN[k - 1];
    kNr.textContent = `STATION ${zwei(k)} / 06`;
    kMarke.textContent = s.marke;
    kTitel.textContent = s.name;
    kText.textContent = s.text;
    kAufwand.textContent = s.aufwand;
    kDinge.textContent = '';
    s.dinge.forEach(d => { const li = document.createElement('li'); li.textContent = d; kDinge.appendChild(li); });
    kKnopf.hidden = k !== 6;
    zeichnenEl.hidden = k !== 3;
  }
  /* ansagen: nur Wechsel durch den Besucher werden vorgelesen, nicht die automatischen alle paar Sekunden */
  function karteSetzen(k, sofort, ansagen) {
    if (k === karteK) return;
    karteK = k;
    karte.setAttribute('aria-live', ansagen ? 'polite' : 'off');
    const s = STATIONEN[k - 1];
    const tok = ++schreibToken;
    const tauschen = () => {
      if (tok !== schreibToken) return;
      karteFuellen(k);
      koerper.classList.remove('wechsel');
    };
    if (sofort || RUHIG) tauschen();
    else { koerper.classList.add('wechsel'); setTimeout(tauschen, 180); }
    s6El.hidden = k !== 6;
    notizAus.classList.remove('zeigen');
    notizAus.textContent = s.aus;
    if (sofort || RUHIG) { notizText.textContent = s.notiz; notizAus.classList.add('zeigen'); return; }
    notizText.textContent = '';
    let i = 0;
    const schritt = () => {
      if (tok !== schreibToken) return;
      i++;
      notizText.textContent = s.notiz.slice(0, i);
      if (i < s.notiz.length) setTimeout(schritt, 38);
      else setTimeout(() => { if (tok === schreibToken) notizAus.classList.add('zeigen'); }, 320);
    };
    setTimeout(schritt, 38);
  }

  /* Feste Mindesthöhe der Karte (höchste der sechs Stationen): ihr Rechteck bleibt gleich (Schilder und Blase
     weichen ihm aus), und am Handy springt nichts, wenn die Karte von selbst wechselt */
  let fixBreite = -1, fixHoehe = -1;
  function karteFixieren(erzwingen) {
    const b = karte.clientWidth, h = GESTAPELT.matches ? 0 : panel.clientHeight;
    // neu messen bei neuer Breite der Karte oder, solange sie über der Bühne liegt, bei neuer Höhe des Panels
    if (!b || (!erzwingen && b === fixBreite && h === fixHoehe)) return;
    fixBreite = b; fixHoehe = h;
    const live = karte.getAttribute('aria-live');
    karte.setAttribute('aria-live', 'off');
    const merk = [notizText.textContent, notizAus.textContent];
    karte.style.minHeight = '';
    const hoechste = () => {
      let m = 0;
      for (let k = 1; k <= 6; k++) {
        karteFuellen(k);
        notizText.textContent = STATIONEN[k - 1].notiz; notizAus.textContent = STATIONEN[k - 1].aus;
        m = Math.max(m, karte.offsetHeight);
      }
      return m;
    };
    karte.classList.remove('eng');
    let max = hoechste();
    if (!GESTAPELT.matches) {
      /* Die Karte liegt über der Bühne: Platz von 16 px unter dem oberen bis 16 px über dem unteren Rand des Panels
         (die Tempo-Leiste sitzt seit Auftrag 8.3 im Kopf). Reicht der Platz nicht, fallen die Dinge-Zeilen weg. */
      const platz = panel.clientHeight - 32;
      if (max > platz) { karte.classList.add('eng'); max = hoechste(); }
      max = Math.min(max, platz);
    }
    karteFuellen(karteK || 1);
    notizText.textContent = merk[0]; notizAus.textContent = merk[1];
    karte.style.minHeight = `${Math.ceil(max)}px`;
    karte.setAttribute('aria-live', live || 'polite');
  }

  /* ---------- Leiste ---------- */
  function leisteSetzen() {
    const k = Z.fokus;
    leisteKnoepfe.forEach((b, i) => {
      b.classList.toggle('fertig', i < k - 1);
      if (i === k - 1) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    segmente.forEach((g, i) => { g.classList.toggle('fertig', i < k - 1); g.classList.toggle('an', i === k - 1); });
  }
  /* eigen: Wahl des Besuchers (20 s Vorrang vor dem automatischen Wechsel, Ring, Jubel); umlauf: automatischer
     Sprung von 6 auf 1 (Überblendung statt Fahrt) */
  function waehlen(k, eigen, umlauf) {
    k = clamp(k, 1, 6);
    if (eigen) Z.eigeneWahlBis = jetztMs() + 20000;
    Z.fokus = k;
    karteSetzen(k, false, eigen);
    leisteSetzen();
    if (Z.welt) Z.welt.fokus(k, eigen, !!umlauf);
  }
  /* Automatischer Wechsel (Auftrag 8.3): eine Station weiter, nach 6 wieder 1 */
  function weiter() {
    if (jetztMs() < Z.eigeneWahlBis) return;
    const k = Z.fokus % 6 + 1;
    waehlen(k, false, k === 1);
  }
  leisteKnoepfe.forEach((b, i) => b.addEventListener('click', () => waehlen(i + 1, true)));
  /* Tastatur nur in der Leiste: Pfeil auf und ab (am Handy-Raster alle Pfeile, in der Zeile von 820 bis
     1079 px auch links und rechts), Pos1 und Ende */
  leiste.addEventListener('keydown', e => {
    const i = leisteKnoepfe.indexOf(document.activeElement);
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const raster = SCHMAL.matches, waagrecht = GESTAPELT.matches;
    let k = null;
    switch (e.key) {
      case 'ArrowDown': k = i + (raster ? 3 : 1); break;
      case 'ArrowUp': k = i - (raster ? 3 : 1); break;
      case 'ArrowRight': if (waagrecht) k = i + 1; break;
      case 'ArrowLeft': if (waagrecht) k = i - 1; break;
      case 'Home': k = 0; break;
      case 'End': k = leisteKnoepfe.length - 1; break;
    }
    if (k === null) return;
    e.preventDefault();
    k = clamp(k, 0, leisteKnoepfe.length - 1);
    leisteKnoepfe[k].focus();
    waehlen(k + 1, true);
  });

  /* ---------- Tempo: gemeinsamer Faktor aus der Leiste im Kopf (Ereignis hebel-tempo, tempoLeiste) ----------
     Ruhig-Modus: die Leiste meldet 0 (Pause); wer 1x drückt, startet die Welt von Hand */
  document.addEventListener('hebel-tempo', e => {
    Z.zeitFaktor = Number(e.detail) || 0;
    if (Z.welt) Z.welt.wecken();
  });

  /* ---------- Station 6 für die Tastatur, Wischen an Station 3 ---------- */
  const s6Hebel = $('[data-s6="hebel"]', s6El);
  if (s6Hebel) s6Hebel.addEventListener('click', () => { waehlen(6, true); if (Z.welt) Z.welt.hebel(); });
  const wischen = $('#ab-wischen');
  if (wischen) wischen.addEventListener('click', () => { if (Z.welt) Z.welt.wischen(); });

  /* ---------- Knopf "Bewegung" (der Kopf setzt Klasse und Speicher und meldet den Wechsel hier) ---------- */
  document.addEventListener('hebel-ruhig', e => {
    RUHIG = !!e.detail;
    if (RUHIG && karteK) {
      // laufende Schreib-Notiz und Überblendung sofort fertig
      const s = STATIONEN[karteK - 1];
      schreibToken++;
      karteFuellen(karteK); koerper.classList.remove('wechsel');
      notizText.textContent = s.notiz; notizAus.textContent = s.aus; notizAus.classList.add('zeigen');
    }
    if (Z.welt) Z.welt.ruhig();
  });

  /* ---------- Flächen über der Bühne (Schilder und Blase weichen aus) ----------
     Leiste und Karte liegen ab 1080 px über dem Canvas; die fixe Tempo-Leiste im Kopf nur, wenn die Bühne
     gerade unter ihr durchläuft */
  function rechtecke(P) {
    const b = buehne.getBoundingClientRect();
    return (GESTAPELT.matches ? [tempoEl] : [leiste, karte, tempoEl]).map(el => {
      if (!el || el.classList.contains('weg')) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const q = [r.left - b.left - P, r.top - b.top - P, r.right - b.left + P, r.bottom - b.top + P];
      return q[2] > 0 && q[0] < b.width && q[3] > 0 && q[1] < b.height ? q : null;
    }).filter(Boolean);
  }
  const hud = {
    fokus: () => Z.fokus,
    tempo: () => Z.zeitFaktor,
    waehlen,
    weiter,
    vorrang: () => jetztMs() < Z.eigeneWahlBis,
    fortschritt(f) { const g = segmente[Z.fokus - 1]; if (g) g.style.setProperty('--f', f.toFixed(3)); },
    ihrBetrieb() { kKnopf.click(); },   // gleicher Weg wie der Knopf "Projekt anfragen" (Anker #kontakt)
    flaechen: () => rechtecke(6),
  };

  karteSetzen(START, true, false);
  leisteSetzen();

  /* ---------- Bau der Welt, kurz bevor der Abschnitt ins Bild kommt ---------- */
  let gebaut = false;
  function ohneBand() { Z.welt = null; abschnitt.classList.add('ohne-band'); }
  function bauen() {
    if (gebaut) return;
    gebaut = true;
    import('three').then(modul => {
      let renderer = null;
      try {
        // eigener Renderer: Einstiegsszene und Band teilen sich keine Instanz
        renderer = new modul.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        if (!renderer.capabilities.isWebGL2) throw new Error('kein WebGL 2');
        Z.welt = weltBauen({ THREE: modul, renderer, canvas, buehne, panel, schilderEl, blase, hud, start: Z.fokus });
        karteFixieren(true);
        Z.welt.groesse();
        // Geht der WebGL-Kontext verloren (zwei Kontexte auf der Seite, schwache Geräte), bliebe das Band leer:
        // dann die Liste der sechs Stationen zeigen. Die Schleife steht, sobald die Bühne nicht mehr sichtbar ist.
        canvas.addEventListener('webglcontextlost', ohneBand, { once: true });
      } catch (e) {
        if (renderer) renderer.dispose();
        ohneBand();
      }
    }).catch(ohneBand);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); bauen(); } }, { rootMargin: '900px 0px' });
    io.observe(abschnitt);
  } else bauen();

  /* Grösse: Karte neu vermessen (nur bei neuer Breite), dann die Schlüsselstellen der Kamera neu rechnen */
  const neuMessen = () => { karteFixieren(false); if (Z.welt) Z.welt.groesse(); };
  if ('ResizeObserver' in window) new ResizeObserver(neuMessen).observe(panel);
  else addEventListener('resize', neuMessen);
  const aufSchmal = () => { karteFixieren(true); if (Z.welt) Z.welt.groesse(); };
  for (const mq of [SCHMAL, GESTAPELT]) {
    if (mq.addEventListener) mq.addEventListener('change', aufSchmal); else if (mq.addListener) mq.addListener(aufSchmal);
  }
  // Archivo verändert die Zeilenumbrüche der Karte: nach dem Laden neu messen
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { karteFixieren(true); if (Z.welt) Z.welt.groesse(); });
}

if (typeof document !== 'undefined' && document.getElementById) {
  tempoLeiste();   // zuerst: setzt window.hebelTempo, das start() übernimmt
  if (document.getElementById('ablauf')) start();
}
