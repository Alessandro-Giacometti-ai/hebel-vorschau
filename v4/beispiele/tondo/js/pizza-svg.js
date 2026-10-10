/* Pizzeria Tondo (Beispielseite von Hebel): Zeichnung der Pizza als Inline-SVG.
   Grundlage: docs/webstudio-2026-10/master-prompts/v4-02-restaurant.md, Abschnitt 5.
   Alle Masse in SVG-Einheiten, viewBox 0 0 1000 1000, Mitte 500/500. Farben nur über Klassen
   (z-...), die Klassen holen die Tokens aus css/tondo.css.

   Dieses Skript zeichnet nur. Es füllt die sechs Mini-Pizzen des Tellers und das "o" im Fuss
   sofort, weil sie still stehen. Die grosse Pizza der Bühne baut tondo.js ein, damit die
   Anfangszustände der Schichten im selben Schritt gesetzt werden und nichts aufblitzt.
   Fällt tondo.js aus, setzt dieses Skript nach 1.5 s die fertige Pizza in die Bühne.
   Klassisches Skript, vor tondo.js laden. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var MX = 500;
  var MY = 500;

  /* ---------- Werte aus Abschnitt 5 ---------- */
  var TEIG_R = 420;
  var RAND_R = 391;
  var RAND_BREITE = 58;
  var MEHL_R = 395;
  var MEHL_GROESSEN = [3, 5, 4];
  var SPIRALE = { von: 40, bis: 330, windungen: 3, breite: 29 };
  var SAUCE_R = 361;
  var MASKE_START_R = 84; /* Skala 84 / 361 = 0.233 */
  var MOZZA_FAKTOREN = [1.00, 0.88, 1.06, 0.92, 1.02, 0.86, 1.04, 0.94];
  /* Mittelpunkt x, y, Radius, Startwinkel */
  var MOZZA = [
    [430, 360, 52, -8], [610, 540, 52, 10], [400, 650, 52, -6], [560, 320, 38, 7],
    [300, 470, 38, -10], [700, 410, 38, 4], [520, 720, 38, -4], [660, 680, 38, 9],
    [480, 500, 26, -7], [340, 330, 26, 6], [250, 610, 26, -9]
  ];
  var BLATT = { laenge: 110, breite: 52, ader: 3 };
  /* Ansatzpunkt x, y und Winkel */
  var BLAETTER = [[520, 420, -20], [370, 560, 35], [640, 610, -60], [590, 300, 80], [300, 380, 10]];
  var GLANZ = { rx: 14, ry: 6 };
  var GLANZ_ORTE = [[450, 450, -30], [560, 470, 10], [420, 580, 40], [600, 380, -50], [330, 520, 0], [520, 630, 20]];
  var SCHNITT = { laenge: 840, breite: 6, winkel: [0, 45, 90, 135] };

  /* ---------- Ebenen (Abschnitt 4.7), Masse in denselben Einheiten wie die Pizza ---------- */
  var RING_R = 470;
  /* 14 lose Mehlpunkte am Rand der Pizza-Fläche: Lage als Anteil von Breite und Höhe, Radius 3 bis 6.
     Alle liegen ausserhalb des Rings r 470 (nachgerechnet für 1440, 1024, 768, 375 und 320 px). */
  var MEHL_LOSE = [
    [0.06, 0.05, 4], [0.15, 0.025, 3], [0.03, 0.17, 6], [0.93, 0.06, 5], [0.84, 0.03, 3],
    [0.975, 0.19, 4], [0.025, 0.42, 3], [0.04, 0.6, 5], [0.97, 0.48, 6], [0.955, 0.66, 3],
    [0.07, 0.93, 5], [0.18, 0.975, 3], [0.9, 0.95, 4], [0.8, 0.98, 6]
  ];
  var VORN = {
    blatt: 120,
    tomate: { r: 34, schnitt: 27 },
    schneider: { rad: 46, strich: 4, griffL: 120, griffH: 22, winkel: 20 }
  };

  /* ---------- Belag der Mini-Pizzen (Anzahl und Farben aus Abschnitt 5, Lage frei) ---------- */
  var KNOBLAUCH = [[400, 330, -20], [610, 340, 35], [700, 500, -45], [590, 660, 20], [400, 660, 55], [300, 500, -10], [500, 500, 75], [500, 230, 5]];
  var SALAMI = [[500, 230], [690, 300], [760, 500], [680, 700], [480, 780], [300, 690], [230, 480], [320, 280], [560, 460]];
  var KAESE = [[665, 405], [500, 690], [335, 405], [665, 595], [500, 310], [335, 595]];
  var SCHINKEN = [[380, 300, 20], [650, 330, -35], [700, 600, 70], [460, 700, -10], [300, 560, 50]];
  var PILZE = [[560, 250, -15], [740, 430, 30], [600, 560, -40], [420, 470, 10], [330, 380, 60], [260, 600, -25], [560, 760, 20]];
  var BURRATA_BLAETTER = [[430, 380, -40], [560, 560, 30], [300, 520, 100], [650, 350, -80]];

  /* ---------- Hilfen ---------- */
  function z(n) { return Math.round(n * 100) / 100; }
  function pt(p) { return z(p[0]) + ' ' + z(p[1]); }
  function bog(grad) { return grad * Math.PI / 180; }

  function knoten(name, attr, eltern) {
    var e = document.createElementNS(NS, name);
    if (attr) {
      for (var k in attr) {
        if (Object.prototype.hasOwnProperty.call(attr, k)) e.setAttribute(k, attr[k]);
      }
    }
    if (eltern) eltern.appendChild(e);
    return e;
  }

  /* Punkt p um den Ursprung drehen (Grad) und nach (x, y) verschieben */
  function setze(p, grad, x, y) {
    var w = bog(grad), c = Math.cos(w), s = Math.sin(w);
    return [x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c];
  }

  /* Weich verbundener Pfad durch Punkte (Catmull-Rom, als kubische Bézier-Stücke) */
  function catmullRom(punkte, geschlossen) {
    var n = punkte.length;
    var d = 'M' + pt(punkte[0]);
    var stuecke = geschlossen ? n : n - 1;
    for (var i = 0; i < stuecke; i++) {
      var p0 = punkte[geschlossen ? (i - 1 + n) % n : Math.max(i - 1, 0)];
      var p1 = punkte[i];
      var p2 = punkte[geschlossen ? (i + 1) % n : Math.min(i + 1, n - 1)];
      var p3 = punkte[geschlossen ? (i + 2) % n : Math.min(i + 2, n - 1)];
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + pt(c1) + ' ' + pt(c2) + ' ' + pt(p2);
    }
    return geschlossen ? d + 'Z' : d;
  }

  /* Klecks: 8 Punkte auf einem Kreis, Radius je Punkt mit festen Faktoren */
  function klecksPfad(x, y, r, versatz) {
    var punkte = [];
    for (var k = 0; k < 8; k++) {
      var f = MOZZA_FAKTOREN[(k + (versatz || 0)) % 8];
      var w = bog(k * 45);
      punkte.push([x + r * f * Math.cos(w), y + r * f * Math.sin(w)]);
    }
    return catmullRom(punkte, true);
  }

  /* Ellipse als Pfad, um ihre Mitte gedreht (kein transform-Attribut, damit GSAP frei ist) */
  function ellipsePfad(x, y, rx, ry, grad) {
    var w = bog(grad), dx = rx * Math.cos(w), dy = rx * Math.sin(w);
    var a = [x + dx, y + dy], b = [x - dx, y - dy];
    var bogen = ' ' + z(rx) + ' ' + z(ry) + ' ' + z(grad) + ' 0 1 ';
    return 'M' + pt(a) + 'A' + bogen + pt(b) + 'A' + bogen + pt(a) + 'Z';
  }

  /* Basilikumblatt: Spitzbogen von Ansatz (0,0) zur Spitze (110,0), Breite 52, gedreht und verschoben.
     Mit anderer Länge (vordere Ebene: 120) wächst die Breite im selben Verhältnis. */
  function blattPfade(x, y, grad, laenge) {
    var L = laenge || BLATT.laenge;
    var h = BLATT.breite * (L / BLATT.laenge) / 2 / 0.75; /* Kontrollpunkt so, dass die halbe Breite 26 ist */
    var form = [[0, 0], [L * 0.13, -h], [L * 0.58, -h], [L, 0], [L * 0.58, h], [L * 0.13, h]];
    var p = form.map(function (q) { return setze(q, grad, x, y); });
    var umriss = 'M' + pt(p[0]) + 'C' + pt(p[1]) + ' ' + pt(p[2]) + ' ' + pt(p[3]) + 'C' + pt(p[4]) + ' ' + pt(p[5]) + ' ' + pt(p[0]) + 'Z';
    var a0 = setze([L * 0.07, 0], grad, x, y), a1 = setze([L * 0.5, -3], grad, x, y), a2 = setze([L * 0.88, 0], grad, x, y);
    var ader = 'M' + pt(a0) + 'Q' + pt(a1) + ' ' + pt(a2);
    return { umriss: umriss, ader: ader };
  }

  /* Klasse zutat-blatt, nicht blatt: .blatt ist in tondo.css das Menü-Blatt (visibility:hidden,
     ab 1024 px display:none). Die alte Klasse hat die Basilikumblätter unsichtbar gemacht. */
  function blatt(eltern, x, y, grad) {
    var g = knoten('g', { 'class': 'zutat-blatt', 'data-ox': x, 'data-oy': y }, eltern);
    var p = blattPfade(x, y, grad);
    knoten('path', { 'class': 'z-blatt', d: p.umriss }, g);
    knoten('path', { 'class': 'z-ader', d: p.ader, 'stroke-width': BLATT.ader }, g);
    return g;
  }

  /* Archimedische Spirale von r 40 bis r 330 in 3 Windungen, Start bei 12 Uhr im Uhrzeigersinn */
  function spiralPfad() {
    var schritte = SPIRALE.windungen * 24; /* alle 15 Grad ein Punkt */
    var punkte = [];
    for (var i = 0; i <= schritte; i++) {
      var t = i / schritte;
      var w = t * SPIRALE.windungen * 2 * Math.PI - Math.PI / 2;
      var r = SPIRALE.von + (SPIRALE.bis - SPIRALE.von) * t;
      punkte.push([MX + r * Math.cos(w), MY + r * Math.sin(w)]);
    }
    return catmullRom(punkte, false);
  }

  /* Rand als Ring ab 12 Uhr im Uhrzeigersinn (zwei Halbbögen, damit drawSVG dort beginnt) */
  function randPfad() {
    var r = RAND_R;
    return 'M' + MX + ' ' + (MY - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + MX + ' ' + (MY + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + MX + ' ' + (MY - r) + 'Z';
  }

  /* ---------- Schichten ---------- */
  function teigSchicht(svg) {
    var g = knoten('g', { 'data-teil': 'teig-gruppe' }, svg);
    knoten('circle', { 'class': 'z-teig', cx: MX, cy: MY, r: TEIG_R, 'data-teil': 'teig', 'data-ox': MX, 'data-oy': MY }, g);
    knoten('path', { 'class': 'z-rand', d: randPfad(), 'stroke-width': RAND_BREITE, 'data-teil': 'rand' }, g);
    var mehl = knoten('g', { 'data-teil': 'mehl' }, g);
    for (var i = 0; i < 12; i++) {
      var w = bog(i * 30);
      var x = MX + MEHL_R * Math.sin(w), y = MY - MEHL_R * Math.cos(w);
      knoten('circle', { 'class': 'z-mehl', cx: z(x), cy: z(y), r: MEHL_GROESSEN[i % 3], 'data-ox': z(x), 'data-oy': z(y) }, mehl);
    }
    return g;
  }

  function sauceFlaeche(svg, mitMaske) {
    var attr = { 'class': 'z-sauce', cx: MX, cy: MY, r: SAUCE_R, 'data-teil': 'sauce-flaeche' };
    if (mitMaske) attr.mask = 'url(#sauce-maske)';
    return knoten('circle', attr, svg);
  }

  function mozzaSchicht(svg, mitSchatten) {
    var schatten = null;
    if (mitSchatten) {
      schatten = knoten('g', { 'data-teil': 'mozza-schatten' }, svg);
      MOZZA.forEach(function (m) {
        knoten('ellipse', { 'class': 'z-schatten', cx: m[0], cy: m[1], rx: z(m[2] * 1.02), ry: z(m[2] * 0.94), filter: 'url(#tondo-weich)', 'data-ox': m[0], 'data-oy': m[1] }, schatten);
      });
    }
    var stuecke = knoten('g', { 'data-teil': 'mozza' }, svg);
    MOZZA.forEach(function (m) {
      knoten('path', { 'class': 'z-mozza', d: klecksPfad(m[0], m[1], m[2], 0), 'stroke-width': 3, 'data-ox': m[0], 'data-oy': m[1], 'data-start': m[3] }, stuecke);
    });
    return stuecke;
  }

  function basilikumSchicht(svg, orte) {
    var g = knoten('g', { 'data-teil': 'basilikum' }, svg);
    (orte || BLAETTER).forEach(function (b) { blatt(g, b[0], b[1], b[2]); });
    return g;
  }

  function glanzSchicht(svg) {
    var g = knoten('g', { 'data-teil': 'glanz' }, svg);
    GLANZ_ORTE.forEach(function (o) {
      knoten('path', { 'class': 'z-oel', d: ellipsePfad(o[0], o[1], GLANZ.rx, GLANZ.ry, o[2]), 'data-ox': o[0], 'data-oy': o[1] }, g);
    });
    return g;
  }

  function schnittSchicht(svg) {
    var g = knoten('g', { 'data-teil': 'schnitt' }, svg);
    var h = SCHNITT.laenge / 2;
    SCHNITT.winkel.forEach(function (grad) {
      var w = bog(grad), dx = h * Math.cos(w), dy = h * Math.sin(w);
      knoten('path', { 'class': 'z-schnitt', d: 'M' + pt([MX - dx, MY - dy]) + 'L' + pt([MX + dx, MY + dy]), 'stroke-width': SCHNITT.breite }, g);
    });
    return g;
  }

  /* ---------- Grosse Pizza der Bühne ---------- */
  function grossePizza() {
    var svg = knoten('svg', { viewBox: '0 0 1000 1000', 'class': 'pizza', 'aria-hidden': 'true', focusable: 'false' });
    var defs = knoten('defs', null, svg);
    var weich = knoten('filter', { id: 'tondo-weich', x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
    knoten('feGaussianBlur', { stdDeviation: '6' }, weich);
    var maske = knoten('mask', { id: 'sauce-maske', maskUnits: 'userSpaceOnUse', x: '0', y: '0', width: '1000', height: '1000' }, defs);
    knoten('circle', { 'class': 'z-maske', cx: MX, cy: MY, r: SAUCE_R, 'data-teil': 'maske', 'data-ox': MX, 'data-oy': MY, 'data-start': z(MASKE_START_R / SAUCE_R) }, maske);

    teigSchicht(svg);
    var sauce = knoten('g', { 'data-teil': 'sauce' }, svg);
    sauceFlaeche(sauce, true);
    knoten('path', { 'class': 'z-sauce-strich', d: spiralPfad(), 'stroke-width': SPIRALE.breite, 'data-teil': 'spirale' }, sauce);
    mozzaSchicht(svg, true);
    basilikumSchicht(svg);
    glanzSchicht(svg);
    schnittSchicht(svg);
    return svg;
  }

  /* Fertige Pizza ohne Schnitt, verkleinert für das "o" im Fuss (und als Notbild der Bühne) */
  function fertigePizza(viewBox, klasse) {
    var svg = knoten('svg', { viewBox: viewBox || '80 80 840 840', 'class': klasse || 'pizza-fertig', 'aria-hidden': 'true', focusable: 'false' });
    teigSchicht(svg);
    sauceFlaeche(svg, false);
    mozzaSchicht(svg, false);
    basilikumSchicht(svg);
    glanzSchicht(svg);
    return svg;
  }

  /* ---------- Mini-Pizzen für den Teller ---------- */
  function miniPizza(sorte) {
    var svg = knoten('svg', { viewBox: '70 70 860 860', 'class': 'mini-pizza', 'aria-hidden': 'true', focusable: 'false' });
    teigSchicht(svg);
    if (sorte !== 'quattro') sauceFlaeche(svg, false);
    var belag = knoten('g', { 'class': 'belag', 'data-sorte': sorte }, svg);

    if (sorte === 'marinara') {
      KNOBLAUCH.forEach(function (k) {
        knoten('path', { 'class': 'z-knoblauch', d: ellipsePfad(k[0], k[1], 24, 15, k[2]) }, belag);
      });
    }
    if (sorte === 'margherita' || sorte === 'diavola' || sorte === 'quattro' || sorte === 'prosciutto') {
      mozzaSchicht(belag, false);
    }
    if (sorte === 'margherita') {
      basilikumSchicht(belag, BLAETTER.slice(0, 3));
    }
    if (sorte === 'diavola') {
      SALAMI.forEach(function (s) {
        knoten('circle', { 'class': 'z-salami', cx: s[0], cy: s[1], r: 34 }, belag);
      });
    }
    if (sorte === 'quattro') {
      KAESE.forEach(function (k, i) {
        knoten('path', { 'class': i % 2 ? 'z-kaese-b' : 'z-kaese-a', d: klecksPfad(k[0], k[1], 34, i + 2) }, belag);
      });
    }
    if (sorte === 'prosciutto') {
      SCHINKEN.forEach(function (s) {
        var band = [[-75, 0], [-28, -16], [24, 16], [75, 0]].map(function (q) { return setze(q, s[2], s[0], s[1]); });
        knoten('path', { 'class': 'z-schinken', d: catmullRom(band, false), 'stroke-width': 26 }, belag);
      });
      PILZE.forEach(function (p) {
        var hut = [[-30, 4], [30, 4]].map(function (q) { return setze(q, p[2], p[0], p[1]); });
        var stiel = [[-9, 4], [9, 4], [9, 20], [-9, 20]].map(function (q) { return setze(q, p[2], p[0], p[1]); });
        var d = 'M' + pt(hut[0]) + 'A30 30 ' + z(p[2]) + ' 0 1 ' + pt(hut[1]) + 'Z' +
          'M' + pt(stiel[0]) + 'L' + pt(stiel[1]) + 'L' + pt(stiel[2]) + 'L' + pt(stiel[3]) + 'Z';
        knoten('path', { 'class': 'z-pilz', d: d, 'stroke-width': 4 }, belag);
      });
    }
    if (sorte === 'burrata') {
      knoten('circle', { 'class': 'z-mozza', cx: MX, cy: MY, r: 90, 'stroke-width': 4 }, belag);
      for (var i = 0; i < 10; i++) {
        var aussen = i < 6;
        var w = bog(aussen ? i * 60 + 10 : (i - 6) * 90 + 45);
        var r = aussen ? 245 : 165;
        var x = MX + r * Math.cos(w), y = MY + r * Math.sin(w);
        knoten('circle', { 'class': 'z-tomate', cx: z(x), cy: z(y), r: 26, 'stroke-width': 4 }, belag);
        knoten('circle', { 'class': 'z-oel', cx: z(x - 8), cy: z(y - 9), r: 5 }, belag);
      }
      basilikumSchicht(belag, BURRATA_BLAETTER);
    }
    return svg;
  }

  /* ---------- Ebene hinten: Ring r 470 und 14 lose Mehlpunkte ----------
     Nur die Elemente; Lage und Grösse in Pixeln setzt tondo.js nach dem Mass der Bühne
     (data-r in Einheiten der Pizza, data-fx/fy als Anteil der Pizza-Fläche). */
  function hintenEbene() {
    var svg = knoten('svg', { 'class': 'ebene ebene-hinten', 'aria-hidden': 'true', focusable: 'false' });
    knoten('circle', { 'class': 'z-ring', cx: 0, cy: 0, r: 0, 'stroke-width': 2, 'data-teil': 'ring', 'data-r': RING_R }, svg);
    var mehl = knoten('g', { 'data-teil': 'mehl-lose' }, svg);
    MEHL_LOSE.forEach(function (m) {
      knoten('circle', { 'class': 'z-mehl-lose', cx: 0, cy: 0, r: 0, 'data-fx': m[0], 'data-fy': m[1], 'data-r': m[2] }, mehl);
    });
    return svg;
  }

  /* ---------- Ebene vorn: zwei lose Blätter, halbe Kirschtomate, Pizzaschneider ----------
     Jedes Teil: äussere Gruppe (Lage, Grundwinkel, Massstab; setzt tondo.js) und innere Gruppe
     vorn-dreh (Neigung durch Zeiger und Scroll-Tempo). Gezeichnet um den Nullpunkt. */
  function vornTeil(svg, name, zeichne) {
    var ort = knoten('g', { 'data-teil': name }, svg);
    var dreh = knoten('g', { 'class': 'vorn-dreh' }, ort);
    zeichne(dreh);
    return ort;
  }
  function losesBlatt(g) {
    var p = blattPfade(-VORN.blatt / 2, 0, 0, VORN.blatt);
    knoten('path', { 'class': 'z-blatt', d: p.umriss }, g);
    knoten('path', { 'class': 'z-ader', d: p.ader, 'stroke-width': BLATT.ader }, g);
  }
  function halbeTomate(g) {
    knoten('circle', { 'class': 'z-tomate-haut', cx: 0, cy: 0, r: VORN.tomate.r }, g);
    knoten('circle', { 'class': 'z-tomate-schnitt', cx: 0, cy: 0, r: VORN.tomate.schnitt }, g);
    [90, 210, 330].forEach(function (grad) {
      var w = bog(grad);
      knoten('path', { 'class': 'z-tomate-kammer', d: ellipsePfad(12 * Math.cos(w), 12 * Math.sin(w), 8, 5, grad) }, g);
    });
  }
  function schneider(g) {
    var s = VORN.schneider;
    /* Griff links, Rad rechts; Mitte des Ganzen im Nullpunkt (Griff -106 bis 14, Rad bis 106) */
    var radX = 14 + s.rad;
    knoten('rect', { 'class': 'z-schneider', x: 14 - s.griffL, y: -s.griffH / 2, width: s.griffL, height: s.griffH }, g);
    knoten('circle', { 'class': 'z-schneider-rad', cx: radX, cy: 0, r: s.rad, 'stroke-width': s.strich }, g);
    knoten('circle', { 'class': 'z-schneider', cx: radX, cy: 0, r: 6 }, g);
  }
  function vornEbene() {
    var svg = knoten('svg', { 'class': 'ebene ebene-vorn', 'aria-hidden': 'true', focusable: 'false' });
    vornTeil(svg, 'blatt-unten', losesBlatt);
    vornTeil(svg, 'blatt-oben', losesBlatt);
    vornTeil(svg, 'tomate', halbeTomate);
    vornTeil(svg, 'schneider', schneider);
    return svg;
  }

  /* ---------- Einsetzen ---------- */
  function minisFuellen() {
    var orte = document.querySelectorAll('.mini[data-sorte]');
    Array.prototype.forEach.call(orte, function (ort) {
      if (ort.querySelector('svg')) return;
      ort.insertBefore(miniPizza(ort.getAttribute('data-sorte')), ort.firstChild);
    });
    var o = document.getElementById('marke-o');
    if (o && !o.querySelector('svg')) o.appendChild(fertigePizza('80 80 840 840', 'pizza-o'));
  }

  window.TondoSVG = {
    grossePizza: grossePizza,
    fertigePizza: fertigePizza,
    miniPizza: miniPizza,
    hintenEbene: hintenEbene,
    vornEbene: vornEbene,
    masse: { ring: RING_R, blatt: VORN.blatt, tomate: VORN.tomate.r, schneiderWinkel: VORN.schneider.winkel }
  };

  minisFuellen();

  /* Notbild: Hat tondo.js die Bühne nach 1.5 s nicht gefüllt, steht die fertige Pizza da. */
  window.setTimeout(function () {
    var ort = document.getElementById('pizza-ort');
    if (ort && !ort.querySelector('svg')) {
      ort.insertBefore(fertigePizza('0 0 1000 1000', 'pizza'), ort.firstChild);
    }
  }, 1500);
})();
