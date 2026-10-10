/* Zeitraffer als Bildfolge: Der Scroll ist die Zeit.
   Lädt meta.json, wählt den Satz für Quer- oder Hochformat und zeichnet zur Filmzeit vt (0 bis 1)
   das passende Bild, mit Überblendung zum Nachbarbild, damit 64 Bilder über eine lange Strecke
   nicht ruckeln. Geladen wird grob verteilt zuerst, dann verfeinert; gezeichnet wird das nächste
   geladene Bild. Gezeichnet wird nur, wenn sich etwas ändert. */

const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export async function starteFilm({ canvas, basis, hoch = false, fokus = [0.5, 0.6] }) {
  const antwort = await fetch(basis + 'meta.json');
  if (!antwort.ok) throw new Error('meta.json fehlt');
  const meta = await antwort.json();
  const satz = hoch ? meta.mobil : meta.desktop;
  if (!satz || !satz.anzahl) throw new Error('meta.json unvollständig');
  const N = satz.anzahl;
  const adresse = i => basis + satz.praefix + String(i + 1).padStart(4, '0') + satz.endung;

  const ctx = canvas.getContext('2d', { alpha: false });
  const bilder = new Array(N).fill(null);
  let B = 0, H = 0, dpr = 1, lage = null, vt = 0, gezeichnet = '', zeichnenAngefragt = false;
  const beimLayout = [];

  /* Ladereihenfolge: erstes, letztes, dann halbieren, bis alle drin sind */
  const reihe = [];
  const drin = new Set();
  const dazu = i => { if (i >= 0 && i < N && !drin.has(i)) { drin.add(i); reihe.push(i); } };
  dazu(0); dazu(N - 1);
  for (let schritt = 1 << Math.floor(Math.log2(N - 1)); schritt >= 1; schritt >>= 1) {
    for (let i = 0; i < N; i += schritt) dazu(i);
  }
  let laufend = 0, naechster = 0;
  function laden() {
    while (laufend < 4 && naechster < reihe.length) {
      const i = reihe[naechster++];
      laufend++;
      const im = new Image();
      im.decoding = 'async';
      const fertig = () => {
        laufend--;
        if (im.naturalWidth) { bilder[i] = im; anfragen(); }
        laden();
      };
      im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).then(fertig, fertig); };
      im.onerror = () => { laufend--; laden(); };
      im.src = adresse(i);
    }
  }

  function messen() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const b = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (b !== B || h !== H) { B = b; H = h; canvas.width = b; canvas.height = h; gezeichnet = ''; }
    const s = Math.max(B / satz.breite, H / satz.hoehe);
    const dw = satz.breite * s, dh = satz.hoehe * s;
    lage = { dx: (B - dw) * fokus[0], dy: (H - dh) * fokus[1], dw, dh };
    const css = { x: lage.dx / dpr, y: lage.dy / dpr, b: dw / dpr, h: dh / dpr };
    for (const f of beimLayout) f(css);
  }

  function naechstGeladen(i) {
    if (bilder[i]) return i;
    for (let d = 1; d < N; d++) {
      if (bilder[i - d]) return i - d;
      if (bilder[i + d]) return i + d;
    }
    return -1;
  }

  function zeichnen() {
    zeichnenAngefragt = false;
    if (!lage) messen();
    const f = klemmen(vt) * (N - 1);
    const i0 = Math.floor(f), anteil = f - i0;
    const a = naechstGeladen(i0);
    if (a < 0) return;
    const b = a === i0 && i0 + 1 < N && bilder[i0 + 1] ? i0 + 1 : -1;
    const schluessel = a + ':' + (b >= 0 ? anteil.toFixed(3) : '') + ':' + B + 'x' + H;
    if (schluessel === gezeichnet) return;
    gezeichnet = schluessel;
    ctx.globalAlpha = 1;
    ctx.drawImage(bilder[a], lage.dx, lage.dy, lage.dw, lage.dh);
    if (b >= 0 && anteil > 0.004) {
      ctx.globalAlpha = anteil;
      ctx.drawImage(bilder[b], lage.dx, lage.dy, lage.dw, lage.dh);
      ctx.globalAlpha = 1;
    }
    canvas.dataset.bild = String(a + 1);
  }

  function anfragen() {
    if (zeichnenAngefragt) return;
    zeichnenAngefragt = true;
    requestAnimationFrame(zeichnen);
  }

  const waechter = new ResizeObserver(() => { messen(); anfragen(); });
  waechter.observe(canvas);
  messen();
  laden();

  return {
    anzahl: N,
    setze(t) {
      const neu = klemmen(t);
      if (Math.abs(neu - vt) < 0.00005) return;
      vt = neu;
      anfragen();
    },
    /** f(lage) wird bei jeder Grössenänderung mit dem gezeichneten Bildrechteck in CSS-Pixeln gerufen */
    beiLayout(f) { beimLayout.push(f); if (lage) f({ x: lage.dx / dpr, y: lage.dy / dpr, b: lage.dw / dpr, h: lage.dh / dpr }); },
    zerstoeren() { waechter.disconnect(); },
  };
}
