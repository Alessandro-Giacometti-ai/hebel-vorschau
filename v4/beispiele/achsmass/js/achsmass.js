/* Achsmass Architekten (Beispielseite von Hebel), Bewegung und Verhalten.
   Klassisches Skript, defer, nach haus-geometrie.js. Nutzt die globalen gsap, ScrollTrigger,
   DrawSVGPlugin, ScrambleTextPlugin, CustomEase und Lenis aus /hebel-vorschau/v4/studio/vendor/.
   Bewegung läuft immer; die Systemeinstellung zu Bewegung wird nicht gelesen. Ruhig nur über den
   Schalter im Fuss (Klasse ruhig auf html, localStorage hebel-ruhig, Ereignis hebel-ruhig).
   Grundlage: docs/webstudio-2026-10/master-prompts/v4-03-architekt.md */
(function () {
  'use strict';

  var html = document.documentElement;
  var A = window.Achsmass;

  function alleTexteZeigen() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-erscheinen]'), function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  if (!window.gsap || !window.ScrollTrigger || !window.DrawSVGPlugin || !window.ScrambleTextPlugin || !window.CustomEase || !A) {
    /* Ohne Bibliotheken: Inhalt zeigen, Zeichnungen fertig und still, Menü am Handy bedienbar. */
    html.classList.remove('js');
    if (A) statischZeichnen();
    notMenue();
    return;
  }

  gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, ScrambleTextPlugin, CustomEase);
  CustomEase.create('snap', '0.5,0,0,1');
  CustomEase.create('zeichnen', '0.65,0,0.35,1');
  /* Prompt: 0.2,0.9,0.25,1.04. Damit überschwingt das Dach nur 0.8 px (Spitze 1.006) und das
     verlangte Nachfedern ist unter dem Scrub nicht zu sehen. 1.15 ergibt rund 6 px am Desktop und
     3 px am Handy (Spitze 1.041). Abweichung im Fix-Bericht gemeldet. */
  CustomEase.create('aufsetzen', '0.2,0.9,0.25,1.15');

  var ruhig = html.classList.contains('ruhig');
  var handyMQ = window.matchMedia('(max-width: 767px)');
  var hoverMQ = window.matchMedia('(hover: hover)');
  var ZIFFERN = '0123456789.';
  var TITEL = ['Der Plan', 'Die Wände', 'Die Decke', 'Das Obergeschoss', 'Das Dach', 'Licht an'];

  function istHandy() { return handyMQ.matches; }
  function alle(sel, wurzel) { return Array.prototype.slice.call((wurzel || document).querySelectorAll(sel)); }
  function els(teile) { return teile.map(function (t) { return t.el; }); }

  /* ---------- Massstab der Zeichnungen (--skala = Bildschirm-Pixel pro Einheit) ---------- */

  function massstab(svg, breite, hoehe) {
    var r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return 1;
    return Math.min(r.width / breite, r.height / hoehe);
  }

  /* svg._skala hält denselben Wert für die Ebenen (Versatz in Bildschirm-Pixeln, Gruppen in Einheiten). */
  function skalaSetzen(svg) {
    var vb = svg.viewBox && svg.viewBox.baseVal;
    if (!vb || !vb.width) return;
    var r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    svg._skala = Math.min(r.width / vb.width, r.height / vb.height);
    svg.style.setProperty('--skala', svg._skala.toFixed(4));
  }

  var skalaBeobachter = 'ResizeObserver' in window ? new ResizeObserver(function (eintraege) {
    eintraege.forEach(function (e) { skalaSetzen(e.target); });
  }) : null;

  function anmelden(svg, sk) {
    svg._skala = sk;
    svg.style.setProperty('--skala', sk.toFixed(4));
    if (skalaBeobachter) skalaBeobachter.observe(svg);
  }

  /* ---------- Striche nach Länge: Überlappung 0.25, Mindestdauer ---------- */

  function strichFolge(tl, teile, start, fenster, minDauer, ease) {
    var n = teile.length;
    if (!n) return;
    var summe = 0;
    teile.forEach(function (t) { summe += t.l; });
    var anteil = teile.map(function (t) { return t.l / summe; });
    var minD = Math.min(minDauer, fenster / (0.75 * (n - 1) + 1));
    function spanne(f) {
      var s = 0;
      anteil.forEach(function (a, i) {
        var d = Math.max(minD, a * f);
        s += i < n - 1 ? 0.75 * d : d;
      });
      return s;
    }
    var lo = 0, hi = fenster * 4 + 1;
    for (var k = 0; k < 48; k++) {
      var mitte = (lo + hi) / 2;
      if (spanne(mitte) > fenster) hi = mitte; else lo = mitte;
    }
    var pos = start;
    teile.forEach(function (t, i) {
      var d = Math.max(minD, anteil[i] * lo);
      tl.fromTo(t.el, { drawSVG: '0%' }, { drawSVG: '100%', duration: d, ease: ease }, pos);
      pos += 0.75 * d;
    });
  }

  /* Masszahl: Zufallsziffern, im ruhigen Modus steht sie fertig und blendet nur ein. */
  function zahl(tl, el, text, pos, dauer) {
    if (ruhig) {
      el.textContent = text;
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: Math.min(dauer, 0.2), ease: 'none' }, pos);
    } else {
      el.textContent = '';
      tl.to(el, { duration: dauer, scrambleText: { text: text, chars: ZIFFERN, speed: 1 }, ease: 'none' }, pos);
    }
  }

  /* Masskette: Endstriche aus der Mitte, Linie wächst, Schrägstriche zu, Zahl zuletzt. */
  var PROFIL_EINSTIEG = { enden: [0, 0.15], linie: [0.075, 0.375], schraeg: [0.375, 0.125], zahl: [0.375, 0.625] };
  var PROFIL_BUEHNE = { enden: [0, 0.2], linie: [0.1, 0.5], schraeg: [0.6, 0.15], zahl: [0.75, 0.25] };

  function masskette(tl, m, start, dauer, p, ease) {
    tl.fromTo(els(m.enden), { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: p.enden[1] * dauer, ease: ease }, start + p.enden[0] * dauer);
    tl.fromTo(m.linie.el, { drawSVG: '0%' }, { drawSVG: '100%', duration: p.linie[1] * dauer, ease: ease }, start + p.linie[0] * dauer);
    tl.fromTo(els(m.schraeg), { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: p.schraeg[1] * dauer, ease: ease }, start + p.schraeg[0] * dauer);
    zahl(tl, m.zahl, m.text, start + p.zahl[0] * dauer, p.zahl[1] * dauer);
  }

  /* Türen: Blatt und Bogen als zwei Folgen nebeneinander, damit kein Strich unter die Mindestdauer fällt. */
  function tuerFolge(tl, teile, start, fenster, minDauer, ease) {
    var blaetter = teile.filter(function (t, i) { return i % 2 === 0; });
    var boegen = teile.filter(function (t, i) { return i % 2 === 1; });
    strichFolge(tl, blaetter, start, fenster * 0.75, minDauer, ease);
    strichFolge(tl, boegen, start + fenster * 0.18, fenster * 0.82, minDauer, ease);
  }

  function hilfslinienWachsen(tl, linien, pos, dauer, ease) {
    linien.forEach(function (r) {
      tl.fromTo(r.el, { attr: { x2: r.x1, y2: r.y1 } }, { attr: { x2: r.x2, y2: r.y2 }, duration: dauer, ease: ease }, pos);
    });
  }

  /* ---------- Lenis ---------- */

  var lenis = null;
  function lenisStart() {
    if (lenis || !window.Lenis) return;
    lenis = new Lenis({
      duration: 1.2,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      wheelMultiplier: 0.85,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false
    });
    lenis.on('scroll', ScrollTrigger.update);
  }
  function lenisStopp() {
    if (!lenis) return;
    lenis.destroy();
    lenis = null;
  }
  gsap.ticker.add(function (zeit) { if (lenis) lenis.raf(zeit * 1000); });
  gsap.ticker.lagSmoothing(0);

  /* ---------- 4.9 Ebenen: Zeiger und Scroll-Tempo, eine gemeinsame Aktualisierung im gsap.ticker ----------
     Zwei Felder (Einstiegsplan, Bühne) mit je drei Ebenen. Zeiger nur bei (pointer: fine) und nicht am
     Handy, normiert -1 bis 1; Versatz hinten 2, Mitte 4, vorn 9 px, Feder Dämpfung 1.0 und Antwort
     0.6 s, Zeiger weg in 0.8 s zurück. Die vordere Ebene hinkt beim schnellen Scrollen nach:
     y = clamp(lenis.velocity × 0.6, ±8) (Handy ±6), Feder Dämpfung 0.9, Antwort 0.45 s.
     Bewegt wird nur transform. Im ruhigen Modus steht alles still. */

  var feinMQ = window.matchMedia('(pointer: fine)');
  var VERSATZ = { hinten: 2, mitte: 4, vorn: 9 };
  var EBENEN = ['hinten', 'mitte', 'vorn'];

  function feder(antwort, daempfung) {
    var w = 2 * Math.PI / antwort;
    return { k: w * w, c: 2 * daempfung * w };
  }
  var FEDER_ZEIGER = feder(0.6, 1.0), FEDER_ZURUECK = feder(0.8, 1.0), FEDER_TEMPO = feder(0.45, 0.9);

  function federSchritt(z, ziel, f, dt) {
    z.v += (-f.k * (z.x - ziel) - f.c * z.v) * dt;
    z.x += z.v * dt;
  }
  function klemmen(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var tempo = { x: 0, v: 0 };
  var felder = [];

  function feldAnlegen(flaeche, html) {
    var f = {
      flaeche: flaeche, svg: null, gruppen: null, html: html,
      innen: false, zx: 0, zy: 0, px: { x: 0, v: 0 }, py: { x: 0, v: 0 }, alt: {}
    };
    if (flaeche) {
      flaeche.addEventListener('pointermove', function (e) {
        if (ruhig || !feinMQ.matches || istHandy() || e.pointerType === 'touch') return;
        var r = flaeche.getBoundingClientRect();
        if (!r.width || !r.height) return;
        f.zx = klemmen((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
        f.zy = klemmen((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
        f.innen = true;
      });
      flaeche.addEventListener('pointerleave', function () { f.innen = false; });
    }
    felder.push(f);
    return f;
  }

  /* Nach jedem Neubau einer Zeichnung die neuen Gruppen übernehmen. */
  function ebenenAnmelden(f, svg, gruppen) {
    if (!f) return;
    f.svg = svg;
    f.gruppen = gruppen;
    f.alt = {};
  }

  function ebeneSetzen(f, name, dx, dy) {
    if (Math.abs(dx) < 0.05) dx = 0;
    if (Math.abs(dy) < 0.05) dy = 0;
    var sk = (f.svg && f.svg._skala) || 1;
    var a = f.alt[name];
    if (a && Math.abs(a[0] - dx) < 0.02 && Math.abs(a[1] - dy) < 0.02 && a[2] === sk) return;
    f.alt[name] = [dx, dy, sk];
    var still = !dx && !dy;
    var g = f.gruppen && f.gruppen[name];
    if (g) {
      if (still) g.removeAttribute('transform');
      else g.setAttribute('transform', 'translate(' + (dx / sk).toFixed(2) + ' ' + (dy / sk).toFixed(2) + ')');
    }
    (f.html[name] || []).forEach(function (el) {
      el.style.transform = still ? '' : 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)';
    });
  }

  function ebenenTakt(zeit, dtMs) {
    var dt = Math.min(0.05, (dtMs || 16.7) / 1000);
    var ziel = 0;
    if (!ruhig && lenis) {
      var grenze = istHandy() ? 6 : 8;
      ziel = klemmen((lenis.velocity || 0) * 0.6, -grenze, grenze);
    }
    federSchritt(tempo, ziel, FEDER_TEMPO, dt);
    felder.forEach(function (f) {
      var an = f.innen && !ruhig;
      var fe = an ? FEDER_ZEIGER : FEDER_ZURUECK;
      federSchritt(f.px, an ? f.zx : 0, fe, dt);
      federSchritt(f.py, an ? f.zy : 0, fe, dt);
      EBENEN.forEach(function (n) {
        ebeneSetzen(f, n, -VERSATZ[n] * f.px.x, -VERSATZ[n] * f.py.x + (n === 'vorn' ? tempo.x : 0));
      });
    });
  }

  /* Ruhig: sofort in die Mitte, ohne Feder. */
  function ebenenRuhen() {
    tempo.x = tempo.v = 0;
    felder.forEach(function (f) {
      f.innen = false;
      f.px.x = f.px.v = f.py.x = f.py.v = 0;
      EBENEN.forEach(function (n) { ebeneSetzen(f, n, 0, 0); });
    });
  }

  var einstiegFeld = feldAnlegen(document.querySelector('.einstieg-plan'), {
    hinten: alle('.h1-hilfen'),
    mitte: [],
    vorn: alle('.plan-massstab, .h1-mass')
  });
  var buehneFeld = feldAnlegen(document.querySelector('#strich-zum-haus .buehne'), {
    hinten: [],
    mitte: [],
    vorn: alle('.buehne-zaehler, .buehne-massstab')
  });
  gsap.ticker.add(ebenenTakt);

  /* ---------- 4.2 Einstieg: Grundriss zeichnet sich beim Laden (Zeit, nicht Scroll) ---------- */

  var einstieg = { tl: null };

  function bauEinstieg(sofort) {
    var svg = document.getElementById('plan-einstieg');
    if (!svg) return;
    if (einstieg.tl) einstieg.tl.kill();
    var B = 1000, H = 750;
    var sk = massstab(svg, B, H);
    var t = A.baueHaus(svg, { modus: 'einstieg', breite: B, hoehe: H, handy: istHandy(), px: 1 / sk });
    anmelden(svg, sk);
    ebenenAnmelden(einstiegFeld, svg, t.ebenen);
    var schild = document.querySelector('.plan-massstab');
    var tl = gsap.timeline({ paused: true });
    hilfslinienWachsen(tl, t.raster, 0, 0.4, 'zeichnen');
    strichFolge(tl, t.aussen, 0.3, 1.0, 0.06, 'zeichnen');
    strichFolge(tl, t.innen, 1.1, 0.8, 0.06, 'zeichnen');
    tuerFolge(tl, t.tueren, 1.8, 0.5, 0.06, 'zeichnen');
    t.masse.forEach(function (m) { masskette(tl, m, 1.8, 0.8, PROFIL_EINSTIEG, 'zeichnen'); });
    t.raeume.forEach(function (r, i) {
      var p = 1.8 + i * 0.06;
      tl.fromTo(r.el, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'zeichnen' }, p);
      zahl(tl, r.zahl, r.text, p, 0.5);
    });
    if (schild) tl.fromTo(schild, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'zeichnen' }, 2.4);
    einstieg.tl = tl;
    if (ruhig || sofort) tl.progress(1); else tl.play(0);
  }

  /* ---------- 4.9 Text zwischen den Ebenen: Masskette über der H1, Hilfslinien dahinter ----------
     Hinten zwei Hilfslinien über die ganze Spaltenbreite auf Grundlinie und Oberlänge der ersten Zeile,
     vorn eine Masskette 10 px über der ersten Zeile mit der Breite der Zeile in Metern
     (px × 0.0132, zwei Nachkommastellen, " m"). Die H1 selbst steht sofort. Beim Laden:
     Hilfslinien 0 bis 400 ms, Masskette 400 bis 1000 ms, Zahl 1000 bis 1400 ms. */

  var h1m = { teile: null, tl: null };

  function h1Bauen() {
    var feld = document.querySelector('.h1-feld');
    var h1 = feld && feld.querySelector('h1');
    var hinten = feld && feld.querySelector('.h1-hilfen');
    var vorn = feld && feld.querySelector('.h1-mass');
    if (!h1 || !hinten || !vorn) return false;
    var NS = 'http://www.w3.org/2000/svg';
    var text = null;
    for (var i = 0; i < h1.childNodes.length; i++) {
      if (h1.childNodes[i].nodeType === 3 && /\S/.test(h1.childNodes[i].data)) { text = h1.childNodes[i]; break; }
    }
    if (!text) return false;
    /* Leere Inline-Box ohne Inhalt: ihre Unterkante liegt auf der Grundlinie der ersten Zeile. */
    var grund = document.createElement('span');
    grund.className = 'h1-grund';
    grund.setAttribute('aria-hidden', 'true');
    h1.insertBefore(grund, text);
    var svgV = vorn.querySelector('svg');
    function pfad(eltern, klasse) { var p = document.createElementNS(NS, 'path'); p.setAttribute('class', klasse); eltern.appendChild(p); return p; }
    function linie(eltern) {
      var l = document.createElementNS(NS, 'line');
      /* Startwerte setzen, damit die Linie nie ein leeres Attribut trägt. */
      ['x1', 'y1', 'x2', 'y2'].forEach(function (a) { l.setAttribute(a, '0'); });
      eltern.appendChild(l);
      return l;
    }
    h1m.teile = {
      feld: feld, h1: h1, text: text, grund: grund,
      hilfen: [linie(hinten), linie(hinten)],
      enden: [pfad(svgV, 'h1-ende'), pfad(svgV, 'h1-ende')],
      linie: pfad(svgV, 'h1-linie'),
      zahl: vorn.querySelector('.h1-mass-zahl'),
      wert: ''
    };
    return true;
  }

  var h1Leinwand = null;
  function h1Messen() {
    var t = h1m.teile;
    if (!t) return false;
    var fr = t.feld.getBoundingClientRect();
    if (!fr.width) return false;
    /* Erste Zeile: alle Zeichen, die auf der Höhe des ersten Zeichens stehen. */
    var r = document.createRange(), n = t.text.data.length, oben0 = null, x0 = Infinity, x1 = -Infinity, ende = 0;
    for (var i = 0; i < n; i++) {
      r.setStart(t.text, i);
      r.setEnd(t.text, i + 1);
      var b = r.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      if (oben0 === null) oben0 = b.top;
      if (Math.abs(b.top - oben0) > 2) break;
      if (/\s/.test(t.text.data.charAt(i))) continue;
      x0 = Math.min(x0, b.left);
      x1 = Math.max(x1, b.right);
      ende = i + 1;
    }
    if (!(x1 > x0)) return false;
    var stil = getComputedStyle(t.h1);
    var F = parseFloat(stil.fontSize) || 40;
    var grundlinie = t.grund.getBoundingClientRect().top - fr.top;
    /* Oberlänge und höchster Punkt der ersten Zeile aus der Schrift selbst; sonst Werte von
       Familjen Grotesk (Oberlänge 800 von 1200, Umlaut 1000 von 1200). */
    var zeile = t.text.data.slice(0, ende);
    var ober = 0.667 * F, top = /[ÄÖÜ]/.test(zeile) ? 0.833 * F : ober;
    try {
      h1Leinwand = h1Leinwand || document.createElement('canvas').getContext('2d');
      h1Leinwand.font = stil.fontWeight + ' ' + F + 'px ' + stil.fontFamily;
      var mo = h1Leinwand.measureText('bdhkl'), mz = h1Leinwand.measureText(zeile);
      if (mo.actualBoundingBoxAscent > 0) {
        ober = mo.actualBoundingBoxAscent;
        top = Math.max(ober, mz.actualBoundingBoxAscent || 0);
      }
    } catch (e) { /* Werte der Schrift bleiben */ }
    var W = fr.width;
    var xa = x0 - fr.left, xb = x1 - fr.left;
    var g = {
      W: W, xa: xa, xb: xb,
      yb: Math.round(grundlinie) + 0.5,
      yo: Math.round(grundlinie - ober) + 0.5,
      ym: Math.round((grundlinie - top - 10) * 2) / 2,
      wert: ((xb - xa) * 0.0132).toFixed(2) + ' m'
    };
    g.schluessel = [Math.round(W), xa.toFixed(1), xb.toFixed(1), g.yb, g.yo, g.ym].join(' ');
    t.g = g;
    return true;
  }

  /* Lage setzen; die Länge der Hilfslinien (x2) setzt die Zeitachse oder h1Fertig. */
  function h1Anwenden() {
    var t = h1m.teile, g = t.g;
    t.hilfen[0].setAttribute('x1', 0); t.hilfen[0].setAttribute('y1', g.yb); t.hilfen[0].setAttribute('y2', g.yb);
    t.hilfen[1].setAttribute('x1', 0); t.hilfen[1].setAttribute('y1', g.yo); t.hilfen[1].setAttribute('y2', g.yo);
    t.enden[0].setAttribute('d', 'M' + g.xa.toFixed(2) + ' ' + (g.ym - 5) + 'V' + (g.ym + 5));
    t.enden[1].setAttribute('d', 'M' + g.xb.toFixed(2) + ' ' + (g.ym - 5) + 'V' + (g.ym + 5));
    t.linie.setAttribute('d', 'M' + g.xa.toFixed(2) + ' ' + g.ym + 'H' + g.xb.toFixed(2));
    t.zahl.style.left = ((g.xa + g.xb) / 2).toFixed(2) + 'px';
    t.zahl.style.top = (g.ym - 19) + 'px';
    t.angewendet = g.schluessel;
  }

  function h1Fertig() {
    var t = h1m.teile;
    if (!t || !t.g) return;
    gsap.set(t.enden.concat([t.linie]), { drawSVG: '100%' });
    t.hilfen.forEach(function (l) { l.setAttribute('x2', t.g.W); });
    t.zahl.textContent = t.g.wert;
  }

  function h1Zeichnen() {
    var t = h1m.teile;
    if (!t || h1m.tl) return;
    if (!h1Messen()) return;
    h1Anwenden();
    var tl = gsap.timeline({ paused: true });
    tl.fromTo(t.hilfen, { attr: { x2: 0 } }, { attr: { x2: t.g.W }, duration: 0.4, ease: 'zeichnen' }, 0);
    tl.fromTo(t.enden, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 0.2, ease: 'zeichnen' }, 0.4);
    tl.fromTo(t.linie, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.55, ease: 'zeichnen' }, 0.45);
    zahl(tl, t.zahl, t.g.wert, 1.0, 0.4);
    h1m.tl = tl;
    if (ruhig) tl.progress(1); else tl.play(0);
  }

  /* Neu messen (Breite, Schrift): nur wenn sich die Lage geändert hat. Dann die laufende Zeichnung
     abschliessen und alles fertig an die neue Stelle setzen. */
  function h1Neu() {
    if (!h1m.tl || !h1Messen()) return;
    if (h1m.teile.g.schluessel === h1m.teile.angewendet) return;
    h1m.tl.progress(1);
    h1Anwenden();
    h1Fertig();
  }

  function h1Starten() {
    if (!h1Bauen()) return;
    /* Vor dem Messen die eigene Schrift abwarten, sonst misst die Kette die Ersatzschrift.
       Spätestens nach 900 ms wird gezeichnet; kommt die Schrift danach, wird neu gemessen. */
    var gestartet = false;
    /* Nach dem Start: neu messen, oder zeichnen, falls die erste Messung nichts ergab. */
    function neu() {
      if (!gestartet) return;
      if (h1m.tl) h1Neu(); else h1Zeichnen();
    }
    function los() {
      if (gestartet) { neu(); return; }
      gestartet = true;
      h1Zeichnen();
    }
    var bereit = (document.fonts && document.fonts.load) ?
      Promise.all([document.fonts.load('500 40px "Achsmass Grotesk"'), document.fonts.load('400 12px "Achsmass Mono"')]) :
      Promise.resolve();
    bereit.then(los, los);
    setTimeout(function () { if (!gestartet) { gestartet = true; h1Zeichnen(); } }, 900);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(neu);
    if ('ResizeObserver' in window) new ResizeObserver(neu).observe(h1m.teile.feld);
    window.addEventListener('resize', neu);
  }

  /* ---------- 4.3 Vom Strich zum Haus: eine Zeitachse auf 1 normiert, sechs Takte ---------- */

  var buehne = { tl: null, st: null, rasterTl: null, rasterSt: null, licht: null, an: false, takt: -1 };
  var schritteEl = document.querySelector('#strich-zum-haus .schritte');

  /* Desktop: Polster über dem ersten Schritt (CSS calc(56vh - 100px)). Takt 1 beginnt, wenn der erste
     Schritt die 60-Prozent-Linie erreicht; dann klebt die Bühne gerade oben (100 px + 4vh). */
  function polsterOben() {
    return schritteEl ? (parseFloat(getComputedStyle(schritteEl).paddingTop) || 0) : 0;
  }

  function zeigeTakt(i) {
    alle('.b-nr').forEach(function (n) { n.textContent = String(i + 1); });
    alle('.buehne-titel, .bz-titel').forEach(function (n) { n.textContent = TITEL[i]; });
    alle('.schritt').forEach(function (s, j) { s.classList.toggle('ist-aktiv', j === i); });
  }

  function licht(an) {
    if (!buehne.licht) return;
    if (ruhig) { buehne.licht.pause().progress(an ? 1 : 0); return; }
    if (an) buehne.licht.play(); else buehne.licht.reverse();
  }

  function fortschritt(p) {
    var takt = Math.min(5, Math.floor(p * 6 + 1e-6));
    if (takt !== buehne.takt) { buehne.takt = takt; zeigeTakt(takt); }
    var schwelle = 5 / 6 + 0.02;
    if (p > schwelle && !buehne.an) { buehne.an = true; licht(true); }
    else if (p <= schwelle && buehne.an) { buehne.an = false; licht(false); }
  }

  function bauBuehne() {
    var svg = document.getElementById('buehne-svg');
    if (!svg) return;
    if (buehne.st) buehne.st.kill();
    if (buehne.tl) buehne.tl.kill();
    if (buehne.rasterSt) buehne.rasterSt.kill();
    if (buehne.rasterTl) buehne.rasterTl.kill();
    if (buehne.licht) buehne.licht.kill();
    buehne.an = false;
    buehne.takt = -1;

    var handy = istHandy();
    var B = handy ? 800 : 1000, H = handy ? 760 : 800;
    var sk = massstab(svg, B, H);
    var t = A.baueHaus(svg, { modus: 'buehne', breite: B, hoehe: H, handy: handy, px: 1 / sk });
    anmelden(svg, sk);
    ebenenAnmelden(buehneFeld, svg, t.ebenen);

    var T = 1 / 6, MIN = 0.02 * T;
    var tl = gsap.timeline({ paused: true });

    /* Lot: Höhe = aktuelle Haushöhe aus Wänden EG, Decke, Obergeschoss und Dach. */
    var egA = { h: 0 }, egI = { h: 0 }, dk = { p: 0 }, og = { h: 0 }, dp = { p: 0 };
    var DACH_HUB = 8.14 - 5.34;
    function lot() { t.setzeLot(egA.h + 0.24 * dk.p + og.h + DACH_HUB * dp.p); }

    /* Hilfslinien (Raster) erscheinen, während die Bühne hereinscrollt: eigener Scrub, fertig bevor
       Takt 1 beginnt. So steht beim Eintritt kein leeres Feld da. */
    var rtl = gsap.timeline({ paused: true });
    hilfslinienWachsen(rtl, t.raster, 0, 1, 'none');
    buehne.rasterTl = rtl;
    buehne.rasterSt = ScrollTrigger.create({
      trigger: '#strich-zum-haus .strich-raster',
      start: 'top 90%',
      end: 'top 45%',
      scrub: 0.8,
      animation: rtl
    });

    /* Takt 1, Plan: (Hilfslinien siehe oben) Aussenwände, Innenwände, Türschwünge, Räume, Massketten */
    strichFolge(tl, t.aussen, 0.08 * T, 0.22 * T, MIN, 'none');
    strichFolge(tl, t.innen, 0.30 * T, 0.13 * T, MIN, 'none');
    tuerFolge(tl, t.tueren, 0.42 * T, 0.11 * T, MIN, 'none');
    t.raeume.forEach(function (r, i) {
      var p = 0.50 * T + i * 0.012 * T;
      tl.fromTo(r.el, { opacity: 0 }, { opacity: 1, duration: 0.05 * T, ease: 'none' }, p);
      zahl(tl, r.zahl, r.text, p, 0.05 * T);
    });
    t.masse.forEach(function (m) { masskette(tl, m, 0.52 * T, 0.18 * T, PROFIL_BUEHNE, 'none'); });

    /* Takt 2, Wände EG: h läuft von 0 auf 2.60, die Geometrie rechnet jede Fläche neu */
    tl.fromTo(egA, { h: 0 }, { h: 2.6, duration: 0.55 * T, ease: 'none', onUpdate: function () { t.setzeEGaussen(egA.h); lot(); } }, T);
    tl.fromTo(egI, { h: 0 }, { h: 2.6, duration: 0.15 * T, ease: 'none', onUpdate: function () { t.setzeEGinnen(egI.h); } }, T + 0.55 * T);
    tl.fromTo(t.raeumeGruppe, { opacity: 1 }, { opacity: 0, duration: 0.25 * T, ease: 'none' }, T + 0.15 * T);

    /* Takt 3, Decke: Umriss entlang der Wandkrone, zweite Linie 24 cm höher, Platte legt sich darüber */
    var d = t.decke, t3 = 2 * T;
    tl.fromTo(d.linie1.el, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.45 * T, ease: 'none' }, t3);
    tl.fromTo(d.linie1vorn.el, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.225 * T, ease: 'none' }, t3);
    tl.fromTo(d.linie2.el, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.45 * T, ease: 'none' }, t3 + 0.15 * T);
    tl.fromTo(dk, { p: 0 }, { p: 1, duration: 0.45 * T, ease: 'none', onUpdate: lot }, t3 + 0.15 * T);
    strichFolge(tl, d.kanten, t3 + 0.15 * T, 0.45 * T, MIN, 'none');
    tl.fromTo(d.flaechen, { opacity: 0 }, { opacity: 1, duration: 0.45 * T, ease: 'none' }, t3 + 0.15 * T);

    /* Takt 4, Obergeschoss: wie Takt 2, h von 0 auf 2.50 ab Deckenoberkante. In der freien Zeit danach
       wachsen First, Traufen und Giebel als Hilfslinien, damit sie in Takt 5 schon da sind. */
    tl.fromTo(og, { h: 0 }, { h: 2.5, duration: 0.55 * T, ease: 'none', onUpdate: function () { t.setzeOG(og.h); lot(); } }, 3 * T);
    hilfslinienWachsen(tl, t.dachHilfen.linien, 3 * T + 0.56 * T, 0.12 * T, 'none');

    /* Takt 5, Dach: senkt sich auf das Ziel der Hilfslinien und federt nach, dann Schraffur */
    var t5 = 4 * T, hub = (handy ? 80 : 140) / sk;
    tl.fromTo(t.dach.gruppe, { opacity: 0 }, { opacity: 1, duration: 0.12 * T, ease: 'none' }, t5);
    tl.fromTo(t.dach.gruppe, { y: -hub }, { y: 0, duration: 0.45 * T, ease: 'aufsetzen' }, t5);
    tl.fromTo(dp, { p: 0 }, { p: 1, duration: 0.45 * T, ease: 'aufsetzen', onUpdate: lot }, t5);
    strichFolge(tl, t.dach.schraffurVorn, t5 + 0.45 * T, 0.25 * T, MIN, 'none');

    /* Takt 6 läuft nicht im Scrub: Licht an ist zeitgesteuert (unten). */
    tl.set({}, {}, 1);
    t.setzeEGaussen(0);
    t.setzeEGinnen(0);
    t.setzeOG(0);
    t.setzeLot(0);

    /* Licht an: je Fenster Rahmen 150 ms, Glas 240 ms, 120 ms Versatz, Haustür mit Vordach zuletzt */
    var ltl = gsap.timeline({ paused: true });
    t.fenster.forEach(function (f, i) {
      var p = i * 0.12;
      ltl.fromTo(f.rahmen.el, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.15, ease: 'snap' }, p);
      f.extra.forEach(function (e) { ltl.fromTo(e.el, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.15, ease: 'snap' }, p); });
      if (f.extraFlaechen.length) ltl.fromTo(f.extraFlaechen, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'snap' }, p);
      ltl.fromTo(f.glas, { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.24, ease: 'snap' }, p + 0.15);
    });
    buehne.licht = ltl;

    tl.eventCallback('onUpdate', function () { fortschritt(tl.progress()); });
    buehne.tl = tl;
    zeigeTakt(0);
    buehne.takt = 0;

    /* Desktop: Startlinie 60 Prozent wie im Prompt, gemessen ab dem ersten Schritt (unter dem Polster),
       Ende "bottom 60%": je Takt 75svh. Die Schritttexte stehen mittig im Schritt; der aktive Text
       wandert in seinem Takt von rund 97 auf 22 Prozent der Fensterhöhe und steht in der Lesepause
       (70 bis 100 Prozent des Takts) bei 45 bis 22 Prozent.
       Handy: Die Bühne steht oben, die Schritttexte laufen im unteren Drittel durch. Damit der Text
       zum Takt sichtbar ist, liegt die Startlinie dort tiefer (92 Prozent, Abweichung, im Bericht). */
    buehne.st = ScrollTrigger.create({
      trigger: '#strich-zum-haus .schritte',
      start: handy ? 'top 92%' : function () { return 'top+=' + polsterOben() + ' 60%'; },
      end: handy ? 'bottom 92%' : 'bottom 60%',
      scrub: 0.8,
      invalidateOnRefresh: true,
      animation: tl
    });
  }

  /* ---------- Kopf: Fläche ab 24 px Scroll, aktiver Abschnitt, Menü am Handy ---------- */

  var kopf = document.getElementById('kopf');
  function kopfZustand() { if (kopf) kopf.classList.toggle('ist-gescrollt', (window.scrollY || 0) >= 24); }

  function aktivSetzen(id) {
    alle('[data-ziel]').forEach(function (a) {
      var an = a.getAttribute('data-ziel') === id;
      a.classList.toggle('ist-aktiv', an);
      if (an) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }

  function spionStarten() {
    var spion = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        aktivSetzen(['projekte', 'leistungen', 'buero', 'kontakt'].indexOf(id) >= 0 ? id : null);
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    ['start', 'strich-zum-haus', 'projekte', 'leistungen', 'buero', 'kontakt'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spion.observe(el);
    });
  }

  var menueKnopf = document.querySelector('.kopf-menue');
  var blatt = document.getElementById('menue-blatt');

  function menueAuf() {
    if (!blatt) return;
    blatt.classList.add('ist-offen');
    kopf.classList.add('menue-offen');
    menueKnopf.setAttribute('aria-expanded', 'true');
    var erster = blatt.querySelector('a');
    if (erster) erster.focus({ preventScroll: true });
  }
  function menueZu(fokusZurueck) {
    if (!blatt || !blatt.classList.contains('ist-offen')) return;
    blatt.classList.remove('ist-offen');
    kopf.classList.remove('menue-offen');
    menueKnopf.setAttribute('aria-expanded', 'false');
    if (fokusZurueck) menueKnopf.focus({ preventScroll: true });
  }

  function menueStarten() {
    if (!blatt || !menueKnopf) return;
    blatt.hidden = false;
    menueKnopf.addEventListener('click', function () {
      if (blatt.classList.contains('ist-offen')) menueZu(true); else menueAuf();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && blatt.classList.contains('ist-offen')) menueZu(true);
    });
    document.addEventListener('click', function (e) {
      if (!blatt.classList.contains('ist-offen')) return;
      if (kopf.contains(e.target)) return;
      menueZu(false);
    });
  }

  /* Anker: mit Lenis weich, sonst sofort; danach Fokus auf den Abschnitt. */
  function ankerStarten() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains('sprung')) return;
      var id = a.getAttribute('href').slice(1);
      var ziel = id ? document.getElementById(id) : null;
      if (!ziel) return;
      e.preventDefault();
      menueZu(false);
      var fokus = function () { if (ziel.hasAttribute('tabindex')) ziel.focus({ preventScroll: true }); };
      if (lenis) lenis.scrollTo(ziel, { offset: -80, onComplete: fokus });
      else { ziel.scrollIntoView({ block: 'start' }); fokus(); }
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    });
  }

  /* ---------- Erscheinen von Text: ein gemeinsamer IntersectionObserver ---------- */

  function erscheinenStarten() {
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (ruhig) gsap.set(e.target, { opacity: 1, y: 0 });
        else gsap.to(e.target, { opacity: 1, y: 0, duration: 0.42, ease: 'zeichnen' });
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
    alle('[data-erscheinen]').forEach(function (el) {
      if (el.getBoundingClientRect().bottom < 0) { gsap.set(el, { opacity: 1, y: 0 }); return; }
      io.observe(el);
    });
  }

  /* ---------- 4.4 Projekte: Minis, Filter, Projektansicht ---------- */

  function miniBauen(svg, variante, stand, B, H, anteil) {
    var sk = massstab(svg, B, H);
    var m = A.baueMini(svg, variante, stand, { breite: B, hoehe: H, anteil: anteil, px: 1 / sk });
    anmelden(svg, sk);
    return m;
  }

  function miniFertig(m) {
    gsap.set(els(m.linien), { drawSVG: '100%' });
    if (m.hilfen.length) gsap.set(m.hilfen, { opacity: 1 });
    if (m.glasSichtbar) gsap.set(m.glas, { fillOpacity: 1 });
  }

  function zeichneKarte(karte) {
    if (karte._gezeichnet || !karte._mini) return;
    karte._gezeichnet = true;
    var m = karte._mini;
    if (ruhig) { miniFertig(m); return; }
    var tl = gsap.timeline();
    if (m.hilfen.length) tl.to(m.hilfen, { opacity: 1, duration: 0.3, ease: 'zeichnen' }, 0);
    strichFolge(tl, m.linien, 0, 0.9, 0.05, 'zeichnen');
  }

  function bauKarten() {
    var karten = alle('.karte');
    karten.forEach(function (karte) {
      var svg = karte.querySelector('.mini-projekt');
      if (!svg) return;
      karte._mini = miniBauen(svg, +svg.getAttribute('data-variante'), 0, 480, 300, 0.8);
      /* Was beim Laden schon oberhalb liegt, steht fertig. */
      if (ruhig || karte._gezeichnet || karte.getBoundingClientRect().bottom < 0) { karte._gezeichnet = true; miniFertig(karte._mini); return; }
      gsap.set(els(karte._mini.linien), { drawSVG: '0%' });
      if (karte._mini.hilfen.length) gsap.set(karte._mini.hilfen, { opacity: 0 });
    });
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.3) { zeichneKarte(e.target); io.unobserve(e.target); }
      });
    }, { threshold: [0.3] });
    karten.forEach(function (k) { io.observe(k); });
  }

  function filterStarten() {
    var knoepfe = alle('.filter-knopf');
    var karten = alle('.karte');
    var status = document.getElementById('filter-status');
    var laufend = null;
    knoepfe.forEach(function (knopf) {
      knopf.addEventListener('click', function () {
        var f = knopf.getAttribute('data-filter');
        knoepfe.forEach(function (k) { k.setAttribute('aria-pressed', k === knopf ? 'true' : 'false'); });
        if (laufend) laufend.kill();
        var weg = [], dazu = [], n = 0;
        karten.forEach(function (karte) {
          var zeigen = f === 'alle' || karte.getAttribute('data-typ') === f;
          gsap.killTweensOf(karte);
          if (zeigen) { n++; if (karte.hidden) dazu.push(karte); else gsap.set(karte, { opacity: 1 }); }
          else if (!karte.hidden) weg.push(karte);
        });
        function einblenden() {
          weg.forEach(function (k) { k.hidden = true; });
          dazu.forEach(function (k) { k.hidden = false; });
          if (dazu.length) gsap.fromTo(dazu, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out' });
          ScrollTrigger.refresh();
        }
        if (weg.length) laufend = gsap.to(weg, { opacity: 0, duration: 0.2, ease: 'none', onComplete: einblenden });
        else einblenden();
        if (status) status.textContent = n + (n === 1 ? ' Projekt' : ' Projekte') + ' sichtbar.';
      });
    });
  }

  function ansichtStarten() {
    var dialog = document.getElementById('projekt-ansicht');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    var oeffner = null;
    var zu = dialog.querySelector('.ansicht-zu');
    alle('.karte-knopf').forEach(function (knopf) {
      knopf.addEventListener('click', function () {
        var karte = knopf.closest('.karte');
        oeffner = knopf;
        document.getElementById('ansicht-titel').textContent = knopf.textContent;
        document.getElementById('ansicht-daten').textContent = karte.querySelector('.karte-daten').textContent;
        document.getElementById('ansicht-satz').textContent = karte.querySelector('.karte-satz').textContent;
        if (lenis) lenis.stop();
        dialog.showModal();
        var svg = document.getElementById('ansicht-svg');
        miniFertig(miniBauen(svg, +knopf.getAttribute('data-projekt'), 0, 880, 460, 0.82));
        gsap.fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out' });
      });
    });
    zu.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', function () {
      if (lenis) lenis.start();
      if (oeffner) oeffner.focus({ preventScroll: true });
    });
  }

  /* ---------- 4.5 Leistungen: Minis im Stand der Phase ---------- */

  function zeichnePhase(phase) {
    if (phase._gezeichnet || !phase._mini) return;
    phase._gezeichnet = true;
    phase.classList.add('ist-gezeichnet');
    var m = phase._mini;
    if (ruhig) { miniFertig(m); return; }
    var tl = gsap.timeline();
    tl.to(els(m.linien), { drawSVG: '100%', duration: 0.7, ease: 'snap' }, 0);
    if (m.glasSichtbar) tl.fromTo(m.glas, { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.24, ease: 'snap' }, 0.46);
    phase._tl = tl;
  }

  function bauPhasen() {
    var phasen = alle('.phase');
    phasen.forEach(function (phase) {
      var svg = phase.querySelector('.mini-phase');
      if (!svg) return;
      phase._mini = miniBauen(svg, 0, +svg.getAttribute('data-stand'), 192, 144, 0.86);
      if (ruhig || phase._gezeichnet || phase.getBoundingClientRect().bottom < window.innerHeight / 2) {
        phase._gezeichnet = true; phase.classList.add('ist-gezeichnet'); miniFertig(phase._mini); return;
      }
      gsap.set(els(phase._mini.linien), { drawSVG: '0%' });
    });
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting) { zeichnePhase(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    phasen.forEach(function (p) {
      io.observe(p);
      /* Hover (nur mit Maus): in Zeichenrichtung aus- und sofort wieder einzeichnen */
      p.addEventListener('mouseenter', function () {
        if (!hoverMQ.matches || ruhig || !p._gezeichnet) return;
        if (p._tl && p._tl.isActive()) return;
        var l = els(p._mini.linien);
        /* Unterbrechbar: läuft das Aus- und Einzeichnen noch, vom aktuellen Stand aus fertig einzeichnen. */
        if (p._hover && p._hover.isActive()) {
          p._hover.kill();
          p._hover = gsap.to(l, { drawSVG: '0% 100%', duration: 0.4, ease: 'snap' });
          return;
        }
        var tl = gsap.timeline();
        tl.fromTo(l, { drawSVG: '0% 100%' }, { drawSVG: '100% 100%', duration: 0.4, ease: 'snap' });
        tl.fromTo(l, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.4, ease: 'snap' });
        p._hover = tl;
      });
    });
  }

  /* ---------- 4.6 Büro: eine Hilfslinie unter der H2 ---------- */

  function bueroStarten() {
    var linie = document.querySelector('.hilfslinie-halter');
    if (!linie) return;
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting) { linie.classList.add('ist-gezogen'); io.disconnect(); }
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
    io.observe(document.getElementById('buero-titel') || linie);
  }

  /* ---------- 4.7 Kontakt: drei Schritte, Prüfung, Demo-Erfolg ---------- */

  function kontaktStarten() {
    var form = document.getElementById('anfrage');
    if (!form) return;
    var schritt = 1;
    var teile = alle('.fs-teil', form);
    var fsZahl = document.getElementById('fs-zahl');
    var zurueck = document.getElementById('f-zurueck');
    var weiter = document.getElementById('f-weiter');
    var wechsel = false;

    function feld(id) { return document.getElementById(id); }
    function schrittEl(n) { return form.querySelector('.form-schritt[data-schritt="' + n + '"]'); }

    function zeigeFortschritt() {
      teile.forEach(function (t, i) {
        t.classList.toggle('ist-fertig', i < schritt - 1);
        t.classList.toggle('ist-aktiv', i === schritt - 1);
      });
      fsZahl.textContent = schritt + '/3';
      zurueck.hidden = schritt === 1;
      weiter.textContent = schritt === 3 ? 'Anfrage senden' : 'Weiter';
    }

    function ersteFrage(el) {
      var gewaehlt = el.querySelector('input[type="radio"]:checked');
      return gewaehlt || el.querySelector('input');
    }

    function zuSchritt(n) {
      if (wechsel) return;
      var alt = schrittEl(schritt), neu = schrittEl(n);
      schritt = n;
      zeigeFortschritt();
      wechsel = true;
      gsap.to(alt, {
        opacity: 0, duration: 0.12, ease: 'none',
        onComplete: function () {
          alt.hidden = true;
          gsap.set(alt, { opacity: 1 });
          neu.hidden = false;
          gsap.fromTo(neu, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' });
          var f = ersteFrage(neu);
          if (f) f.focus({ preventScroll: true });
          wechsel = false;
        }
      });
    }

    function fehler(id, text, felder) {
      var p = document.getElementById('fehler-' + id);
      if (p) p.textContent = text;
      felder.forEach(function (f) {
        if (text) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
      });
      return !text;
    }

    var TELEFON = /^\+?[0-9 ()\/.\-]{7,}$/;
    var MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function pruefen(n) {
      if (n === 1) {
        var radios = alle('input[name="art"]', form);
        var ok1 = radios.some(function (r) { return r.checked; });
        fehler('art', ok1 ? '' : 'Bitte wählen Sie eine Art.', radios);
        if (!ok1) radios[0].focus();
        return ok1;
      }
      if (n === 2) {
        var ort = feld('f-ort');
        var ok2 = fehler('ort', ort.value.trim() ? '' : 'Bitte geben Sie den Ort an.', [ort]);
        if (!ok2) ort.focus();
        return ok2;
      }
      var name = feld('f-name'), tel = feld('f-telefon'), mail = feld('f-mail');
      var okName = fehler('name', name.value.trim() ? '' : 'Bitte geben Sie Ihren Namen an.', [name]);
      var t = tel.value.trim(), m = mail.value.trim();
      var telOk = !!t && TELEFON.test(t) && t.replace(/\D/g, '').length >= 7;
      var mailOk = !!m && MAIL.test(m);
      /* Eins von beiden genügt: ein gültiger Weg reicht, auch wenn im anderen Feld etwas Falsches steht. */
      var okKontakt = telOk || mailOk;
      var falsch = [];
      if (!okKontakt) { if (!t && !m) falsch = [tel, mail]; else { if (t && !telOk) falsch.push(tel); if (m && !mailOk) falsch.push(mail); } }
      fehler('kontakt', okKontakt ? '' : 'Bitte eine Telefonnummer oder E-Mail angeben.', []);
      [tel, mail].forEach(function (f) { f.removeAttribute('aria-invalid'); });
      falsch.forEach(function (f) { f.setAttribute('aria-invalid', 'true'); });
      if (!okName) name.focus(); else if (!okKontakt) (falsch[0] || tel).focus();
      return okName && okKontakt;
    }

    function erfolg() {
      var gewaehlt = form.querySelector('input[name="art"]:checked');
      var tel = feld('f-telefon').value.trim(), mail = feld('f-mail').value.trim();
      var daten = {
        art: gewaehlt ? gewaehlt.value : '',
        ort: feld('f-ort').value.trim(),
        parzelle: feld('f-parzelle').value.trim(),
        flaeche: feld('f-flaeche').value.trim(),
        name: feld('f-name').value.trim(),
        /* Nur gültige Wege vormerken */
        telefon: TELEFON.test(tel) && tel.replace(/\D/g, '').length >= 7 ? tel : '',
        mail: MAIL.test(mail) ? mail : '',
        zeit: new Date().toISOString()
      };
      try { localStorage.setItem('achsmass-anfrage', JSON.stringify(daten)); } catch (e) { /* Demo: ohne Speicher geht es auch */ }
      form.classList.add('ist-fertig');
      var box = document.getElementById('erfolg');
      box.innerHTML = '<svg viewBox="0 0 44 44" aria-hidden="true" focusable="false"><path d="M10 23L19 32L35 13"/></svg>' +
        '<p>Demo: Ihre Anfrage ist vorgemerkt. Es wurde nichts gesendet.</p>';
      var pfad = box.querySelector('path');
      if (ruhig) gsap.set(pfad, { drawSVG: '100%' });
      else gsap.fromTo(pfad, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.4, ease: 'snap' });
      box.setAttribute('tabindex', '-1');
      box.focus({ preventScroll: true });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (wechsel) return;
      if (!pruefen(schritt)) return;
      if (schritt < 3) zuSchritt(schritt + 1); else erfolg();
    });
    zurueck.addEventListener('click', function () { if (schritt > 1) zuSchritt(schritt - 1); });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'art') fehler('art', '', alle('input[name="art"]', form));
    });
    zeigeFortschritt();
  }

  /* ---------- 4.8 Fuss: Massstabsleiste über die volle Inhaltsbreite ---------- */

  var fussMass = { gezeichnet: false, breite: 0, teile: null };

  function bauFussMassstab() {
    var svg = document.getElementById('fuss-massstab');
    if (!svg) return;
    var W = Math.round(svg.getBoundingClientRect().width);
    if (!W || W === fussMass.breite) return;
    fussMass.breite = W;
    var NS = 'http://www.w3.org/2000/svg';
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + W + ' 40');
    var x0 = 0.625, x1 = W - 0.625;
    var linie = document.createElementNS(NS, 'path');
    linie.setAttribute('d', 'M0 14H' + W);
    svg.appendChild(linie);
    var striche = [], zahlen = [];
    for (var i = 0; i <= 5; i++) {
      var x = x0 + (x1 - x0) * i / 5;
      var s = document.createElementNS(NS, 'path');
      var oben = (i === 0 || i === 1 || i === 2 || i === 5) ? 4 : 8;
      s.setAttribute('d', 'M' + x.toFixed(2) + ' 14V' + oben);
      svg.appendChild(s);
      striche.push(s);
    }
    [[0, '0', 'start'], [1, '1', 'middle'], [2, '2', 'middle'], [5, '5 m', 'end']].forEach(function (z) {
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (z[0] === 0 ? 0 : (z[0] === 5 ? W : x0 + (x1 - x0) * z[0] / 5)).toFixed(2));
      t.setAttribute('y', '34');
      t.setAttribute('text-anchor', z[2]);
      t.textContent = z[1];
      svg.appendChild(t);
      zahlen.push(t);
    });
    fussMass.teile = { linie: linie, striche: striche, zahlen: zahlen };
    if (fussMass.gezeichnet || ruhig) return;
    gsap.set([linie].concat(striche), { drawSVG: '0%' });
    gsap.set(zahlen, { opacity: 0 });
  }

  function zeichneFussMassstab() {
    if (fussMass.gezeichnet || !fussMass.teile) return;
    fussMass.gezeichnet = true;
    var t = fussMass.teile;
    if (ruhig) { gsap.set([t.linie].concat(t.striche), { drawSVG: '100%' }); gsap.set(t.zahlen, { opacity: 1 }); return; }
    var tl = gsap.timeline();
    tl.to(t.linie, { drawSVG: '100%', duration: 0.8, ease: 'zeichnen' }, 0);
    t.striche.forEach(function (s, i) { tl.to(s, { drawSVG: '100%', duration: 0.12, ease: 'snap' }, 0.8 * i / 5 * 0.9); });
    t.zahlen.forEach(function (z, i) { tl.to(z, { opacity: 1, duration: 0.12, ease: 'none' }, 0.2 + i * 0.08); });
  }

  function fussStarten() {
    bauFussMassstab();
    var svg = document.getElementById('fuss-massstab');
    if (!svg) return;
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) { if (e.isIntersecting) { zeichneFussMassstab(); io.disconnect(); } });
    }, { threshold: 0.5 });
    io.observe(svg);
    var warten = null;
    window.addEventListener('resize', function () {
      clearTimeout(warten);
      warten = setTimeout(function () {
        var war = fussMass.gezeichnet;
        bauFussMassstab();
        if (war && fussMass.teile) { gsap.set([fussMass.teile.linie].concat(fussMass.teile.striche), { drawSVG: '100%' }); gsap.set(fussMass.teile.zahlen, { opacity: 1 }); }
      }, 150);
    });
  }

  /* ---------- 4.8 Absender-Plakette: der Helfer winkt einmal bei Hover (nur Maus, ruhig still) ---------- */

  function plaketteStarten() {
    var p = document.querySelector('.plakette');
    var arm = p && p.querySelector('.helfer-arm');
    if (!arm) return;
    var welle = null;
    p.addEventListener('pointerenter', function (e) {
      if (ruhig || !feinMQ.matches || e.pointerType === 'touch') return;
      if (welle && welle.isActive()) return;
      /* Arm 0 bis 18 bis 0 Grad um die Schulter, zusammen 500 ms */
      welle = gsap.fromTo(arm, { rotation: 0 }, { rotation: 18, svgOrigin: '33.5 15', duration: 0.25, ease: 'power1.inOut', yoyo: true, repeat: 1 });
    });
  }

  /* ---------- Ruhig-Modus ---------- */

  function ruhigWechseln(neu) {
    ruhig = neu;
    if (ruhig) {
      lenisStopp();
      ebenenRuhen();
      if (h1m.tl) h1m.tl.progress(1);
      if (einstieg.tl) einstieg.tl.progress(1);
      alle('.karte').forEach(function (k) { if (k._mini) { k._gezeichnet = true; miniFertig(k._mini); } });
      alle('.phase').forEach(function (p) {
        if (!p._mini) return;
        if (p._tl) p._tl.progress(1);
        if (p._hover) p._hover.progress(1);
        p._gezeichnet = true;
        p.classList.add('ist-gezeichnet');
        miniFertig(p._mini);
      });
      zeichneFussMassstab();
      if (fussMass.teile) { gsap.set([fussMass.teile.linie].concat(fussMass.teile.striche), { drawSVG: '100%' }); gsap.set(fussMass.teile.zahlen, { opacity: 1 }); }
    } else {
      lenisStart();
    }
    /* Die Scroll-Zeichnung bleibt; sie wird nur mit der passenden Zahlenart neu aufgebaut. */
    bauBuehne();
    ScrollTrigger.refresh();
  }

  /* ---------- Ohne Bibliotheken: Menü am Handy ohne GSAP ---------- */

  function notMenue() {
    var knopf = document.querySelector('.kopf-menue');
    var b = document.getElementById('menue-blatt');
    var k = document.getElementById('kopf');
    if (!knopf || !b || !k) return;
    b.hidden = false;
    function setzen(auf) {
      b.classList.toggle('ist-offen', auf);
      k.classList.toggle('menue-offen', auf);
      knopf.setAttribute('aria-expanded', auf ? 'true' : 'false');
    }
    knopf.addEventListener('click', function () { setzen(!b.classList.contains('ist-offen')); });
    b.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) setzen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setzen(false); });
  }

  /* ---------- Ohne Bibliotheken: alles fertig gezeichnet ---------- */

  function statischZeichnen() {
    try {
      var plan = document.getElementById('plan-einstieg');
      if (plan) {
        var t = A.baueHaus(plan, { modus: 'einstieg', breite: 1000, hoehe: 750, handy: false, px: 1.45 });
        t.raeume.forEach(function (r) { r.zahl.textContent = r.text; });
        t.masse.forEach(function (m) { m.zahl.textContent = m.text; });
      }
      var b = document.getElementById('buehne-svg');
      if (b) {
        var h = A.baueHaus(b, { modus: 'buehne', breite: 1000, hoehe: 800, handy: false, px: 1.45 });
        h.setzeEGaussen(2.6); h.setzeEGinnen(2.6); h.setzeOG(2.5); h.setzeLot(8.14);
        h.raeumeGruppe.style.opacity = '0';
        h.masse.forEach(function (m) { m.zahl.textContent = m.text; });
        h.fenster.forEach(function (f) { f.glas.style.fillOpacity = '1'; });
      }
      Array.prototype.forEach.call(document.querySelectorAll('.mini-projekt'), function (s) { A.baueMini(s, +s.getAttribute('data-variante'), 0, { breite: 480, hoehe: 300, anteil: 0.8, px: 1 }); });
      Array.prototype.forEach.call(document.querySelectorAll('.mini-phase'), function (s) {
        var m = A.baueMini(s, 0, +s.getAttribute('data-stand'), { breite: 192, hoehe: 144, anteil: 0.86, px: 2 });
        if (m.glasSichtbar) m.glas.forEach(function (g) { g.style.fillOpacity = '1'; });
      });
    } catch (e) { /* still bleiben */ }
  }

  /* ---------- Start ---------- */

  function schritt(name, fn) {
    try { fn(); } catch (e) { if (window.console) console.error('Achsmass, ' + name + ':', e); }
  }

  if (!ruhig) lenisStart();
  schritt('Einstieg', function () { bauEinstieg(false); });
  schritt('Masskette H1', h1Starten);
  schritt('Bühne', bauBuehne);
  schritt('Projekte', bauKarten);
  schritt('Filter', filterStarten);
  schritt('Ansicht', ansichtStarten);
  schritt('Leistungen', bauPhasen);
  schritt('Büro', bueroStarten);
  schritt('Kontakt', kontaktStarten);
  schritt('Fuss', fussStarten);
  schritt('Plakette', plaketteStarten);
  schritt('Kopf', function () {
    kopfZustand();
    window.addEventListener('scroll', kopfZustand, { passive: true });
    spionStarten();
    menueStarten();
    ankerStarten();
  });
  schritt('Erscheinen', erscheinenStarten);

  document.addEventListener('hebel-ruhig', function (e) { schritt('Ruhig', function () { ruhigWechseln(!!e.detail); }); });

  var warAufHandy = istHandy();
  function breiteGewechselt() {
    var jetzt = istHandy();
    if (jetzt === warAufHandy) return;
    warAufHandy = jetzt;
    schritt('Umbau', function () { bauEinstieg(true); bauBuehne(); ScrollTrigger.refresh(); });
  }
  if (handyMQ.addEventListener) handyMQ.addEventListener('change', breiteGewechselt);
  else if (handyMQ.addListener) handyMQ.addListener(breiteGewechselt);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* Notbremse: Falls oben etwas scheitert, bleibt kein Text unsichtbar. */
  window.addEventListener('error', alleTexteZeigen);
})();
