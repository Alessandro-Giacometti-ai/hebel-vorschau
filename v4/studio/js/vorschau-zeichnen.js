/* Hebel v4: die drei Mini-Startseiten der Vorschau, reines 2D-Canvas-Zeichnen.
   Auftrag: docs/webstudio-2026-10/master-prompts/v4-01-hebel.md, Abschnitt 4.1, Werte der Beispiele
   aus v4-04-identitaeten.md. Genutzt von einstieg.js (Textur auf dem 3D-Bildschirm, Kacheln unter
   "Arbeiten") und vom Rückfall ohne WebGL.

   zeichneVorschau(ctx, art, t, name)
     art   'restaurant' | 'architekt' | 'betrieb'
     t     0 bis 1, Fortschritt der eingebauten Kleinbewegung (läuft beim Aufrufer in 3 s ab)
     name  nur bei 'betrieb': höchstens 40 Zeichen, wird nur als Text gezeichnet, nie als HTML

   Gezeichnet wird in einer logischen Breite von 1600 Einheiten; die Höhe folgt dem Seitenverhältnis
   der Canvas (1600 x 960 auf dem Bildschirm, 1200 x 750 in den Kacheln). Schrift ist überall Archivo
   (und Atkinson Hyperlegible Mono für die Massstabsangabe): die Startseite lädt die Schriften der
   Beispiele nicht nach. Text auf der Textur ist mindestens 34 Einheiten hoch. */

export const VORSCHAUEN = {
  restaurant: { name: 'Pizzeria Tondo', art: 'Pizzeria, Beispiel', pfad: '/hebel-vorschau/v4/beispiele/tondo/' },
  architekt: { name: 'Achsmass Architekten', art: 'Architekturbüro, Beispiel', pfad: '/hebel-vorschau/v4/beispiele/achsmass/' },
  betrieb: { name: 'Ihr Betrieb', art: '', pfad: '#kontakt' },
};

/* Farben je Seite (Canvas-Werte, gleich wie die Tokens der jeweiligen Seite) */
const FARBEN = {
  tondo: { grund: '#F2F4F0', tinte: '#11181B', zitrone: '#FFD84A', graphit: '#1E2B30', teig: '#E8B25A',
    sauce: '#E03A24', mozzarella: '#FFFDF6', basilikum: '#2E9E57', teller: 'rgba(242,244,240,0.16)',
    text: 'rgba(17,24,27,0.16)' },
  achsmass: { grund: '#F5F6F4', tinte: '#121416', roetel: '#C8462E', rahmen: 'rgba(18,20,22,0.42)',
    verdeckt: 'rgba(18,20,22,0.5)', mass: 'rgba(18,20,22,0.7)' },
  hebel: { flaeche: '#F4F0E8', flaeche2: '#DDD4C6', tinte: '#15140F', tinte2: '#2E2B25', kobalt: '#2340FF',
    aufKobalt: '#FFFFFF', butter: '#F2C14E', linie: 'rgba(21,20,15,0.14)' },
};

const SCHRIFT = '"Archivo", system-ui, sans-serif';
const MONO = '"Atkinson Hyperlegible Mono", ui-monospace, monospace';
const BREITEN = { 100: 'normal', 112: 'semi-expanded', 125: 'expanded' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* Teilabschnitt von t: 0 vor a, 1 nach b */
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ausQuart = p => 1 - Math.pow(1 - p, 4);
const ausKubisch = p => 1 - Math.pow(1 - p, 3);

/* Bézier-Kurve wie in CSS, für die "Landen"-Kurve der Pizzeria (0.2, 0.9, 0.25, 1.12) */
function bezier(x1, y1, x2, y2) {
  const bx = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (bx(t, x1, x2) < x) lo = t; else hi = t; }
    return bx(t, y1, y2);
  };
}
const landen = bezier(0.2, 0.9, 0.25, 1.12);

