/* Projekte als Ring: sieben Karten auf einem Zylinder, der Scroll dreht ihn, Ziehen dreht weiter.
   Die Karten stehen im selben 3D-Raum wie das grosse Wort in der Mitte: hintere Karten laufen hinter
   der Schrift durch, vordere davor. Gebaut wird aus der Liste im HTML; die Liste bleibt für
   Screenreader und ohne JavaScript stehen. Selbstlaufend ist nur das Ausrollen nach dem Ziehen,
   und das fällt bei reduzierter Bewegung weg. */

const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => Array.from(w.querySelectorAll(s));

export function starteRing({ sektion, reduziert = false, fein = false, beiWechsel }) {
  const buehne = $('[data-ring-buehne]', sektion);
  const ring = $('[data-ring]', sektion);
  const steuer = $('[data-ring-steuer]', sektion);
  const eintraege = $$('[data-projekt]', sektion);
  const N = eintraege.length;
  if (!ring || !N) return null;
  const SCHRITT = 360 / N;

  /* Aufbau: Szene, Rad, Wort in der Mitte, Karten */
  const szene = document.createElement('div');
  szene.className = 'ring__szene';
  const rad = document.createElement('div');
  rad.className = 'ring__rad';
  const wort = document.createElement('p');
  wort.className = 'ring__wort';
  wort.setAttribute('aria-hidden', 'true');
  const karten = eintraege.map((e, i) => {
    const k = document.createElement('figure');
    k.className = 'ring__karte';
    k.dataset.i = String(i);
    k.dataset.ziel = 'Ansehen';
    const bild = document.createElement('img');
    bild.src = e.dataset.bild;
    bild.alt = '';
    bild.width = 600; bild.height = 400;
    bild.loading = 'lazy';
    bild.decoding = 'async';
    bild.draggable = false;
    const nr = document.createElement('span');
    nr.className = 'ring__nr';
    nr.textContent = String(i + 1).padStart(2, '0');
    k.append(bild, nr);
    rad.append(k);
    return k;
  });
  szene.append(wort, rad);
  ring.append(szene);

  /* Steuerung: Sektoren als Knöpfe, Beschriftung der vorderen Karte */
  const sektoren = $('[data-sektoren]', steuer);
  const sektorKnoepfe = eintraege.map((e, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ring__sektor';
    b.setAttribute('aria-label', 'Projekt ' + (i + 1) + ': ' + $('.liste__name', e).textContent);
    b.addEventListener('click', () => zu(i));
    sektoren.append(b);
    return b;
  });
  const titel = document.createElement('div');
  titel.className = 'ring__titel';
  titel.setAttribute('aria-hidden', 'true');
  steuer.prepend(titel);
  const zahl = $('[data-ring-zahl]', steuer);
  steuer.hidden = false;
  sektion.classList.add('hat-ring');

  /* Zustand: Winkel aus Scroll plus Winkel aus Ziehen und Knöpfen */
  let scrollWinkel = 0, zugWinkel = 0, zugZiel = 0, schwung = 0, ziehen = null;
  let ist = 0, vorne = -1, raf = 0, letzt = 0;
  const neigung = { x: 0, y: 0, zx: 0, zy: 0 };
  let radius = 0, breite = 0;

  function messen() {
    const kb = karten[0].offsetWidth || 300;
    if (kb === breite) return;
    breite = kb;
    radius = Math.round((kb / 2) / Math.tan(Math.PI / N) * 1.18);
    ring.style.setProperty('--radius', radius + 'px');
    karten.forEach((k, i) => { k.style.transform = 'rotateY(' + (i * SCHRITT) + 'deg) translateZ(' + radius + 'px)'; });
  }

  function fortschritt() {
    const r = sektion.getBoundingClientRect();
    const strecke = r.height - window.innerHeight;
    if (strecke <= 0) return 0;
    return klemmen(-r.top / strecke);
  }

  function beschriften(i) {
    const e = eintraege[i];
    const name = $('.liste__name', e).textContent;
    const meta = $$('.liste__meta span', e).map(s => s.textContent).join('  /  ');
    const text = $('.liste__text', e).textContent;
    titel.innerHTML = '';
    const h = document.createElement('p'); h.className = 'ring__name'; h.textContent = name;
    const m = document.createElement('p'); m.className = 'ring__meta'; m.textContent = meta;
    const t = document.createElement('p'); t.className = 'ring__text'; t.textContent = text;
    titel.append(m, h, t);
    // grosses Baujahr hinter der vorderen Karte, die hinteren Karten laufen dahinter durch
    const jahr = ($('.liste__meta span', e) || {}).textContent || '';
    if (wort.textContent !== jahr) {
      wort.textContent = jahr;
      wort.classList.remove('ist-neu');
      void wort.offsetWidth;
      wort.classList.add('ist-neu');
    }
    titel.classList.remove('ist-neu');
    void titel.offsetWidth;
    titel.classList.add('ist-neu');
    if (zahl) zahl.textContent = (i + 1) + ' / ' + N;
    sektorKnoepfe.forEach((b, j) => {
      b.classList.toggle('ist-aktiv', j === i);
      if (j === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    karten.forEach((k, j) => k.classList.toggle('ist-vorne', j === i));
    let anfrage = steuer.querySelector('[data-ring-anfrage]');
    if (!anfrage) {
      anfrage = document.createElement('a');
      anfrage.className = 'ring__anfrage';
      anfrage.href = '#offerte';
      anfrage.dataset.ringAnfrage = '';
      anfrage.dataset.magnet = '';
      steuer.append(anfrage);
    }
    anfrage.dataset.projektart = e.dataset.art;
    anfrage.dataset.ziel = 'Offerte';
    anfrage.textContent = 'So etwas anfragen: ' + e.dataset.art;
    if (beiWechsel) beiWechsel(i);
  }

  function takt(jetzt) {
    raf = 0;
    const dt = Math.min(0.05, letzt ? (jetzt - letzt) / 1000 : 0.016);
    letzt = jetzt;
    let bewegt = false;
    if (!ziehen && Math.abs(schwung) > 0.01 && !reduziert) {
      zugZiel += schwung * dt * 60;
      schwung *= Math.pow(0.9, dt * 60);
      bewegt = true;
    }
    const f = reduziert ? 1 : 1 - Math.exp(-dt * 9);
    zugWinkel += (zugZiel - zugWinkel) * f;
    neigung.x += (neigung.zx - neigung.x) * f;
    neigung.y += (neigung.zy - neigung.y) * f;
    const soll = -(scrollWinkel + zugWinkel);
    ist += (soll - ist) * (reduziert ? 1 : 1 - Math.exp(-dt * 12));
    if (Math.abs(soll - ist) > 0.02 || Math.abs(zugZiel - zugWinkel) > 0.02) bewegt = true;
    if (Math.abs(neigung.zx - neigung.x) + Math.abs(neigung.zy - neigung.y) > 0.002) bewegt = true;
    rad.style.transform = 'translateZ(' + (-radius) + 'px) rotateX(' + (-7 + neigung.y * 4).toFixed(2) + 'deg) rotateY(' + (ist + neigung.x * 6).toFixed(2) + 'deg)';
    wort.style.transform = 'translate3d(' + (neigung.x * -18).toFixed(1) + 'px,' + (neigung.y * -10).toFixed(1) + 'px,' + (-radius) + 'px)';
    const i = ((Math.round(-ist / SCHRITT) % N) + N) % N;
    if (i !== vorne) { vorne = i; beschriften(i); }
    if (bewegt) raf = requestAnimationFrame(takt); else letzt = 0;
  }
  const anstossen = () => { if (!raf) raf = requestAnimationFrame(takt); };

  function zu(i) {
    // kürzester Weg zur Karte i
    const jetzt = scrollWinkel + zugZiel;
    let diff = i * SCHRITT - jetzt;
    diff = ((diff % 360) + 540) % 360 - 180;
    schwung = 0;
    zugZiel += diff;
    anstossen();
  }

  /* Ziehen: Maus und Finger; senkrecht scrollt die Seite weiter */
  ring.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    ziehen = { x: e.clientX, y: e.clientY, t: performance.now(), start: zugZiel, gezogen: false, id: e.pointerId };
    schwung = 0;
  });
  window.addEventListener('pointermove', e => {
    if (fein && !ziehen) {
      const r = buehne.getBoundingClientRect();
      if (e.clientY > r.top && e.clientY < r.bottom) {
        neigung.zx = (e.clientX / window.innerWidth - 0.5) * 2;
        neigung.zy = ((e.clientY - r.top) / r.height - 0.5) * 2;
        anstossen();
      }
    }
    if (!ziehen || e.pointerId !== ziehen.id) return;
    const dx = e.clientX - ziehen.x;
    if (!ziehen.gezogen && Math.abs(dx) > 6) {
      ziehen.gezogen = true;
      ring.classList.add('wird-gezogen');
      try { ring.setPointerCapture(e.pointerId); } catch (f) { /* nichts */ }
    }
    if (!ziehen.gezogen) return;
    const jetzt = performance.now();
    const neu = ziehen.start - dx * 0.22;
    const dtz = Math.max(8, jetzt - ziehen.t);
    schwung = (neu - zugZiel) / dtz * 16;
    ziehen.t = jetzt;
    zugZiel = neu;
    anstossen();
  });
  const loslassen = e => {
    if (!ziehen) return;
    const war = ziehen;
    ziehen = null;
    ring.classList.remove('wird-gezogen');
    if (!war.gezogen) {
      const karte = e.target.closest && e.target.closest('.ring__karte');
      if (karte) zu(Number(karte.dataset.i));
      return;
    }
    // auf die nächste Karte einrasten, nachdem der Schwung ausgelaufen ist
    if (reduziert) schwung = 0;
    const endWinkel = zugZiel + schwung * 9;
    const gesamt = scrollWinkel + endWinkel;
    zugZiel = Math.round(gesamt / SCHRITT) * SCHRITT - scrollWinkel;
    schwung = 0;
    anstossen();
  };
  window.addEventListener('pointerup', loslassen);
  window.addEventListener('pointercancel', loslassen);

  $('[data-ring-zurueck]', steuer).addEventListener('click', () => zu((vorne - 1 + N) % N));
  $('[data-ring-weiter]', steuer).addEventListener('click', () => zu((vorne + 1) % N));

  /* Hover: Karte hebt sich, das Bild verzieht sich zum Zeiger */
  if (fein) {
    karten.forEach(k => {
      k.addEventListener('pointermove', e => {
        const r = k.getBoundingClientRect();
        k.style.setProperty('--hx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        k.style.setProperty('--hy', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
      k.addEventListener('pointerleave', () => { k.style.setProperty('--hx', 0); k.style.setProperty('--hy', 0); });
    });
  }

  const groesse = new ResizeObserver(() => { breite = 0; messen(); anstossen(); });
  groesse.observe(ring);
  messen();

  return {
    /** vom Seitentakt: dreht den Ring mit dem Scroll */
    scroll() {
      const p = fortschritt();
      const neu = p * (N - 1) * SCHRITT;
      if (Math.abs(neu - scrollWinkel) < 0.01) return;
      scrollWinkel = neu;
      anstossen();
    },
  };
}
