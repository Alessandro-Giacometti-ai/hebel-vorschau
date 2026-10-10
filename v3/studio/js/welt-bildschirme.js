/* Bildschirme der Hebel-Welt (Startseite, Three.js).
   Nur diese Liste ändern, um Bilder zu tauschen. Die Szene liest Seitenverhältnis und Höhe
   selbst aus dem Bild:
   - Browser zeigen 16:10. Ein breiteres Bild wird seitlich beschnitten, ein höheres zeigt oben
     den ersten Bildschirm und gilt als ganze Seite.
   - Handys zeigen unter der Statusleiste 390:797, ebenso von oben. Ist das Bild höher (mehrere
     Bildschirme untereinander), scrollt das Handy in seiner Station bis "scrollZiel" (0 oben,
     1 ganz unten).
   - bild: null zeigt eine leere Fläche (für "Ihre Website").
   - klein: halb so grosse Fassung für schmale Bildschirme. Dort erscheinen die Bildschirme klein,
     die volle Grösse wäre nur Ladezeit und Grafikspeicher.
   Pfade absolut ab Wurzel. Bilder als WebP, Browser höchstens 1440 px, Handy höchstens 600 px breit.
   Seit 03.10.2026 echte Bildschirmbilder der fertigen Beispielseiten, aufgenommen mit Playwright:
   Browser 1440 x 900 (Einstieg), Handy 390 x 797 (unter der Statusleiste) als Streifen aus
   Einstieg und Reservierung bzw. Offerte, ferne Bildschirme als unscharfe Abschnitte.
   Neu aufnehmen nach jeder sichtbaren Änderung an einem Beispiel (pruefung/texturen.py),
   danach die Posterbilder welt-ersatz*.webp. */

export const BILDSCHIRME = [
  {
    id: 'fumo-browser',
    art: 'browser',
    rahmen: 'dunkel',
    bild: '/hebel-vorschau/v3/studio/welt/fumo-einstieg.webp',
    klein: '/hebel-vorschau/v3/studio/welt/fumo-einstieg-klein.webp',
    scrollZiel: 0,
    titel: 'Fumo, Beispielseite Restaurant',
  },
  {
    id: 'fumo-handy',
    art: 'handy',
    bild: '/hebel-vorschau/v3/studio/welt/fumo-handy-reservierung.webp',
    klein: '/hebel-vorschau/v3/studio/welt/fumo-handy-reservierung-klein.webp',
    scrollZiel: 1, // zeigt in Station 2 die Reservierung
    titel: 'Fumo auf dem Handy, Reservierung',
  },
  {
    id: 'quader-browser',
    art: 'browser',
    rahmen: 'hell',
    bild: '/hebel-vorschau/v3/studio/welt/quader-einstieg.webp',
    klein: '/hebel-vorschau/v3/studio/welt/quader-einstieg-klein.webp',
    scrollZiel: 0,
    titel: 'Quader Bau, Beispielseite Baugeschäft',
  },
  {
    id: 'quader-handy',
    art: 'handy',
    bild: '/hebel-vorschau/v3/studio/welt/quader-handy-offerte.webp',
    klein: '/hebel-vorschau/v3/studio/welt/quader-handy-offerte-klein.webp',
    scrollZiel: 1, // zeigt in Station 3 die Offerte in drei Schritten
    titel: 'Quader Bau auf dem Handy, Offerte',
  },
  {
    id: 'ihre-website',
    art: 'browser',
    rahmen: 'hell',
    bild: null,
    titel: 'Ihre Website',
  },
  // Ferne Bildschirme im Hintergrund, bewusst unscharf (Tiefe wie im Referenzbild): weitere Abschnitte der Beispiele
  { id: 'fern-1', art: 'fern', bild: '/hebel-vorschau/v3/studio/welt/fern-quader-band.webp' },
  { id: 'fern-2', art: 'fern', bild: '/hebel-vorschau/v3/studio/welt/fern-fumo-karte.webp' },
  { id: 'fern-3', art: 'fern', bild: '/hebel-vorschau/v3/studio/welt/fern-fumo-abend.webp' },
];