/* ---------- Schrift ---------- */
let fassung = 0;   // steigt, sobald Schriften geladen sind; leert den Satz-Speicher
export function schriftenLaden() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load(`800 60px "Archivo"`), document.fonts.load(`500 60px "Archivo"`),
    document.fonts.load(`400 40px "Archivo"`), document.fonts.load(`700 34px "Archivo"`),
    document.fonts.load(`400 34px "Atkinson Hyperlegible Mono"`),
  ]).then(() => { fassung++; }, () => { fassung++; });
}

function schrift(ctx, gewicht, px, breite, familie) {
  ctx.font = `${gewicht} ${px}px ${familie || SCHRIFT}`;
  if ('fontStretch' in ctx) ctx.fontStretch = BREITEN[breite || 100] || 'normal';
  if ('letterSpacing' in ctx) ctx.letterSpacing = px >= 56 ? `${(-0.03 * px).toFixed(2)}px` : px >= 40 ? `${(-0.015 * px).toFixed(2)}px` : '0px';
}

/* Wörter auf Zeilen verteilen; zu lange Wörter zeichenweise brechen */
function umbrechen(ctx, text, maxB) {
  const worte = String(text).split(/\s+/).filter(Boolean);
  const zeilen = [];
  let z = '';
  const passt = s => ctx.measureText(s).width <= maxB;
  for (let w of worte) {
    if (!passt(w)) {
      if (z) { zeilen.push(z); z = ''; }
      let teil = '';
      for (const c of Array.from(w)) {
        if (passt(teil + c)) teil += c;
        else { if (teil) zeilen.push(teil); teil = c; }
      }
      z = teil;
      continue;
    }
    const probe = z ? `${z} ${w}` : w;
    if (passt(probe)) z = probe;
    else { zeilen.push(z); z = w; }
  }
  if (z) zeilen.push(z);
  return zeilen.length ? zeilen : [''];
}

/* Grösste Schrift, bei der der Text in höchstens maxZeilen Zeilen in maxB passt */
const satzSpeicher = new Map();
function setzen(ctx, schluessel, text, maxB, maxZeilen, gross, klein, stil) {
  const k = `${schluessel}|${text}|${maxB}|${fassung}`;
  const alt = satzSpeicher.get(k);
  if (alt) { stil(alt.px); return alt; }
  let erg = null;
  const worte = String(text).split(/\s+/).filter(Boolean);
  for (let px = gross; px >= klein; px -= 2) {
    stil(px);
    // zuerst nur Grössen, bei denen jedes Wort ganz bleibt
    if (worte.some(w => ctx.measureText(w).width > maxB)) continue;
    const zeilen = umbrechen(ctx, text, maxB);
    if (zeilen.length <= maxZeilen) { erg = { px, zeilen }; break; }
  }
  if (!erg) {
    stil(klein);
    let zeilen = umbrechen(ctx, text, maxB);
    if (zeilen.length > maxZeilen) {
      zeilen = zeilen.slice(0, maxZeilen);
      zeilen[maxZeilen - 1] = kuerzen(ctx, `${zeilen[maxZeilen - 1]}…`, maxB);
    }
    erg = { px: klein, zeilen };
  }
  if (satzSpeicher.size > 200) satzSpeicher.clear();
  satzSpeicher.set(k, erg);
  return erg;
}

