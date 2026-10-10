/* Fumo: Bewegung, Menü, Karte und Reservierung (Demo-Modus, nur im Browser). */
(function () {
  'use strict';

  var html = document.documentElement;
  var ruhig = html.classList.contains('ruhig');
  var hatGsap = typeof window.gsap !== 'undefined';
  var $ = function (s, k) { return (k || document).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); };

  /* ---------- Weiches Scrollen ---------- */
  var lenis = null;
  if (!ruhig && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    window.fumoLenis = lenis;
    if (hatGsap && window.ScrollTrigger) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      var schleife = function (t) { lenis.raf(t); requestAnimationFrame(schleife); };
      requestAnimationFrame(schleife);
    }
  }
  function scrolleZu(ziel, versatz) {
    var v = typeof versatz === 'number' ? versatz : -72;
    if (lenis) { lenis.scrollTo(ziel, { offset: v, duration: 1.4 }); return; }
    var el = typeof ziel === 'string' ? $(ziel) : ziel;
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.scrollY + v;
    window.scrollTo({ top: y, behavior: ruhig ? 'auto' : 'smooth' });
  }

  /* ---------- Kopf ---------- */
  var kopf = $('[data-kopf]');
  function kopfPruefen() {
    var y = lenis ? lenis.scroll : window.scrollY;
    kopf.classList.toggle('ist-gerollt', y > 60);
  }
  if (lenis) lenis.on('scroll', kopfPruefen); else window.addEventListener('scroll', kopfPruefen, { passive: true });
  kopfPruefen();

  /* ---------- Menü ---------- */
  var menue = $('[data-menue]');
  var menueKnopf = $('[data-menue-knopf]');
  function menueSetzen(offen) {
    menue.hidden = !offen;
    menueKnopf.setAttribute('aria-expanded', String(offen));
    $('.sr', menueKnopf).textContent = offen ? 'Menü schliessen' : 'Menü öffnen';
    html.classList.toggle('menue-offen', offen);
    // Solange das Vollbild-Menü offen ist, bleibt der Fokus darin: alles dahinter ist inert
    ['.sprung', 'main', '.hinweis', '.fuss'].forEach(function (s) { var el = $(s); if (el) el.inert = offen; });
    if (lenis) { if (offen) lenis.stop(); else lenis.start(); }
    if (offen) { var erster = $('a', menue); if (erster) erster.focus(); }
  }
  menueKnopf.addEventListener('click', function () { menueSetzen(menue.hidden); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menue.hidden) { menueSetzen(false); menueKnopf.focus(); }
  });

  /* Ankerlinks laufen über Lenis */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var ziel = $(id);
      if (!ziel) return;
      e.preventDefault();
      if (!menue.hidden) menueSetzen(false);
      scrolleZu(ziel, id === '#start' || id === '#inhalt' ? 0 : -72);
      history.replaceState(null, '', id);
      // Sprunglink: der Fokus geht mit, nicht nur das Bild
      if (a.classList.contains('sprung')) ziel.focus({ preventScroll: true });
    });
  });

  /* ---------- Bewegung ---------- */
  var einstieg = $('[data-einstieg]');
  // Tastatur rückwärts in die Leiste: mit dem Film steht sie nur ganz oben im Bild, sonst ist sie ausgeblendet
  var einstiegUnten = $('[data-einstieg-unten]');
  if (einstiegUnten) einstiegUnten.addEventListener('focusin', function () {
    if (!html.classList.contains('film-an') || window.scrollY < 4) return;
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else window.scrollTo(0, 0);
  });
  if (hatGsap && !ruhig) {
    var gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(window.SplitText);
    var aus = 'expo.out';

    /* Einstieg: das Auge gewöhnt sich ans Dunkel, dann steigt die Schrift */
    var titel = $('.einstieg__titel');
    var tl = gsap.timeline({ defaults: { ease: aus } });
    einstieg.classList.add('ist-bereit');
    // Ankunft aus der Hebel-Welt: keine Einstiegsanimation, das erste Bild gleicht dem Bildschirm dort
    if (html.classList.contains('ankunft')) tl.progress(1).kill();
    else tl.fromTo('[data-einstieg-bild]', { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 2.4, ease: 'power2.out' }, 0);
    if (!html.classList.contains('ankunft')) {
      if (window.SplitText) {
        var teil = new window.SplitText(titel, { type: 'lines', mask: 'lines', linesClass: 'zeile' });
        tl.from(teil.lines, { yPercent: 108, duration: 1.5, stagger: 0.12 }, 0.45);
      } else {
        tl.from(titel, { opacity: 0, y: 30, duration: 1.2 }, 0.45);
      }
      tl.from('.einstieg__unter', { opacity: 0, y: 18, duration: 1.2 }, 0.95)
        .from('.einstieg__ort span', { opacity: 0, x: -12, duration: 1.2, stagger: 0.06 }, 1.0)
        .from('.leiste', { opacity: 0, y: 26, duration: 1.3 }, 1.1)
        .from('.kopf > *', { opacity: 0, y: -12, duration: 1.2, stagger: 0.06, clearProps: 'transform' }, 0.8);
    }

    if (!window.ScrollTrigger) html.classList.add('film-aus');
    if (window.ScrollTrigger) {
      /* Einstieg: mit Einzelbildern wird er zur Scroll-Strecke (Pfanne zu Teller), sonst der bisherige Abgang */
      filmStarten(function () {
        html.classList.add('film-aus');
        gsap.to('[data-einstieg-bild]', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: einstieg, start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.einstieg__text', { yPercent: -30, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: einstieg, start: '30% top', end: 'bottom top', scrub: true } });
      });

      /* Überschriften steigen zeilenweise aus der Maske */
      $$('main [data-teilen]').forEach(function (el) {
        if (el.closest('.einstieg')) return;
        if (window.SplitText) {
          var s = new window.SplitText(el, { type: 'lines', mask: 'lines' });
          gsap.from(s.lines, { yPercent: 108, duration: 1.3, ease: aus, stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
        }
      });
      $$('main [data-auftauchen]').forEach(function (el) {
        if (el.closest('.einstieg')) return;
        gsap.from(el, { opacity: 0, y: 22, duration: 1.2, ease: aus, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      });

      /* Bilder im Feuer-Abschnitt: von unten freigelegt wie aufsteigende Hitze */
      $$('[data-enthuellen]').forEach(function (fig) {
        var img = $('img', fig);
        // Das Bild ist schon beim Hereinkommen zur Hälfte da und liegt frei, bevor es die Mitte erreicht
        gsap.fromTo(fig, { clipPath: 'inset(45% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'top 50%', scrub: 0.6 } });
        gsap.fromTo(img, { scale: 1.22, yPercent: 6 }, { scale: 1, yPercent: 0, ease: 'none', scrollTrigger: { trigger: fig, start: 'top 95%', end: 'bottom 30%', scrub: 0.6 } });
      });
      $$('.tag__text').forEach(function (t) {
        gsap.from(t.children, { opacity: 0, y: 26, duration: 1.2, ease: aus, stagger: 0.09, scrollTrigger: { trigger: t, start: 'top 85%', once: true } });
      });

      /* Gastraum: Bild gleitet langsamer als die Seite */
      gsap.fromTo('[data-abend-bild] img', { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '[data-abend-bild]', start: 'top bottom', end: 'bottom top', scrub: true } });

      /* Ablauf: eine Glutlinie brennt mit dem Abend nach unten */
      gsap.fromTo('.ablauf', { '--brand': 0 }, { '--brand': 1, ease: 'none', scrollTrigger: { trigger: '.ablauf', start: 'top 70%', end: 'bottom 55%', scrub: 0.5 } });

      /* Karte: das Bild folgt dem Gericht in der Lesemitte */
      if (matchMedia('(min-width: 861px)').matches) {
        $$('.gericht[data-gericht]').forEach(function (z) {
          window.ScrollTrigger.create({ trigger: z, start: 'top 62%', end: 'bottom 62%', onToggle: function (st) { if (st.isActive) gerichtZeigen(z.getAttribute('data-gericht')); } });
        });
      }
    }
  } else {
    if (einstieg) einstieg.classList.add('ist-bereit');
    html.classList.add('film-aus');
  }

  /* ---------- Scroll-Film: Pfanne zu Teller ----------
     Die Bühne im Einstieg bleibt stehen, während der Abschnitt vorbeizieht. Ablauf über den Fortschritt p (0 bis 1):
     0.03 bis 0.22 taucht die Kamera in die Pfanne (Foto wächst, Film blendet ein), Titel und Leiste gehen bis 0.27,
     ab 0.2 spult der Film Bild für Bild bis 0.9, die Texte wechseln mit dem Bild, am Ende folgt die Karte. */
  function filmStarten(rueckfall) {
    var leinwand = $('[data-film]');
    var buehne = $('[data-buehne]');
    if (!leinwand || !buehne || !leinwand.getContext || typeof fetch === 'undefined') { rueckfall(); return; }
    // Datensparmodus: kein Film (rund 1.3 bis 5 MB), die zwei Standbilder reichen
    if (navigator.connection && navigator.connection.saveData) { rueckfall(); return; }
    // Erst wenn das Feuerbild da ist: der Film soll dem Heldenbild die Leitung nicht streitig machen
    var held = $('[data-einstieg-bild] img');
    if (held && !held.complete) {
      var weiter = function () { filmLaden(leinwand, buehne, rueckfall); };
      held.addEventListener('load', weiter, { once: true });
      held.addEventListener('error', weiter, { once: true });
    } else filmLaden(leinwand, buehne, rueckfall);
  }
  function filmLaden(leinwand, buehne, rueckfall) {
    fetch('/hebel-vorschau/v3/beispiele/fumo/video/meta.json').then(function (r) {
      if (!r.ok) throw new Error('keine Einzelbilder');
      return r.json();
    }).then(function (meta) {
      var schmal = window.innerWidth < 768;
      var satz = schmal && meta.mobil ? meta.mobil : meta.desktop;
      if (!satz || !satz.anzahl) throw new Error('meta unvollständig');
      filmBauen(meta, satz, leinwand, buehne, rueckfall);
    }).catch(function () { rueckfall(); });
  }

  function filmBauen(meta, satz, leinwand, buehne, rueckfall) {
    var N = satz.anzahl;
    var basis = '/hebel-vorschau/v3/beispiele/fumo/video/';
    var bilder = new Array(N), bereit = new Array(N);
    var ctx = leinwand.getContext('2d');
    var pr = Math.min(window.devicePixelRatio || 1, 1.5);
    var B = 0, H = 0, hoch = false;
    var soll = 0, gezeigt = -1, gezeigtF = -1, fAkt = 0;
    var bildImg = $('[data-einstieg-bild] img');
    var text = $('[data-einstieg-text]');
    var ort = $('.einstieg__ort');
    var unten = $('[data-einstieg-unten]');
    var schleier = $('[data-film-schleier]');
    var linie = $('[data-film-linie]');
    var linieBox = linie ? linie.parentNode : null;
    var schritte = $$('[data-film-schritte] li');
    var ab = schritte.map(function (li, i) {
      var m = meta.ablauf && meta.ablauf[i];
      return m && typeof m.ab === 'number' ? m.ab : parseFloat(li.getAttribute('data-ab')) || 0;
    });
    // Wo die Handlung im Bild liegt (Anteil der Bildbreite), damit schmale Bildschirme mitschwenken
    var FOKUS = [[0, 0.70], [0.2, 0.66], [0.38, 0.62], [0.48, 0.46], [0.6, 0.3], [0.75, 0.25], [1, 0.24]];
    function klemm(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function weich(a, b, x) { var t = klemm((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function fokus(f) {
      for (var i = 1; i < FOKUS.length; i++) {
        if (f <= FOKUS[i][0]) { var a = FOKUS[i - 1], b = FOKUS[i]; return a[1] + (b[1] - a[1]) * weich(a[0], b[0], f); }
      }
      return FOKUS[FOKUS.length - 1][1];
    }
    function adresse(i) { return basis + satz.praefix + String(i + 1).padStart(4, '0') + satz.endung; }

    function laden(i) {
      return new Promise(function (fertig) {
        if (bilder[i]) { fertig(); return; }
        var im = new Image();
        im.decoding = 'async';
        bilder[i] = im;
        im.onload = function () {
          var weiter = function () {
            bereit[i] = true;
            // Ein näheres Bild ist da: sofort zeigen
            if (gezeigt < 0 || Math.abs(i - soll) < Math.abs(gezeigt - soll)) zeichnen(true);
            fertig();
          };
          if (im.decode) im.decode().then(weiter, weiter); else weiter();
        };
        im.onerror = function () { fertig(); };
        im.src = adresse(i);
      });
    }
    function naechstes(i) {
      if (bereit[i]) return i;
      for (var d = 1; d < N; d++) {
        if (i - d >= 0 && bereit[i - d]) return i - d;
        if (i + d < N && bereit[i + d]) return i + d;
      }
      return -1;
    }

    // Hochformat-Fassung (schmal): der Ausschnitt folgt der Handlung schon im Film, er füllt den Bildschirm
    var filmHoch = satz.hoehe > satz.breite;
    function lage(f) {
      var fw = satz.breite, fh = satz.hoehe, s, dw, dh, dx, dy;
      if (filmHoch) {
        s = Math.max(B / fw, H / fh) * (1 + 0.05 * f);
        dw = fw * s; dh = fh * s;
        dx = (B - dw) / 2;
        dy = (H - dh) * 0.5;
      } else if (!hoch) {
        s = Math.max(B / fw, H / fh) * (1 + 0.07 * f);
        dw = fw * s; dh = fh * s;
        dx = klemm(B * 0.6 - fokus(f) * dw, B - dw, 0);
        dy = (H - dh) * 0.45;
      } else {
        dh = Math.min(H * 0.68, B * 1.9);
        s = dh / fh; dw = fw * s;
        dx = klemm(B * 0.5 - fokus(f) * dw, B - dw, 0);
        dy = Math.max(56, H * 0.43 - dh / 2);
      }
      return { dx: dx, dy: dy, dw: dw, dh: dh };
    }

    function zeichnen(zwang) {
      var i = naechstes(soll);
      if (i < 0 || !B) return;
      if (!zwang && i === gezeigt && Math.abs(fAkt - gezeigtF) < 0.0008) return;
      var L = lage(fAkt);
      ctx.setTransform(pr, 0, 0, pr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, B, H);
      ctx.drawImage(bilder[i], L.dx, L.dy, L.dw, L.dh);
      if (hoch && !filmHoch) {
        // Querformat-Film auf hohem Bildschirm: der Bildblock läuft oben und unten ins Dunkel aus
        ctx.globalCompositeOperation = 'destination-out';
        var oben = ctx.createLinearGradient(0, L.dy, 0, L.dy + L.dh * 0.22);
        oben.addColorStop(0, 'rgba(0,0,0,1)'); oben.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = oben; ctx.fillRect(0, L.dy - 1, B, L.dh * 0.22 + 1);
        var u = ctx.createLinearGradient(0, L.dy + L.dh * 0.66, 0, L.dy + L.dh);
        u.addColorStop(0, 'rgba(0,0,0,0)'); u.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = u; ctx.fillRect(0, L.dy + L.dh * 0.66, B, L.dh * 0.34 + 1);
        ctx.globalCompositeOperation = 'source-over';
      }
      gezeigt = i; gezeigtF = fAkt;
      // Für die Glut: wo im Bild die Kohlen liegen (unter und neben der Pfanne)
      var gx = filmHoch ? L.dx : L.dx + 0.36 * L.dw, gy = L.dy + (filmHoch ? 0.6 : 0.64) * L.dh;
      var gw = filmHoch ? L.dw : 0.64 * L.dw, gh = (filmHoch ? 0.36 : 0.34) * L.dh;
      var x0 = Math.max(0, gx), x1 = Math.min(B, gx + gw);
      filmZustand.glut = [x0, gy, Math.max(40, x1 - x0), gh];
    }

    function groesse() {
      B = leinwand.clientWidth; H = leinwand.clientHeight;
      hoch = H > B * 1.05;
      leinwand.width = Math.round(B * pr); leinwand.height = Math.round(H * pr);
      // Mitte der Pfanne im Foto (1536 x 1024, Pfanne bei 80.7 % / 77 %), nach object-fit: cover
      if (bildImg) {
        var op = getComputedStyle(bildImg).objectPosition.split(' ');
        var px = (parseFloat(op[0]) || 60) / 100, py = (parseFloat(op[1]) || 50) / 100;
        // schmal liegt der Hochformat-Ausschnitt (x 600 bis 1300 des Originals): Pfanne dort bei 91.4 %
        var nw = bildImg.naturalWidth || 1536, nh = bildImg.naturalHeight || 1024;
        var panX = /feuer-hoch/.test(bildImg.currentSrc || '') ? 0.914 : 0.807;
        var sk = Math.max(B / nw, H / nh), bw = nw * sk, bh = nh * sk;
        var mx = klemm((B - bw) * px + panX * bw, B * 0.12, B * 0.9);
        var my = klemm((H - bh) * py + 0.77 * bh, H * 0.2, H * 0.86);
        bildImg.style.transformOrigin = mx.toFixed(0) + 'px ' + my.toFixed(0) + 'px';
        leinwand.style.transformOrigin = mx.toFixed(0) + 'px ' + my.toFixed(0) + 'px';
        leinwand.style.setProperty('--fx', mx.toFixed(0) + 'px');
        leinwand.style.setProperty('--fy', my.toFixed(0) + 'px');
      }
      zeichnen(true);
    }

    var filmZustand = { deckung: 0, glut: null, fortschritt: 0 };
    window.fumoFilm = filmZustand;

    function setzen(el, deck, y) {
      if (!el) return;
      el.style.opacity = String(deck);
      el.style.transform = y ? 'translate3d(0,' + y.toFixed(1) + 'px,0)' : '';
    }

    var letzteAktiv = -2;
    function aktualisieren() {
      var r = einstieg.getBoundingClientRect();
      var strecke = r.height - buehne.offsetHeight;
      var p = strecke > 0 ? klemm(-r.top / strecke, 0, 1) : 0;
      filmZustand.fortschritt = p;

      // Eintauchen: das Foto wächst zur Pfanne hin, und aus der Pfanne öffnet sich ein Kreis, in dem der Film läuft
      var d = weich(0.03, 0.22, p);
      if (bildImg) {
        bildImg.style.transform = d > 0 ? 'scale(' + (1 + 1.5 * d * d).toFixed(4) + ')' : '';
        bildImg.style.opacity = String(1 - 0.6 * weich(0.3, 1, d));
      }
      var e = weich(0.12, 0.92, d);
      var deck = weich(0.2, 0.75, d);
      filmZustand.deckung = deck;
      var radius = Math.pow(e, 1.35) * Math.hypot(B, H) * 1.08;
      leinwand.style.opacity = e > 0 ? '1' : '0';
      leinwand.style.transform = 'scale(' + (1.22 - 0.22 * e).toFixed(4) + ')';
      leinwand.style.setProperty('--fr', radius.toFixed(1) + 'px');
      leinwand.classList.toggle('ist-offen', e >= 1);
      if (schleier) schleier.style.opacity = String(deck);

      // Titel und Leiste gehören zum ersten Drittel. Der helle Titel ist weg, bevor der Film mit dem
      // hellen Gemüse ihn hinterlegt (sonst hell auf hell)
      var t = weich(0.05, 0.16, p);
      setzen(text, 1 - t, -70 * t);
      setzen(ort, 1 - t, -40 * t);
      var u = weich(0.05, 0.15, p);
      setzen(unten, 1 - u, 36 * u);
      if (unten) unten.classList.toggle('ist-weg', u > 0.98);

      // Film spulen
      var f = klemm((p - 0.2) / 0.7, 0, 1);
      fAkt = f;
      soll = Math.round(f * (N - 1));
      zeichnen(false);
      if (linie) linie.style.transform = 'scaleX(' + f.toFixed(4) + ')';
      if (linieBox) linieBox.style.opacity = String(deck * (1 - weich(0.93, 1, p) * 0.6));

      // Bildtexte wechseln mit dem Bild, aber erst wenn der Titel Platz gemacht hat
      var aktiv = -1;
      if (p >= 0.27) { for (var i = 0; i < ab.length; i++) if (f >= ab[i]) aktiv = i; }
      if (aktiv !== letzteAktiv) {
        schritte.forEach(function (li, k) {
          li.classList.toggle('ist-aktiv', k === aktiv);
          li.classList.toggle('ist-vorbei', aktiv >= 0 && k < aktiv);
        });
        letzteAktiv = aktiv;
      }
    }

    // Erstes Bild sofort, dann die Strecke einschalten, den Rest gestaffelt nachladen
    laden(0).then(function () {
      if (!bereit[0]) throw new Error('erstes Bild fehlt');
      html.classList.add('film-an');
      groesse();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      if (lenis) lenis.resize();
      aktualisieren();
      if (lenis) lenis.on('scroll', aktualisieren); else window.addEventListener('scroll', aktualisieren, { passive: true });
      window.addEventListener('resize', function () { groesse(); aktualisieren(); });
      var naechster = 1, laufend = 0;
      function pumpe() {
        while (laufend < 4 && naechster < N) {
          laufend++;
          laden(naechster++).then(function () { laufend--; pumpe(); });
        }
      }
      // Der Rest des Films lädt erst, wenn jemand zu scrollen beginnt: wer nur den Einstieg sieht, lädt nichts nach
      var gestartet = false;
      var losgehen = function () {
        if (gestartet) return;
        gestartet = true;
        ['wheel', 'touchstart', 'keydown', 'scroll'].forEach(function (t) { window.removeEventListener(t, losgehen); });
        pumpe();
      };
      ['wheel', 'touchstart', 'keydown', 'scroll'].forEach(function (t) { window.addEventListener(t, losgehen, { passive: true }); });
      if (window.scrollY > 0) losgehen();
    }).catch(function () {
      html.classList.remove('film-an');
      rueckfall();
    });
  }

  /* ---------- Karte: Bild zum Gericht ---------- */
  function gerichtZeigen(name) {
    $$('[data-gericht-bild]').forEach(function (b) { b.classList.toggle('ist-aktiv', b.getAttribute('data-gericht-bild') === name); });
    $$('.gericht[data-gericht]').forEach(function (z) { z.classList.toggle('ist-aktiv', z.getAttribute('data-gericht') === name); });
  }
  $$('.gericht[data-gericht]').forEach(function (z) {
    z.addEventListener('mouseenter', function () { gerichtZeigen(z.getAttribute('data-gericht')); });
  });

  /* ---------- Reservierung (Demo) ---------- */
  var TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var TAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MONATE_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
  var FENSTER_TAGE = 60;
  var SPEICHER = 'fumo-demo-reservierung';

  function heute0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ausIso(s) { var t = s.split('-'); return new Date(+t[0], +t[1] - 1, +t[2]); }
  function zu(d) { var w = d.getDay(); return w === 1 || w === 2; }
  function imFenster(d) { var h = heute0(); var ende = new Date(h); ende.setDate(h.getDate() + FENSTER_TAGE); return d >= h && d <= ende; }
  function langDatum(d) { return TAGE_LANG[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear(); }
  function kurzDatum(d) { return TAGE_KURZ[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE_KURZ[d.getMonth()] + ' ' + d.getFullYear(); }
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

  var zustand = { datum: null, zeit: null, personen: 2, monat: null };
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
    zeitenZeichnen.letzterHinweis = hinweis;
    zeitenFuer(d).forEach(function (z) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zeit';
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
    var b = e.target.closest('.zeit');
    if (!b || b.disabled) return;
    zustand.zeit = b.getAttribute('data-zeit');
    $$('.zeit', zeitenBox).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
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

  function belegAktualisieren() {
    var tag = $('[data-beleg-tag]'), zeit = $('[data-beleg-zeit]'), pers = $('[data-beleg-personen]');
    tag.textContent = zustand.datum ? langDatum(ausIso(zustand.datum)) : 'noch offen';
    tag.classList.toggle('ist-offen', !zustand.datum);
    zeit.textContent = zustand.zeit ? zustand.zeit + ' Uhr' : 'noch offen';
    zeit.classList.toggle('ist-offen', !zustand.zeit);
    pers.textContent = personenText(zustand.personen);
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
    var res = { datum: zustand.datum, zeit: zustand.zeit, personen: zustand.personen, name: name, telefon: tel, wunsch: wunsch, nummer: nummer, angelegt: new Date().toISOString(), demo: true };
    schreiben(res);
    bestaetigungZeigen(res);
  });

  function bestaetigungZeigen(res) {
    $('[data-best-name]').textContent = res.name;
    $('[data-best-tag]').textContent = langDatum(ausIso(res.datum));
    $('[data-best-zeit]').textContent = res.zeit + ' Uhr';
    $('[data-best-personen]').textContent = personenText(res.personen);
    $('[data-best-telefon]').textContent = res.telefon;
    $('[data-best-wunsch]').textContent = res.wunsch;
    $('[data-best-wunsch-zeile]').hidden = !res.wunsch;
    $('[data-best-nummer]').textContent = res.nummer + ' (Demo)';
    form.hidden = true;
    best.hidden = false;
    if (hatGsap && !ruhig) {
      window.gsap.fromTo('.bestaetigung__zeichen', { scale: 0.4, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.4, ease: 'elastic.out(1, 0.6)' });
      window.gsap.from('.bestaetigung > :not(.bestaetigung__zeichen)', { opacity: 0, y: 20, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.15 });
    }
    // Das Formular ist weg, die Seite ist kürzer: erst neu vermessen, dann ohne Fahrt zur Bestätigung springen
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    if (lenis) lenis.resize();
    springeZu(best, 130);
    best.focus({ preventScroll: true });
    window.dispatchEvent(new CustomEvent('fumo:bestaetigt'));
  }
  function springeZu(el, abstand) {
    var y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - abstand);
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
  }

  $('[data-res-neu]').addEventListener('click', function () {
    best.hidden = true;
    form.hidden = false;
    zustand.zeit = null;
    if (zustand.datum) zeitenZeichnen();
    belegAktualisieren();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    if (lenis) lenis.resize();
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
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    if (lenis) lenis.resize();
    springeZu($('.res__angaben'), 140);
    $('#res-name').focus({ preventScroll: true });
  });

  /* ---------- Leiste im Einstieg ---------- */
  var lDatum = $('[data-leiste-datum]'), lZeit = $('[data-leiste-zeit]'), lPers = $('[data-leiste-personen]');
  function leisteWert(sel) {
    var w = $('[data-wert-fuer="' + sel.id + '"]');
    var opt = sel.options[sel.selectedIndex];
    if (w && opt) w.textContent = opt.textContent;
  }
  function leisteZeitenFuellen() {
    if (!lDatum.value) return;
    var d = ausIso(lDatum.value);
    var alt = lZeit.value;
    var frei = freieZeiten(d);
    lZeit.innerHTML = '';
    zeitenFuer(d).forEach(function (z) {
      var o = document.createElement('option');
      o.value = z; o.textContent = z;
      if (frei.indexOf(z) === -1) { o.disabled = true; o.textContent = z + ' (voll)'; }
      lZeit.appendChild(o);
    });
    var wahl = frei.indexOf(alt) !== -1 ? alt : (frei.indexOf('19.00') !== -1 ? '19.00' : frei[Math.floor(frei.length / 2)] || frei[0]);
    if (wahl) lZeit.value = wahl;
    leisteWert(lZeit);
  }
  var tage = offeneTage(24);
  lDatum.innerHTML = '';
  tage.forEach(function (d) {
    var o = document.createElement('option');
    o.value = iso(d); o.textContent = kurzDatum(d);
    lDatum.appendChild(o);
  });
  if (tage.length) { lDatum.value = iso(tage[0]); }
  leisteWert(lDatum);
  leisteZeitenFuellen();
  leisteWert(lPers);
  lDatum.addEventListener('change', function () { leisteWert(lDatum); leisteZeitenFuellen(); });
  lZeit.addEventListener('change', function () { leisteWert(lZeit); });
  lPers.addEventListener('change', function () { leisteWert(lPers); });

  $('[data-leiste]').addEventListener('submit', function (e) {
    e.preventDefault();
    personenSetzen(parseInt(lPers.value, 10) || 2);
    if (lDatum.value) tagWaehlen(lDatum.value, lZeit.value);
    best.hidden = true;
    form.hidden = false;
    // Tag, Zeit und Personen sind gewählt: gleich zu den Angaben, damit der Name im Bild liegt, wenn er den Fokus bekommt
    scrolleZu(zustand.zeit ? $('.res__angaben') : $('[data-reservierung]'), zustand.zeit ? -120 : -40);
    setTimeout(function () { var n = $('#res-name'); if (n && zustand.zeit) n.focus(); }, lenis ? 1500 : 400);
  });

  /* Start: frühester freier Tag vorgewählt, gespeicherte Angaben zurück */
  var alt = lesen();
  if (alt) {
    if (alt.name) $('#res-name').value = alt.name;
    if (alt.telefon) $('#res-telefon').value = alt.telefon;
  }
  if (tage.length) tagWaehlen(iso(tage[0])); else { kalenderZeichnen(); zeitenZeichnen(); }
  personenSetzen(2);
})();
