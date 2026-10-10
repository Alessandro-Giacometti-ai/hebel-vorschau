/* Fumo: Glut-Partikel als GPU-Punkte.
   Handlung: Funken steigen aus dem Herd im Einstiegsbild und, sobald der Film läuft, aus der Glut unter
   der Pfanne; das Scroll-Tempo facht sie an und zieht sie als Schweif nach, der Zeiger bläst sie weg,
   am Ende der Film-Strecke fliegen sie in den Abschnitt "Die Karte" und formen dort das Fumo-Zeichen; am Seitenende sammeln sie sich im o des Logos, nach einer
   Reservierung im Zeichen der Bestätigung. Gerendert wird nur, solange eine dieser Stellen sichtbar ist. */
// three wird erst nach der Prüfung geladen: bei reduzierter Bewegung oder ohne WebGL gar nicht (187 KB gzip)
let THREE = null;

const html = document.documentElement;
const leinwand = document.querySelector('[data-glut]');
const ruhig = html.classList.contains('ruhig');

function webglDa() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (!leinwand || ruhig || !webglDa()) {
  html.classList.add('ohne-webgl');
} else {
  // Die Glut kommt nach dem Laden der Seite: three (187 KB gzip) soll das Heldenbild nicht bremsen
  const laden = () => import('three').then(modul => {
    THREE = modul;
    starten();
  }).catch(() => { html.classList.add('ohne-webgl'); html.classList.remove('glut-an'); });
  if (document.readyState === 'complete') laden(); else addEventListener('load', laden, { once: true });
}

