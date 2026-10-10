/* Fumo, ein Abend am Feuer: Film, Videoschnitte, Zeitleiste, Tischplan, Karte, Abend und Reservierung (Demo).
   Grundlage: docs/webstudio-2026-10/master-prompts/02-fumo-abendfilm.md. Technik nach Tableau (Sprogis), Inhalte nur aus dem Prompt. */
import * as THREE from 'three';

/* ================= Helfer ================= */
const $ = (s, k) => (k || document).querySelector(s);
const $$ = (s, k) => Array.from((k || document).querySelectorAll(s));
const html = document.documentElement;
/* Ruhig nur, wenn der Besucher es selbst gewählt hat (Klasse ruhig aus localStorage hebel-ruhig, gesetzt im Kopf).
   Die Systemeinstellung "reduzierte Bewegung" schaltet nichts ab. Der Knopf "Bewegung" schaltet live um. */
let ruhig = html.classList.contains('ruhig');
document.addEventListener('hebel-ruhig', (e) => { ruhig = !!e.detail; });
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const fenster = (p, a, b, c, d) => smooth(a, b, p) * (1 - smooth(c, d, p));
const schmalMq = matchMedia('(max-width: 760px)');
const feinerZeiger = matchMedia('(pointer: fine)').matches;
const kopfHoehe = () => (schmalMq.matches ? 56 : 60) + 30;

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(23);

function scrolleZu(el, versatz) {
  if (!el) return;
  const v = typeof versatz === 'number' ? versatz : -(kopfHoehe() + 8);
  const y = el.getBoundingClientRect().top + scrollY + v;
  scrollTo({ top: y, behavior: ruhig ? 'auto' : 'smooth' });
}

/* ================= Kopf, Menü, Anker ================= */
const film = $('#film');
const buehne = $('#buehne');
(function kopfUndMenue() {
  const menue = $('[data-menue]');
  const knopf = $('[data-menue-knopf]');
  const text = $('[data-menue-text]');
  function setzen(offen) {
    menue.hidden = !offen;
    knopf.setAttribute('aria-expanded', String(offen));
    text.textContent = offen ? 'Menü schliessen' : 'Menü öffnen';
    html.classList.toggle('menue-offen', offen);
    ['main', '.hinweis', '.fuss', '.sprung'].forEach((s) => { const el = $(s); if (el) el.inert = offen; });
    if (offen) { const a = $('a', menue); if (a) a.focus(); }
  }
  knopf.addEventListener('click', () => setzen(menue.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menue.hidden) { setzen(false); knopf.focus(); } });
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const ziel = $(id);
    if (!ziel) return;
    e.preventDefault();
    if (!menue.hidden) setzen(false);
    if (id === '#film') scrollTo({ top: 0, behavior: ruhig ? 'auto' : 'smooth' });
    else scrolleZu(ziel);
    history.replaceState(null, '', id);
    if (a.classList.contains('sprung')) { ziel.setAttribute('tabindex', '-1'); ziel.focus({ preventScroll: true }); }
  }));
  const vorbeiPruefen = () => {
    const r = film.getBoundingClientRect();
    document.body.classList.toggle('vorbei', r.bottom < kopfHoehe() + 2);
  };
  addEventListener('scroll', vorbeiPruefen, { passive: true });
  vorbeiPruefen();
})();

/* ================= Hero: Buchstaben ================= */
const hero = $('#hero');
const heroBuchstaben = [];
(function heroTeilen() {
  const h1 = $('h1', hero);
  let i = 0;
  $$(':scope > span', h1).forEach((zeile) => {
    const woerter = zeile.textContent.split(' ');
    zeile.textContent = '';
    zeile.setAttribute('aria-hidden', 'true');
    woerter.forEach((w, wi) => {
      const wort = document.createElement('span');
      wort.className = 'wort';
      for (const ch of w) {
        const b = document.createElement('span');
        b.className = 'bs';
        b.textContent = ch;
        b.style.setProperty('--i', i);
        // Faktor fest aus dem Index, 0.5 bis 1.6
        heroBuchstaben.push({ el: b, f: 0.5 + ((i * 7919) % 23) / 22 * 1.1, dreh: (i % 2 ? 1 : -1) * (8 + (i * 13) % 17) });
        wort.appendChild(b);
        i++;
      }
      zeile.appendChild(wort);
      if (wi < woerter.length - 1) zeile.appendChild(document.createTextNode(' '));
    });
  });
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = 'Alles kommt aus dem Feuer.';
  h1.appendChild(sr);
  // Nach dem Aufsteigen fällt die Maske weg, damit die Buchstaben beim Scrollen frei davonfliegen
  setTimeout(() => $$('.wort', h1).forEach((w) => w.classList.add('frei')), ruhig ? 0 : 150 + i * 18 + 500);
})();
const heroNeben = $$('.zeile, .hero__seite', hero);
let heroZuletzt = -1;
function heroScroll(p) {
  const q = clamp(p / 0.06);
  if (Math.abs(q - heroZuletzt) < 0.0005) return;
  heroZuletzt = q;
  for (const b of heroBuchstaben) {
    if (ruhig) { b.el.style.opacity = String(clamp(1 - q * 2.2)); continue; }
    const y = -q * b.f * 400;
    b.el.style.transform = q > 0 ? `translate3d(0,${y.toFixed(1)}px,0) rotate(${(q * b.dreh).toFixed(2)}deg)` : '';
    b.el.style.opacity = String(clamp(1 - q * 1.25 * b.f));
  }
  heroNeben.forEach((el) => { el.style.opacity = String(clamp(1 - q * (ruhig ? 2.2 : 1.6))); el.style.transform = ruhig ? '' : `translateY(${(-q * 34).toFixed(1)}px)`; });
  hero.style.visibility = q > 0.985 ? 'hidden' : 'visible';
}

/* Paneele gleiten unter den Kopf und tauchen über dem KI-Hinweis und der Zeitleiste auf, statt sie zu verdecken.
   Am Handy bleiben sie in der unteren Bildhälfte, damit nie zwei Paneele zugleich die Szene zudecken.
   Nebenbei: Liegt ein Paneel über der Legende des Tischplans, tritt die Legende zurück. */
let legendeVerdeckt = false;
(function paneeleKappen() {
  const paneele = $$('.paneel');
  const leiste = $('#zeitleiste'), ki = $('#ki-hinweis'), leg = $('#legende');
  const KANTE = 22;
  let laeuft = false;
  function rechnen() {
    laeuft = false;
    if (html.classList.contains('no-webgl')) return;
    const oben = schmalMq.matches ? Math.max(kopfHoehe(), innerHeight * 0.4) : kopfHoehe();
    const unten = Math.min(leiste.getBoundingClientRect().top, ki.getBoundingClientRect().top) - 8;
    const lr = leg.getBoundingClientRect();
    let deckt = false;
    for (const el of paneele) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const a = Math.max(0, oben - r.top), b = Math.min(r.height, unten - r.top);
      let clip = '', maske = '';
      if (a > 0 || b < r.height) {
        clip = `inset(${Math.min(a, r.height).toFixed(0)}px 0 ${Math.min(r.height, Math.max(0, r.height - b)).toFixed(0)}px 0)`;
        maske = `linear-gradient(to bottom, transparent ${(oben - r.top).toFixed(0)}px, #000 ${(oben - r.top + KANTE).toFixed(0)}px, #000 ${(unten - r.top - KANTE).toFixed(0)}px, transparent ${(unten - r.top).toFixed(0)}px)`;
      }
      if (el.style.clipPath !== clip) el.style.clipPath = clip;
      if (el.dataset.maske !== maske) { el.dataset.maske = maske; el.style.webkitMaskImage = maske; el.style.maskImage = maske; }
      const vt = Math.max(r.top, oben), vb = Math.min(r.bottom, unten);
      if (vb > vt && r.left < lr.right && r.right > lr.left && vt < lr.bottom && vb > lr.top) deckt = true;
    }
    legendeVerdeckt = deckt;
  }
  addEventListener('scroll', () => { if (!laeuft) { laeuft = true; requestAnimationFrame(rechnen); } }, { passive: true });
  addEventListener('resize', rechnen);
  rechnen();
})();

/* ================= Karte: Bild zum Gericht, Unterschriften ================= */
(function karte() {
  const klein = () => schmalMq.matches;
  const quelle = (name) => `/hebel-vorschau/v3/beispiele/fumo/bilder/${name}${klein() ? '-klein' : ''}.webp`;
  $$('[data-gang]').forEach((gang) => {
    const img = $('[data-gruppe-bild]', gang);
    const grund = img.getAttribute('data-grund');
    img.src = quelle(grund);
    let aktuell = grund;
    const zeigen = (name) => {
      if (name === aktuell) return;
      aktuell = name;
      const vor = new Image();
      vor.src = quelle(name);
      const tauschen = () => { img.style.opacity = '0'; setTimeout(() => { img.src = vor.src; img.style.opacity = ''; }, ruhig ? 0 : 160); };
      if (vor.decode) vor.decode().then(tauschen, tauschen); else tauschen();
    };
    $$('.gericht[data-bild]', gang).forEach((g) => {
      const an = () => { $$('.gericht', gang).forEach((x) => x.classList.toggle('aktiv', x === g)); zeigen(g.getAttribute('data-bild')); };
      g.addEventListener('mouseenter', an);
      g.addEventListener('focus', an);
      g.addEventListener('click', an);
    });
    gang.addEventListener('mouseleave', () => { $$('.gericht', gang).forEach((x) => x.classList.remove('aktiv')); zeigen(grund); });
  });
  const io = new IntersectionObserver((eintraege) => eintraege.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('sichtbar'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -25% 0px' });
  $$('[data-gang]').forEach((g) => io.observe(g));
})();

/* ================= Der Abend: Zeitstrahl ================= */
(function abend() {
  const abschnitt = $('#abend');
  const spur = $('#abend-spur');
  const liste = $('#stationen');
  const linie = $('.abend__linie', liste);
  const stationen = $$('.station', liste);
  let laeuft = false;
  function rechnen() {
    laeuft = false;
    if (schmalMq.matches) {
      spur.style.transform = '';
      const r = liste.getBoundingClientRect();
      const mitte = innerHeight * 0.6;
      linie.style.setProperty('--fuell', clamp((mitte - r.top - 34) / Math.max(1, r.height - 78)).toFixed(4));
      stationen.forEach((s) => s.classList.toggle('an', s.getBoundingClientRect().top + 34 < mitte));
      return;
    }
    const r = abschnitt.getBoundingClientRect();
    const k = clamp(-r.top / Math.max(1, r.height - innerHeight));
    const weg = Math.max(0, spur.scrollWidth - innerWidth);
    spur.style.transform = `translate3d(${(-k * weg).toFixed(1)}px,0,0)`;
    const mitte = innerWidth * 0.62;
    const lr = linie.getBoundingClientRect();
    linie.style.setProperty('--fuell', clamp((mitte - lr.left) / Math.max(1, lr.width)).toFixed(4));
    stationen.forEach((s) => s.classList.toggle('an', s.getBoundingClientRect().left < mitte));
  }
  const anstossen = () => { if (!laeuft) { laeuft = true; requestAnimationFrame(rechnen); } };
  addEventListener('scroll', anstossen, { passive: true });
  addEventListener('resize', anstossen);
  rechnen();
})();

/* ================= Tischwahl: gemeinsamer Zustand von Film und Formular ================= */
const TISCHE = [
  { n: 1, x: -6.5, z: -8.0, plaetze: 2, art: 'bald' },
  { n: 2, x: -3.0, z: -8.2, plaetze: 4, art: 'besetzt' },
  { n: 3, x: 3.0, z: -8.2, plaetze: 4, art: 'besetzt' },
  { n: 4, x: 6.5, z: -8.0, plaetze: 2, art: 'bald' },
  { n: 5, x: -6.6, z: -1.6, plaetze: 6, art: 'besetzt' },
  { n: 6, x: -3.2, z: -0.6, plaetze: 4, art: 'frei' },
  { n: 7, x: 3.2, z: -0.6, plaetze: 4, art: 'besetzt' },
  { n: 8, x: 6.6, z: -1.6, plaetze: 8, art: 'besetzt' },
];
const tischText = (n) => (n ? 'Tisch ' + n + (String(n) === '6' ? ', am Feuer' : '') : 'kein Wunsch');
const wahl = {
  tisch: null,
  hoerer: [],
  setzen(n, quelle) {
    this.tisch = n ? Number(n) : null;
    this.hoerer.forEach((f) => f(this.tisch, quelle));
  },
};
const tischKnopf = $('#tisch-knopf');
wahl.hoerer.push((n) => {
  tischKnopf.disabled = !n;
  tischKnopf.textContent = n ? `Tisch ${n} reservieren` : 'Diesen Tisch reservieren';
});
tischKnopf.addEventListener('click', () => {
  if (!wahl.tisch) return;
  scrolleZu($('#reservieren'));
  setTimeout(() => { const s = $('#res-tisch'); if (s) s.focus({ preventScroll: true }); }, ruhig ? 50 : 900);
});

/* ================= Reservierung (Logik aus v2, plus Tisch und Funkenregen) ================= */
(function reservierung() {
  var TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var FENSTER_TAGE = 60;
  var SPEICHER = 'fumo-demo-reservierung';

  function heute0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ausIso(s) { var t = s.split('-'); return new Date(+t[0], +t[1] - 1, +t[2]); }
  function zu(d) { var w = d.getDay(); return w === 1 || w === 2; }
  function imFenster(d) { var h = heute0(); var ende = new Date(h); ende.setDate(h.getDate() + FENSTER_TAGE); return d >= h && d <= ende; }
  function langDatum(d) { return TAGE_LANG[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear(); }
  function personenText(n) { return n + (n === 1 ? ' Person' : ' Personen'); }

  function zeitenFuer(d) {
    var liste = d.getDay() === 0 ? ['12.00', '12.30', '13.00', '13.30', '14.00'] : ['18.00', '18.30', '19.00', '19.30', '20.00', '20.30', '21.00'];
    return liste;
  }
  /* Gleichbleibend "ausgebucht" je Tag und Zeit, damit die Demo echt wirkt, ohne Zufall bei jedem Laden */
  function ausgebucht(d, z) {
    var s = iso(d) + z, h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
    var w = d.getDay();
    var schwelle = (w === 5 || w === 6) && (z === '19.00' || z === '19.30' || z === '20.00') ? 560 : 260;
    return h < schwelle;
  }
  function vorbei(d, z) {
    var jetzt = new Date();
    if (iso(d) !== iso(jetzt)) return false;
    var t = z.split('.');
    var slot = new Date(d); slot.setHours(+t[0], +t[1], 0, 0);
    return slot.getTime() - jetzt.getTime() < 60 * 60 * 1000;
  }
  function freieZeiten(d) { return zeitenFuer(d).filter(function (z) { return !ausgebucht(d, z) && !vorbei(d, z); }); }
  function offeneTage(anzahl) {
    var r = [], d = heute0();
    for (var i = 0; i <= FENSTER_TAGE && r.length < anzahl; i++) {
      var t = new Date(d); t.setDate(d.getDate() + i);
      if (!zu(t) && freieZeiten(t).length) r.push(t);
    }
    return r;
  }

  var zustand = { datum: null, zeit: null, personen: 2, monat: null, tisch: null };
  var form = $('[data-res-form]');
  if (!form) return;
  // Ohne JavaScript bleibt der Knopf gesperrt, sonst gingen die Eingaben als Adresszeile an den Server
  var sendenKnopf = $('[data-res-senden]');
  if (sendenKnopf) sendenKnopf.disabled = false;
  var kalTage = $('[data-kal-tage]');
  var kalMonat = $('[data-kal-monat]');
  var kalZurueck = $('[data-kal-zurueck]');
  var kalVor = $('[data-kal-vor]');
  var zeitenBox = $('[data-zeiten]');
  var zeitenHilfe = $('[data-zeiten-hilfe]');
  var pWert = $('[data-personen-wert]');
  var pText = $('[data-personen-text]');
  var pMinus = $('[data-personen-minus]');
  var pPlus = $('[data-personen-plus]');
  var fehlerAllg = $('[data-fehler-allgemein]');
  var best = $('[data-bestaetigung]');
  var tischWahl = $('[data-tisch-wahl]');

  function kalenderZeichnen() {
    var h = heute0();
    if (!zustand.monat) zustand.monat = new Date(h.getFullYear(), h.getMonth(), 1);
    var m = zustand.monat;
    kalMonat.textContent = MONATE[m.getMonth()] + ' ' + m.getFullYear();
    kalTage.innerHTML = '';
    var erster = new Date(m.getFullYear(), m.getMonth(), 1);
    var versatz = (erster.getDay() + 6) % 7;
    for (var i = 0; i < versatz; i++) { var leer = document.createElement('span'); leer.className = 'kal__leer'; kalTage.appendChild(leer); }
    var tageImMonat = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (var t = 1; t <= tageImMonat; t++) {
      var d = new Date(m.getFullYear(), m.getMonth(), t);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kal__tag';
      b.textContent = String(t);
      b.setAttribute('data-iso', iso(d));
      var geschlossen = zu(d);
      var frei = imFenster(d) && !geschlossen && freieZeiten(d).length > 0;
      var label = langDatum(d);
      if (geschlossen) { b.classList.add('kal__tag--zu'); label += ', geschlossen'; }
      else if (imFenster(d) && !frei) label += ', ausgebucht';
      if (iso(d) === iso(h)) { b.classList.add('kal__tag--heute'); label += ', heute'; }
      b.setAttribute('aria-label', label);
      b.disabled = !frei;
      b.setAttribute('aria-pressed', String(zustand.datum === iso(d)));
      kalTage.appendChild(b);
    }
    var minMonat = new Date(h.getFullYear(), h.getMonth(), 1);
    var ende = new Date(h); ende.setDate(h.getDate() + FENSTER_TAGE);
    var maxMonat = new Date(ende.getFullYear(), ende.getMonth(), 1);
    kalZurueck.disabled = m <= minMonat;
    kalVor.disabled = m >= maxMonat;
  }
  kalTage.addEventListener('click', function (e) {
    var b = e.target.closest('.kal__tag');
    if (!b || b.disabled) return;
    tagWaehlen(b.getAttribute('data-iso'));
  });
  kalZurueck.addEventListener('click', function () { zustand.monat = new Date(zustand.monat.getFullYear(), zustand.monat.getMonth() - 1, 1); kalenderZeichnen(); });
  kalVor.addEventListener('click', function () { zustand.monat = new Date(zustand.monat.getFullYear(), zustand.monat.getMonth() + 1, 1); kalenderZeichnen(); });

  function tagWaehlen(isoTag, wunschZeit) {
    zustand.datum = isoTag;
    var d = ausIso(isoTag);
    zustand.monat = new Date(d.getFullYear(), d.getMonth(), 1);
    var frei = freieZeiten(d);
    var hinweis = '';
    if (wunschZeit && frei.indexOf(wunschZeit) !== -1) zustand.zeit = wunschZeit;
    else if (wunschZeit) { zustand.zeit = null; hinweis = 'Um ' + wunschZeit + ' Uhr ist es an diesem Tag voll. Bitte wählen Sie eine andere Zeit.'; }
    else if (zustand.zeit && frei.indexOf(zustand.zeit) === -1) zustand.zeit = null;
    kalenderZeichnen();
    zeitenZeichnen(hinweis);
    belegAktualisieren();
  }

  function zeitenZeichnen(hinweis) {
    zeitenBox.innerHTML = '';
    if (!zustand.datum) {
      zeitenHilfe.textContent = 'Wählen Sie zuerst einen Tag im Kalender.';
      return;
    }
    var d = ausIso(zustand.datum);
    zeitenHilfe.textContent = hinweis || ('Freie Zeiten am ' + langDatum(d) + (d.getDay() === 0 ? ', Mittag am Feuer.' : '.'));
    zeitenFuer(d).forEach(function (z) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zeit-k';
      b.textContent = z;
      var weg = ausgebucht(d, z) || vorbei(d, z);
      b.disabled = weg;
      b.setAttribute('aria-label', z + ' Uhr' + (weg ? ', nicht mehr frei' : ''));
      b.setAttribute('aria-pressed', String(zustand.zeit === z));
      b.setAttribute('data-zeit', z);
      zeitenBox.appendChild(b);
    });
  }
  zeitenBox.addEventListener('click', function (e) {
    var b = e.target.closest('.zeit-k');
    if (!b || b.disabled) return;
    zustand.zeit = b.getAttribute('data-zeit');
    $$('.zeit-k', zeitenBox).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    var d = ausIso(zustand.datum);
    zeitenHilfe.textContent = 'Freie Zeiten am ' + langDatum(d) + (d.getDay() === 0 ? ', Mittag am Feuer.' : '.');
    fehlerAllg.textContent = '';
    belegAktualisieren();
  });

  function personenSetzen(n) {
    zustand.personen = Math.max(1, Math.min(8, n));
    pWert.textContent = String(zustand.personen);
    pText.textContent = zustand.personen === 1 ? 'Person' : (zustand.personen === 8 ? 'Personen, für mehr schreiben Sie uns einen Wunsch' : 'Personen');
    pMinus.disabled = zustand.personen <= 1;
    pPlus.disabled = zustand.personen >= 8;
    belegAktualisieren();
  }
  pMinus.addEventListener('click', function () { personenSetzen(zustand.personen - 1); });
  pPlus.addEventListener('click', function () { personenSetzen(zustand.personen + 1); });

  // Neu: Tisch aus der Wahl im Film, änderbar über die Auswahl
  tischWahl.addEventListener('change', function () { wahl.setzen(tischWahl.value || null, 'formular'); });
  wahl.hoerer.push(function (n) {
    zustand.tisch = n ? String(n) : null;
    tischWahl.value = zustand.tisch || '';
    belegAktualisieren();
  });

  function belegAktualisieren() {
    var tag = $('[data-beleg-tag]'), zeit = $('[data-beleg-zeit]'), pers = $('[data-beleg-personen]'), tisch = $('[data-beleg-tisch]');
    tag.textContent = zustand.datum ? langDatum(ausIso(zustand.datum)) : 'noch offen';
    tag.classList.toggle('ist-offen', !zustand.datum);
    zeit.textContent = zustand.zeit ? zustand.zeit + ' Uhr' : 'noch offen';
    zeit.classList.toggle('ist-offen', !zustand.zeit);
    pers.textContent = personenText(zustand.personen);
    tisch.textContent = tischText(zustand.tisch);
    tisch.classList.toggle('ist-offen', !zustand.tisch);
  }

  function fehler(id, text) {
    var feld = document.getElementById(id);
    var ziel = $('[data-fehler-fuer="' + id + '"]');
    ziel.textContent = text || '';
    if (text) feld.setAttribute('aria-invalid', 'true'); else feld.removeAttribute('aria-invalid');
    return !text;
  }
  ['res-name', 'res-telefon'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () { fehler(id, ''); });
  });

  function lesen() { try { return JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch (e) { return null; } }
  function schreiben(o) { try { localStorage.setItem(SPEICHER, JSON.stringify(o)); return true; } catch (e) { return false; } }
  function loeschen() { try { localStorage.removeItem(SPEICHER); } catch (e) { /* privat */ } }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#res-name').value.trim();
    var tel = $('#res-telefon').value.trim();
    var wunsch = $('#res-wunsch').value.trim();
    var ok = true, erstesFeld = null;
    fehlerAllg.textContent = '';
    if (!zustand.datum || !zustand.zeit) {
      fehlerAllg.textContent = !zustand.datum ? 'Bitte wählen Sie zuerst einen Tag im Kalender.' : 'Bitte wählen Sie eine Uhrzeit.';
      ok = false;
    }
    if (name.length < 2) { fehler('res-name', 'Bitte geben Sie Ihren Namen an.'); ok = false; erstesFeld = erstesFeld || 'res-name'; } else fehler('res-name', '');
    var ziffern = tel.replace(/\D/g, '');
    if (!tel) { fehler('res-telefon', 'Bitte geben Sie eine Telefonnummer an, unter der wir Sie erreichen.'); ok = false; erstesFeld = erstesFeld || 'res-telefon'; }
    else if (ziffern.length < 9 || /[^\d\s+()\/.-]/.test(tel)) { fehler('res-telefon', 'Diese Nummer sieht unvollständig aus. Bitte mit Vorwahl, im Format 044 000 00 00.'); ok = false; erstesFeld = erstesFeld || 'res-telefon'; }
    else fehler('res-telefon', '');
    if (!ok) {
      if (!zustand.datum || !zustand.zeit) { scrolleZu(zustand.datum ? zeitenBox : $('[data-kal]'), -110); }
      else if (erstesFeld) document.getElementById(erstesFeld).focus();
      return;
    }
    var zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', nummer = 'FU-';
    for (var i = 0; i < 5; i++) nummer += zeichen[Math.floor(Math.random() * zeichen.length)];
    var res = { datum: zustand.datum, zeit: zustand.zeit, personen: zustand.personen, tisch: zustand.tisch, name: name, telefon: tel, wunsch: wunsch, nummer: nummer, angelegt: new Date().toISOString(), demo: true };
    schreiben(res);
    sendenKnopf.disabled = true;
    funkenregen(sendenKnopf, form, function () { sendenKnopf.disabled = false; bestaetigungZeigen(res); });
  });

  function bestaetigungZeigen(res) {
    $('[data-best-name]').textContent = res.name;
    $('[data-best-tag]').textContent = langDatum(ausIso(res.datum));
    $('[data-best-zeit]').textContent = res.zeit + ' Uhr';
    $('[data-best-personen]').textContent = personenText(res.personen);
    $('[data-best-tisch]').textContent = tischText(res.tisch);
    $('[data-best-telefon]').textContent = res.telefon;
    $('[data-best-wunsch]').textContent = res.wunsch;
    $('[data-best-wunsch-zeile]').hidden = !res.wunsch;
    $('[data-best-nummer]').textContent = res.nummer + ' (Demo)';
    form.hidden = true;
    best.hidden = false;
    springeZu(best, 130);
    best.focus({ preventScroll: true });
  }
  function springeZu(el, abstand) {
    var y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - abstand);
    window.scrollTo(0, y);
  }

  $('[data-res-neu]').addEventListener('click', function () {
    best.hidden = true;
    form.hidden = false;
    zustand.zeit = null;
    if (zustand.datum) zeitenZeichnen();
    belegAktualisieren();
    springeZu($('[data-kal]'), 140);
    var erste = $('.kal__tag[aria-pressed="true"]') || $('.kal__tag:not([disabled])');
    if (erste) erste.focus({ preventScroll: true });
  });
  $('[data-res-loeschen]').addEventListener('click', function () {
    loeschen();
    $('#res-name').value = '';
    $('#res-telefon').value = '';
    $('#res-wunsch').value = '';
    best.hidden = true;
    form.hidden = false;
    zustand.zeit = null;
    zeitenZeichnen();
    belegAktualisieren();
    fehlerAllg.textContent = '';
    springeZu($('.res__angaben'), 140);
    $('#res-name').focus({ preventScroll: true });
  });

  /* Start: frühester freier Tag vorgewählt, gespeicherte Angaben zurück */
  var alt = lesen();
  if (alt) {
    if (alt.name) $('#res-name').value = alt.name;
    if (alt.telefon) $('#res-telefon').value = alt.telefon;
  }
  var tage = offeneTage(24);
  if (tage.length) tagWaehlen(iso(tage[0])); else { kalenderZeichnen(); zeitenZeichnen(); }
  personenSetzen(2);
})();