function kuerzen(ctx, text, maxB) {
  if (ctx.measureText(text).width <= maxB) return text;
  const zeichen = Array.from(text.replace(/…$/, ''));
  while (zeichen.length > 1 && ctx.measureText(`${zeichen.join('')}…`).width > maxB) zeichen.pop();
  return `${zeichen.join('')}…`;
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ======================================================================
   Einstieg
   ====================================================================== */
export function zeichneVorschau(ctx, art, t, name) {
  const cv = ctx.canvas;
  const k = cv.width / 1600;
  const H = cv.height / k;
  t = clamp(Number(t) || 0, 0, 1);
  ctx.save();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  if (art === 'restaurant') restaurant(ctx, t, H);
  else if (art === 'architekt') architekt(ctx, t, H);
  else betrieb(ctx, t, H, name);
  ctx.restore();
}

/* ---------- Pizzeria Tondo ---------- */
function restaurant(ctx, t, H) {
  const F = FARBEN.tondo;
  const RAND = 64, KOPF = 124;
  ctx.fillStyle = F.grund; ctx.fillRect(0, 0, 1600, H);

  // Kopfzeile: Wortmarke links, kleiner Knopf rechts, Tinte-Linie darunter
  schrift(ctx, 800, 62, 125);
  ctx.fillStyle = F.tinte; ctx.fillText('Tondo', RAND, 86);
  schrift(ctx, 700, 34, 100);
  const kt = 'Tisch reservieren';
  const kb = ctx.measureText(kt).width + 56, kh = 68, kx = 1600 - RAND - kb, ky = 28;
  ctx.fillStyle = F.zitrone; ctx.fillRect(kx, ky, kb, kh);
  ctx.lineWidth = 5; ctx.strokeStyle = F.tinte; ctx.strokeRect(kx + 2.5, ky + 2.5, kb - 5, kh - 5);
  ctx.fillStyle = F.tinte; ctx.fillText(kt, kx + 28, ky + 46);
  ctx.fillRect(0, KOPF, 1600, 5);

  // Titel in breiter Display-Schrift, Block senkrecht in der freien Fläche mittig
  const spalte = 680;
  const satz = setzen(ctx, 'tondo-titel', 'Holzofenpizza in Bülach.', spalte, 3, 136, 72, px => schrift(ctx, 800, px, 125));
  const blockH = satz.zeilen.length * satz.px * 0.98 + 118;
  ctx.fillStyle = F.tinte;
  let y = KOPF + Math.max(56, (H - KOPF - blockH) / 2) + satz.px * 0.8;
  for (const z of satz.zeilen) { ctx.fillText(z, RAND, y); y += satz.px * 0.98; }

  // Fliesstext angedeutet, darunter eine gepunktete Führungslinie
  ctx.fillStyle = F.text;
  ctx.fillRect(RAND, y + 8, 520, 16); ctx.fillRect(RAND, y + 44, 400, 16);
  ctx.fillStyle = F.tinte;
  for (let x = RAND; x < RAND + spalte - 8; x += 22) ctx.fillRect(x, y + 104, 8, 5);

  // Graphit-Bühne mit der Pizza von oben
  const bx = 820, by = KOPF + 44, bw = 1600 - RAND - bx, bh = H - by - 56;
  ctx.fillStyle = F.graphit; ctx.fillRect(bx, by, bw, bh);
  pizza(ctx, bx + bw / 2, by + bh / 2, Math.min(bw, bh) * 0.37, t, F);
}

function pizza(ctx, cx, cy, R, t, F) {
  const tTeig = seg(t, 0, 0.28), tSauce = seg(t, 0.24, 0.58), tKaese = seg(t, 0.55, 0.84), tBlatt = seg(t, 0.76, 1);
  // Teller
  ctx.strokeStyle = F.teller; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.17, 0, Math.PI * 2); ctx.stroke();
  if (tTeig <= 0) return;
  // 1 Teig: der Kreis wächst und landet
  const r = R * Math.max(0, landen(tTeig));
  ctx.fillStyle = F.teig;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // 2 Sauce als Spirale von innen nach aussen
  if (tSauce > 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2); ctx.clip();
    const windungen = 4, max = Math.PI * 2 * windungen * ausKubisch(tSauce), rMax = R * 0.8;
    ctx.strokeStyle = F.sauce; ctx.lineWidth = R * 0.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    for (let a = 0; a <= max; a += 0.08) {
      const rr2 = rMax * a / (Math.PI * 2 * windungen);
      ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
    }
    ctx.stroke();
    ctx.restore();
  }
  // 3 Mozzarella: Tupfen poppen nacheinander auf
  if (tKaese > 0) {
    const TUPFEN = [[0.1, 0.15], [0.52, 0.0], [0.48, 1.6], [0.55, 3.0], [0.5, 4.4], [0.62, 5.5], [0.3, 2.4], [0.3, 4.9], [0.66, 0.9]];
    ctx.fillStyle = F.mozzarella;
    TUPFEN.forEach(([d, w], i) => {
      const p = seg(tKaese, i * 0.07, i * 0.07 + 0.38);
      if (p <= 0) return;
      const s = Math.max(0, landen(p));
      const x = cx + Math.cos(w) * d * R, y = cy + Math.sin(w) * d * R;
      ctx.beginPath(); ctx.ellipse(x, y, R * 0.12 * s, R * 0.1 * s, w, 0, Math.PI * 2); ctx.fill();
    });
  }
  // 4 Basilikum fällt
  if (tBlatt > 0) {
    const BLAETTER = [[0.34, 0.7, 0.4], [0.42, 2.2, -0.6], [0.4, 3.7, 1.1], [0.46, 5.2, -0.2], [0.12, 4.3, 0.8]];
    ctx.fillStyle = F.basilikum;
    BLAETTER.forEach(([d, w, dreh], i) => {
      const p = seg(tBlatt, i * 0.1, i * 0.1 + 0.55);
      if (p <= 0) return;
      const q = ausQuart(p);
      const x = cx + Math.cos(w) * d * R, y = cy + Math.sin(w) * d * R - (1 - q) * R * 0.55;
      ctx.save();
      ctx.globalAlpha = clamp(p * 2, 0, 1);
      ctx.translate(x, y); ctx.rotate(dreh + (1 - q) * 0.9);
      const l = R * 0.15, b = R * 0.075;
      ctx.beginPath(); ctx.moveTo(-l, 0); ctx.quadraticCurveTo(0, -b * 2, l, 0); ctx.quadraticCurveTo(0, b * 2, -l, 0); ctx.fill();
      ctx.restore();
    });
  }
}

