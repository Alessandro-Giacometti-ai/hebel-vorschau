/* Pizzeria Tondo (Beispielseite von Hebel): Bewegung und Bedienung.
   Grundlage: docs/webstudio-2026-10/master-prompts/v4-02-restaurant.md (Abschnitte 3 und 4).
   Klassisches Skript (defer), nutzt die globalen gsap, ScrollTrigger, CustomEase, Flip,
   DrawSVGPlugin und Lenis aus /hebel-vorschau/v4/studio/vendor/ und window.TondoSVG aus pizza-svg.js.

   Bewegung läuft immer. Ruhig nur auf Wunsch des Besuchers: Klasse ruhig auf html,
   localStorage hebel-ruhig, Ereignis "hebel-ruhig" aus dem Kopf der Seite. Die
   Systemeinstellung zu reduzierter Bewegung wird bewusst nicht gelesen.
   Ruhig heisst: Lenis aus, Teig-Einstieg, Basilikum, Schnitt, Etikett-Wanderung, Stecknadel und
   das drehende "o" stehen sofort im Endzustand; Sauce und Mozzarella bleiben am Scroll; die Ebenen
   reagieren weder auf Zeiger noch auf Scroll-Tempo, der Helfer der Plakette winkt nicht.

   Kamera ruht: Die Bühne bewegt sich nie seitlich, nur Zutaten und das Etikett bewegen sich. */