/* Bestätigung mit Funkenregen: 140 Funken aus dem Knopf über den ganzen Bildschirm, 1.8 s */
function funkenregen(knopf, rahmen, fertig) {
  if (ruhig) {
    rahmen.classList.add('leuchtet');
    setTimeout(() => { rahmen.classList.remove('leuchtet'); fertig(); }, 650);
    return;
  }
  const c = $('#funkenregen');
  const pr = Math.min(devicePixelRatio || 1, 1.5);
  c.width = Math.round(innerWidth * pr); c.height = Math.round(innerHeight * pr);
  const x = c.getContext('2d');
  const kr = knopf.getBoundingClientRect();
  const ox = kr.left + kr.width / 2, oy = kr.top + kr.height / 2;
  const F = [];
  for (let i = 0; i < 140; i++) {
    const w = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const v = 420 + Math.random() * 900;
    F.push({ x: ox + (Math.random() - 0.5) * kr.width * 0.8, y: oy, vx: Math.cos(w) * v * 0.75, vy: Math.sin(w) * v, r: 1.2 + Math.random() * 2.2, farbe: Math.random() < 0.55 ? '247,178,74' : '226,85,43', ph: Math.random() * 6 });
  }
  const start = performance.now();
  let zuletzt = start;
  function schritt(jetzt) {
    const dt = Math.min(0.05, (jetzt - zuletzt) / 1000); zuletzt = jetzt;
    const t = (jetzt - start) / 1000;
    x.setTransform(pr, 0, 0, pr, 0, 0);
    x.clearRect(0, 0, innerWidth, innerHeight);
    x.globalCompositeOperation = 'lighter';
    for (const f of F) {
      f.vy -= 60 * dt;            // Schwerkraft leicht negativ: die Funken steigen weiter
      f.vx *= 1 - 0.9 * dt; f.vy *= 1 - 0.6 * dt;
      f.x += (f.vx + Math.sin(t * 6 + f.ph) * 30) * dt; f.y += f.vy * dt;
      const a = clamp(1 - t / 1.8) * (0.6 + 0.4 * Math.sin(t * 25 + f.ph));
      x.strokeStyle = `rgba(${f.farbe},${a.toFixed(3)})`;
      x.lineWidth = f.r; x.lineCap = 'round';
      x.beginPath(); x.moveTo(f.x, f.y); x.lineTo(f.x - f.vx * 0.025, f.y - f.vy * 0.025); x.stroke();
    }
    if (t < 1.8) requestAnimationFrame(schritt);
    else { x.clearRect(0, 0, innerWidth, innerHeight); c.width = 1; c.height = 1; fertig(); }
  }
  requestAnimationFrame(schritt);
}

/* ================= Der Film ================= */
const uhrKeys = [[0, 17 * 60], [.10, 17 * 60 + 20], [.30, 18 * 60], [.36, 18 * 60 + 15], [.49, 18 * 60 + 45], [.52, 19 * 60 + 15], [.68, 20 * 60 + 30], [.80, 21 * 60 + 30], [.88, 21 * 60 + 45], [.965, 24 * 60], [1, 24 * 60]];
const sitzKeys = [[0, 0], [.30, 0], [.36, 6], [.52, 18], [.68, 30], [.80, 34], [.88, 31], [.965, 4], [1, 0]];
const interp = (keys, p) => { let i = 0; while (i < keys.length - 2 && p > keys[i + 1][0]) i++; return lerp(keys[i][1], keys[i + 1][1], clamp((p - keys[i][0]) / (keys[i + 1][0] - keys[i][0]))); };
const KAPITEL = [[.10, '17.20', 'Holz'], [.30, '18.00', 'Tür'], [.36, '18.15', 'Feuer'], [.49, '18.45', 'Glut'], [.52, '19.15', 'Pfanne'], [.68, '20.30', 'Karte'], [.80, '21.30', 'Tisch'], [.88, '21.45', 'Ihr Abend'], [.965, '24.00', 'Ende']];
const SCHNITTE = [
  [.16, .27, 'video-holz-feuer', 'iris', 'rauch'],
  [.40, .48, 'video-glut', 'schwarz', 'iris'],
  [.54, .64, 'video', 'rauch', 'schwarz'],
];
const SAETZE = ['Noch ein Stück Brot, bitte.', 'Riecht man den Rauch? Ja. Gut so.', 'Wir teilen alles.', 'Der Lauch ist der beste Teil.', 'Noch eine halbe Stunde, dann der Apfel.', 'Hier bleibe ich bis zum Schluss.', 'Hören Sie, wie es knistert?', 'Wir nehmen noch einmal die Randen.', 'Die Kruste ist das Beste daran.', 'Bringen Sie es einfach in die Mitte.', 'So warm war mir lange nicht.', 'Wir kommen wieder, wenn es kalt wird.'];

const pFilm = () => clamp(-film.getBoundingClientRect().top / Math.max(1, film.offsetHeight - buehne.clientHeight));
function zuP(at) { scrollTo({ top: film.offsetTop + at * (film.offsetHeight - buehne.clientHeight), behavior: ruhig ? 'auto' : 'smooth' }); }

// Zeitleiste: Kapitelmarken (auch ohne 3D bedienbar)
const spur = $('#spur');
const marken = KAPITEL.map(([at, uhr, name], i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'marke' + (i % 2 ? ' unten' : '');
  b.style.left = (at * 100) + '%';
  b.innerHTML = `<span>${uhr} ${name}</span>`;
  b.setAttribute('aria-label', `Zu ${uhr} Uhr springen: ${name}`);
  b.addEventListener('click', () => zuP(at));
  spur.appendChild(b);
  return { b, at };
});

if (!html.classList.contains('no-webgl')) {
  try { starteFilm(); } catch (e) {
    html.classList.add('no-webgl');
    console.warn('3D-Film nicht verfügbar, Rückfall ohne WebGL', e);
  }
}

function starteFilm() {
  const canvas = $('#welt');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const handy = Math.min(innerWidth, innerHeight) < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, handy ? 1.5 : 1.75));
  renderer.setClearColor('#141110', 1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 900);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const M = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(...s));

  function bake(geo, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (m) g.applyMatrix4(m);
    return g;
  }
  // eigene kleine Zusammenführung (BufferGeometryUtils gibt es im Projekt nicht)
  function merge(liste) {
    let n = 0; for (const g of liste) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of liste) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += c;
    }
    const r = new THREE.BufferGeometry();
    r.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    r.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return r;
  }
  function limb(a, b, r, seg = 8, cap = 3) {
    const A = V(...a), B = V(...b), d = B.clone().sub(A), len = Math.max(0.01, d.length());
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
    return bake(new THREE.CapsuleGeometry(r, len, cap, seg), new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, V(1, 1, 1)));
  }
  const ball = (r, p, s = [1, 1, 1], rot = [0, 0, 0]) => bake(new THREE.SphereGeometry(r, 14, 10), M(p, rot, s));

  /* ---------- Zwei-Ton-Material (Tableau E4, mit warmem Licht vom Feuer) ---------- */
  const G = { uGrain: { value: 0.12 }, uT1: { value: 0.42 }, uT2: { value: 0.19 } };
  const PAL = {
    putz: ['#D9C4A6', '#3B2A22', '#1E1511'],
    ziegel: ['#C98A63', '#55291D', '#2A140E'],
    holz: ['#C8955F', '#4E3220', '#27180F'],
    buche: ['#E0B788', '#6A4428', '#33200F'],
    eisen: ['#7A716B', '#2A2624', '#141211'],
    leinen: ['#EDE7DF', '#4A3A32', '#241B17'],
    stein: ['#BDB3A8', '#3E3733', '#1F1B19'],
    blatt: ['#9DAE86', '#34402C', '#1B2217'],
    glas: ['#B9C7C9', '#40504F', '#202827'],
    haut: ['#E3B894', '#7A4A33', '#3E2419'],
    haar: ['#5A3A2A', '#2A1A12', '#150D09'],
    kleid: ['#6B4E8A', '#2D2140', '#171021'],
    schuerze: ['#2B2522', '#141110', '#0A0807'],
  };
  function toon(p, o = {}) {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: o.flat ?? true, side: o.side ?? THREE.FrontSide, map: o.map || null });
    const u = { uLit: { value: new THREE.Color(p[0]) }, uShadow: { value: new THREE.Color(p[1]) }, uDeep: { value: new THREE.Color(p[2]) } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u, G);
      // Fugen erst nach der Stufung aufmultiplizieren: gefiltert statt hart gestuft, sonst Treppen und Moiré
      if (o.fuge) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', 'vec4 tbFuge = texture2D( map, vMapUv );');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform vec3 uLit; uniform vec3 uShadow; uniform vec3 uDeep; uniform float uGrain; uniform float uT1; uniform float uT2;
float tbHash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }`)
        .replace('#include <opaque_fragment>', `