/* ---------- Achsmass Architekten ---------- */
function architekt(ctx, t, H) {
  const F = FARBEN.achsmass;
  const RAND = 64, KOPF = 124;
  ctx.fillStyle = F.grund; ctx.fillRect(0, 0, 1600, H);

  // Kopfzeile: Wortmarke, Massstabsleiste, Knopf in Tusche
  schrift(ctx, 500, 58, 100);
  ctx.fillStyle = F.tinte; ctx.fillText('Achsmass', RAND, 86);
  const wm = ctx.measureText('Achsmass').width;
  const lx = RAND + wm + 36, ly = 64, seg5 = 34;
  ctx.lineWidth = 2; ctx.strokeStyle = F.tinte;
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) { ctx.fillStyle = F.tinte; ctx.fillRect(lx + i * seg5, ly, seg5, 14); }
    else ctx.strokeRect(lx + i * seg5 + 1, ly + 1, seg5 - 2, 12);
  }
  schrift(ctx, 500, 34, 100);
  const kt = 'Erstgespräch vereinbaren';
  const kb = ctx.measureText(kt).width + 56, kh = 68, kx = 1600 - RAND - kb, ky = 28;
  ctx.fillStyle = F.tinte; ctx.fillRect(kx, ky, kb, kh);
  ctx.fillStyle = F.grund; ctx.fillText(kt, kx + 28, ky + 46);
  ctx.fillStyle = F.tinte; ctx.fillRect(0, KOPF, 1600, 2);

  // Ruhiger Titel
  const satz = setzen(ctx, 'achsmass-titel', 'Wir planen Häuser im Zürcher Unterland.', 660, 4, 112, 60, px => schrift(ctx, 500, px, 100));
  const blockH = satz.zeilen.length * satz.px * 1.04;
  ctx.fillStyle = F.tinte;
  let y = KOPF + Math.max(56, (H - KOPF - blockH) / 2) + satz.px * 0.8;
  for (const z of satz.zeilen) { ctx.fillText(z, RAND, y); y += satz.px * 1.04; }

  // Zeichenblatt mit 0.75er Rahmen (auf der Textur 2 Einheiten)
  const bx = 820, by = KOPF + 44, bw = 1600 - RAND - bx, bh = H - by - 56;
  ctx.strokeStyle = F.rahmen; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  haus(ctx, bx, by, bw, bh, t, F);
  schrift(ctx, 400, 34, 100, MONO);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = F.tinte; ctx.textAlign = 'right';
  ctx.fillText('M 1:100', bx + bw - 28, by + bh - 28);
  ctx.textAlign = 'left';
}

