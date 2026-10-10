/* Achsmass Architekten (Beispielseite von Hebel), Geometrie.
   Projektion, Daten von "Haus Beispiel" und der sechs Projekthäuser, Erzeugung aller SVG-Elemente.
   Klassisches Skript ohne Abhängigkeiten. Ergebnis: window.Achsmass = { projizieren, baueHaus, baueMini }.
   Masse in Metern: x nach rechts vorn, y nach links hinten, z nach oben.
   Grundlage: docs/webstudio-2026-10/master-prompts/v4-03-architekt.md, Abschnitt 5. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var COS30 = 0.8660;
  var SIN30 = 0.5000;
  var GRAD = Math.PI / 180;
  var EPS = 1e-6;

  /* ---------- Projektion: Planaxonometrie 30/60, Grundriss masstreu und nur gedreht ---------- */

  function projizieren(x, y, z, k) {
    return [k.cx + k.s * (x * COS30 - y * SIN30), k.cy - k.s * (x * SIN30 + y * COS30 + (z || 0))];
  }

  /* s, cx und cy so, dass die Punkte den Anteil der Fläche füllen (einmal aus der Endgeometrie). */
  function einpassen(punkte, breite, hoehe, anteil) {
    var umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (var i = 0; i < punkte.length; i++) {
      var p = punkte[i];
      var u = p[0] * COS30 - p[1] * SIN30;
      var v = -(p[0] * SIN30 + p[1] * COS30 + (p[2] || 0));
      if (u < umin) umin = u;
      if (u > umax) umax = u;
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
    var s = Math.min(anteil * breite / (umax - umin), anteil * hoehe / (vmax - vmin));
    return { s: s, cx: breite / 2 - s * (umin + umax) / 2, cy: hoehe / 2 - s * (vmin + vmax) / 2 };
  }

  /* ---------- Kleine Helfer ---------- */

  function r2(n) { return Math.round(n * 100) / 100; }

  function el(name, attrs, eltern) {
    var e = document.createElementNS(NS, name);
    if (attrs) {
      for (var a in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, a)) e.setAttribute(a, attrs[a]);
      }
    }
    if (eltern) eltern.appendChild(e);
    return e;
  }

  function leeren(knoten) {
    while (knoten.firstChild) knoten.removeChild(knoten.firstChild);
  }

  function pfadD(punkte, k, zu) {
    var d = '';
    for (var i = 0; i < punkte.length; i++) {
      var p = projizieren(punkte[i][0], punkte[i][1], punkte[i][2], k);
      d += (i ? 'L' : 'M') + r2(p[0]) + ' ' + r2(p[1]);
    }
    return zu ? d + 'Z' : d;
  }

  function laenge(punkte, k, zu) {
    var l = 0, n = punkte.length;
    var letzte = zu ? n : n - 1;
    for (var i = 0; i < letzte; i++) {
      var a = projizieren(punkte[i][0], punkte[i][1], punkte[i][2], k);
      var b = projizieren(punkte[(i + 1) % n][0], punkte[(i + 1) % n][1], punkte[(i + 1) % n][2], k);
      l += Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
    }
    return l;
  }

  /* Ein Strich, der sich zeichnen lässt (drawSVG): ein Pfad ohne Unterpfade. */
  function zug(punkte, k, klasse, eltern, zu) {
    var e = el('path', { d: pfadD(punkte, k, zu), 'class': klasse }, eltern);
    return { el: e, l: laenge(punkte, k, zu) };
  }

  /* Gestrichelte Hilfslinie: wächst über x2/y2, damit das Strichmuster erhalten bleibt. */
  function hilfslinie(a, b, k, klasse, eltern) {
    var p = projizieren(a[0], a[1], a[2], k);
    var q = projizieren(b[0], b[1], b[2], k);
    var e = el('line', { x1: r2(p[0]), y1: r2(p[1]), x2: r2(q[0]), y2: r2(q[1]), 'class': klasse }, eltern);
    return { el: e, x1: r2(p[0]), y1: r2(p[1]), x2: r2(q[0]), y2: r2(q[1]) };
  }

  function seg(a, b, k) { return pfadD([a, b], k, false); }

  /* Intervall [a, b] ohne Lücken. */
  function ohneLuecken(a, b, luecken) {
    var teile = [], start = a;
    luecken.slice().sort(function (p, q) { return p[0] - q[0]; }).forEach(function (l) {
      if (l[0] > start + EPS) teile.push([start, Math.min(l[0], b)]);
      start = Math.max(start, l[1]);
    });
    if (b > start + EPS) teile.push([start, b]);
    return teile;
  }

  /* ---------- Haus Beispiel (Abschnitt 5) ---------- */

  var TRAUFE = 5.34;
  var FIRST = 5.34 + 4.00 * Math.tan(35 * GRAD); /* 8.14 */

  var HAUS = {
    b: 10, t: 8,
    egOK: 2.60, deckeOK: 2.84, ogHoehe: 2.50, traufe: TRAUFE, first: FIRST,
    treppe: { x0: 3.8, x1: 4.8, y0: 2.6, y1: 5.2 },
    vordach: { x0: 3.9, x1: 5.5, y0: -1.0, y1: 0, z0: 2.40, z1: 2.52 },
    raeume: [
      { name: 'Wohnen/Essen', flaeche: '33.0', x: 3.0, y: 5.25, handy: true },
      { name: 'Küche', flaeche: '9.0', x: 1.8, y: 1.25, handy: true },
      { name: 'Eingang', flaeche: '6.0', x: 4.8, y: 1.25, handy: false },
      { name: 'Zimmer', flaeche: '17.6', x: 8.0, y: 5.8, handy: true },
      { name: 'Bad', flaeche: '8.6', x: 8.8, y: 1.8, handy: true },
      { name: 'Technik', flaeche: '5.8', x: 6.8, y: 1.8, handy: false }
    ],
    /* Türschwünge: Angel, Blatt offen bis, Bogen zur Gegenleibung. */
    tueren: [
      { angel: [4.2, 0], offen: [4.2, 1.0], zu: [5.2, 0] },
      { angel: [4.3, 2.5], offen: [4.3, 3.3], zu: [5.1, 2.5] },
      { angel: [6.0, 5.0], offen: [6.9, 5.0], zu: [6.0, 5.9] },
      { angel: [9.0, 3.6], offen: [9.0, 2.8], zu: [8.2, 3.6] }
    ]
  };

  /* Wände: achse 'x' läuft entlang x bei y = c, achse 'y' entlang y bei x = c.
     Öffnungen: a bis b entlang der Wand, z0 bis z1 absolut. Innentüren 2.20 hoch wie die Haustür. */
  var EG_WAENDE = [
    { name: 'vorn', aussen: true, achse: 'x', c: 0, a: 0, b: 10, oeff: [
      { a: 1.0, b: 2.6, z0: 1.0, z1: 2.2, art: 'fenster' },
      { a: 4.2, b: 5.2, z0: 0.0, z1: 2.2, art: 'haustuer' },
      { a: 8.4, b: 9.4, z0: 1.4, z1: 2.2, art: 'fenster' }
    ] },
    { name: 'rechts', aussen: true, achse: 'y', c: 10, a: 0, b: 8, oeff: [] },
    { name: 'hinten', aussen: true, achse: 'x', c: 8, a: 0, b: 10, oeff: [] },
    { name: 'links', aussen: true, achse: 'y', c: 0, a: 0, b: 8, oeff: [
      { a: 3.5, b: 5.5, z0: 0.0, z1: 2.3, art: 'fenstertuer' },
      { a: 6.2, b: 7.4, z0: 0.9, z1: 2.2, art: 'fenster' }
    ] },
    { name: 'kueche-eingang', aussen: false, achse: 'y', c: 3.6, a: 0, b: 2.5, oeff: [] },
    { name: 'flur', aussen: false, achse: 'x', c: 2.5, a: 0, b: 6.0, oeff: [{ a: 4.3, b: 5.1, z0: 0, z1: 2.2, art: 'tuer' }] },
    { name: 'mitte', aussen: false, achse: 'y', c: 6.0, a: 0, b: 8.0, oeff: [{ a: 5.0, b: 5.9, z0: 0, z1: 2.2, art: 'tuer' }] },
    { name: 'zimmer-bad', aussen: false, achse: 'x', c: 3.6, a: 6.0, b: 10.0, oeff: [{ a: 8.2, b: 9.0, z0: 0, z1: 2.2, art: 'tuer' }] },
    { name: 'bad-technik', aussen: false, achse: 'y', c: 7.6, a: 0, b: 3.6, oeff: [] }
  ];

  var OG_Z = 2.84;
  var OG_FENSTER_Z0 = OG_Z + 0.9, OG_FENSTER_Z1 = OG_Z + 2.1;
  var OG_WAENDE = [
    { name: 'vorn', aussen: true, achse: 'x', c: 0, a: 0, b: 10, oeff: [
      { a: 1.2, b: 2.4, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1, art: 'fenster' },
      { a: 4.8, b: 6.4, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1, art: 'fenster' },
      { a: 7.6, b: 8.8, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1, art: 'fenster' }
    ] },
    { name: 'rechts', aussen: true, achse: 'y', c: 10, a: 0, b: 8, oeff: [] },
    { name: 'hinten', aussen: true, achse: 'x', c: 8, a: 0, b: 10, oeff: [] },
    { name: 'links', aussen: true, achse: 'y', c: 0, a: 0, b: 8, oeff: [
      { a: 2.0, b: 3.2, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1, art: 'fenster' },
      { a: 5.2, b: 6.8, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1, art: 'fenster' }
    ] }
  ];

  /* Reihenfolge "Licht an": Wohnraum (EG links), Küche, Bad, Obergeschoss von links nach rechts,
     Haustür mit Vordach zuletzt. Links nach rechts auf dem Bild: Fassade x = 0 von hinten nach vorn,
     dann Fassade y = 0 von links nach rechts. */
  var LICHT = [
    { f: 'x0', a: 6.2, b: 7.4, z0: 0.9, z1: 2.2 },
    { f: 'x0', a: 3.5, b: 5.5, z0: 0.0, z1: 2.3 },
    { f: 'y0', a: 1.0, b: 2.6, z0: 1.0, z1: 2.2 },
    { f: 'y0', a: 8.4, b: 9.4, z0: 1.4, z1: 2.2 },
    { f: 'x0', a: 5.2, b: 6.8, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1 },
    { f: 'x0', a: 2.0, b: 3.2, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1 },
    { f: 'y0', a: 1.2, b: 2.4, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1 },
    { f: 'y0', a: 4.8, b: 6.4, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1 },
    { f: 'y0', a: 7.6, b: 8.8, z0: OG_FENSTER_Z0, z1: OG_FENSTER_Z1 },
    { f: 'y0', a: 4.2, b: 5.2, z0: 0.0, z1: 2.2, tuer: true }
  ];

  function wandPunkt(w, u, z) {
    return w.achse === 'x' ? [u, w.c, z] : [w.c, u, z];
  }

  function fassadenPunkt(f, u, z) {
    return f === 'y0' ? [u, 0, z] : [0, u, z];
  }

  /* Endpunkte des fertigen Hauses (mit Dach und Vordach) für die Einpassung. */
  function endpunkteHaus() {
    var p = [];
    [0, 10].forEach(function (x) {
      [0, 8].forEach(function (y) {
        p.push([x, y, 0]);
        p.push([x, y, TRAUFE]);
      });
      p.push([x, 4, FIRST]);
    });
    var v = HAUS.vordach;
    p.push([v.x0, v.y0, v.z1], [v.x1, v.y0, v.z0]);
    return p;
  }

  /* ---------- Reihenfolge der Wandflächen (von hinten nach vorn) ----------
     Grundregel: x + y der Flächenmitte, grösser zuerst, bei Gleichstand tiefer liegende zuerst.
     Wo sich zwei Wände im Bild überdecken, entscheidet zusätzlich die echte Tiefe an der
     gemeinsamen Bildstelle (sonst läge die kurze Innenwand x 3.6 vor der Fassade y 0). */

  function uBereich(w) {
    if (w.achse === 'x') return [w.a * COS30 - w.c * SIN30, w.b * COS30 - w.c * SIN30];
    return [w.c * COS30 - w.b * SIN30, w.c * COS30 - w.a * SIN30];
  }

  function tiefeBei(w, u) {
    var x, y;
    if (w.achse === 'x') { y = w.c; x = (u + y * SIN30) / COS30; }
    else { x = w.c; y = (x * COS30 - u) / SIN30; }
    return x * SIN30 + y * COS30;
  }

  function mitteXY(w) { return w.c + (w.a + w.b) / 2; }

  function sortiereWaende(liste) {
    var n = liste.length, nach = [], grad = [];
    for (var i = 0; i < n; i++) { nach.push([]); grad.push(0); }
    for (var a = 0; a < n; a++) {
      for (var b = a + 1; b < n; b++) {
        var ua = uBereich(liste[a]), ub = uBereich(liste[b]);
        var lo = Math.max(ua[0], ub[0]), hi = Math.min(ua[1], ub[1]);
        if (hi - lo < 1e-3) continue;
        var u = (lo + hi) / 2;
        var ta = tiefeBei(liste[a], u), tb = tiefeBei(liste[b], u);
        if (Math.abs(ta - tb) < 1e-6) continue;
        if (ta > tb) { nach[a].push(b); grad[b]++; } else { nach[b].push(a); grad[a]++; }
      }
    }
    var fertig = [], offen = [];
    for (var j = 0; j < n; j++) if (!grad[j]) offen.push(j);
    while (offen.length) {
      offen.sort(function (p, q) { return mitteXY(liste[q]) - mitteXY(liste[p]); });
      var nx = offen.shift();
      fertig.push(liste[nx]);
      nach[nx].forEach(function (m) { if (--grad[m] === 0) offen.push(m); });
    }
    if (fertig.length < n) {
      return liste.slice().sort(function (p, q) { return mitteXY(q) - mitteXY(p); });
    }
    return fertig;
  }

  /* ---------- Wände, die aus dem Plan wachsen ---------- */

  function wandBauen(w, z0, hMax, k, eltern) {
    var g = el('g', { 'class': 'wand', visibility: 'hidden' }, eltern);
    var we = {
      w: w, z0: z0, hMax: hMax, k: k, g: g,
      flaeche: el('path', { 'class': 'flaeche', 'fill-rule': 'evenodd' }, g),
      fuss: el('path', { 'class': 'k-schnitt kante' }, g),
      ansicht: el('path', { 'class': 'k-ansicht kante' }, g),
      krone: el('path', { 'class': 'k-schnitt kante' }, g),
      sichtbar: false
    };
    return we;
  }

  /* Neuberechnung bei jeder Aktualisierung von h (Fläche mit Löchern, Laibungen, Krone). */
  function wandSetzen(we, h) {
    var w = we.w, z0 = we.z0, k = we.k;
    if (h <= 1e-4) {
      if (we.sichtbar) { we.g.setAttribute('visibility', 'hidden'); we.sichtbar = false; }
      return;
    }
    if (!we.sichtbar) { we.g.setAttribute('visibility', 'visible'); we.sichtbar = true; }
    var top = z0 + h;
    var d = pfadD([wandPunkt(w, w.a, z0), wandPunkt(w, w.b, z0), wandPunkt(w, w.b, top), wandPunkt(w, w.a, top)], k, true);
    var ansicht = '';
    var kroneLuecken = [], fussLuecken = [];
    w.oeff.forEach(function (o) {
      if (o.z0 <= z0 + EPS) fussLuecken.push([o.a, o.b]);
      if (top > o.z0 + EPS && top < o.z1 - EPS) kroneLuecken.push([o.a, o.b]);
      if (top > o.z0 + EPS) {
        var z1 = Math.min(o.z1, top);
        d += pfadD([wandPunkt(w, o.a, o.z0), wandPunkt(w, o.b, o.z0), wandPunkt(w, o.b, z1), wandPunkt(w, o.a, z1)], k, true);
        ansicht += seg(wandPunkt(w, o.a, o.z0), wandPunkt(w, o.a, z1), k) + seg(wandPunkt(w, o.b, o.z0), wandPunkt(w, o.b, z1), k);
        if (o.z0 > z0 + EPS) ansicht += seg(wandPunkt(w, o.a, o.z0), wandPunkt(w, o.b, o.z0), k);
        if (top >= o.z1 - EPS) ansicht += seg(wandPunkt(w, o.a, o.z1), wandPunkt(w, o.b, o.z1), k);
      }
    });
    ansicht += seg(wandPunkt(w, w.a, z0), wandPunkt(w, w.a, top), k) + seg(wandPunkt(w, w.b, z0), wandPunkt(w, w.b, top), k);
    var krone = '';
    ohneLuecken(w.a, w.b, kroneLuecken).forEach(function (t) { krone += seg(wandPunkt(w, t[0], top), wandPunkt(w, t[1], top), k); });
    var fuss = '';
    ohneLuecken(w.a, w.b, fussLuecken).forEach(function (t) { fuss += seg(wandPunkt(w, t[0], z0), wandPunkt(w, t[1], z0), k); });
    we.flaeche.setAttribute('d', d);
    we.ansicht.setAttribute('d', ansicht);
    we.krone.setAttribute('d', krone);
    we.fuss.setAttribute('d', fuss);
    /* Die Krone ist Schnitt, solange die Wand wächst; steht sie, wird sie Ansicht. */
    var voll = h >= we.hMax - 1e-4;
    if (we.voll !== voll) {
      we.krone.setAttribute('class', voll ? 'k-ansicht kante' : 'k-schnitt kante');
      we.voll = voll;
    }
  }

  /* ---------- Grundriss: Raster, Wände im Schnitt, Glas, Türschwünge, Räume, Masse ---------- */

  function aussenUmriss() {
    /* Umlauf vorn, rechts, hinten, links mit Lücken für alle Öffnungen der Aussenwände. */
    var seiten = [
      { von: [0, 0], nach: [10, 0], w: EG_WAENDE[0], richtung: 1, start: 0 },
      { von: [10, 0], nach: [10, 8], w: EG_WAENDE[1], richtung: 1, start: 10 },
      { von: [10, 8], nach: [0, 8], w: EG_WAENDE[2], richtung: -1, start: 18 },
      { von: [0, 8], nach: [0, 0], w: EG_WAENDE[3], richtung: -1, start: 28 }
    ];
    var umfang = 36;
    var luecken = [];
    seiten.forEach(function (s) {
      s.w.oeff.forEach(function (o) {
        var p0, p1;
        if (s.richtung === 1) { p0 = s.start + (o.a - s.w.a); p1 = s.start + (o.b - s.w.a); }
        else { p0 = s.start + (s.w.b - o.b); p1 = s.start + (s.w.b - o.a); }
        luecken.push([p0, p1, o]);
      });
    });
    luecken.sort(function (p, q) { return p[0] - q[0]; });
    function punktBei(pos) {
      pos = ((pos % umfang) + umfang) % umfang;
      for (var i = 0; i < 4; i++) {
        var s = seiten[i], len = i % 2 === 0 ? 10 : 8;
        if (pos <= s.start + len + EPS) {
          var t = (pos - s.start) / len;
          return [s.von[0] + (s.nach[0] - s.von[0]) * t, s.von[1] + (s.nach[1] - s.von[1]) * t, 0];
        }
      }
      return [0, 0, 0];
    }
    var eckPos = [0, 10, 18, 28, 36];
    var stuecke = [];
    for (var i = 0; i < luecken.length; i++) {
      var von = luecken[i][1];
      var bis = i + 1 < luecken.length ? luecken[i + 1][0] : luecken[0][0] + umfang;
      var pkt = [punktBei(von)];
      eckPos.concat([46, 54, 64]).forEach(function (e) {
        if (e > von + EPS && e < bis - EPS) pkt.push(punktBei(e));
      });
      pkt.push(punktBei(bis));
      stuecke.push({ punkte: pkt, pos: von });
    }
    var glas = luecken.filter(function (l) { return l[2].art !== 'haustuer'; }).map(function (l) {
      return { punkte: [punktBei(l[0]), punktBei(l[1])], pos: l[0] };
    });
    return { stuecke: stuecke, glas: glas };
  }

  function bogenPunkte(t, n) {
    var cx = t.angel[0], cy = t.angel[1];
    var r = Math.sqrt((t.offen[0] - cx) * (t.offen[0] - cx) + (t.offen[1] - cy) * (t.offen[1] - cy));
    var a0 = Math.atan2(t.offen[1] - cy, t.offen[0] - cx);
    var a1 = Math.atan2(t.zu[1] - cy, t.zu[0] - cx);
    var d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    var p = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + d * i / n;
      p.push([cx + r * Math.cos(a), cy + r * Math.sin(a), 0]);
    }
    return p;
  }

  /* eb = { hinten, mitte, vorn }: Raster hinten, Plan in der Mitte, Räume und Massketten vorn. */
  function planBauen(eb, k, o) {
    var px = o.px; /* Benutzereinheiten pro Bildschirm-Pixel */
    var m = px / k.s; /* Meter pro Bildschirm-Pixel */
    var teile = { raster: [], aussen: [], innen: [], tueren: [], raeume: [], masse: [] };

    var gRaster = el('g', { 'class': 'l-raster' }, eb.hinten);
    for (var x = -1; x <= 11; x++) teile.raster.push(hilfslinie([x, -1, 0], [x, 9, 0], k, 'k-hilfe', gRaster));
    for (var y = -1; y <= 9; y++) teile.raster.push(hilfslinie([-1, y, 0], [11, y, 0], k, 'k-hilfe', gRaster));

    var gPlan = el('g', { 'class': 'l-plan' }, eb.mitte);
    var umriss = aussenUmriss();
    var aussen = umriss.stuecke.map(function (s) { var z = zug(s.punkte, k, 'k-schnitt zug', gPlan); z.pos = s.pos; return z; });
    var glas = umriss.glas.map(function (s) { var z = zug(s.punkte, k, 'k-ansicht zug', gPlan); z.pos = s.pos; return z; });
    teile.aussen = aussen.concat(glas).sort(function (p, q) { return p.pos - q.pos; });

    EG_WAENDE.forEach(function (w) {
      if (w.aussen) return;
      var luecken = w.oeff.map(function (oe) { return [oe.a, oe.b]; });
      ohneLuecken(w.a, w.b, luecken).forEach(function (t) {
        teile.innen.push(zug([wandPunkt(w, t[0], 0), wandPunkt(w, t[1], 0)], k, 'k-schnitt zug', gPlan));
      });
    });

    HAUS.tueren.forEach(function (t) {
      teile.tueren.push(zug([[t.angel[0], t.angel[1], 0], [t.offen[0], t.offen[1], 0]], k, 'k-ansicht zug', gPlan));
      teile.tueren.push(zug(bogenPunkte(t, 14), k, 'k-ansicht zug', gPlan));
    });

    /* Räume: Beschriftung liegt in der Planebene (um -30 Grad gedreht wie der Plan). */
    var gRaeume = el('g', { 'class': 'l-raeume' }, eb.vorn);
    teile.raeumeGruppe = gRaeume;
    HAUS.raeume.forEach(function (r) {
      if (o.handy && !r.handy) return;
      var p = projizieren(r.x, r.y, 0, k);
      var X = r2(p[0]), Y = r2(p[1]);
      var t = el('text', { x: X, y: Y, 'class': 't-raum', 'text-anchor': 'middle', transform: 'rotate(-30 ' + X + ' ' + Y + ')' }, gRaeume);
      var n = el('tspan', { x: X, dy: '-0.15em', 'class': 't-raum-name' }, t);
      n.textContent = r.name;
      var f = el('tspan', { x: X, dy: '1.3em', 'class': 't-raum-flaeche' }, t);
      var zahl = el('tspan', { 'class': 't-zahl' }, f);
      zahl.textContent = '';
      var einheit = el('tspan', {}, f);
      einheit.textContent = ' m²';
      teile.raeume.push({ el: t, zahl: zahl, text: r.flaeche });
    });

    /* Massketten vorn (10.00) und links (8.00). Endstriche 10 px, Schrägstriche 8 px unter 45 Grad. */
    var gMasse = el('g', { 'class': 'l-masse' }, eb.vorn);
    var end = 10 * m, schraeg = 8 * m, ueber = 4 * m, abstand = 15 * m;
    var d45 = Math.SQRT1_2;
    function kette(a, b, richtung, quer, text, drehung) {
      var kt = { enden: [], schraeg: [] };
      [a, b].forEach(function (p) {
        kt.enden.push(zug([[p[0] - quer[0] * end / 2, p[1] - quer[1] * end / 2, 0], [p[0] + quer[0] * end / 2, p[1] + quer[1] * end / 2, 0]], k, 'k-ansicht zug', gMasse));
      });
      kt.linie = zug([[a[0] - richtung[0] * ueber, a[1] - richtung[1] * ueber, 0], [b[0] + richtung[0] * ueber, b[1] + richtung[1] * ueber, 0]], k, 'k-ansicht zug', gMasse);
      [a, b].forEach(function (p) {
        kt.schraeg.push(zug([[p[0] - d45 * schraeg / 2, p[1] - d45 * schraeg / 2, 0], [p[0] + d45 * schraeg / 2, p[1] + d45 * schraeg / 2, 0]], k, 'k-schnitt zug', gMasse));
      });
      var mitte = [(a[0] + b[0]) / 2 - quer[0] * abstand, (a[1] + b[1]) / 2 - quer[1] * abstand, 0];
      var q = projizieren(mitte[0], mitte[1], 0, k);
      var X = r2(q[0]), Y = r2(q[1]);
      var t = el('text', { x: X, y: Y, 'class': 't-mass', 'text-anchor': 'middle', 'dominant-baseline': 'middle', transform: 'rotate(' + drehung + ' ' + X + ' ' + Y + ')' }, gMasse);
      t.textContent = '';
      kt.zahl = t;
      kt.text = text;
      return kt;
    }
    /* quer zeigt vom Haus weg nach innen; die Zahl steht aussen. */
    teile.masse.push(kette([0, -0.8], [10, -0.8], [1, 0], [0, 1], '10.00', -30));
    teile.masse.push(kette([-0.8, 0], [-0.8, 8], [0, 1], [1, 0], '8.00', 60));
    return teile;
  }

  /* ---------- Bühne: Decke, Obergeschoss, Dach, Fenster ---------- */

  function rechteck(x0, y0, x1, y1, z) { return [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]; }

  function deckeBauen(svg, k) {
    var g = el('g', { 'class': 'l-decke' }, svg);
    var z0 = HAUS.egOK, z1 = HAUS.deckeOK, tr = HAUS.treppe;
    var d = { flaechen: [], kanten: [] };
    /* Sichtbare Leibungen der Treppenöffnung liegen hinter dem Rand der Platte: zuerst. */
    var innenX = [[tr.x1, tr.y0, z0], [tr.x1, tr.y1, z0], [tr.x1, tr.y1, z1], [tr.x1, tr.y0, z1]];
    var innenY = [[tr.x0, tr.y1, z0], [tr.x1, tr.y1, z0], [tr.x1, tr.y1, z1], [tr.x0, tr.y1, z1]];
    d.flaechen.push(el('path', { d: pfadD(innenX, k, true), 'class': 'flaeche' }, g));
    d.flaechen.push(el('path', { d: pfadD(innenY, k, true), 'class': 'flaeche' }, g));
    d.linie1 = zug([[10, 0, z0], [0, 0, z0], [0, 8, z0], [10, 8, z0]], k, 'k-schnitt zug', g, true);
    var oben = pfadD(rechteck(0, 0, 10, 8, z1), k, true) + pfadD(rechteck(tr.x0, tr.y0, tr.x1, tr.y1, z1), k, true);
    d.flaechen.push(el('path', { d: oben, 'class': 'flaeche', 'fill-rule': 'evenodd' }, g));
    d.flaechen.push(el('path', { d: pfadD([[0, 0, z0], [10, 0, z0], [10, 0, z1], [0, 0, z1]], k, true), 'class': 'flaeche' }, g));
    d.flaechen.push(el('path', { d: pfadD([[0, 8, z0], [0, 0, z0], [0, 0, z1], [0, 8, z1]], k, true), 'class': 'flaeche' }, g));
    /* Sichtbarer Teil der unteren Linie über den Seitenflächen, im Takt mit linie1. */
    d.linie1vorn = zug([[10, 0, z0], [0, 0, z0], [0, 8, z0]], k, 'k-schnitt zug', g);
    d.linie2 = zug(rechteck(0, 0, 10, 8, z1), k, 'k-schnitt zug', g, true);
    [[0, 0], [10, 0], [0, 8]].forEach(function (p) {
      d.kanten.push(zug([[p[0], p[1], z0], [p[0], p[1], z1]], k, 'k-ansicht zug', g));
    });
    d.kanten.push(zug(rechteck(tr.x0, tr.y0, tr.x1, tr.y1, z1), k, 'k-ansicht zug', g, true));
    d.kanten.push(zug([[tr.x1, tr.y0, z0], [tr.x1, tr.y1, z0], [tr.x0, tr.y1, z0]], k, 'k-ansicht zug', g));
    d.kanten.push(zug([[tr.x1, tr.y1, z0], [tr.x1, tr.y1, z1]], k, 'k-ansicht zug', g));
    return d;
  }

  function dachHilfenBauen(svg, k) {
    var g = el('g', { 'class': 'l-dachhilfe' }, svg);
    var e = TRAUFE, r = FIRST, l = [];
    l.push(hilfslinie([0, 4, r], [10, 4, r], k, 'k-hilfe', g));
    l.push(hilfslinie([0, 0, e], [10, 0, e], k, 'k-hilfe', g));
    l.push(hilfslinie([0, 8, e], [10, 8, e], k, 'k-hilfe', g));
    [0, 10].forEach(function (x) {
      l.push(hilfslinie([x, 0, e], [x, 4, r], k, 'k-hilfe', g));
      l.push(hilfslinie([x, 8, e], [x, 4, r], k, 'k-hilfe', g));
    });
    return { gruppe: g, linien: l };
  }

  /* Schraffur auf einer Dachfläche: Linien parallel zur Traufe im Abstand a entlang der Neigung. */
  function schraffurLinien(b, t, traufe, neigung, abstand, seite) {
    var halb = t / 2, steig = Math.tan(neigung * GRAD);
    var l = halb / Math.cos(neigung * GRAD);
    var linien = [];
    for (var d = abstand; d < l - abstand * 0.4; d += abstand) {
      var dy = d * Math.cos(neigung * GRAD), z = traufe + dy * steig;
      var y = seite === 'vorn' ? dy : t - dy;
      linien.push([[0, y, z], [b, y, z]]);
    }
    return linien;
  }

  function dachBauen(svg, k) {
    var g = el('g', { 'class': 'l-dach' }, svg);
    var e = TRAUFE, r = FIRST;
    var hinten = [[0, 4, r], [10, 4, r], [10, 8, e], [0, 8, e]];
    var vorn = [[0, 0, e], [10, 0, e], [10, 4, r], [0, 4, r]];
    var giebel = [[0, 0, e], [0, 4, r], [0, 8, e]];
    el('path', { d: pfadD(hinten, k, true), 'class': 'flaeche' }, g);
    el('path', { d: pfadD(vorn, k, true), 'class': 'flaeche' }, g);
    el('path', { d: pfadD(giebel, k, true), 'class': 'flaeche' }, g);
    var kanten = seg([0, 4, r], [10, 4, r], k) + seg([0, 0, e], [10, 0, e], k) + seg([0, 8, e], [10, 8, e], k) +
      seg([0, 0, e], [0, 4, r], k) + seg([0, 4, r], [0, 8, e], k) + seg([10, 0, e], [10, 4, r], k) +
      seg([10, 4, r], [10, 8, e], k) + seg([0, 0, e], [0, 8, e], k);
    el('path', { d: kanten, 'class': 'k-ansicht kante' }, g);
    /* Schraffur nur auf der vorderen Dachfläche: die hintere ist im Bild so stark verkürzt,
       dass 0.33 m Lattung dort zu einer dunklen Fläche würde. */
    var gs = el('g', { 'class': 'l-schraffur' }, g);
    var sv = schraffurLinien(10, 8, e, 35, 0.33, 'vorn').map(function (p) { return zug(p, k, 'k-ansicht zug', gs); });
    return { gruppe: g, schraffurVorn: sv, schraffurHinten: [] };
  }

  function fensterRahmen(f, a, b, z0, z1, inset) {
    return [fassadenPunkt(f, a + inset, z0 + inset), fassadenPunkt(f, b - inset, z0 + inset),
      fassadenPunkt(f, b - inset, z1 - inset), fassadenPunkt(f, a + inset, z1 - inset)];
  }

  function fensterBauen(svg, k) {
    var g = el('g', { 'class': 'l-fenster' }, svg);
    var liste = [];
    LICHT.forEach(function (o) {
      var pkt = fensterRahmen(o.f, o.a, o.b, o.z0, o.z1, 0.06);
      if (o.tuer) pkt = fensterRahmen(o.f, o.a, o.b, o.z0 - 0.06, o.z1, 0.06);
      var glas = el('path', { d: pfadD(pkt, k, true), 'class': 'glas' }, g);
      var rahmen = zug(pkt, k, 'k-ansicht zug', g, true);
      var eintrag = { glas: glas, rahmen: rahmen, extra: [], extraFlaechen: [] };
      if (o.tuer) {
        var v = HAUS.vordach;
        var oben = [[v.x0, v.y0, v.z1], [v.x1, v.y0, v.z1], [v.x1, v.y1, v.z1], [v.x0, v.y1, v.z1]];
        var front = [[v.x0, v.y0, v.z0], [v.x1, v.y0, v.z0], [v.x1, v.y0, v.z1], [v.x0, v.y0, v.z1]];
        var seite = [[v.x0, v.y1, v.z0], [v.x0, v.y0, v.z0], [v.x0, v.y0, v.z1], [v.x0, v.y1, v.z1]];
        [oben, front, seite].forEach(function (pk) { eintrag.extraFlaechen.push(el('path', { d: pfadD(pk, k, true), 'class': 'flaeche' }, g)); });
        eintrag.extra.push(zug([[v.x0, v.y1, v.z1], [v.x0, v.y0, v.z1], [v.x1, v.y0, v.z1], [v.x1, v.y1, v.z1]], k, 'k-ansicht zug', g, true));
        eintrag.extra.push(zug([[v.x0, v.y1, v.z0], [v.x0, v.y0, v.z0], [v.x1, v.y0, v.z0], [v.x1, v.y0, v.z1]], k, 'k-ansicht zug', g));
        eintrag.extra.push(zug([[v.x0, v.y0, v.z0], [v.x0, v.y0, v.z1]], k, 'k-ansicht zug', g));
      }
      liste.push(eintrag);
    });
    return liste;
  }

  /* ---------- Lot (Ebene vorn): senkrechte Linie rechts neben dem Haus, Höhe = aktuelle Haushöhe ----------
     Fuss im Plan bei x 10.8, y 0 (rechts vor der Ecke 10/0). Oben ein kleines Dreieck mit der Spitze
     nach unten auf das Ende der Linie, wie eine Höhenkote. px = Benutzereinheiten pro Bildschirm-Pixel. */
  var LOT = { x: 10.8, y: 0 };

  function lotBauen(eltern, k, px) {
    var g = el('g', { 'class': 'l-lot', visibility: 'hidden' }, eltern);
    var linie = el('line', { 'class': 'k-lot' }, g);
    var spitze = el('path', { 'class': 'lot-spitze' }, g);
    var fuss = projizieren(LOT.x, LOT.y, 0, k);
    var halb = 4 * px, hoch = 7 * px;
    var sichtbar = false;
    linie.setAttribute('x1', r2(fuss[0]));
    linie.setAttribute('y1', r2(fuss[1]));
    return function setzeLot(h) {
      if (h <= 1e-3) {
        if (sichtbar) { g.setAttribute('visibility', 'hidden'); sichtbar = false; }
        return;
      }
      if (!sichtbar) { g.setAttribute('visibility', 'visible'); sichtbar = true; }
      var top = projizieren(LOT.x, LOT.y, h, k);
      var X = r2(top[0]), Y = r2(top[1]);
      linie.setAttribute('x2', X);
      linie.setAttribute('y2', Y);
      spitze.setAttribute('d', 'M' + r2(X - halb) + ' ' + r2(Y - hoch) + 'H' + r2(X + halb) + 'L' + X + ' ' + Y + 'Z');
    };
  }

  /* ---------- baueHaus: Einstieg (nur Plan) oder Bühne (ganzes Haus) ----------
     o = { modus: 'einstieg' | 'buehne', breite, hoehe, handy, px }
     Drei Ebenen als oberste Gruppen (Abschnitt 4.9): hinten Raster und Hilfslinien, Mitte das Haus,
     vorn Massketten, Raumnamen und Lot. Das Skript verschiebt nur diese drei Gruppen. */
  function baueHaus(svg, o) {
    leeren(svg);
    svg.setAttribute('viewBox', '0 0 ' + o.breite + ' ' + o.hoehe);
    var buehne = o.modus === 'buehne';
    var k;
    if (buehne) {
      k = einpassen(endpunkteHaus(), o.breite, o.hoehe, 0.82);
    } else {
      k = einpassen([[-1, -1, 0], [11, -1, 0], [11, 9, 0], [-1, 9, 0], [-2.1, 4, 0], [5, -2.1, 0]], o.breite, o.hoehe, 0.94);
    }
    var eb = {
      hinten: el('g', { 'class': 'ebene ebene-hinten' }, svg),
      mitte: el('g', { 'class': 'ebene ebene-mitte' }, svg),
      vorn: el('g', { 'class': 'ebene ebene-vorn' }, svg)
    };
    var teile = planBauen(eb, k, o);
    teile.k = k;
    teile.ebenen = eb;
    if (!buehne) return teile;

    var gEG = el('g', { 'class': 'l-eg' }, eb.mitte);
    var egAussen = [], egInnen = [];
    sortiereWaende(EG_WAENDE).forEach(function (w) {
      var we = wandBauen(w, 0, HAUS.egOK, k, gEG);
      (w.aussen ? egAussen : egInnen).push(we);
    });
    teile.decke = deckeBauen(eb.mitte, k);
    var gOG = el('g', { 'class': 'l-og' }, eb.mitte);
    var og = sortiereWaende(OG_WAENDE).map(function (w) { return wandBauen(w, HAUS.deckeOK, HAUS.ogHoehe, k, gOG); });
    teile.dachHilfen = dachHilfenBauen(eb.hinten, k);
    teile.dach = dachBauen(eb.mitte, k);
    teile.fenster = fensterBauen(eb.mitte, k);
    teile.setzeLot = lotBauen(eb.vorn, k, o.px);

    teile.setzeEGaussen = function (h) { egAussen.forEach(function (we) { wandSetzen(we, h); }); };
    teile.setzeEGinnen = function (h) { egInnen.forEach(function (we) { wandSetzen(we, h); }); };
    teile.setzeOG = function (h) { og.forEach(function (we) { wandSetzen(we, h); }); };
    teile.reihenfolgeEG = sortiereWaende(EG_WAENDE).map(function (w) { return w.name; });
    return teile;
  }

  /* ---------- Minis für Projekte und Phasen ---------- */

  /* Öffnungen der Fassaden: f 'y0' (vorn, entlang x) oder 'x0' (links, entlang y). */
  var PROJEKTE = {
    1: { /* Haus am Rebhang: 12 x 7, Pultdach 12 Grad, Sockelgeschoss halb im Hang */
      b: 12, t: 7, dach: 'pult', traufe: 5.6, neigung: 12,
      oeff: [
        { f: 'y0', a: 1.4, b: 7.6, z0: 0.3, z1: 2.4 }, { f: 'y0', a: 9.0, b: 10.2, z0: 0, z1: 2.3 },
        { f: 'y0', a: 1.4, b: 3.2, z0: 3.6, z1: 5.2 }, { f: 'y0', a: 5.1, b: 6.9, z0: 3.6, z1: 5.2 }, { f: 'y0', a: 8.8, b: 10.6, z0: 3.6, z1: 5.2 },
        { f: 'x0', a: 2.2, b: 3.8, z0: 3.6, z1: 5.2 }
      ],
      /* Gelände: liegt vor der Fassade, wird nach den Flächen gezeichnet */
      hilfenVorn: [[[0, -2.5, 0], [0, 0, 0], [0, 7, 2.8], [0, 9.5, 3.8]], [[-2.5, 0, 0], [0, 0, 0]], [[12, 0, 0], [14.5, 0, 0]]]
    },
    2: { /* Doppelhaus Lindenhof: 14 x 8, in der Mitte geteilt, Satteldach 30 Grad */
      b: 14, t: 8, dach: 'sattel', traufe: 5.6, neigung: 30, teilung: 7,
      oeff: [
        { f: 'y0', a: 0.8, b: 1.8, z0: 0, z1: 2.2 }, { f: 'y0', a: 2.6, b: 4.2, z0: 0.9, z1: 2.2 }, { f: 'y0', a: 5.0, b: 6.2, z0: 0.9, z1: 2.2 },
        { f: 'y0', a: 12.2, b: 13.2, z0: 0, z1: 2.2 }, { f: 'y0', a: 9.8, b: 11.4, z0: 0.9, z1: 2.2 }, { f: 'y0', a: 7.8, b: 9.0, z0: 0.9, z1: 2.2 },
        { f: 'y0', a: 1.0, b: 2.4, z0: 3.7, z1: 4.9 }, { f: 'y0', a: 4.4, b: 6.0, z0: 3.7, z1: 4.9 },
        { f: 'y0', a: 11.6, b: 13.0, z0: 3.7, z1: 4.9 }, { f: 'y0', a: 8.0, b: 9.6, z0: 3.7, z1: 4.9 },
        { f: 'x0', a: 2.6, b: 4.2, z0: 0.9, z1: 2.2 }, { f: 'x0', a: 2.6, b: 4.2, z0: 3.7, z1: 4.9 }
      ]
    },
    3: { /* Scheune Hinterdorf: 16 x 9, Satteldach 45 Grad, grosses Tor */
      b: 16, t: 9, dach: 'sattel', traufe: 4.5, neigung: 45,
      oeff: [
        { f: 'y0', a: 6.2, b: 9.8, z0: 0, z1: 3.6 },
        { f: 'y0', a: 1.6, b: 3.0, z0: 1.0, z1: 2.4 }, { f: 'y0', a: 13.0, b: 14.4, z0: 1.0, z1: 2.4 },
        { f: 'x0', a: 2.0, b: 3.4, z0: 1.0, z1: 2.4 }, { f: 'x0', a: 5.6, b: 7.0, z0: 1.0, z1: 2.4 },
        { f: 'x0', a: 3.9, b: 5.1, z0: 5.0, z1: 6.4 }
      ]
    },
    4: { /* Gartenzimmer: 6 x 4 eingeschossig, Flachdach mit Oberlicht 1.2 x 1.2 */
      b: 6, t: 4, dach: 'flach', traufe: 3.0,
      oberlicht: { x0: 2.4, x1: 3.6, y0: 1.4, y1: 2.6, h: 0.35 },
      oeff: [{ f: 'y0', a: 0.6, b: 5.4, z0: 0, z1: 2.4 }, { f: 'x0', a: 1.0, b: 3.0, z0: 0.9, z1: 2.4 }]
    },
    5: { /* Reihenhaus Nord: 6 x 10 zwischen zwei angedeuteten Nachbarn, Satteldach 35 Grad */
      b: 6, t: 10, dach: 'sattel', traufe: 5.6, neigung: 35, nachbarn: true,
      oeff: [
        { f: 'y0', a: 0.6, b: 1.6, z0: 0, z1: 2.2 }, { f: 'y0', a: 2.4, b: 5.2, z0: 0.9, z1: 2.2 },
        { f: 'y0', a: 0.8, b: 2.4, z0: 3.7, z1: 4.9 }, { f: 'y0', a: 3.4, b: 5.2, z0: 3.7, z1: 4.9 }
      ]
    },
    6: { /* Werkstatt mit Wohnung: 12 x 9, Erdgeschoss 4.0 mit Toren, Obergeschoss 2.5, Satteldach 25 Grad */
      b: 12, t: 9, dach: 'sattel', traufe: 6.5, neigung: 25,
      oeff: [
        { f: 'y0', a: 1.0, b: 4.4, z0: 0, z1: 3.4 }, { f: 'y0', a: 5.4, b: 8.8, z0: 0, z1: 3.4 }, { f: 'y0', a: 10.0, b: 11.0, z0: 0, z1: 2.2 },
        { f: 'y0', a: 1.2, b: 2.6, z0: 4.9, z1: 6.1 }, { f: 'y0', a: 4.0, b: 5.6, z0: 4.9, z1: 6.1 }, { f: 'y0', a: 7.0, b: 8.4, z0: 4.9, z1: 6.1 }, { f: 'y0', a: 9.8, b: 11.2, z0: 4.9, z1: 6.1 },
        { f: 'x0', a: 2.5, b: 5.5, z0: 1.2, z1: 3.2 }, { f: 'x0', a: 3.0, b: 4.4, z0: 4.9, z1: 6.1 }
      ]
    }
  };

  function hausBeispielOeffnungen(stand) {
    var l = [];
    EG_WAENDE.forEach(function (w) {
      if (!w.aussen) return;
      w.oeff.forEach(function (o) { l.push({ f: w.name === 'vorn' ? 'y0' : 'x0', a: o.a, b: o.b, z0: o.z0, z1: o.z1 }); });
    });
    if (stand >= 3) {
      OG_WAENDE.forEach(function (w) {
        w.oeff.forEach(function (o) { l.push({ f: w.name === 'vorn' ? 'y0' : 'x0', a: o.a, b: o.b, z0: o.z0, z1: o.z1 }); });
      });
    }
    return l;
  }

  /* Flächen eines Körpers. Jede Fläche: punkte, id; die Zeichnung folgt der Reihenfolge von hinten nach vorn. */
  function koerper(sp, offen, hoehe) {
    var b = sp.b, t = sp.t, e = sp.traufe, f = [];
    if (offen) {
      /* Offene Kiste (Rohbau ohne Dach): Innenseiten hinten und rechts sind sichtbar. */
      f.push({ id: 'rechts', punkte: [[b, 0, 0], [b, t, 0], [b, t, hoehe], [b, 0, hoehe]] });
      f.push({ id: 'hinten', punkte: [[0, t, 0], [b, t, 0], [b, t, hoehe], [0, t, hoehe]] });
      f.push({ id: 'vorn', punkte: [[0, 0, 0], [b, 0, 0], [b, 0, hoehe], [0, 0, hoehe]] });
      f.push({ id: 'links', punkte: [[0, t, 0], [0, 0, 0], [0, 0, hoehe], [0, t, hoehe]] });
      return f;
    }
    if (sp.dach === 'sattel') {
      var r = e + (t / 2) * Math.tan(sp.neigung * GRAD);
      f.push({ id: 'dach-hinten', punkte: [[0, t / 2, r], [b, t / 2, r], [b, t, e], [0, t, e]] });
      f.push({ id: 'dach-vorn', punkte: [[0, 0, e], [b, 0, e], [b, t / 2, r], [0, t / 2, r]] });
      f.push({ id: 'vorn', punkte: [[0, 0, 0], [b, 0, 0], [b, 0, e], [0, 0, e]] });
      f.push({ id: 'links', punkte: [[0, t, 0], [0, 0, 0], [0, 0, e], [0, t / 2, r], [0, t, e]] });
      sp.first = r;
    } else if (sp.dach === 'pult') {
      var hoch = e + t * Math.tan(sp.neigung * GRAD);
      f.push({ id: 'dach', punkte: [[0, 0, hoch], [b, 0, hoch], [b, t, e], [0, t, e]] });
      f.push({ id: 'vorn', punkte: [[0, 0, 0], [b, 0, 0], [b, 0, hoch], [0, 0, hoch]] });
      f.push({ id: 'links', punkte: [[0, t, 0], [0, 0, 0], [0, 0, hoch], [0, t, e]] });
    } else {
      f.push({ id: 'deckel', punkte: [[0, 0, e], [b, 0, e], [b, t, e], [0, t, e]] });
      f.push({ id: 'vorn', punkte: [[0, 0, 0], [b, 0, 0], [b, 0, e], [0, 0, e]] });
      f.push({ id: 'links', punkte: [[0, t, 0], [0, 0, 0], [0, 0, e], [0, t, e]] });
      if (sp.oberlicht) {
        var o = sp.oberlicht, z1 = e + o.h;
        f.push({ id: 'ol-deckel', punkte: [[o.x0, o.y0, z1], [o.x1, o.y0, z1], [o.x1, o.y1, z1], [o.x0, o.y1, z1]] });
        f.push({ id: 'ol-vorn', punkte: [[o.x0, o.y0, e], [o.x1, o.y0, e], [o.x1, o.y0, z1], [o.x0, o.y0, z1]] });
        f.push({ id: 'ol-links', punkte: [[o.x0, o.y1, e], [o.x0, o.y0, e], [o.x0, o.y0, z1], [o.x0, o.y1, z1]] });
      }
    }
    return f;
  }

  function mitte(punkte) {
    var x = 0, y = 0, z = 0;
    punkte.forEach(function (p) { x += p[0]; y += p[1]; z += p[2]; });
    return [x / punkte.length, y / punkte.length, z / punkte.length];
  }

  function nachbarLinien(sp) {
    var e = sp.traufe, r = e + (sp.t / 2) * Math.tan(sp.neigung * GRAD), t = sp.t, l = [];
    [[-sp.b, 0, -sp.b], [sp.b, 2 * sp.b, 2 * sp.b]].forEach(function (n) {
      var x0 = n[0], x1 = n[1], aussen = n[2];
      l.push([[x0, 0, 0], [x1, 0, 0]]);
      l.push([[x0, 0, e], [x1, 0, e]]);
      l.push([[x0, t / 2, r], [x1, t / 2, r]]);
      l.push([[aussen, 0, 0], [aussen, 0, e]]);
      l.push([[aussen, 0, e], [aussen, t / 2, r]]);
    });
    return l;
  }

  /* baueMini(svg, variante, stand, o): variante 0 = Haus Beispiel im Stand 1 bis 6 (Phasen),
     1 bis 6 = Projekthäuser (fertig). o = { breite, hoehe, anteil, px } */
  function baueMini(svg, variante, stand, o) {
    leeren(svg);
    svg.setAttribute('viewBox', '0 0 ' + o.breite + ' ' + o.hoehe);
    var sp, flaechen, oeff, hilfen = [], hilfenVorn = [], schraffur = false, glasSichtbar = false, planLinien = null;
    if (variante === 0) {
      sp = { b: 10, t: 8, dach: 'sattel', traufe: TRAUFE, neigung: 35 };
      oeff = stand >= 2 ? hausBeispielOeffnungen(stand) : [];
      if (stand === 1) {
        flaechen = [];
        planLinien = [rechteck(0, 0, 10, 8, 0)];
        EG_WAENDE.forEach(function (w) { if (!w.aussen) planLinien.push([wandPunkt(w, w.a, 0), wandPunkt(w, w.b, 0)]); });
      } else if (stand === 2) {
        flaechen = koerper(sp, true, HAUS.egOK);
      } else if (stand === 3) {
        flaechen = koerper(sp, true, TRAUFE);
      } else {
        flaechen = koerper(sp, false);
      }
      schraffur = stand >= 5;
      glasSichtbar = stand >= 6;
    } else {
      sp = PROJEKTE[variante];
      flaechen = koerper(sp, false);
      oeff = sp.oeff;
      if (sp.hilfenVorn) hilfenVorn = sp.hilfenVorn;
      if (sp.nachbarn) hilfen = nachbarLinien(sp);
    }

    /* Einpassen aus allen Punkten der Endgeometrie. */
    var alle = [];
    flaechen.forEach(function (f) { alle = alle.concat(f.punkte); });
    if (planLinien) planLinien.forEach(function (l) { alle = alle.concat(l); });
    if (variante === 0) alle = alle.concat(endpunkteHaus().slice(0, 10));
    hilfen.concat(hilfenVorn).forEach(function (l) { alle = alle.concat(l); });
    var k = einpassen(alle, o.breite, o.hoehe, o.anteil || 0.8);

    /* Gestrichelte Hilfslinien (Nachbarn, Gelände) zeichnen sich nicht per drawSVG, sie blenden ein. */
    var ergebnis = { linien: [], glas: [], hilfen: [], k: k };
    if (hilfen.length) {
      var gHilfe = el('g', { 'class': 'l-hilfe' }, svg);
      hilfen.forEach(function (l) { el('path', { d: pfadD(l, k, false), 'class': 'k-hilfe' }, gHilfe); });
      ergebnis.hilfen.push(gHilfe);
    }

    if (planLinien) {
      planLinien.forEach(function (l, i) { ergebnis.linien.push(zug(l, k, 'k-ansicht zug', svg, i === 0)); });
    }

    var sortiert = flaechen.slice().sort(function (p, q) {
      var a = mitte(p.punkte), b = mitte(q.punkte);
      var d = (b[0] + b[1]) - (a[0] + a[1]);
      return Math.abs(d) > 1e-6 ? d : a[2] - b[2];
    });
    sortiert.forEach(function (f) {
      var g = el('g', {}, svg);
      el('path', { d: pfadD(f.punkte, k, true), 'class': 'flaeche' }, g);
      ergebnis.linien.push(zug(f.punkte, k, 'k-ansicht zug', g, true));
      /* Öffnungen auf ihrer Fassade */
      var fassade = f.id === 'vorn' ? 'y0' : (f.id === 'links' ? 'x0' : null);
      if (fassade) {
        var hoeheMax = f.punkte.reduce(function (m, p) { return Math.max(m, p[2]); }, 0);
        oeff.forEach(function (oe) {
          if (oe.f !== fassade || oe.z1 > hoeheMax + EPS) return;
          var pk = fensterRahmen(oe.f, oe.a, oe.b, oe.z0, oe.z1, 0);
          var glas = el('path', { d: pfadD(pk, k, true), 'class': 'glas' }, g);
          ergebnis.glas.push(glas);
          ergebnis.linien.push(zug(pk, k, 'k-ansicht zug', g, true));
        });
        if (sp.teilung && fassade === 'y0') {
          ergebnis.linien.push(zug([[sp.teilung, 0, 0], [sp.teilung, 0, sp.traufe]], k, 'k-ansicht zug', g));
        }
      }
      if (sp.teilung && (f.id === 'dach-vorn' || f.id === 'dach-hinten')) {
        var ya = f.id === 'dach-vorn' ? 0 : sp.t, za = sp.traufe;
        ergebnis.linien.push(zug([[sp.teilung, ya, za], [sp.teilung, sp.t / 2, sp.first]], k, 'k-ansicht zug', g));
      }
      if (schraffur && f.id === 'dach-vorn') {
        /* Bei Kachelgrösse jede dritte Lattung (0.99 m), sonst wird die Schraffur zur Fläche. */
        schraffurLinien(sp.b, sp.t, sp.traufe, sp.neigung, 0.99, f.id === 'dach-vorn' ? 'vorn' : 'hinten').forEach(function (p) {
          ergebnis.linien.push(zug(p, k, 'k-ansicht k-schraffur zug', g));
        });
      }
    });
    if (hilfenVorn.length) {
      var gVorn = el('g', { 'class': 'l-hilfe' }, svg);
      hilfenVorn.forEach(function (l) { el('path', { d: pfadD(l, k, false), 'class': 'k-hilfe' }, gVorn); });
      ergebnis.hilfen.push(gVorn);
    }
    ergebnis.glasSichtbar = glasSichtbar;
    return ergebnis;
  }

  window.Achsmass = {
    projizieren: projizieren,
    baueHaus: baueHaus,
    baueMini: baueMini,
    wandSetzen: wandSetzen,
    sortiereWaende: sortiereWaende,
    daten: { HAUS: HAUS, EG_WAENDE: EG_WAENDE, OG_WAENDE: OG_WAENDE, PROJEKTE: PROJEKTE, LOT: LOT }
  };
})();
