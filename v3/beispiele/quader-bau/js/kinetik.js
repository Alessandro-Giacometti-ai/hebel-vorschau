/* Kinetische Schrift, ganz am Scroll: Ein Satz wird in Zeichen zerlegt, jede Art beschreibt, wie ein
   Zeichen kommt (ein: 0 bis 1) und wie es geht (aus: 0 bis 1). Die Arten sind Bauhandlungen:
   heben (steigt aus dem Boden), fallen (fällt in die Grube), giessen (füllt sich von unten wie
   Beton in der Schalung), stapeln (setzt von oben auf wie eine Platte am Kran), drehen (kippt
   ein wie ein Schlüssel im Schloss). Nichts läuft von selbst; ohne Aufruf bleibt der Satz stehen.
   Screenreader lesen den ganzen Satz aus einem unsichtbaren Text, die Zeichen sind aria-hidden. */

const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ausKubisch = k => 1 - Math.pow(1 - k, 3);
const einQuadrat = k => k * k;
const ausZurueck = k => { const c = 1.5; const x = k - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

function zufall(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const ARTEN = {
  heben: {
    ein: (z, e) => `translate3d(0,${((1 - ausKubisch(e)) * 112).toFixed(2)}%,0)`,
    aus: (z, e) => `translate3d(0,${(-einQuadrat(e) * 112).toFixed(2)}%,0)`,
  },
  fallen: {
    ein: (z, e) => `translate3d(0,${(-(1 - ausKubisch(e)) * 112).toFixed(2)}%,0)`,
    aus: (z, e, h) => {
      const k = einQuadrat(e);
      return `translate3d(${(z.r2 - 0.5) * 90 * k}px,${(k * h).toFixed(1)}px,0) rotate(${((z.r1 - 0.5) * 110 * k).toFixed(1)}deg)`;
    },
  },
  giessen: {
    ein: (z, e) => null,
    clip: (z, e) => `inset(${((1 - ausKubisch(e)) * 100).toFixed(1)}% 0 -0.2em 0)`,
    aus: (z, e) => `translate3d(0,${(e * 30).toFixed(1)}%,0)`,
    deckkraft: (e) => 1 - e,
  },
  stapeln: {
    ein: (z, e) => {
      const k = ausZurueck(e);
      return `translate3d(0,${(-(1 - k) * (260 + z.r1 * 220)).toFixed(1)}%,0) rotate(${((1 - k) * (z.r2 - 0.5) * 40).toFixed(1)}deg)`;
    },
    aus: (z, e) => `translate3d(0,${(-einQuadrat(e) * (320 + z.r1 * 200)).toFixed(1)}%,0) rotate(${(e * (z.r2 - 0.5) * 30).toFixed(1)}deg)`,
    deckkraft: (e) => 1 - einQuadrat(e),
  },
  drehen: {
    ein: (z, e) => `perspective(600px) rotateX(${((1 - ausKubisch(e)) * -92).toFixed(1)}deg)`,
    aus: (z, e) => `perspective(600px) rotateX(${(einQuadrat(e) * 92).toFixed(1)}deg)`,
  },
};

/** Zerlegt el in Wörter und Zeichen. <br> im Quelltext bleibt ein Zeilenumbruch. */
export function zerlege(el, art = el.dataset.kinetik || 'heben') {
  if (el._satz) return el._satz;
  const lesbar = el.textContent.replace(/\s+/g, ' ').trim();
  const teile = [];
  el.childNodes.forEach(n => {
    if (n.nodeType === 3) teile.push(...n.textContent.replace(/\s+/g, ' ').split(' ').filter(Boolean).map(w => ({ wort: w })));
    else if (n.nodeName === 'BR') teile.push({ umbruch: true });
    else if (n.textContent.trim()) teile.push(...n.textContent.trim().split(/\s+/).map(w => ({ wort: w })));
  });
  el.textContent = '';
  const text = document.createElement('span');
  text.className = 'unsichtbar';
  text.textContent = lesbar;
  const bild = document.createElement('span');
  bild.className = 'satz satz--' + art;
  bild.setAttribute('aria-hidden', 'true');
  const zeichen = [];
  teile.forEach((t, i) => {
    if (t.umbruch) { bild.append(document.createElement('br')); return; }
    const w = document.createElement('span');
    w.className = 'satz__wort';
    for (const ch of t.wort) {
      const z = document.createElement('span');
      z.className = 'satz__z';
      z.textContent = ch;
      w.append(z);
      zeichen.push({ el: z, r1: zufall(zeichen.length + 1), r2: zufall(zeichen.length + 91) });
    }
    bild.append(w);
    if (i < teile.length - 1 && !teile[i + 1].umbruch) bild.append(' ');
  });
  el.append(text, bild);
  const satz = new Satz(el, bild, zeichen, ARTEN[art] || ARTEN.heben);
  el._satz = satz;
  return satz;
}

class Satz {
  constructor(el, bild, zeichen, art) {
    this.el = el; this.bild = bild; this.zeichen = zeichen; this.art = art;
    this.ein = -1; this.aus = -1;
    this.streuung = 0.55;
  }
  /** ein und aus von 0 bis 1; Fallhöhe in px für "fallen" */
  setze(ein, aus = 0, fallhoehe = 600) {
    ein = klemmen(ein); aus = klemmen(aus);
    if (Math.abs(ein - this.ein) < 0.0005 && Math.abs(aus - this.aus) < 0.0005) return;
    this.ein = ein; this.aus = aus;
    const n = this.zeichen.length, st = this.streuung;
    const ruht = ein >= 1 && aus <= 0;
    this.bild.classList.toggle('ist-unterwegs', !ruht);
    this.el.classList.toggle('ist-weg', aus >= 1 || ein <= 0);
    for (let i = 0; i < n; i++) {
      const z = this.zeichen[i];
      const s = z.el.style;
      if (ruht) { s.transform = ''; s.opacity = ''; s.clipPath = ''; continue; }
      const lage = n > 1 ? i / (n - 1) : 0;
      const e = klemmen((ein * (1 + st) - lage * st) / 1);
      const a = klemmen((aus * (1 + st) - lage * st) / 1);
      let tf = '', op = 1, clip = '';
      if (a > 0) {
        tf = this.art.aus(z, a, fallhoehe) || '';
        if (this.art.deckkraft) op = this.art.deckkraft(a);
      } else {
        tf = this.art.ein(z, e, fallhoehe) || '';
        if (this.art.clip) clip = this.art.clip(z, e);
        if (e <= 0 && !this.art.clip) op = 0;
      }
      s.transform = tf;
      s.opacity = op >= 1 ? '' : op.toFixed(3);
      s.clipPath = clip;
    }
  }
}