/* Haus als Strich-Axonometrie: Grundriss, dann Wände, dann Dach, Fenster am Schluss */
function haus(ctx, bx, by, bw, bh, t, F) {
  const L = 12, B = 8, HW = 5.2, HD = 3.6;
  const C30 = Math.cos(Math.PI / 6), S30 = Math.sin(Math.PI / 6);
  const roh = (x, y, z) => [(x - z) * C30, (x + z) * S30 - y];
  // Grösse aus allen Punkten bestimmen
  const alle = [[0, 0, 0], [L, 0, 0], [L, 0, B], [0, 0, B], [0, HW + HD, B / 2], [L, HW + HD, B / 2], [L, 0, B + 1.6], [0, 0, B + 1.6]];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of alle) { const [u, v] = roh(...p); x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
  const s = Math.min((bw - 140) / (x1 - x0), (bh - 150) / (y1 - y0));
  const ox = bx + bw / 2 - (x0 + x1) / 2 * s, oy = by + bh / 2 - (y0 + y1) / 2 * s - 24;
  const P = (x, y, z) => { const [u, v] = roh(x, y, z); return [ox + u * s, oy + v * s]; };

  const tPlan = seg(t, 0, 0.36), tWand = seg(t, 0.34, 0.7), tDach = seg(t, 0.68, 0.9), tFenster = seg(t, 0.9, 1);
  ctx.lineCap = 'square'; ctx.lineJoin = 'miter';

  // 1 Grundriss: Aussenlinie, Innenwände mit Türlücke, Masslinie
  const plan = [
    [[0, 0, 0], [L, 0, 0]], [[L, 0, 0], [L, 0, B]], [[L, 0, B], [8.2, 0, B]], [[6.8, 0, B], [0, 0, B]], [[0, 0, B], [0, 0, 0]],
  ];
  const innen = [[[7, 0, 0], [7, 0, 3.2]], [[7, 0, 4.4], [7, 0, B]], [[7, 0, 4], [L, 0, 4]]];
  strichFolge(ctx, plan.map(([a, b]) => [P(...a), P(...b)]), tPlan, F.tinte, 5);
  strichFolge(ctx, innen.map(([a, b]) => [P(...a), P(...b)]), seg(tPlan, 0.45, 1), F.tinte, 3);
  // Masslinie vor der Längsseite, mit Schrägstrichen an den Enden
  const m0 = P(0, 0, B + 1.6), m1 = P(L, 0, B + 1.6);
  const tm = seg(tPlan, 0.3, 1);
  if (tm > 0) {
    ctx.strokeStyle = F.mass; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m0[0] + (m1[0] - m0[0]) * tm, m0[1] + (m1[1] - m0[1]) * tm); ctx.stroke();
    [m0, m1].forEach((m, i) => {
      if (i === 1 && tm < 1) return;
      ctx.beginPath(); ctx.moveTo(m[0] - 9, m[1] + 9); ctx.lineTo(m[0] + 9, m[1] - 9); ctx.stroke();
    });
    const f0 = P(0, 0, B), f1 = P(L, 0, B);
    ctx.beginPath(); ctx.moveTo(f0[0], f0[1] + 6); ctx.lineTo(m0[0], m0[1] + 14); ctx.moveTo(f1[0], f1[1] + 6); ctx.lineTo(m1[0], m1[1] + 14); ctx.globalAlpha = tm; ctx.stroke(); ctx.globalAlpha = 1;
  }

  // 2 Wände wachsen aus dem Plan
  if (tWand > 0) {
    const h = HW * ausKubisch(seg(tWand, 0, 0.75));
    const ecken = [[L, 0], [L, B], [0, B]];
    ctx.strokeStyle = F.tinte; ctx.lineWidth = 5;
    for (const [x, z] of ecken) { const a = P(x, 0, z), b = P(x, h, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // verdeckte Kante hinten links, gestrichelt
    ctx.save(); ctx.setLineDash([14, 10]); ctx.strokeStyle = F.verdeckt; ctx.lineWidth = 2;
    const a = P(0, 0, 0), b = P(0, h, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.restore();
    const oben = [[[0, HW, B], [L, HW, B]], [[L, HW, B], [L, HW, 0]]];
    strichFolge(ctx, oben.map(([p, q]) => [P(...p), P(...q)]), seg(tWand, 0.6, 1), F.tinte, 5);
    const hinten = [[[0, HW, 0], [L, HW, 0]], [[0, HW, 0], [0, HW, B]]];
    ctx.save(); ctx.setLineDash([14, 10]);
    strichFolge(ctx, hinten.map(([p, q]) => [P(...p), P(...q)]), seg(tWand, 0.6, 1), F.verdeckt, 2);
    ctx.restore();
  }

  // 3 Dach setzt auf: Giebel vorne rechts, First, Traufe
  if (tDach > 0) {
    const first = HW + HD;
    const dach = [
      [[L, HW, 0], [L, first, B / 2]], [[L, first, B / 2], [L, HW, B]],
      [[L, first, B / 2], [0, first, B / 2]], [[0, first, B / 2], [0, HW, B]],
    ];
    strichFolge(ctx, dach.map(([p, q]) => [P(...p), P(...q)]), tDach, F.tinte, 5);
    ctx.save(); ctx.setLineDash([14, 10]);
    strichFolge(ctx, [[P(0, first, B / 2), P(0, HW, 0)]], seg(tDach, 0.5, 1), F.verdeckt, 2);
    ctx.restore();
  }

  // 4 Fenster gehen an, in Rötel
  if (tFenster > 0) {
    ctx.fillStyle = F.roetel;
    ctx.globalAlpha = ausQuart(tFenster);
    const flaeche = pts => { ctx.beginPath(); pts.forEach((p, i) => { const q = P(...p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill(); };
    [[1.2, 3.0], [3.8, 5.6], [9.0, 10.8]].forEach(([a, b]) => flaeche([[a, 1.6, B], [b, 1.6, B], [b, 3.8, B], [a, 3.8, B]]));
    flaeche([[L, 1.6, 2.4], [L, 1.6, 5.6], [L, 3.8, 5.6], [L, 3.8, 2.4]]);
    ctx.globalAlpha = 1;
  }
}

/* Strecken der Reihe nach zeichnen, p von 0 bis 1 über die Gesamtlänge */
function strichFolge(ctx, strecken, p, farbe, breite) {
  if (p <= 0) return;
  const laengen = strecken.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  let rest = laengen.reduce((s, l) => s + l, 0) * p;
  ctx.strokeStyle = farbe; ctx.lineWidth = breite;
  ctx.beginPath();
  for (let i = 0; i < strecken.length && rest > 0; i++) {
    const [a, b] = strecken[i], l = laengen[i], q = Math.min(1, rest / (l || 1));
    ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q);
    rest -= l;
  }
  ctx.stroke();
}

/* ---------- Ihr Betrieb: neutrale Vorlage in Hebel-Farben ---------- */
function betrieb(ctx, t, H, name) {
  const F = FARBEN.hebel;
  const RAND = 64, KOPF = 124;
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Ihr Betrieb';
  ctx.fillStyle = F.flaeche; ctx.fillRect(0, 0, 1600, H);

  // Kopfzeile mit dem Namen, rechts angedeutete Navigation
  schrift(ctx, 800, 46, 112);
  ctx.fillStyle = F.tinte; ctx.fillText(kuerzen(ctx, n, 980), RAND, 82);
  ctx.fillStyle = F.flaeche2;
  [0, 1, 2].forEach(i => { rr(ctx, 1600 - RAND - 110 - i * 140, 54, 110, 16, 8); ctx.fill(); });
  ctx.fillStyle = F.linie; ctx.fillRect(0, KOPF, 1600, 3);

  // Titel = Name, Untertitel, Knopf
  const spalte = 700;
  const satz = setzen(ctx, 'betrieb-titel', n, spalte, 3, 124, 56, px => schrift(ctx, 800, px, 112));
  const unter = setzen(ctx, 'betrieb-unter', 'Ihre Leistungen, Ihre Bilder, Ihre Worte.', spalte, 2, 40, 34, px => schrift(ctx, 400, px, 100));
  const blockH = satz.zeilen.length * satz.px * 0.98 + unter.zeilen.length * unter.px * 1.3 + 132;
  schrift(ctx, 800, satz.px, 112);
  ctx.fillStyle = F.tinte;
  let y = KOPF + Math.max(48, (H - KOPF - blockH) / 2) + satz.px * 0.8;
  for (const z of satz.zeilen) { ctx.fillText(z, RAND, y); y += satz.px * 0.98; }
  schrift(ctx, 400, unter.px, 100);
  ctx.fillStyle = F.tinte2;
  y += 10;
  for (const z of unter.zeilen) { ctx.fillText(z, RAND, y + unter.px * 0.6); y += unter.px * 1.3; }
  schrift(ctx, 600, 34, 100);
  const kt = 'Anfrage senden', kb = ctx.measureText(kt).width + 72, kh = 76;
  const ky = Math.min(y + 36, H - 56 - kh);
  ctx.fillStyle = F.kobalt; rr(ctx, RAND, ky, kb, kh, kh / 2); ctx.fill();
  ctx.fillStyle = F.aufKobalt; ctx.fillText(kt, RAND + 36, ky + 50);

  // Bildfläche mit drei Formen, die nacheinander landen
  const bx = 840, by = KOPF + 44, bw = 1600 - RAND - bx, bh = H - by - 56;
  ctx.fillStyle = F.flaeche2; rr(ctx, bx, by, bw, bh, 28); ctx.fill();
  const g = Math.min(bw, bh);
  const formen = [
    { x: bx + bw * 0.3, y: by + bh * 0.58, f: F.kobalt, art: 'kreis' },
    { x: bx + bw * 0.56, y: by + bh * 0.42, f: F.tinte, art: 'quadrat' },
    { x: bx + bw * 0.76, y: by + bh * 0.64, f: F.butter, art: 'dreieck' },
  ];
  formen.forEach((o, i) => {
    const p = seg(t, 0.1 + i * 0.18, 0.5 + i * 0.18);
    if (p <= 0) return;
    const s = Math.max(0, landen(p)) * g * 0.13;
    ctx.fillStyle = o.f;
    ctx.beginPath();
    if (o.art === 'kreis') ctx.arc(o.x, o.y, s, 0, Math.PI * 2);
    else if (o.art === 'quadrat') rr(ctx, o.x - s, o.y - s, s * 2, s * 2, s * 0.22);
    else { ctx.moveTo(o.x, o.y - s * 1.1); ctx.lineTo(o.x + s * 1.1, o.y + s * 0.8); ctx.lineTo(o.x - s * 1.1, o.y + s * 0.8); ctx.closePath(); }
    ctx.fill();
  });
}
