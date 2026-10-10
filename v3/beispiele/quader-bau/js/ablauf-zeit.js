/* Gemeinsamer Takt für "So bauen wir": dieselben Grenzen steuern die Texte im DOM und das Stapeln in 3D.
   t läuft von 0 (leerer Bauplatz) bis 1 (Übergabe). */

export const GESCHOSSE = 4;
export const ROH_START = 0.2;
export const ROH_DAUER = 0.13;
export const HUELLE_START = ROH_START + GESCHOSSE * ROH_DAUER; // 0.72
export const UEBERGABE_START = 0.88;

const klemmen = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Scroll-Fortschritt der Strecke (0..1) in Bauzeit umrechnen; am Anfang und Ende bleibt etwas Ruhe. */
export function zeitAus(fortschritt) {
  return klemmen((fortschritt - 0.03) / 0.9);
}

export function phaseBei(t) {
  if (t < ROH_START) return 0;
  if (t < HUELLE_START) return 1;
  if (t < UEBERGABE_START) return 2;
  return 3;
}

/** Fertige Geschosse: ein Geschoss zählt, sobald seine Decke liegt. */
export function geschosseBei(t) {
  return klemmen(Math.floor((t - ROH_START) / ROH_DAUER + 0.0001), 0, GESCHOSSE);
}

/** Höhenkote der obersten fertigen Kante in Metern über der Bodenplatte (±0.00), wie auf dem Plan. */
export const GESCHOSS_M = 2.95;
export const ATTIKA_M = 0.9;
export function koteBei(t) {
  if (t < ROH_START) return 0;
  const roh = klemmen((t - ROH_START) / ROH_DAUER, 0, GESCHOSSE) * GESCHOSS_M;
  if (t < HUELLE_START) return roh;
  return GESCHOSSE * GESCHOSS_M + klemmen((t - HUELLE_START) / 0.06) * ATTIKA_M;
}
export function koteText(m) {
  return m < 0.005 ? '±0.00' : '+' + m.toFixed(2);
}

export function standBei(t) {
  const phase = phaseBei(t);
  if (phase === 0) return t < 0.04 ? 'Bauplatz abgesteckt' : 'Bodenplatte';
  if (phase === 1) {
    const im = klemmen(Math.floor((t - ROH_START) / ROH_DAUER) + 1, 1, GESCHOSSE);
    return 'Geschoss ' + im + ' von ' + GESCHOSSE;
  }
  if (phase === 2) return 'Dach und Fenster';
  return 'Übergeben';
}
