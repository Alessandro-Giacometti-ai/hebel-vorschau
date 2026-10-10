/* Hebel, die Werkstatt: interaktive 3D-Startseite.
   Grundlage: docs/webstudio-2026-10/master-prompts/01-hebel-werkstatt.md (mit 00-gemeinsam.md).
   Ein Modul: HUD, Inhaltsabschnitte, Formular (aus v2 unverändert) und die 3D-Werkstatt.
   Three.js r186: Farben als Hex direkt (ColorManagement an), Texturen mit colorSpace,
   Lichtstärken physikalisch. PCFSoftShadowMap gibt es in r186 nicht mehr, darum PCFShadowMap
   mit weichem Radius. */

import * as THREE from 'three';

/* ---------- Grundlagen ---------- */
const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
/* Ruhig nur, wenn der Besucher es selbst gewählt hat (Klasse ruhig, gesetzt im Kopf aus localStorage
   hebel-ruhig). Die Systemeinstellung "reduzierte Bewegung" schaltet hier nichts ab. Umschalten wirkt live. */
let RUHIG = html.classList.contains('ruhig');
const FEIN = window.matchMedia('(pointer: fine)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const pick = a => a[Math.random() * a.length | 0];
const zwei = n => String(n).padStart(2, '0');
function angLerp(a, b, t) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }

const KONFIG = {
  supabaseUrl: 'https://dvbqxlakemsjdrcdkfxc.supabase.co',
  // Öffentlicher Anon-Schlüssel wie auf der bisherigen Seite (Rechte regelt die Datenbank).
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YnF4bGFrZW1zamRyY2RrZnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODcwMjYsImV4cCI6MjA5MzM2MzAyNn0._QdYsO4Ns3-oFOxUvGaD-qjcuSUr1iDRWRydr7BAPkg',
};

const STATIONEN = [
  {name:'Gespräch', marke:'kostenlos',
   text:'Sie erzählen, was Ihr Betrieb macht und was die Website leisten soll. Reicht ein Baukasten oder Ihre vorhandene Software, sage ich Ihnen das.',
   aufwand:'das Gespräch', dinge:['Ihre Ziele','Ihre Fragen','Notiz'],
   notiz:'Was soll die Seite leisten?', aus:'✓ in Ihren Worten notiert'},
  {name:'Angebot', marke:'Festpreis',
   text:'Sie bekommen ein schriftliches Angebot mit Festpreis, vor Baubeginn. Was drin ist und was nicht, steht darin.',
   aufwand:'lesen, nachfragen, entscheiden', dinge:['Angebot','Festpreis','Umfang'],
   notiz:'Angebot schreiben, Festpreis', aus:'✓ schriftlich, vor Baubeginn'},
  {name:'Entwurf', marke:'Handy zuerst',
   text:'Aus Ihren Bildern und Ihren Worten entsteht der Plan der Seite: was wo steht und wie ein Besucher zu Ihnen findet. Zuerst für das Handy, dann für den Bildschirm.',
   aufwand:'Bilder und Angaben liefern', dinge:['Seitenplan','Ihre Bilder','Ihre Texte'],
   notiz:'Weg zur Anfrage zeichnen', aus:'✓ der Plan steht'},
  {name:'Bau', marke:'mit Zwischenständen',
   text:'Hebel baut aus Ihren Bildern und Ihren Worten. Sie sehen Zwischenstände, bevor etwas fertig ist.',
   aufwand:'Zwischenstände ansehen, Rückmeldung geben', dinge:['Zwischenstand','Formular','Ihre Inhalte'],
   notiz:'Zwischenstand schicken', aus:'✓ Sie sehen es, bevor es fertig ist'},
  {name:'Prüfung', marke:'vor der Übergabe',
   text:'Die Seite wird am Handy und am Bildschirm geprüft: lesbar, schnell, das Formular kommt an. Was durchfällt, geht zurück an die Werkbank.',
   aufwand:'keiner', dinge:['Handy','Bildschirm','Formular'],
   notiz:'Mit dem Daumen prüfen', aus:'✓ lesbar, schnell, Formular kommt an'},
  {name:'Übergabe', marke:'alles gehört Ihnen',
   text:'Domain, Inhalte, Code und Zugänge gehören Ihnen. Wechseln Sie später, nehmen Sie alles mit.',
   aufwand:'Zugänge übernehmen, die Seite abnehmen', dinge:['Domain','Code','Zugänge'],
   notiz:'Schlüssel übergeben', aus:'✓ alles gehört Ihnen'}
];

/* Gemeinsamer Zustand zwischen HUD und Welt */
const Z = {
  zeitFaktor: 1,     // startet immer bei 1×; im ruhigen Modus läuft die Welt mit halbem Tempo (RUHIG_TEMPO)
  max: 1,            // Scrollweg der Strecke in px
  uT: 0, uS: 0,      // Ziel und geglätteter Stand (0 Hero, 1 bis 6 Stationen)
  welt: null,        // Schnittstelle der 3D-Welt, sobald gebaut
};

/* ---------- Strecke und Sprünge ---------- */
const strecke = $('#strecke');
function vermessen() { Z.max = Math.max(1, strecke.offsetHeight - innerHeight); }
function springe(k) {
  vermessen();
  window.scrollTo({ top: Math.round(k / 6 * Z.max), behavior: RUHIG ? 'auto' : 'smooth' });
}