function starten() {
  const schmal = window.innerWidth < 768;
  const ANZAHL = schmal ? 950 : 1900;

  const renderer = new THREE.WebGLRenderer({ canvas: leinwand, alpha: true, antialias: false, powerPreference: 'default', premultipliedAlpha: true });
  const pr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  const szene = new THREE.Scene();
  const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* Zielpunkte aus dem Zeichen: Scheibe mit ausgesparter Flamme, Kanten dichter besetzt */
  const ZEICHEN = 'M84.0 50.0 C84.0 31.2 68.8 16.0 50.0 16.0 C31.2 16.0 16.0 31.2 16.0 50.0 C16.0 68.8 31.2 84.0 50.0 84.0 C68.8 84.0 84.0 68.8 84.0 50.0ZM50.0 70.4 C60.2 70.4 66.3 63.6 66.3 54.1 C66.3 45.2 60.2 39.8 58.2 34.4 C56.5 30.3 57.5 26.2 60.2 22.8 C52.7 24.8 48.0 30.3 48.0 36.4 C48.0 39.1 48.6 41.2 49.3 43.2 C44.6 41.2 41.8 37.8 41.2 33.7 C35.7 38.4 33.7 46.6 33.7 54.1 C33.7 63.6 39.8 70.4 50.0 70.4Z';
  const pfad = new Path2D(ZEICHEN);
  const ctx = document.createElement('canvas').getContext('2d');
  const drin = (x, y) => ctx.isPointInPath(pfad, x, y, 'evenodd');

  const rand = new Float32Array(ANZAHL * 4);
  const ziel = new Float32Array(ANZAHL * 2);
  const pos = new Float32Array(ANZAHL * 3);
  let n = 0, versuche = 0;
  while (n < ANZAHL && versuche < ANZAHL * 60) {
    versuche++;
    const x = 16 + Math.random() * 68, y = 16 + Math.random() * 68;
    if (!drin(x, y)) continue;
    const e = 1.5;
    const kante = !drin(x + e, y) || !drin(x - e, y) || !drin(x, y + e) || !drin(x, y - e);
    if (!kante && Math.random() > 0.5) continue;
    ziel[n * 2] = (x - 16) / 68;
    ziel[n * 2 + 1] = (y - 16) / 68;
    n++;
  }
  for (let i = 0; i < ANZAHL; i++) {
    rand[i * 4] = Math.random();
    rand[i * 4 + 1] = Math.random();
    rand[i * 4 + 2] = Math.random();
    rand[i * 4 + 3] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
  geo.setAttribute('aZiel', new THREE.BufferAttribute(ziel, 2));

  const uniforms = {
    uZeit: { value: 0 },
    uAufl: { value: new THREE.Vector2(1, 1) },
    uPR: { value: pr },
    uQuelle: { value: new THREE.Vector4(0, 0, 1, 1) },
    uAnker: { value: new THREE.Vector4(0, 0, 1, 1) },
    uSammeln: { value: 0 },
    uTempo: { value: 0 },
    uZeiger: { value: new THREE.Vector4(-9999, -9999, 0, 150) },
    uZeigerV: { value: new THREE.Vector2(0, 0) },
    uHoehe: { value: 600 },
    uAlpha: { value: 0 },
    uDichte: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aRand;
      attribute vec2 aZiel;
      uniform float uZeit;
      uniform vec2 uAufl;
      uniform float uPR;
      uniform vec4 uQuelle;
      uniform vec4 uAnker;
      uniform float uSammeln;
      uniform float uTempo;
      uniform vec4 uZeiger;
      uniform vec2 uZeigerV;
      uniform float uHoehe;
      uniform float uAlpha;
      uniform float uDichte;
      varying float vHitze;
      varying float vAlpha;
      varying float vStreck;

      void main() {
        float tempo = abs(uTempo);
        // Lebenslauf eines Funkens: geboren in der Glut, steigt, kühlt ab, verlischt
        float schnell = mix(0.06, 0.15, aRand.z) * (1.0 + tempo * 0.8);
        float t = fract(uZeit * schnell + aRand.w);
        vec2 start = uQuelle.xy + vec2(aRand.x, 0.35 + aRand.y * 0.65) * uQuelle.zw;
        float steigen = t * uHoehe * mix(0.5, 1.2, aRand.y);
        float pendel = sin(t * 7.0 + aRand.x * 40.0 + uZeit * 0.7) * (8.0 + 46.0 * t) * mix(0.3, 1.0, aRand.z);
        float drift = (aRand.x - 0.45) * 160.0 * t * t;
        vec2 frei = start + vec2(pendel + drift, -steigen);
        // Scroll-Tempo: die Funken bleiben zurück und ziehen als Schweif in den nächsten Abschnitt
        frei.y += uTempo * 230.0 * t * mix(0.4, 1.0, aRand.z);
        frei.x += uTempo * 70.0 * sin(aRand.w * 31.0) * t;

        // Ziel im Zeichen, mit leisem Flimmern
        vec2 z = uAnker.xy + aZiel * uAnker.zw;
        z += vec2(sin(uZeit * 2.1 + aRand.w * 50.0), cos(uZeit * 1.7 + aRand.x * 50.0)) * (0.9 + 0.006 * uAnker.z);
        float verz = aRand.z * 0.42;
        float g = smoothstep(verz, verz + 0.58, uSammeln);
        vec2 weg = z - frei;
        vec2 quer = normalize(vec2(-weg.y, weg.x) + 0.0001);
        vec2 p = mix(frei, z, g) + quer * sin(g * 3.14159) * (aRand.x - 0.5) * 320.0;

        // Zeiger: ein Luftstoss schiebt die Funken weg und nimmt sie mit
        vec2 d = p - uZeiger.xy;
        float abst = length(d);
        float stoss = exp(-(abst * abst) / (uZeiger.w * uZeiger.w)) * uZeiger.z;
        p += normalize(d + 0.0001) * stoss * 64.0 + uZeigerV * stoss * 1.4;

        // Hitze und Sichtbarkeit
        float frischHitze = 1.0 - t;
        float frischAlpha = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.5, 1.0, t));
        float flackern = 0.6 + 0.4 * sin(uZeit * (5.0 + aRand.y * 9.0) + aRand.x * 60.0);
        vHitze = mix(frischHitze, 0.6 + 0.45 * flackern, g) + stoss * 0.5 + tempo * 0.15;
        vAlpha = mix(frischAlpha, 0.75 + 0.35 * flackern, g) * uAlpha * mix(1.0, uDichte, g);
        vStreck = min(tempo * 1.4, 2.2) * (1.0 - g);

        float groesse = mix(1.6, 5.2, pow(aRand.y, 3.0)) * (0.8 + 0.6 * vHitze);
        groesse = mix(groesse, mix(1.8, 3.9, aRand.y) * clamp(uAnker.z / 300.0, 0.55, 1.4), g);
        gl_PointSize = groesse * (1.0 + vStreck * 0.9) * uPR * 2.0;
        gl_Position = vec4(p.x / uAufl.x * 2.0 - 1.0, 1.0 - p.y / uAufl.y * 2.0, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying float vHitze;
      varying float vAlpha;
      varying float vStreck;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        q.x *= 1.0 + vStreck;
        float r = length(q) * 2.0;
        float kern = smoothstep(1.0, 0.0, r);
        float glanz = pow(kern, 4.0);
        vec3 kalt = vec3(0.42, 0.06, 0.02);
        vec3 glut = vec3(0.886, 0.333, 0.169);
        vec3 heiss = vec3(1.0, 0.80, 0.50);
        vec3 farbe = mix(kalt, glut, smoothstep(0.05, 0.55, vHitze));
        farbe = mix(farbe, heiss, smoothstep(0.5, 1.1, vHitze) * glanz);
        float a = (kern * 0.35 + glanz * 0.9) * vAlpha;
        if (a < 0.003) discard;
        gl_FragColor = vec4(farbe * a, a);
      }
    `,
  });
  const punkte = new THREE.Points(geo, material);
  punkte.frustumCulled = false;
  szene.add(punkte);
  html.classList.add('glut-an');

  /* ---------- Orte auf der Seite ---------- */
  const heroBild = document.querySelector('[data-einstieg-bild] img');
  const ankerFeuer = document.querySelector('[data-glut-anker="karte"]');
  const ankerFuss = document.querySelector('[data-glut-anker="fuss"]');
  const bestZeichen = document.querySelector('.bestaetigung__zeichen');
  const BILD = { w: 1536, h: 1024, x0: 660, x1: 1290, y0: 410, y1: 610 };

  function herdRechteck(B, H) {
    if (!heroBild) return null;
    const r = heroBild.getBoundingClientRect();
    if (r.bottom < -H * 0.2) return { r, q: null };
    const cs = getComputedStyle(heroBild).objectPosition.split(' ');
    const px = parseFloat(cs[0]) / 100 || 0.6, py = parseFloat(cs[1]) / 100 || 0.5;
    const s = Math.max(r.width / BILD.w, r.height / BILD.h);
    const dw = BILD.w * s, dh = BILD.h * s;
    const ox = r.left + (r.width - dw) * px, oy = r.top + (r.height - dh) * py;
    return { r, q: [ox + BILD.x0 * s, oy + BILD.y0 * s, (BILD.x1 - BILD.x0) * s, (BILD.y1 - BILD.y0) * s] };
  }
  const klemm = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Zeiger ---------- */
  const zeiger = { x: -9999, y: -9999, vx: 0, vy: 0, kraft: 0, zuletzt: 0 };
  window.addEventListener('pointermove', (e) => {
    const jetzt = performance.now();
    if (zeiger.zuletzt) { zeiger.vx = zeiger.vx * 0.6 + (e.clientX - zeiger.x) * 0.4; zeiger.vy = zeiger.vy * 0.6 + (e.clientY - zeiger.y) * 0.4; }
    zeiger.x = e.clientX; zeiger.y = e.clientY; zeiger.zuletzt = jetzt;
    zeiger.kraft = Math.min(1, zeiger.kraft + Math.hypot(zeiger.vx, zeiger.vy) * 0.02 + 0.05);
    wecken();
  }, { passive: true });
  window.addEventListener('pointerleave', () => { zeiger.x = zeiger.y = -9999; });

  /* ---------- Bestätigung: Funken sammeln sich im Zeichen ---------- */
  let bestStart = -1;
  window.addEventListener('fumo:bestaetigt', () => { bestStart = performance.now() + 500; wecken(); });

  /* ---------- Schleife, nur bei Bedarf ---------- */
  let laeuft = false, letztesY = window.scrollY, tempo = 0, start = performance.now(), sammeln = 0, leer = false;
  let quelleAkt = null;
  function groesse() {
    const w = leinwand.clientWidth, h = leinwand.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uAufl.value.set(w, h);
    uniforms.uHoehe.value = h * (schmal ? 0.62 : 0.72);
    uniforms.uZeiger.value.w = schmal ? 110 : 150;
  }
  groesse();
  new ResizeObserver(groesse).observe(leinwand);

  function bild(jetzt) {
    laeuft = false;
    if (document.hidden) return;
    const B = uniforms.uAufl.value.x, H = uniforms.uAufl.value.y;
    const zeit = (jetzt - start) / 1000;
    uniforms.uZeit.value = zeit;
    uniforms.uAlpha.value = klemm((zeit - 0.9) / 1.8, 0, 1);

    // Scroll-Tempo, geglättet
    const y = window.fumoLenis ? window.fumoLenis.scroll : window.scrollY;
    const dy = y - letztesY; letztesY = y;
    tempo += (klemm(dy / 38, -2.6, 2.6) - tempo) * 0.14;
    uniforms.uTempo.value = tempo;

    // Zeiger klingt ab
    zeiger.kraft *= 0.965; zeiger.vx *= 0.9; zeiger.vy *= 0.9;
    uniforms.uZeiger.value.set(zeiger.x, zeiger.y, 0.25 + zeiger.kraft * 0.75, uniforms.uZeiger.value.w);
    uniforms.uZeigerV.value.set(zeiger.vx, zeiger.vy);

    // Welcher Ort führt?
    const herd = herdRechteck(B, H);
    const rF = ankerFeuer.getBoundingClientRect();
    const rU = ankerFuss.getBoundingClientRect();
    const rB = bestZeichen && !bestZeichen.closest('[hidden]') ? bestZeichen.getBoundingClientRect() : null;
    let anker = rF, quelle = herd && herd.q, ziel = 0, dichte = 1;
    let aktiv = false;

    if (rB && bestStart > 0 && rB.bottom > -40 && rB.top < H + 40) {
      // Nach der Reservierung: aus dem unteren Rand ins kleine Zeichen
      anker = rB;
      quelle = [rB.left - rB.width, H + 10, rB.width * 3, 40];
      ziel = klemm((jetzt - bestStart) / 1800, 0, 1);
      dichte = 0.45;
      aktiv = true;
    } else if (rU.top < H * 1.7) {
      // Seitenende: aus dem unteren Rand ins o des Logos
      anker = rU;
      quelle = [rU.left, H + 10, rU.width, 40];
      ziel = klemm((H * 1.02 - rU.top) / (H * 0.72), 0, 1);
      dichte = 0.85;
      aktiv = rU.top < H * 1.1;
    } else {
      ziel = klemm((H * 0.98 - rF.top) / (H * 0.62), 0, 1);
      // Läuft der Film, kommen die Funken aus der Glut im Film statt aus dem Herd im Foto
      const film = window.fumoFilm;
      if (film && film.glut && film.deckung > 0.5) quelle = film.glut;
      const heroSichtbar = herd && herd.r.bottom > 0;
      const feuerSichtbar = rF.bottom > -60 && rF.top < H + 60;
      aktiv = heroSichtbar || (feuerSichtbar && ziel > 0) || (ziel > 0 && ziel < 1);
      if (!quelle) quelle = [rF.left, -H, rF.width, 10];
    }
    // Quelle gleitet, statt zu springen: der ganze Schwarm zieht mit
    if (!quelleAkt) quelleAkt = quelle.slice();
    for (let k = 0; k < 4; k++) quelleAkt[k] += (quelle[k] - quelleAkt[k]) * 0.07;
    quelle = quelleAkt;
    sammeln += (ziel - sammeln) * 0.12;
    if (Math.abs(ziel - sammeln) < 0.0005) sammeln = ziel;
    uniforms.uSammeln.value = sammeln;
    uniforms.uAnker.value.set(anker.left, anker.top, anker.width, anker.height);
    uniforms.uQuelle.value.set(quelle[0], quelle[1], quelle[2], quelle[3]);
    uniforms.uDichte.value = dichte;

    if (aktiv) {
      renderer.render(szene, kamera);
      leer = false;
      weiter();
    } else if (!leer) {
      renderer.clear();
      leer = true;
    }
  }
  function weiter() { if (!laeuft) { laeuft = true; requestAnimationFrame(bild); } }
  function wecken() { weiter(); }
  window.addEventListener('scroll', wecken, { passive: true });
  if (window.fumoLenis) window.fumoLenis.on('scroll', wecken);
  window.addEventListener('resize', wecken);
  document.addEventListener('visibilitychange', wecken);
  weiter();

  // Zum Prüfen: Zustand ablesbar, ohne den Ablauf zu stören
  window.fumoGlut = { get sammeln() { return sammeln; }, get tempo() { return tempo; }, anzahl: ANZAHL, ziele: n };
}