float tbL = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
// Stippelzone höchstens rund zehn Bildpunkte breit: an Kanten körnig, flache Lichtverläufe bleiben ruhig
float tbN = (tbHash(floor(gl_FragCoord.xy)) - 0.5) * min(uGrain, fwidth(tbL) * 10.0);
float tbA = step(uT1 + tbN, tbL);
float tbB = step(uT2 + tbN * 0.6, tbL);
float tbW = clamp((outgoingLight.r - outgoingLight.b) / max(tbL, 0.001) * 0.45, 0.0, 1.0);
vec3 tbLit = mix(uLit, uLit * vec3(1.07, 0.84, 0.64), tbW);
vec3 tbSh = mix(uShadow, uShadow * vec3(1.18, 0.9, 0.76), tbW * 0.7);
gl_FragColor = vec4(mix(mix(uDeep, tbSh, tbB), tbLit, tbA), diffuseColor.a);${o.fuge ? `
gl_FragColor.rgb *= mix(vec3(1.0), tbFuge.rgb, 0.5);` : ''}`);
    };
    return m;
  }
  const mats = {};
  for (const k in PAL) mats[k] = toon(PAL[k]);
  const pm = {};
  const weich = (k) => pm[k] || (pm[k] = toon(PAL[k], { flat: false }));
  // alles über dem Gastraum: in der Draufsicht unsichtbar, wirft aber weiter Schatten
  const ghost = { ziegel: toon(PAL.ziegel), holz: toon(PAL.holz), eisen: toon(PAL.eisen, { side: THREE.DoubleSide }), putz: toon(PAL.putz) };
  const ghostListe = Object.values(ghost);
  const eisenD = toon(PAL.eisen, { side: THREE.DoubleSide }), holzD = toon(PAL.holz, { side: THREE.DoubleSide }), schuerzeD = toon(PAL.schuerze, { flat: false, side: THREE.DoubleSide });

  function mesh(geo, mat, parent, cast = true) { const o = new THREE.Mesh(geo, mat); o.castShadow = cast; o.receiveShadow = true; if (parent) parent.add(o); return o; }
  function box(x0, y0, z0, x1, y1, z1, mat, parent, cast = true) {
    const o = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat, parent, cast);
    o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return o;
  }
  function instanced(geo, mat, liste, parent, cast = true) {
    const im = new THREE.InstancedMesh(geo, mat, liste.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
    liste.forEach((o, i) => {
      e.set(o.rx || 0, o.ry || 0, o.rz || 0); q.setFromEuler(e);
      s.set(o.sx || o.s || 1, o.sy || o.s || 1, o.sz || o.s || 1);
      m.compose(V(o.x, o.y || 0, o.z), q, s); im.setMatrixAt(i, m);
    });
    im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false;
    im.instanceMatrix.needsUpdate = true;
    parent.add(im);
    return im;
  }
  function canvasTextur(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return { c, x: c.getContext('2d'), t };
  }

  /* ---------- Licht ---------- */
  const sonne = new THREE.DirectionalLight(0xffffff, Math.PI * 1.7);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(handy ? 1024 : 2048, handy ? 1024 : 2048);
  Object.assign(sonne.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 170 });
  sonne.shadow.bias = -0.0005; sonne.shadow.normalBias = 0.03;
  sonne.shadow.autoUpdate = false;
  sonne.target.position.set(0, 0, 3);
  scene.add(sonne, sonne.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x554a44, Math.PI * 0.24);
  scene.add(hemi);
  const FEUER_FARBE = new THREE.Color('#FFB070');
  const feuerA = new THREE.PointLight(FEUER_FARBE, 0, 9, 2);
  feuerA.position.set(-0.9, 1.35, -4.5);
  feuerA.castShadow = true;
  feuerA.shadow.mapSize.set(handy ? 256 : 512, handy ? 256 : 512);
  feuerA.shadow.camera.near = 0.15; feuerA.shadow.camera.far = 9;
  feuerA.shadow.bias = -0.004; feuerA.shadow.normalBias = 0.03;
  feuerA.shadow.autoUpdate = false;
  const feuerB = new THREE.PointLight(FEUER_FARBE, 0, 9, 2);
  feuerB.position.set(1.0, 1.35, -4.5);
  scene.add(feuerA, feuerB);
  const lampen = [];
  function lampe(x, y, z, gruppe, farbe = '#FFD7A0', weite = 7) { const l = new THREE.PointLight(farbe, 0, weite, 2); l.position.set(x, y, z); scene.add(l); lampen.push({ l, gruppe }); return l; }

  /* ---------- Welt ---------- */
  const welt = new THREE.Group(); scene.add(welt);
  const HIT = 3; // Ebene für unsichtbare Trefferkörper

  // Pflaster mit Fugen, Dielen mit Fugen (Tiefschatten-Ton über dunkle Linien in der Textur)
  function fugenTextur(art) {
    const { c, x, t } = canvasTextur(256, 256);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#000000'; x.lineWidth = 5;
    if (art === 'pflaster') {
      for (let r = 0; r < 4; r++) {
        x.beginPath(); x.moveTo(0, r * 64); x.lineTo(256, r * 64); x.stroke();
        for (let k = 0; k < 5; k++) { const xx = k * 64 + (r % 2) * 32; x.beginPath(); x.moveTo(xx, r * 64); x.lineTo(xx, r * 64 + 64); x.stroke(); }
      }
    } else {
      x.lineWidth = 4;
      for (let r = 0; r < 8; r++) {
        x.beginPath(); x.moveTo(0, r * 32); x.lineTo(256, r * 32); x.stroke();
        const s = (r * 97) % 256; x.beginPath(); x.moveTo(s, r * 32); x.lineTo(s, r * 32 + 32); x.stroke();
      }
    }
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return { c, t };
  }
  const pfl = fugenTextur('pflaster'); pfl.t.repeat.set(30 / 1.6, 16 / 1.6);
  const die = fugenTextur('dielen'); die.t.repeat.set(17.4 / 1.6, 11.3 / 1.6);
  pfl.t.anisotropy = die.t.anisotropy = 8;
  const pflasterMat = toon(PAL.stein, { map: pfl.t, fuge: true });
  const dielenMat = toon(PAL.holz, { map: die.t, fuge: true });

  box(-60, -0.3, -40, 60, -0.02, 60, mats.stein, welt, false);
  { const g = new THREE.PlaneGeometry(30, 16); g.rotateX(-Math.PI / 2); const o = mesh(g, pflasterMat, welt, false); o.position.set(0, 0, 10); }
  { const g = new THREE.PlaneGeometry(17.4, 11.32); g.rotateX(-Math.PI / 2); const o = mesh(g, dielenMat, welt, false); o.position.set(0, 0.01, -4.04); }

  // Hofmauern und Nachbarhäuser
  box(-15.4, 0, 2, -15, 4.4, 18, mats.putz, welt);
  box(15, 0, 2, 15.4, 4.4, 18, mats.putz, welt);
  box(-16, 0, -14, -9.2, 8.2, 2, mats.putz, welt);
  box(9.2, 0, -14, 16, 7.6, 2, mats.putz, welt);
  const nachbarFenster = [];
  const fensterNachtMat = new THREE.MeshBasicMaterial({ color: '#3A3F3E' });
  for (const [x, y] of [[-14, 2.2], [-11.6, 2.2], [-14, 5.2], [-11.6, 5.2], [10.6, 2.2], [13.6, 2.2], [10.6, 5.0], [13.6, 5.0]]) {
    const lit = R() < 0.6;
    const o = box(x - 0.55, y, 2.0, x + 0.55, y + 1.6, 2.04, lit ? fensterNachtMat : mats.glas, welt, false);
    nachbarFenster.push(o);
  }

  // Werkhof: Fassade mit Tor und vier Sprossenfenstern
  const OEFF = [[-7.3, -5.9, 'f'], [-4.3, -2.9, 'f'], [-2.0, 2.0, 't'], [2.9, 4.3, 'f'], [5.9, 7.3, 'f']];
  function fassade(mat, z0, z1, sockel) {
    let xp = -9;
    for (const [a, b, art] of OEFF) {
      box(xp, 0, z0, a, 6.4, z1, mat, welt);
      if (art === 'f') { box(a, 0, z0, b, 1.0, z1, mat, welt); box(a, 3.6, z0, b, 6.4, z1, mat, welt); }
      else box(a, 4.2, z0, b, 6.4, z1, mat, welt);
      xp = b;
    }
    box(xp, 0, z0, 9, 6.4, z1, mat, welt);
    if (sockel) {
      xp = -9;
      for (const [a, b, art] of OEFF) { box(xp, 0, z1, a, 0.6, z1 + 0.08, mats.stein, welt); if (art === 'f') box(a - 0.08, 0.92, z1, b + 0.08, 1.0, z1 + 0.16, mats.stein, welt); xp = b; }
      box(xp, 0, z1, 9, 0.6, z1 + 0.08, mats.stein, welt);
    }
  }
  fassade(mats.ziegel, 1.75, 2.0, true);
  fassade(mats.putz, 1.62, 1.75, false);
  // Fenster (nachts emissiv)
  const glasTag = new THREE.Color('#4E5F5F'), glasNacht = new THREE.Color('#F4C27A');
  const fensterMat = new THREE.MeshBasicMaterial({ color: glasTag.clone(), side: THREE.DoubleSide });
  for (const [a, b, art] of OEFF) {
    if (art !== 'f') continue;
    const g = new THREE.PlaneGeometry(b - a, 2.6); const o = mesh(g, fensterMat, welt, false); o.position.set((a + b) / 2, 2.3, 1.82);
    box((a + b) / 2 - 0.03, 1.0, 1.84, (a + b) / 2 + 0.03, 3.6, 1.92, mats.eisen, welt, false);
    for (const y of [1.65, 2.3, 2.95]) box(a, y - 0.025, 1.84, b, y + 0.025, 1.92, mats.eisen, welt, false);
  }
  // Seiten- und Rückwand: aussen Backstein, innen Putz
  box(-9, 0, -10, -8.85, 6.4, 1.62, mats.ziegel, welt);
  box(-8.85, 0, -9.85, -8.7, 6.4, 1.62, mats.putz, welt);
  box(8.85, 0, -10, 9, 6.4, 1.62, mats.ziegel, welt);
  box(8.7, 0, -9.85, 8.85, 6.4, 1.62, mats.putz, welt);
  box(-9, 0, -10, 9, 6.4, -9.85, mats.ziegel, welt);
  box(-8.7, 0, -9.85, 8.7, 6.4, -9.7, mats.putz, welt);
  // Tor: beide Flügel nach innen offen, um 100 Grad an die Innenwand gedreht
  for (const s of [-1, 1]) {
    const scharnier = new THREE.Group(); scharnier.position.set(2.0 * s, 0, 1.6); scharnier.rotation.y = THREE.MathUtils.degToRad(100) * -s; welt.add(scharnier);
    const fl = new THREE.Group(); fl.position.x = -1.0 * s; scharnier.add(fl);
    box(-0.98, 0.05, -0.04, 0.98, 4.1, 0.04, mats.holz, fl);
    for (const y of [0.5, 2.1, 3.7]) box(-0.98, y - 0.08, 0.04, 0.98, y + 0.08, 0.1, mats.holz, fl);
    const st = mesh(new THREE.BoxGeometry(0.14, 2.1, 0.05), mats.holz, fl); st.position.set(0, 1.3, 0.08); st.rotation.z = 0.72 * s;
    const st2 = mesh(new THREE.BoxGeometry(0.14, 2.1, 0.05), mats.holz, fl); st2.position.set(0, 2.9, 0.08); st2.rotation.z = 0.72 * s;
  }
  box(-2.15, 4.15, 1.6, 2.15, 4.35, 2.1, mats.holz, welt);
  // Dach (ghost): Satteldach, First in x-Richtung bei y 8.6
  {
    const neig = Math.atan2(2.2, 6.3), len = Math.hypot(6.3, 2.2) + 0.5;
    const v = mesh(new THREE.BoxGeometry(18.8, 0.16, len), ghost.ziegel, welt); v.position.set(0, 7.5, -0.85); v.rotation.x = neig;
    const h = mesh(new THREE.BoxGeometry(18.8, 0.16, len), ghost.ziegel, welt); h.position.set(0, 7.5, -7.15); h.rotation.x = -neig;
    const giebel = new THREE.Shape(); giebel.moveTo(2.0, 6.4); giebel.lineTo(-10, 6.4); giebel.lineTo(-4, 8.6); giebel.lineTo(2.0, 6.4);
    for (const x of [-8.75, 9]) {
      const g = new THREE.ExtrudeGeometry(giebel, { depth: 0.25, bevelEnabled: false });
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
      g.translate(x, 0, 0);
      mesh(g, ghost.ziegel, welt);
    }
    for (let x = -7.5; x <= 7.6; x += 2.5) box(x - 0.12, 6.0, -9.7, x + 0.12, 6.3, 1.62, ghost.holz, welt);
    box(-8.7, 6.25, -4.1, 8.7, 6.45, -3.9, ghost.holz, welt);
  }
  // Kamin (ghost), aus dem der Rauch steigt
  box(-0.55, 4.0, -5.05, 0.55, 11, -3.95, ghost.ziegel, welt);
  box(-0.68, 10.8, -5.18, 0.68, 11.05, -3.82, ghost.ziegel, welt);

  // Schild über dem Tor
  const schild = canvasTextur(1024, 256);
  const schildMat = new THREE.MeshBasicMaterial({ map: schild.t, transparent: true });
  box(-1.75, 4.45, 2.0, 1.75, 5.35, 2.09, mats.holz, welt);
  { const o = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), schildMat); o.position.set(0, 4.9, 2.1); welt.add(o); }

  // Laterne rechts neben dem Tor
  const laterneGlas = new THREE.MeshBasicMaterial({ color: '#5A4A3A' });
  box(2.45, 3.3, 2.0, 2.55, 3.4, 2.5, mats.eisen, welt, false);
  box(2.32, 2.85, 2.38, 2.68, 3.3, 2.74, mats.eisen, welt, false);
  box(2.36, 2.9, 2.42, 2.64, 3.25, 2.70, laterneGlas, welt, false);
  lampe(2.5, 2.95, 2.95, 'laterne', '#FFC27A', 9);

  // Velo an der Wand links
  {
    const velo = new THREE.Group(); velo.position.set(-5.1, 0, 2.32); welt.add(velo);
    for (const x of [-0.52, 0.52]) { const r = mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 22), mats.eisen, velo); r.position.set(x, 0.34, 0); }
    mesh(merge([limb([-0.52, 0.34, 0], [-0.05, 0.36, 0], 0.022, 5, 1), limb([-0.05, 0.36, 0], [0.3, 0.8, 0], 0.022, 5, 1), limb([-0.52, 0.34, 0], [-0.2, 0.8, 0], 0.022, 5, 1), limb([-0.2, 0.8, 0], [0.3, 0.8, 0], 0.022, 5, 1), limb([0.3, 0.8, 0], [0.52, 0.34, 0], 0.022, 5, 1), limb([-0.05, 0.36, 0], [-0.2, 0.8, 0], 0.022, 5, 1), limb([0.36, 0.8, 0], [0.42, 1.0, 0], 0.02, 5, 1), limb([0.42, 1.0, -0.22], [0.42, 1.0, 0.22], 0.018, 5, 1), limb([-0.22, 0.85, -0.06], [-0.22, 0.85, 0.06], 0.05, 6, 1)]), mats.eisen, velo);
  }

  // Platanen
  const kronen = [];
  function platane(x, z, s) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); welt.add(g);
    mesh(merge([limb([0, 0, 0], [0.1, 3.4, 0], 0.24, 8, 1), limb([0.1, 3.2, 0], [0.9, 4.6, 0.3], 0.13, 7, 1), limb([0.1, 3.3, 0], [-0.8, 4.4, -0.2], 0.12, 7, 1)]), mats.holz, g);
    for (const [dx, dy, dz, r] of [[0, 5.2, 0, 1.9], [1.3, 4.8, 0.5, 1.4], [-1.2, 4.7, -0.3, 1.5], [0.2, 6.2, -0.4, 1.3]]) {
      const k = mesh(new THREE.IcosahedronGeometry(r, 1), mats.blatt, g); k.position.set(dx, dy, dz); kronen.push(k);
    }
    return g;
  }
  platane(-11.6, 9.8, 1);
  platane(11.2, 12.8, 1.08);

  // Lichterkette von der Laterne zur Platane (20 Kugeln)
  const birnenMat = new THREE.MeshBasicMaterial({ color: '#5A4A3A' });
  {
    const A = V(2.5, 3.45, 2.3), B = V(10.6, 4.6, 12.6), pts = [], kette = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; const p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * 0.9; pts.push(p); }
    for (let i = 0; i < 20; i++) { const t = (i + 0.5) / 20; const p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * 0.9 + 0.07; kette.push({ x: p.x, y: p.y, z: p.z }); }
    welt.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2A2624' })));
    instanced(new THREE.SphereGeometry(0.06, 8, 6), birnenMat, kette, welt, false);
    lampe(6.5, 3.4, 7.4, 'kette', '#FFD9A0', 8);
  }

  /* ---------- Figuren (einfache Körper, ohne Gesichter) ---------- */
  const figuren = [];
  const hautM = () => weich('haut');
  function haarGeo(stil, hy) {
    const halb = (r, p, s) => bake(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), M(p, [-0.18, 0, 0], s));
    if (stil === 0) return halb(0.108, [0, hy + 0.12, -0.012], [1.04, 1.05, 1.06]);
    if (stil === 1) return merge([halb(0.108, [0, hy + 0.12, -0.012], [1.04, 1.05, 1.06]), ball(0.055, [0, hy + 0.23, -0.09])]);
    if (stil === 2) return merge([halb(0.11, [0, hy + 0.12, -0.02], [1.06, 1.08, 1.08]), ball(0.105, [0, hy + 0.03, -0.065], [1.06, 1.45, 0.6])]);
    return halb(0.106, [0, hy + 0.14, 0], [1.03, 0.85, 1.03]);
  }
  function figur(o) {
    const g = new THREE.Group();
    const sitz = !!o.sitzend;
    const ober = weich(o.ober), hose = weich(o.hose);
    const hoseT = [], oberT = [], hautT = [];
    for (const s of [-1, 1]) {
      if (sitz) {
        hoseT.push(limb([s * 0.1, 0.5, -0.02], [s * 0.1, 0.5, 0.34], 0.074));
        hoseT.push(limb([s * 0.1, 0.5, 0.36], [s * 0.11, 0.09, 0.4], 0.057));
        hoseT.push(limb([s * 0.11, 0.05, 0.38], [s * 0.115, 0.045, 0.5], 0.045));
      } else {
        hoseT.push(limb([s * 0.1, 0.9, 0], [s * 0.1, 0.09, 0], 0.07));
        hoseT.push(limb([s * 0.1, 0.05, -0.02], [s * 0.1, 0.05, 0.13], 0.045));
      }
    }
    const ty = sitz ? 0.84 : 1.24, sy = ty + 0.17, hy = ty + 0.3;
    oberT.push(bake(new THREE.CapsuleGeometry(0.155, 0.3, 4, 14), M([0, ty, -0.02], [sitz ? 0.08 : 0, 0, 0], [1.18, 1, 0.78])));
    if (sitz) {
      oberT.push(limb([-0.2, sy, -0.02], [-0.23, sy - 0.18, 0.1], 0.051)); oberT.push(limb([-0.23, sy - 0.18, 0.1], [-0.16, sy - 0.21, 0.32], 0.044));
      hautT.push(limb([-0.155, sy - 0.215, 0.34], [-0.13, sy - 0.225, 0.42], 0.03));
    } else {
      oberT.push(limb([-0.21, sy, 0], [-0.25, sy - 0.31, 0.03], 0.051)); oberT.push(limb([-0.25, sy - 0.31, 0.03], [-0.22, sy - 0.55, 0.12], 0.044));
      hautT.push(limb([-0.22, sy - 0.56, 0.13], [-0.21, sy - 0.64, 0.16], 0.03));
    }
    hautT.push(bake(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 10), M([0, hy - 0.02, 0])));
    mesh(merge(hoseT), hose, g);
    mesh(merge(oberT), ober, g);
    mesh(merge(hautT), hautM(), g);
    if (o.schuerze) { const s = mesh(new THREE.CylinderGeometry(0.19, 0.26, 0.66, 18, 1, true, -1.3, 2.6), schuerzeD, g); s.position.set(0, 0.74, 0.03); }
    const kopf = new THREE.Group(); kopf.position.set(0, hy, 0); g.add(kopf);
    mesh(ball(0.1, [0, 0.12, 0.01], [1, 1.12, 1.04]), hautM(), kopf);
    mesh(haarGeo(o.stil, 0), weich(o.haar || 'haar'), kopf);
    const arm = new THREE.Group(); arm.position.set(0.2, sy, -0.02); g.add(arm);
    if (sitz) {
      mesh(merge([limb([0, 0, 0], [0.03, -0.18, 0.12], 0.051), limb([0.03, -0.18, 0.12], [-0.04, -0.21, 0.35], 0.044)]), ober, arm);
      mesh(limb([-0.045, -0.215, 0.37], [-0.06, -0.205, 0.45], 0.03), hautM(), arm);
    } else {
      mesh(merge([limb([0, 0, 0], [0.05, -0.28, 0.1], 0.051), limb([0.05, -0.28, 0.1], [0.04, -0.38, 0.36], 0.044)]), ober, arm);
      mesh(limb([0.04, -0.385, 0.38], [0.04, -0.39, 0.46], 0.03), hautM(), arm);
    }
    if (o.glas) { const gl = mesh(weinGeo, mats.glas, arm); gl.position.set(-0.065, -0.27, 0.43); }
    g.scale.setScalar(o.groesse || lerp(0.95, 1.06, R()));
    g.userData = { kopf, arm, ph: R() * 6.28, figur: true };
    g.traverse((m) => { if (m.isMesh) m.userData.figur = g; });
    figuren.push(g);
    return g;
  }
  const weinGeo = new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.035, 0.006], [0.006, 0.012], [0.006, 0.09], [0.03, 0.11], [0.038, 0.15], [0.034, 0.19], [0, 0.19]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
  const OBER = ['leinen', 'leinen', 'putz', 'eisen', 'holz', 'kleid', 'glas', 'leinen', 'blatt', 'ziegel'];
  const HOSE = ['schuerze', 'eisen', 'holz', 'schuerze', 'leinen'];
  const HAAR = ['haar', 'haar', 'haar', 'holz', 'leinen', 'eisen'];

  /* ---------- Feuerstelle ---------- */
  const FX = 0, FZ = -4.5;
  const feuerTeile = [
    box(-2.0, 0, -5.3, 2.0, 0.75, -3.7, mats.stein, welt),
    box(-2.0, 0.75, -5.3, 2.0, 0.9, -5.12, mats.stein, welt),
    box(-2.0, 0.75, -3.88, 2.0, 0.9, -3.7, mats.stein, welt),
    box(-2.0, 0.75, -5.12, -1.82, 0.9, -3.88, mats.stein, welt),
    box(1.82, 0.75, -5.12, 2.0, 0.9, -3.88, mats.stein, welt),
  ];
  // Rost: zwölf Eisenstäbe über der rechten Hälfte, links die Glutmulde
  {
    const staebe = [];
    for (let i = 0; i < 12; i++) staebe.push({ x: -0.55 + i * 0.21, y: 0.98, z: -4.5 });
    const g = new THREE.BoxGeometry(0.035, 0.035, 1.3);
    instanced(g, mats.eisen, staebe, welt, false);
    box(-0.62, 0.9, -5.1, 1.82, 0.96, -5.02, mats.eisen, welt, false);
    box(-0.62, 0.9, -3.98, 1.82, 0.96, -3.9, mats.eisen, welt, false);
  }
  // Pfanne auf dem Rost
  const pfanne = new THREE.Group(); pfanne.position.set(0.85, 1.0, -4.2); welt.add(pfanne);
  mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.07, 22, 1, true), eisenD, pfanne);
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 22), mats.eisen, pfanne).position.y = -0.03;
  { const st = mesh(limb([0.22, 0.02, 0.06], [0.62, 0.06, 0.28], 0.018, 5, 1), mats.eisen, pfanne); st.castShadow = false; }
  for (let i = 0; i < 7; i++) { const k = mesh(new THREE.SphereGeometry(0.035, 8, 6), i % 2 ? mats.blatt : mats.ziegel, pfanne, false); k.position.set((R() - 0.5) * 0.24, 0.0, (R() - 0.5) * 0.24); k.scale.set(1.6, 0.6, 1); }
  // Abzugshaube (ghost), Pyramidenstumpf 4.4 x 1.9 unten, 1.1 x 1.1 oben, y 2.6 bis 4.0
  function stumpf(bx, bz, tx, tz, y0, y1) {
    const u = [[-bx, y0, -bz], [bx, y0, -bz], [bx, y0, bz], [-bx, y0, bz]], o = [[-tx, y1, -tz], [tx, y1, -tz], [tx, y1, tz], [-tx, y1, tz]];
    const pos = [];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; pos.push(...u[i], ...u[j], ...o[j], ...u[i], ...o[j], ...o[i]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    return g;
  }
  { const h = mesh(stumpf(2.2, 0.95, 0.55, 0.55, 2.6, 4.0), ghost.eisen, welt); h.position.set(FX, 0, FZ); }
  box(-2.25, 2.52, -5.5, 2.25, 2.62, -3.5, ghost.eisen, welt);
  // Kette mit zwei hängenden Töpfen (ghost)
  for (const x of [-1.25, -0.55]) {
    box(x - 0.012, 1.55, -4.62, x + 0.012, 2.6, -4.58, ghost.eisen, welt, false);
    const t = mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.26, 16), ghost.eisen, welt); t.position.set(x, 1.42, -4.6);
  }
  // Holzstapel neben der Feuerstelle
  const scheitGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 9);
  scheitGeo.rotateX(Math.PI / 2);
  const scheitMats = [mats.holz, mats.buche, mats.buche];
  {
    const l = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) l.push({ x: -2.62 + i * 0.21 + r * 0.1, y: 0.1 + r * 0.18, z: -5.6, ry: Math.PI / 2 });
    instanced(scheitGeo, scheitMats, l, welt);
  }
  // Pass (Anrichte) mit drei Tellern
  box(2.4, 0, -3.7, 3.8, 0.86, -3.25, mats.holz, welt);
  box(2.32, 0.86, -3.75, 3.88, 0.92, -3.2, mats.holz, welt);
  instanced(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 18), mats.leinen, [{ x: 2.7, y: 0.93, z: -3.48 }, { x: 3.1, y: 0.93, z: -3.46 }, { x: 3.5, y: 0.93, z: -3.48 }], welt, false);

  // Flammen: 14 Zungen als Billboards mit eigenem kleinen Shader (gestufte Töne, keine Verläufe)
  const RAUSCHEN = `