(function () {
  'use strict';

  var doc = document;
  var html = doc.documentElement;
  var RUHIG = html.classList.contains('ruhig');
  var G = window.gsap;
  var ST = window.ScrollTrigger;
  var HAT_GSAP = !!(G && ST);
  var lenis = null;
  var pizza = null;   /* Teile der grossen Pizza, sobald gebaut */
  var intro = null;   /* Zeitachse des Teig-Einstiegs */
  var fussZurueck = null;
  var skizzeEnde = null;
  var ebenenRuhe = null;

  function $(s, r) { return (r || doc).querySelector(s); }
  function klemme(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function mod(n, m) { return ((n % m) + m) % m; }
  function sicher(name, fn) {
    try { fn(); } catch (e) { if (window.console && console.warn) console.warn('Tondo, ' + name + ':', e); }
  }
  function fokus(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  /* ---------- Zeit in Zürich ---------- */
  var WOCHENTAG = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function zuerich() {
    var t = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Zurich', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (p) { t[p.type] = p.value; });
    return {
      tag: WOCHENTAG[t.weekday],
      minuten: (parseInt(t.hour, 10) % 24) * 60 + parseInt(t.minute, 10),
      iso: t.year + '-' + t.month + '-' + t.day
    };
  }

  /* ---------- Mittags-Etikett und heutige Zeile der Öffnungszeiten ---------- */
  var MITTAG = {
    2: 'Heute: Pizza Zucca, Kürbis und Salbei',
    3: 'Heute: Pizza Salsiccia',
    4: 'Heute: Pizza Ortolana, Gemüse vom Markt',
    5: 'Heute: Pizza Tonno e Cipolla'
  };
  function heuteSetzen() {
    var jetzt = zuerich();
    var etikett = $('#heute');
    if (etikett) {
      etikett.textContent = MITTAG[jetzt.tag] || 'Mittagsmenü wieder ab Dienstag';
      etikett.hidden = false;
    }
    $$('#zeiten tr').forEach(function (tr) {
      var tage = (tr.getAttribute('data-tage') || '').split(',').filter(Boolean).map(Number);
      var status = $('.status', tr);
      /* ist-heute, nicht heute: .heute ist das gedrehte Mittags-Etikett und würde die Zeile umformen */
      if (tage.indexOf(jetzt.tag) === -1) {
        tr.classList.remove('ist-heute');
        if (status) status.textContent = '';
        return;
      }
      tr.classList.add('ist-heute');
      var offen = (tr.getAttribute('data-offen') || '').split(',').filter(Boolean).some(function (spanne) {
        var g = spanne.split('-').map(Number);
        return jetzt.minuten >= g[0] && jetzt.minuten < g[1];
      });
      if (status) status.textContent = offen ? 'Jetzt geöffnet' : 'Jetzt geschlossen';
    });
  }

  /* ---------- Text blendet beim ersten Eintritt ein (12 px Anhub, 360 ms, Kurve text) ---------- */
  function textEinblenden() {
    var teile = $$('[data-ein]');
    if (!teile.length) return;
    if (!('IntersectionObserver' in window)) return;
    html.classList.add('ein-bereit');
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('ist-da');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -15% 0px' });
    teile.forEach(function (el) {
      /* Was beim Laden schon oberhalb des Fensters liegt, steht sofort fertig. */
      if (el.getBoundingClientRect().bottom <= 0) el.classList.add('sofort', 'ist-da');
      else io.observe(el);
    });
  }

  /* ---------- Kopf: ab 24 px Scroll Fläche und Linie ---------- */
  function kopfBeobachten() {
    var kopf = $('#kopf');
    if (!kopf) return;
    function pruefe() { kopf.classList.toggle('ist-gescrollt', (window.scrollY || window.pageYOffset || 0) > 24); }
    window.addEventListener('scroll', pruefe, { passive: true });
    pruefe();
  }

  /* ---------- Springen zu Abschnitten ---------- */
  /* Lenis und das native scrollIntoView beachten beide scroll-margin-top aus der CSS; dort steht,
     wie weit Kopf (und am Handy Bühne und Schichtleiste) den Abschnitt verdecken würden. */
  function springe(ziel, mitFokus) {
    if (!ziel) return;
    if (lenis) lenis.scrollTo(ziel, { duration: 1.2 });
    else ziel.scrollIntoView({ block: 'start' });
    if (mitFokus) {
      if (!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex', '-1');
      fokus(ziel);
    }
  }

  /* ---------- Menü als Blatt von oben (Handy) ---------- */
  var menueOffen = false;
  var menueKnopf = null;
  var blatt = null;
  function menueOeffnen() {
    if (!blatt || menueOffen) return;
    menueOffen = true;
    blatt.removeAttribute('inert');
    blatt.classList.add('offen');
    menueKnopf.setAttribute('aria-expanded', 'true');
    html.classList.add('menue-offen');
    if (lenis) lenis.stop();
    window.setTimeout(function () { fokus($('.blatt-liste a', blatt)); }, 40);
  }
  function menueSchliessen(fokusZurueck) {
    if (!blatt || !menueOffen) return;
    menueOffen = false;
    blatt.classList.remove('offen');
    blatt.setAttribute('inert', '');
    menueKnopf.setAttribute('aria-expanded', 'false');
    html.classList.remove('menue-offen');
    if (lenis) lenis.start();
    if (fokusZurueck) fokus(menueKnopf);
  }
  function menue() {
    blatt = $('#menue');
    menueKnopf = $('.knopf--menue');
    if (!blatt || !menueKnopf) return;
    menueKnopf.addEventListener('click', function () { if (menueOffen) menueSchliessen(true); else menueOeffnen(); });
    $('.blatt-zu', blatt).addEventListener('click', function () { menueSchliessen(true); });
    doc.addEventListener('keydown', function (e) {
      if (!menueOffen) return;
      if (e.key === 'Escape') { e.preventDefault(); menueSchliessen(true); return; }
      if (e.key !== 'Tab') return;
      var ziele = $$('button, a[href]', blatt);
      var erstes = ziele[0], letztes = ziele[ziele.length - 1];
      if (e.shiftKey && doc.activeElement === erstes) { e.preventDefault(); fokus(letztes); }
      else if (!e.shiftKey && doc.activeElement === letztes) { e.preventDefault(); fokus(erstes); }
    });
    doc.addEventListener('pointerdown', function (e) {
      if (!menueOffen) return;
      if (blatt.contains(e.target) || menueKnopf.contains(e.target)) return;
      menueSchliessen(false);
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) menueSchliessen(false); });
  }

  /* ---------- Interne Links und Schichtleiste ---------- */
  function ankerLinks() {
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      var ziel = id ? doc.getElementById(id) : null;
      if (!ziel) return;
      e.preventDefault();
      menueSchliessen(false);
      springe(ziel, true);
      if (window.history && history.replaceState) history.replaceState(null, '', '#' + id);
    });
    $$('.schichten button').forEach(function (b) {
      b.addEventListener('click', function () { springe(doc.getElementById(b.getAttribute('data-ziel')), true); });
    });
  }

  /* ---------- Reservation im Demo-Modus ---------- */
  var FEHLER = {
    datum: 'Bitte ein Datum wählen.',
    zeit: 'Bitte eine Zeit wählen.',
    name: 'Bitte Ihren Namen angeben.',
    telefon: 'Bitte eine Telefonnummer angeben, damit wir Sie erreichen.'
  };
  function formular() {
    var f = $('#formular');
    if (!f) return;
    var datum = $('#f-datum');
    var name = $('#f-name');
    var tel = $('#f-telefon');
    var feldZeit = $('.feld--zeit', f);
    var zahl = $('#personen-zahl');
    var versteckt = $('#f-personen');
    var weniger = $('#personen-weniger');
    var mehr = $('#personen-mehr');
    var erfolg = $('#erfolg');
    var senden = $('#senden');
    var personen = 2;

    datum.min = zuerich().iso;
    senden.disabled = false;

    function personenSetzen(n) {
      personen = Math.max(1, Math.min(8, n));
      zahl.textContent = String(personen);
      versteckt.value = String(personen);
      /* aria-disabled statt disabled, damit der Fokus beim Grenzwert nicht verloren geht */
      weniger.setAttribute('aria-disabled', personen <= 1 ? 'true' : 'false');
      mehr.setAttribute('aria-disabled', personen >= 8 ? 'true' : 'false');
    }
    weniger.addEventListener('click', function () { personenSetzen(personen - 1); });
    mehr.addEventListener('click', function () { personenSetzen(personen + 1); });
    personenSetzen(2);

    function zeigeFehler(feld, schluessel, text) {
      var ort = $('#fehler-' + schluessel);
      if (ort) ort.textContent = text || '';
      if (text) feld.setAttribute('aria-invalid', 'true');
      else feld.removeAttribute('aria-invalid');
    }
    function gewaehlteZeit() {
      var r = $('input[name="zeit"]:checked', f);
      return r ? r.value : '';
    }
    var pruefe = {
      datum: function () {
        var d = datum.value;
        var gut = /^\d{4}-\d{2}-\d{2}$/.test(d) && (!datum.min || d >= datum.min);
        zeigeFehler(datum, 'datum', gut ? '' : FEHLER.datum);
        return gut ? null : datum;
      },
      zeit: function () {
        var gut = !!gewaehlteZeit();
        zeigeFehler(feldZeit, 'zeit', gut ? '' : FEHLER.zeit);
        return gut ? null : $('input[name="zeit"]', f);
      },
      name: function () {
        var gut = name.value.trim().length > 0;
        zeigeFehler(name, 'name', gut ? '' : FEHLER.name);
        return gut ? null : name;
      },
      telefon: function () {
        var gut = tel.value.replace(/\D/g, '').length >= 6;
        zeigeFehler(tel, 'telefon', gut ? '' : FEHLER.telefon);
        return gut ? null : tel;
      }
    };

    /* Ein Fehler verschwindet, sobald das Feld stimmt; neue Fehler zeigt erst das Absenden. */
    datum.addEventListener('change', function () { if (datum.hasAttribute('aria-invalid')) pruefe.datum(); });
    name.addEventListener('input', function () { if (name.hasAttribute('aria-invalid')) pruefe.name(); });
    tel.addEventListener('input', function () { if (tel.hasAttribute('aria-invalid')) pruefe.telefon(); });
    $$('input[name="zeit"]', f).forEach(function (r) {
      r.addEventListener('change', function () { if (feldZeit.hasAttribute('aria-invalid')) pruefe.zeit(); });
    });

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var falsch = [pruefe.datum(), pruefe.zeit(), pruefe.name(), pruefe.telefon()].filter(Boolean);
      if (falsch.length) {
        var erstes = falsch[0];
        springe(erstes.closest('.feld') || erstes, false);
        fokus(erstes);
        return;
      }
      var zeit = gewaehlteZeit();
      var t = datum.value.split('-').map(Number);
      var tagText = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })
        .format(new Date(t[0], t[1] - 1, t[2]));
      var wer = personen === 1 ? '1 Person' : personen + ' Personen';
      erfolg.textContent = 'Demo: Tisch für ' + wer + ' am ' + tagText + ' um ' + zeit + ' vorgemerkt. Es wurde nichts gesendet.';
      erfolg.hidden = false;
      try {
        localStorage.setItem('tondo-reservation', JSON.stringify({
          datum: datum.value, zeit: zeit, personen: personen,
          name: name.value.trim(), telefon: tel.value.trim(), vorgemerkt: new Date().toISOString()
        }));
      } catch (x) { /* privater Modus: nichts speichern */ }
      springe(erfolg, true);
      pizzaSchneiden(zeit);
    });
  }

  /* ---------- Drehteller (Technik nach Steckbrief Mâm Cơm, eigener Code) ---------- */
  function teller() {
    var scheibe = $('#teller-scheibe');
    if (!scheibe) return;
    var ring = $('.teller-ring', scheibe);
    var tabs = $$('[role="tab"]', scheibe);
    var panels = tabs.map(function (t) { return doc.getElementById(t.getAttribute('aria-controls')); });
    var angaben = $('#teller-angaben');
    var N = tabs.length;
    var SCHRITT = 360 / N;
    var u = 1;          /* Umdrehungen in Plätzen; Margherita steht zu Beginn oben (--rot:-60deg im HTML) */
    var gewaehlt = 1;

    function setzeRot(grad) { scheibe.style.setProperty('--rot', grad + 'deg'); }
    /* Einrasten nach dem Ziehen läuft mit eigener, abbremsender Kurve (Klasse rastet); Klick und
       Pfeiltasten behalten die Auswahl-Kurve aus dem Prompt. */
    var rastTimer = 0;
    function rastenEnde() {
      window.clearTimeout(rastTimer);
      scheibe.classList.remove('rastet');
    }
    function markiere(i, mitFokus) {
      gewaehlt = i;
      tabs.forEach(function (t, k) {
        var an = k === i;
        t.setAttribute('aria-selected', an ? 'true' : 'false');
        t.tabIndex = an ? 0 : -1;
        panels[k].hidden = !an;
      });
      if (mitFokus) fokus(tabs[i]);
    }
    /* Immer der kurze Weg, die Umdrehungen werden aufaddiert und fallen nie auf null zurück. */
    function waehle(i, mitFokus) {
      rastenEnde();
      var d = mod(i - mod(u, N), N);
      if (d > N / 2) d -= N;
      u += d;
      setzeRot(-u * SCHRITT);
      markiere(mod(u, N), mitFokus);
    }

    /* Panel-Höhe auf das höchste Panel festlegen, damit beim Wechsel nichts springt. */
    function hoeheMessen() {
      var max = 0;
      angaben.style.minHeight = '';
      panels.forEach(function (p) {
        var war = p.hidden;
        p.hidden = false;
        max = Math.max(max, p.getBoundingClientRect().height);
        p.hidden = war;
      });
      angaben.style.minHeight = Math.ceil(max) + 'px';
    }
    hoeheMessen();
    var messTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(messTimer);
      messTimer = window.setTimeout(hoeheMessen, 150);
    });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(hoeheMessen);

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { waehle(i, false); });
    });
    ring.addEventListener('keydown', function (e) {
      var neu;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': neu = gewaehlt + 1; break;
        case 'ArrowLeft': case 'ArrowUp': neu = gewaehlt - 1; break;
        case 'Home': neu = 0; break;
        case 'End': neu = N - 1; break;
        default: return;
      }
      e.preventDefault();
      waehle(mod(neu, N), true);
    });
    $('#teller-zurueck').addEventListener('click', function () { waehle(mod(gewaehlt - 1, N), false); });
    $('#teller-weiter').addEventListener('click', function () { waehle(mod(gewaehlt + 1, N), false); });

    /* Ziehen mit Zeiger und Finger: Winkel mit atan2 zur Tellermitte. Erfasst wird erst nach mehr als
       6 px seitlicher Bewegung, damit senkrechtes Scrollen am Handy weiter geht (touch-action: pan-y). */
    var zug = null;
    var klickSperre = false;
    function winkel(x, y) { return Math.atan2(y - zug.cy, x - zug.cx) * 180 / Math.PI; }
    function aktuelleDrehung() {
      /* Vom sichtbaren Wert aus weiter, auch mitten in einer laufenden Drehung */
      var w = parseFloat(window.getComputedStyle(ring).rotate);
      return isNaN(w) ? -u * SCHRITT : w;
    }
    scheibe.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var r = scheibe.getBoundingClientRect();
      zug = { id: e.pointerId, x0: e.clientX, cx: r.left + r.width / 2, cy: r.top + r.height / 2, aktiv: false, rot: 0, w: 0, proben: [] };
    });
    scheibe.addEventListener('pointermove', function (e) {
      if (!zug || e.pointerId !== zug.id) return;
      if (!zug.aktiv) {
        if (Math.abs(e.clientX - zug.x0) <= 6) return;
        zug.aktiv = true;
        try { scheibe.setPointerCapture(e.pointerId); } catch (f) { /* ohne Erfassung weiter */ }
        zug.rot = aktuelleDrehung();
        rastenEnde();
        scheibe.classList.add('zieht');
        setzeRot(zug.rot);
        zug.w = winkel(e.clientX, e.clientY);
      }
      var w = winkel(e.clientX, e.clientY);
      var d = w - zug.w;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      zug.w = w;
      zug.rot += d;
      setzeRot(zug.rot);
      var jetzt = window.performance.now();
      zug.proben.push([jetzt, zug.rot]);
      while (zug.proben.length > 2 && jetzt - zug.proben[0][0] > 100) zug.proben.shift();
      e.preventDefault();
    });
    function loslassen(e) {
      if (!zug || e.pointerId !== zug.id) return;
      var z = zug;
      zug = null;
      if (!z.aktiv) return;
      klickSperre = true;
      window.setTimeout(function () { klickSperre = false; }, 0);
      /* Geschwindigkeit in Grad pro ms; Nachlauf clamp(v x 90 / 60, -2, 2) Plätze, dann Einrasten */
      var v = 0;
      var p = z.proben;
      if (e.type !== 'pointercancel' && p.length > 1) {
        var a = p[0], b = p[p.length - 1];
        if (b[0] - a[0] > 0) v = (b[1] - a[1]) / (b[0] - a[0]);
      }
      var nachlauf = Math.max(-2, Math.min(2, v * 90 / SCHRITT));
      u = Math.round(-(z.rot + nachlauf * SCHRITT) / SCHRITT);
      /* Keine Naht nach schnellem Zug: Die Rastkurve cubic-bezier(.15,.75,.3,1) beginnt mit Steigung 5,
         also mit 5 x Restweg / Dauer. Die Dauer wird so gewählt, dass dieses Anfangstempo dem
         Abgabetempo v entspricht (250 bis 1000 ms); ohne Schwung oder gegen die Richtung 600 ms. */
      var rest = -u * SCHRITT - z.rot;
      var dauer = 600;
      if (Math.abs(v) > 0.02 && rest * v > 0) dauer = Math.max(250, Math.min(1000, 5 * Math.abs(rest) / Math.abs(v)));
      scheibe.style.setProperty('--rast-dauer', Math.round(dauer) + 'ms');
      scheibe.classList.add('rastet');
      scheibe.classList.remove('zieht');
      void ring.offsetWidth;
      setzeRot(-u * SCHRITT);
      markiere(mod(u, N), false);
      window.clearTimeout(rastTimer);
      rastTimer = window.setTimeout(rastenEnde, dauer + 120);
    }
    ring.addEventListener('transitionend', function (e) {
      if (e.target === ring && e.propertyName === 'rotate') rastenEnde();
    });
    scheibe.addEventListener('pointerup', loslassen);
    scheibe.addEventListener('pointercancel', loslassen);
    scheibe.addEventListener('click', function (e) {
      if (klickSperre) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  /* =====================================================================
     Ab hier GSAP: Lenis, die Pizza, Etikett, Skizze, Fuss
     ===================================================================== */

  function kurvenAnmelden() {
    G.registerPlugin.apply(G, [ST, window.CustomEase, window.Flip, window.DrawSVGPlugin].filter(Boolean));
    if (window.CustomEase) {
      window.CustomEase.create('landen', '0.2,0.9,0.25,1.12');
      window.CustomEase.create('teig', '0.2,0.9,0.25,1.15');
      window.CustomEase.create('sauce', '0.3,0,0.2,1');
      window.CustomEase.create('blatt', '0.3,1.4,0.4,1');
      window.CustomEase.create('text', '0.2,0.8,0.2,1');
    }
  }

  /* Lenis im gsap.ticker, bei jedem Lenis-Scroll ScrollTrigger.update */
  function lenisStarten() {
    if (lenis || RUHIG || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      duration: 1,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 2,
      autoRaf: false,
      /* Lenis 1.3.26 liest sonst die Systemeinstellung zu reduzierter Bewegung selbst (Standard an) und
         springt bei scrollTo ohne Animation; Ales Windows meldet diese Einstellung */
      respectReducedMotion: false
    });
    lenis.on('scroll', ST.update);
  }
  function lenisStoppen() {
    if (!lenis) return;
    lenis.destroy();
    lenis = null;
  }

  /* ---------- Die Pizza: Bau und Anfangszustände in einem Schritt ---------- */
  function pizzaBauen() {
    var ort = $('#pizza-ort');
    if (!ort || !window.TondoSVG) return false;
    var notbild = $('svg.pizza', ort);
    if (notbild) notbild.parentNode.removeChild(notbild);
    var svg = window.TondoSVG.grossePizza();
    ort.insertBefore(svg, ort.firstChild);

    function teil(n) { return svg.querySelector('[data-teil="' + n + '"]'); }
    pizza = {
      svg: svg,
      teig: teil('teig'),
      rand: teil('rand'),
      mehl: $$('[data-teil="mehl"] > circle', svg),
      spirale: teil('spirale'),
      flaeche: teil('sauce-flaeche'),
      maske: teil('maske'),
      stuecke: $$('[data-teil="mozza"] > path', svg),
      schatten: $$('[data-teil="mozza-schatten"] > ellipse', svg),
      blaetter: $$('[data-teil="basilikum"] > g', svg),
      glanz: $$('[data-teil="glanz"] > path', svg),
      schnitte: $$('[data-teil="schnitt"] > path', svg)
    };

    /* Drehpunkte in SVG-Koordinaten (Mitte des Teils, beim Blatt der Stiel). Keine Gruppe der
       Zeichnung trägt ein transform, darum gelten die Werte direkt. */
    [pizza.teig, pizza.maske].concat(pizza.mehl, pizza.stuecke, pizza.schatten, pizza.blaetter, pizza.glanz)
      .forEach(function (el) {
        G.set(el, { svgOrigin: el.getAttribute('data-ox') + ' ' + el.getAttribute('data-oy') });
      });

    /* Anfangszustände, bevor das Bild zum ersten Mal gezeichnet wird */
    G.set(pizza.blaetter, { scale: 0, rotation: -14, opacity: 0 });
    G.set(pizza.glanz, { opacity: 0, scale: 1 });
    G.set(pizza.schnitte, { drawSVG: '50% 50%' });
    if (!RUHIG) {
      G.set(pizza.teig, { scale: 0.82 });
      G.set(pizza.rand, { drawSVG: '0% 0%' });
      G.set(pizza.mehl, { opacity: 0, scale: 0 });
    }
    return true;
  }

  /* Schicht 0, Teig: zeitgesteuert beim Laden. Die Bühne steht still, Text steht sofort. */
  function teigEinstieg() {
    if (RUHIG) return;
    intro = G.timeline({ delay: 0.15 });
    intro.to(pizza.teig, { scale: 1, duration: 0.7, ease: 'teig' })
      .to(pizza.rand, { drawSVG: '0% 100%', duration: 0.6, ease: 'power2.out' })
      .to(pizza.mehl, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out', stagger: 0.04 });
  }

  /* Schicht 1, Sauce: am Scroll durch #karte, Zeitachse auf 1 normiert */
  function sauceSchicht() {
    var tl = G.timeline({
      scrollTrigger: { trigger: '#karte', start: 'top 60%', end: '+=70%', scrub: 0.8 }
    });
    /* Bei Fortschritt 0 ist die Spirale unsichtbar: runde Strichenden zeigen sonst schon bei
       drawSVG 0 % einen roten Punkt auf dem nackten Teig. */
    tl.fromTo(pizza.spirale, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: 'none' }, 0)
      .fromTo(pizza.spirale, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, ease: 'none' }, 0)
      .fromTo(pizza.maske, { scale: 0.233 }, { scale: 1, duration: 0.3, ease: 'sauce' }, 0.7)
      .fromTo(pizza.flaeche, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'sauce' }, 0.7)
      .set({}, {}, 1);
  }

  /* Schicht 2, Mozzarella: 11 Stücke landen aus der Höhe, Stück i ab 0.06 x i, Dauer 0.18.
     Kein Stück bewegt sich seitlich: nur Skala und Drehung um die eigene Mitte, der Schatten nur in y. */
  function mozzaSchicht() {
    var tl = G.timeline({
      scrollTrigger: { trigger: '#mittag', start: 'top 60%', end: '+=70%', scrub: 0.8 }
    });
    pizza.stuecke.forEach(function (stueck, i) {
      var t0 = 0.06 * i;
      var start = parseFloat(stueck.getAttribute('data-start')) || 0;
      tl.fromTo(stueck, { scale: 1.35, rotation: start }, { scale: 1, rotation: 0, duration: 0.18, ease: 'landen' }, t0)
        .fromTo(stueck, { opacity: 0 }, { opacity: 1, duration: 0.06, ease: 'landen' }, t0)
        .fromTo(pizza.schatten[i], { y: 22, scale: 1.35, opacity: 0 }, { y: 3, scale: 1, opacity: 0.28, duration: 0.18, ease: 'landen' }, t0);
    });
    tl.set({}, {}, 1);
  }

  /* Schicht 3, Basilikum: zeitgesteuert beim Eintritt in #reservation, als Pointe */
  function basilikumEin() {
    var alle = pizza.blaetter.concat(pizza.glanz);
    /* Läuft gerade das Ausblenden (Blätter noch sichtbar), geht es vom aktuellen Wert aus weiter,
       statt erst auf Skala 0 zu springen. Aus dem Ruhezustand wie im Prompt: scale 0, rotation -14. */
    var unterwegs = pizza.blaetter.some(function (b) { return G.getProperty(b, 'opacity') > 0.01; });
    G.killTweensOf(alle);
    if (RUHIG) {
      G.set(pizza.blaetter, { scale: 1, rotation: 0, opacity: 1 });
      G.set(pizza.glanz, { scale: 1, opacity: 0.7 });
      return;
    }
    var tl = G.timeline();
    if (unterwegs) tl.to(pizza.blaetter, { scale: 1, rotation: 0, opacity: 1, duration: 0.42, ease: 'blatt', stagger: 0.12 });
    else tl.fromTo(pizza.blaetter, { scale: 0, rotation: -14, opacity: 1 }, { scale: 1, rotation: 0, duration: 0.42, ease: 'blatt', stagger: 0.12 });
    tl.to(pizza.glanz, { opacity: 0.7, scale: 1, duration: 0.3, ease: 'power1.out', stagger: 0.04 });
  }
  function basilikumAus() {
    var alle = pizza.blaetter.concat(pizza.glanz);
    G.killTweensOf(alle);
    if (RUHIG) { G.set(alle, { opacity: 0, scale: 0.6 }); return; }
    G.to(alle, { opacity: 0, scale: 0.6, duration: 0.24, ease: 'power2.in', stagger: 0.04 });
  }
  function basilikumSchicht() {
    ST.create({ trigger: '#reservation', start: 'top 65%', onEnter: basilikumEin, onLeaveBack: basilikumAus });
  }

  /* Nach dem Absenden: vier Schnitte aus der Mitte, dann landet das Etikett "Tisch 7, Zeit" */
  function pizzaSchneiden(zeit) {
    var etikett = $('#tisch-etikett');
    if (etikett) etikett.textContent = 'Tisch 7, ' + zeit;
    if (!pizza || !HAT_GSAP) {
      if (etikett) etikett.style.opacity = '1';
      return;
    }
    G.killTweensOf(pizza.schnitte);
    if (etikett) G.killTweensOf(etikett);
    if (RUHIG) {
      G.set(pizza.schnitte, { drawSVG: '0% 100%' });
      if (etikett) G.set(etikett, { scale: 1, opacity: 1 });
      return;
    }
    var tl = G.timeline();
    tl.fromTo(pizza.schnitte, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 0.5, ease: 'power2.out', stagger: 0.06 });
    if (etikett) tl.fromTo(etikett, { scale: 1.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.26, ease: 'landen' });
  }

  function pizzaStarten() {
    try {
      if (!pizzaBauen()) return;
      teigEinstieg();
      sauceSchicht();
      mozzaSchicht();
      basilikumSchicht();
    } catch (e) {
      /* Lieber die fertige Pizza als eine halbe: Zustände löschen, alles sichtbar */
      if (pizza && pizza.svg) {
        G.set(pizza.svg.querySelectorAll('*'), { clearProps: 'all' });
        pizza.svg.querySelectorAll('[data-teil="schnitt"]').forEach(function (s) { s.parentNode.removeChild(s); });
      }
      pizza = null;
      throw e;
    }
  }

  /* ---------- Schichtleiste und aktiver Abschnitt im Kopf ---------- */
  function stufenUndNav() {
    var knoepfe = $$('.schichten button');
    function stufe(i) {
      knoepfe.forEach(function (b, k) {
        if (k === i) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
    }
    ['start', 'karte', 'mittag', 'reservation'].forEach(function (id, i) {
      ST.create({ trigger: '#' + id, start: 'top 60%', end: 'bottom 60%', onToggle: function (s) { if (s.isActive) stufe(i); } });
    });

    var links = $$('.kopf-nav a');
    var aktiv = null;
    function nav(id) {
      aktiv = id;
      var ziel = id === 'teller' ? 'karte' : id;
      links.forEach(function (a) {
        if (ziel && a.getAttribute('data-nav') === ziel) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }
    ['karte', 'mittag', 'reservation', 'teller', 'anfahrt'].forEach(function (id) {
      ST.create({
        trigger: '#' + id, start: 'top 60%', end: 'bottom 60%',
        onToggle: function (s) { if (s.isActive) nav(id); else if (aktiv === id) nav(null); }
      });
    });
  }

  /* ---------- Wanderndes Etikett "Tisch reservieren" (Technik nach Steckbrief Tripletta) ---------- */
  function etikettWandern() {
    var etikett = $('.etikett');
    var anker = [$('#anker-1'), $('#anker-2'), $('#anker-3')];
    if (!etikett || anker.some(function (a) { return !a; }) || !window.Flip) return;
    var Flip = window.Flip;
    var mm = G.matchMedia();
    mm.add('(min-width: 1024px)', function () {
      /* Beim Laden und beim Wechsel auf breit wird ohne Flug umgehängt: die Rückrufe der ersten
         Messung (ScrollTrigger refresh) setzen nur die Lage, erst danach fliegt das Etikett. */
      var sofort = true;
      var freigabe = 0;
      function freigeben() {
        ST.removeEventListener('refresh', freigeben);
        window.clearTimeout(freigabe);
        freigabe = window.setTimeout(function () { sofort = false; }, 80);
      }
      ST.addEventListener('refresh', freigeben);
      freigabe = window.setTimeout(freigeben, 2500);
      function haenge(n) {
        var ziel = anker[n];
        if (etikett.parentNode === ziel) return;
        if (sofort || RUHIG) {
          Flip.killFlipsOf(etikett, true);
          G.killTweensOf(etikett);
          G.set(etikett, { clearProps: 'transform' });
          ziel.appendChild(etikett);
          return;
        }
        /* Unterbrechbar: sichtbaren Zustand mitten im Flug lesen, laufenden Flug und Aufsetzen beenden,
           dann vom gelesenen Zustand aus zum neuen Anker fliegen. */
        var zustand = Flip.getState(etikett);
        Flip.killFlipsOf(etikett, true);
        G.killTweensOf(etikett);
        G.set(etikett, { clearProps: 'transform' });
        ziel.appendChild(etikett);
        Flip.from(zustand, {
          duration: 1.5, ease: 'power2.inOut', absolute: true, scale: true, zIndex: 30,
          onComplete: function () {
            G.fromTo(etikett, { scale: 1.06 }, { scale: 1, duration: 0.18, ease: 'landen', clearProps: 'transform' });
          }
        });
      }
      ST.create({ trigger: '#karte', start: 'top 70%', onEnter: function () { haenge(1); }, onLeaveBack: function () { haenge(0); } });
      ST.create({ trigger: '#reservation', start: 'top center', onEnter: function () { haenge(2); }, onLeaveBack: function () { haenge(1); } });
      return function () {
        ST.removeEventListener('refresh', freigeben);
        window.clearTimeout(freigabe);
      };
    });
  }

  /* ---------- Skizze der Anfahrt: Strassen zeichnen, Stecknadel landet ---------- */
  function skizze() {
    var strassen = $$('#skizze .strasse');
    var nadel = $('#nadel');
    var schatten = $('#nadel-schatten');
    if (!strassen.length || !nadel || !schatten) return;
    G.set(nadel, { svgOrigin: '422 258' }); /* Spitze der Nadel */
    var gespielt = false;
    skizzeEnde = function () {
      gespielt = true;
      G.killTweensOf([nadel, schatten].concat(strassen));
      G.set(strassen, { drawSVG: '0% 100%' });
      G.set(nadel, { scale: 1, opacity: 1 });
      G.set(schatten, { x: 3, y: 3, opacity: 0.28 });
    };
    if (RUHIG) { skizzeEnde(); return; }
    G.set(strassen, { drawSVG: '0%' });
    G.set(nadel, { scale: 1.3, opacity: 0 });
    G.set(schatten, { x: 0, y: 0, opacity: 0 });
    ST.create({
      trigger: '#skizze', start: 'top 65%', once: true,
      onEnter: function () {
        if (gespielt) return;
        if (RUHIG) { skizzeEnde(); return; }
        gespielt = true;
        G.timeline()
          .to(strassen, { drawSVG: '0% 100%', duration: 0.6, ease: 'power2.out', stagger: 0.04 })
          .to(nadel, { scale: 1, opacity: 1, duration: 0.3, ease: 'landen' })
          .to(schatten, { x: 3, y: 3, opacity: 0.28, duration: 0.3, ease: 'landen' }, '<');
      }
    });
  }

  /* ---------- Fuss: Farbpaar reihum, "o" dreht sich einmal ---------- */
  function fuss() {
    var el = $('#fuss');
    if (!el) return;
    var paar = 1;
    var gesehen = false;
    fussZurueck = function () { paar = 1; el.setAttribute('data-paar', '1'); };
    /* Beim ersten Erreichen steht Paar 1. Jedes erneute Erreichen (Fuss wieder zur Hälfte im Bild)
       nimmt das nächste Paar (Checkliste 12). Erst nach dem Verlassen (Oberkante wieder unter der
       halben Höhe) darf der nächste Wechsel kommen: ScrollTrigger ruft onEnter erst nach onLeaveBack. */
    ST.create({
      trigger: el,
      start: function () { return el.offsetHeight >= window.innerHeight / 2 ? 'top center' : 'center bottom'; },
      onEnter: function () {
        if (!gesehen) { gesehen = true; return; }
        if (RUHIG) return;
        paar = paar % 5 + 1;
        el.setAttribute('data-paar', String(paar));
      }
    });
    var o = $('#marke-o svg');
    if (o) {
      ST.create({
        trigger: el, start: 'top 80%', once: true,
        onEnter: function () {
          if (RUHIG) return;
          G.fromTo(o, { rotation: 0 }, { rotation: 360, duration: 0.9, ease: 'text', clearProps: 'transform' });
        }
      });
    }
  }

  /* ---------- Ebenen (Abschnitt 4.7): hinten Ring und Mehl, Mitte Pizza, vorn lose Zutaten ----------
     Die Kamera bleibt fest: die Ebenen verschieben sich nur um wenige Pixel gegeneinander.
     Zeiger (nur pointer: fine, nur über der sichtbaren Bühne): hinten 3, Mitte 6, vorn 14 px in
     Zeigerrichtung, vorn zusätzlich bis 4 Grad; Feder mit Dämpfung 1.0 und Antwort 0.6 s; verlässt der
     Zeiger die Bühne, kehrt alles in 0.8 s zur Mitte zurück.
     Scroll-Tempo (lenis.velocity) kippt nur die vorderen Zutaten: Drehung clamp(v x 0.4, -6, 6) Grad,
     y clamp(v x 0.8, -10, 10) px, Feder mit Dämpfung 0.8 und Antwort 0.5 s.
     Finger: Ziehen über der Bühne verschiebt nur die vordere Ebene (gleiche Werte), beim Loslassen
     Feder zurück. Ruhig: keine Reaktion, alle Ebenen in der Mitte.
     Eine gemeinsame Aktualisierung im gsap.ticker; will-change nur, solange sich etwas bewegt. */
  function ebenenStarten() {
    var halter = $('#buehne-halter');
    var buehne = $('#buehne');
    var ort = $('#pizza-ort');
    var T = window.TondoSVG;
    if (!halter || !buehne || !ort || !pizza || !T || !T.hintenEbene || !T.vornEbene) return;

    var hinten = T.hintenEbene();
    buehne.insertBefore(hinten, buehne.firstChild);
    var vorn = T.vornEbene();
    halter.appendChild(vorn);
    function teil(svg, n) { return svg.querySelector('[data-teil="' + n + '"]'); }
    var ring = teil(hinten, 'ring');
    var mehl = $$('[data-teil="mehl-lose"] > circle', hinten);
    var blattUnten = teil(vorn, 'blatt-unten');
    var blattOben = teil(vorn, 'blatt-oben');
    var tomate = teil(vorn, 'tomate');
    var schneider = teil(vorn, 'schneider');
    var dreh = $$('.vorn-dreh', vorn);
    var schichten = [hinten, ort, vorn];
    var breit = window.matchMedia('(min-width: 1024px)');

    /* ----- Lage: Pixel der Bühne, Masse in Einheiten der Pizza (1000 Einheiten = Höhe des Pizza-SVG) */
    function setze(el, x, y, grad, u) {
      el.setAttribute('transform', 'translate(' + r2(x) + ' ' + r2(y) + ') rotate(' + grad + ') scale(' + (Math.round(u * 10000) / 10000) + ')');
    }
    function legen() {
      var W = buehne.clientWidth;
      var H = buehne.clientHeight;
      var box = pizza.svg.getBoundingClientRect().height;
      if (!W || !H || !box) return;
      var u = box / 1000;
      var ox = ort.offsetLeft, oy = ort.offsetTop, ow = ort.offsetWidth, oh = ort.offsetHeight;
      var vb = '0 0 ' + W + ' ' + H;
      hinten.setAttribute('viewBox', vb);
      vorn.setAttribute('viewBox', vb);

      /* hinten: Ring r 470 um die Mitte der Pizza, Mehlpunkte am Rand der Pizza-Fläche */
      ring.setAttribute('cx', r2(ox + ow / 2));
      ring.setAttribute('cy', r2(oy + oh / 2));
      ring.setAttribute('r', r2(T.masse.ring * u));
      mehl.forEach(function (c) {
        c.setAttribute('cx', r2(ox + parseFloat(c.getAttribute('data-fx')) * ow));
        c.setAttribute('cy', r2(oy + parseFloat(c.getAttribute('data-fy')) * oh));
        c.setAttribute('r', r2(parseFloat(c.getAttribute('data-r')) * u));
      });

      /* vorn: Blattlänge L = 120 Einheiten; das Blatt ist um seine Mitte gezeichnet, Stiel bei -L/2 */
      var L = T.masse.blatt * u;
      if (breit.matches) {
        /* unten links: zeigt steil nach unten links (115 Grad), 30 Prozent der Länge ragen unten aus der
           Bühne (darunter ist die rechte Spalte leer). Nach links reicht es nur 3 px in den Abstand zur
           Textspalte (24 px), damit es auch mit 14 px Zeigerversatz keinen Buchstaben berührt. Die
           Schichtleiste steht rechtsbündig, die Ecke links unten ist frei. */
        setze(blattUnten, 0.211 * L - 3, H - 0.181 * L, 115, u);
      } else {
        /* Handy: Unter der Bühne laufen die Abschnitte durch, darum ragt das Blatt nur links hinaus
           (160 Grad, 30 Prozent ausserhalb, also aus dem Bild) und bleibt über der Schichtleiste. */
        setze(blattUnten, 0.188 * L, oy + oh - 36 - 0.2 * L, 160, u);
      }
      /* oben rechts: zeigt nach oben rechts (-35 Grad), 30 Prozent der Länge ragen rechts hinaus */
      setze(blattOben, W - 0.164 * L, 0.29 * L + 8, -35, u);
      /* halbe Kirschtomate unten rechts, über der Schichtleiste */
      var tr = T.masse.tomate * u;
      setze(tomate, W - tr - 24, breit.matches ? oy + oh + 8 - tr : oy + oh - 12 - tr, 0, u);
      /* Pizzaschneider oben links, 20 Grad gedreht; halbe Ausdehnung gedreht etwa 117 x 81 Einheiten */
      setze(schneider, 12 + 117 * u, 12 + 81 * u, T.masse.schneiderWinkel, u);
    }
    legen();
    if ('ResizeObserver' in window) new window.ResizeObserver(legen).observe(buehne);
    else window.addEventListener('resize', legen);
    breit.addEventListener('change', legen);

    /* ----- Federn: k = (2 pi / Antwort) hoch 2, c = 2 x Dämpfung x 2 pi / Antwort (Masse 1) */
    function feder(antwort, daempfung) { var w = 2 * Math.PI / antwort; return { k: w * w, c: 2 * daempfung * w }; }
    var F_ZEIGER = feder(0.6, 1);
    var F_ZURUECK = feder(0.8, 1);
    var F_TEMPO = feder(0.5, 0.8);
    function kanal(f) { return { x: 0, v: 0, z: 0, f: f }; }
    var k = {
      hx: kanal(F_ZEIGER), hy: kanal(F_ZEIGER),
      mx: kanal(F_ZEIGER), my: kanal(F_ZEIGER),
      vx: kanal(F_ZEIGER), vy: kanal(F_ZEIGER), vr: kanal(F_ZEIGER),
      ty: kanal(F_TEMPO), tr: kanal(F_TEMPO)
    };
    var zeigerKanaele = [k.hx, k.hy, k.mx, k.my, k.vx, k.vy, k.vr];
    var alleKanaele = zeigerKanaele.concat([k.ty, k.tr]);
    var laeuft = false;
    var sichtbar = true;
    var finger = null;
    var fein = window.matchMedia('(pointer: fine)');

    function verschiebung(x, y) { return 'translate3d(' + r2(x) + 'px,' + r2(y) + 'px,0)'; }
    function wecken() {
      if (laeuft) return;
      laeuft = true;
      schichten.forEach(function (el) { el.style.willChange = 'transform'; });
    }
    function anwenden() {
      hinten.style.transform = verschiebung(k.hx.x, k.hy.x);
      ort.style.transform = verschiebung(k.mx.x, k.my.x);
      vorn.style.transform = verschiebung(k.vx.x, k.vy.x + k.ty.x);
      var neigung = 'rotate(' + r2(k.vr.x + k.tr.x) + ')';
      dreh.forEach(function (g) { g.setAttribute('transform', neigung); });
    }
    function ruhen() {
      alleKanaele.forEach(function (c) { c.x = 0; c.v = 0; c.z = 0; });
      schichten.forEach(function (el) { el.style.transform = ''; el.style.willChange = ''; });
      dreh.forEach(function (g) { g.removeAttribute('transform'); });
      laeuft = false;
    }
    ebenenRuhe = ruhen;

    function zielSetzen(ev, nurVorn) {
      var r = halter.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var nx = klemme((ev.clientX - r.left - r.width / 2) / (r.width / 2), -1, 1);
      var ny = klemme((ev.clientY - r.top - r.height / 2) / (r.height / 2), -1, 1);
      zeigerKanaele.forEach(function (c) { c.f = F_ZEIGER; });
      k.hx.z = nurVorn ? 0 : 3 * nx; k.hy.z = nurVorn ? 0 : 3 * ny;
      k.mx.z = nurVorn ? 0 : 6 * nx; k.my.z = nurVorn ? 0 : 6 * ny;
      k.vx.z = 14 * nx; k.vy.z = 14 * ny; k.vr.z = 4 * nx;
      wecken();
    }
    function zurueck() {
      zeigerKanaele.forEach(function (c) { c.f = F_ZURUECK; c.z = 0; });
      wecken();
    }
    /* Finger: erst ab 6 px vorwiegend seitlicher Bewegung, damit senkrechtes Scrollen über der Bühne
       (touch-action: pan-y) die vordere Ebene nicht zucken lässt. */
    function fingerWeg(ev) {
      if (finger === null || ev.pointerId !== finger.id) return;
      var war = finger.aktiv;
      finger = null;
      if (war) zurueck();
    }
    halter.addEventListener('pointermove', function (ev) {
      if (RUHIG || !sichtbar) return;
      if (ev.pointerType === 'touch') {
        if (!finger || ev.pointerId !== finger.id) return;
        if (!finger.aktiv) {
          var dx = Math.abs(ev.clientX - finger.x0), dy = Math.abs(ev.clientY - finger.y0);
          if (dx <= 6 || dx < dy) return;
          finger.aktiv = true;
        }
        zielSetzen(ev, true);
        return;
      }
      if (fein.matches) zielSetzen(ev, false);
    });
    halter.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType !== 'touch' || RUHIG) return;
      finger = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, aktiv: false };
    });
    halter.addEventListener('pointerup', fingerWeg);
    halter.addEventListener('pointercancel', fingerWeg);
    halter.addEventListener('pointerleave', function (ev) {
      if (ev.pointerType === 'touch') fingerWeg(ev);
      else zurueck();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (eintraege) {
        sichtbar = eintraege[eintraege.length - 1].isIntersecting;
        if (!sichtbar) zurueck();
      }).observe(halter);
    }

    /* ----- Eine Aktualisierung pro Bild: Federn in Teilschritten von höchstens 1/120 s */
    var TEIL = 1 / 120;
    G.ticker.add(function (zeit, delta) {
      var v = (!RUHIG && sichtbar && lenis) ? (lenis.velocity || 0) : 0;
      k.tr.z = klemme(v * 0.4, -6, 6);
      k.ty.z = klemme(v * 0.8, -10, 10);
      if (k.tr.z !== 0 || k.ty.z !== 0) wecken();
      if (!laeuft) return;
      var dt = Math.min(0.05, (delta || 16.7) / 1000);
      var n = Math.max(1, Math.ceil(dt / TEIL));
      var h = dt / n;
      for (var i = 0; i < n; i++) {
        alleKanaele.forEach(function (c) {
          var a = -c.f.k * (c.x - c.z) - c.f.c * c.v;
          c.v += a * h;
          c.x += c.v * h;
        });
      }
      var still = alleKanaele.every(function (c) { return c.z === 0 && Math.abs(c.x) < 0.02 && Math.abs(c.v) < 0.05; });
      if (still) { ruhen(); return; }
      anwenden();
    });
  }

  /* ---------- Absender-Plakette: der Hebel-Helfer winkt einmal (nur pointer: fine, nicht ruhig) ---------- */
  function plakette() {
    var link = $('.plakette');
    var arm = link ? $('.arm-r', link) : null;
    if (!arm) return;
    var fein = window.matchMedia('(pointer: fine)');
    G.set(arm, { svgOrigin: '33.5 15' }); /* Schulter */
    link.addEventListener('pointerenter', function (e) {
      if (RUHIG || e.pointerType === 'touch' || !fein.matches || G.isTweening(arm)) return;
      G.fromTo(arm, { rotation: 0 }, { rotation: 18, duration: 0.25, ease: 'power1.inOut', yoyo: true, repeat: 1 });
    });
  }

  /* ---------- Schalter "Bewegung: an / ruhig" ---------- */
  function ruhigBeobachten() {
    doc.addEventListener('hebel-ruhig', function (e) {
      RUHIG = !!e.detail;
      if (!HAT_GSAP) return;
      if (RUHIG) {
        lenisStoppen();
        if (intro) intro.progress(1);
        if (fussZurueck) fussZurueck();
        if (ebenenRuhe) ebenenRuhe();
        if (window.Flip) window.Flip.killFlipsOf($('.etikett'), true);
      } else {
        lenisStarten();
      }
    });
  }

  /* ---------- Start ---------- */
  sicher('Text', textEinblenden);
  sicher('Heute', heuteSetzen);
  sicher('Kopf', kopfBeobachten);
  sicher('Menü', menue);
  sicher('Links', ankerLinks);
  sicher('Formular', formular);
  sicher('Teller', teller);
  sicher('Ruhig', ruhigBeobachten);

  if (HAT_GSAP) {
    sicher('Kurven', kurvenAnmelden);
    sicher('Lenis', function () {
      G.ticker.add(function (t) { if (lenis) lenis.raf(t * 1000); });
      G.ticker.lagSmoothing(0);
      lenisStarten();
    });
    sicher('Pizza', pizzaStarten);
    sicher('Ebenen', ebenenStarten);
    sicher('Plakette', plakette);
    sicher('Stufen', stufenUndNav);
    sicher('Etikett', etikettWandern);
    sicher('Skizze', skizze);
    sicher('Fuss', fuss);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ST.refresh(); });
  }
})();
