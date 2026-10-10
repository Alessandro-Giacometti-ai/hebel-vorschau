/* Fumo: Einzelbild-Filme auf Canvas, vom Scroll gespult.
   Ein Film liest meta.json, wählt den Satz für Quer- oder Hochformat und zeichnet zur Filmzeit f (0 bis 1)
   das passende Bild, mit Überblendung zum Nachbarbild. Optional zeichnet er dasselbe Bild ein zweites Mal
   als unteres Band in eine vordere Leinwand: so liegt Schrift zwischen Motiv und Vordergrund.
   Speicher: Bilder werden erst geladen, wenn der Film in der Nähe ist, und wieder freigegeben, wenn er weit weg ist. */
(function () {
  'use strict';

  function klemm(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function Film(opt) {
    this.basis = opt.basis;
    this.leinwand = opt.leinwand;
    this.ctx = opt.leinwand.getContext('2d', { alpha: true });
    this.vorne = null;
    this.fokus = opt.fokus || [0.5, 0.5];
    this.fokusHoch = opt.fokusHoch || [0.5, 0.5];
    this.schritt = opt.schritt || 1;
    this.f = 0;
    this.zoom = 1;
    this.zoomPunkt = [0.5, 0.5];
    this.hitze = 0;
    this.phase = 0;
    this.band = 0.4;
    this.bilder = [];
    this.liste = [];
    this.satz = null;
    this.bereit = false;
    this.nah = false;
    this.gezeichnet = '';
    this.angefragt = false;
    this.B = 0; this.H = 0; this.pr = 1;
    this.lage = null;
    this.beimErstenBild = null;
    this._ladend = 0; this._naechster = 0; this._reihe = [];
    this._freigabe = 0;
  }

  /* meta.json lesen und den passenden Satz wählen; lädt noch keine Bilder */
  Film.prototype.vorbereiten = function (hoch) {
    var self = this;
    return fetch(this.basis + 'meta.json').then(function (r) {
      if (!r.ok) throw new Error('meta.json fehlt');
      return r.json();
    }).then(function (meta) {
      var satz = hoch && meta.mobil ? meta.mobil : meta.desktop;
      if (!satz || !satz.anzahl) throw new Error('meta.json unvollständig');
      self.meta = meta;
      self.satz = satz;
      self.hoch = satz.hoehe > satz.breite;
      // Jedes n-te Bild: die Überblendung glättet, der Speicher bleibt in Grenzen
      var schritt = self.hoch ? 1 : self.schritt;
      for (var i = 0; i < satz.anzahl; i += schritt) self.liste.push(i);
      if (self.liste[self.liste.length - 1] !== satz.anzahl - 1) self.liste.push(satz.anzahl - 1);
      self.bilder = new Array(self.liste.length);
      // Ladereihenfolge: erstes, letztes, dann halbieren
      var n = self.liste.length, drin = {};
      var dazu = function (k) { if (k >= 0 && k < n && !drin[k]) { drin[k] = 1; self._reihe.push(k); } };
      dazu(0); dazu(n - 1);
      for (var s = 1 << Math.floor(Math.log2(Math.max(1, n - 1))); s >= 1; s >>= 1) for (var k = 0; k < n; k += s) dazu(k);
      self.messen();
      return self;
    });
  };

  Film.prototype.adresse = function (k) {
    var s = this.satz;
    return this.basis + s.praefix + String(this.liste[k] + 1).padStart(4, '0') + s.endung;
  };

  /* Das erste Bild sofort, als Versprechen: danach darf die Seite in den Filmmodus */
  Film.prototype.erstesBild = function () {
    var self = this;
    return new Promise(function (fertig, fehler) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () {
        var weiter = function () { self.bilder[0] = im; self.bereit = true; self.anfragen(); fertig(self); };
        if (im.decode) im.decode().then(weiter, weiter); else weiter();
      };
      im.onerror = function () { fehler(new Error('erstes Bild fehlt')); };
      im.src = self.adresse(0);
    });
  };

  Film.prototype.setzeNah = function (nah) {
    if (nah === this.nah) return;
    this.nah = nah;
    var self = this;
    clearTimeout(this._freigabe);
    if (nah) { this._naechster = 0; this.pumpe(); }
    else {
      // Erst nach einer Weile freigeben: wer zurückscrollt, soll nicht neu laden müssen
      this._freigabe = setTimeout(function () {
        if (self.nah) return;
        for (var k = 1; k < self.bilder.length; k++) {
          if (self.bilder[k] && k !== self.bilder.length - 1) { self.bilder[k].src = ''; self.bilder[k] = null; }
        }
        self._naechster = 0;
        self.gezeichnet = '';
      }, 6000);
    }
  };

  Film.prototype.pumpe = function () {
    var self = this;
    while (this.nah && this._ladend < 3 && this._naechster < this._reihe.length) {
      var k = this._reihe[this._naechster++];
      if (this.bilder[k]) continue;
      this._ladend++;
      (function (k) {
        var im = new Image();
        im.decoding = 'async';
        var fertig = function () {
          self._ladend--;
          if (im.naturalWidth && self.nah) { self.bilder[k] = im; self.anfragen(); }
          self.pumpe();
        };
        im.onload = function () { if (im.decode) im.decode().then(fertig, fertig); else fertig(); };
        im.onerror = function () { self._ladend--; self.pumpe(); };
        im.src = self.adresse(k);
      })(k);
    }
  };

  Film.prototype.messen = function () {
    var r = this.leinwand.getBoundingClientRect();
    if (!r.width || !this.satz) return;
    this.pr = Math.min(window.devicePixelRatio || 1, 1.25);
    var b = Math.max(1, Math.round(r.width * this.pr)), h = Math.max(1, Math.round(r.height * this.pr));
    if (b !== this.B || h !== this.H) {
      this.B = b; this.H = h;
      this.leinwand.width = b; this.leinwand.height = h;
      if (this.vorne && this.istVorne) { this.vorne.width = b; this.vorne.height = h; }
      this.gezeichnet = '';
    }
    this.cssB = r.width; this.cssH = r.height;
    this.lageRechnen();
  };

  Film.prototype.lageRechnen = function () {
    var s0 = Math.max(this.B / this.satz.breite, this.H / this.satz.hoehe) * this.zoom;
    var dw = this.satz.breite * s0, dh = this.satz.hoehe * s0;
    var fk = this.hoch ? this.fokusHoch : this.fokus;
    // Zoom um einen Punkt im Bild: der Punkt bleibt, wo er beim Zoom 1 läge
    var s1 = s0 / this.zoom, dw1 = this.satz.breite * s1, dh1 = this.satz.hoehe * s1;
    var x1 = (this.B - dw1) * fk[0], y1 = (this.H - dh1) * fk[1];
    var px = x1 + this.zoomPunkt[0] * dw1, py = y1 + this.zoomPunkt[1] * dh1;
    var dx = px - this.zoomPunkt[0] * dw, dy = py - this.zoomPunkt[1] * dh;
    dx = klemm(dx, this.B - dw, 0); dy = klemm(dy, this.H - dh, 0);
    this.lage = { dx: dx, dy: dy, dw: dw, dh: dh };
  };

  /* Ein Punkt im Bild (Anteil 0 bis 1) in CSS-Pixeln der Leinwand */
  Film.prototype.imBild = function (fx, fy) {
    if (!this.lage) return [0, 0];
    return [(this.lage.dx + fx * this.lage.dw) / this.pr, (this.lage.dy + fy * this.lage.dh) / this.pr];
  };
  Film.prototype.rechteck = function (r) {
    var a = this.imBild(r[0], r[1]), b = this.imBild(r[2], r[3]);
    return [a[0], a[1], b[0] - a[0], b[1] - a[1]];
  };

  Film.prototype.setze = function (f) {
    f = klemm(f, 0, 1);
    if (Math.abs(f - this.f) < 0.00005) return;
    this.f = f; this.anfragen();
  };
  Film.prototype.setzeZoom = function (z, punkt) {
    if (Math.abs(z - this.zoom) < 0.0004) return;
    this.zoom = z; if (punkt) this.zoomPunkt = punkt;
    this.lageRechnen(); this.anfragen();
  };
  Film.prototype.setzeHitze = function (a, phase) {
    if (a < 0.002 && this.hitze < 0.002) return;
    this.hitze = a; this.phase = phase; this.anfragen();
  };
  Film.prototype.verbindeVorne = function (leinwand, band) {
    this.vorne = leinwand; this.band = band || 0.4;
  };
  /* Nur ein Film zeichnet gleichzeitig ins vordere Band */
  Film.prototype.vorneAn = function (an) {
    if (an === this.istVorne) return;
    this.istVorne = an;
    if (an && this.vorne) { this.vorne.width = this.B; this.vorne.height = this.H; }
    this.gezeichnet = ''; this.anfragen();
  };

  Film.prototype.naechstGeladen = function (i) {
    if (this.bilder[i]) return i;
    for (var d = 1; d < this.bilder.length; d++) {
      if (this.bilder[i - d]) return i - d;
      if (this.bilder[i + d]) return i + d;
    }
    return -1;
  };

  Film.prototype.anfragen = function () {
    if (this.angefragt) return;
    this.angefragt = true;
    var self = this;
    requestAnimationFrame(function () { self.angefragt = false; self.zeichnen(); });
  };

  Film.prototype.malen = function (ctx, im, alpha, nurBand) {
    var L = this.lage, s = L.dw / this.satz.breite;
    var sw = im.naturalWidth / this.satz.breite; // Quelle kann grösser sein als in meta angegeben
    ctx.globalAlpha = alpha;
    if (nurBand) {
      var y0 = this.H * (1 - this.band);
      var sy = Math.max(0, (y0 - L.dy) / s);
      var sh = this.satz.hoehe - sy;
      if (sh > 0) ctx.drawImage(im, 0, sy * sw, im.naturalWidth, sh * sw, L.dx, L.dy + sy * s, L.dw, sh * s);
      return;
    }
    if (this.hitze > 0.003) {
      // Hitzeflimmern: der obere Teil des Bildes in Streifen, jeder leicht seitlich versetzt
      var grenze = this.H * 0.68, streifen = 26, hoeheS = grenze / streifen;
      var amp = this.hitze * 7 * this.pr;
      for (var k = 0; k < streifen; k++) {
        var yd = k * hoeheS;
        var srcY = (yd - L.dy) / s;
        if (srcY + hoeheS / s < 0) continue;
        var nahe = 1 - k / streifen;
        var ox = Math.sin(k * 0.9 + this.phase * 2.3) * amp * (0.35 + 0.65 * nahe) + Math.sin(k * 2.7 - this.phase * 3.1) * amp * 0.35;
        ctx.drawImage(im, 0, Math.max(0, srcY) * sw, im.naturalWidth, (hoeheS / s) * sw, L.dx + ox, Math.max(yd, L.dy), L.dw, hoeheS + 0.6);
      }
      var restY = (grenze - L.dy) / s;
      ctx.drawImage(im, 0, restY * sw, im.naturalWidth, (this.satz.hoehe - restY) * sw, L.dx, grenze, L.dw, L.dh - (grenze - L.dy));
      return;
    }
    ctx.drawImage(im, L.dx, L.dy, L.dw, L.dh);
  };

  Film.prototype.zeichnen = function () {
    if (!this.bereit || !this.lage) return;
    var n = this.bilder.length;
    var pos = this.f * (n - 1);
    var i0 = Math.floor(pos), anteil = pos - i0;
    var a = this.naechstGeladen(i0);
    if (a < 0) return;
    var b = (a === i0 && i0 + 1 < n && this.bilder[i0 + 1]) ? i0 + 1 : -1;
    var schluessel = a + ':' + (b >= 0 ? anteil.toFixed(3) : '') + ':' + this.B + ':' + this.zoom.toFixed(4) + ':' + this.hitze.toFixed(3) + ':' + (this.hitze > 0.003 ? this.phase.toFixed(2) : '') + ':' + (this.istVorne ? 1 : 0);
    if (schluessel === this.gezeichnet) return;
    this.gezeichnet = schluessel;
    var ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.B, this.H);
    this.malen(ctx, this.bilder[a], 1, false);
    if (b >= 0 && anteil > 0.004) this.malen(ctx, this.bilder[b], anteil, false);
    ctx.globalAlpha = 1;
    if (this.vorne && this.istVorne) {
      var v = this.vorne.getContext('2d');
      v.globalAlpha = 1;
      v.clearRect(0, 0, this.B, this.H);
      this.malen(v, this.bilder[a], 1, true);
      if (b >= 0 && anteil > 0.004) this.malen(v, this.bilder[b], anteil, true);
      v.globalAlpha = 1;
    }
    this.leinwand.setAttribute('data-bild', String(this.liste[a] + 1));
  };

  window.FumoFilm = Film;
})();