float fh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float fn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fh(i), fh(i + vec2(1.0, 0.0)), u.x), mix(fh(i + vec2(0.0, 1.0)), fh(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += fn(p) * a; p *= 2.03; a *= 0.5; } return s; }`;
  const uFlamme = { value: new THREE.Color('#F7B24A') }, uGlut = { value: new THREE.Color('#E2552B') }, uTief = { value: new THREE.Color('#A93D1B') };
  const flammenT = { value: 0 };
  const flammen = [];
  const flammenGruppe = new THREE.Group(); welt.add(flammenGruppe);
  for (let i = 0; i < 14; i++) {
    const h = 0.4 + R() * 0.5, b = 0.32 + R() * 0.2;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: flammenT, uSeed: { value: R() * 40 }, uFlamme, uGlut, uTief, uKraft: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT; uniform float uSeed; uniform float uKraft; uniform vec3 uFlamme; uniform vec3 uGlut; uniform vec3 uTief; varying vec2 vUv;
${RAUSCHEN}
void main(){
  vec2 uv = vUv;
  float n = fbm(vec2(uv.x * 2.6 + uSeed, uv.y * 2.0 - uT * 2.3 + uSeed));
  float breite = 1.0 - smoothstep(0.0, 0.5, abs(uv.x - 0.5 + (n - 0.5) * 0.35 * uv.y) * (1.0 + uv.y * 1.7));
  float f = breite * (1.15 - uv.y) * 1.5 + (n - 0.5) * 0.85 - uv.y * 0.25;
  f *= uKraft;
  if (f < 0.32) discard;
  vec3 c = f > 0.78 ? uFlamme : (f > 0.5 ? uGlut : uTief);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
      side: THREE.DoubleSide,
    });
    const g = new THREE.PlaneGeometry(b, h); g.translate(0, h / 2, 0);
    const f = new THREE.Mesh(g, mat);
    f.position.set(-1.65 + i * (3.3 / 13) + (R() - 0.5) * 0.1, 0.76, FZ + (R() - 0.5) * 0.6);
    f.userData.h = h;
    flammenGruppe.add(f); flammen.push(f);
  }
  // Glut: Fläche mit emissivem Rauschen, pulsiert langsam
  const glutU = { uT: flammenT, uKraft: { value: 1 }, uFlamme, uGlut, uTief };
  {
    const g = new THREE.PlaneGeometry(3.64, 1.24); g.rotateX(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({
      uniforms: glutU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT; uniform float uKraft; uniform vec3 uFlamme; uniform vec3 uGlut; uniform vec3 uTief; varying vec2 vUv;
${RAUSCHEN}
void main(){
  float n = fbm(vUv * vec2(14.0, 5.0) + vec2(0.0, uT * 0.08));
  float puls = 0.85 + 0.15 * sin(uT * 0.9 + n * 6.0);
  float v = n * puls * uKraft;
  vec3 c = v > 0.62 ? uFlamme : (v > 0.42 ? uGlut : (v > 0.25 ? uTief : vec3(0.09, 0.03, 0.02)));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
    });
    const o = new THREE.Mesh(g, m); o.position.set(FX, 0.77, FZ); welt.add(o); feuerTeile.push(o);
  }
  // Funken: Pool aus 80 Punkten (Handy halb), additive Mischung
  const FUNKEN_N = handy ? 40 : 80;
  const funkenPos = new Float32Array(FUNKEN_N * 3), funkenGr = new Float32Array(FUNKEN_N), funkenHell = new Float32Array(FUNKEN_N);
  const funken = [];
  for (let i = 0; i < FUNKEN_N; i++) {
    funken.push({ alter: 1 + R(), max: 1, x: 0, y: -10, z: 0, w: R() * 6.28, r: 0.05 + R() * 0.15, vy: 0.9 + R() * 0.6, hoch: 1.5 + R() * 1.5 });
    funkenGr[i] = 3 + R() * 3;
  }
  const funkenGeo = new THREE.BufferGeometry();
  funkenGeo.setAttribute('position', new THREE.BufferAttribute(funkenPos, 3));
  funkenGeo.setAttribute('aGr', new THREE.BufferAttribute(funkenGr, 1));
  funkenGeo.setAttribute('aHell', new THREE.BufferAttribute(funkenHell, 1));
  const funkenU = { uPr: { value: renderer.getPixelRatio() }, uStreck: { value: 1 }, uFlamme };
  const funkenPunkte = new THREE.Points(funkenGeo, new THREE.ShaderMaterial({
    uniforms: funkenU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aGr; attribute float aHell; uniform float uPr; uniform float uStreck; varying float vHell;
void main(){ vHell = aHell; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aGr * uPr * uStreck * (aHell > 0.0 ? 1.0 : 0.0); }`,
    fragmentShader: `uniform vec3 uFlamme; uniform float uStreck; varying float vHell;
void main(){ vec2 c = gl_PointCoord - 0.5; c.x *= uStreck; float d = length(c); if (d > 0.5) discard; float a = (1.0 - d * 2.0) * vHell;
  gl_FragColor = vec4(uFlamme * (0.7 + 0.6 * vHell), a);
  #include <colorspace_fragment>
}`,
  }));
  funkenPunkte.frustumCulled = false;
  welt.add(funkenPunkte);
  function funkeStarten(f, stoss) {
    f.alter = 0; f.max = (stoss ? 1.2 : 1.6) + R() * 1.2;
    f.x = (R() - 0.5) * 3.4; f.z = FZ + (R() - 0.5) * 0.7; f.y = 0.9;
    f.w = R() * 6.28; f.r = 0.05 + R() * 0.18; f.vy = (stoss ? 1.6 : 0.9) + R() * 0.8; f.hoch = 1.5 + R() * 1.5;
  }
  // Ohne Bewegung stehen die Funken still, verteilt über dem Feuer
  if (ruhig) funken.forEach((f, i) => { funkeStarten(f, false); f.alter = (i / FUNKEN_N) * f.max * 0.9; });

  // Hitzeflimmern (nur Desktop, nicht bei reduzierter Bewegung)
  const flimmernAn = !handy && !ruhig;
  let rt = null, flimmerSzene = null, flimmerKam = null, flimmerU = null;
  if (flimmernAn) {
    rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    flimmerU = { tBild: { value: rt.texture }, uRect: { value: new THREE.Vector4(0, 0, 0, 0) }, uT: flammenT, uKraft: { value: 0 } };
    flimmerSzene = new THREE.Scene();
    flimmerKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    flimmerSzene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: flimmerU, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tBild; uniform vec4 uRect; uniform float uT; uniform float uKraft; varying vec2 vUv;
${RAUSCHEN}
void main(){
  vec2 uv = vUv;
  float m = smoothstep(uRect.x, uRect.x + 0.04, uv.x) * (1.0 - smoothstep(uRect.z - 0.04, uRect.z, uv.x))
          * smoothstep(uRect.y, uRect.y + 0.03, uv.y) * (1.0 - smoothstep(uRect.w - 0.08, uRect.w, uv.y));
  vec2 q = uv * vec2(46.0, 28.0) + vec2(0.0, -uT * 3.2);
  vec2 d = vec2(fn(q), fn(q + 17.3)) - 0.5;
  uv += d * 0.007 * m * uKraft;
  gl_FragColor = texture2D(tBild, uv);
  #include <colorspace_fragment>
}`,
    })));
  }

  /* ---------- Gastraum ---------- */
  const tischGeo = {
    2: [0.8, 0.8], 4: [1.0, 1.0], 6: [1.8, 0.9], 8: [2.6, 0.9],
  };
  function sitzeFuer(t) {
    const o = [], add = (dx, dz) => o.push({ x: t.x + dx, z: t.z + dz, ry: Math.atan2(-dx, -dz) });
    if (t.plaetze === 2) { add(-0.72, 0); add(0.72, 0); }
    else if (t.plaetze === 4) { add(-0.82, 0); add(0.82, 0); add(0, -0.82); add(0, 0.82); }
    else if (t.plaetze === 6) { add(-0.5, -0.78); add(0.5, -0.78); add(-0.5, 0.78); add(0.5, 0.78); add(-1.27, 0); add(1.27, 0); }
    else { add(-0.9, -0.78); add(0, -0.78); add(0.9, -0.78); add(-0.9, 0.78); add(0, 0.78); add(0.9, 0.78); add(-1.68, 0); add(1.68, 0); }
    return o;
  }
  const stuhlGeo = merge([
    bake(new THREE.BoxGeometry(0.42, 0.04, 0.42), M([0, 0.46, 0])),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => bake(new THREE.BoxGeometry(0.035, 0.46, 0.035), M([sx * 0.18, 0.23, sz * 0.18]))),
    ...[-1, 1].map((sx) => bake(new THREE.BoxGeometry(0.035, 0.42, 0.035), M([sx * 0.18, 0.68, -0.19]))),
    bake(new THREE.BoxGeometry(0.4, 0.1, 0.03), M([0, 0.84, -0.19])),
  ]);
  const kerzenFlammen = [];
  const kerzeMat = new THREE.MeshBasicMaterial({ color: '#FFC979' });
  const stuehle = [], gedeck = [];
  const sitzplaetze = [];   // in Reihenfolge des Füllens
  const tischObjekte = {};
  const tischHits = [];
  for (const t of TISCHE) {
    const [lx, lz] = tischGeo[t.plaetze];
    const tg = new THREE.Group(); tg.position.set(t.x, 0, t.z); welt.add(tg);
    box(-lx / 2, 0.72, -lz / 2, lx / 2, 0.76, lz / 2, mats.holz, tg);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(sx * (lx / 2 - 0.08) - 0.03, 0, sz * (lz / 2 - 0.08) - 0.03, sx * (lx / 2 - 0.08) + 0.03, 0.72, sz * (lz / 2 - 0.08) + 0.03, mats.holz, tg);
    // Tuch halb überhängend
    box(-lx / 2 - 0.04, 0.762, -lz * 0.22, lx / 2 + 0.04, 0.772, lz * 0.22, mats.leinen, tg, false);
    box(-lx / 2 - 0.05, 0.56, -lz * 0.22, -lx / 2 - 0.04, 0.772, lz * 0.22, mats.leinen, tg, false);
    box(lx / 2 + 0.04, 0.56, -lz * 0.22, lx / 2 + 0.05, 0.772, lz * 0.22, mats.leinen, tg, false);
    // Kerze
    box(-0.025, 0.772, -0.025, 0.025, 0.88, 0.025, mats.leinen, tg, false);
    const kf = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 8), kerzeMat); kf.position.set(0, 0.915, 0); tg.add(kf); kerzenFlammen.push(kf);
    // Glut-Kontur unter dem Tisch, wenn er gewählt ist
    const kontur = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.2, 4, 1), new THREE.MeshBasicMaterial({ color: '#E2552B' }));
    {
      const w = lx + 1.9, d = lz + 1.9, g = [];
      const rand = 0.09;
      for (const [x0, z0, x1, z1] of [[-w / 2, -d / 2, w / 2, -d / 2 + rand], [-w / 2, d / 2 - rand, w / 2, d / 2], [-w / 2, -d / 2, -w / 2 + rand, d / 2], [w / 2 - rand, -d / 2, w / 2, d / 2]]) {
        const pg = new THREE.PlaneGeometry(x1 - x0, z1 - z0); pg.rotateX(-Math.PI / 2); pg.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); g.push(bake(pg));
      }
      kontur.geometry = merge(g);
    }
    kontur.position.y = 0.025; kontur.visible = false; tg.add(kontur);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(lx + 1.2, 1.0, lz + 1.2), new THREE.MeshBasicMaterial());
    hit.position.y = 0.5; hit.layers.set(HIT); hit.userData.tisch = t.n; tg.add(hit); tischHits.push(hit);
    tischObjekte[t.n] = { gruppe: tg, kontur, sitze: [] };
    sitzeFuer(t).forEach((s, i) => {
      stuehle.push({ x: s.x - Math.sin(s.ry) * 0.1, z: s.z - Math.cos(s.ry) * 0.1, ry: s.ry });
      const f = figur({ sitzend: true, ober: OBER[Math.floor(R() * OBER.length)], hose: HOSE[Math.floor(R() * HOSE.length)], haar: HAAR[Math.floor(R() * HAAR.length)], stil: Math.floor(R() * 4), glas: R() < 0.45 });
      f.position.set(s.x, 0, s.z); f.rotation.y = s.ry + Math.PI; f.visible = false;
      // Blick zum Tisch: die Figur schaut entlang +z, der Tisch liegt in Richtung -(dx, dz)
      f.rotation.y = Math.atan2(t.x - s.x, t.z - s.z);
      welt.add(f);
      f.userData.tisch = t.n;
      const k = 0.5 / Math.hypot(s.x - t.x, s.z - t.z);
      gedeck.push({ x: s.x + (t.x - s.x) * k, y: 0.775, z: s.z + (t.z - s.z) * k });
      tischObjekte[t.n].sitze.push(f);
    });
  }
  instanced(stuhlGeo, mats.holz, stuehle, welt);
  instanced(new THREE.CylinderGeometry(0.12, 0.09, 0.015, 16), mats.leinen, gedeck, welt, false);
  // Reihenfolge, in der sich der Raum füllt (T6 bleibt frei)
  {
    const s = (n, i) => tischObjekte[n].sitze[i];
    [s(1, 0), s(1, 1), s(4, 0), s(4, 1), s(7, 0), s(7, 1), s(2, 0), s(2, 1), s(3, 0), s(3, 1), s(5, 0), s(5, 1), s(8, 0), s(8, 1), s(7, 2), s(7, 3), s(2, 2), s(2, 3), s(3, 2), s(3, 3), s(5, 2), s(5, 3), s(8, 2), s(8, 3), s(5, 4), s(5, 5), s(8, 4), s(8, 5), s(8, 6), s(8, 7)].forEach((f) => sitzplaetze.push(f));
  }
  // Tafel an der Rückwand
  const tafel = canvasTextur(1024, 700);
  const tafelMat = new THREE.MeshBasicMaterial({ map: tafel.t, color: new THREE.Color(0.86, 0.86, 0.86) });
  const TAFEL = { x: -4.5, y: 1.9, z: -9.68, b: 3.2, h: 2.2 };
  { const o = new THREE.Mesh(new THREE.PlaneGeometry(TAFEL.b, TAFEL.h), tafelMat); o.position.set(TAFEL.x, TAFEL.y, TAFEL.z); welt.add(o); }
  box(TAFEL.x - 1.68, 0.72, -9.7, TAFEL.x + 1.68, 0.8, -9.6, mats.holz, welt);
  box(TAFEL.x - 1.68, 3.0, -9.7, TAFEL.x + 1.68, 3.08, -9.6, mats.holz, welt);
  box(TAFEL.x - 1.68, 0.8, -9.7, TAFEL.x - 1.6, 3.0, -9.6, mats.holz, welt);
  box(TAFEL.x + 1.6, 0.8, -9.7, TAFEL.x + 1.68, 3.0, -9.6, mats.holz, welt);
  // Hand mit Kreide
  const kreideHand = new THREE.Group(); kreideHand.visible = false; welt.add(kreideHand);
  mesh(merge([limb([0, 0, 0], [0.12, -0.28, 0.3], 0.042), limb([0.12, -0.28, 0.3], [0.26, -0.5, 0.42], 0.05)]), weich('leinen'), kreideHand, false);
  mesh(ball(0.045, [0, 0, 0.02], [1, 0.8, 1.2]), hautM(), kreideHand, false);
  { const k = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), new THREE.MeshBasicMaterial({ color: '#F4F0E8' }), kreideHand, false); k.rotation.x = Math.PI / 2; k.position.set(-0.01, 0.01, -0.035); }
  // Fenster nach hinten mit Nachthimmel (hier sitzt das Gastraum-Video als Bild im Bild)
  const RF = { x: 4.8, y: 2.5, z: -9.68, b: 1.3, h: 1.9 };
  const hintenMat = new THREE.MeshBasicMaterial({ color: '#4E5F5F' });
  { const o = new THREE.Mesh(new THREE.PlaneGeometry(RF.b, RF.h), hintenMat); o.position.set(RF.x, RF.y, RF.z); welt.add(o); }
  box(RF.x - RF.b / 2 - 0.08, RF.y - RF.h / 2 - 0.08, -9.7, RF.x + RF.b / 2 + 0.08, RF.y - RF.h / 2, -9.6, mats.holz, welt);
  box(RF.x - 0.025, RF.y - RF.h / 2, -9.68, RF.x + 0.025, RF.y + RF.h / 2, -9.64, mats.holz, welt, false);
  box(RF.x - RF.b / 2, RF.y - 0.02, -9.68, RF.x + RF.b / 2, RF.y + 0.02, -9.64, mats.holz, welt, false);
  const rfEcken = [V(RF.x - RF.b / 2, RF.y + RF.h / 2, RF.z), V(RF.x + RF.b / 2, RF.y + RF.h / 2, RF.z), V(RF.x + RF.b / 2, RF.y - RF.h / 2, RF.z), V(RF.x - RF.b / 2, RF.y - RF.h / 2, RF.z)];
  // Wandregal mit Gläsern
  box(8.45, 1.5, -6.6, 8.7, 1.54, -4.6, mats.holz, welt);
  box(8.45, 2.05, -6.6, 8.7, 2.09, -4.6, mats.holz, welt);
  { const l = []; for (let i = 0; i < 9; i++) { l.push({ x: 8.56, y: 1.54, z: -6.45 + i * 0.22 }); l.push({ x: 8.56, y: 2.09, z: -6.4 + i * 0.22 }); } instanced(weinGeo, mats.glas, l, welt, false); }
  // Hängelampen (ghost), ab p 0.30 an
  const lampenBirnen = new THREE.MeshBasicMaterial({ color: '#5A4A3A' });
  const haengend = new THREE.Group(); welt.add(haengend);
  for (const [x, z] of [[-4.8, -4.2], [4.9, -4.4], [0, -8.0]]) {
    box(x - 0.008, 3.2, z - 0.008, x + 0.008, 6.0, z + 0.008, ghost.eisen, haengend, false);
    const s = mesh(new THREE.ConeGeometry(0.32, 0.3, 18, 1, true), ghost.eisen, haengend); s.position.set(x, 3.05, z);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lampenBirnen); b.position.set(x, 2.92, z); haengend.add(b);
    lampe(x, 2.75, z, 'innen', '#FFCF96', 8.5);
  }

  // Treffer-Box über der Feuerstelle
  const feuerHit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 1.9), new THREE.MeshBasicMaterial());
  feuerHit.position.set(FX, 1.0, FZ); feuerHit.layers.set(HIT); welt.add(feuerHit);

  /* ---------- Hof: Holzstapel, Korb, Koch ---------- */
  {
    box(-7.6, 0, 6.78, -5.4, 0.12, 6.9, mats.holz, welt);
    box(-7.6, 0, 7.1, -5.4, 0.12, 7.22, mats.holz, welt);
    const l = [];
    for (let r = 0; r < 6; r++) for (let i = 0; i < 9; i++) {
      const rr = 0.09 + R() * 0.03;
      l.push({ x: -7.36 + i * 0.235 + (r % 2) * 0.06, y: 0.12 + rr + r * 0.215, z: 7.0, s: rr / 0.1, sz: 1 });
    }
    instanced(scheitGeo, scheitMats, l.map((o) => ({ ...o, sx: o.s, sy: o.s, sz: 1 })), welt);
    for (const x of [-7.7, -5.3]) box(x - 0.06, 0, 7.3, x + 0.06, 2.1, 7.42, mats.holz, welt);
    const dach = mesh(new THREE.BoxGeometry(2.8, 0.08, 1.3), mats.holz, welt); dach.position.set(-6.5, 2.1, 6.95); dach.rotation.x = 0.22;
  }
  const korb = new THREE.Group(); korb.position.set(-6.3, 0, 7.85); welt.add(korb);
  mesh(new THREE.LatheGeometry([[0, 0.02], [0.22, 0.02], [0.26, 0.12], [0.3, 0.36], [0.31, 0.42], [0.28, 0.42], [0.27, 0.36], [0.23, 0.12], [0, 0.06]].map(([r, y]) => new THREE.Vector2(r, y)), 18), holzD, korb);
  instanced(scheitGeo, scheitMats, [{ x: -0.08, y: 0.32, z: 0, ry: 0.3, s: 0.9 }, { x: 0.09, y: 0.33, z: 0.02, ry: -0.2, s: 0.9 }, { x: 0, y: 0.45, z: -0.02, ry: 1.3, s: 0.9 }, { x: 0.02, y: 0.36, z: 0.1, ry: 0.9, s: 0.85 }], korb);
  const KORB_PUNKT = V(-6.3, 0.42, 7.85);
  const koch1 = figur({ ober: 'leinen', hose: 'schuerze', haar: 'haar', stil: 0, schuerze: true, groesse: 1.02 });
  welt.add(koch1);
  const koch2 = figur({ ober: 'leinen', hose: 'schuerze', haar: 'haar', stil: 1, schuerze: true, groesse: 0.98 });
  koch2.position.set(3.1, 0, -4.15); koch2.rotation.y = 0; welt.add(koch2);
  const flugScheit = mesh(scheitGeo, scheitMats, welt); flugScheit.visible = false; flugScheit.scale.setScalar(0.85);
  let kochDrinnen = null;
  function kochSetzen(drinnen) {
    if (drinnen === kochDrinnen) return;
    kochDrinnen = drinnen;
    if (drinnen) { koch1.position.set(1.75, 0, -3.35); koch1.rotation.y = Math.atan2(0.85 - 1.75, -4.2 + 3.35); }
    else { koch1.position.set(-5.05, 0, 7.55); koch1.rotation.y = -1.85; }
    feuerA.shadow.needsUpdate = true;
  }
  kochSetzen(false);

  /* ---------- Himmel, Sterne, Rauch ---------- */
  const himmelU = { oben: { value: new THREE.Color() }, horizont: { value: new THREE.Color() } };
  const himmel = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: himmelU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 oben; uniform vec3 horizont; varying vec3 vP;
void main(){ float h = clamp(vP.y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(horizont, oben, pow(h, 0.75)), 1.0);
#include <colorspace_fragment>
}`,
  }));
  himmel.renderOrder = -1; scene.add(himmel);
  const sternGeo = new THREE.BufferGeometry();
  { const pts = []; for (let i = 0; i < 260; i++) { const a = R() * Math.PI * 2, e = 0.12 + R() * 1.3; pts.push(Math.cos(a) * Math.cos(e) * 450, Math.sin(e) * 450, Math.sin(a) * Math.cos(e) * 450); } sternGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); }
  const sternMat = new THREE.PointsMaterial({ color: '#F3D9A4', size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const sterne = new THREE.Points(sternGeo, sternMat); scene.add(sterne);

  const rauchTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 4, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
  })();
  const rauchGruppe = new THREE.Group(); scene.add(rauchGruppe);
  const rauch = [];
  const RAUCH_TAG = new THREE.Color('#3B342F'), RAUCH_NACHT = new THREE.Color('#1E1A18'), RAUCH_GLUT = new THREE.Color('#8A5238');
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: rauchTex, color: RAUCH_TAG.clone(), transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.ph = i / 24; s.userData.dx = (R() - 0.5) * 0.4;
    rauchGruppe.add(s); rauch.push(s);
  }
  if (ruhig) rauch.forEach((s, i) => {
    if (i < 5) { const a = 0.1 + i * 0.16; s.userData.a = a; s.position.set(a * 1.6, 11.3 + a * 3.6, -4.5); s.scale.setScalar(lerp(0.6, 2.4, a)); s.material.opacity = 0.5 * (1 - a * 0.7); }
    else s.visible = false;
  });

  /* ---------- Canvas-Texturen: Schild und Tafel ---------- */
  function schildZeichnen() {
    const { x, c, t } = schild;
    x.clearRect(0, 0, c.width, c.height);
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#E2552B'; x.font = '500 150px Newsreader, Georgia, serif';
    if ('letterSpacing' in x) x.letterSpacing = '18px';
    x.fillText('FUMO', 520, 150);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    x.fillStyle = '#EDE7DF'; x.font = '400 64px Caveat, cursive';
    x.fillText('Holzfeuerküche', 512, 228);
    t.needsUpdate = true;
  }
  // Tafel: Zeilen, die Zeile für Zeile mit Kreide geschrieben werden
  const TAFEL_ZEILEN = [
    { t: 'Heute am Feuer', f: '700 64px Caveat, cursive', x: 74, y: 92, farbe: '#F3EEE6' },
    { t: 'Aus der Glut', f: '700 40px Caveat, cursive', x: 74, y: 160, farbe: '#F2C98E' },
    { t: 'Gemüse vom Feuer', p: '22', f: '400 38px Caveat, cursive', x: 112, y: 206 },
    { t: 'Lauch aus der Glut', p: '19', f: '400 38px Caveat, cursive', x: 112, y: 250 },
    { t: 'Brot aus dem Holzofen', p: '9', f: '400 38px Caveat, cursive', x: 112, y: 294 },
    { linie: true, y: 322 },
    { t: 'Vom Rost', f: '700 40px Caveat, cursive', x: 74, y: 372, farbe: '#F2C98E' },
    { t: 'Felchen aus der Pfanne', p: '42', f: '400 38px Caveat, cursive', x: 112, y: 418 },
    { t: 'Rinderrippe, sechs Stunden', p: '58', f: '400 38px Caveat, cursive', x: 112, y: 462 },
    { linie: true, y: 490 },
    { t: 'Zum Schluss', f: '700 40px Caveat, cursive', x: 74, y: 540, farbe: '#F2C98E' },
    { t: 'Apfel aus der Glut', p: '16', f: '400 38px Caveat, cursive', x: 112, y: 586 },
    { linie: true, y: 614 },
    { t: 'Am Feuer, das ganze Menü', p: '96', f: '700 40px Caveat, cursive', x: 74, y: 662, farbe: '#F3EEE6' },
  ];
  const tafelGrund = document.createElement('canvas'); tafelGrund.width = 1024; tafelGrund.height = 700;
  const tafelVoll = document.createElement('canvas'); tafelVoll.width = 1024; tafelVoll.height = 700;
  let tafelLaenge = 0, tafelZuletzt = -1;
  function tafelVorbereiten() {
    const rr = rng(57);
    let x = tafelGrund.getContext('2d');
    x.fillStyle = '#1D201E'; x.fillRect(0, 0, 1024, 700);
    // Kreideschleier: zufällige helle Wischer, 4 Prozent
    x.strokeStyle = 'rgba(237,231,223,0.04)'; x.lineCap = 'round';
    for (let i = 0; i < 9; i++) { x.lineWidth = 24 + rr() * 40; x.beginPath(); const a = rr() * 1024, b = rr() * 700; x.moveTo(a, b); x.quadraticCurveTo(a + 120 * rr(), b - 60 + rr() * 120, a + 160 + rr() * 220, b + (rr() - 0.5) * 80); x.stroke(); }
    x = tafelVoll.getContext('2d');
    x.clearRect(0, 0, 1024, 700);
    x.textBaseline = 'alphabetic';
    tafelLaenge = 0;
    for (const z of TAFEL_ZEILEN) {
      if (z.linie) {
        x.strokeStyle = 'rgba(237,231,223,.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(74, z.y);
        for (let k = 1; k <= 12; k++) x.lineTo(74 + k * 72, z.y + (rr() - 0.5) * 3);
        x.stroke();
        z.x0 = 74; z.x1 = 950; z.top = z.y - 8; z.bot = z.y + 8;
      } else {
        x.font = z.f; x.fillStyle = z.farbe || '#ECE8E0';
        x.textAlign = 'left'; x.fillText(z.t, z.x, z.y);
        let ende = z.x + x.measureText(z.t).width;
        if (z.p) {
          x.textAlign = 'right'; x.fillText(z.p, 950, z.y);
          const pw = x.measureText(z.p).width;
          x.fillStyle = 'rgba(237,231,223,.6)';
          for (let px = ende + 14; px < 950 - pw - 14; px += 13) x.fillRect(px, z.y - 4, 3, 3);
          ende = 950;
        }
        z.x0 = z.x; z.x1 = ende; z.top = z.y - 52; z.bot = z.y + 14;
      }
      z.start = tafelLaenge; tafelLaenge += z.x1 - z.x0;
    }
    // Kreidekörnung: feine Löcher in der Schrift
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(0,0,0,${(0.2 + rr() * 0.5).toFixed(2)})`; x.fillRect(rr() * 1024, rr() * 700, 1 + rr() * 2, 1 + rr() * 2); }
    x.globalCompositeOperation = 'source-over';
    tafelZuletzt = -1;
  }
  let kreideStelle = { u: 0, v: 0 };
  function tafelZeichnen(s) {
    if (Math.abs(s - tafelZuletzt) < 0.0015) return;
    tafelZuletzt = s;
    const { x, t } = tafel;
    x.globalCompositeOperation = 'source-over';
    x.drawImage(tafelGrund, 0, 0);
    const geschrieben = s * tafelLaenge;
    for (const z of TAFEL_ZEILEN) {
      const w = clamp(geschrieben - z.start, 0, z.x1 - z.x0);
      if (w <= 0) break;
      x.save(); x.beginPath(); x.rect(z.x0 - 6, z.top, w + 6, z.bot - z.top); x.clip(); x.drawImage(tafelVoll, 0, 0); x.restore();
      if (w < z.x1 - z.x0) { kreideStelle = { u: (z.x0 + w) / 1024, v: (z.y - 12) / 700 }; }
    }
    if (s >= 1) kreideStelle = { u: 0.93, v: 0.92 };
    t.needsUpdate = true;
  }
  function texturenZeichnen() { schildZeichnen(); tafelVorbereiten(); tafelZeichnen(0); }
  texturenZeichnen();
  if (document.fonts) {
    Promise.all([document.fonts.load('700 64px Caveat'), document.fonts.load('400 38px Caveat'), document.fonts.load('500 150px Newsreader')]).then(() => { texturenZeichnen(); }, () => {});
  }
  // Kreidestaub
  const staubN = 14;
  const staubPos = new Float32Array(staubN * 3);
  const staub = Array.from({ length: staubN }, () => ({ x: 0, y: -10, z: 0, v: 0, a: 1 }));
  const staubGeo = new THREE.BufferGeometry(); staubGeo.setAttribute('position', new THREE.BufferAttribute(staubPos, 3));
  const staubPunkte = new THREE.Points(staubGeo, new THREE.PointsMaterial({ color: '#EDE7DF', size: 2, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false }));
  staubPunkte.frustumCulled = false; welt.add(staubPunkte);

  // Klirren an besetzten Tischen (kurzes Funkeln über den Gläsern)
  const klirrN = 8;
  const klirrPos = new Float32Array(klirrN * 3);
  const klirrGeo = new THREE.BufferGeometry(); klirrGeo.setAttribute('position', new THREE.BufferAttribute(klirrPos, 3));
  const klirrMat = new THREE.PointsMaterial({ color: '#FFE7B0', size: 7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const klirr = new THREE.Points(klirrGeo, klirrMat); klirr.frustumCulled = false; welt.add(klirr);

  /* ---------- Kamera ---------- */
  // [p, Position, Blickziel, FOV]; geprüft gegen Wände, Torflügel, Haube und Tische
  const KF = [
    [0.00, [0, 4.6, 36], [0, 5.6, 0], 44],
    [0.06, [-2.5, 4.0, 22], [-1.5, 2.4, 3], 40],
    [0.10, [-8.0, 2.4, 12], [-6.5, 0.9, 7], 44],
    [0.15, [-6.9, 1.4, 8.8], [-6.3, 0.25, 7.85], 50],
    [0.27, [-4.0, 1.9, 9.0], [-1.0, 1.6, 2], 46],
    [0.30, [0, 1.75, 5.5], [0, 1.6, 0], 48],
    [0.33, [0, 1.70, 1.2], [0, 1.4, -4], 54],
    [0.36, [2.2, 2.0, -1.0], [0, 0.9, -4.5], 46],
    [0.40, [0.8, 1.5, -3.0], [0, 0.85, -4.5], 40],
    [0.49, [1.6, 1.7, -2.4], [0, 0.9, -4.5], 44],
    [0.52, [-0.2, 1.4, -3.0], [0.85, 0.95, -4.2], 38],
    [0.65, [-2.9, 1.8, -2.8], [-3.6, 1.8, -8.0], 44],
    [0.672, [-2.6, 1.8, -6.1], [-3.7, 1.75, -9.85], 43],
    [0.72, [-2.5, 1.82, -5.8], [-3.7, 1.75, -9.85], 43],
    [0.74, [3.0, 2.2, -6.0], [4.6, 2.2, -9.8], 48],
    [0.78, [3.4, 6.5, -2.2], [0, 0, -4.6], 52],
    [0.80, [0, 19.0, -4.4], [0, 0, -4.5], 42],
    [0.92, [0, 19.0, -4.4], [0, 0, -4.5], 42],
    [0.95, [0.4, 2.5, 0.8], [0, 1.1, -4.5], 46],
    [0.975, [0, 2.7, 9.5], [0, 1.9, -2.5], 44],
    [1.00, [0, 4.4, 34], [0, 5.8, 0], 42],
  ];
  const posKurve = new THREE.CatmullRomCurve3(KF.map((k) => V(...k[1])), false, 'centripetal');
  const zielKurve = new THREE.CatmullRomCurve3(KF.map((k) => V(...k[2])), false, 'centripetal');
  const ziel = new THREE.Vector3(), richtung = new THREE.Vector3();
  const zeiger = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { zeiger.x = e.clientX / innerWidth - 0.5; zeiger.y = e.clientY / innerHeight - 0.5; } }, { passive: true });
  // Am Handy ersetzt Ziehen den Zeiger
  let beruehrt = null;
  addEventListener('touchstart', (e) => { const t = e.touches[0]; beruehrt = { x: t.clientX, y: t.clientY, zx: zeiger.x, zy: zeiger.y }; }, { passive: true });
  addEventListener('touchmove', (e) => { if (!beruehrt) return; const t = e.touches[0]; zeiger.x = clamp(beruehrt.zx + (t.clientX - beruehrt.x) / innerWidth, -0.5, 0.5); zeiger.y = clamp(beruehrt.zy + (t.clientY - beruehrt.y) / innerHeight * 0.3, -0.5, 0.5); }, { passive: true });
  addEventListener('touchend', () => { beruehrt = null; }, { passive: true });
  let hochkant = false;
  let tempo = 0;
  let sichtF = 1; // sichtbarer Anteil des Canvas (im Hero schneidet der Rahmen oben ab)
  const HANDY_TAFEL_KAM = V(-4.4, 2.1, -3.8), HANDY_TAFEL_ZIEL = V(-4.5, 0.3, -9.85);
  function kameraSetzen(p, t) {
    let i = 0;
    while (i < KF.length - 2 && p > KF[i + 1][0]) i++;
    const u = clamp((p - KF[i][0]) / (KF[i + 1][0] - KF[i][0]));
    const s = (i + u) / (KF.length - 1);
    posKurve.getPoint(s, camera.position);
    zielKurve.getPoint(s, ziel);
    const oben = fenster(p, 0.78, 0.80, 0.92, 0.95);
    if (hochkant) {
      // Handy: Raum steht quer zum Bildschirm und liegt in der oberen Hälfte, über den Paneelen
      if (oben < 0.999) { const z = ziel.clone(); camera.position.sub(z).multiplyScalar(1 + 0.12 * (1 - oben)).add(z); }
      camera.position.y += (34 - 19) * oben;
      camera.position.x += 9 * oben; ziel.x += 9 * oben;
    } else {
      const seite = lerp(-4.5, 4.5, smooth(0.82, 0.86, p)) * oben;
      camera.position.x += seite; ziel.x += seite;
    }
    if (hochkant) {
      // Handy: frontal und weiter weg vor die Tafel, Tafel in der oberen Bildhälfte über dem Paneel
      const tw = fenster(p, 0.655, 0.672, 0.72, 0.735);
      if (tw > 0) { camera.position.lerp(HANDY_TAFEL_KAM, tw); ziel.lerp(HANDY_TAFEL_ZIEL, tw); }
      // Schluss im Raum: Feuer in die obere Bildhälfte, über das Paneel
      ziel.y -= 1.5 * fenster(p, 0.93, 0.95, 0.965, 0.985);
    }
    if (!ruhig) {
      zeiger.sx += (zeiger.x - zeiger.sx) * 0.05; zeiger.sy += (zeiger.y - zeiger.sy) * 0.05;
      ziel.x += (zeiger.sx * 0.5 + Math.sin(t * 0.31) * 0.04) * (1 - oben);
      ziel.y -= (zeiger.sy * 0.3 + Math.sin(t * 0.23) * 0.03) * (1 - oben);
    }
    richtung.copy(ziel).sub(camera.position).normalize();
    const senk = smooth(0.8, 0.97, -richtung.y);
    if (hochkant) camera.up.set(-senk, 1 - senk, 0).normalize();
    else camera.up.set(0, 1 - senk, -senk).normalize();
    camera.lookAt(ziel);
    if (!ruhig) camera.rotateZ(THREE.MathUtils.degToRad(clamp(tempo * 30, -1, 1) * 0.6) * (1 - oben));
    let fov = lerp(KF[i][3], KF[i + 1][3], u);
    if (hochkant) fov = (fov + 8) * 1.2; else if (camera.aspect < 1.3) fov *= 1.1;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    // Im Hero ist nur der untere Teil des Canvas sichtbar: Bild so verschieben, dass das Blickziel dort in der Mitte liegt
    if (sichtF < 0.999) { camera.projectionMatrix.elements[9] += 1 - sichtF; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
    const drinnen = camera.position.x > -9 && camera.position.x < 9 && camera.position.z > -10 && camera.position.z < 2 && camera.position.y > 3.6;
    for (const m of ghostListe) { m.colorWrite = !drinnen; m.depthWrite = !drinnen; }
    lampenBirnen.visible = !drinnen;
    rauchGruppe.visible = !drinnen;
    return oben;
  }

  /* ---------- Tageszeit ---------- */
  const C = (h) => new THREE.Color(h);
  const HIM = { tagO: C('#9DB3BE'), tagH: C('#E9D9C3'), daemO: C('#5D5A6B'), daemH: C('#E39A6B'), nachtO: C('#0E0B10'), nachtH: C('#2A1611') };
  const SONNE_WARM = C('#FFC48A'), WEISS = C('#FFFFFF');
  const AUS = C('#5A4A3A'), BIRNE = C('#FFD9A0'), LATERNE = C('#FFC27A'), LAMPE = C('#FFCF96');
  const tmp = new THREE.Color();
  let feuerKraft = 0;
  function tageszeit(p) {
    const hoehe = THREE.MathUtils.degToRad(lerp(18, -6, clamp(p / 0.34)));
    const az = THREE.MathUtils.degToRad(lerp(-38, -62, clamp(p / 0.34)));
    const d = V(Math.sin(az) * Math.cos(hoehe), Math.sin(Math.max(hoehe, 0.02)), Math.cos(az) * Math.cos(hoehe));
    sonne.position.copy(sonne.target.position).addScaledVector(d, 70);
    sonne.intensity = Math.PI * 1.7 * smooth(-0.02, 0.06, hoehe);
    sonne.color.copy(WEISS).lerp(SONNE_WARM, smooth(0.0, 0.3, p));
    const daem = smooth(0.1, 0.28, p), nacht = smooth(0.28, 0.44, p);
    hemi.intensity = Math.PI * lerp(0.24, 0.15, nacht);
    hemi.color.copy(WEISS).lerp(C('#9AA6C4'), nacht);
    himmelU.oben.value.copy(HIM.tagO).lerp(HIM.daemO, daem).lerp(HIM.nachtO, nacht);
    himmelU.horizont.value.copy(HIM.tagH).lerp(HIM.daemH, daem).lerp(HIM.nachtH, nacht);
    sternMat.opacity = smooth(0.34, 0.6, p) * 0.9;
    const innen = smooth(0.28, 0.31, p), laterne = smooth(0.30, 0.33, p), kette = smooth(0.72, 0.75, p), fenster = smooth(0.32, 0.36, p);
    for (const { l, gruppe } of lampen) l.intensity = gruppe === 'innen' ? innen * 7 : gruppe === 'laterne' ? laterne * 9 : kette * 7;
    laterneGlas.color.copy(AUS).lerp(LATERNE, laterne);
    birnenMat.color.copy(AUS).lerp(BIRNE, kette);
    lampenBirnen.color.copy(AUS).lerp(LAMPE, innen);
    fensterMat.color.copy(glasTag).lerp(glasNacht, fenster);
    fensterNachtMat.color.copy(C('#3A3F3E')).lerp(C('#E8B270'), fenster);
    hintenMat.color.copy(C('#7C8F93')).lerp(HIM.nachtO, nacht).lerp(C('#1A1530'), nacht * 0.5);
    tmp.copy(RAUCH_TAG).lerp(RAUCH_NACHT, nacht);
    // nachts leuchtet die Glut im Kamin den Rauch von unten an, sonst verschwindet er im Nachthimmel
    rauch.forEach((s) => s.material.color.copy(tmp).lerp(RAUCH_GLUT, nacht * 0.6 * (1 - (s.userData.a ?? 0.4))));
    schildMat.color.setScalar(lerp(1, 0.75, nacht) + laterne * 0.2);
    // Feuer: brennt ab dem ersten Schnitt, gegen Mitternacht darf es ausgehen
    feuerKraft = smooth(0.25, 0.29, p) * (1 - 0.5 * smooth(0.93, 1, p));
  }

  /* ---------- DOM-Überlagerungen ---------- */
  const rahmen = $('#rahmen'), echt = $('#echt'), korn = $('#korn'), schilder = $('#schilder');
  const legende = $('#legende'), toast = $('#toast'), toastText = $('#toast-text'), kiHinweis = $('#ki-hinweis');
  const uhrEl = $('#uhr'), plaetzeEl = $('#plaetze'), marker = $('#marker');
  let W = 1, H = 1, heroUnten = 300, endOben = 90;
  function layout() {
    const sh = buehne.clientHeight, sw = buehne.clientWidth;
    endOben = kopfHoehe();
    W = Math.max(1, sw - 28); H = Math.max(1, sh - endOben - 14);
    rahmen.style.setProperty('--canvas-h', H + 'px');
    renderer.setSize(W, H, false);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    camera.aspect = W / H;
    hochkant = W / H < 0.9;
    heroUnten = Math.min(hero.offsetTop + hero.offsetHeight + 14, sh * 0.62);
    const pr = renderer.getPixelRatio();
    funkenU.uPr.value = pr;
    if (rt) rt.setSize(Math.round(W * pr), Math.round(H * pr));
    echtPr = Math.min(devicePixelRatio || 1, 1.5);
    echt.width = Math.round(W * echtPr); echt.height = Math.round(H * echtPr);
    echt.style.width = W + 'px'; echt.style.height = H + 'px';
    letzteRahmenK = -1;
  }
  let echtPr = 1, letzteRahmenK = -1;
  // Papierkörnung als erzeugte Rauschtextur
  {
    const c = document.createElement('canvas'); c.width = c.height = 200;
    const x = c.getContext('2d'), img = x.createImageData(200, 200);
    for (let i = 0; i < img.data.length; i += 4) { const v = 96 + Math.random() * 64; img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.92; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    korn.style.backgroundImage = `url(${c.toDataURL()})`;
  }
  const projV = new THREE.Vector3();
  function aufSchirm(v) { projV.copy(v).project(camera); return [(projV.x * 0.5 + 0.5) * W, (-projV.y * 0.5 + 0.5) * H, projV.z]; }

  // Tisch-Beschriftungen
  const schildEls = TISCHE.map((t) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tl'; b.hidden = true;
    b.innerHTML = `<b>${t.n}</b><span></span>`;
    b.addEventListener('click', () => tischWaehlen(t.n));
    schilder.appendChild(b);
    return { t, b, span: $('span', b), v: V(t.x, 0.95, t.z), zustand: '' };
  });
  const blase = document.createElement('div'); blase.className = 'blase'; blase.setAttribute('aria-live', 'polite'); schilder.appendChild(blase);
  let blasenFigur = null, blasenBis = 0, satzNr = 0;
  let toastBis = 0;
  function toastZeigen(text) {
    toastText.textContent = text;
    toast.classList.add('an');
    toastBis = performance.now() + 4200;
  }
  function tischZustand(t, p) {
    if (wahl.tisch === t.n) return 'ihr';
    if (t.art === 'frei') return 'frei';
    if (t.art === 'bald') return p >= 0.875 ? 'frei' : 'bald';
    return 'besetzt';
  }
  function waehlbar(t, p) { return t.art === 'frei' || (t.art === 'bald' && p >= 0.785); }
  function tischWaehlen(n) {
    const t = TISCHE.find((x) => x.n === n);
    if (!t || !waehlbar(t, pAkt)) return;
    wahl.setzen(n, 'film');
    toastZeigen(`Tisch ${n} ist für Sie vorgemerkt. Jetzt nur noch Tag und Zeit.`);
  }
  wahl.hoerer.push((n) => {
    for (const k in tischObjekte) tischObjekte[k].kontur.visible = Number(k) === n;
    schildEls.forEach((s) => { s.zustand = ''; });
  });
  let pulsUhr = 0, pulsErst = true;
  let legendeAuf = 1;
  function schilderSetzen(p, sichtbar, now) {
    legendeAuf += ((legendeVerdeckt ? 0 : 1) - legendeAuf) * 0.18;
    legende.style.opacity = (sichtbar * legendeAuf).toFixed(3);
    if (sichtbar < 0.01) { schildEls.forEach((s) => { if (!s.b.hidden) s.b.hidden = true; }); pulsErst = true; return; }
    for (const s of schildEls) {
      if (s.b.hidden) s.b.hidden = false;
      const [x, y, zz] = aufSchirm(s.v);
      // hinter der Kamera oder weit ausserhalb: nicht zeigen (sonst schweben Schilder gespiegelt im Himmel)
      const weg = zz > 1 || x < -60 || x > W + 60 || y < -40 || y > H + 40;
      s.b.style.visibility = weg ? 'hidden' : 'visible';
      s.b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      s.b.style.opacity = sichtbar.toFixed(3);
      const z = tischZustand(s.t, p);
      const gaeste = tischObjekte[s.t.n].sitze.filter((f) => f.visible).length;
      const schluessel = z + gaeste;
      if (schluessel !== s.zustand) {
        s.zustand = schluessel;
        s.b.classList.remove('bald', 'frei', 'ihr');
        if (z !== 'besetzt') s.b.classList.add(z);
        s.span.textContent = z === 'ihr' ? 'Ihr Tisch' : z === 'frei' ? 'frei' : z === 'bald' ? 'frei ab 21.45' : `${gaeste} ${gaeste === 1 ? 'Gast' : 'Gäste'}`;
        const ok = waehlbar(s.t, p) && z !== 'besetzt';
        s.b.disabled = !ok;
        s.b.style.pointerEvents = ok ? 'auto' : 'none';
        s.b.setAttribute('aria-label', ok ? (z === 'ihr' ? `Tisch ${s.t.n}, Ihr Tisch` : `Tisch ${s.t.n} wählen, ${s.t.plaetze} Plätze`) : `Tisch ${s.t.n}, besetzt, ${gaeste} Gäste`);
      }
    }
    // Der freie Tisch pulsiert: zwei Mal, dann alle 3 s einmal
    if (!ruhig && sichtbar > 0.9) {
      const frei6 = schildEls.find((s) => s.t.n === 6);
      if (wahl.tisch !== 6 && (pulsErst || now - pulsUhr > 3000)) {
        frei6.b.classList.remove('puls', 'einmal'); void frei6.b.offsetWidth;
        frei6.b.classList.add('puls'); if (!pulsErst) frei6.b.classList.add('einmal');
        pulsUhr = now + (pulsErst ? 1200 : 0); pulsErst = false;
      }
    }
  }

  /* ---------- Videoschnitte ---------- */
  const echtX = echt.getContext('2d');
  const handyBilder = () => innerWidth < 760 || innerHeight > innerWidth;
  class Bilderreihe {
    constructor(ordner) { this.ordner = ordner; this.meta = null; this.satz = null; this.bilder = []; this.bereit = []; this.gestartet = false; this.nahSeit = 0; }
    starten() {
      if (this.gestartet) return; this.gestartet = true;
      fetch(`/hebel-vorschau/v3/beispiele/fumo/${this.ordner}/meta.json`).then((r) => r.json()).then((meta) => {
        this.meta = meta;
        this.satz = handyBilder() && meta.mobil ? meta.mobil : meta.desktop;
        const N = this.satz.anzahl;
        const reihe = [];
        for (const schritt of [8, 2, 1]) for (let i = 0; i < N; i += schritt) if (!reihe.includes(i)) reihe.push(i);
        let laufend = 0, k = 0;
        const pumpe = () => {
          while (laufend < 6 && k < reihe.length) {
            const i = reihe[k++]; laufend++;
            const im = new Image(); im.decoding = 'async';
            im.src = `/hebel-vorschau/v3/beispiele/fumo/${this.ordner}/${this.satz.praefix}${String(i + 1).padStart(4, '0')}${this.satz.endung}`;
            this.bilder[i] = im;
            const fertig = () => { laufend--; pumpe(); };
            (im.decode ? im.decode() : new Promise((r) => { im.onload = r; })).then(() => { this.bereit[i] = true; fertig(); }, fertig);
          }
        };
        pumpe();
      }).catch(() => {});
    }
    bild(t) {
      if (!this.satz) return null;
      const N = this.satz.anzahl, ziel = Math.round(clamp(t) * (N - 1));
      if (this.bereit[ziel]) return this.bilder[ziel];
      for (let d = 1; d < N; d++) { if (ziel - d >= 0 && this.bereit[ziel - d]) return this.bilder[ziel - d]; if (ziel + d < N && this.bereit[ziel + d]) return this.bilder[ziel + d]; }
      return null;
    }
  }
  const reihen = {};
  for (const s of SCHNITTE) reihen[s[2]] = new Bilderreihe(s[2]);
  reihen['video-gastraum'] = new Bilderreihe('video-gastraum');
  const NAH = 1.2 / 9; // 1.2 Bildschirmhöhen in p
  function ladenPruefen(p, now) {
    const pruef = (reihe, a, b) => {
      if (reihe.gestartet) return;
      if (p > a - NAH && p < b + 0.02) { if (!reihe.nahSeit) reihe.nahSeit = now; if (now - reihe.nahSeit > (a < 0.2 ? 0 : 250)) reihe.starten(); }
      else reihe.nahSeit = 0;
    };
    for (const s of SCHNITTE) pruef(reihen[s[2]], s[0], s[1]);
    pruef(reihen['video-gastraum'], 0.74, 0.78);
  }
  // Rauschfeld für die Rauch-Blende (256 x 256, hochskaliert)
  const RN = 256;
  const rauschFeld = new Float32Array(RN * RN);
  {
    const rr = rng(91);
    const g = new Float32Array(17 * 17); for (let i = 0; i < g.length; i++) g[i] = rr();
    const val = (x, y, s) => { const gx = (x / RN) * s, gy = (y / RN) * s, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = (i, j) => g[((iy + j) % 16) * 17 + ((ix + i) % 16)]; return lerp(lerp(a(0, 0), a(1, 0), u), lerp(a(0, 1), a(1, 1), u), v); };
    for (let y = 0; y < RN; y++) for (let x = 0; x < RN; x++) rauschFeld[y * RN + x] = val(x, y, 4) * 0.55 + val(x, y, 8) * 0.3 + val(x, y, 16) * 0.15;
    let mi = 1, ma = 0; for (const v of rauschFeld) { mi = Math.min(mi, v); ma = Math.max(ma, v); }
    for (let i = 0; i < rauschFeld.length; i++) rauschFeld[i] = (rauschFeld[i] - mi) / (ma - mi);
  }
  const maskeC = document.createElement('canvas'); maskeC.width = maskeC.height = RN;
  const saumC = document.createElement('canvas'); saumC.width = saumC.height = RN;
  const maskeX = maskeC.getContext('2d'), saumX = saumC.getContext('2d');
  const maskeD = maskeX.createImageData(RN, RN), saumD = saumX.createImageData(RN, RN);
  function rauchMaske(schwelle) {
    for (let i = 0; i < RN * RN; i++) {
      const n = rauschFeld[i];
      const a = smooth(schwelle - 0.07, schwelle + 0.07, n);
      const band = clamp(1 - Math.abs(n - schwelle) / 0.12);
      maskeD.data[i * 4 + 3] = a * 255;
      saumD.data[i * 4] = 59; saumD.data[i * 4 + 1] = 52; saumD.data[i * 4 + 2] = 47; saumD.data[i * 4 + 3] = band * 0.8 * 255;
    }
    maskeX.putImageData(maskeD, 0, 0); saumX.putImageData(saumD, 0, 0);
  }
  function bildCover(img, zoom, x0 = 0, y0 = 0, w = W, h = H) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * s, dh = ih * s;
    echtX.drawImage(img, x0 + (w - dw) / 2, y0 + (h - dh) / 2, dw, dh);
  }
  const DIAG = () => Math.hypot(W, H);
  function iris(c, r, oeffnen) {
    // Video bleibt innerhalb des Kreises, Rand 40 px weich, glühender Saum
    const g = echtX.createRadialGradient(c[0], c[1], Math.max(0, r - 40), c[0], c[1], Math.max(1, r));
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    echtX.globalCompositeOperation = 'destination-in';
    echtX.fillStyle = g; echtX.fillRect(0, 0, W, H);
    echtX.globalCompositeOperation = 'source-over';
    if (r > 2 && r < DIAG()) {
      const sg = echtX.createRadialGradient(c[0], c[1], Math.max(0, r - 38), c[0], c[1], Math.max(1, r - 2));
      sg.addColorStop(0, 'rgba(247,178,74,0)'); sg.addColorStop(0.45, 'rgba(247,178,74,.95)'); sg.addColorStop(0.8, 'rgba(226,85,43,.8)'); sg.addColorStop(1, 'rgba(226,85,43,0)');
      echtX.strokeStyle = sg; echtX.lineWidth = 18;
      echtX.beginPath(); echtX.arc(c[0], c[1], Math.max(1, r - 20), 0, Math.PI * 2); echtX.stroke();
    }
  }
  let renderWelt = true;
  let echtSichtbar = false;
  function schnitteZeichnen(p) {
    renderWelt = true;
    let aktiv = null, t = 0;
    for (const s of SCHNITTE) if (p > s[0] && p < s[1]) { aktiv = s; t = (p - s[0]) / (s[1] - s[0]); }
    const pip = p > 0.74 && p < 0.78;
    if (!aktiv && !pip) {
      if (echtSichtbar) { echtX.setTransform(1, 0, 0, 1, 0, 0); echtX.clearRect(0, 0, echt.width, echt.height); echt.style.opacity = '0'; echtSichtbar = false; }
      kiHinweis.classList.remove('an');
      return;
    }
    echtX.setTransform(echtPr, 0, 0, echtPr, 0, 0);
    echtX.globalCompositeOperation = 'source-over';
    echtX.clearRect(0, 0, W, H);
    echt.style.opacity = '1'; echtSichtbar = true;
    kiHinweis.classList.add('an');
    if (pip) { bildImBild((p - 0.74) / 0.04); return; }
    const reihe = reihen[aktiv[2]];
    const img = reihe.bild(t);
    if (!img) return;
    const zoom = 1 + 0.06 * t;
    const auf = t < 0.18, zu = t > 0.82;
    const modus = auf ? aktiv[3] : zu ? aktiv[4] : null;
    const q = auf ? t / 0.18 : zu ? (t - 0.82) / 0.18 : 1;
    const zeichneBild = () => { if (img) bildCover(img, zoom); else { echtX.fillStyle = '#0C0A09'; echtX.fillRect(0, 0, W, H); } };
    if (!modus) { zeichneBild(); renderWelt = false; return; }
    if (ruhig) {
      // Bei reduzierter Bewegung: einfache Überblendung, weiter am Scroll gekoppelt
      echtX.globalAlpha = auf ? q : 1 - q; zeichneBild(); echtX.globalAlpha = 1; return;
    }
    if (modus === 'iris') {
      const punkt = aktiv[0] < 0.2 ? KORB_PUNKT : V(FX, 0.8, FZ);
      const [cx, cy] = aufSchirm(punkt);
      const k = auf ? q : 1 - q;
      zeichneBild();
      iris([clamp(cx, 0, W), clamp(cy, 0, H)], Math.pow(k, 1.6) * DIAG() * 1.05, auf);
      return;
    }
    if (modus === 'rauch') {
      const k = auf ? q : 1 - q;
      rauchMaske(1 - k * 1.15 + 0.07);
      zeichneBild();
      echtX.imageSmoothingEnabled = true;
      echtX.globalCompositeOperation = 'destination-in'; echtX.drawImage(maskeC, 0, 0, W, H);
      echtX.globalCompositeOperation = 'source-over'; echtX.drawImage(saumC, 0, 0, W, H);
      return;
    }
    // Schwarzblende mit Licht: über 40 Prozent auf Schwarz, dann ein warmer Lichtpunkt, aus dem das Neue aufgeht
    const c = [W / 2, H / 2];
    if (q < 0.4) {
      if (!auf) zeichneBild();
      echtX.fillStyle = `rgba(12,10,9,${(q / 0.4).toFixed(3)})`; echtX.fillRect(0, 0, W, H);
    } else {
      const k = (q - 0.4) / 0.6;
      const r = Math.pow(k, 1.5) * DIAG() * 0.62;
      if (auf) {
        zeichneBild();
        const g = echtX.createRadialGradient(c[0], c[1], Math.max(0, r * 0.7), c[0], c[1], Math.max(1, r + 2));
        g.addColorStop(0, 'rgba(12,10,9,0)'); g.addColorStop(1, 'rgba(12,10,9,1)');
        echtX.fillStyle = g; echtX.fillRect(0, 0, W, H);
      } else {
        echtX.fillStyle = '#0C0A09'; echtX.fillRect(0, 0, W, H);
        const g = echtX.createRadialGradient(c[0], c[1], Math.max(0, r * 0.7), c[0], c[1], Math.max(1, r + 2));
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        echtX.globalCompositeOperation = 'destination-out'; echtX.fillStyle = g; echtX.fillRect(0, 0, W, H);
        echtX.globalCompositeOperation = 'source-over';
      }
      const blitz = Math.sin(clamp(k / 0.35) * Math.PI);
      if (blitz > 0.01) {
        const lg = echtX.createRadialGradient(c[0], c[1], 0, c[0], c[1], 60 + 220 * k);
        lg.addColorStop(0, `rgba(255,230,180,${blitz.toFixed(3)})`); lg.addColorStop(0.35, `rgba(247,178,74,${(blitz * 0.7).toFixed(3)})`); lg.addColorStop(1, 'rgba(226,85,43,0)');
        echtX.globalCompositeOperation = 'lighter'; echtX.fillStyle = lg; echtX.fillRect(0, 0, W, H); echtX.globalCompositeOperation = 'source-over';
      }
    }
  }
  // Gastraum-Video als Bild im Bild in einem Holzrahmen am Fenster der Rückwand
  function bildImBild(t) {
    const img = reihen['video-gastraum'].bild(t);
    if (!img) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of rfEcken) { const [x, y] = aufSchirm(e); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const asp = img.naturalWidth / img.naturalHeight;
    const zw = W * (hochkant ? 0.86 : 0.6), zh = zw / asp;
    const zx = (W - zw) / 2, zy = Math.max(16, H * 0.42 - zh / 2);
    const k = ruhig ? 1 : Math.sin(clamp(t) * Math.PI);
    const kk = k * k * (3 - 2 * k);
    const rx = lerp(x0, zx, kk), ry = lerp(y0, zy, kk), rw = Math.max(8, lerp(x1 - x0, zw, kk)), rh = Math.max(8, lerp(y1 - y0, zh, kk));
    const a = ruhig ? Math.sin(clamp(t) * Math.PI) : clamp(t / 0.06) * clamp((1 - t) / 0.06);
    echtX.globalAlpha = a;
    echtX.save();
    echtX.shadowColor = 'rgba(0,0,0,.55)'; echtX.shadowBlur = 34; echtX.shadowOffsetY = 14;
    echtX.fillStyle = '#4E3220'; echtX.fillRect(rx - 8, ry - 8, rw + 16, rh + 16);
    echtX.restore();
    echtX.save(); echtX.beginPath(); echtX.rect(rx, ry, rw, rh); echtX.clip();
    bildCover(img, 1 + 0.04 * t, rx, ry, rw, rh);
    echtX.restore();
    echtX.strokeStyle = 'rgba(0,0,0,.35)'; echtX.lineWidth = 1; echtX.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
    echtX.globalAlpha = 1;
  }

  /* ---------- Vordergrund-Ebene, Zeiger ---------- */
  const vorne = $('#vorne'), zweig = $('#zweig'), glasrand = $('#glasrand'), nah = $('#nahfunken');
  const nahX = nah.getContext('2d');
  const nahF = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), v: 0.04 + Math.random() * 0.08, r: 1.5 + Math.random() * 3, ph: Math.random() * 6 }));
  const paneelEls = $$('.paneel');
  let zweigFrei = 1, glasFrei = 1;
  function ueberdeckt(el) {
    const a = el.getBoundingClientRect();
    for (const pe of paneelEls) {
      const b = pe.getBoundingClientRect();
      if (b.bottom < 0 || b.top > innerHeight) continue;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 0 && h > 0 && (w * h) / (b.width * b.height) > 0.015) return true;
    }
    return false;
  }
  function vorneSetzen(p, sicht, dt, deckung) {
    vorne.style.opacity = sicht ? '1' : '0';
    if (!sicht) return;
    const hof = fenster(p, 0.03, 0.06, 0.24, 0.27) + fenster(p, 0.975, 0.99, 1.1, 1.2);
    const drin = schmalMq.matches ? 0 : fenster(p, 0.34, 0.37, 0.72, 0.75);
    // nie über dem Text: überdeckt ein Element ein Paneel, tritt es zurück
    zweigFrei += ((ueberdeckt(zweig) ? 0 : 1) - zweigFrei) * clamp(dt * 8);
    glasFrei += ((ueberdeckt(glasrand) ? 0 : 1) - glasFrei) * clamp(dt * 8);
    zweig.style.opacity = (hof * (1 - deckung) * zweigFrei).toFixed(3);
    glasrand.style.opacity = (drin * (1 - deckung) * glasFrei).toFixed(3);
    const k = ruhig ? 0 : 1.8;
    const dx = -zeiger.sx * k * 26, dy = -zeiger.sy * k * 18 + (ruhig ? 0 : tempo * -900);
    zweig.style.transform = `translate3d(${dx.toFixed(1)}px, ${(dy * 0.6).toFixed(1)}px, 0)`;
    glasrand.style.transform = `translate3d(${dx.toFixed(1)}px, ${(dy * 0.4).toFixed(1)}px, 0)`;
    // Funken, die nah an der Kamera vorbeifliegen
    const w = innerWidth, h = innerHeight, pr = 1;
    if (nah.width !== w) { nah.width = w; nah.height = h; }
    nahX.clearRect(0, 0, w, h);
    const menge = ruhig ? 0 : (fenster(p, 0.03, 0.06, 0.26, 0.29) * 0.4 + fenster(p, 0.32, 0.36, 0.76, 0.79)) * feuerKraft * (1 - deckung);
    if (menge < 0.02) return;
    const streck = Math.min(2, Math.abs(tempo) * 60);
    nahX.save();
    nahX.beginPath(); nahX.rect(14, endOben, w - 28, Math.max(0, h - endOben - 14 - (schmalMq.matches ? 56 : 64))); nahX.clip();
    nahX.globalCompositeOperation = 'lighter';
    nahX.lineCap = 'round';
    for (const f of nahF) {
      f.y -= f.v * dt * (1 + Math.abs(tempo) * 40); f.x += Math.sin(f.ph + f.y * 6) * 0.0008;
      if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); }
      const x = f.x * w + dx * 1.3, y = f.y * h;
      nahX.strokeStyle = `rgba(247,178,74,${(0.55 * menge).toFixed(3)})`;
      nahX.lineWidth = f.r * pr;
      nahX.beginPath(); nahX.moveTo(x, y); nahX.lineTo(x, y + 0.01 + f.r * 2.2 * streck); nahX.stroke();
    }
    nahX.restore();
  }
  const zeigerEl = $('#zeiger'), zeigerText = $('#zeiger-text'), zeigerBlase = $('#zeiger-blase');
  const eigenerZeiger = feinerZeiger && !ruhig;
  const zp = { x: 0, y: 0, sx: 0, sy: 0, ueber: false };
  if (eigenerZeiger) {
    canvas.addEventListener('pointerenter', () => { zp.ueber = true; html.classList.add('zeiger-an'); zeigerEl.style.opacity = '1'; });
    canvas.addEventListener('pointerleave', () => { zp.ueber = false; html.classList.remove('zeiger-an'); zeigerEl.style.opacity = '0'; });
    canvas.addEventListener('pointermove', (e) => { zp.x = e.clientX; zp.y = e.clientY; zielSuchen = true; });
  }
  const raycaster = new THREE.Raycaster(); raycaster.layers.enableAll();
  const ndc = new THREE.Vector2();
  let zielSuchen = false, trefferArt = null;
  function treffer(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const p = pAkt;
    const oben = fenster(p, 0.785, 0.80, 0.93, 0.95);
    if (!renderWelt) return null;
    if (oben > 0.5) {
      const h = raycaster.intersectObjects(tischHits, false)[0];
      if (h) { const t = TISCHE.find((x) => x.n === h.object.userData.tisch); if (waehlbar(t, p) && wahl.tisch !== t.n) return { art: 'tisch', n: t.n }; }
      return null;
    }
    const kandidaten = [];
    if (p > 0.29 && p < 0.79) kandidaten.push(feuerHit, ...feuerTeile, ...flammen);
    for (const f of figuren) if (f.visible && f !== koch1 && f !== koch2) kandidaten.push(f);
    const hs = raycaster.intersectObjects(kandidaten, true);
    for (const h of hs) {
      if (h.object === feuerHit) { if (hs.some((x) => x.object.userData.figur)) continue; return { art: 'feuer' }; }
      if (feuerTeile.includes(h.object) || flammen.includes(h.object)) return { art: 'feuer' };
      const fig = h.object.userData.figur;
      if (fig) return { art: 'gast', figur: fig };
    }
    return null;
  }
  function zeigerSetzen(dt) {
    if (!eigenerZeiger) return;
    zp.sx += (zp.x - zp.sx) * (1 - Math.exp(-dt * 18)); zp.sy += (zp.y - zp.sy) * (1 - Math.exp(-dt * 18));
    zeigerEl.style.transform = `translate3d(${zp.sx.toFixed(1)}px, ${zp.sy.toFixed(1)}px, 0)`;
    if (zielSuchen && zp.ueber) {
      zielSuchen = false;
      const h = treffer(zp.x, zp.y);
      trefferArt = h ? h.art : null;
      zeigerText.textContent = trefferArt === 'feuer' ? 'Nachlegen' : trefferArt === 'tisch' ? 'Wählen' : '';
      zeigerText.classList.toggle('an', trefferArt === 'feuer' || trefferArt === 'tisch');
      zeigerBlase.classList.toggle('an', trefferArt === 'gast');
      canvas.style.cursor = trefferArt ? 'pointer' : '';
    }
  }
  canvas.addEventListener('click', (e) => {
    const h = treffer(e.clientX, e.clientY);
    if (!h) return;
    if (h.art === 'feuer') nachlegen();
    else if (h.art === 'gast') sprechen(h.figur);
    else if (h.art === 'tisch') tischWaehlen(h.n);
  });

  // Feuer nachlegen: ein Scheit fliegt von Koch 1 ins Feuer, Flammen 1.2 s höher, Funkenstoss
  let nachlegenStart = -10, flugStart = -10;
  function nachlegen() {
    const jetzt = zeit;
    flugStart = jetzt; nachlegenStart = jetzt + (ruhig ? 0 : 0.55);
    if (!ruhig) {
      let n = 0;
      for (const f of funken) { if (n >= Math.min(60, FUNKEN_N)) break; setTimeout(() => funkeStarten(f, true), 550 + n * 6); n++; }
    }
  }
  function sprechen(fig) {
    blasenFigur = fig; blasenBis = performance.now() + 3000;
    blase.textContent = SAETZE[satzNr++ % SAETZE.length];
    blase.classList.add('an');
  }

  /* ---------- Animation ---------- */
  const kopfV = new THREE.Vector3();
  const flugA = new THREE.Vector3(), flugB = new THREE.Vector3();
  let sichtbarAnzahl = -1;
  function figurenSetzen(p) {
    const n = Math.round(interp(sitzKeys, p));
    const t1t4Weg = p >= 0.875;
    const schluessel = n * 2 + (t1t4Weg ? 1 : 0);
    if (schluessel === sichtbarAnzahl) return;
    sichtbarAnzahl = schluessel;
    let gezeigt = 0;
    for (const f of sitzplaetze) {
      const weg = t1t4Weg && (f.userData.tisch === 1 || f.userData.tisch === 4);
      const an = !weg && gezeigt < n;
      if (an) gezeigt++;
      f.visible = an;
    }
    feuerA.shadow.needsUpdate = true;
  }
  function beleben(t, p, dt) {
    const oben = fenster(p, 0.79, 0.80, 0.92, 0.95);
    if (!ruhig) {
      for (const g of figuren) {
        if (!g.visible) continue;
        const u = g.userData;
        u.kopf.rotation.y = Math.sin(t * 0.45 + u.ph) * 0.32;
        u.kopf.position.y += 0;
        // Atmen
        g.children[1].scale.y = 1 + Math.sin(t * 1.6 + u.ph) * 0.012;
        if (g === koch1 || g === koch2) continue;
        // Glas heben, in der Draufsicht stossen die Tische an
        const anstoss = oben * Math.pow(Math.max(0, Math.sin(t * 0.7 + (u.tisch || 0) * 1.7)), 6);
        const nippen = Math.pow(Math.max(0, Math.sin(t * 0.33 + u.ph)), 10);
        u.arm.rotation.x = -1.1 * Math.max(anstoss, nippen * 0.85);
      }
      // Koch 1: draussen legt er alle 2.5 s ein Scheit in den Korb, drinnen rüttelt er die Pfanne
      const k = koch1.userData;
      if (!kochDrinnen) {
        const z = (t % 2.5) / 2.5;
        k.arm.rotation.x = -1.4 * Math.sin(clamp(z / 0.5) * Math.PI);
        if (z > 0.25 && z < 0.7) {
          const f = (z - 0.25) / 0.45;
          flugA.set(-5.45, 1.25, 7.5); flugB.set(-6.3, 0.42, 7.85);
          flugScheit.position.lerpVectors(flugA, flugB, f); flugScheit.position.y += Math.sin(f * Math.PI) * 0.45;
          flugScheit.rotation.set(f * 4, 0.4, f * 2); flugScheit.visible = flugStart < 0 || t - flugStart > 1.2;
        } else if (t - flugStart > 1.2) flugScheit.visible = false;
        pfanne.position.x = 0.85;
      } else {
        k.arm.rotation.x = -0.9 + Math.sin(t * 9) * 0.12;
        pfanne.position.x = 0.85 + Math.sin(t * 9) * 0.02;
        koch2.userData.arm.rotation.x = -0.7 + Math.sin(t * 1.3) * 0.15;
      }
    } else {
      koch1.userData.arm.rotation.x = kochDrinnen ? -0.9 : 0;
      koch2.userData.arm.rotation.x = -0.7;
      if (t - flugStart > 1.2 || flugStart < 0) flugScheit.visible = false;
    }
    // Scheit fliegt beim Nachlegen ins Feuer
    const fl = t - flugStart;
    if (fl >= 0 && fl < 1.2) {
      const f = ruhig ? 1 : clamp(fl / 0.55);
      koch1.updateMatrixWorld(); flugA.set(0.3, 1.3, 0.35).applyMatrix4(koch1.matrixWorld);
      flugB.set(-0.6 + (Math.sin(flugStart * 13) * 0.8), 0.95, FZ);
      flugScheit.visible = fl < 0.62 || ruhig;
      flugScheit.position.lerpVectors(flugA, flugB, f); flugScheit.position.y += Math.sin(f * Math.PI) * 0.6;
      flugScheit.rotation.set(f * 5, 1.2, f * 3);
    }
    // Flammen und Licht
    const schub = 1 + 0.6 * Math.sin(clamp((t - nachlegenStart) / 1.2) * Math.PI) * (t - nachlegenStart < 1.2 && t >= nachlegenStart ? 1 : 0);
    const flacker = ruhig ? 1 : 0.86 + 0.08 * Math.sin(t * 11.3) + 0.05 * Math.sin(t * 17.9 + 1.3) + 0.04 * (Math.random() - 0.5);
    const kraft = feuerKraft;
    feuerA.intensity = 26 * kraft * flacker * (1 + (schub - 1) * 0.8);
    feuerB.intensity = 26 * kraft * (ruhig ? 1 : (0.88 + 0.08 * Math.sin(t * 9.1 + 2.0) + 0.05 * Math.sin(t * 15.3))) * (1 + (schub - 1) * 0.8);
    flammenGruppe.visible = kraft > 0.02;
    for (const f of flammen) {
      f.rotation.y = Math.atan2(camera.position.x - f.position.x, camera.position.z - f.position.z);
      f.scale.y = Math.max(0.01, kraft * schub * (ruhig ? 1 : 1 + Math.sin(t * 7 + f.position.x * 5) * 0.08));
      f.scale.x = 0.6 + 0.4 * kraft;
    }
    flammenT.value = ruhig ? p * 20 : t;
    glutU.uKraft.value = 0.55 + 0.6 * kraft;
    for (const kf of kerzenFlammen) kf.scale.y = ruhig ? 1 : 1 + Math.sin(t * 13 + kf.parent.position.x) * 0.2;
    // Funken
    if (!ruhig) {
      const rate = 12 * kraft;
      for (const f of funken) {
        if (f.alter >= f.max) { if (kraft > 0.05 && Math.random() < rate * dt / FUNKEN_N * 6) funkeStarten(f, false); continue; }
        f.alter += dt;
      }
    }
    funken.forEach((f, i) => {
      const a = clamp(f.alter / f.max);
      const sichtbar = f.alter < f.max && kraft > 0.02;
      const w = f.w + f.alter * 2.2;
      funkenPos[i * 3] = f.x + Math.cos(w) * f.r * (1 + a);
      funkenPos[i * 3 + 1] = f.y + a * f.hoch;
      funkenPos[i * 3 + 2] = f.z + Math.sin(w) * f.r * (1 + a);
      funkenHell[i] = sichtbar ? (1 - a) * (0.6 + 0.4 * Math.sin(f.alter * 30 + i)) : 0;
    });
    funkenGeo.attributes.position.needsUpdate = true; funkenGeo.attributes.aHell.needsUpdate = true;
    funkenU.uStreck.value = ruhig ? 1 : 1 + Math.min(2, Math.abs(tempo) * 60);
    // Rauch aus dem Kamin
    if (!ruhig) {
      rauch.forEach((s) => {
        s.visible = true;   // nach einem Wechsel aus dem ruhigen Modus wieder alle Schwaden
        const a = ((t / 6) + s.userData.ph) % 1;
        s.userData.a = a;
        s.position.set(0 + a * 6 * 0.4 + s.userData.dx - zeiger.sx * 0.3 * 1.5, 11.2 + a * 4.6, -4.5);
        s.scale.setScalar(lerp(0.6, 2.4, a));
        s.material.opacity = 0.5 * (1 - a) * clamp(a / 0.08) * (0.55 + 0.45 * Math.max(kraft, 0.35));
      });
    }
    // Klirren in der Draufsicht
    let ki = 0;
    if (!ruhig && oben > 0.5) {
      for (const tn of [2, 3, 5, 7, 8]) {
        const tt = TISCHE[tn - 1];
        const st = Math.pow(Math.max(0, Math.sin(t * 0.7 + tn * 1.7)), 6);
        if (st > 0.85 && ki < klirrN) { klirrPos[ki * 3] = tt.x; klirrPos[ki * 3 + 1] = 1.6; klirrPos[ki * 3 + 2] = tt.z; ki++; }
      }
    }
    for (let i = ki; i < klirrN; i++) klirrPos[i * 3 + 1] = -20;
    klirrGeo.attributes.position.needsUpdate = true;
    klirrMat.opacity = ki ? 0.9 : 0;
  }
  function tafelBewegen(p, dt) {
    const s = smooth(0.668, 0.716, p);
    tafelZeichnen(s);
    const schreibt = p > 0.66 && p < 0.722;
    kreideHand.visible = schreibt;
    if (schreibt) {
      const ux = TAFEL.x + (kreideStelle.u - 0.5) * TAFEL.b, vy = TAFEL.y + (0.5 - kreideStelle.v) * TAFEL.h;
      kreideHand.position.set(ux + 0.02, vy, TAFEL.z + 0.06);
    }
    let si = 0;
    for (const d of staub) {
      if (!ruhig && schreibt && s > 0 && s < 1 && d.y < 0.6 && Math.random() < dt * 8) { d.x = kreideHand.position.x; d.y = kreideHand.position.y; d.z = kreideHand.position.z + 0.02; d.v = 0.2 + Math.random() * 0.3; }
      if (d.y > 0.6) { d.y -= d.v * dt; d.x += (Math.random() - 0.5) * 0.004; }
      staubPos[si++] = d.x; staubPos[si++] = d.y; staubPos[si++] = d.z;
    }
    staubGeo.attributes.position.needsUpdate = true;
  }


  /* ---------- Hauptschleife ---------- */
  let pAkt = pFilm(), zuletzt = performance.now(), zeit = 0, letzteSonneP = -1, pVor = pAkt;
  let filmSichtbar = true, bildNr = 0;
  new IntersectionObserver((e) => { filmSichtbar = e[0].isIntersecting; }, { rootMargin: '0px' }).observe(film);
  layout();
  addEventListener('resize', layout);
  let letzteUhr = '', letzteSitze = -1, letzteMarke = -1;
  function schleife(now) {
    requestAnimationFrame(schleife);
    const dt = Math.min(0.05, (now - zuletzt) / 1000); zuletzt = now;
    if (document.hidden) return;
    const zielP = pFilm();
    vorneSetzen(pAkt, filmSichtbar && zielP < 0.9999, dt, echtSichtbar && !renderWelt ? 1 : 0);
    if (!filmSichtbar) return;
    zeit += dt;
    pAkt = ruhig ? zielP : lerp(pAkt, zielP, 1 - Math.exp(-dt * 9));
    if (Math.abs(pAkt - zielP) < 0.00002) pAkt = zielP;
    const v = dt > 0 ? (pAkt - pVor) / dt : 0; pVor = pAkt;
    tempo += (v - tempo) * (1 - Math.exp(-dt * 6));
    const p = pAkt;

    heroScroll(p);
    const k = smooth(0, 0.04, p);
    if (Math.abs(k - letzteRahmenK) > 0.0005) { letzteRahmenK = k; rahmen.style.setProperty('--rahmen-top', lerp(heroUnten, endOben, k).toFixed(1) + 'px'); }
    sichtF = clamp(1 - (lerp(heroUnten, endOben, k) - endOben) / H, 0.2, 1);
    const minuten = Math.round(interp(uhrKeys, p));
    const us = Math.floor(minuten / 60) + '.' + String(minuten % 60).padStart(2, '0');
    if (us !== letzteUhr) { uhrEl.textContent = us; letzteUhr = us; }
    const sitze = Math.round(interp(sitzKeys, p));
    if (sitze !== letzteSitze) { plaetzeEl.textContent = String(sitze); letzteSitze = sitze; }
    marker.style.left = (p * 100).toFixed(3) + '%';
    let an = -1; marken.forEach((m, i) => { if (p >= m.at - 0.03) an = i; });
    if (an !== letzteMarke) { marken.forEach((m, i) => m.b.classList.toggle('an', i === an)); letzteMarke = an; }

    kochSetzen(p > 0.285);
    figurenSetzen(p);
    tageszeit(p);
    ladenPruefen(p, now);
    schnitteZeichnen(p);
    const oben = kameraSetzen(p, zeit);
    beleben(zeit, p, dt);
    tafelBewegen(p, dt);
    himmel.position.copy(camera.position);
    himmel.rotation.y = zeiger.sx * 0.3 * 0.05;

    // Schatten nur neu rechnen, wenn sich etwas ändert
    if (Math.abs(p - letzteSonneP) > 0.0008 && p < 0.37) { sonne.shadow.needsUpdate = true; letzteSonneP = p; }
    if (bildNr < 3) { sonne.shadow.needsUpdate = true; feuerA.shadow.needsUpdate = true; }
    bildNr++;

    if (renderWelt) {
      const flimmern = rt && p > 0.3 && p < 0.79 && feuerKraft > 0.1;
      if (flimmern) {
        // Maske über der Feuerstelle (4 x 2 m), auf den Bildschirm projiziert
        let x0 = 1, y0 = 1, x1 = 0, y1 = 0, hinten = false;
        for (const [ex, ey] of [[-2, 0.9], [2, 0.9], [-2, 2.9], [2, 2.9]]) {
          projV.set(ex, ey, FZ).project(camera);
          if (projV.z > 1) hinten = true;
          const ux = projV.x * 0.5 + 0.5, uy = projV.y * 0.5 + 0.5;
          x0 = Math.min(x0, ux); x1 = Math.max(x1, ux); y0 = Math.min(y0, uy); y1 = Math.max(y1, uy);
        }
        flimmerU.uRect.value.set(x0, y0, x1, y1);
        flimmerU.uKraft.value = hinten ? 0 : feuerKraft;
        renderer.setRenderTarget(rt); renderer.render(scene, camera);
        renderer.setRenderTarget(null); renderer.render(flimmerSzene, flimmerKam);
      } else renderer.render(scene, camera);
    }

    // Beschriftungen, Legende, Toast, Sprechblase
    schilderSetzen(p, fenster(p, 0.785, 0.80, 0.925, 0.94) * (renderWelt ? 1 : 0), now);
    if (toastBis && now > toastBis) { toast.classList.remove('an'); toastBis = 0; }
    if (blasenFigur) {
      if (now > blasenBis || !blasenFigur.visible) { blase.classList.remove('an'); blasenFigur = null; }
      else {
        blasenFigur.userData.kopf.getWorldPosition(kopfV); kopfV.y += 0.35;
        const [x, y] = aufSchirm(kopfV);
        blase.style.transform = `translate(${(x - 16).toFixed(1)}px, ${(y - blase.offsetHeight - 10).toFixed(1)}px)`;
      }
    }
    zeigerSetzen(dt);
  }
  requestAnimationFrame(schleife);
}