/* ---------- Leiste, Segmente, Karte ---------- */
const leiste = $('#leiste'), balken = $('#balken');
const leisteKnoepfe = [], segmente = [];
STATIONEN.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<span class="l-nr">${zwei(i + 1)}</span><span class="l-name">${s.name}</span>`;
  b.addEventListener('click', () => springe(i + 1));
  leiste.appendChild(b); leisteKnoepfe.push(b);
  const g = document.createElement('button');
  g.type = 'button'; g.className = 'seg';
  g.setAttribute('aria-label', `Zu Station ${i + 1}: ${s.name}`);
  g.innerHTML = '<i></i>';
  g.addEventListener('click', () => springe(i + 1));
  balken.appendChild(g); segmente.push(g);
});

const karte = $('#karte'), koerper = $('#karteKoerper');
const kNr = $('#karteNr'), kMarke = $('#karteMarke'), kTitel = $('#karteTitel'), kText = $('#karteText');
const kAufwand = $('#karteAufwand'), kDinge = $('#karteDinge'), kKnopf = $('#karteKnopf');
const notizText = $('#notizText'), notizAus = $('#notizAus');
let karteK = 0, schreibToken = 0;
function karteSetzen(k, sofort) {
  if (k === karteK) return;
  karteK = k;
  const s = STATIONEN[k - 1];
  const tok = ++schreibToken;
  const tauschen = () => {
    if (tok !== schreibToken) return;
    kNr.textContent = `STATION ${zwei(k)} / 06`;
    kMarke.textContent = s.marke;
    kTitel.textContent = s.name;
    kText.textContent = s.text;
    kAufwand.textContent = s.aufwand;
    kDinge.innerHTML = s.dinge.map(d => `<li>${d}</li>`).join('');
    kKnopf.hidden = k !== 6;
    koerper.classList.remove('wechsel');
  };
  if (sofort || RUHIG) tauschen();
  else { koerper.classList.add('wechsel'); setTimeout(tauschen, 180); }
  notizAus.classList.remove('zeigen');
  notizAus.textContent = s.aus;
  if (sofort || RUHIG) { notizText.textContent = s.notiz; notizAus.classList.add('zeigen'); return; }
  notizText.textContent = '';
  let i = 0;
  const schritt = () => {
    if (tok !== schreibToken) return;
    i++;
    notizText.textContent = s.notiz.slice(0, i);
    if (i < s.notiz.length) setTimeout(schritt, 38);
    else setTimeout(() => { if (tok === schreibToken) notizAus.classList.add('zeigen'); }, 320);
  };
  setTimeout(schritt, 38);
}
karteSetzen(1, true);

/* ---------- Tempo ---------- */
const tempoKnoepfe = $$('#tempo [data-tempo]');
function tempoSetzen(v) {
  Z.zeitFaktor = v;
  tempoKnoepfe.forEach(b => {
    const an = Number(b.dataset.tempo) === v;
    b.classList.toggle('an', an);
    b.setAttribute('aria-pressed', an ? 'true' : 'false');
  });
}
tempoKnoepfe.forEach(b => b.addEventListener('click', () => tempoSetzen(Number(b.dataset.tempo))));
tempoSetzen(Z.zeitFaktor);
const RUHIG_TEMPO = 0.5;   // ruhig heisst langsamer, nicht still

/* Knopf "Bewegung": der Kopf setzt Klasse und Speicher und meldet den Wechsel hier */
document.addEventListener('hebel-ruhig', e => {
  RUHIG = !!e.detail;
  ZEIGER.an = FEIN && !RUHIG;
  if (!ZEIGER.an) { zeigerEl.classList.remove('an'); html.classList.remove('zeiger-szene'); }
});

/* ---------- Hero: kinetische Headline ---------- */
const hero = $('#hero'), headline = $('#headline');
const worte = $$('.w', headline);
const WORT_FAKTOR = [1.4, 1.1, 1.25, 0.6, 0.6];   // "nicht vergisst." bleibt am längsten
function heroAufbau() {
  html.dataset.bereit = '1';
  if (!html.classList.contains('kin')) { headline.classList.add('fertig'); return; }
  const los = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    html.classList.remove('kin');
    setTimeout(() => headline.classList.add('fertig'), 900 + 70 * (worte.length - 1) + 80);
  }));
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 700))]).then(los);
}
let zerfallAlt = -1;
function heroZerfall(u) {
  const q = Math.round(clamp(u, 0, 0.4) * 1000) / 1000;
  if (q === zerfallAlt) return;
  zerfallAlt = q;
  const fertig = headline.classList.contains('fertig');
  worte.forEach((w, i) => {
    const f = WORT_FAKTOR[i];
    const a = clamp(q / (0.35 * 0.6 / f), 0, 1);           // je grösser der Faktor, desto früher weg
    w.style.opacity = String(1 - a);
    if (RUHIG) return;
    w.style.transform = q > 0 ? `translate3d(0,${(-q * f * 120).toFixed(1)}px,0)` : '';
    if (fertig) w.firstElementChild.style.fontStretch = q > 0 ? `${(118 - 56 * a).toFixed(1)}%` : '';
  });
}

/* ---------- Überschriften zeilenweise ---------- */
function zeilenVorbereiten() {
  if (RUHIG || !('IntersectionObserver' in window)) return;
  const titel = $$('[data-zeilen]');
  const io = new IntersectionObserver(eintraege => {
    eintraege.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const h = e.target;
      h.classList.add('gezeigt');
      const n = h.querySelectorAll('.zl').length;
      setTimeout(() => { if (h.dataset.text) h.textContent = h.dataset.text; }, 700 + 90 * n + 100);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  titel.forEach(h => {
    const text = h.textContent.trim();
    h.dataset.text = text;
    const ws = text.split(/\s+/);
    h.innerHTML = ws.map(w => `<span class="zw">${w}</span>`).join(' ');
    const zeilen = [];
    let oben = null;
    $$('.zw', h).forEach(s => {
      const t = s.offsetTop;
      if (oben === null || Math.abs(t - oben) > 4) { zeilen.push([]); oben = t; }
      zeilen[zeilen.length - 1].push(s.textContent);
    });
    h.innerHTML = zeilen.map((z, i) => `<span class="zl"><span style="--i:${i}">${z.join(' ')}</span></span>`).join('');
    io.observe(h);
  });
}

/* ---------- Magnet-Knöpfe, Beispielbilder, Kapazität ---------- */
function zeigerEffekte() {
  if (!FEIN || RUHIG) return;
  const magnete = $$('.pille, .leiste button, .tempo button, .zeichnen button');
  magnete.forEach(m => m.classList.add('magnet'));
  let px = -999, py = -999, geplant = false;
  const anwenden = () => {
    geplant = false;
    magnete.forEach(m => {
      const r = m.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ax = Math.max(r.left - px, 0, px - r.right), ay = Math.max(r.top - py, 0, py - r.bottom);
      if (!RUHIG && Math.hypot(ax, ay) < 60) {
        const dx = clamp((px - cx) * 0.25, -6, 6), dy = clamp((py - cy) * 0.25, -6, 6);
        m.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
        m.dataset.mag = '1';
      } else if (m.dataset.mag) { m.style.transform = ''; delete m.dataset.mag; }
    });
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    if (!geplant) { geplant = true; requestAnimationFrame(anwenden); }
  }, { passive: true });

  $$('.bsp').forEach(b => {
    const bild = $('.bsp-bild', b);
    b.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = bild.getBoundingClientRect();
      const nx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
      const ny = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
      bild.style.setProperty('--ry', `${(nx * 4).toFixed(2)}deg`);
      bild.style.setProperty('--rx', `${(-ny * 4).toFixed(2)}deg`);
      bild.style.setProperty('--sk', '1.02');
    });
    b.addEventListener('pointerleave', () => {
      bild.style.setProperty('--ry', '0deg'); bild.style.setProperty('--rx', '0deg'); bild.style.setProperty('--sk', '1');
    });
  });
}

const kapa = $('.kapa'), kapaGross = $('.kapa-gross');
function kapaLauf() {
  if (RUHIG || !kapa) return;
  const r = kapa.getBoundingClientRect();
  if (r.bottom < -50 || r.top > innerHeight + 50) return;
  const t = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
  kapaGross.style.transform = `translate3d(${lerp(4, -4, t).toFixed(2)}%,0,0)`;
}

/* ---------- Eigener Zeiger ---------- */
const zeigerEl = $('#zeiger'), zeigerText = $('#zeiger span');
const ZEIGER = { an: FEIN && !RUHIG, x: -100, y: -100, rx: -100, ry: -100, art: '' };
function zeigerArt(art) {
  if (ZEIGER.art === art) return;
  ZEIGER.art = art;
  zeigerEl.classList.toggle('text', art === 'hallo' || art === 'ziehen' || art === 'oeffnen');
  zeigerEl.classList.toggle('stift', art === 'stift');
  zeigerEl.classList.toggle('klick', art === 'klick');
  zeigerText.textContent = art === 'ziehen' ? 'Ziehen' : art === 'oeffnen' ? 'Öffnen' : 'Hallo';
}

/* ---------- Formular (aus v2, Logik unverändert) ---------- */
function formular() {
  const f = $('[data-formular]');
  if (!f) return;
  const felder = ['name', 'email', 'firma', 'anliegen'].map(n => f.elements[n]);
  const tel = f.elements.telefon;
  const sammel = $('#formular-sammel');
  const status = $('[data-formular-status]');
  const senden = $('[data-senden]');
  const fehlerMeldung = $('[data-meldung="fehler"]');
  const erfolg = $('[data-meldung="erfolg"]');
  let versucht = false;
  let sendet = false;
  // Ohne JavaScript bleibt der Knopf gesperrt, sonst gingen die Eingaben als Adresszeile an den Server
  senden.disabled = false;

  const hilfeId = feld => { const h = $(`#${feld.id}-hilfe`); return h ? h.id : ''; };
  const setzen = (feld, text) => {
    const fe = $(`#${feld.id}-fehler`);
    fe.textContent = text;
    fe.hidden = !text;
    if (text) feld.setAttribute('aria-invalid', 'true'); else feld.removeAttribute('aria-invalid');
    const ids = [hilfeId(feld), text ? fe.id : ''].filter(Boolean).join(' ');
    if (ids) feld.setAttribute('aria-describedby', ids); else feld.removeAttribute('aria-describedby');
  };
  const pruefe = feld => {
    const v = feld.value.trim();
    const fe = $(`#${feld.id}-fehler`);
    let text = '';
    if (!v) text = fe.dataset.leer;
    else if (feld.type === 'email' && !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(v)) text = fe.dataset.ungueltig;
    setzen(feld, text);
    return !text;
  };
  const sammelPruefen = () => {
    if (!versucht) return;
    sammel.hidden = felder.every(x => x.getAttribute('aria-invalid') !== 'true');
  };
  felder.forEach(feld => {
    feld.addEventListener('blur', () => { if (versucht || feld.value.trim()) { pruefe(feld); sammelPruefen(); } });
    feld.addEventListener('input', () => { if (feld.getAttribute('aria-invalid') === 'true') { pruefe(feld); sammelPruefen(); } });
  });

  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (sendet) return;
    versucht = true;
    const ok = felder.map(pruefe);
    const erstesFalsch = ok.indexOf(false);
    if (erstesFalsch >= 0) {
      sammel.hidden = false;
      felder[erstesFalsch].focus();
      return;
    }
    sammel.hidden = true;
    fehlerMeldung.hidden = true;
    const daten = {
      firma: f.elements.firma.value.trim(),
      name: f.elements.name.value.trim(),
      email: f.elements.email.value.trim(),
      telefon: tel.value.trim(),
      region: 'CH',
      paket: 'webstudio',
      anliegen: f.elements.anliegen.value.trim(),
    };
    sendet = true;
    senden.disabled = true;
    senden.textContent = 'Wird gesendet';
    f.setAttribute('aria-busy', 'true');
    status.textContent = 'Wird gesendet';
    let angekommen = false;
    try {
      const abbruch = new AbortController();
      const frist = setTimeout(() => abbruch.abort(), 15000);
      const r = await fetch(`${KONFIG.supabaseUrl}/rest/v1/anfragen`, {
        method: 'POST',
        headers: {
          apikey: KONFIG.supabaseKey,
          Authorization: `Bearer ${KONFIG.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(daten),
        signal: abbruch.signal,
      });
      clearTimeout(frist);
      angekommen = r.ok;
    } catch (err) {
      angekommen = false;
    }
    sendet = false;
    f.removeAttribute('aria-busy');
    status.textContent = '';
    senden.disabled = false;
    senden.textContent = 'Anfrage senden';
    if (angekommen) {
      // Weiterleitung an die Auswertung, ohne Rückmeldung an die Seite (Brief 08, Abschnitt 6)
      fetch('/api/n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
        keepalive: true,
      }).catch(() => {});
      f.hidden = true;
      erfolg.hidden = false;
      erfolg.focus();
    } else {
      fehlerMeldung.hidden = false;
      fehlerMeldung.focus();
    }
    vermessen();
  });
}

/* ---------- Tastatur: Stationen mit Pfeil und Seite ---------- */
addEventListener('keydown', e => {
  if (html.classList.contains('no-webgl') || e.altKey || e.ctrlKey || e.metaKey) return;
  const ziel = e.target;
  if (ziel && ziel.closest && ziel.closest('input, textarea, select, [contenteditable="true"]')) return;
  const vor = e.key === 'ArrowDown' || e.key === 'PageDown';
  const zurueck = e.key === 'ArrowUp' || e.key === 'PageUp';
  if (!vor && !zurueck) return;
  vermessen();
  if (scrollY > Z.max + 2) return;
  const jetzt = scrollY / Z.max * 6;
  let k = vor ? Math.floor(jetzt + 0.05) + 1 : Math.ceil(jetzt - 0.05) - 1;
  if (vor && k > 6) return;               // nach Station 6 normal weiterscrollen
  k = clamp(k, 0, 6);
  e.preventDefault();
  springe(k);
});

/* ======================================================================
   Die 3D-Werkstatt
   ====================================================================== */
function welt(renderer, canvas) {
  let W = innerWidth, H = innerHeight;
  const HANDY = W < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HANDY ? 1.5 : 1.75));
  renderer.setSize(W, H, false);
  renderer.setClearColor(0xF4F4F2, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xF4F4F2, 180, 320);
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 20, 320);
  const DIR = new THREE.Vector3(-1, 1.08, 0.82).normalize();
  const RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), DIR).normalize();
  const UP = new THREE.Vector3().crossVectors(DIR, RIGHT).normalize();

  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xE9E4DA, 1.9));
  const sonne = new THREE.DirectionalLight(0xFFFAF2, 2.0);
  const SUN_OFF = new THREE.Vector3(-2, 10, 4.5).normalize().multiplyScalar(60);
  sonne.castShadow = true;
  const SM = HANDY ? 1024 : 2048;
  sonne.shadow.mapSize.set(SM, SM);
  sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03; sonne.shadow.radius = 3;
  sonne.shadow.camera.near = 1; sonne.shadow.camera.far = 160;
  scene.add(sonne); scene.add(sonne.target);

  const C = { grund:0xF4F4F2, boden:0xEDEBE6, feld:0xE4E0D8, papier:0xFFFFFF, weiss:0xFAFAF8,
    sand:0xD9D3C7, karton:0xD8B07A, band:0xE9C68E, tinte:0x0B0B0C, schiefer:0x45474C, dunkel:0x26272B,
    kobalt:0x2340FF, kobaltTief:0x1730D6, kobaltHell:0xC9D1FF, himmel:0x7FA2FF,
    gruen:0x2E9E5B, salbei:0x8DB38A, rot:0xD93A2B, butter:0xF2C14E, strahl:0xF3F5FF,
    glut:0xE2552B, kohle:0x141110, beton:0xC9C7C2, signal:0xFF6A13 };

  /* ---------- Geometrie-Helfer ---------- */
  const matCache = new Map();
  function mat(c, rough) {
    const k = c + '|' + (rough || 0);
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough || 0.62, metalness: 0 }));
    return matCache.get(k);
  }
  const geoCache = new Map();
  const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
  function achse(c, half, r, seg) { const n = 2 * seg + 1, k = c * n, a = Math.abs(k); if (a <= 0.5) return k * 2 * (half - r); return Math.sign(k) * ((half - r) + (a - 0.5) / seg * r); }
  /* abgerundete Box: unterteilte Box, Aussenbänder auf Viertelkreise gebogen, steht auf y=0 */
  function rgeo(w, h, d, r, seg) {
    seg = seg || 2; r = Math.max(0.002, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
    return cached(`r${w}|${h}|${d}|${r.toFixed(4)}|${seg}`, () => {
      const n = 2 * seg + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, hs = [w / 2, h / 2, d / 2];
      const p = [0, 0, 0], inn = [0, 0, 0], off = [0, 0, 0];
      for (let i = 0; i < P.count; i++) {
        const o = [P.getX(i), P.getY(i), P.getZ(i)];
        for (let a = 0; a < 3; a++) p[a] = achse(o[a], hs[a], r, seg);
        const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i));
        const ua = nx > 0.5 ? 2 : 0, va = ny > 0.5 ? 2 : 1;
        U.setXY(i, achse(U.getX(i) - 0.5, hs[ua], r, seg) / (2 * hs[ua]) + 0.5, achse(U.getY(i) - 0.5, hs[va], r, seg) / (2 * hs[va]) + 0.5);
        let len = 0;
        for (let a = 0; a < 3; a++) { inn[a] = clamp(p[a], -(hs[a] - r), hs[a] - r); off[a] = p[a] - inn[a]; len += off[a] * off[a]; }
        len = Math.sqrt(len);
        if (len > 1e-6) { for (let a = 0; a < 3; a++) p[a] = inn[a] + off[a] / len * r; N.setXYZ(i, off[0] / len, off[1] / len, off[2] / len); }
        P.setXYZ(i, p[0], p[1], p[2]);
      }
      g.translate(0, h / 2, 0); return g;
    });
  }
  function pgeo(w, h, d) { return cached(`p${w}|${h}|${d}`, () => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }); }
  function rcgeo(r, h, f, s) {
    f = Math.min(f, r * 0.5, h * 0.5);
    return cached(`c${r}|${h}|${f}|${s}`, () => {
      const V = THREE.Vector2, pts = [new V(0, 0), new V(r - f, 0)];
      for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new V(r - f + Math.cos(a) * f, f + Math.sin(a) * f)); }
      for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new V(r - f + Math.cos(a) * f, h - f + Math.sin(a) * f)); }
      pts.push(new V(0, h)); return new THREE.LatheGeometry(pts, s || 36);
    });
  }
  /* Kapsel, hängt am oberen Gelenk (y=0) und reicht bis y=-len */
  function capgeo(r, len) {
    return cached(`k${r}|${len}`, () => {
      const V = THREE.Vector2, pts = [];
      for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(new V(Math.max(0, Math.cos(a) * r), -len + Math.sin(a) * r)); }
      for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new V(Math.max(0, Math.cos(a) * r), Math.sin(a) * r)); }
      return new THREE.LatheGeometry(pts, 14);
    });
  }
  const sgeo = r => cached(`s${r}`, () => new THREE.SphereGeometry(r, 24, 16));
  function dreieckGeo(kante, tiefe) {
    return cached(`d${kante}|${tiefe}`, () => {
      const h = kante * Math.sqrt(3) / 2, s = new THREE.Shape();
      s.moveTo(-kante / 2, 0); s.lineTo(kante / 2, 0); s.lineTo(0, h); s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: tiefe, bevelEnabled: false });
    });
  }

  const M = c => typeof c === 'number' ? mat(c) : c;
  let CUR = scene;
  function mk(g, m, x, y, z, parent) { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); (parent || CUR).add(o); return o; }
  function box(w, h, d, c, x, y, z, parent, r) { return mk(rgeo(w, h, d, r === undefined ? Math.min(0.2, Math.min(w, h, d) * 0.3) : r), M(c), x, y, z, parent); }
  function pbox(w, h, d, c, x, y, z, parent) { return mk(pgeo(w, h, d), M(c), x, y, z, parent); }
  function cyl(r, h, c, x, y, z, parent, f) { return mk(rcgeo(r, h, f === undefined ? Math.min(0.08, r * 0.3, h * 0.3) : f), M(c), x, y, z, parent); }
  function sph(r, c, x, y, z, parent) { return mk(sgeo(r), M(c), x, y, z, parent); }
  function grp(x, y, z, parent) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); (parent || CUR).add(g); return g; }
  /* Box, bei der genau eine Seite (0=+x 1=-x 2=+y 3=-y 4=+z 5=-z) eine Canvas-Textur trägt */
  function tbox(w, h, d, c, face, tex, x, y, z, parent, lit) {
    const b = M(c); const ms = [b, b, b, b, b, b];
    ms[face] = lit ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }) : new THREE.MeshBasicMaterial({ map: tex });
    return mk(rgeo(w, h, d, Math.min(0.06, Math.min(w, h, d) * 0.3)), ms, x, y, z, parent);
  }
  const trefferMat = new THREE.MeshBasicMaterial({ visible: false });
  const ziele = [];   // unsichtbare Treffer-Boxen für Hover und Klick
  function treffer(w, h, d, x, y, z, parent, daten) {
    const m = mk(pgeo(w, h, d), trefferMat, x, y, z, parent);
    m.userData = Object.assign({ treffer: true }, daten);
    ziele.push(m); return m;
  }

  const MAXANI = renderer.capabilities.getMaxAnisotropy();
  const texDrawers = [];
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = MAXANI;
    const api = { cv, ctx, tex, w, h, draw() { ctx.save(); ctx.clearRect(0, 0, w, h); draw(ctx, w, h); ctx.restore(); tex.needsUpdate = true; } };
    api.draw(); texDrawers.push(api); return api;
  }
  const F = { schrift: '"Archivo", system-ui, sans-serif', mono: '"Atkinson Hyperlegible Mono", ui-monospace, monospace', notiz: '"Notiz", cursive' };
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function breit(x, v) { if ('fontStretch' in x) x.fontStretch = v; }
  function haken(x, cx, cy, r, an) {
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fillStyle = an ? '#2E9E5B' : '#E6E3DC'; x.fill();
    if (!an) return;
    x.strokeStyle = '#fff'; x.lineWidth = r * 0.28; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(cx - r * 0.45, cy + r * 0.02); x.lineTo(cx - r * 0.1, cy + r * 0.38); x.lineTo(cx + r * 0.5, cy - r * 0.35); x.stroke();
  }
  function kreuz(x, cx, cy, r) {
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = '#D93A2B'; x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = r * 0.26; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx - r * 0.38, cy - r * 0.38); x.lineTo(cx + r * 0.38, cy + r * 0.38);
    x.moveTo(cx + r * 0.38, cy - r * 0.38); x.lineTo(cx - r * 0.38, cy + r * 0.38); x.stroke();
  }

  /* ---------- Strecke: gerader Lauf, Kurve, gerader Lauf ---------- */
  const SX = [0, 18, 36, 54, 72, 90];
  const X0 = -9, LA = 55, RC = 7, LARC = Math.PI / 2 * RC, TX = X0 + LA, SB = LA + LARC;
  const BELT_LEN = SB + 59, BELT_Y = 0.69;
  function pathAt(s, o) {
    o = o || {};
    if (s <= LA) { o.x = X0 + s; o.z = 0; o.a = 0; }
    else if (s <= SB) { const t = (s - LA) / RC; o.x = TX + Math.sin(t) * RC; o.z = RC - Math.cos(t) * RC; o.a = -t; }
    else { o.x = TX + RC; o.z = RC + (s - SB); o.a = -Math.PI / 2; }
    return o;
  }
  const FB = new THREE.Group(); FB.rotation.y = -Math.PI / 2; FB.position.set(TX + RC, 0, RC + (81 - SB) - 54); scene.add(FB); FB.updateMatrixWorld(true);
  const FR = [scene, scene, scene, FB, FB, FB], SOFF = [9, 9, 9, 27, 27, 27];
  const TH = SX.map(x => x + 1.2);
  const THS = SX.map((x, i) => x + 1.2 + SOFF[i]);
  function toWorld(frame, x, y, z) { const v = new THREE.Vector3(x, y, z); return frame === scene ? v : frame.localToWorld(v); }
  function inFrame(i, fn) { const prev = CUR; CUR = FR[i]; fn(); CUR = prev; }
  function atPath(s) { const p = pathAt(s); const g = grp(p.x, 0, p.z, scene); g.rotation.y = p.a; return g; }

  /* ---------- Boden: Grund, Punktraster, Stationsflächen ---------- */
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat(C.boden, 0.92));
  boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; boden.userData.istBoden = true; scene.add(boden);
  const punktTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = 'rgba(11,11,12,.10)'; x.beginPath(); x.arc(w / 2, h / 2, 1.2, 0, Math.PI * 2); x.fill(); });
  punktTex.tex.wrapS = punktTex.tex.wrapT = THREE.RepeatWrapping; punktTex.tex.repeat.set(350, 350);
  const raster = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: punktTex.tex, transparent: true, depthWrite: false }));
  raster.rotation.x = -Math.PI / 2; raster.position.y = 0.006; raster.userData.istBoden = true; scene.add(raster);
  SX.forEach((x, i) => inFrame(i, () => box(15.4, 0.05, 13.4, C.feld, x + 0.5, 0, -2, null, 0.02)));
  for (let x = -14; x < 44; x += 2.4) { box(1.1, 0.03, 0.16, C.sand, x, 0.05, 5.1, null, 0.012); box(1.1, 0.03, 0.16, C.sand, x, 0.05, 2.35, null, 0.012); }
  inFrame(3, () => { for (let x = 45; x < 106; x += 2.4) { box(1.1, 0.03, 0.16, C.sand, x, 0.05, 5.1, null, 0.012); box(1.1, 0.03, 0.16, C.sand, x, 0.05, 2.35, null, 0.012); } });

  /* ---------- Förderband ---------- */
  const beltSamples = []; for (let q = 0; q <= BELT_LEN + 1e-6; q += 0.5) beltSamples.push(pathAt(q, {}));
  const side = (p, o) => [p.x + Math.sin(p.a) * o, p.z + Math.cos(p.a) * o];
  (() => {
    const pts = beltSamples.map(p => side(p, 1.18)).concat(beltSamples.map(p => side(p, -1.18)).reverse());
    const shp = new THREE.Shape(); shp.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) shp.lineTo(pts[i][0], -pts[i][1]);
    const g = new THREE.ExtrudeGeometry(shp, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 5, steps: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, 0.18, 0); mk(g, mat(C.papier), 0, 0, 0, scene);
  })();
  for (let q = 2; q < BELT_LEN; q += 8) box(0.5, 0.08, 2.3, C.schiefer, 0, 0, 0, atPath(q));
  const beltTex = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#D7D3CA'; x.fillRect(0, 0, w, h); x.fillStyle = '#C9C4B9'; x.fillRect(0, 0, 14, h); x.fillRect(128, 0, 14, h); });
  beltTex.tex.wrapS = THREE.RepeatWrapping;
  (() => {
    const pos = [], uv = [], nor = [], idx = [];
    beltSamples.forEach((p, i) => {
      const l = side(p, -1.1), r = side(p, 1.1);
      pos.push(l[0], 0.684, l[1], r[0], 0.684, r[1]); nor.push(0, 1, 0, 0, 1, 0);
      const u = i * 0.25; uv.push(u, 0, u, 1);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    mk(g, new THREE.MeshStandardMaterial({ map: beltTex.tex, roughness: 0.9 }), 0, 0, 0, scene);
  })();
  [-1.22, 1.22].forEach(o => {
    const pts = beltSamples.filter((_, i) => i % 2 === 0).map(p => { const q = side(p, o); return new THREE.Vector3(q[0], 0.66, q[1]); });
    mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 700, 0.09, 10, false), mat(C.papier), 0, 0, 0, scene);
  });
  [18, 36, 90, 108].forEach(q => {
    const g = atPath(q);
    const d = cyl(0.34, 0.1, C.kobalt, 0, 0.37, 1.28, g); d.rotation.x = Math.PI / 2;
    const d2 = cyl(0.13, 0.12, C.papier, 0, 0.37, 1.28, g); d2.rotation.x = Math.PI / 2;
  });
  // Einlauf "Ihre Anfrage" mit Briefkasten
  box(3.2, 2.3, 3.2, C.papier, -11, 0, 0, null, 0.4);
  box(3.3, 0.34, 3.3, C.kobalt, -11, 2.2, 0, null, 0.15);
  const briefkasten = box(1.3, 0.9, 0.8, C.kobalt, -11, 2.55, 0, null, 0.2);
  pbox(0.8, 0.06, 0.02, C.tinte, -11, 3.1, 0.41);
  const SCHLITZ = new THREE.Vector3(-11, 3.05, 0.55);
  // Baum in der Innenseite der Kurve
  (() => {
    const cx = TX - 0.6, cz = RC + 0.6;
    cyl(1.1, 0.6, C.papier, cx, 0, cz, null, 0.2); cyl(1.14, 0.14, C.kobalt, cx, 0.5, cz, null, 0.06); cyl(0.14, 1.3, C.karton, cx, 0.6, cz);
    sph(0.95, C.salbei, cx, 2.3, cz); sph(0.7, C.salbei, cx + 0.6, 1.9, cz + 0.3); sph(0.6, C.salbei, cx - 0.55, 2.0, cz - 0.2); sph(0.55, 0x9DC59A, cx + 0.1, 2.95, cz + 0.1);
  })();
  // Auslauf "Übergabe" mit Kistenstapel
  inFrame(5, () => {
    box(3.4, 2.6, 3.4, C.papier, 98.8, 0, 0, null, 0.4);
    box(3.5, 0.34, 3.5, C.kobalt, 98.8, 2.5, 0, null, 0.15);
    [[101.8, 0, -3.2], [103.1, 0, -3.2], [102.4, 1.0, -3.2], [101.8, 0, -1.9]].forEach(p => {
      box(1.15, 0.95, 1.15, C.karton, p[0], p[1], p[2]); box(0.26, 0.97, 1.17, C.kobalt, p[0], p[1], p[2], null, 0.04);
    });
  });

  /* ---------- Bildschirm-Seiten (klein, für Werkstücke) ---------- */
  const seiteKlein = canvasTex(256, 160, (x, w, h) => {
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, 22);
    x.fillStyle = '#D9D6CE'; rr(x, 16, 34, 130, 70, 8); x.fill();
    x.fillStyle = '#C9C6BE'; rr(x, 160, 40, 80, 10, 5); x.fill(); rr(x, 160, 58, 64, 10, 5); x.fill();
    x.fillStyle = '#2340FF'; rr(x, 160, 84, 70, 22, 11); x.fill();
    x.fillStyle = '#C9C6BE'; rr(x, 16, 118, 220, 8, 4); x.fill(); rr(x, 16, 134, 170, 8, 4); x.fill();
  });
  const seiteSchmal = canvasTex(96, 176, (x, w, h) => {
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, 20);
    x.fillStyle = '#D9D6CE'; rr(x, 10, 30, 76, 54, 6); x.fill();
    x.fillStyle = '#C9C6BE'; rr(x, 10, 94, 70, 8, 4); x.fill(); rr(x, 10, 108, 52, 8, 4); x.fill();
    x.fillStyle = '#2340FF'; rr(x, 10, 132, 76, 24, 12); x.fill();
  });

  /* ---------- Werkstücke, die sich verwandeln ---------- */
  const ITEM_SPEED = 1.5, ITEM_GAP = 4.8, ITEM_S0 = -3;
  const N_ITEMS = Math.ceil((BELT_LEN + 1.2 - ITEM_S0) / ITEM_GAP), LOOP = N_ITEMS * ITEM_GAP;
  const klappeGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.55, 0.375); s.lineTo(0.55, 0.375); s.lineTo(0, -0.02); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; })();
  function hakenStehend(g, x, y, z, s) {   // grüner Haken aus zwei Balken, stehend
    const a = box(0.1 * s, 0.3 * s, 0.05, C.gruen, x, y, z, g, 0.02); a.rotation.z = 0.75;
    const b = box(0.1 * s, 0.58 * s, 0.05, C.gruen, x, y, z, g, 0.02); b.rotation.z = -0.6;
  }
  function variante(k, parent) {
    const g = grp(0, 0, 0, parent);
    switch (k) {
      case 0: {   // Anfrage: Briefumschlag
        const e = grp(0, 0.05, 0, g);
        box(1.1, 0.08, 0.75, C.weiss, 0, 0, 0, e, 0.03);
        mk(klappeGeo, mat(0xEDEDEA), 0, 0.081, 0, e);
        cyl(0.11, 0.03, C.kobalt, 0, 0.1, 0.02, e, 0.01);
        break;
      }
      case 1:     // Notiz: Blatt mit Linien und kobaltblauer Handschrift
        box(1.0, 0.06, 1.3, C.weiss, 0, 0, 0, g, 0.03);
        [-0.42, -0.22, -0.02].forEach(z => pbox(0.64, 0.012, 0.07, 0xC9C6BE, 0, 0.06, z, g));
        [[-0.24, 0.26, 0.3], [-0.02, 0.24, -0.25], [0.18, 0.27, 0.35]].forEach(s => { const m = pbox(0.24, 0.014, 0.05, C.kobalt, s[0], 0.061, s[1], g); m.rotation.y = s[2]; });
        break;
      case 2: {   // Angebot: Blatt mit Stempel-Abdruck und Klebezettel
        box(1.0, 0.06, 1.3, C.weiss, 0, 0, 0, g, 0.03);
        [-0.42, -0.22].forEach(z => pbox(0.64, 0.012, 0.07, 0xC9C6BE, 0, 0.06, z, g));
        const ring = mk(cached('stempelring', () => new THREE.TorusGeometry(0.22, 0.025, 8, 32)), mat(C.kobalt), 0.08, 0.072, 0.26, g); ring.rotation.x = Math.PI / 2;
        pbox(0.22, 0.012, 0.06, C.kobalt, 0.08, 0.061, 0.26, g);
        const z = box(0.32, 0.012, 0.32, C.butter, -0.32, 0.061, 0.36, g, 0.005); z.rotation.y = 0.2;
        break;
      }
      case 3:     // Entwurf: Blaupause mit Drahtgitter-Blöcken
        box(1.25, 0.07, 1.25, C.kobalt, 0, 0, 0, g, 0.03);
        pbox(1.0, 0.012, 0.14, C.papier, 0, 0.07, -0.44, g);
        pbox(0.5, 0.012, 0.42, C.papier, -0.22, 0.07, -0.08, g);
        pbox(0.36, 0.012, 0.07, C.papier, 0.27, 0.07, -0.2, g); pbox(0.3, 0.012, 0.07, C.papier, 0.24, 0.07, -0.04, g);
        pbox(0.4, 0.012, 0.14, C.papier, 0.2, 0.07, 0.3, g);
        break;
      case 4:     // Seite: Bildschirm-Block
        tbox(1.2, 0.75, 0.12, C.dunkel, 4, seiteKlein.tex, 0, 0, 0, g);
        break;
      case 5:     // Geprüft: Bildschirm, Handy, Haken
        tbox(1.2, 0.75, 0.12, C.dunkel, 4, seiteKlein.tex, -0.2, 0, 0, g);
        tbox(0.34, 0.62, 0.06, C.tinte, 4, seiteSchmal.tex, 0.62, 0, 0.12, g);
        hakenStehend(g, 0.0, 0.86, 0.04, 1);
        break;
      case 6: {   // Übergabe: Kiste mit Band und Schlüssel
        box(1.15, 0.95, 1.15, C.karton, 0, 0, 0, g); box(0.26, 0.97, 1.17, C.kobalt, 0, 0, 0, g, 0.04);
        const s = grp(0.2, 0.985, 0.1, g); s.rotation.y = 0.5;
        const r = mk(cached('schluesselring', () => new THREE.TorusGeometry(0.12, 0.035, 10, 24)), mat(C.butter, 0.4), -0.2, 0.035, 0, s); r.rotation.x = Math.PI / 2;
        box(0.36, 0.05, 0.07, C.butter, 0.06, 0.01, 0, s, 0.02);
        box(0.06, 0.05, 0.12, C.butter, 0.2, 0.01, 0.07, s, 0.02);
        break;
      }
      case 7: {   // Zurück: roter Block mit weissem X
        box(1.05, 0.5, 1.05, C.rot, 0, 0, 0, g);
        const a = box(0.13, 0.04, 0.7, C.weiss, 0, 0.49, 0, g, 0.02); a.rotation.y = 0.785;
        const b = box(0.13, 0.04, 0.7, C.weiss, 0, 0.49, 0, g, 0.02); b.rotation.y = -0.785;
        break;
      }
    }
    g.visible = false; return g;
  }
  const items = [];
  for (let i = 0; i < N_ITEMS; i++) {
    const g = grp(0, BELT_Y, 0); const vs = [];
    for (let k = 0; k < 8; k++) vs.push(variante(k, g));
    items.push({ g, vs, s: ITEM_S0 + i * ITEM_GAP, v: -1, cur: -1, fail: Math.random() < 0.2, rej: null, gone: false });
  }
  const variantAt = q => { let v = 0; for (let i = 0; i < THS.length; i++) if (q > THS[i]) v = i + 1; return v; };

  /* ---------- Blitz-Ringe (Stempel-Aufschlag) ---------- */
  const ringGeo = new THREE.RingGeometry(0.5, 0.64, 40); ringGeo.rotateX(-Math.PI / 2);
  const ringe = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false }));
    m.userData.ohneSchatten = true; m.visible = false; scene.add(m); ringe.push({ m, t: 1 });
  }
  const tmpV = new THREE.Vector3();
  function blitz(frame, x, y, z) {
    const r = ringe.find(q => q.t >= 1) || ringe[0];
    r.t = 0; r.m.visible = true; r.m.position.copy(toWorld(frame, x, y, z));
  }

  /* ---------- Pressen und Stempel über dem Band ---------- */
  const pressen = [];
  SX.forEach((sx, i) => {
    if (i === 4) return;
    inFrame(i, () => {
      const x = TH[i];
      box(0.3, 2.7, 0.3, C.papier, x, 0, 1.62); box(0.3, 2.7, 0.3, C.papier, x, 0, -1.62); box(0.56, 0.4, 3.56, C.papier, x, 2.65, 0);
      const lampMat = new THREE.MeshStandardMaterial({ color: C.salbei, emissive: C.salbei, emissiveIntensity: 0.4 });
      sph(0.15, lampMat, x, 3.12, 0);
      const head = grp(x, 2.05, 0); cyl(0.07, 1.2, C.schiefer, 0, 0.3, 0, head); cyl(0.62, 0.32, C.kobalt, 0, 0, 0, head, 0.1);
      pressen.push({ i, x, s: THS[i], head, lampMat, unten: false });
    });
  });

  /* ---------- Die Helfer ---------- */
  const helfer = [];
  const schattenGeo = new THREE.CircleGeometry(0.6, 28);
  const schattenMat = new THREE.MeshBasicMaterial({ color: 0x1A1F4A, transparent: true, opacity: 0.12, depthWrite: false });
  const helferMat = new THREE.MeshStandardMaterial({ color: C.kobalt, roughness: 0.45 });
  const emblemMat = new THREE.MeshStandardMaterial({ color: C.strahl, roughness: 0.55 });
  const CAMF = Math.atan2(DIR.x, DIR.z);
  const faceTo = (dx, dz) => Math.atan2(dx, dz);
  function glied(parent, x, y, z, r, l1, l2) {
    const a = grp(x, y, z, parent); mk(capgeo(r, l1), helferMat, 0, 0, 0, a);
    const b = grp(0, -l1, 0, a); mk(capgeo(r, l2), helferMat, 0, 0, 0, b);
    return { a, b };
  }
  function makeBot(o) {
    const S = o.scale || 0.92;
    const root = grp(o.x, 0, o.z);
    const sh = new THREE.Mesh(schattenGeo, schattenMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.userData.ohneSchatten = true; root.add(sh);
    const hop = grp(0, 0, 0, root), body = grp(0, 0, 0, hop);
    mk(rgeo(1.05, 1.05, 0.6, 0.24, 3), helferMat, 0, 0.55, 0, body);
    // Hebel-Zeichen vorne: Balken über dem Dreieck (Drehpunkt)
    const balkenM = mk(rgeo(0.62, 0.08, 0.03, 0.03), emblemMat, 0, 1.12, 0.31, body); balkenM.rotation.z = -0.24;
    mk(dreieckGeo(0.34, 0.03), emblemMat, 0, 0.86, 0.3, body);
    const armL = glied(body, -0.52, 1.0, 0, 0.055, 0.26, 0.24), armR = glied(body, 0.52, 1.0, 0, 0.055, 0.26, 0.24);
    sph(0.085, helferMat, 0, -0.27, 0, armL.b).scale.set(1, 1.1, 0.8); sph(0.085, helferMat, 0, -0.27, 0, armR.b).scale.set(1, 1.1, 0.8);
    const beine = [-0.2, 0.2].map(lx => { const L = glied(hop, lx, 0.62, 0, 0.065, 0.25, 0.25); const f = sph(0.12, helferMat, 0, -0.28, 0.05, L.b); f.scale.set(0.95, 0.55, 1.4); return L; });
    const hit = new THREE.Mesh(pgeo(1.5, 1.9, 1.1), trefferMat); root.add(hit);
    const blick = o.face === undefined ? CAMF - CUR.rotation.y : o.face;
    root.scale.setScalar(S); root.rotation.y = blick;
    const b = { root, hop, body, armL, armR, beine, S, mode: o.mode || 'idle', lines: o.lines, name: o.name, station: o.station || 0,
      phase: Math.random() * 10, hopT: -1, path: o.path || null, pi: 0, at: 0, wait: 0, speed: o.speed || 1.4, cheer: 0,
      waitFace: o.waitFace, carry: o.carry !== undefined, blick, letzt: '', frame: CUR };
    if (o.carry !== undefined) b.traglast = box(0.7, 0.07, 0.5, o.carry, 0, 1.62, 0, body, 0.03);
    if (o.tool === 'lupe') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 10, 28), mat(C.tinte)); ring.position.set(0, -0.5, 0.08); armR.b.add(ring);
      const glas = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshStandardMaterial({ color: 0xDDE4FF, transparent: true, opacity: 0.75, roughness: 0.1 }));
      glas.position.copy(ring.position); glas.userData.ohneSchatten = true; armR.b.add(glas);
    }
    hit.userData = { treffer: true, bot: b }; ziele.push(hit); helfer.push(b);
    return b;
  }
  function setArm(A, x, z, ex, ez, k) { A.a.rotation.x = lerp(A.a.rotation.x, x, k); A.a.rotation.z = lerp(A.a.rotation.z, z, k); A.b.rotation.x = lerp(A.b.rotation.x, ex, k); A.b.rotation.z = lerp(A.b.rotation.z, ez || 0, k); }
  let wipp = 0;   // Mitwippen bei schnellem Scroll
  function updateBot(b, dt, rdt, T) {
    const t = T + b.phase; let moving = false;
    if (b.path) {
      if (b.wait > 0) { b.wait -= dt; if (b.waitFace !== undefined) b.root.rotation.y = angLerp(b.root.rotation.y, b.waitFace[b.at], Math.min(1, dt * 5)); }
      else {
        const tg = b.path[b.pi], dx = tg[0] - b.root.position.x, dz = tg[1] - b.root.position.z, dist = Math.hypot(dx, dz);
        if (dist < 0.04) {
          if (b.tour) {
            if (b.pi === 1) { b.wait = 0.9; b.at = 1; b.pi = 0; b.tour.ab && b.tour.ab(); }
            else { const fertig = b.tour.fertig; b.path = null; b.tour = null; fertig && fertig(); }
          } else { b.wait = 1.6; b.at = b.pi; b.pi = (b.pi + 1) % b.path.length; }
        } else {
          const st = Math.min(dist, b.speed * dt); b.root.position.x += dx / dist * st; b.root.position.z += dz / dist * st;
          b.root.rotation.y = angLerp(b.root.rotation.y, faceTo(dx, dz), Math.min(1, dt * 8)); moving = dt > 0;
        }
      }
    } else if (dt > 0) b.root.rotation.y = angLerp(b.root.rotation.y, b.blick, Math.min(1, dt * 5));
    const k = Math.min(1, rdt * 10 + 0.05);
    const p = t * 9;
    b.beine.forEach((L, i) => {
      const ph = p + i * Math.PI;
      const hip = moving ? -Math.sin(ph) * 0.55 : 0;
      const knee = moving ? 0.1 + Math.max(0, Math.sin(ph + 1.3)) * 0.95 : 0.05;
      L.a.rotation.x = lerp(L.a.rotation.x, hip, 0.35); L.b.rotation.x = lerp(L.b.rotation.x, knee, 0.35);
    });
    let bob = moving ? Math.abs(Math.sin(p)) * 0.07 : (Math.sin(t * 2) * 0.018 + 0.018);
    let neigung = moving ? 0.08 : 0;
    b.body.rotation.z = lerp(b.body.rotation.z, moving ? Math.sin(p) * 0.06 : Math.sin(t * 1.3) * 0.02, 0.2);
    const sw = moving ? Math.sin(p) * 0.5 : Math.sin(t * 1.6) * 0.05;
    let L = [sw, -0.2, -0.3, 0], R = [-sw, 0.2, -0.3, 0];
    b.body.rotation.y = 0;
    switch (b.mode) {
      case 'type': L = [-1.15 + Math.sin(t * 15) * 0.12, -0.28, -0.75, 0]; R = [-1.15 + Math.sin(t * 15 + Math.PI) * 0.12, 0.28, -0.75, 0]; bob += Math.abs(Math.sin(t * 8)) * 0.015; break;
      case 'point': R = [-1.45, 0.35 + Math.sin(t * 2) * 0.12, -0.1, 0]; break;
      case 'write': R = [-1.9 + Math.sin(t * 6) * 0.2, 0.45 + Math.sin(t * 3) * 0.3, -0.5, 0]; break;
      case 'inspect': R = [-1.25, 0.25, -0.9, 0]; b.body.rotation.y = Math.sin(t * 0.9) * 0.45; break;
      case 'wave': if (Math.sin(t * 0.7) > 0.3) R = [0, 2.55, 0, 0.55 * Math.sin(t * 12)]; break;
      case 'stempeln': R = [-1.6 + Math.max(0, Math.sin(t * 5.2)) * 1.1, 0.3, -0.4, 0]; break;
      case 'ziehen': {
        const z = (Math.sin(t * 4) + 1) / 2;
        L = [-2.3 + z * 1.6, -0.2, -0.3, 0]; R = [-2.3 + z * 1.6, 0.2, -0.3, 0]; neigung = 0.08 + z * 0.22; break;
      }
    }
    if (b.carry) { L = [0, -2.7, 0, -0.9]; R = [0, 2.7, 0, 0.9]; }
    if (b.cheer > 0) { b.cheer -= rdt; L = [0, -2.6, 0, 0.4 * Math.sin(t * 14 + b.cheer * 20)]; R = [0, 2.6, 0, -0.4 * Math.sin(t * 14 + b.cheer * 20)]; bob += Math.abs(Math.sin(b.cheer * 9)) * 0.22; }
    b.body.rotation.x = lerp(b.body.rotation.x, neigung + wipp, 0.1);
    setArm(b.armL, L[0], L[1], L[2], L[3], k); setArm(b.armR, R[0], R[1], R[2], R[3], k);
    b.body.position.y = bob;
    if (b.hopT >= 0) {
      b.hopT += rdt; const q = b.hopT / 0.55;
      if (q >= 1) { b.hopT = -1; b.hop.position.y = 0; b.hop.rotation.y = 0; }
      else { b.hop.position.y = Math.sin(Math.PI * q) * 0.75; b.hop.rotation.y = q * Math.PI * 2; }
    }
  }

  /* ================= Station 1, Gespräch ================= */
  let notizHaken = 2;
  const notizTex = canvasTex(512, 320, (x, w, h) => {
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#0B0B0C'; x.font = `600 26px ${F.mono}`; x.fillText('Notiz, Erstgespräch', 26, 46);
    x.fillStyle = '#2340FF'; rr(x, 26, 58, 96, 7, 3.5); x.fill();
    x.fillStyle = '#F2C14E'; rr(x, 370, 150, 114, 114, 10); x.fill();
    x.fillStyle = '#0B0B0C'; x.font = `850 66px ${F.schrift}`; x.textAlign = 'center'; x.fillText('?', 427, 232); x.textAlign = 'left';
    ['Was macht Ihr Betrieb?', 'Was soll die Seite leisten?', 'Gibt es schon eine Seite?', 'Bilder vorhanden?'].forEach((t, i) => {
      const y = 112 + i * 50;
      haken(x, 38, y - 9, 12, i < notizHaken);
      x.fillStyle = '#1730D6'; x.font = `30px ${F.notiz}`; x.fillText(t, 62, y, i === 0 ? 420 : 296);
    });
  });
  // Notizwand zur Kamera gedreht (v3-Fix): flach zur Kamera war die Notiz kaum lesbar
  const notizWand = grp(-3.0, 0, -6.3); notizWand.rotation.y = -0.55;
  cyl(0.07, 0.85, C.schiefer, -2.1, 0, 0, notizWand); cyl(0.07, 0.85, C.schiefer, 2.1, 0, 0, notizWand);
  box(0.9, 0.08, 0.9, C.schiefer, -2.1, 0, 0, notizWand); box(0.9, 0.08, 0.9, C.schiefer, 2.1, 0, 0, notizWand);
  const notizTafel = tbox(4.6, 2.8, 0.16, C.kobalt, 4, notizTex.tex, 0, 0.8, 0, notizWand, true);
  treffer(4.6, 2.8, 0.5, 0, 0.8, 0, notizWand, { aktion: 'notiz', zeiger: 'klick' });
  // Gesprächstisch, Stühle, Tassen
  cyl(0.1, 0.76, C.schiefer, 1.6, 0, -4.6); cyl(0.5, 0.05, C.schiefer, 1.6, 0, -4.6, null, 0.02);
  cyl(1.25, 0.1, C.papier, 1.6, 0.76, -4.6, null, 0.04);
  [[0.2, Math.PI / 2], [3.0, -Math.PI / 2]].forEach(([sx, ry]) => {
    const s = grp(sx, 0, -4.6); s.rotation.y = ry;
    [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(p => cyl(0.04, 0.45, C.schiefer, p[0], 0, p[1], s));
    box(0.7, 0.08, 0.7, C.weiss, 0, 0.45, 0, s, 0.03);
    box(0.7, 0.7, 0.08, C.weiss, 0, 0.5, -0.31, s, 0.03);
  });
  const tassen = [[1.15, -4.45], [2.05, -4.75]].map(p => {
    cyl(0.12, 0.2, C.weiss, p[0], 0.86, p[1], null, 0.03);
    const hk = mk(cached('henkel', () => new THREE.TorusGeometry(0.06, 0.018, 8, 16)), mat(C.weiss), p[0] + 0.13, 0.96, p[1]); hk.rotation.y = Math.PI / 2;
    return p;
  });
  const dampfMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.6, roughness: 1, depthWrite: false });
  const dampf = [0, 1 / 3, 2 / 3].map(off => { const m = sph(0.06, dampfMat.clone(), tassen[0][0], 1.1, tassen[0][1]); m.userData.ohneSchatten = true; return { m, off }; });
  const zuhoeren = makeBot({ x: -1.2, z: -4.2, face: Math.PI * 1.1, mode: 'write', name: 'ZUHÖREN', station: 1,
    lines: ['Was macht Ihr Betrieb? Ich schreibe mit.', 'Erzählen Sie, die Technik kommt später.', 'Reicht ein Baukasten, sage ich Ihnen das.', 'Ihre Worte, nicht meine.'] });
  makeBot({ x: 3.4, z: -3.3, path: [[3.4, -3.3], [0.9, -2.05]], waitFace: [Math.PI, CAMF], carry: C.weiss, name: 'NOTIZ', station: 1,
    lines: ['Die Notiz geht aufs Band.', 'Ich bringe Ihre Ziele, keine Vermutungen.', 'Frisch notiert, noch warm.'] });
  const frageTex = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#2340FF'; x.font = `850 54px ${F.schrift}`; x.textAlign = 'center'; x.fillText('?', 32, 50); });
  const fragen = [0, 1 / 3, 2 / 3].map(off => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: frageTex.tex, transparent: true, depthWrite: false }));
    s.scale.setScalar(0.8); scene.add(s); return { s, off };
  });

  /* ================= Station 2, Angebot ================= */
  const angebotTex = canvasTex(512, 340, (x, w, h) => {
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#0B0B0C'; x.font = `850 34px ${F.schrift}`; breit(x, 'expanded'); x.fillText('Angebot', 28, 56); breit(x, 'normal');
    x.fillStyle = '#2340FF'; rr(x, 28, 70, 80, 6, 3); x.fill();
    ['Umfang', 'Was drin ist', 'Was nicht drin ist', 'Termine'].forEach((t, i) => {
      const y = 116 + i * 40;
      x.fillStyle = '#2B2C2F'; x.font = `18px ${F.mono}`; x.fillText(t, 28, y);
      x.fillStyle = '#D9D6CE'; rr(x, 230, y - 8, 230, 6, 3); x.fill();
    });
    x.save(); x.translate(392, 292); x.rotate(-12 * Math.PI / 180);
    x.strokeStyle = '#2340FF'; x.lineWidth = 5; x.beginPath(); x.ellipse(0, 0, 88, 34, 0, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.ellipse(0, 0, 78, 26, 0, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#2340FF'; x.font = `600 18px ${F.mono}`; x.textAlign = 'center'; x.fillText('FESTPREIS', 0, 6);
    x.restore();
  });
  [[14.3, -5.3], [16.9, -5.3], [14.3, -3.9], [16.9, -3.9]].forEach(p => cyl(0.06, 1.0, C.schiefer, p[0], 0, p[1]));
  const pult = tbox(3.0, 0.1, 1.9, C.papier, 2, angebotTex.tex, 15.6, 1.0, -4.6, null, true); pult.rotation.x = 0.3;
  // Grosser Stempel auf dem Sockel
  cyl(1.3, 0.38, C.papier, 21, 0, -5.4, null, 0.12); cyl(1.36, 0.12, C.kobalt, 21, 0.14, -5.4, null, 0.05);
  box(0.36, 4.0, 0.36, C.papier, 21, 0, -6.95, null, 0.12);
  box(0.36, 0.3, 1.9, C.papier, 21, 3.75, -6.1, null, 0.12);
  const stempelBlatt = box(1.3, 0.03, 0.95, C.weiss, 21, 0.39, -5.4, null, 0.01);
  const stempelG = grp(21, 1.7, -5.4);
  cyl(0.55, 0.35, C.kobalt, 0, 0, 0, stempelG, 0.1);
  cyl(0.2, 0.12, C.karton, 0, 0.35, 0, stempelG, 0.04);
  const griff = grp(0, 1.12, 0, stempelG); mk(capgeo(0.13, 0.62), mat(C.karton), 0, 0, 0, griff);
  sph(0.26, C.karton, 0, 1.18, 0, stempelG);
  cyl(0.05, 2.7, C.schiefer, 0, 1.3, 0, stempelG, 0.02);
  treffer(1.6, 2.2, 1.6, 21, 0.38, -5.4, null, { aktion: 'stempel', zeiger: 'klick' });
  const stempel = { t: Math.random() * 2, blatt: 0 };
  const angebotBot = makeBot({ x: 19.2, z: -3.5, face: faceTo(1.2, -1.2), mode: 'stempeln', name: 'ANGEBOT', station: 2,
    lines: ['Festpreis, schriftlich, vor Baubeginn.', 'Was drin ist und was nicht, steht hier.', 'Erst lesen, dann entscheiden.', 'Fragen sind erlaubt, auch viele.'] });
  makeBot({ x: 15.6, z: -2.9, face: Math.PI * 0.9, mode: 'write', name: 'RECHNEN', station: 2,
    lines: ['Ich schreibe den Umfang auf, Zeile für Zeile.', 'Keine Überraschung auf der Rechnung.'] });

  /* ================= Station 3, Entwurf ================= */
  const eigeneStriche = [];
  function strichZeichnen(x, pts) {
    if (pts.length < 2) { if (pts.length) { x.beginPath(); x.arc(pts[0][0], pts[0][1], 1.5, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); } return; }
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; x.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const l = pts[pts.length - 1]; x.lineTo(l[0], l[1]); x.stroke();
  }
  function pfeil(x, x1, y1, x2, y2) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    x.beginPath(); x.moveTo(x2, y2); x.lineTo(x2 - Math.cos(a - 0.5) * 9, y2 - Math.sin(a - 0.5) * 9); x.moveTo(x2, y2); x.lineTo(x2 - Math.cos(a + 0.5) * 9, y2 - Math.sin(a + 0.5) * 9); x.stroke();
  }
  const planTex = canvasTex(740, 340, (x, w, h) => {
    x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1; x.beginPath();
    for (let i = 26; i < w; i += 26) { x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, h); }
    for (let j = 26; j < h; j += 26) { x.moveTo(0, j + 0.5); x.lineTo(w, j + 0.5); }
    x.stroke();
    x.strokeStyle = '#FFFFFF'; x.fillStyle = '#FFFFFF'; x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round';
    // Handyseite
    rr(x, 70, 30, 150, 280, 20); x.stroke();
    x.strokeRect(86, 52, 118, 22);
    x.strokeRect(86, 84, 118, 70); x.beginPath(); x.moveTo(86, 84); x.lineTo(204, 154); x.moveTo(204, 84); x.lineTo(86, 154); x.stroke();
    rr(x, 86, 166, 96, 12, 6); x.fill();
    rr(x, 86, 188, 118, 6, 3); x.fill(); rr(x, 86, 202, 90, 6, 3); x.fill();
    rr(x, 86, 238, 118, 40, 20); x.stroke();
    x.font = `600 15px ${F.mono}`; x.textAlign = 'center'; x.fillText('Anfrage', 145, 263); x.textAlign = 'left';
    // Bemassung am Knopf: Tippziel 44
    x.lineWidth = 2; x.beginPath(); x.moveTo(52, 238); x.lineTo(52, 278); x.moveTo(46, 238); x.lineTo(58, 238); x.moveTo(46, 278); x.lineTo(58, 278); x.stroke();
    pfeil(x, 52, 258, 52, 239); pfeil(x, 52, 258, 52, 277);
    x.font = `600 14px ${F.mono}`; x.textAlign = 'right'; x.fillText('44', 44, 263); x.textAlign = 'left';
    // Bildschirmseite
    x.lineWidth = 3;
    rr(x, 290, 30, 270, 176, 10); x.stroke();
    x.beginPath(); x.moveTo(290, 50); x.lineTo(560, 50); x.stroke();
    x.strokeRect(306, 64, 120, 84); x.beginPath(); x.moveTo(306, 64); x.lineTo(426, 148); x.moveTo(426, 64); x.lineTo(306, 148); x.stroke();
    rr(x, 440, 66, 100, 12, 6); x.fill();
    rr(x, 440, 88, 104, 6, 3); x.fill(); rr(x, 440, 102, 84, 6, 3); x.fill();
    rr(x, 440, 120, 96, 28, 14); x.stroke();
    x.font = `600 12px ${F.mono}`; x.textAlign = 'center'; x.fillText('Anfrage', 488, 139); x.textAlign = 'left';
    rr(x, 306, 160, 238, 6, 3); x.fill(); rr(x, 306, 174, 180, 6, 3); x.fill();
    // Notizen in Handschrift
    x.font = `26px ${F.notiz}`;
    x.fillText('Handy zuerst', 578, 70, 150);
    x.fillText('Knopf gross', 578, 150, 150);
    x.fillText('Weg zur Anfrage', 300, 286, 220);
    x.lineWidth = 2.5; x.beginPath(); x.moveTo(296, 276); x.bezierCurveTo(262, 262, 250, 240, 214, 252); x.stroke();
    pfeil(x, 236, 246, 210, 254);
    x.beginPath(); x.moveTo(574, 142); x.bezierCurveTo(560, 132, 552, 132, 544, 134); x.stroke();
    // eigene Striche der Besucher
    x.lineWidth = 3; x.strokeStyle = '#FFFFFF';
    eigeneStriche.forEach(s => strichZeichnen(x, s));
  });
  // Blaupause zur Kamera gedreht (v3-Fix), etwas nach links hinten, damit sie das Hologramm nicht schneidet
  const planWand = grp(35.2, 0, -6.6); planWand.rotation.y = -0.45;
  cyl(0.08, 0.75, C.schiefer, -3.4, 0, 0.05, planWand); cyl(0.08, 0.75, C.schiefer, 3.4, 0, 0.05, planWand);
  const tafel = tbox(7.4, 3.4, 0.18, C.kobaltTief, 4, planTex.tex, 0, 0.7, 0, planWand, true);
  tafel.userData.tafel = true;
  // Drahtgitter-Hologramm: die einzige Stelle mit Linien
  cyl(1.3, 0.38, C.papier, 40.5, 0, -5.4, null, 0.12); cyl(1.36, 0.12, C.kobalt, 40.5, 0.14, -5.4, null, 0.05);
  const holo = grp(40.5, 0.38, -5.4);
  const holoMat = new THREE.MeshBasicMaterial({ color: C.himmel, transparent: true, opacity: 0.2, depthWrite: false });
  const holoLinie = new THREE.LineBasicMaterial({ color: C.kobalt });
  const holoTeile = [];
  [[pgeo(2.4, 1.5, 0.08), -0.35, 0.55, 0], [pgeo(2.2, 0.18, 0.1), -0.35, 1.82, 0], [pgeo(1.1, 0.62, 0.1), -0.82, 1.05, 0.02],
   [pgeo(0.8, 0.12, 0.1), 0.25, 1.48, 0.02], [pgeo(0.5, 0.2, 0.12), 0.1, 0.8, 0.03], [pgeo(0.7, 1.4, 0.08), 1.45, 0.55, 0.35]].forEach((d, i) => {
    const g = grp(d[1], d[2], d[3], holo);
    const m = mk(d[0], holoMat, 0, 0, 0, g); m.userData.ohneSchatten = true;
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(d[0], 28), holoLinie); g.add(l);
    holoTeile.push({ g, y: d[2], i });
  });
  makeBot({ x: 33.2, z: -4.3, face: faceTo(-0.3, -1) + 0.9, mode: 'point', name: 'PLAN', station: 3,
    lines: ['Zuerst der Plan, dann das Bild.', 'Am Handy muss es zuerst funktionieren.', 'Der Knopf ist mindestens 44 Pixel gross.', 'Zeichnen Sie ruhig mit. Ich mag Skizzen.'] });
  makeBot({ x: 39.0, z: -3.7, path: [[39.0, -3.7], [37.4, -2.05]], waitFace: [Math.PI, CAMF], carry: C.kobalt, name: 'SKIZZE', station: 3,
    lines: ['Der Plan geht zur Werkbank.', 'Ihre Bilder kommen hier rein, nicht Fotos aus dem Netz.'] });

  /* ================= Station 4, Bau (Frame B) ================= */
  CUR = FB;
  const STILE = {
    fumo: { grund: '#141110', kopf: '#211A16', bild: '#5A2E1E', titel: '#EDE7DF', text: '#7A6D62', knopf: '#E2552B', fuss: '#211A16' },
    quader: { grund: '#F4F3F0', kopf: '#0B0B0C', bild: '#C9C7C2', titel: '#0B0B0C', text: '#8C8E93', knopf: '#FF6A13', fuss: '#C9C7C2' },
    hebel: { grund: '#FFFFFF', kopf: '#2340FF', bild: '#E6E9FF', titel: '#0B0B0C', text: '#C9C6BE', knopf: '#2340FF', fuss: '#F4F4F2' },
  };
  const STIL_FOLGE = ['fumo', 'quader', 'hebel'];
  const BLOECKE = [[0, 0, 256, 16, 'kopf'], [12, 24, 232, 52, 'bild'], [12, 84, 150, 12, 'titel'], [12, 102, 200, 6, 'text'], [12, 112, 170, 6, 'text'], [12, 124, 70, 16, 'knopf'], [0, 150, 256, 20, 'fuss']];
  const monitore = [];
  const deskX = [50.5, 54, 57.5];
  deskX.forEach((dx, i) => {
    const m = { stil: STIL_FOLGE[i], n: 2 + i * 2, t: Math.random() * 0.4, phase: 'bau', scroll: 0, blitz: 0 };
    m.api = canvasTex(256, 160, (x, w, h) => {
      const s = STILE[m.stil];
      x.fillStyle = s.grund; x.fillRect(0, 0, w, h);
      x.save(); x.beginPath(); x.rect(0, 18, w, h - 18); x.clip(); x.translate(0, 18 - m.scroll);
      for (let b = 0; b < m.n && b < BLOECKE.length; b++) {
        const [bx, by, bw, bh, art] = BLOECKE[b];
        x.fillStyle = s[art];
        if (art === 'kopf' || art === 'fuss') x.fillRect(bx, by, bw, bh); else { rr(x, bx, by, bw, bh, Math.min(6, bh / 2)); x.fill(); }
        if (b === m.n - 1 && m.blitz > 0) { x.globalAlpha = m.blitz / 0.25; x.fillStyle = '#E6E9FF'; x.fillRect(bx, by, bw, bh); x.globalAlpha = 1; }
      }
      x.restore();
      x.fillStyle = '#EDEDEA'; x.fillRect(0, 0, w, 18);
      [['#2340FF', 10], ['#F2C14E', 22], ['#2E9E5B', 34]].forEach(([c, cx]) => { x.fillStyle = c; x.beginPath(); x.arc(cx, 9, 3.6, 0, Math.PI * 2); x.fill(); });
      x.fillStyle = '#FFFFFF'; rr(x, 52, 4, 150, 10, 5); x.fill();
    });
    box(2.6, 0.12, 1.3, C.papier, dx, 0.76, -5);
    [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]].forEach(p => cyl(0.06, 0.76, C.schiefer, dx + p[0], 0, -5 + p[1]));
    cyl(0.07, 0.45, C.schiefer, dx, 0.88, -5.3); box(0.6, 0.05, 0.4, C.schiefer, dx, 0.88, -5.3);
    tbox(1.75, 1.08, 0.1, C.dunkel, 4, m.api.tex, dx, 1.2, -5.35);
    box(1.0, 0.05, 0.35, C.sand, dx, 0.88, -4.72, null, 0.02);
    treffer(1.9, 1.3, 0.5, dx, 1.15, -5.35, null, { aktion: 'monitor', m, zeiger: 'klick' });
    monitore.push(m);
  });
  const bauZitate = [
    ['Zwischenstand kommt, bevor etwas fertig ist.', 'Ihre Texte, Ihre Bilder, mein Handwerk.', 'Ein Projekt nach dem anderen.'],
    ['Diese Seite lädt nichts von fremden Servern.', 'Schriften liegen bei uns, nicht bei Google.', 'Das Formular schreibt in eine Datenbank in Frankfurt.'],
    ['Der Reservierungsknopf sitzt jetzt richtig.', 'Ich baue zuerst das Handy.', 'Noch ein Zwischenstand, dann schauen Sie drüber.'],
  ];
  const bauBots = deskX.map((dx, i) => makeBot({ x: dx, z: -3.8, face: Math.PI, mode: 'type', name: `BAU-${i + 1}`, station: 4, lines: bauZitate[i] }));
  const bote2Blatt = box(0.7, 0.07, 0.5, C.weiss, 0, 1.62, 0, bauBots[1].body, 0.03); bote2Blatt.visible = false;
  // Zwischenstand-Leuchte mit Briefkasten "an Sie"
  let zwBlink = 0;
  const zwTex = canvasTex(360, 70, (x, w, h) => {
    const an = zwBlink > 0;
    x.fillStyle = an ? '#2340FF' : '#FAFAF8'; x.fillRect(0, 0, w, h);
    x.fillStyle = an ? '#FFFFFF' : '#0B0B0C'; x.font = `850 34px ${F.schrift}`; breit(x, 'expanded');
    x.textAlign = 'center'; x.fillText('Zwischenstand', w / 2, 47, 330);
  });
  cyl(0.05, 4.75, C.schiefer, 52.3, 0, -5.95); cyl(0.05, 4.75, C.schiefer, 55.7, 0, -5.95);
  box(3.7, 0.08, 0.14, C.schiefer, 54, 4.7, -5.95, null, 0.03);
  tbox(3.6, 0.7, 0.1, C.weiss, 4, zwTex.tex, 54, 3.95, -5.95);
  const anSieTex = canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, h); x.fillStyle = '#FFFFFF'; x.font = `600 22px ${F.mono}`; x.textAlign = 'center'; x.fillText('an Sie', w / 2, 40); });
  cyl(0.06, 0.9, C.schiefer, 56.4, 0, -1.75);
  tbox(0.62, 0.42, 0.42, C.kobalt, 4, anSieTex.tex, 56.4, 0.9, -1.75);
  let zwUhr = 0;
  // Roboterarm
  const arm = (() => {
    const g = grp(52.3, 0, -2.35);
    cyl(0.58, 0.38, C.papier, 0, 0, 0, g, 0.12);
    const turm = grp(0, 0.38, 0, g); cyl(0.42, 0.3, C.kobalt, 0, 0, 0, turm, 0.1);
    const schulter = grp(0, 0.45, 0, turm); sph(0.26, C.kobalt, 0, 0, 0, schulter); cyl(0.16, 1.5, C.papier, 0, 0, 0, schulter, 0.08);
    const ellbogen = grp(0, 1.5, 0, schulter); sph(0.22, C.kobalt, 0, 0, 0, ellbogen); cyl(0.13, 1.25, C.papier, 0, 0, 0, ellbogen, 0.07);
    const hand = grp(0, 1.25, 0, ellbogen); sph(0.16, C.kobalt, 0, 0, 0, hand);
    box(0.5, 0.16, 0.3, C.schiefer, 0, 0.05, 0, hand); box(0.1, 0.3, 0.14, C.schiefer, 0.18, -0.25, 0, hand); box(0.1, 0.3, 0.14, C.schiefer, -0.18, -0.25, 0, hand);
    const block = box(0.3, 0.06, 0.24, C.himmel, 0, -0.32, 0, hand, 0.02);
    return { turm, schulter, ellbogen, hand, block };
  })();

  /* ================= Station 5, Prüfung (Frame B) ================= */
  const QX = TH[4];
  box(1.4, 3.6, 0.7, C.papier, QX, 0, -1.95, null, 0.3); box(1.4, 3.6, 0.7, C.papier, QX, 0, 1.95, null, 0.3); box(1.4, 0.9, 4.6, C.papier, QX, 3.4, 0, null, 0.4);
  const kapsel = mk(capgeo(0.2, 1.6), mat(C.kobalt, 0.45), QX, 4.42, 0.8); kapsel.rotation.x = Math.PI / 2;
  const pruef = { zeilen: [true, true, true], fortschritt: 0, aus: false, alt: -1 };
  const pruefTex = canvasTex(256, 200, (x, w, h) => {
    x.fillStyle = '#0B0B0C'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#8C8E93'; x.font = `17px ${F.mono}`; x.fillText('PRÜFUNG', 18, 32);
    ['Lesbar am Handy', 'Lädt schnell', 'Formular kommt an'].forEach((t, i) => {
      const y = 66 + i * 30;
      if (pruef.zeilen[i]) haken(x, 28, y - 6, 9, true); else kreuz(x, 28, y - 6, 9);
      x.fillStyle = pruef.zeilen[i] ? '#EDEDEA' : '#FF8A7D'; x.font = `15px ${F.mono}`; x.fillText(t, 46, y);
    });
    x.fillStyle = '#2B2C2F'; rr(x, 18, 150, 220, 10, 5); x.fill();
    x.fillStyle = pruef.aus ? '#D93A2B' : '#2340FF'; rr(x, 18, 150, Math.max(10, 220 * pruef.fortschritt), 10, 5); x.fill();
    if (pruef.aus) { x.fillStyle = '#FF8A7D'; x.font = `14px ${F.mono}`; x.fillText('zurück an die Werkbank', 18, 186); }
  });
  tbox(1.3, 1.02, 0.06, C.dunkel, 4, pruefTex.tex, QX, 1.75, 2.3);   // v3-Fix: grösser, war unlesbar
  const knopf5 = cyl(0.12, 0.08, C.kobalt, QX + 0.35, 1.36, 2.3); knopf5.rotation.x = Math.PI / 2;
  const laserMat = new THREE.MeshBasicMaterial({ color: C.kobalt, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.7), laserMat); laser.rotation.y = Math.PI / 2; laser.position.set(QX, 2.05, 0); laser.userData.ohneSchatten = true; CUR.add(laser);
  const scanMat = new THREE.MeshBasicMaterial({ color: C.kobalt, transparent: true, opacity: 0.4 });
  const scan = box(0.12, 0.06, 3.2, scanMat, QX, 1, 0, null, 0.03); scan.userData.ohneSchatten = true;
  let laserRot = 0;
  const BIN = { x: 75.2, y: 0.9, z: -4.6 }; const BINW = toWorld(FB, BIN.x, BIN.y, BIN.z);
  box(1.9, 0.9, 1.7, C.karton, BIN.x, 0, BIN.z, null, 0.2); box(1.6, 0.03, 1.4, 0x9C6B3F, BIN.x, 0.89, BIN.z, null, 0.01);
  // Daumen-Test
  const daumen = { tipp: 0, gesendet: 0, druck: 0 };
  const daumenTex = canvasTex(180, 340, (x, w, h) => {
    const sc = daumen.gesendet > 0 ? Math.min(1, (2.5 - daumen.gesendet) / 0.4) * 46 : 0;
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.save(); x.translate(0, -sc);
    x.fillStyle = '#2340FF'; x.fillRect(0, 0, w, 46);
    x.fillStyle = '#FFFFFF'; x.font = `600 15px ${F.mono}`; x.fillText('Anfrage', 14, 29);
    x.fillStyle = '#E6E9FF'; rr(x, 14, 60, 152, 90, 10); x.fill();
    x.fillStyle = '#C9C6BE'; [168, 186, 204].forEach((y, i) => { rr(x, 14, y, [140, 120, 96][i], 8, 4); x.fill(); });
    x.fillStyle = daumen.druck > 0 ? '#1730D6' : '#2340FF'; rr(x, 14, 250, 152, 42, 21); x.fill();
    x.fillStyle = '#FFFFFF'; x.font = `600 14px ${F.mono}`; x.textAlign = 'center'; x.fillText('Anfrage senden', 90, 276); x.textAlign = 'left';
    x.fillStyle = '#C9C6BE'; rr(x, 14, 312, 110, 8, 4); x.fill(); rr(x, 14, 330, 80, 8, 4); x.fill();
    x.restore();
    if (daumen.gesendet > 0) {
      x.fillStyle = '#E8F5EE'; rr(x, 10, 230, 160, 96, 14); x.fill();
      haken(x, 34, 262, 13, true);
      x.fillStyle = '#0B0B0C'; x.font = `600 14px ${F.mono}`; x.fillText('Anfrage', 54, 258); x.fillText('gesendet', 54, 276);
      x.fillStyle = '#5B5D61'; x.font = `13px ${F.mono}`; x.fillText('(Demo)', 54, 300);
    }
  });
  // v3-Fix: Handy näher ans Tor, grösser und zur Kamera gedreht, damit der Daumen-Test lesbar ist
  const HX = 67.8, HZ = -2.5;   // links vor dem Tor, nicht mehr vom Querbalken verdeckt
  const handyG = grp(HX, 0, HZ); handyG.rotation.y = 0.35;
  box(1.0, 0.08, 0.7, C.schiefer, 0, 0, -0.05, handyG); cyl(0.06, 1.0, C.schiefer, 0, 0.08, -0.12, handyG);
  const handyTafel = tbox(1.15, 2.17, 0.1, C.tinte, 4, daumenTex.tex, 0, 0.95, 0, handyG);
  treffer(1.4, 2.4, 1.0, 0, 0.9, 0.2, handyG, { aktion: 'handy', zeiger: 'klick' });
  const daumenG = grp(0.42, 2.6, 0.7, handyG);   // seitlich, damit er die Handyseite nicht verdeckt daumenG.scale.setScalar(1.2);
  const daumenMat = mat(C.weiss, 0.5);
  mk(capgeo(0.25, 0.44), daumenMat, 0, 0, 0, daumenG);
  const daumenSpitze = grp(0, -0.44, 0, daumenG); daumenSpitze.rotation.x = 0.28;
  mk(capgeo(0.23, 0.34), daumenMat, 0, 0, 0, daumenSpitze);
  sph(0.27, C.weiss, 0, 0.1, 0, daumenG);
  makeBot({ x: 66.3, z: -3.4, face: faceTo(1.5, 0.9), mode: 'inspect', tool: 'lupe', name: 'PRÜFEN', station: 5,
    lines: ['Am Handy geprüft, mit dem Daumen.', 'Lesbar auch in der Sonne?', 'Kein Text über unruhigem Bild.', 'Das Formular kommt an. Ich habe es ausprobiert.'] });
  const zurueckBot = makeBot({ x: 76.8, z: -3.1, name: 'ZURÜCK', station: 5,
    lines: ['Das hier geht zurück. Der Knopf ist zu klein.', 'Lieber jetzt als bei Ihnen.', 'Zurück an die Werkbank, mit Begründung.'] });

  /* ================= Station 6, Übergabe (Frame B) ================= */
  const fumoBild = { img: null }, quaderBild = { img: null };
  function deckend(x, img, X, Y, w, h, r) {
    x.save(); rr(x, X, Y, w, h, r); x.clip();
    if (img) { const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s; x.drawImage(img, X + (w - iw) / 2, Y + (h - ih) / 2, iw, ih); }
    else { x.fillStyle = '#3A3330'; x.fillRect(X, Y, w, h); }
    x.restore();
  }
  // Fumo ist jetzt eine Pizzeria: Crema-Grund, Ofenbild, Titel in Bodoni (falls nicht geladen: Serif), Knopf in Pomodoro
  const FUMO_SERIF = '"Bodoni Moda Fumo", Georgia, "Times New Roman", serif';
  const fumoTex = canvasTex(440, 280, (x, w, h) => {
    x.fillStyle = '#F6EEDF'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#5A4E44'; x.font = `13px ${F.mono}`; x.fillText('Beispiel, erfundener Betrieb', 20, 26);
    deckend(x, fumoBild.img, 20, 38, 400, 150, 10);
    x.fillStyle = '#1F1A16'; x.font = `500 31px ${FUMO_SERIF}`; x.fillText('Pizza aus dem Holzofen.', 20, 224, 400);
    x.fillStyle = '#C4351F'; rr(x, 20, 238, 168, 30, 15); x.fill();
    x.fillStyle = '#FFFBF3'; x.font = `italic 500 15px ${FUMO_SERIF}`; x.textAlign = 'center'; x.fillText('Tisch reservieren', 104, 258); x.textAlign = 'left';
  });
  if (window.FontFace && document.fonts) {
    const fumoSchriften = [
      new FontFace('Bodoni Moda Fumo', 'url(/hebel-vorschau/v3/beispiele/fumo/fonts/bodoni-moda-latin-opsz-normal.woff2)', { weight: '400 900' }),
      new FontFace('Bodoni Moda Fumo', 'url(/hebel-vorschau/v3/beispiele/fumo/fonts/bodoni-moda-latin-opsz-italic.woff2)', { weight: '400 900', style: 'italic' }),
    ];
    Promise.all(fumoSchriften.map((f) => f.load().then((ff) => document.fonts.add(ff)))).then(() => fumoTex.draw(), () => {});
  }
  const quaderTex = canvasTex(440, 280, (x, w, h) => {
    x.fillStyle = '#F4F3F0'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#5B5D61'; x.font = `13px ${F.mono}`; x.fillText('Beispiel, erfundener Betrieb', 20, 26);
    deckend(x, quaderBild.img, 20, 38, 400, 150, 4);
    x.fillStyle = '#0B0B0C'; x.font = `850 30px ${F.schrift}`; breit(x, 'expanded'); x.fillText('Wir bauen, was steht.', 20, 224, 400); breit(x, 'normal');
    x.fillStyle = '#FF6A13'; rr(x, 20, 238, 160, 30, 4); x.fill();
    x.fillStyle = '#0B0B0C'; x.font = `700 14px ${F.schrift}`; x.textAlign = 'center'; x.fillText('Offerte anfragen', 100, 258); x.textAlign = 'left';
  });
  const fuell = { t: 0, n: 0 };
  const ihrTex = canvasTex(440, 280, (x, w, h) => {
    const n = fuell.n;
    x.fillStyle = n > 0 ? '#FFFFFF' : '#FBFBFF'; x.fillRect(0, 0, w, h);
    const teile = [[20, 20, 400, 30, 'kopf'], [20, 62, 190, 120, 'bild'], [226, 70, 180, 22, 'titel'], [226, 104, 170, 10, 'z'], [226, 124, 140, 10, 'z'], [226, 150, 120, 32, 'knopf'], [20, 200, 400, 56, 'fuss']];
    teile.forEach((t, i) => {
      const [X, Y, bw, bh, art] = t;
      if (i < n) {
        x.fillStyle = art === 'kopf' || art === 'knopf' ? '#2340FF' : art === 'bild' ? '#E6E9FF' : art === 'titel' ? '#0B0B0C' : art === 'fuss' ? '#F4F4F2' : '#C9C6BE';
        rr(x, X, Y, bw, bh, art === 'knopf' ? 16 : 6); x.fill();
        if (art === 'kopf') { x.fillStyle = '#FFFFFF'; x.font = `850 16px ${F.schrift}`; x.fillText('Ihr Betrieb', 34, 41); }
        if (art === 'titel') { x.fillStyle = '#FFFFFF'; x.fillRect(X, Y, bw, bh); x.fillStyle = '#0B0B0C'; x.font = `850 24px ${F.schrift}`; x.fillText('Ihr Betrieb', X, Y + 20, bw); }
        if (art === 'knopf') { x.fillStyle = '#FFFFFF'; x.font = `600 14px ${F.mono}`; x.textAlign = 'center'; x.fillText('Anfrage', X + bw / 2, Y + 21); x.textAlign = 'left'; }
      } else {
        x.setLineDash([8, 6]); x.strokeStyle = 'rgba(35,64,255,.55)'; x.lineWidth = 2;
        rr(x, X, Y, bw, bh, 6); x.stroke(); x.setLineDash([]);
      }
    });
    if (n === 0) {
      x.fillStyle = 'rgba(251,251,255,.86)'; rr(x, 92, 98, 256, 92, 14); x.fill();
      x.fillStyle = '#2340FF'; x.font = `850 34px ${F.schrift}`; breit(x, 'expanded'); x.textAlign = 'center'; x.fillText('Ihre Website', w / 2, 142, 240); breit(x, 'normal');
      x.font = `15px ${F.mono}`; x.fillText('hier als Nächstes', w / 2, 172); x.textAlign = 'left';
    }
  });
  function bildLaden(src, halter, api) { const i = new Image(); i.decoding = 'async'; i.onload = () => { halter.img = i; api.draw(); }; i.src = src; }
  bildLaden('/hebel-vorschau/v3/beispiele/fumo/pizzeria/ofen-klein.webp', fumoBild, fumoTex);
  bildLaden('/hebel-vorschau/v3/beispiele/quader-bau/bilder/fertiger-bau-720.webp', quaderBild, quaderTex);
  const rahmenMat = new THREE.MeshStandardMaterial({ color: C.kobalt, emissive: C.kobalt, emissiveIntensity: 0.15, roughness: 0.5 });
  const PX = [84.6, 88.4, 92.2], PZ = -5.7;
  const PFARBE = [C.glut, C.signal, C.kobalt];
  const PTEX = [fumoTex, quaderTex, ihrTex];
  const geraete = PX.map((px, i) => {
    box(2.6, 0.62, 1.7, C.papier, px, 0, PZ, null, 0.25);
    box(2.7, 0.16, 1.8, PFARBE[i], px, 0.6, PZ, null, 0.07);
    const g = grp(px, 0.76, PZ);
    box(0.8, 0.12, 0.5, C.schiefer, 0, 0, 0, g); cyl(0.06, 0.3, C.schiefer, 0, 0.1, 0, g);
    tbox(2.2, 1.4, 0.1, i === 2 ? rahmenMat : C.dunkel, 4, PTEX[i].tex, 0, 0.36, 0, g);
    treffer(2.6, 2.7, 1.8, px, 0, PZ, null, { aktion: 'podest', welches: i, zeiger: 'oeffnen' });
    return g;
  });
  // Der grosse Hebel
  cyl(1.5, 0.32, C.papier, 96.2, 0, -6, null, 0.12); cyl(1.56, 0.12, C.kobalt, 96.2, 0.12, -6, null, 0.05);
  box(0.18, 1.2, 0.9, C.schiefer, 95.85, 0.32, -6, null, 0.06); box(0.18, 1.2, 0.9, C.schiefer, 96.55, 0.32, -6, null, 0.06);
  const achseM = cyl(0.12, 0.9, C.kobalt, 95.75, 1.22, -6, null, 0.04); achseM.rotation.z = -Math.PI / 2;
  const hebelArm = grp(96.2, 1.22, -6);
  cyl(0.11, 2.6, C.papier, 0, 0, 0, hebelArm, 0.05);
  sph(0.32, C.kobalt, 0, 2.7, 0, hebelArm);
  const dreieck = mk(dreieckGeo(1.1, 0.24), mat(C.weiss), 96.2, 0.0, -4.32); dreieck.position.z -= 0.12;
  treffer(2.2, 3.8, 2.4, 96.2, 0, -6, null, { aktion: 'hebel', zeiger: 'ziehen' });
  const hebel = { w: 0.55, zustand: 'ruhe', t: 0, start: 0.55, auto: 0, zieh: -1 };
  const FRONT6 = CAMF - FB.rotation.y;          // Drehung, bei der ein Bildschirm in Frame B frontal zur Kamera steht
  const FUELL_DAUER = 5.2;                      // fertige Seite bleibt nach dem Aufbau rund 3 s stehen
  const ankunft = { t: 0, fertig: false };
  let schub = 0;                                 // 0 bis 1: Kamera fährt beim Füllen näher heran
  // Konfetti (Pool)
  const konfGeo = pgeo(0.16, 0.025, 0.1);
  const konfMats = [mat(C.kobalt, 0.5), mat(C.weiss, 0.5), mat(C.butter, 0.5)];
  const konfetti = [];
  for (let i = 0; i < 60; i++) {
    const m = mk(konfGeo, konfMats[i % 3], 0, 0, 0, FB); m.visible = false; m.userData.ohneSchatten = true;
    konfetti.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 });
  }
  let rahmenGlanz = 0;
  const uebergabe1 = makeBot({ x: 94.2, z: -4.0, face: faceTo(1, -1) - 0.6, name: 'ÜBERGABE-1', station: 6,
    lines: ['Domain, Inhalte, Code und Zugänge gehören Ihnen.', 'Ziehen Sie den Hebel, wenn Sie nicht warten wollen.', 'Wechseln Sie später, nehmen Sie alles mit.'] });
  const uebergabe2 = makeBot({ x: 90.3, z: -3.6, mode: 'wave',   // v3-Fix: zwischen den Podesten, nicht hinter der Leiste
    name: 'ÜBERGABE-2', station: 6,
    lines: ['Fumo ist fertig. Erfunden, aber fertig.', 'Quader Bau steht.', 'Das leere Podest ist für Sie.', 'Klicken Sie auf einen Bildschirm, dann öffnet sich das Beispiel.'] });
  CUR = scene;

  /* ================= Helfer ausserhalb der Stationen ================= */
  makeBot({ x: 3, z: 3.7, path: [[3, 3.7], [44, 3.7]], waitFace: [CAMF, CAMF], speed: 2.1, carry: C.weiss, name: 'BOTE-1', station: 0,
    lines: ['Ich bringe Ihre Rückmeldung zur nächsten Station.', 'Nichts geht zwischen den Schritten verloren.'] });
  makeBot({ x: TX + RC - 3.7, z: 58, path: [[TX + RC - 3.7, 58], [TX + RC - 3.7, 15]], waitFace: [CAMF, CAMF], speed: 2.1, carry: C.butter, name: 'BOTE-2', station: 0,
    lines: ['Rückmeldung aus der Prüfung, zurück an die Werkbank.', 'Unterwegs zur nächsten Station.'] });
  const empfangBot = makeBot({ x: -8.2, z: 3.2, mode: 'wave', name: 'EMPFANG', station: 0,
    lines: ['Grüezi! Hier kommt Ihre Anfrage aufs Band.', 'Scrollen Sie, ich zeige Ihnen die Werkstatt.', 'Jede Website beginnt mit einer Anfrage.'] });

  /* ---------- Schatten ---------- */
  scene.traverse(o => {
    if (!o.isMesh || o.userData.istBoden) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (o.userData.ohneSchatten || o.material === trefferMat || o.material === schattenMat || ms.some(m => m.transparent)) return;
    o.castShadow = true; o.receiveShadow = true;
  });

  /* ---------- Beschriftungen ---------- */
  const schilderEl = $('#schilder');
  const schilder = [];
  function schild(htmlText, x, y, z, cls, frame, station) {
    const el = document.createElement('div');
    el.className = 'wl ' + cls; el.innerHTML = htmlText;
    schilderEl.appendChild(el);
    schilder.push({ el, p: toWorld(frame || scene, x, y, z), sicht: true, station: station || 0, w: 0, h: 0, weg: false });
  }
  STATIONEN.forEach((s, i) => schild(`<b>${zwei(i + 1)}</b>${s.name}`, SX[i] + 6, 0.1, -8.5, 'station', FR[i], i + 1));
  schild('Ihre Anfrage', -11, 4.2, 0, 'schild warm');
  schild('Übergabe', 98.8, 3.2, 0, 'schild', FB);
  schild('Zurück an die Werkbank', 75.2, 1.3, -4.6, 'schild', FB);
  schild('Zwischenstand', 54, 3.1, -5.6, 'schild', FB);
  schild('Seitenplan', 35.2, 4.5, -6.5, 'schild');
  schild('Festpreis', 21, 3.0, -5.4, 'schild');
  schild('Fumo, Pizzeria', PX[0], 2.75, PZ, 'schild', FB);
  schild('Quader Bau, Baugeschäft', PX[1], 2.75, PZ, 'schild', FB);
  schild('Ihr Betrieb', PX[2], 2.75, PZ, 'schild kobalt', FB);
  schild('Hebel ziehen', 96.2, 4.5, -6, 'schild warm', FB);

  /* ================= Ebene 3: vorbeiziehende Vordergrund-Objekte ================= */
  const vorScene = new THREE.Scene();
  const vorCam = new THREE.OrthographicCamera(-5, 5, 5, -5, -50, 50);
  // Weiches Material: Ränder laufen ins Durchsichtige und in den Grund, das wirkt wie Unschärfe
  function weichMat(farbe) {
    return new THREE.ShaderMaterial({
      uniforms: { farbe: { value: new THREE.Color(farbe) }, grund: { value: new THREE.Color(0xF4F4F2) }, deck: { value: 1.0 } },
      vertexShader: `varying vec3 vN;
        void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 farbe; uniform vec3 grund; uniform float deck; varying vec3 vN;
        void main(){
          vec3 n = normalize(vN);
          float licht = 0.62 + 0.38 * max(dot(n, normalize(vec3(-0.35, 0.75, 0.55))), 0.0);
          float rand = 1.0 - abs(n.z);
          vec3 c = mix(farbe * licht, grund, 0.05 + rand * 0.22);
          float a = deck * (1.0 - smoothstep(0.55, 1.0, rand) * 0.6);
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
    });
  }
  const vorObjekte = (() => {
    const liste = [];
    // Briefumschlag nach Station 1
    const brief = new THREE.Group();
    const bk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.1, 0.16), weichMat(0xFFFFFF)); brief.add(bk);
    const kl = (() => { const s = new THREE.Shape(); s.moveTo(-1.6, 1.05); s.lineTo(1.6, 1.05); s.lineTo(0, -0.1); s.closePath(); return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }), weichMat(0xDCE2FF)); })();
    kl.position.z = 0.08; brief.add(kl);
    // v3-Fix: Falzlinien unten, damit der Umschlag als Umschlag lesbar ist
    [-1, 1].forEach(sx => { const f = new THREE.Mesh(new THREE.BoxGeometry(1.97, 0.05, 0.01), weichMat(0xB9C0DA)); f.position.set(sx * 0.8, -0.475, 0.086); f.rotation.z = -sx * 0.62; brief.add(f); });
    const siegel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 32), weichMat(C.kobalt)); siegel.rotation.x = Math.PI / 2; siegel.position.set(0, -0.08, 0.14); brief.add(siegel);
    liste.push({ g: brief, u: 1.5, y: 0.24, ry: [-0.25, 0.25], rz: 0.18 });
    // Stempel nach Station 2
    const stp = new THREE.Group();
    const kopf = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.6, 40), weichMat(C.kobalt)); stp.add(kopf);
    const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.9, 24), weichMat(C.karton)); hals.position.y = 0.75; stp.add(hals);
    const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), weichMat(C.karton)); knauf.position.y = 1.45; stp.add(knauf);
    liste.push({ g: stp, u: 2.5, y: -0.2, ry: [0.4, 0.2], rz: -0.5 });
    // Bleistift nach Station 3
    const sti = new THREE.Group();
    const schaft = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 4.6, 6), weichMat(C.butter)); sti.add(schaft);
    const holz = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 6), weichMat(C.karton)); holz.position.y = -2.65; holz.rotation.x = Math.PI; sti.add(holz);
    const mine = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 6), weichMat(C.tinte)); mine.position.y = -3.06; mine.rotation.x = Math.PI; sti.add(mine);
    const gummi = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 16), weichMat(C.kobalt)); gummi.position.y = 2.55; sti.add(gummi);
    liste.push({ g: sti, u: 3.5, y: 0.28, ry: [0.2, 0.6], rz: 1.1 });
    // Handy nach Station 5
    const hdy = new THREE.Group();
    const hk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.0, 0.2), weichMat(C.tinte)); hdy.add(hk);
    const anz = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.7), new THREE.MeshBasicMaterial({ map: seiteSchmal.tex, transparent: true, opacity: 0.9 })); anz.position.z = 0.11; hdy.add(anz);
    liste.push({ g: hdy, u: 5.5, y: -0.16, ry: [-0.2, 0.3], rz: -0.2 });
    const PARK = [[-0.5, 0.3], [0.5, 0.36], [-0.5, -0.06], [0.5, 0.08]];
    liste.forEach((o, i) => { o.park = PARK[i]; o.g.visible = false; vorScene.add(o.g); });
    return liste;
  })();

  /* ---------- Kamera und Scroll ---------- */
  let K = [], curH = 21, schattenGroesse = 0, kipp = 0, zoom = null, ZIEL6 = null;
  const tgt = new THREE.Vector3(), par = { x: 0, y: 0 };
  function buildKeys() {
    const a = W / H, mob = W < 760;
    const stH = mob ? clamp(24 / a * 0.62, 20, 34) : 15.5;
    K = [mob ? { x: -6, z: 0, h: clamp(26 / a * 0.62, 22, 40), ox: 0.1, oy: -0.22 } : { x: -11, z: 0, h: 21, ox: -0.07, oy: 0.22 }];
    SX.forEach((x, i) => {
      // v3-Fix: Station 5 rückt das Handy ins Bild; Station 6 ist für die Kamera gebaut: näher, Hebel und "Ihr Betrieb" frei
      const s = i === 4 ? { x: 71.7, z: -3.4, h: stH * (mob ? 0.92 : 0.93), ox: mob ? 0.02 : 0.07, oy: mob ? -0.18 : 0.06 }
        : i === 5 ? (mob ? { x: 94.4, z: -5.6, h: clamp(7.85 / a, 14, 22), ox: 0, oy: -0.1 } : { x: 93.4, z: -5.4, h: clamp(10.5 * 1.6 / a, 9, 13), ox: 0.07, oy: 0.1 })
        : { x: x + 1.2, z: -3.4, h: stH, ox: mob ? 0.02 : 0.07, oy: mob ? -0.25 : -0.02 };
      const w = toWorld(FR[i], s.x, 0, s.z);
      K.push({ x: w.x, z: w.z, h: s.h, ox: s.ox, oy: s.oy });
    });
    ZIEL6 = toWorld(FB, PX[2], 0, PZ);
    const vh = 10, vw = vh * W / H;
    vorCam.left = -vw / 2; vorCam.right = vw / 2; vorCam.top = vh / 2; vorCam.bottom = -vh / 2; vorCam.updateProjectionMatrix();
  }
  function dwell(f) { const d = 0.2; if (f <= d) return 0; if (f >= 1 - d) return 1; return smooth((f - d) / (1 - 2 * d)); }
  function camAt(u) {
    const i = Math.min(5, Math.floor(u)), f = u - i, e = dwell(f), A = K[i], B = K[i + 1];
    let h = lerp(A.h, B.h, e);
    if (i >= 1 && i <= 5) h += Math.sin(Math.PI * e) * 5;     // zwischen Stationen kurz rauszoomen (auch 5 bis 6), nach 6 nicht
    return { x: lerp(A.x, B.x, e), z: lerp(A.z, B.z, e), h, ox: lerp(A.ox, B.ox, e), oy: lerp(A.oy, B.oy, e) };
  }
  function applyCam(u) {
    const c = camAt(clamp(u, 0, 6));
    let h = c.h, cx = c.x, cz = c.z;
    if (zoom) { const q = smooth(clamp(zoom.t / 0.25, 0, 1)); h *= 1 - 0.3 * q; cx = lerp(cx, zoom.ziel.x, q * 0.6); cz = lerp(cz, zoom.ziel.z, q * 0.6); }
    else if (schub > 0.001 && ZIEL6) {   // Finale: beim Füllen ein Stück näher an "Ihr Betrieb", nur an Station 6
      const q = smooth(schub) * clamp((u - 5.7) / 0.3, 0, 1);
      h *= 1 - 0.16 * q; cx = lerp(cx, ZIEL6.x, q * 0.22); cz = lerp(cz, ZIEL6.z, q * 0.22);
    }
    const vw = h * W / H; curH = h;
    tgt.set(cx, 0, cz).addScaledVector(RIGHT, c.ox * vw).addScaledVector(UP, (c.oy + kipp) * h)
      .addScaledVector(RIGHT, par.x * 0.5).addScaledVector(UP, par.y * 0.35);
    cam.left = -vw / 2; cam.right = vw / 2; cam.top = h / 2; cam.bottom = -h / 2;
    cam.position.copy(tgt).addScaledVector(DIR, 150); cam.lookAt(tgt); cam.updateProjectionMatrix();
    const fx = tgt.x - tgt.y * DIR.x / DIR.y, fz = tgt.z - tgt.y * DIR.z / DIR.y;
    sonne.target.position.set(fx, 0, fz); sonne.position.set(fx, 0, fz).add(SUN_OFF);
    const s = Math.ceil(h * Math.max(1, W / H) * 0.6 / 2) * 2;
    if (s !== schattenGroesse) { schattenGroesse = s; const sc = sonne.shadow.camera; sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.updateProjectionMatrix(); }
  }

  /* ---------- Sprechblase ---------- */
  const blase = $('#blase'), bName = $('.b-name', blase), bText = $('.b-text', blase);
  const PLAUDER_ABSTAND = 4.5;   // Sekunden zwischen zwei Sprechblasen
  let blaseBot = null, blaseZeit = 0, letztesPlaudern = 1.2 - PLAUDER_ABSTAND, uhr = 0;   // erste Blase nach gut einer Sekunde
  function sage(b, text) {
    blaseBot = b; blaseZeit = 3.8; bName.textContent = b.name; bText.textContent = text;
    blase.classList.add('zeigen'); letztesPlaudern = uhr;
  }
  /* v3-Fix: Blase weicht aus. Sie verschwindet, wenn ihr Helfer aus dem Bild oder die Station gewechselt ist,
     rutscht nie unter Kopf, Karte oder Leiste und legt sich nicht über das, was der Besucher gerade sehen soll. */
  const hudFlaechen = [];
  const schneidet = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  function flaeche(el) { if (!el || el.hidden || el.style.visibility === 'hidden' || +(el.style.opacity || 1) < 0.5) return null; const r = el.getBoundingClientRect(); return r.width ? [r.left - 6, r.top - 6, r.right + 6, r.bottom + 6] : null; }
  function hudFlaechenMessen() {
    hudFlaechen.length = 0;
    const kopfEl = $('.kopf'), tempoEl2 = $('#tempo');
    [kopfEl, tempoEl2, karte, leiste].forEach(el => { const f = flaeche(el); if (f) hudFlaechen.push(f); });
    // Marke und Pillen liegen frei im Kopf: der ganze Streifen oben bleibt frei
    const k = hudFlaechen[0]; if (k) { k[0] = 0; k[2] = W; }
    // Im Hero plaudert EMPFANG: die Blase legt sich nicht über die Headline
    if (Z.uS < 0.6) { const f = flaeche(hero); if (f) hudFlaechen.push(f); }
  }
  const SCHUTZ = [[1, notizTafel], [3, tafel], [5, handyTafel], [6, geraete[2]], [6, hebelArm]];   // was an dieser Station frei bleiben muss
  const sbox = new THREE.Box3(), secke = new THREE.Vector3();
  function schutzFlaechen() {
    const out = [];
    for (const [st, obj] of SCHUTZ) {
      if (Math.abs(Z.uS - st) > 0.6) continue;
      sbox.setFromObject(obj);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        secke.set(i & 1 ? sbox.max.x : sbox.min.x, i & 2 ? sbox.max.y : sbox.min.y, i & 4 ? sbox.max.z : sbox.min.z);
        const [x, y] = projiziere(secke); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      out.push([x0, y0, x1, y1]);
    }
    return out;
  }
  function blaseWeg() { blaseZeit = 0; blase.classList.remove('zeigen'); }
  function blaseSetzen() {
    const b = blaseBot;
    if (b.station && Math.abs(Z.uS - b.station) > 0.55) { blaseWeg(); return; }
    b.root.getWorldPosition(wp); const fussY = wp.y;
    wp.y = fussY + (1.75 + b.hop.position.y) * b.S;
    const [x, y] = projiziere(wp);
    wp.y = fussY; const [, fy] = projiziere(wp);
    if (x < 0 || x > W || y < 0 || fy > H) { blaseWeg(); return; }   // Helfer nicht im Bild
    const bw = blase.offsetWidth, bh = blase.offsetHeight;
    const halb = Math.min(W / 2, bw / 2 + 8), xk = clamp(x, halb, W - halb);
    const schutz = schutzFlaechen();
    const kandidaten = [[y - 12 - bh, false], [fy + 16, true]];
    const rechteck = t => [xk - bw / 2, t, xk + bw / 2, t + bh];
    const imBild = r => r[1] >= 0 && r[3] <= H;
    const frei = r => imBild(r) && !hudFlaechen.some(f => schneidet(r, f)) && !schutz.some(f => schneidet(r, f));
    let wahl = kandidaten.find(k => frei(rechteck(k[0])));
    if (!wahl) wahl = kandidaten.find(k => imBild(rechteck(k[0])) && !hudFlaechen.some(f => schneidet(rechteck(k[0]), f)));
    if (!wahl) { blaseWeg(); return; }
    blase.classList.toggle('unten', wahl[1]);
    blase.style.transform = `translate3d(${(xk - bw / 2).toFixed(1)}px,${wahl[0].toFixed(1)}px,0)`;
    blase.style.setProperty('--zipfel', `${clamp(x - xk, -halb + 18, halb - 18).toFixed(1)}px`);
  }
  function zitat(b) { let t; let n = 0; do { t = pick(b.lines); n++; } while (b.lines.length > 1 && t === b.letzt && n < 12); b.letzt = t; return t; }

  /* ---------- Aktionen der Besucher ---------- */
  function stempelAusloesen() { if (stempel.t < 2.2) { stempel.t = 2.2; stempel.manuell = true; sage(angebotBot, 'Danke, das Blatt war bereit.'); } }
  function handyTipp() { daumen.zwang = 0.32; daumen.gesendet = 2.5; }
  function oeffne(i) {
    if (i === 2) { const k = $('#kontakt'); if (k) k.scrollIntoView({ behavior: RUHIG ? 'auto' : 'smooth' }); return; }
    const url = i === 0 ? '/hebel-vorschau/v3/beispiele/fumo/' : '/hebel-vorschau/v3/beispiele/quader-bau/';
    zoom = { t: 0, ziel: geraete[i].getWorldPosition(new THREE.Vector3()) };
    $('#blende').classList.add('an');
    setTimeout(() => { location.href = url; }, 260);
  }
  addEventListener('pageshow', e => { if (e.persisted) { zoom = null; $('#blende').classList.remove('an'); } });
  function effekteHebel() {
    fuell.t = 0.0001; fuell.n = 1; ihrTex.draw();
    rahmenGlanz = 0.9;   // Rahmen leuchtet rund 3 s nach
    if (!RUHIG) konfetti.forEach(p => {
      const r = Math.random, a = r(), b = r(), c = r();
      p.m.position.set(PX[2] + (a - 0.5) * 1.8, 0.85, PZ + (b - 0.5) * 1.1);
      p.v.set((a - 0.5) * 3.4, 4.4 + c * 3.6, (b - 0.5) * 3.4);
      p.w.set(r() * 10 - 5, r() * 10 - 5, r() * 10 - 5);
      p.life = 1.8 * (0.75 + 0.25 * r()); p.m.visible = true;
    });
    uebergabe1.cheer = 3; uebergabe2.cheer = 3;
    sage(uebergabe1, 'So schnell geht es bei Ihnen nicht. Aber genau so fühlt es sich an.');
  }
  function hebelAusloesen() {
    if (hebel.zustand === 'schwung' || hebel.zustand === 'halt') return;
    hebel.zustand = 'schwung'; hebel.t = 0; hebel.start = hebel.w; hebel.auto = 0;
  }
  function aktion(d) {
    if (d.bot) { d.bot.hopT = 0; sage(d.bot, zitat(d.bot)); return; }
    switch (d.aktion) {
      case 'notiz': notizHaken = notizHaken >= 4 ? 1 : notizHaken + 1; notizTex.draw(); break;
      case 'stempel': stempelAusloesen(); break;
      case 'monitor': d.m.stil = STIL_FOLGE[(STIL_FOLGE.indexOf(d.m.stil) + 1) % 3]; d.m.api.draw(); break;
      case 'handy': handyTipp(); break;
      case 'podest': oeffne(d.welches); break;
      case 'hebel': hebelAusloesen(); break;
    }
  }
  $$('#s6 [data-s6]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.s6;
    if (a === 'hebel') hebelAusloesen(); else oeffne(a === 'fumo' ? 0 : 1);
  }));
  $('#wischen').addEventListener('click', () => { eigeneStriche.length = 0; planTex.draw(); });

  /* ---------- Zeiger, Raycast, Ziehen ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const maus = { x: -1, y: -1, hat: false, ueberUI: true };
  function zielBei(cx, cy) {
    ndc.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(ziele, false); return h.length ? h[0].object : null;
  }
  function tafelBei(cx, cy) {
    ndc.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); ray.setFromCamera(ndc, cam);
    const h = ray.intersectObject(tafel, false)[0];
    return h && h.face && h.face.materialIndex === 4 && h.uv ? [h.uv.x * 740, (1 - h.uv.y) * 340] : null;
  }
  const UI_SEL = '.ui, .inhalt, .hero, a, button, input, textarea, select, label';
  addEventListener('pointermove', e => {
    maus.x = e.clientX; maus.y = e.clientY; maus.hat = true;
    maus.ueberUI = !!(e.target && e.target.closest && e.target.closest(UI_SEL));
    if (e.pointerType === 'mouse') { ZEIGER.x = e.clientX; ZEIGER.y = e.clientY; }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { maus.hat = false; });
  let zug = null, unterdrueckeKlick = false, hoverBot = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    unterdrueckeKlick = false;
    const o = zielBei(e.clientX, e.clientY);
    if (o && o.userData.aktion === 'hebel') {
      if (hebel.zustand === 'schwung' || hebel.zustand === 'halt') return;   // läuft schon, nicht doppelt auslösen
      zug = { art: 'hebel', id: e.pointerId, y0: e.clientY, bewegt: false, anteil: 0 };
      hebel.zustand = 'zug';
    } else if (!(o && o.userData.bot)) {
      const p = tafelBei(e.clientX, e.clientY);
      if (!p) return;
      const strich = [p]; eigeneStriche.push(strich);
      zug = { art: 'zeichnen', id: e.pointerId, strich };
      planTex.draw();
    } else return;
    unterdrueckeKlick = true;
    canvas.style.touchAction = 'none';
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ohne Capture geht es auch */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (!zug || e.pointerId !== zug.id) return;
    if (zug.art === 'hebel') {
      const dy = e.clientY - zug.y0;
      if (Math.abs(dy) > 6) zug.bewegt = true;
      zug.anteil = clamp(dy / (H * 0.16), 0, 1);
      hebel.w = 0.55 - 1.1 * zug.anteil;
    } else {
      const p = tafelBei(e.clientX, e.clientY);
      if (!p) return;
      const l = zug.strich[zug.strich.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 2.5) return;
      zug.strich.push([lerp(l[0], p[0], 0.7), lerp(l[1], p[1], 0.7)]);   // leichte Glättung
      planTex.draw();
    }
  });
  function zugEnde(e) {
    if (!zug || e.pointerId !== zug.id) return;
    if (zug.art === 'hebel') {
      if (!zug.bewegt || zug.anteil > 0.7) hebelAusloesen();
      else { hebel.zustand = 'zurueck'; hebel.t = 0; hebel.start = hebel.w; }
    }
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* schon frei */ }
    canvas.style.touchAction = '';
    zug = null;
  }
  canvas.addEventListener('pointerup', zugEnde);
  canvas.addEventListener('pointercancel', e => { if (zug && zug.art === 'hebel') { hebel.zustand = 'zurueck'; hebel.t = 0; hebel.start = hebel.w; } zugEnde(e); });
  // Am Handy: nur auf Tafel und Hebel das Scrollen anhalten, sonst scrollt die Seite normal
  canvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    if (!t || e.touches.length > 1) return;
    const o = zielBei(t.clientX, t.clientY);
    if ((o && o.userData.aktion === 'hebel') || (!(o && o.userData.bot) && tafelBei(t.clientX, t.clientY))) e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('click', e => {
    if (unterdrueckeKlick) { unterdrueckeKlick = false; return; }
    const o = zielBei(e.clientX, e.clientY);
    if (o) aktion(o.userData);
  });

  /* ---------- Prüfhilfe ?probe: löst an jeder Station deren Besucher-Aktion einmal aus ---------- */
  const PROBE = new URLSearchParams(location.search).has('probe');
  const probeFertig = new Set();
  function probe(n) {
    const b = helfer.find(h => h.station === n);
    if (b && n !== 6) { b.hopT = 0; sage(b, zitat(b)); }
    if (n === 1) aktion({ aktion: 'notiz' });
    if (n === 2) stempelAusloesen();
    if (n === 3) { const st = []; for (let i = 0; i <= 40; i++) { const a = i / 40; st.push([470 + Math.cos(a * 7) * (60 - a * 40), 250 + Math.sin(a * 7) * (40 - a * 25)]); } eigeneStriche.push(st); planTex.draw(); }
    if (n === 4) aktion({ aktion: 'monitor', m: monitore[1] });
    if (n === 5) handyTipp();
    if (n === 6) hebelAusloesen();
  }

  /* ---------- Sichtbarkeit ---------- */
  let streckeSichtbar = true, tabSichtbar = !document.hidden;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { streckeSichtbar = es[0].isIntersecting; }).observe(strecke);
  document.addEventListener('visibilitychange', () => { tabSichtbar = !document.hidden; letzte = performance.now(); });

  /* ---------- HUD pro Frame ---------- */
  const leisteEl = leiste, tempoEl = $('#tempo'), zeichnenEl = $('#zeichnen'), s6El = $('#s6');
  const stil = new Map();
  function setze(el, k, v) { const key = el.id + k; if (stil.get(key) === v) return; stil.set(key, v); el.style[k] = v; }
  function hud() {
    const u = Z.uS;
    const exitA = 1 - clamp((scrollY - Z.max) / (H * 0.3), 0, 1);
    const heroA = 1 - clamp((u - 0.1) / 0.35, 0, 1);
    setze(hero, 'opacity', heroA.toFixed(3));
    setze(hero, 'visibility', heroA <= 0.001 ? 'hidden' : '');
    setze(hero, 'transform', `translateY(${((1 - heroA) * 16).toFixed(1)}px)`);
    heroZerfall(u);
    const cardA = clamp((u - 0.45) / 0.3, 0, 1) * exitA;
    setze(karte, 'opacity', cardA.toFixed(3));
    setze(karte, 'pointerEvents', cardA > 0.5 ? 'auto' : 'none');
    setze(karte, 'visibility', cardA <= 0.001 ? 'hidden' : '');
    setze(leisteEl, 'opacity', cardA.toFixed(3));
    setze(leisteEl, 'pointerEvents', cardA > 0.5 ? 'auto' : 'none');
    setze(leisteEl, 'visibility', cardA <= 0.001 ? 'hidden' : '');
    setze(tempoEl, 'opacity', exitA.toFixed(3));
    setze(schilderEl, 'opacity', exitA.toFixed(3));
    document.body.classList.toggle('vorbei', exitA <= 0);
    document.body.classList.toggle('in-station', cardA > 0.5);
    const k = clamp(Math.round(u), 1, 6);
    if (cardA > 0) karteSetzen(k);
    const f = clamp(u - (k - 0.5), 0, 1);
    segmente.forEach((s, i) => {
      s.classList.toggle('fertig', i < k - 1); s.classList.toggle('an', i === k - 1);
      if (i === k - 1) s.style.setProperty('--f', f.toFixed(3));
    });
    leisteKnoepfe.forEach((b, i) => {
      b.classList.toggle('an', i === k - 1); b.classList.toggle('fertig', i < k - 1);
      if (i === k - 1) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    zeichnenEl.hidden = !(Math.abs(u - 3) < 0.25 && cardA > 0.5);
    s6El.hidden = !(k === 6 && cardA > 0.5);
    schilderEl.classList.toggle('fern', curH > 30);
    return cardA;
  }

  /* ---------- Render-Loop ---------- */
  const PT = {}, pv = new THREE.Vector3(), wp = new THREE.Vector3();
  let T = 0, letzte = performance.now(), frame = 0;
  function projiziere(p) { pv.copy(p).project(cam); return [(pv.x * 0.5 + 0.5) * W, (-pv.y * 0.5 + 0.5) * H]; }
  const easeBack = q => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2); };

  function schleife(jetzt) {
    requestAnimationFrame(schleife);
    const rdt = Math.min(0.05, Math.max(0, (jetzt - letzte) / 1000));
    letzte = jetzt;
    if (!tabSichtbar) return;
    const dt = rdt * Z.zeitFaktor * (RUHIG ? RUHIG_TEMPO : 1);
    T += dt; uhr += rdt; frame++;

    /* 2. Scroll, Parallaxe, Scroll-Tempo, Kamera */
    Z.uT = clamp(scrollY / Z.max, 0, 1) * 6;
    Z.uS += (Z.uT - Z.uS) * Math.min(1, rdt * (RUHIG ? 12 : 5));
    if (Math.abs(Z.uT - Z.uS) < 1e-4) Z.uS = Z.uT;
    const eingeschwungen = Z.uS === Z.uT;
    if (!streckeSichtbar && eingeschwungen && !zoom) { hud(); return; }
    if (FEIN && !RUHIG && maus.hat) { par.x += ((maus.x / W) * 2 - 1 - par.x) * Math.min(1, rdt * 3); par.y += (-((maus.y / H) * 2 - 1) - par.y) * Math.min(1, rdt * 3); }
    const v = Z.uT - Z.uS;
    if (!RUHIG) { kipp = lerp(kipp, clamp(v, -0.6, 0.6) * 0.03, Math.min(1, rdt * 6)); wipp = lerp(wipp, clamp(v, -0.6, 0.6) * 0.25, Math.min(1, rdt * 6)); }
    if (zoom) zoom.t += rdt;
    applyCam(Z.uS);
    if (PROBE) { const n = Math.round(Z.uS); if (n >= 1 && Math.abs(Z.uS - n) < 0.3 && !probeFertig.has(n)) { probeFertig.add(n); probe(n); } }

    /* 3. Band, Briefkasten, Werkstücke, Pressen */
    beltTex.tex.offset.x -= dt * ITEM_SPEED / 2;
    for (const it of items) {
      it.s += dt * ITEM_SPEED;
      if (it.s > BELT_LEN + 1.2) { it.s -= LOOP; it.fail = Math.random() < 0.2; it.rej = null; it.gone = false; it.g.visible = true; it.cur = -1; it.v = -1; }
      const vv = variantAt(it.s);
      if (vv !== it.v) {
        if (it.v === 4 && vv === 5) {
          if (it.fail) {
            it.rej = { t: 0, x: it.g.position.x, z: it.g.position.z }; laserRot = 0.9;
            pruef.zeilen = [true, true, true]; pruef.zeilen[Math.random() * 3 | 0] = false; pruef.aus = true; pruefTex.draw();
            if (!blaseZeit && Math.abs(Z.uS - 5) < 0.3) sage(zurueckBot, 'Das hier geht zurück. Der Knopf ist zu klein.');
          } else { pruef.zeilen = [true, true, true]; pruef.aus = false; pruefTex.draw(); }
        }
        it.v = vv;
      }
      if (it.gone) { if (it.g.visible) it.g.visible = false; continue; }
      let show = vv, px, py = BELT_Y, pz, sc = 1;
      pathAt(it.s, PT); px = PT.x; pz = PT.z;
      it.g.rotation.x = 0; it.g.rotation.z = 0;
      if (it.s < -0.9) { it.g.visible = false; continue; }
      it.g.visible = true;
      if (it.s < 0) {   // Briefumschlag fällt aus dem Schlitz aufs Band
        const q = (it.s + 0.9) / 0.9;
        px = lerp(SCHLITZ.x, X0, q); pz = lerp(SCHLITZ.z, 0, q); py = lerp(SCHLITZ.y, BELT_Y, q) + Math.sin(Math.PI * q) * 0.9;
        it.g.rotation.x = (1 - q) * 1.2; show = 0;
      }
      if (it.rej) {
        it.rej.t += dt / 1.1; const q = it.rej.t;
        if (q >= 1) { it.gone = true; it.g.visible = false; continue; }
        show = 7; px = lerp(it.rej.x, BINW.x, q); pz = lerp(it.rej.z, BINW.z, q); py = lerp(BELT_Y, BINW.y, q) + Math.sin(Math.PI * q) * 2.2; it.g.rotation.z = q * 3;
      }
      if (vv > 0 && !it.rej) { const d = it.s - THS[vv - 1]; if (d < 0.7) sc = 1 + 0.35 * Math.sin(Math.PI * d / 0.7); }
      if (show !== it.cur) { it.vs.forEach((g, i) => { g.visible = i === show; }); it.cur = show; }
      if (show === 0) it.vs[0].position.y = Math.sin(T * 3 + it.s) * 0.06;
      it.g.position.set(px, py, pz); if (!it.rej) it.g.rotation.y = PT.a; it.g.scale.setScalar(sc);
    }
    for (const p of pressen) {
      let near = 9;
      for (const it of items) if (!it.rej && !it.gone) near = Math.min(near, Math.abs(it.s - p.s));
      const pr = clamp(1 - near / 0.6, 0, 1);
      p.head.position.y = p.i === 1 ? 2.05 - 0.6 * smooth(pr) : 2.05 - 0.45 * smooth(pr);
      const warm = pr > 0.2, farbe = warm ? C.butter : C.salbei;
      if (p.warm !== warm) { p.warm = warm; p.lampMat.color.setHex(farbe); p.lampMat.emissive.setHex(farbe); }
      if (p.i === 1) { if (pr > 0.96 && !p.unten) { p.unten = true; blitz(FR[1], p.x, BELT_Y + 0.12, 0); } if (pr < 0.5) p.unten = false; }
    }
    for (const r of ringe) {
      if (r.t >= 1) continue;
      r.t += rdt / 0.35;
      const q = Math.min(1, r.t);
      r.m.scale.setScalar(lerp(0.6, 1.3, q)); r.m.material.opacity = 0.8 * (1 - q);
      if (q >= 1) r.m.visible = false;
    }

    /* 4. Helfer */
    for (const b of helfer) updateBot(b, dt, rdt, T);

    /* 5. Stationen */
    zuhoeren.root.getWorldPosition(wp);
    for (const q of fragen) {
      const f = ((T * 0.45 + q.off) % 1);
      q.s.position.set(wp.x - 0.2 + Math.sin(f * 6 + q.off * 9) * 0.3, 1.9 + f * 1.8, wp.z + 0.3);
      q.s.material.opacity = Math.sin(Math.PI * f);
    }
    for (const d of dampf) {
      const f = ((T * 0.5 + d.off) % 1);
      d.m.position.set(tassen[0][0] + Math.sin(f * 5 + d.off * 7) * 0.06, 1.08 + f * 0.7, tassen[0][1]);
      d.m.material.opacity = 0.6 * Math.sin(Math.PI * f); d.m.scale.setScalar(1 + f * 1.2);
    }
    { // grosser Stempel
      const sdt = stempel.manuell ? rdt : dt;
      stempel.t += sdt;
      if (stempel.t >= 3) { stempel.t -= 3; stempel.manuell = false; }
      const t = stempel.t;
      let y = 1.7;
      if (t >= 2.2 && t < 2.45) y = lerp(1.7, 0.41, smooth((t - 2.2) / 0.25));
      else if (t >= 2.45) y = lerp(0.41, 1.7, smooth(clamp((t - 2.45) / 0.55, 0, 1)));
      stempelG.position.y = y;
      if (t >= 2.45 && !stempel.unten) { stempel.unten = true; blitz(scene, 21, 0.43, -5.4); stempel.blatt = 0.25; }
      if (t < 2.2) stempel.unten = false;
      stempel.blatt = Math.max(0, stempel.blatt - sdt);
      stempelBlatt.position.y = 0.39 + (stempel.blatt > 0 ? Math.sin(Math.PI * (1 - stempel.blatt / 0.25)) * 0.05 : 0);
    }
    holo.rotation.y += dt * 0.5;
    for (const p of holoTeile) p.g.position.y = p.y + Math.sin(T * 1.6 + p.i) * 0.06;
    for (const m of monitore) {
      let neu = false;
      if (m.blitz > 0 && dt > 0) { m.blitz -= dt; neu = true; }   // angehalten: kein Neuzeichnen
      m.t += dt;
      if (m.phase === 'bau') { if (m.t >= 0.4) { m.t = 0; m.n++; m.blitz = 0.25; neu = true; if (m.n >= BLOECKE.length) { m.phase = 'steht'; } } }
      else if (m.phase === 'steht') { if (m.t > 1.6) { m.phase = 'weg'; m.t = 0; } }
      else { m.scroll = smooth(clamp(m.t / 0.6, 0, 1)) * 160; neu = dt > 0; if (m.t >= 0.6) { m.stil = STIL_FOLGE[(STIL_FOLGE.indexOf(m.stil) + 1) % 3]; m.n = 0; m.scroll = 0; m.t = 0; m.phase = 'bau'; neu = true; } }
      if (neu) m.api.draw();
    }
    zwUhr += dt;
    if (zwUhr >= 7) {
      zwUhr = 0; zwBlink = 0.8; zwTex.draw();
      const b = bauBots[1];
      if (!b.path) {
        b.mode = 'idle'; b.carry = true; bote2Blatt.visible = true;
        b.path = [[54, -3.8], [56.4, -2.55]]; b.pi = 1; b.wait = 0;
        b.tour = { ab() { bote2Blatt.visible = false; b.carry = false; }, fertig() { b.mode = 'type'; } };
      }
    }
    if (zwBlink > 0) { zwBlink -= dt; if (zwBlink <= 0) zwTex.draw(); }
    { const ph = T * 1.1;
      arm.turm.rotation.y = -0.2 + Math.sin(ph) * 0.7; arm.schulter.rotation.x = 0.55 + Math.sin(ph * 2) * 0.18;
      arm.ellbogen.rotation.x = 1.05 + Math.sin(ph * 2 + 1) * 0.25; arm.hand.rotation.y = T * 2;
      arm.block.visible = Math.sin(ph) > -0.35; }
    // Prüfung
    if (laserRot > 0) { laserRot -= dt; laserMat.color.setHex(C.rot); scanMat.color.setHex(C.rot); laserMat.opacity = 0.32; }
    else { laserMat.color.setHex(C.kobalt); scanMat.color.setHex(C.kobalt); laserMat.opacity = 0.16 + Math.sin(T * 4) * 0.04; }
    scan.position.y = 0.75 + (Math.sin(T * 2.4) * 0.5 + 0.5) * 2.5;
    {
      let fo = 0;
      for (const it of items) { if (it.rej || it.gone) continue; const d = THS[4] - it.s; if (d >= 0 && d < ITEM_GAP) fo = Math.max(fo, 1 - d / ITEM_GAP); }
      if (Math.abs(fo - pruef.alt) > 0.04) { pruef.alt = fo; pruef.fortschritt = fo; pruefTex.draw(); }
    }
    { // Daumen-Test
      daumen.tipp += dt;
      let th = -0.12;
      const zyk = daumen.tipp % 1.6;
      if (zyk > 1.15 && zyk < 1.45) th = lerp(-0.12, 0.34, Math.sin(Math.PI * (zyk - 1.15) / 0.3));
      if (daumen.zwang > 0) { daumen.zwang -= rdt; th = lerp(-0.12, 0.34, Math.sin(Math.PI * clamp(1 - daumen.zwang / 0.32, 0, 1))); }
      daumenG.rotation.x = th;
      const druck = th > 0.28 ? 1 : 0;
      let neu = druck !== daumen.druck; daumen.druck = druck;
      if (daumen.gesendet > 0) { daumen.gesendet -= rdt; neu = true; if (daumen.gesendet <= 0) daumen.gesendet = 0; }
      if (neu) daumenTex.draw();
    }
    // Übergabe: Pendeln, Puls, Hebel, Füllen, Konfetti
    // v3-Fix: Pendeln um die Blickrichtung der Kamera (im Frame B), nicht um -0.3; sonst stehen die Bildschirme auf der Kante
    geraete.forEach((g, i) => { g.rotation.y = FRONT6 + Math.sin(T * 0.7 + i * 1.3) * (i === 2 ? 0.05 : 0.14); });
    rahmenGlanz = Math.max(0, rahmenGlanz - rdt / 3);
    rahmenMat.emissiveIntensity = (RUHIG ? 0.15 : 0.15 + (Math.sin(T * Math.PI) * 0.5 + 0.5) * 0.25) + rahmenGlanz;
    switch (hebel.zustand) {
      case 'ruhe': hebel.w = lerp(hebel.w, 0.55, Math.min(1, rdt * 10)); break;
      case 'schwung': { hebel.t += rdt; const q = Math.min(1, hebel.t / 0.35); hebel.w = lerp(hebel.start, -0.55, easeBack(q)); if (q >= 1) { hebel.zustand = 'halt'; hebel.t = 0; effekteHebel(); } break; }
      case 'halt': hebel.t += rdt; hebel.w = -0.55; if (hebel.t > 1.2) { hebel.zustand = 'zurueck'; hebel.t = 0; hebel.start = -0.55; } break;
      case 'zurueck': { hebel.t += rdt; const q = Math.min(1, hebel.t / 0.8); hebel.w = lerp(hebel.start, 0.55, easeBack(q)); if (q >= 1) { hebel.zustand = 'ruhe'; hebel.w = 0.55; } break; }
    }
    hebelArm.rotation.x = -hebel.w;
    if (hebel.zustand === 'ruhe') {
      hebel.auto += dt;
      if (hebel.auto >= 16 && hebel.zieh < 0) { hebel.zieh = 0; uebergabe1.mode = 'ziehen'; }
    }
    if (hebel.zieh >= 0) {
      hebel.zieh += dt;
      if (zug && zug.art === 'hebel') { hebel.zieh = -1; uebergabe1.mode = 'idle'; }   // der Besucher zieht schon
      else if (hebel.zieh > 1.1) { hebel.zieh = -1; uebergabe1.mode = 'idle'; hebelAusloesen(); }
    }
    if (fuell.t > 0) {   // Block für Block füllen, dann stehen lassen, damit man die fertige Seite sieht
      fuell.t += rdt;
      const n = fuell.t > FUELL_DAUER ? 0 : Math.min(7, 1 + Math.floor(fuell.t / 0.3));
      if (fuell.t > FUELL_DAUER) fuell.t = 0;
      if (n !== fuell.n) { fuell.n = n; ihrTex.draw(); }
    }
    // Kamera schiebt sich beim Füllen näher an "Ihr Betrieb" (nicht bei reduzierter Bewegung)
    schub = lerp(schub, !RUHIG && fuell.t > 0 && fuell.t < FUELL_DAUER - 0.6 ? 1 : 0, Math.min(1, rdt * 2.2));
    // Beim Ankommen an Station 6 fällt der Hebel einmal von selbst
    if (Z.uS < 5.5) ankunft.fertig = false;
    if (!ankunft.fertig && Math.abs(Z.uS - 6) < 0.12 && streckeSichtbar) {
      ankunft.t += rdt;
      if (ankunft.t > 0.35 && !RUHIG && hebel.zieh < 0 && hebel.zustand === 'ruhe') { hebel.zieh = 0; uebergabe1.mode = 'ziehen'; }
      if (ankunft.t > 0.35 && (RUHIG || Z.zeitFaktor === 0) && hebel.zustand === 'ruhe') hebelAusloesen();
      if (hebel.zustand !== 'ruhe' || hebel.zieh >= 0) { ankunft.fertig = true; ankunft.t = 0; }
    } else ankunft.t = 0;
    for (const p of konfetti) {
      if (p.life <= 0) continue;
      p.life -= rdt; p.v.y -= 9.8 * rdt; p.v.multiplyScalar(1 - rdt * 0.6);
      p.m.position.addScaledVector(p.v, rdt);
      p.m.rotation.x += p.w.x * rdt; p.m.rotation.y += p.w.y * rdt; p.m.rotation.z += p.w.z * rdt;
      if (p.life <= 0 || p.m.position.y < 0.02) { p.life = 0; p.m.visible = false; }
    }
    // Vordergrund-Objekte
    const cardSicht = clamp((Z.uS - 0.45) / 0.3, 0, 1) * (1 - clamp((scrollY - Z.max) / (H * 0.3), 0, 1));
    const vh = 10, vw = vh * W / H;
    const vorGr = W < 760 ? 0.5 : 1;   // am Handy kleiner, sonst deckt ein Objekt ein Drittel der Szene
    for (const o of vorObjekte) {
      o.g.scale.setScalar(vorGr);
      if (RUHIG) {   // still am Rand, und nur das Objekt des Abschnitts, in dem man gerade ist
        o.g.visible = cardSicht > 0.3 && Math.abs(o.u - Z.uS) < 0.5;
        o.g.position.set(o.park[0] * vw, o.park[1] * vh, 0); o.g.rotation.set(0.12, o.ry[0], o.rz);
        continue;
      }
      const d = o.u - Z.uS;
      const x = d * 1.8 * vw * 0.75;
      o.g.visible = Math.abs(x) < vw * 0.5 + 4 && cardSicht > 0;
      if (!o.g.visible) continue;
      o.g.position.set(x, o.y * vh + d * 0.6, 0);
      o.g.rotation.set(0.12 + d * 0.2, o.ry[0] + d * o.ry[1], o.rz + d * 0.4);
    }

    /* 6. Hover und Auto-Plaudern */
    if (FEIN && maus.hat && !zug && (frame & 1) === 0) {
      let art = '';
      if (!maus.ueberUI) {
        const o = zielBei(maus.x, maus.y);
        if (o) {
          const d = o.userData;
          if (d.bot) { art = 'hallo'; if (hoverBot !== d.bot) { hoverBot = d.bot; d.bot.hopT = 0; } }
          else { art = d.zeiger || 'klick'; hoverBot = null; }
        } else { hoverBot = null; if (tafelBei(maus.x, maus.y)) art = 'stift'; }
      }
      zeigerArt(art);
      html.classList.toggle('zeiger-szene', ZEIGER.an && !maus.ueberUI);
      if (!ZEIGER.an) canvas.style.cursor = art ? (art === 'stift' ? 'crosshair' : 'pointer') : '';
    }
    if (blaseZeit > 0) { blaseZeit = Math.max(0, blaseZeit - rdt); if (!blaseZeit) blase.classList.remove('zeigen'); }
    const nah = Math.round(Z.uS);
    // Plaudern läuft immer, auch angehalten und im ruhigen Modus (Text, keine Bewegung); im Hero spricht EMPFANG
    if (nah >= 0 && nah <= 6 && Math.abs(Z.uS - nah) < 0.2 && !blaseZeit && uhr - letztesPlaudern > PLAUDER_ABSTAND) {
      const kandidaten = nah === 0 ? [empfangBot] : helfer.filter(b => b.station === nah);
      if (kandidaten.length) { const b = pick(kandidaten); sage(b, zitat(b)); }
    }

    /* 7. Rendern: Hauptszene, Tiefe leeren, Vordergrund */
    renderer.clear();
    renderer.render(scene, cam);
    renderer.clearDepth();
    renderer.render(vorScene, vorCam);

    /* 8. Beschriftungen und Sprechblase */
    // v3-Fix: Flächen des HUD, unter die weder Schilder noch Blasen rutschen dürfen
    if ((frame % 12) === 0 || !hudFlaechen.length) hudFlaechenMessen();
    for (const s of schilder) {
      const [x, y] = projiziere(s.p);
      const sicht = x > -300 && x < W + 300 && y > -100 && y < H + 100;
      if (sicht !== s.sicht) { s.el.style.visibility = sicht ? '' : 'hidden'; s.sicht = sicht; }
      if (!sicht) continue;
      s.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`;
      if (!s.w) { s.w = s.el.offsetWidth; s.h = s.el.offsetHeight; }
      const r = [x - s.w / 2, y - s.h, x + s.w / 2, y];
      // Schild der Station, an der man gerade steht, sagt die Karte schon; sonst nicht unter Kopf, Karte, Leiste oder am Rand
      const weg = (s.station && Math.abs(Z.uS - s.station) < 0.45) || r[0] < 4 || r[2] > W - 4 || hudFlaechen.some(f => schneidet(r, f));
      if (weg !== !!s.weg) { s.weg = weg; s.el.style.opacity = weg ? '0' : ''; }
    }
    if (blaseBot && blaseZeit > 0) blaseSetzen();
    if (ZEIGER.an) {
      ZEIGER.rx += (ZEIGER.x - ZEIGER.rx) * Math.min(1, rdt * 14); ZEIGER.ry += (ZEIGER.y - ZEIGER.ry) * Math.min(1, rdt * 14);
      zeigerPunkt.style.transform = `translate3d(${ZEIGER.x}px,${ZEIGER.y}px,0)`;
      zeigerRing.style.transform = `translate3d(${ZEIGER.rx.toFixed(1)}px,${ZEIGER.ry.toFixed(1)}px,0)`;
      zeigerEl.classList.toggle('an', maus.hat && !maus.ueberUI);
    }

    /* 9. HUD */
    hud();
  }
  const zeigerPunkt = $('.z-punkt', zeigerEl), zeigerRing = $('.z-pos', zeigerEl);

  /* ---------- Grösse ---------- */
  function groesse() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    vermessen(); buildKeys();
  }
  addEventListener('resize', groesse);
  groesse();

  /* ---------- Schriften: Canvas-Texturen neu zeichnen ---------- */
  const neuZeichnen = () => { texDrawers.forEach(t => t.draw()); schilder.forEach(s => { s.w = 0; }); };
  Promise.all([
    document.fonts.load(`850 30px "Archivo"`), document.fonts.load(`600 20px "Atkinson Hyperlegible Mono"`),
    document.fonts.load(`400 20px "Atkinson Hyperlegible Mono"`), document.fonts.load(`30px "Notiz"`),
  ]).then(neuZeichnen, neuZeichnen);
  document.fonts.ready.then(neuZeichnen);

  Z.uS = Z.uT = clamp(scrollY / Z.max, 0, 1) * 6;
  requestAnimationFrame(schleife);
  return { springe };
}

/* ======================================================================
   Start
   ====================================================================== */
function inhaltStart() {
  vermessen();
  formular();
  // erst messen, wenn Archivo geladen ist, sonst stimmen die Zeilen nicht
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(zeilenVorbereiten, zeilenVorbereiten);
  zeigerEffekte();
  let geplant = false;
  addEventListener('scroll', () => { if (!geplant) { geplant = true; requestAnimationFrame(() => { geplant = false; kapaLauf(); }); } }, { passive: true });
  addEventListener('resize', vermessen);
  kapaLauf();
}

// Prüfhilfe: ?nurstrecke blendet die Inhaltsabschnitte aus, dann liegt Station k genau bei k/6 des Scrollwegs
if (new URLSearchParams(location.search).has('nurstrecke')) $('.inhalt').style.display = 'none';
heroAufbau();
inhaltStart();
if (!html.classList.contains('no-webgl')) {
  const canvas = $('#szene');
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { renderer = null; }
  if (renderer) {
    try { Z.welt = welt(renderer, canvas); }
    catch (e) { console.warn('Werkstatt nicht gebaut:', e); html.classList.add('no-webgl'); }
  } else html.classList.add('no-webgl');
}
if (/^#station-[1-6]$/.test(location.hash) && !html.classList.contains('no-webgl')) { vermessen(); scrollTo(0, Z.max * (+location.hash.slice(9)) / 6); }
