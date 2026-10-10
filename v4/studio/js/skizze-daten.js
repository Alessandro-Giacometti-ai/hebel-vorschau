/* Skizzen für den Film "Wie eine Website entsteht" (Startseite, Kapitel 2, 3 und 6).
   Alle Masse in Pixeln der Bildschirmaufnahme von Fumo (studio/welt/fumo-einstieg.webp, 1440 x 900).
   Die Skizze ist der Bauplan genau dieser Seite: Was in Kapitel 2 als Linie steht, wird in
   Kapitel 3 zum Block und dann zur echten Seite, am selben Ort.

   Ein Strich: { p: [[x, y], ...], t0, t1, art, ueber }
     t0, t1  Zeichenzeit 0 bis 1 (Kapitel 2 zeichnet von 0 bis 1)
     art     'haupt' kräftig, 'fein' dünn, 'mass' Bemassung, 'strich' gestrichelt
     ueber   true: Linie schiesst an den Ecken leicht über, wie von Hand gezogen
   Eine Notiz: { text, x, y, gr, t, dauer, dreh } in Seitenpixeln; gr ist die Schriftgrösse. */

export const SEITE = { b: 1440, h: 900, weltB: 4.8, weltH: 3.0 };
/* Seitenpixel in Weltkoordinaten der Seitenebene (Mitte der Seite = Ursprung, 300 px = 1 Einheit) */
export const welt = (x, y) => [(x - 720) / 300, (450 - y) / 300];

function sammler() {
  const striche = [];
  const linie = (x0, y0, x1, y1, t0, t1, art = 'haupt', ueber = art === 'haupt') => {
    striche.push({ p: [[x0, y0], [x1, y1]], t0, t1, art, ueber });
  };
  const rechteck = (x0, y0, x1, y1, t0, t1, art = 'haupt') => {
    const d = (t1 - t0) / 4;
    linie(x0, y0, x1, y0, t0, t0 + d, art);
    linie(x1, y0, x1, y1, t0 + d, t0 + 2 * d, art);
    linie(x1, y1, x0, y1, t0 + 2 * d, t0 + 3 * d, art);
    linie(x0, y1, x0, y0, t0 + 3 * d, t1, art);
  };
  const kreis = (cx, cy, r, t0, t1, art = 'fein') => {
    const p = [];
    for (let i = 0; i <= 26; i++) {
      const a = -0.6 + (i / 26) * (Math.PI * 2 + 0.5);
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.96]);
    }
    striche.push({ p, t0, t1, art, ueber: false });
  };
  const pfeil = (x0, y0, x1, y1, t0, t1) => {
    // Linie mit Pfeilspitze am Ende (x1, y1)
    linie(x0, y0, x1, y1, t0, t0 + (t1 - t0) * 0.75, 'fein', false);
    const a = Math.atan2(y1 - y0, x1 - x0);
    const l = 17;
    const t = t0 + (t1 - t0) * 0.75;
    linie(x1, y1, x1 - Math.cos(a - 0.45) * l, y1 - Math.sin(a - 0.45) * l, t, t + (t1 - t) / 2, 'fein', false);
    linie(x1, y1, x1 - Math.cos(a + 0.45) * l, y1 - Math.sin(a + 0.45) * l, t + (t1 - t) / 2, t1, 'fein', false);
  };
  return { striche, linie, rechteck, kreis, pfeil };
}

/* ---------- Kapitel 2: Entwurf der Fumo-Startseite ---------- */
const fumo = sammler();
{
  const { linie, rechteck, kreis, pfeil } = fumo;
  rechteck(0, 0, 1440, 900, 0.0, 0.14);                     // Seite
  linie(0, 30, 1440, 30, 0.14, 0.17, 'fein');               // Leiste "Beispielseite"
  rechteck(500, 150, 1404, 732, 0.17, 0.27);                // Bildfläche
  linie(500, 150, 1404, 732, 0.27, 0.31, 'fein', false);    // Kreuz: hier kommt ein Bild
  linie(1404, 150, 500, 732, 0.31, 0.35, 'fein', false);
  rechteck(63, 448, 515, 512, 0.35, 0.40);                  // Titel, Zeile 1
  rechteck(63, 528, 595, 592, 0.40, 0.45);                  // Titel, Zeile 2
  pfeil(622, 486, 530, 486, 0.45, 0.49);
  linie(63, 648, 338, 648, 0.49, 0.51, 'fein', false);      // Unterzeile
  linie(63, 677, 300, 677, 0.51, 0.53, 'fein', false);
  rechteck(63, 755, 1376, 850, 0.53, 0.60);                 // Reservierungsleiste
  linie(475, 777, 475, 829, 0.60, 0.615, 'fein', false);
  linie(786, 777, 786, 829, 0.615, 0.63, 'fein', false);
  rechteck(1072, 775, 1356, 830, 0.63, 0.67);               // Knopf
  for (let i = 0; i < 4; i++) {
    const x = 1100 + i * 62;
    linie(x, 826, x + 44, 779, 0.67 + i * 0.006, 0.675 + i * 0.006, 'fein', false);
  }
  kreis(121, 803, 11, 0.69, 0.70);
  kreis(531, 803, 11, 0.70, 0.71);
  kreis(842, 803, 11, 0.71, 0.72);
  linie(156, 814, 300, 814, 0.72, 0.73, 'fein', false);
  linie(566, 814, 616, 814, 0.73, 0.735, 'fein', false);
  linie(877, 814, 893, 814, 0.735, 0.74, 'fein', false);
  pfeil(1214, 938, 1214, 842, 0.74, 0.78);
  rechteck(63, 58, 195, 100, 0.78, 0.81);                   // Logo
  linie(967, 76, 1010, 76, 0.81, 0.82, 'fein', false);      // Navigation
  linie(1060, 76, 1110, 76, 0.82, 0.83, 'fein', false);
  linie(1160, 76, 1250, 76, 0.83, 0.84, 'fein', false);
  linie(1343, 69, 1367, 69, 0.84, 0.845, 'fein', false);
  linie(1343, 77, 1367, 77, 0.845, 0.85, 'fein', false);
  linie(1343, 85, 1367, 85, 0.85, 0.855, 'fein', false);
  linie(63, 215, 168, 215, 0.855, 0.86, 'fein', false);     // Ortszeile
  linie(63, 236, 123, 236, 0.86, 0.865, 'fein', false);
  linie(63, 257, 130, 257, 0.865, 0.87, 'fein', false);
  linie(63, 291, 105, 291, 0.87, 0.875, 'fein', false);
  // Bemassung oben und rechts, mit Schrägstrichen wie auf dem Plan
  linie(0, -18, 0, -96, 0.875, 0.885, 'mass', false);
  linie(1440, -18, 1440, -96, 0.885, 0.895, 'mass', false);
  linie(-16, -70, 1456, -70, 0.895, 0.93, 'mass', false);
  linie(-12, -58, 12, -82, 0.93, 0.935, 'mass', false);
  linie(1428, -58, 1452, -82, 0.935, 0.94, 'mass', false);
  linie(1458, 0, 1536, 0, 0.94, 0.95, 'mass', false);
  linie(1458, 900, 1536, 900, 0.95, 0.96, 'mass', false);
  linie(1510, -16, 1510, 916, 0.96, 0.99, 'mass', false);
  linie(1498, 12, 1522, -12, 0.99, 0.995, 'mass', false);
  linie(1498, 912, 1522, 888, 0.995, 1.0, 'mass', false);
}
export const SKIZZE_FUMO = fumo.striche;

export const NOTIZEN_FUMO = [
  { text: 'Bild: das Feuer, nicht der Teller', x: 540, y: 205, gr: 36, t: 0.30, dauer: 0.12, dreh: -2 },
  { text: 'ein Satz, gross', x: 636, y: 488, gr: 36, t: 0.47, dauer: 0.08, dreh: -3 },
  { text: 'reservieren ohne Anruf', x: 1036, y: 972, gr: 36, t: 0.77, dauer: 0.1, dreh: -1.5 },
  { text: 'fumo', x: 84, y: 80, gr: 34, t: 0.81, dauer: 0.04, dreh: -4 },
  { text: 'nur drei Punkte', x: 990, y: 118, gr: 26, t: 0.85, dauer: 0.06, dreh: 1.5 },
  { text: '1440', x: 684, y: -86, gr: 30, t: 0.93, dauer: 0.04, dreh: 0, mass: true },
  { text: '900', x: 1528, y: 486, gr: 30, t: 0.99, dauer: 0.03, dreh: -90, mass: true },
];

/* ---------- Kapitel 3: Blöcke, die aus der Skizze wachsen ----------
   tiefe in Welteinheiten. bild: Ausschnitt aus der Bildschirmaufnahme, der auf die Vorderseite
   einrastet. So deckt sich jeder Block am Ende genau mit der fertigen Seite. */
export const BLOECKE = [
  { id: 'bild', r: [500, 150, 1404, 732], tiefe: 0.36, bild: true },
  { id: 'titel1', r: [63, 448, 515, 512], tiefe: 0.24, bild: true },
  { id: 'titel2', r: [63, 528, 595, 592], tiefe: 0.24, bild: true },
  { id: 'unter', r: [63, 636, 340, 690], tiefe: 0.08 },
  { id: 'leiste', r: [63, 755, 1376, 850], tiefe: 0.12, bild: true },
  { id: 'knopf', r: [1072, 775, 1356, 830], tiefe: 0.26, bild: true },
  { id: 'logo', r: [63, 58, 195, 100], tiefe: 0.16, bild: true },
  { id: 'nav', r: [960, 62, 1256, 92], tiefe: 0.06 },
  { id: 'ort', r: [63, 205, 170, 265], tiefe: 0.07 },
];

/* ---------- Kapitel 6: leeres Drahtgitter für Ihren Betrieb ---------- */
const leer = sammler();
{
  const { linie, rechteck } = leer;
  rechteck(0, 0, 1440, 900, 0.0, 0.3);
  linie(0, 30, 1440, 30, 0.3, 0.36, 'fein');
  rechteck(63, 56, 250, 104, 0.36, 0.46, 'strich');
  rechteck(63, 430, 640, 604, 0.46, 0.58, 'strich');
  rechteck(700, 150, 1376, 700, 0.58, 0.74, 'strich');
  rechteck(63, 755, 1376, 850, 0.74, 0.88, 'strich');
  linie(967, 78, 1250, 78, 0.88, 0.94, 'strich', false);
}
export const SKIZZE_LEER = leer.striche;

export const NOTIZEN_LEER = [
  { text: 'Ihr Name', x: 84, y: 84, gr: 36, t: 0.5, dauer: 0.12, dreh: -3 },
  { text: 'Ihr Satz', x: 92, y: 520, gr: 52, t: 0.62, dauer: 0.12, dreh: -2 },
  { text: 'Ihre Bilder', x: 900, y: 430, gr: 48, t: 0.76, dauer: 0.12, dreh: 2 },
  { text: 'Ihre Anfrage', x: 96, y: 806, gr: 36, t: 0.9, dauer: 0.1, dreh: -1 },
];
