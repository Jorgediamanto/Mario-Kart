/* global KART_TRACKS, KART_GEOM */
/*
 * Kart Party — pantalla 3D (la tele)
 * Toda la simulación vive aquí; los móviles solo mandan botones a través del servidor.
 * Coordenadas: el plano del circuito es (x, y) en 1920x1080; en 3D, X = x, Z = y, Y = altura.
 */
import * as THREE from 'three';

(() => {
  'use strict';

  // ===================== Constantes =====================
  const MAP_W = 1920, MAP_H = 1080;
  const DT = 1 / 60;
  const KART_R = 15;
  const BASE_MAX_SPEED = 420;   // unidades/s (sube o baja este número para karts más rápidos o más lentos)
  const ACCEL = 460, BRAKE = 750, COAST = 240;
  const GRAVITY = 950;          // unidades/s²
  const SPIN_TIME = 1.0;
  const ROULETTE_TIME = 1.6;
  const BOX_RESPAWN = 5;
  const MAX_KARTS = 8;
  const SAMPLE_SPACING = 8;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
  const UI_FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

  const CHARS = [
    { name: 'Rana', emoji: '🐸', color: '#39ff88', accent: '#ff2d95' },
    { name: 'Zorro', emoji: '🦊', color: '#ff8a00', accent: '#00e5ff' },
    { name: 'Panda', emoji: '🐼', color: '#ffffff', accent: '#ff2d95' },
    { name: 'Tigre', emoji: '🐯', color: '#ffe600', accent: '#9b3bff' },
    { name: 'Unicornio', emoji: '🦄', color: '#ff5ec8', accent: '#00e5ff' },
    { name: 'Pulpo', emoji: '🐙', color: '#9b3bff', accent: '#ffe600' },
    { name: 'Pingüino', emoji: '🐧', color: '#00e5ff', accent: '#ffe600' },
    { name: 'Dino', emoji: '🦖', color: '#ff3d3d', accent: '#39ff88' },
  ];
  const ITEMS = {
    mushroom: { icon: '🍄', name: 'Champiñón' },
    banana: { icon: '🍌', name: 'Plátano' },
    green: { icon: '🐢', name: 'Caparazón verde' },
    red: { icon: '🎯', name: 'Caparazón rojo' },
    star: { icon: '⭐', name: 'Estrella' },
    lightning: { icon: '⚡', name: 'Rayo' },
  };
  const ITEM_IDS = Object.keys(ITEMS);

  // ===================== Utilidades =====================
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function wrapAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = s - m * 60;
    return `${m}:${r.toFixed(2).padStart(5, '0')}`;
  }
  function ordinal(n) { return `${n}º`; }
  function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // Muelle amortiguado: para aplastar/estirar/inclinar los karts con rebote
  class Spring {
    constructor(k, c) { this.v = 0; this.vel = 0; this.k = k; this.c = c; }
    step(target, dt) {
      const a = (target - this.v) * this.k - this.vel * this.c;
      this.vel += a * dt;
      this.v += this.vel * dt;
      return this.v;
    }
  }

  // ===================== DOM =====================
  const canvas = document.getElementById('c');
  const stage = document.getElementById('stage');
  const ui = document.getElementById('ui');
  const $ = (id) => document.getElementById(id);
  const lobbyEl = $('lobby'), resultsEl = $('results'), noticeEl = $('notice'), hudEl = $('hud'), bigEl = $('big'), toastsEl = $('toasts'), flashEl = $('flash');

  // ===================== Three.js =====================
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    noticeEl.textContent = 'Este navegador no puede mostrar 3D (WebGL). Prueba con Chrome, Edge o Safari actualizados.';
    noticeEl.classList.remove('hidden');
    throw e;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 20, 9000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8060ff, 1.4);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-700, 1300, 900);
  scene.add(hemi, sun);

  const toonGradient = (() => {
    const tex = new THREE.DataTexture(new Uint8Array([70, 130, 200, 255]), 4, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
    return tex;
  })();
  const matCache = new Map();
  function toon(color) {
    const key = 't' + color;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient }));
    return matCache.get(key);
  }
  function flat(color, opts) {
    const key = 'f' + color + JSON.stringify(opts || {});
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color, ...(opts || {}) }));
    return matCache.get(key);
  }
  function shade(hex, dl) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, dl); return '#' + c.getHexString(); }

  let viewW = 1, viewH = 1;
  function resize() {
    viewW = window.innerWidth; viewH = window.innerHeight;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    const s = Math.min(viewW / MAP_W, viewH / MAP_H);
    stage.style.width = Math.floor(MAP_W * s) + 'px'; stage.style.height = Math.floor(MAP_H * s) + 'px';
    ui.style.transform = `scale(${s})`;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- texturas de texto / emoji (sprites) ----
  const texCache = new Map();
  function textTexture(text, opts) {
    const key = text + '|' + JSON.stringify(opts);
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = opts.w; c.height = opts.h;
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = opts.font;
    if (opts.bg) { g.fillStyle = opts.bg; g.beginPath(); g.roundRect(4, 4, c.width - 8, c.height - 8, 20); g.fill(); }
    if (opts.stroke) { g.lineWidth = opts.strokeW || 8; g.strokeStyle = opts.stroke; g.strokeText(text, c.width / 2, c.height / 2 + (opts.dy || 0)); }
    g.fillStyle = opts.color || '#fff';
    g.fillText(text, c.width / 2, c.height / 2 + (opts.dy || 0));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }
  function makeSprite(tex, order) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.renderOrder = order || 10;
    return s;
  }
  // escala para que un sprite mida `px` píxeles en pantalla esté donde esté
  const _v = new THREE.Vector3();
  function screenScale(sprite, px, aspect) {
    sprite.getWorldPosition(_v);
    const dist = _v.distanceTo(camera.position);
    const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / viewH;
    sprite.scale.set(px * worldPerPx * aspect, px * worldPerPx, 1);
  }

  // ===================== Circuitos =====================
  function buildTrack(def, index) {
    const samples = KART_GEOM.buildSamples(def.points, SAMPLE_SPACING);
    const N = samples.length;
    const halfW = def.width / 2;
    const elev = new Float32Array(N);
    for (const f of def.features || []) {
      const start = Math.floor(f.at * N);
      const len = Math.max(2, Math.round(f.length / SAMPLE_SPACING));
      for (let j = 0; j < len; j++) {
        const i = (start + j) % N, u = j / len;
        if (f.type === 'hill') elev[i] += f.height * 0.5 * (1 - Math.cos(u * Math.PI * 2));
        else if (f.type === 'ramp') elev[i] += f.height * u;
      }
    }
    samples.forEach((s, i) => { s.nx = -Math.sin(s.ang); s.ny = Math.cos(s.ang); s.h = elev[i]; });

    const t = {
      def, index, name: def.name, samples, N, halfW, width: def.width, gravity: def.gravity || 1,
      win: Math.floor(N / 8), boxes: [], grid: [], pads: [], barriers: [], ramps: [], world: null,
      nearest(x, y) {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < N; i++) {
          const dx = samples[i].x - x, dy = samples[i].y - y;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; bi = i; }
        }
        const s = samples[bi];
        return { i: bi, d: Math.sqrt(bd), lat: (x - s.x) * s.nx + (y - s.y) * s.ny };
      },
      groundAt(x, y) {
        const near = this.nearest(x, y);
        if (near.d <= halfW + 14) return samples[near.i].h;
        return this.terrainAt(x, y);
      },
      terrainAt(x, y) {
        const gx = clamp((x - TER.x0) / TER.cell, 0, TER.cols - 1.001), gy = clamp((y - TER.y0) / TER.cell, 0, TER.rows - 1.001);
        const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
        const h = this.terrain;
        const a = h[iy * TER.cols + ix], b = h[iy * TER.cols + ix + 1], c = h[(iy + 1) * TER.cols + ix], d = h[(iy + 1) * TER.cols + ix + 1];
        return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
      },
      inRange(i, from, to) { return from <= to ? (i >= from && i <= to) : (i >= from || i <= to); },
    };
    for (const f of def.boxes) {
      const i = Math.floor(f * N) % N, s = samples[i];
      for (const off of [-halfW * 0.6, 0, halfW * 0.6]) t.boxes.push({ x: s.x + s.nx * off, y: s.y + s.ny * off, h: s.h, respawnAt: 0, mesh: null });
    }
    for (const f of def.pads || []) t.pads.push(Math.floor(f * N) % N);
    for (const b of def.barriers || []) {
      const from = Math.floor(b.from * N) % N, to = Math.floor(b.to * N) % N;
      let side = 0;
      if (b.side === 'outer') {
        let sum = 0;
        for (let i = from; i !== to; i = (i + 1) % N) sum += wrapAngle(samples[(i + 1) % N].ang - samples[i].ang);
        side = sum > 0 ? -1 : 1; // el exterior de la curva es el lado contrario al giro
      }
      t.barriers.push({ from, to, side });
    }
    for (const f of (def.features || []).filter((q) => q.type === 'ramp')) {
      const start = Math.floor(f.at * N);
      t.ramps.push({ start, end: (start + Math.round(f.length / SAMPLE_SPACING)) % N, height: f.height });
    }
    for (let k = 0; k < MAX_KARTS; k++) {
      const row = Math.floor(k / 2), col = k % 2;
      const idx = N - 8 - row * 7 - col * 3;
      const s = samples[idx];
      const off = (col === 0 ? -1 : 1) * halfW * 0.45;
      t.grid.push({ x: s.x + s.nx * off, y: s.y + s.ny * off, h: s.h, ang: s.ang, dist: idx - N });
    }
    // relieve del terreno alrededor de la carretera
    const rnd = mulberry32(77 + index * 31);
    t.terrain = new Float32Array(TER.cols * TER.rows);
    for (let iy = 0; iy < TER.rows; iy++) {
      for (let ix = 0; ix < TER.cols; ix++) {
        const x = TER.x0 + ix * TER.cell, y = TER.y0 + iy * TER.cell;
        const near = t.nearest(x, y);
        const w = 1 - smoothstep(halfW + 40, halfW + 220, near.d);
        const hills = 12 * (Math.sin(x * 0.0065 + 0.4) * Math.cos(y * 0.0079) + 0.6 * Math.sin(x * 0.013 + 1.7) * Math.sin(y * 0.011 + 0.9));
        t.terrain[iy * TER.cols + ix] = lerp(hills, samples[near.i].h, w);
      }
    }
    t.rnd = rnd;
    return t;
  }
  const TER = { x0: -700, y0: -600, cell: 24, cols: 0, rows: 0 };
  TER.cols = Math.ceil((MAP_W + 1400) / TER.cell) + 1;
  TER.rows = Math.ceil((MAP_H + 1200) / TER.cell) + 1;

  const TRACKS = KART_TRACKS.map(buildTrack);

  // ===================== Construcción del mundo 3D =====================
  const animated = []; // objetos con animación ambiental { obj, kind, phase, ... }

  function buildWorld(t) {
    const th = t.def.theme;
    const rnd = mulberry32(999 + t.index * 17);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const world = new THREE.Group();
    world.userData.animated = [];
    const anim = (o) => { world.userData.animated.push(o); };

    // ---- terreno (low-poly con colores por vértice) ----
    {
      const pos = [], col = [], idx = [];
      const c1 = new THREE.Color(th.ground), c2 = new THREE.Color(th.groundAlt);
      for (let iy = 0; iy < TER.rows; iy++) for (let ix = 0; ix < TER.cols; ix++) {
        const x = TER.x0 + ix * TER.cell, y = TER.y0 + iy * TER.cell;
        pos.push(x, t.terrain[iy * TER.cols + ix], y);
        const c = rnd() < 0.45 ? c2 : c1;
        col.push(c.r, c.g, c.b);
      }
      for (let iy = 0; iy < TER.rows - 1; iy++) for (let ix = 0; ix < TER.cols - 1; ix++) {
        const a = iy * TER.cols + ix, b = a + 1, c = a + TER.cols, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      let geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo = geo.toNonIndexed();
      geo.computeVertexNormals();
      world.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
    }

    // suelo infinito bajo el terreno, para que el mundo no flote en el vacío
    {
      const base = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), flat(shade(th.groundAlt, -0.12)));
      base.rotation.x = -Math.PI / 2; base.position.set(MAP_W / 2, -28, MAP_H / 2);
      world.add(base);
    }

    // ---- carretera, bordillos ----
    const ribbon = (lat0, lat1, colorFn, dy) => {
      const pos = [], col = [], idx = [];
      for (let i = 0; i < t.N; i++) {
        const s = t.samples[i];
        pos.push(s.x + s.nx * lat0, s.h + dy, s.y + s.ny * lat0, s.x + s.nx * lat1, s.h + dy, s.y + s.ny * lat1);
        const c = colorFn(i);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        const a = i * 2, b = ((i + 1) % t.N) * 2;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    };
    const roadC = new THREE.Color(th.road), roadC2 = new THREE.Color(shade(th.road, 0.06));
    world.add(ribbon(-t.halfW, t.halfW, (i) => (Math.floor(i / 6) % 2 ? roadC : roadC2), 1.0));
    const cA = new THREE.Color(th.curb[0]), cB = new THREE.Color(th.curb[1]);
    world.add(ribbon(t.halfW, t.halfW + 12, (i) => (Math.floor(i / 3) % 2 ? cA : cB), 1.0));
    world.add(ribbon(-t.halfW - 12, -t.halfW, (i) => (Math.floor(i / 3) % 2 ? cA : cB), 1.0));

    // ---- decoración de la carretera: flechas, meta, paneles turbo, carteles ----
    const decal = (i, w, len, mat, dy) => {
      const s = t.samples[i];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat);
      m.position.set(s.x, s.h + dy, s.y);
      m.rotation.set(-Math.PI / 2, 0, -s.ang);
      return m;
    };
    const arrowTex = textTexture('➤', { w: 128, h: 128, font: `bold 96px ${UI_FONT}`, color: 'rgba(255,255,255,0.5)' });
    for (let k = 1; k <= 12; k++) world.add(decal(Math.floor(k * t.N / 12) % t.N, 40, 40, new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false }), 1.4));
    {
      const c = document.createElement('canvas'); c.width = 64; c.height = 256;
      const g = c.getContext('2d');
      for (let r = 0; r < 8; r++) for (let q = 0; q < 2; q++) { g.fillStyle = (r + q) % 2 ? '#111' : '#fff'; g.fillRect(q * 32, r * 32, 32, 32); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      world.add(decal(0, t.width, 24, new THREE.MeshBasicMaterial({ map: tex }), 1.5));
      // arco de meta
      const s0 = t.samples[0];
      const arch = new THREE.Group();
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 70, 10), toon(side < 0 ? th.curb[0] : th.bumper[0]));
        pole.position.set(s0.nx * (t.halfW + 16) * side, 35, s0.ny * (t.halfW + 16) * side);
        arch.add(pole);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(10, 14, t.width + 44), toon(th.bumper[1]));
      beam.position.y = 74;
      arch.add(beam);
      const sign = makeSprite(textTexture('META', { w: 256, h: 96, font: `900 64px ${UI_FONT}`, color: '#fff', stroke: '#4a0a5e', strokeW: 10 }), 5);
      sign.material.depthTest = true; sign.position.y = 98; sign.scale.set(90, 34, 1);
      arch.add(sign);
      arch.position.set(s0.x, s0.h + 1, s0.y);
      arch.rotation.y = -s0.ang;
      world.add(arch);
    }
    {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = th.pad; g.fillRect(0, 0, 128, 64);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(10 + k * 64, 8); g.lineTo(50 + k * 64, 32); g.lineTo(10 + k * 64, 56); g.lineTo(26 + k * 64, 32); g.closePath(); g.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
      for (const i of t.pads) {
        const m = decal(i, t.width * 0.8, 44, new THREE.MeshBasicMaterial({ map: tex }), 1.4);
        world.add(m);
        anim({ kind: 'pad', obj: m, tex });
      }
    }
    for (const r of t.ramps) {
      const s = t.samples[r.start];
      const sign = makeSprite(textTexture('↗ SALTO', { w: 256, h: 96, font: `900 52px ${UI_FONT}`, color: '#ffe600', stroke: '#4a0a5e', strokeW: 10 }), 5);
      sign.material.depthTest = true;
      sign.position.set(s.x - s.nx * (t.halfW + 46), s.h + 46, s.y - s.ny * (t.halfW + 46));
      sign.scale.set(80, 30, 1);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 44, 8), toon('#ffffff'));
      pole.position.set(s.x - s.nx * (t.halfW + 46), s.h + 22, s.y - s.ny * (t.halfW + 46));
      world.add(sign, pole);
    }
    // ---- bumpers ----
    {
      const geo = new THREE.CylinderGeometry(7, 8, 16, 12);
      const items = [];
      for (const b of t.barriers) {
        const sides = b.side === 0 ? [-1, 1] : [b.side];
        let n = 0;
        for (let i = b.from; i !== b.to; i = (i + 1) % t.N) {
          if (n++ % 3) continue;
          const s = t.samples[i];
          for (const side of sides) items.push({ x: s.x + s.nx * (t.halfW + 20) * side, y: s.y + s.ny * (t.halfW + 20) * side, h: s.h, c: n % 2 });
        }
      }
      if (items.length) {
        const dummy = new THREE.Object3D();
        for (const c of [0, 1]) {
          const list = items.filter((q) => q.c === c);
          if (!list.length) continue;
          const mesh = new THREE.InstancedMesh(geo, toon(th.bumper[c]), list.length);
          list.forEach((q, i) => { dummy.position.set(q.x, q.h + 8, q.y); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
          world.add(mesh);
        }
      }
    }
    // ---- cajas de objetos ----
    for (const box of t.boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(22, 22, 22), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGradient, transparent: true, opacity: 0.9 }));
      m.position.set(box.x, box.h + 18, box.y);
      const q = makeSprite(textTexture('?', { w: 64, h: 64, font: `900 52px ${UI_FONT}`, color: '#fff', stroke: '#000', strokeW: 6 }), 6);
      q.material.depthTest = true; q.scale.set(16, 16, 1);
      m.add(q);
      box.mesh = m;
      world.add(m);
    }
    // ---- charcos / lava / cráteres ----
    if (th.pools) {
      let placed = 0, tries = 0;
      while (placed < th.pools.count && tries < 4000) {
        tries++;
        const r = th.pools.minR + rnd() * (th.pools.maxR - th.pools.minR);
        const x = 60 + r + rnd() * (MAP_W - 120 - 2 * r), y = 60 + r + rnd() * (MAP_H - 120 - 2 * r);
        if (t.nearest(x, y).d < t.halfW + r + 50) continue;
        const h = t.terrainAt(x, y);
        const grp = new THREE.Group();
        if (th.pools.kind === 'crater') {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.18, 8, 24), toon(shade(th.ground, -0.08)));
          ring.rotation.x = Math.PI / 2; ring.position.y = 2;
          const floor = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 24), flat(th.pools.color));
          floor.rotation.x = -Math.PI / 2; floor.position.y = 1.2;
          grp.add(ring, floor);
        } else {
          const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28), flat(th.pools.color, th.pools.kind === 'water' ? { transparent: true, opacity: 0.9 } : {}));
          disc.rotation.x = -Math.PI / 2; disc.position.y = 1.6;
          disc.scale.x = 1.3;
          grp.add(disc);
          if (th.pools.color2) {
            const inner = new THREE.Mesh(new THREE.CircleGeometry(r * 0.45, 20), flat(th.pools.color2));
            inner.rotation.x = -Math.PI / 2; inner.position.set(-r * 0.25, 2.2, -r * 0.2); inner.scale.x = 1.3;
            grp.add(inner);
          }
          if (th.pools.kind === 'lava') {
            const glow = new THREE.PointLight(th.pools.color, 0, 260, 1.5);
            glow.position.y = 30; glow.intensity = 40000;
            if (placed < 3) grp.add(glow);
          }
          anim({ kind: 'pool', obj: grp, phase: rnd() * 6 });
        }
        grp.position.set(x, h, y);
        world.add(grp);
        placed++;
      }
    }
    // ---- decoración ----
    const decor = {
      candyTree: () => {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 28, 8), toon(pick(['#ffffff', '#ffd6f2', '#ffe600'])));
        trunk.position.y = 14; g.add(trunk);
        const n = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const r = 14 + rnd() * 12;
          const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), toon(pick(th.palette)));
          ball.position.set((rnd() - 0.5) * 18, 30 + rnd() * 16, (rnd() - 0.5) * 18);
          g.add(ball);
        }
        return g;
      },
      pineTree: () => {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 20, 8), toon('#4a2b7a'));
        trunk.position.y = 10; g.add(trunk);
        const c = pick(th.palette);
        for (let i = 0; i < 3; i++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(22 - i * 6, 26, 8), toon(i % 2 ? shade(c, 0.12) : c));
          cone.position.y = 26 + i * 16; g.add(cone);
        }
        return g;
      },
      palm: () => {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 64, 8), toon('#c9702a'));
        trunk.position.y = 32; trunk.rotation.z = 0.18; g.add(trunk);
        for (let i = 0; i < 6; i++) {
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(44, 2.5, 12), toon(pick(['#39ff88', '#7dff3f', '#00e5a8'])));
          leaf.position.set(-11 + Math.cos(i) * 20, 64, Math.sin(i) * 20);
          leaf.rotation.set(0, -i * 1.05, -0.5);
          g.add(leaf);
        }
        for (let i = 0; i < 2; i++) { const nut = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), toon('#7a3b10')); nut.position.set(-11 + i * 6, 58, 4 - i * 6); g.add(nut); }
        return g;
      },
      mushroom: () => {
        const g = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 20, 10), toon('#fff4d6'));
        stem.position.y = 10; g.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(pick(['#ff2d55', '#ff2d95', '#9b3bff', '#00e5ff'])));
        cap.position.y = 18; g.add(cap);
        for (let i = 0; i < 4; i++) { const dot = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), toon('#ffffff')); dot.position.set(Math.cos(i * 1.6) * 10, 26 + (i % 2) * 3, Math.sin(i * 1.6) * 10); g.add(dot); }
        return g;
      },
      balloon: () => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 10), toon(pick(th.palette)));
        b.scale.y = 1.2; b.position.y = 70;
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 56, 4), flat('#ffffff'));
        str.position.y = 28;
        g.add(b, str);
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 8 });
        return g;
      },
      lollipop: () => {
        const g = new THREE.Group();
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 46, 6), toon('#ffffff'));
        stick.position.y = 23; g.add(stick);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 5, 20), toon(pick(th.palette)));
        disc.rotation.x = Math.PI / 2; disc.position.y = 56; g.add(disc);
        const disc2 = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 5.5, 16), toon(pick(th.palette)));
        disc2.rotation.x = Math.PI / 2; disc2.position.y = 56; g.add(disc2);
        anim({ kind: 'spinY', obj: g, speed: 0.6 + rnd() });
        return g;
      },
      rock: () => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + rnd() * 8, 0), toon(pick(['#5a2ca0', '#3b1e6b', '#7a1fb8', '#2c3fa8'])));
        m.position.y = 6; m.rotation.set(rnd() * 3, rnd() * 3, 0); m.scale.set(1 + rnd() * 0.6, 0.7 + rnd() * 0.5, 1);
        return m;
      },
      moonRock: () => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + rnd() * 9, 1), toon(pick(['#8fa8ff', '#b8c6ff', '#6a7fd6'])));
        m.position.y = 6; m.rotation.set(rnd() * 3, rnd() * 3, 0); m.scale.set(1 + rnd() * 0.5, 0.6 + rnd() * 0.5, 1);
        return m;
      },
      crystal: () => {
        const g = new THREE.Group();
        const n = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const c = new THREE.Mesh(new THREE.OctahedronGeometry(6 + rnd() * 8), flat(pick(th.palette)));
          c.scale.y = 1.8 + rnd(); c.position.set((rnd() - 0.5) * 16, 10 + rnd() * 6, (rnd() - 0.5) * 16); c.rotation.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5);
          g.add(c);
        }
        anim({ kind: 'pulse', obj: g, phase: rnd() * 6 });
        return g;
      },
      cactus: () => {
        const g = new THREE.Group();
        const c = pick(['#39ff88', '#00e5a8', '#7dff3f']);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 40, 8), toon(c)); body.position.y = 20; g.add(body);
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 8), toon(c)); arm.position.set(side * 10, 26, 0); arm.rotation.z = side * 1.2; g.add(arm);
          const up = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 14, 8), toon(c)); up.position.set(side * 16, 34, 0); g.add(up);
        }
        return g;
      },
      volcano: () => {
        const g = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.ConeGeometry(120, 150, 9), toon('#3b1e6b'));
        cone.position.y = 75; g.add(cone);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(22, 30, 14, 9), flat('#ff5e00'));
        top.position.y = 146; g.add(top);
        anim({ kind: 'volcano', obj: g, t: rnd() * 3 });
        g.userData.big = true;
        return g;
      },
      beachBall: () => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.SphereGeometry(13, 14, 10), toon(pick(th.palette)));
        const band = new THREE.Mesh(new THREE.TorusGeometry(12.6, 2.2, 8, 24), toon(pick(th.palette)));
        band.rotation.x = Math.PI / 2 + 0.4;
        g.add(b, band); g.position.y = 13;
        return g;
      },
      umbrella: () => {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 56, 6), toon('#ffffff')); pole.position.y = 28; g.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(30, 16, 10, 1, true), new THREE.MeshToonMaterial({ color: pick(th.palette), gradientMap: toonGradient, side: THREE.DoubleSide }));
        top.position.y = 56; g.add(top);
        g.rotation.z = 0.2;
        return g;
      },
      flamingo: () => {
        const g = new THREE.Group();
        for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 26, 5), toon('#ff8a00')); leg.position.set(0, 13, s * 4); g.add(leg); }
        const body = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 8), toon('#ff6ab8')); body.position.y = 32; body.scale.set(1.3, 0.9, 1); g.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 24, 6), toon('#ff6ab8')); neck.position.set(12, 46, 0); neck.rotation.z = -0.3; g.add(neck);
        const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 6), toon('#ff6ab8')); head.position.set(16, 58, 0); g.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(2.2, 8, 6), toon('#222222')); beak.position.set(21, 56, 0); beak.rotation.z = -1.9; g.add(beak);
        g.rotation.y = rnd() * 6;
        return g;
      },
      planet: () => {
        const g = new THREE.Group();
        const p = new THREE.Mesh(new THREE.SphereGeometry(18 + rnd() * 10, 14, 10), toon(pick(th.palette)));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 3, 6, 30), toon(pick(th.palette)));
        ring.rotation.x = Math.PI / 2 + 0.5;
        g.add(p, ring);
        g.position.y = 110 + rnd() * 80;
        anim({ kind: 'spinY', obj: g, speed: 0.3 + rnd() * 0.4 });
        anim({ kind: 'bob', obj: g, phase: rnd() * 6, amp: 6 });
        return g;
      },
      flag: () => {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 50, 6), toon('#ffffff')); pole.position.y = 25; g.add(pole);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(24, 15), new THREE.MeshToonMaterial({ color: pick(th.palette), gradientMap: toonGradient, side: THREE.DoubleSide }));
        f.position.set(12, 42, 0); g.add(f);
        return g;
      },
      rocket: () => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 46, 12), toon('#ffffff')); body.position.y = 30; g.add(body);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(9, 18, 12), toon(pick(['#ff2d95', '#ff3d3d', '#00e5ff']))); nose.position.y = 62; g.add(nose);
        const win = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), flat('#00e5ff')); win.position.set(8, 38, 0); g.add(win);
        for (let i = 0; i < 3; i++) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 2), toon('#ff2d95'));
          fin.position.set(Math.cos(i * 2.1) * 11, 10, Math.sin(i * 2.1) * 11); fin.rotation.y = -i * 2.1; g.add(fin);
        }
        g.userData.big = true;
        return g;
      },
    };
    for (const d of th.decor || []) {
      const maker = decor[d.kind];
      if (!maker) continue;
      let placed = 0, tries = 0;
      while (placed < d.n && tries < 3000) {
        tries++;
        const x = 30 + rnd() * (MAP_W - 60), y = 30 + rnd() * (MAP_H - 60);
        const obj = maker();
        const margin = obj.userData && obj.userData.big ? 190 : 46;
        if (t.nearest(x, y).d < t.halfW + margin) continue;
        obj.position.x = x; obj.position.z = y; obj.position.y += t.terrainAt(x, y);
        obj.rotation.y += rnd() * Math.PI * 2;
        world.add(obj);
        placed++;
      }
    }
    // ---- nubes, sol, estrellas ----
    if (th.clouds) {
      for (let i = 0; i < th.clouds.n; i++) {
        const g = new THREE.Group();
        const n = 3 + Math.floor(rnd() * 3);
        for (let j = 0; j < n; j++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(22 + rnd() * 26, 10, 8), toon(th.clouds.color));
          s.position.set(j * 30 - n * 15, rnd() * 10, (rnd() - 0.5) * 20);
          g.add(s);
        }
        g.position.set(rnd() * MAP_W, 300 + rnd() * 180, rnd() * MAP_H - 100);
        anim({ kind: 'drift', obj: g, speed: 8 + rnd() * 10 });
        world.add(g);
      }
    }
    if (th.sun) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(th.sun.r, 20, 14), flat(th.sun.color));
      s.position.set(th.sun.pos[0], th.sun.pos[1], th.sun.pos[2]);
      world.add(s);
      if (th.sun.ring) { const ring = new THREE.Mesh(new THREE.TorusGeometry(th.sun.r * 1.6, th.sun.r * 0.1, 8, 40), flat('#ff00ff')); ring.rotation.x = 1.2; s.add(ring); }
    }
    if (th.stars) {
      const pos = [];
      for (let i = 0; i < 900; i++) {
        const a = rnd() * Math.PI * 2, e = 0.15 + rnd() * 1.2, r = 3000;
        pos.push(MAP_W / 2 + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, MAP_H / 2 + Math.sin(a) * Math.cos(e) * r);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, fog: false }));
      world.add(pts);
    }
    return world;
  }

  function skyTexture(top, bottom) {
    const c = document.createElement('canvas'); c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  let currentWorld = null;
  function setWorld(t) {
    if (currentWorld && currentWorld.userData.track === t) return;
    if (currentWorld) scene.remove(currentWorld);
    if (!t.world) { t.world = buildWorld(t); t.world.userData.track = t; }
    currentWorld = t.world;
    scene.add(currentWorld);
    const th = t.def.theme;
    scene.background = skyTexture(th.sky[0], th.sky[1]);
    scene.fog = new THREE.Fog(new THREE.Color(th.fog), 1800, 4200);
    hemi.color.set(th.sky[1]); hemi.groundColor.set(th.ground);
  }

  // ===================== Partículas =====================
  const particles = (() => {
    const MAX = 900;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < MAX; i++) mesh.setColorAt(i, white);
    scene.add(mesh);
    const list = new Array(MAX).fill(null).map(() => ({ life: 0, t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, g: 0, flat: false }));
    let cursor = 0;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    function emit(x, y, z, o) {
      const n = o.n || 1;
      for (let k = 0; k < n; k++) {
        const p = list[cursor]; const idx = cursor; cursor = (cursor + 1) % MAX;
        const sp = o.spread == null ? 60 : o.spread;
        p.x = x + (Math.random() - 0.5) * (o.jitter || 6); p.y = y + (Math.random() - 0.5) * (o.jitter || 6); p.z = z + (Math.random() - 0.5) * (o.jitter || 6);
        p.vx = (o.vx || 0) + (Math.random() - 0.5) * sp; p.vy = (o.vy || 0) + (Math.random() - 0.5) * sp; p.vz = (o.vz || 0) + (Math.random() - 0.5) * sp;
        p.life = (o.life || 0.5) * (0.7 + Math.random() * 0.6); p.t = 0;
        p.size = (o.size || 4) * (0.7 + Math.random() * 0.6); p.g = o.g == null ? 500 : o.g; p.flat = !!o.flat;
        const c = Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : o.color;
        if (c === 'rainbow') col.setHSL(Math.random(), 1, 0.55); else col.set(c || '#ffffff');
        mesh.setColorAt(idx, col);
      }
      mesh.instanceColor.needsUpdate = true;
    }
    function update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = list[i];
        if (p.t >= p.life) { dummy.scale.set(0, 0, 0); dummy.position.set(0, -1000, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); continue; }
        p.t += dt;
        p.vy -= p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const s = p.size * (1 - p.t / p.life);
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(p.flat ? s * 1.6 : s, p.flat ? s * 0.3 : s, s);
        dummy.rotation.set(p.t * 5, p.t * 3, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    return { emit, update };
  })();

  // ===================== Estado =====================
  const state = {
    phase: 'lobby',
    players: new Map(),
    hostId: null,
    settings: { track: 0, laps: 3, bots: 2 },
    kb: null,
    track: TRACKS[0],
    laps: 3,
    karts: [], projectiles: [], bananas: [], toasts: [],
    countdownT: 0, cdStep: -1, raceTime: 0, goFlash: 0,
    firstFinish: 0, finishedCount: 0, endAt: 0, results: null,
    replaced: false, joinUrl: '', shake: 0,
  };
  let simTime = 0, animT = 0;
  const kartsGroup = new THREE.Group();
  scene.add(kartsGroup);

  // ===================== Red =====================
  let ws = null;
  function wsSend(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function toPlayer(id, m) { wsSend({ t: 'to', id, m }); }
  function sendPhase() { wsSend({ t: 'phase', phase: state.phase }); }

  function connect() {
    if (state.replaced) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => { wsSend({ t: 'screen', tracks: KART_TRACKS.map((t) => t.name) }); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } handleMessage(m); };
    ws.onclose = () => { if (!state.replaced) setTimeout(connect, 1500); };
    ws.onerror = () => { /* onclose reconecta */ };
  }

  function upsertPlayer(p) {
    const cur = state.players.get(p.id);
    if (cur) { cur.name = p.name; cur.char = p.char; cur.host = p.host; cur.connected = p.connected; }
    else state.players.set(p.id, { id: p.id, name: p.name, char: p.char, host: p.host, connected: p.connected, input: { s: 0, g: 0, b: 0, d: 0 } });
    const k = state.karts.find((q) => q.playerId === p.id);
    if (k) k.name = p.name;
  }

  function handleMessage(m) {
    switch (m.t) {
      case 'init':
        state.players.clear();
        for (const p of m.players) upsertPlayer(p);
        state.hostId = m.hostId;
        applySettings(m.settings);
        sendPhase();
        for (const p of state.players.values()) if (state.phase !== 'lobby' && !state.karts.some((k) => k.playerId === p.id)) toPlayer(p.id, { t: 'spectate' });
        for (const k of state.karts) sendStatus(k);
        updateOverlays();
        break;
      case 'join': {
        upsertPlayer(m.player);
        if (state.phase !== 'lobby') {
          const k = state.karts.find((q) => q.playerId === m.player.id);
          if (k) sendStatus(k); else toPlayer(m.player.id, { t: 'spectate' });
        }
        updateOverlays();
        break;
      }
      case 'leave': {
        state.players.delete(m.id);
        const idx = state.karts.findIndex((k) => k.playerId === m.id);
        if (idx >= 0) { removeKartModel(state.karts[idx]); state.karts.splice(idx, 1); }
        if ((state.phase === 'race' || state.phase === 'countdown') && !state.karts.some((k) => k.isHuman)) backToLobby();
        updateOverlays();
        break;
      }
      case 'conn': {
        const p = state.players.get(m.id);
        if (p) { p.connected = !!m.connected; if (!p.connected) p.input = { s: 0, g: 0, b: 0, d: 0 }; }
        updateOverlays();
        break;
      }
      case 'host': state.hostId = m.hostId; for (const p of state.players.values()) p.host = p.id === m.hostId; updateOverlays(); break;
      case 'i': { const p = state.players.get(m.id); if (p) p.input = { s: m.s, g: m.g, b: m.b, d: m.d }; break; }
      case 'use': { const k = state.karts.find((q) => q.playerId === m.id); if (k) useItem(k); break; }
      case 'start': startRace(); break;
      case 'again': if (state.phase === 'results') backToLobby(); break;
      case 'set': applySettings(m.settings); updateOverlays(); break;
      case 'replaced':
        state.replaced = true;
        noticeEl.textContent = 'Se ha abierto la pantalla en otro sitio. Esta pestaña queda inactiva: recárgala para recuperarla.';
        noticeEl.classList.remove('hidden');
        break;
      default: break;
    }
  }

  function applySettings(s) {
    if (!s) return;
    if (Number.isInteger(s.track)) state.settings.track = ((s.track % TRACKS.length) + TRACKS.length) % TRACKS.length;
    if (Number.isInteger(s.laps)) state.settings.laps = clamp(s.laps, 1, 9);
    if (Number.isInteger(s.bots)) state.settings.bots = clamp(s.bots, 0, 7);
    if (state.phase === 'lobby') { state.track = TRACKS[state.settings.track]; setWorld(state.track); }
  }
  function changeSetting(key, delta) {
    if (state.phase !== 'lobby') return;
    const s = { ...state.settings };
    if (key === 'track') s.track = (s.track + delta + TRACKS.length) % TRACKS.length;
    if (key === 'bots') s.bots = clamp(s.bots + delta, 0, 7);
    if (key === 'laps') { const opts = [1, 2, 3, 4, 5]; s.laps = opts[(opts.indexOf(s.laps) + 1) % opts.length] || 3; }
    applySettings(s);
    wsSend({ t: 'set', settings: s });
    updateOverlays();
  }

  fetch('/info').then((r) => r.json()).then((info) => { state.joinUrl = info.url; updateOverlays(); }).catch(() => {});

  // ===================== Karts =====================
  function displayLap(k) { return clamp(k.lapCount + 1, 1, state.laps); }

  function makeKartModel(k) {
    const ch = CHARS[k.char];
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 22), toon(ch.color)); chassis.position.y = 9; body.add(chassis);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 14), toon(shade(ch.color, -0.14))); hood.position.set(-4, 17, 0); body.add(hood);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 10), toon(ch.accent)); nose.rotation.z = -Math.PI / 2; nose.position.set(23, 9, 0); body.add(nose);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 28), toon(ch.accent)); spoiler.position.set(-19, 21, 0); body.add(spoiler);
    for (const z of [-9, 9]) { const strut = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 2), toon('#222233')); strut.position.set(-18, 16, z); body.add(strut); }
    for (const z of [-6, 6]) { const ex = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 8, 8), toon('#444455')); ex.rotation.z = Math.PI / 2; ex.position.set(-21, 6.5, z); body.add(ex); }
    const wheels = [];
    for (const [x, z] of [[13, -13], [13, 13], [-13, -13], [-13, 13]]) {
      const steerPivot = new THREE.Group(); steerPivot.position.set(x, 6, z);
      const roll = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 6, 14), toon('#1a1a24')); tire.rotation.x = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 6.6, 10), toon(ch.accent)); hub.rotation.x = Math.PI / 2;
      roll.add(tire, hub); steerPivot.add(roll); body.add(steerPivot);
      wheels.push({ steer: steerPivot, roll, front: x > 0 });
    }
    const flames = [];
    for (const z of [-6, 6]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(4, 18, 8), flat('#ff9f1c')); f.rotation.z = Math.PI / 2; f.position.set(-30, 6.5, z); f.visible = false;
      const f2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 8), flat('#ffe74c')); f2.rotation.z = Math.PI / 2; f2.position.set(-27, 6.5, z); f2.visible = false;
      body.add(f, f2); flames.push(f, f2);
    }
    const head = makeSprite(textTexture(ch.emoji, { w: 128, h: 128, font: `96px ${EMOJI_FONT}` }), 8);
    head.material.depthTest = true; head.position.set(-3, 30, 0); body.add(head);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
    glow.position.y = 12; glow.visible = false; g.add(glow);
    const label = makeSprite(textTexture(k.name, { w: 320, h: 80, font: `900 40px ${UI_FONT}`, color: '#fff', stroke: '#1a0b3d', strokeW: 10 }), 20);
    label.position.set(0, 54, 0); g.add(label);
    const item = makeSprite(textTexture('?', { w: 128, h: 128, font: `84px ${EMOJI_FONT}`, bg: 'rgba(255,255,255,0.9)' }), 21);
    item.position.set(0, 82, 0); item.visible = false; g.add(item);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(21, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    kartsGroup.add(g, shadow);
    k.model = { g, body, wheels, flames, head, glow, label, item, shadow, labelText: '', itemText: '', sq: new Spring(120, 9), st: new Spring(120, 9), roll: new Spring(90, 10), pitch: new Spring(90, 10), blink: 0 };
  }
  function removeKartModel(k) {
    if (!k.model) return;
    kartsGroup.remove(k.model.g, k.model.shadow);
    k.model = null;
  }

  function makeKart(e, g) {
    const ch = CHARS[e.char];
    const k = {
      id: e.playerId != null ? 'p' + e.playerId : e.kb ? 'kb' : 'bot' + e.char,
      playerId: e.playerId != null ? e.playerId : null,
      isKb: !!e.kb, isBot: !!e.bot, isHuman: !e.bot,
      name: e.name, char: e.char, emoji: ch.emoji, color: ch.color,
      skill: 0.86 + Math.random() * 0.1,
      lane: (Math.random() * 2 - 1) * state.track.halfW * 0.5,
      x: g.x, y: g.y, z: g.h, vz: 0, air: false, ground: g.h, angle: g.ang, moveAngle: g.ang, speed: 0,
      dist: g.dist, lapCount: -1, rank: 1, offroad: false,
      item: null, rolling: null, itemUseAt: 0,
      boostUntil: 0, starUntil: 0, spinUntil: 0, invUntil: 0, shrinkUntil: 0,
      driftT: 0, driftDir: 0, trick: false, trickAngle: 0, dPrev: 0, airT: 0, lastPad: -1, lastPadAt: 0, lastBoing: 0, dustT: 0,
      finished: false, finishTime: 0, finishRank: 0,
      input: { s: 0, g: 0, b: 0, d: 0 },
      model: null,
    };
    makeKartModel(k);
    return k;
  }

  function startRace() {
    if (state.phase !== 'lobby') return;
    const humans = [];
    for (const p of state.players.values()) if (p.connected) humans.push({ playerId: p.id, name: p.name, char: p.char });
    if (state.kb) humans.push({ playerId: null, kb: true, name: 'Teclado', char: -1 });
    if (!humans.length) { toast('Hace falta al menos un jugador conectado'); return; }
    const used = new Set(humans.filter((h) => h.char >= 0).map((h) => h.char));
    const freeChar = () => { for (let c = 0; c < CHARS.length; c++) if (!used.has(c)) { used.add(c); return c; } return 0; };
    for (const h of humans) if (h.char < 0) h.char = freeChar();
    const entries = humans.slice(0, MAX_KARTS);
    const nBots = Math.min(state.settings.bots, MAX_KARTS - entries.length);
    for (let i = 0; i < nBots; i++) { const c = freeChar(); entries.push({ playerId: null, bot: true, name: CHARS[c].name + ' (bot)', char: c }); }

    for (const k of state.karts) removeKartModel(k);
    state.track = TRACKS[state.settings.track];
    setWorld(state.track);
    state.laps = state.settings.laps;
    for (const b of state.track.boxes) b.respawnAt = 0;
    shuffle(entries);
    state.karts = entries.map((e, i) => makeKart(e, state.track.grid[i]));
    state.projectiles = []; state.bananas = [];
    clearToasts();
    state.countdownT = 0; state.cdStep = -1; state.raceTime = 0; state.goFlash = 0;
    state.firstFinish = 0; state.finishedCount = 0; state.endAt = 0; state.results = null;
    state.phase = 'countdown';
    updateRanking();
    buildHud();
    camStart();
    sendPhase();
    for (const k of state.karts) sendStatus(k);
    for (const p of state.players.values()) if (!state.karts.some((k) => k.playerId === p.id)) toPlayer(p.id, { t: 'spectate' });
    updateOverlays();
  }

  function showResults() {
    state.phase = 'results';
    updateRanking();
    const sorted = state.karts.slice().sort((a, b) => a.rank - b.rank);
    state.results = sorted.map((k) => ({ pos: k.rank, name: k.name, emoji: k.emoji, color: k.color, finished: k.finished, time: k.finishTime, lap: displayLap(k) }));
    sendPhase();
    for (const k of state.karts) sendStatus(k);
    sfx('finish');
    updateOverlays();
  }

  function backToLobby() {
    state.phase = 'lobby';
    for (const k of state.karts) removeKartModel(k);
    for (const p of state.projectiles) if (p.mesh) scene.remove(p.mesh);
    for (const b of state.bananas) if (b.mesh) scene.remove(b.mesh);
    state.karts = []; state.projectiles = []; state.bananas = []; state.results = null;
    clearToasts();
    sendPhase();
    updateOverlays();
  }

  function toggleKeyboardPlayer() {
    if (state.phase !== 'lobby') return;
    state.kb = state.kb ? null : { input: { s: 0, g: 0, b: 0, d: 0 } };
    updateOverlays();
  }

  function sendStatus(k) {
    if (k.playerId == null) return;
    toPlayer(k.playerId, {
      t: 'st', pos: k.rank, n: state.karts.length, lap: displayLap(k), laps: state.laps,
      item: k.item, rolling: !!k.rolling, fin: k.finished, finPos: k.finished ? k.finishRank : 0, phase: state.phase,
    });
  }

  function toast(text, dur) {
    const el = document.createElement('div');
    el.textContent = text;
    toastsEl.appendChild(el);
    while (toastsEl.children.length > 4) toastsEl.removeChild(toastsEl.firstChild);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, (dur || 3) * 1000);
  }
  function clearToasts() { toastsEl.innerHTML = ''; }

  // ===================== Física =====================
  function boost(k, dur) {
    k.boostUntil = Math.max(k.boostUntil, simTime + dur);
    if (k.model) k.model.st.vel += 6;
    sfx('boost');
  }

  function hitKart(k) {
    const now = simTime;
    if (k.starUntil > now || k.invUntil > now || k.spinUntil > now) return false;
    k.spinUntil = now + SPIN_TIME;
    k.invUntil = now + SPIN_TIME + 1.5;
    k.speed *= 0.25;
    k.driftT = 0; k.boostUntil = 0; k.trick = false;
    k.vz = Math.max(k.vz, 230); k.air = true;
    particles.emit(k.x, k.z + 14, k.y, { n: 14, color: ['#ffe600', '#ffffff', '#ff2d95'], spread: 220, vy: 120, life: 0.7, size: 6 });
    state.shake = Math.max(state.shake, 6);
    sfx('hit');
    if (k.playerId != null) toPlayer(k.playerId, { t: 'fx', kind: 'hit' });
    return true;
  }

  function aiInput(k) {
    const t = state.track, N = t.N;
    const near = t.nearest(k.x, k.y);
    let target;
    if (near.d > t.halfW * 1.6) target = t.samples[near.i];
    else {
      const s = t.samples[(near.i + 24) % N];
      target = { x: s.x + s.nx * k.lane, y: s.y + s.ny * k.lane };
    }
    const desired = Math.atan2(target.y - k.y, target.x - k.x);
    const diff = wrapAngle(desired - k.angle);
    const steer = Math.abs(diff) < 0.05 ? 0 : diff > 0 ? 1 : -1;
    const ahead = t.samples[(near.i + 40) % N];
    const curve = Math.abs(wrapAngle(ahead.ang - t.samples[near.i].ang));
    const brake = curve > 1.5 && k.speed > 340 ? 1 : 0;
    // en el aire, los bots sueltan derrape y lo pulsan de nuevo a mitad de vuelo: truco
    const drift = k.air ? (k.airT > 0.2 ? 1 : 0) : (curve > 0.8 && k.speed > 260 ? 1 : 0);
    const reverse = Math.abs(diff) > 2.6 && k.speed < 60;
    return { s: reverse ? -steer : steer, g: brake || reverse ? 0 : 1, b: brake || reverse ? 1 : 0, d: drift };
  }

  function stepKart(k, inp, dt) {
    const t = state.track, now = simTime;
    const spinning = k.spinUntil > now;
    const active = state.phase === 'race' && !spinning;
    const s = active ? inp.s : 0, g = active ? inp.g : 0, b = active ? inp.b : 0, d = active ? inp.d : 0;

    const near = t.nearest(k.x, k.y);
    const onRoad = near.d <= t.halfW + 3;
    k.offroad = !onRoad && !k.air;
    const boosting = k.boostUntil > now, star = k.starUntil > now, small = k.shrinkUntil > now;
    let maxS = BASE_MAX_SPEED * (k.isBot ? k.skill : 1);
    if (boosting) maxS *= 1.5;
    if (star) maxS *= 1.25;
    if (small) maxS *= 0.7;
    if (k.offroad && !boosting && !star) maxS *= 0.45;

    if (!k.air) {
      if (g) k.speed += ACCEL * dt;
      else if (b) k.speed -= (k.speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
      else { const c = COAST * dt; if (Math.abs(k.speed) <= c) k.speed = 0; else k.speed -= Math.sign(k.speed) * c; }
      if (boosting && k.speed < maxS * 0.85) k.speed = maxS * 0.85;
      if (k.speed > maxS) k.speed = Math.max(maxS, k.speed - (k.offroad ? 1100 : 700) * dt);
      const minS = -maxS * 0.35;
      if (k.speed < minS) k.speed = minS;
      if (spinning) k.speed *= Math.pow(0.02, dt);
    } else if (k.speed > maxS * 1.1) k.speed = Math.max(maxS * 1.1, k.speed - 300 * dt);

    const spd = Math.abs(k.speed);
    let turn = 2.7 * clamp(spd / 140, 0, 1);
    if (spd > 320) turn *= 1 - 0.3 * clamp((spd - 320) / 250, 0, 1);
    if (k.air) turn *= 0.35;
    const drifting = d && spd > 160 && !k.offroad && !k.air;
    if (drifting) {
      turn *= 1.6;
      if (s !== 0) { k.driftT += dt; k.driftDir = s; }
    } else if (k.driftT > 0 && !k.air) {
      if (k.driftT >= 0.7) boost(k, k.driftT >= 1.6 ? 1.1 : 0.7);
      k.driftT = 0;
    }
    // truco en el aire: pulsar derrape en un salto de verdad (no en un botecito)
    if (k.air && d && !k.dPrev && !k.trick && k.z - k.ground > 16 && k.airT > 0.12) { k.trick = true; k.trickAngle = 0; sfx('trick'); }
    k.dPrev = d;

    k.angle += s * turn * dt * (k.speed >= 0 ? 1 : -1);
    const lag = drifting ? 3.2 : k.air ? 2 : 11;
    k.moveAngle = k.angle + wrapAngle(k.moveAngle - k.angle) * Math.exp(-lag * dt);
    k.x += Math.cos(k.moveAngle) * k.speed * dt;
    k.y += Math.sin(k.moveAngle) * k.speed * dt;

    if (k.x < KART_R) { k.x = KART_R; k.speed *= 0.5; }
    if (k.x > MAP_W - KART_R) { k.x = MAP_W - KART_R; k.speed *= 0.5; }
    if (k.y < KART_R) { k.y = KART_R; k.speed *= 0.5; }
    if (k.y > MAP_H - KART_R) { k.y = MAP_H - KART_R; k.speed *= 0.5; }

    // bumpers elásticos
    const near2 = t.nearest(k.x, k.y);
    for (const br of t.barriers) {
      if (!t.inRange(near2.i, br.from, br.to)) continue;
      const sideSign = Math.sign(near2.lat) || 1;
      if (br.side !== 0 && sideSign !== br.side) continue;
      const limit = t.halfW + 4;
      if (Math.abs(near2.lat) > limit && !(k.z - k.ground > 30)) {
        const sm = t.samples[near2.i];
        k.x = sm.x + sm.nx * limit * sideSign; k.y = sm.y + sm.ny * limit * sideSign;
        const vx = Math.cos(k.moveAngle) * k.speed, vy = Math.sin(k.moveAngle) * k.speed;
        const vn = vx * sm.nx + vy * sm.ny;
        if (vn * sideSign > 0) {
          setVel(k, vx - vn * sm.nx * 1.7, vy - vn * sm.ny * 1.7);
          k.vz = Math.max(k.vz, 90); k.air = true;
          if (k.model) { k.model.sq.vel -= 5; }
          particles.emit(k.x, k.z + 8, k.y, { n: 8, color: t.def.theme.bumper, spread: 160, vy: 80, life: 0.5, size: 4 });
          stats.boings++;
          if (now - k.lastBoing > 0.25) { sfx('boing'); k.lastBoing = now; }
          state.shake = Math.max(state.shake, 3);
        }
      }
    }
    // paneles turbo
    if (!k.air) {
      for (const pi of t.pads) {
        let di = near2.i - pi; if (di > t.N / 2) di -= t.N; if (di < -t.N / 2) di += t.N;
        if (Math.abs(di) <= 3 && Math.abs(near2.lat) < t.halfW * 0.8 && (k.lastPad !== pi || now - k.lastPadAt > 2)) {
          k.lastPad = pi; k.lastPadAt = now;
          boost(k, 1.0);
          stats.pads++;
          sfx('pad');
          particles.emit(k.x, k.z + 6, k.y, { n: 10, color: t.def.theme.pad, spread: 120, vy: 100, life: 0.5, size: 4 });
        }
      }
    }

    // vertical: gravedad, suelo, saltos y aterrizajes
    const gOld = k.ground;
    const gNew = t.groundAt(k.x, k.y);
    k.ground = gNew;
    const grav = GRAVITY * t.gravity;
    k.vz -= grav * dt;
    k.z += k.vz * dt;
    if (k.z <= gNew) {
      if (k.air) land(k, -k.vz);
      k.z = gNew;
      k.vz = Math.max(k.vz, (gNew - gOld) / dt);
      if (k.vz > 40 && (gNew - gOld) / dt < 40) k.vz = 0;
      k.air = false;
    } else {
      if (!k.air && k.z - gNew > 2) { k.air = true; if (k.vz > 60) sfx('jump'); }
    }
    k.airT = k.air ? k.airT + dt : 0;
    if (k.air && k.trick) k.trickAngle = Math.min(Math.PI * 2, k.trickAngle + dt * 9);
    if (k.air) stats.maxAir = Math.max(stats.maxAir, k.z - k.ground);
    if (k.offroad && spd > 60) { k.dustT += dt; if (k.dustT > 0.06) { k.dustT = 0; particles.emit(k.x, k.z + 3, k.y, { n: 2, color: [t.def.theme.groundAlt, t.def.theme.ground], spread: 40, vy: 50, life: 0.6, size: 6, g: 60 }); } }

    updateProgress(k, near2);
  }

  const stats = { jumps: 0, tricks: 0, boings: 0, bumps: 0, pads: 0, maxAir: 0 };
  function land(k, impact) {
    stats.jumps++;
    if (k.model) k.model.sq.vel -= clamp(impact / 60, 1, 8);
    if (impact > 120) particles.emit(k.x, k.z + 2, k.y, { n: 8, color: ['#ffffff', state.track.def.theme.groundAlt], spread: 120, vy: 60, life: 0.5, size: 4, g: 200 });
    if (impact > 420) { k.vz = impact * 0.28; k.air = true; }
    if (k.trick) {
      k.trick = false; k.trickAngle = 0;
      if (k.airT >= 0.4) { stats.tricks++; boost(k, 0.9); if (k.isHuman) toast(`${k.emoji} ${k.name}: ¡truco! 🤸`, 1.5); }
    }
    if (impact > 80) sfx('land');
  }

  function updateProgress(k, near) {
    const t = state.track, N = t.N;
    if (near.d > t.halfW * 2.5) return;
    const cur = ((k.dist % N) + N) % N;
    let delta = near.i - cur;
    if (delta > N / 2) delta -= N; else if (delta < -N / 2) delta += N;
    if (delta > t.win) return;
    k.dist += delta;
    const lap = Math.floor(k.dist / N);
    if (lap > k.lapCount) {
      k.lapCount = lap;
      if (!k.finished && state.phase === 'race') {
        if (lap >= state.laps) finishKart(k);
        else if (lap > 0) {
          sfx('lap');
          if (k.isHuman && lap === state.laps - 1) toast(`${k.emoji} ${k.name}: ¡última vuelta!`, 2.5);
        }
      }
    }
  }

  function finishKart(k) {
    k.finished = true;
    k.finishTime = state.raceTime;
    k.finishRank = ++state.finishedCount;
    k.item = null; k.rolling = null;
    if (!state.firstFinish) state.firstFinish = state.raceTime;
    toast(`🏁 ${k.emoji} ${k.name} termina ${ordinal(k.finishRank)}`, 3.5);
    particles.emit(k.x, k.z + 60, k.y, { n: 40, color: 'rainbow', spread: 260, vy: 160, life: 1.6, size: 5, g: 300, flat: true });
    sfx('finishKart');
    sendStatus(k);
  }

  function setVel(k, vx, vy) {
    const sp = Math.hypot(vx, vy);
    if (sp < 1) { k.speed = 0; return; }
    const ang = Math.atan2(vy, vx);
    const forward = Math.cos(wrapAngle(ang - k.angle)) >= 0;
    k.speed = forward ? sp : -sp;
    k.moveAngle = forward ? ang : ang + Math.PI;
  }

  function collideKarts() {
    const ks = state.karts, now = simTime;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        if (Math.abs(a.z - b.z) > 24) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy, minD = KART_R * 2;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = minD - d;
        a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        const avx = Math.cos(a.moveAngle) * a.speed, avy = Math.sin(a.moveAngle) * a.speed;
        const bvx = Math.cos(b.moveAngle) * b.speed, bvy = Math.sin(b.moveAngle) * b.speed;
        const rel = (avx - bvx) * nx + (avy - bvy) * ny;
        if (rel > 0) {
          const imp = rel * 0.9;
          setVel(a, avx - imp * nx, avy - imp * ny);
          setVel(b, bvx + imp * nx, bvy + imp * ny);
          if (rel > 120) {
            const hop = clamp(rel * 0.45, 40, 160);
            a.vz = Math.max(a.vz, hop * 0.6); b.vz = Math.max(b.vz, hop); a.air = b.air = true;
            if (a.model) a.model.sq.vel -= 3; if (b.model) b.model.sq.vel -= 3;
            particles.emit((a.x + b.x) / 2, (a.z + b.z) / 2 + 10, (a.y + b.y) / 2, { n: 8, color: ['#ffffff', '#ffe600'], spread: 160, vy: 80, life: 0.4, size: 4 });
            stats.bumps++;
            if (now - a.lastBoing > 0.25) { sfx('bump'); a.lastBoing = now; }
          }
        }
        const aStar = a.starUntil > now, bStar = b.starUntil > now;
        if (aStar && !bStar) hitKart(b);
        if (bStar && !aStar) hitKart(a);
      }
    }
  }

  // ===================== Objetos =====================
  function rollItem(rank, n) {
    const r = n > 1 ? (rank - 1) / (n - 1) : 0.5;
    const w = [
      ['mushroom', 2 + 3 * r], ['banana', 3 - 2 * r], ['green', 3 - 1.5 * r],
      ['red', rank === 1 ? 0 : 1 + 3 * r], ['star', 4 * r * r], ['lightning', n >= 3 ? 3 * r * r * r : 0],
    ];
    const total = w.reduce((acc, [, x]) => acc + x, 0);
    let x = Math.random() * total;
    for (const [id, wt] of w) { x -= wt; if (x <= 0) return id; }
    return 'mushroom';
  }

  function checkBoxes() {
    const now = simTime;
    for (const k of state.karts) {
      if (k.item || k.rolling || k.finished) continue;
      for (const box of state.track.boxes) {
        if (box.respawnAt > now) continue;
        const dx = box.x - k.x, dy = box.y - k.y;
        if (dx * dx + dy * dy < 26 * 26 && Math.abs(k.z - box.h) < 45) {
          box.respawnAt = now + BOX_RESPAWN;
          k.rolling = { until: now + ROULETTE_TIME, result: rollItem(k.rank, state.karts.length) };
          particles.emit(box.x, box.h + 18, box.y, { n: 16, color: 'rainbow', spread: 200, vy: 120, life: 0.7, size: 5 });
          sfx('pickup');
          sendStatus(k);
          break;
        }
      }
    }
  }

  function finishRoulettes() {
    const now = simTime;
    for (const k of state.karts) {
      if (k.rolling && now >= k.rolling.until) {
        k.item = k.rolling.result; k.rolling = null;
        k.itemUseAt = now + 0.8 + Math.random() * 2.5;
        sendStatus(k);
      }
      if (k.isBot && k.item && now >= k.itemUseAt) {
        if (k.item === 'banana' && now < k.itemUseAt + 6) {
          const behind = state.karts.some((o) => o !== k && o.dist < k.dist && k.dist - o.dist < 60);
          if (!behind) continue;
        }
        useItem(k);
      }
    }
  }

  function shellMesh(type) {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 10), toon(type === 'red' ? '#ff3d3d' : '#39ff88'));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9.5, 2.4, 8, 20), toon('#ffffff'));
    rim.rotation.x = Math.PI / 2;
    const spikes = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), flat('#ffffff'));
    spikes.position.y = 6;
    g.add(s, rim, spikes);
    scene.add(g);
    return g;
  }
  function bananaMesh() {
    const m = new THREE.Mesh(new THREE.TorusGeometry(8, 3.2, 8, 12, Math.PI * 0.9), toon('#ffe600'));
    m.rotation.set(Math.PI / 2, 0, Math.random() * 6);
    scene.add(m);
    return m;
  }

  function useItem(k) {
    const now = simTime;
    if (!k.item || k.spinUntil > now || k.finished || state.phase !== 'race') return;
    const it = k.item;
    k.item = null;
    const cos = Math.cos(k.angle), sin = Math.sin(k.angle);
    switch (it) {
      case 'mushroom': boost(k, 1.2); break;
      case 'banana':
        state.bananas.push({ x: k.x - cos * 34, y: k.y - sin * 34, owner: k.id, bornAt: now, mesh: bananaMesh() });
        if (state.bananas.length > 30) { const old = state.bananas.shift(); scene.remove(old.mesh); }
        sfx('drop');
        break;
      case 'green':
        state.projectiles.push({ type: 'green', x: k.x + cos * 28, y: k.y + sin * 28, angle: k.angle, speed: 700, owner: k.id, bornAt: now, life: 5, targetId: null, dead: false, mesh: shellMesh('green') });
        sfx('shell');
        break;
      case 'red': {
        const ahead = state.karts.find((o) => o.rank === k.rank - 1) || null;
        state.projectiles.push({ type: 'red', x: k.x + cos * 28, y: k.y + sin * 28, angle: k.angle, speed: 660, owner: k.id, bornAt: now, life: 9, targetId: ahead ? ahead.id : null, dead: false, mesh: shellMesh('red') });
        sfx('shell');
        break;
      }
      case 'star':
        k.starUntil = now + 7; k.spinUntil = 0;
        particles.emit(k.x, k.z + 20, k.y, { n: 24, color: 'rainbow', spread: 240, vy: 150, life: 0.9, size: 5 });
        sfx('star');
        break;
      case 'lightning':
        for (const o of state.karts) {
          if (o === k || o.starUntil > now) continue;
          o.shrinkUntil = now + 5;
          if (o.spinUntil <= now && o.invUntil <= now) { o.spinUntil = now + 0.6; o.speed *= 0.4; o.vz = Math.max(o.vz, 120); o.air = true; }
          particles.emit(o.x, o.z + 30, o.y, { n: 10, color: ['#ffe600', '#00e5ff'], spread: 100, vy: -200, life: 0.5, size: 4, g: 0 });
          if (o.playerId != null) toPlayer(o.playerId, { t: 'fx', kind: 'hit' });
        }
        flashEl.style.opacity = '0.85';
        setTimeout(() => { flashEl.style.opacity = '0'; }, 60);
        state.shake = 10;
        sfx('lightning');
        break;
      default: break;
    }
    sendStatus(k);
  }

  function stepProjectiles(dt) {
    const t = state.track, now = simTime;
    for (const p of state.projectiles) {
      if (p.dead) continue;
      let homing = false;
      if (p.type === 'red' && p.targetId) {
        const tgt = state.karts.find((k) => k.id === p.targetId);
        if (tgt) {
          homing = true;
          const dx = tgt.x - p.x, dy = tgt.y - p.y;
          let desired;
          if (Math.hypot(dx, dy) < 260) desired = Math.atan2(dy, dx);
          else { const near = t.nearest(p.x, p.y); const s = t.samples[(near.i + 16) % t.N]; desired = Math.atan2(s.y - p.y, s.x - p.x); }
          const diff = wrapAngle(desired - p.angle), maxTurn = 7 * dt;
          p.angle += clamp(diff, -maxTurn, maxTurn);
        }
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.z = t.groundAt(p.x, p.y) + 8;
      const age = now - p.bornAt;
      if (age > p.life || p.x < 0 || p.x > MAP_W || p.y < 0 || p.y > MAP_H) { p.dead = true; continue; }
      if (!homing && t.nearest(p.x, p.y).d > t.halfW + 30) { p.dead = true; particles.emit(p.x, p.z, p.y, { n: 8, color: '#ffffff', spread: 120, life: 0.4, size: 4 }); continue; }
      for (const k of state.karts) {
        if (k.id === p.owner && (p.type === 'red' || age < 0.5)) continue;
        if (k.z - p.z > 22) continue; // saltando por encima
        const dx = k.x - p.x, dy = k.y - p.y;
        if (dx * dx + dy * dy < (KART_R + 10) * (KART_R + 10)) {
          if (k.starUntil > now) { p.dead = true; particles.emit(p.x, p.z, p.y, { n: 8, color: '#ffffff', spread: 120, life: 0.4, size: 4 }); }
          else if (hitKart(k)) p.dead = true;
          break;
        }
      }
      if (p.dead) continue;
      for (let i = state.bananas.length - 1; i >= 0; i--) {
        const bn = state.bananas[i];
        const dx = bn.x - p.x, dy = bn.y - p.y;
        if (dx * dx + dy * dy < 22 * 22) { scene.remove(bn.mesh); state.bananas.splice(i, 1); p.dead = true; particles.emit(p.x, p.z, p.y, { n: 8, color: '#ffe600', spread: 140, life: 0.5, size: 4 }); break; }
      }
    }
    for (const p of state.projectiles) if (p.dead && p.mesh) scene.remove(p.mesh);
    state.projectiles = state.projectiles.filter((p) => !p.dead);
  }

  function checkBananas() {
    const now = simTime;
    for (let i = state.bananas.length - 1; i >= 0; i--) {
      const bn = state.bananas[i];
      for (const k of state.karts) {
        if (bn.owner === k.id && now < bn.bornAt + 0.7) continue;
        if (k.z - k.ground > 22) continue;
        const dx = bn.x - k.x, dy = bn.y - k.y;
        if (dx * dx + dy * dy < (KART_R + 10) * (KART_R + 10)) {
          if (k.starUntil > now || hitKart(k)) { scene.remove(bn.mesh); state.bananas.splice(i, 1); particles.emit(bn.x, k.z + 6, bn.y, { n: 8, color: '#ffe600', spread: 140, life: 0.5, size: 4 }); break; }
        }
      }
    }
  }

  // ===================== Simulación =====================
  function updateRanking() {
    const arr = state.karts.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.dist - a.dist;
    });
    arr.forEach((k, i) => { k.rank = i + 1; });
  }

  let statusTimer = 0;
  function update(dt) {
    simTime += dt;
    if (state.phase === 'countdown') {
      state.countdownT += dt;
      const step = Math.floor(state.countdownT);
      if (step !== state.cdStep) {
        state.cdStep = step;
        if (step < 3) { sfx('beep'); showBig(String(3 - step)); }
      }
      if (state.countdownT >= 3) {
        state.phase = 'race'; state.raceTime = 0; state.goFlash = 1.2;
        showBig('¡YA!'); setTimeout(() => hideBig('¡YA!'), 1100);
        sfx('go');
        sendPhase();
      }
      return;
    }
    if (state.phase !== 'race') return;

    state.raceTime += dt;
    for (const k of state.karts) {
      let inp;
      if (k.isBot || k.finished) inp = aiInput(k);
      else if (k.isKb) inp = state.kb ? state.kb.input : k.input;
      else { const p = state.players.get(k.playerId); inp = p ? p.input : k.input; }
      stepKart(k, inp, dt);
    }
    collideKarts();
    stepProjectiles(dt);
    checkBananas();
    checkBoxes();
    finishRoulettes();
    updateRanking();

    statusTimer += dt;
    if (statusTimer >= 0.3) { statusTimer = 0; for (const k of state.karts) sendStatus(k); }

    const humans = state.karts.filter((k) => k.isHuman);
    if (!state.endAt) {
      if (humans.length && humans.every((k) => k.finished)) state.endAt = simTime + 2.5;
      else if (state.firstFinish && state.raceTime - state.firstFinish > 60) state.endAt = simTime;
      else if (state.raceTime > 60 * 8) state.endAt = simTime;
    }
    if (state.endAt && simTime >= state.endAt) showResults();
  }

  // ===================== Cámara =====================
  const cam = { fx: MAP_W / 2, fz: MAP_H / 2, dist: 2600, orbit: 0, intro: 0 };
  const CAM_PITCH = THREE.MathUtils.degToRad(56);
  function camStart() { cam.intro = 1; }
  function updateCamera(dt) {
    const t = state.track;
    let fx, fz, dist, angle = 0, pitch = CAM_PITCH;
    if (state.phase === 'lobby') {
      cam.orbit += dt * 0.12;
      fx = MAP_W / 2; fz = MAP_H / 2 + 40; dist = 2300; angle = cam.orbit; pitch = THREE.MathUtils.degToRad(38);
      cam.fx = fx; cam.fz = fz; cam.dist = dist;
    } else {
      const active = state.karts.filter((k) => !k.finished);
      const list = active.length ? active : state.karts;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const k of list) { minX = Math.min(minX, k.x); maxX = Math.max(maxX, k.x); minY = Math.min(minY, k.y); maxY = Math.max(maxY, k.y); }
      if (!list.length) { minX = 0; maxX = MAP_W; minY = 0; maxY = MAP_H; }
      const margin = 240;
      const ex = (maxX - minX) / 2 + margin, ey = (maxY - minY) / 2 + margin;
      fx = (minX + maxX) / 2; fz = (minY + maxY) / 2;
      const fovV = THREE.MathUtils.degToRad(camera.fov), fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
      const dW = ex / Math.tan(fovH / 2), dH = (ey * Math.sin(CAM_PITCH)) / Math.tan(fovV / 2) + ey * 0.35;
      const maxD = Math.max(MAP_W / 2 / Math.tan(fovH / 2), (MAP_H / 2 * Math.sin(CAM_PITCH)) / Math.tan(fovV / 2) + 260);
      dist = clamp(Math.max(dW, dH), 1000, maxD);
      if (state.phase === 'countdown') {
        const u = smoothstep(0, 3, state.countdownT);
        const g0 = t.grid[0];
        fx = lerp(g0.x, fx, u); fz = lerp(g0.y, fz, u); dist = lerp(520, dist, u);
        if (cam.intro) { cam.fx = g0.x; cam.fz = g0.y; cam.dist = 520; cam.intro = 0; }
      }
      const lam = state.phase === 'countdown' ? 6 : 2.2;
      cam.fx = THREE.MathUtils.damp(cam.fx, fx, lam, dt);
      cam.fz = THREE.MathUtils.damp(cam.fz, fz, lam, dt);
      cam.dist = THREE.MathUtils.damp(cam.dist, dist, dist > cam.dist ? 3 : 1.6, dt);
    }
    const D = cam.dist;
    const px = cam.fx + Math.sin(angle) * D * Math.cos(pitch), pz = cam.fz + Math.cos(angle) * D * Math.cos(pitch), py = D * Math.sin(pitch);
    let sx = 0, sy = 0, sz = 0;
    if (state.shake > 0) { sx = (Math.random() - 0.5) * state.shake; sy = (Math.random() - 0.5) * state.shake; sz = (Math.random() - 0.5) * state.shake; state.shake = Math.max(0, state.shake - dt * 30); }
    camera.position.set(px + sx, py + sy, pz + sz);
    camera.lookAt(cam.fx, t.groundAt(cam.fx, cam.fz) * 0.5, cam.fz);
  }

  // ===================== Visual por frame =====================
  const _hsl = new THREE.Color();
  function updateVisuals(dt) {
    animT += dt;
    const now = simTime;
    // ambiente
    if (currentWorld) {
      for (const a of currentWorld.userData.animated) {
        if (a.kind === 'bob') a.obj.position.y += Math.sin(animT * 1.3 + a.phase) * a.amp * dt;
        else if (a.kind === 'spinY') a.obj.rotation.y += a.speed * dt;
        else if (a.kind === 'drift') { a.obj.position.x += a.speed * dt; if (a.obj.position.x > MAP_W + 200) a.obj.position.x = -200; }
        else if (a.kind === 'pad') a.tex.offset.x -= dt * 1.5;
        else if (a.kind === 'pulse') { const s = 1 + Math.sin(animT * 3 + a.phase) * 0.08; a.obj.scale.set(s, s, s); }
        else if (a.kind === 'pool') { const s = 1 + Math.sin(animT * 1.2 + a.phase) * 0.03; a.obj.scale.set(s, 1, s); }
        else if (a.kind === 'volcano') { a.t -= dt; if (a.t <= 0) { a.t = 0.15; particles.emit(a.obj.position.x, a.obj.position.y + 150, a.obj.position.z, { n: 2, color: ['#ff5e00', '#ffd000', '#ff2d95'], spread: 90, vy: 220, life: 1.4, size: 6, g: 260 }); } }
      }
    }
    // cajas
    for (const box of state.track.boxes) {
      const m = box.mesh; if (!m) continue;
      const active = box.respawnAt <= now;
      const target = active ? 1 : 0;
      const s = lerp(m.scale.x, target, 1 - Math.exp(-8 * dt));
      m.scale.set(s, s, s);
      m.visible = s > 0.02;
      m.rotation.x += dt * 1.3; m.rotation.y += dt * 2.1;
      m.position.y = box.h + 18 + Math.sin(animT * 2 + box.x) * 3;
      _hsl.setHSL((animT * 0.4 + box.x * 0.001) % 1, 1, 0.6);
      m.material.color.copy(_hsl);
    }
    // proyectiles y plátanos
    for (const p of state.projectiles) { p.mesh.position.set(p.x, p.z, p.y); p.mesh.rotation.y += dt * 14; }
    for (const b of state.bananas) { if (b.z == null) b.z = state.track.groundAt(b.x, b.y) + 4; b.mesh.position.set(b.x, b.z, b.y); b.mesh.rotation.z += dt * 2; }
    // karts
    for (const k of state.karts) {
      const M = k.model; if (!M) continue;
      const boosting = k.boostUntil > now, star = k.starUntil > now, small = k.shrinkUntil > now, spinning = k.spinUntil > now;
      M.g.position.set(k.x, k.z, k.y);
      let yaw = -k.angle;
      if (spinning) yaw -= (1 - (k.spinUntil - now) / SPIN_TIME) * Math.PI * 4;
      M.g.rotation.y = yaw;
      const sc = lerp(M.g.scale.x, small ? 0.62 : 1, 1 - Math.exp(-6 * dt));
      M.g.scale.set(sc, sc, sc);
      // inclinación exagerada
      const inp = k.isBot || k.finished ? null : (k.isKb ? (state.kb && state.kb.input) : (state.players.get(k.playerId) || {}).input);
      const s = inp ? inp.s : 0, g = inp ? inp.g : (k.isBot ? 1 : 0), b = inp ? inp.b : 0;
      const drifting = k.driftT > 0;
      const rollT = drifting ? k.driftDir * 0.5 : s * 0.22;
      let pitchT = k.air ? clamp(k.vz / 500, -0.55, 0.55) : (g && Math.abs(k.speed) < 300 ? 0.14 : b ? -0.1 : 0);
      if (boosting) pitchT += 0.12;
      M.roll.step(rollT, dt); M.pitch.step(pitchT, dt); M.sq.step(0, dt); M.st.step(0, dt);
      const sq = clamp(M.sq.v, -0.6, 0.6), st = clamp(M.st.v, -0.5, 0.8);
      M.body.rotation.set(M.roll.v, 0, M.pitch.v + (k.trick ? k.trickAngle : 0));
      M.body.scale.set(1 - 0.5 * sq + st, 1 + sq - 0.4 * st, 1 - 0.5 * sq);
      for (const w of M.wheels) { w.roll.rotation.z -= k.speed * dt / 6; if (w.front) w.steer.rotation.y = -s * 0.45; }
      for (let i = 0; i < M.flames.length; i++) { const f = M.flames[i]; f.visible = boosting; if (boosting) f.scale.set(0.8 + Math.random() * 0.6, 1, 1); }
      M.glow.visible = star;
      if (star) { _hsl.setHSL((animT * 1.5) % 1, 1, 0.6); M.glow.material.color.copy(_hsl); M.glow.scale.setScalar(1 + Math.sin(animT * 12) * 0.08); }
      M.g.visible = !(k.invUntil > now && !spinning && Math.floor(animT * 14) % 2 === 0);
      // sombra
      M.shadow.position.set(k.x, k.ground + 1.9, k.y);
      const hs = clamp(1 - (k.z - k.ground) / 300, 0.35, 1) * sc;
      M.shadow.scale.set(hs, hs, hs);
      M.shadow.material.opacity = 0.38 * hs;
      // partículas de derrape / turbo / estrella
      if (drifting && !k.air && Math.random() < 0.8) {
        const c = k.driftT >= 1.6 ? '#ff2d95' : k.driftT >= 0.7 ? '#ff9f1c' : '#00e5ff';
        const cosA = Math.cos(k.angle), sinA = Math.sin(k.angle);
        for (const side of [-1, 1]) particles.emit(k.x - cosA * 13 - sinA * 13 * side, k.z + 3, k.y - sinA * 13 + cosA * 13 * side, { n: 1, color: c, vx: -cosA * 120, vz: -sinA * 120, spread: 90, vy: 60, life: 0.35, size: 3, g: 400 });
      }
      if (boosting && Math.random() < 0.9) particles.emit(k.x - Math.cos(k.angle) * 24, k.z + 7, k.y - Math.sin(k.angle) * 24, { n: 2, color: ['#ff9f1c', '#ffe74c', '#ff2d95'], vx: -Math.cos(k.angle) * 200, vz: -Math.sin(k.angle) * 200, spread: 60, life: 0.35, size: 4, g: 0 });
      if (star && Math.random() < 0.7) particles.emit(k.x, k.z + 12, k.y, { n: 1, color: 'rainbow', spread: 80, vy: 70, life: 0.6, size: 4, g: 0 });
      // etiquetas
      const labelText = `${k.rank}º ${k.name}`;
      if (labelText !== M.labelText) { M.labelText = labelText; M.label.material.map = textTexture(labelText, { w: 320, h: 80, font: `900 40px ${UI_FONT}`, color: k.isHuman ? '#fff' : '#d9d9ff', stroke: '#1a0b3d', strokeW: 10 }); M.label.material.needsUpdate = true; }
      screenScale(M.label, 22, 4);
      screenScale(M.head, 30, 1);
      M.head.scale.x = Math.max(M.head.scale.x, 22 * sc); M.head.scale.y = Math.max(M.head.scale.y, 22 * sc);
      let icon = null;
      if (k.rolling) icon = ITEMS[ITEM_IDS[Math.floor(animT * 12) % ITEM_IDS.length]].icon;
      else if (k.item) icon = ITEMS[k.item].icon;
      M.item.visible = !!icon;
      if (icon && icon !== M.itemText) { M.itemText = icon; M.item.material.map = textTexture(icon, { w: 128, h: 128, font: `84px ${EMOJI_FONT}`, bg: 'rgba(255,255,255,0.92)' }); M.item.material.needsUpdate = true; }
      if (icon) screenScale(M.item, 34, 1);
    }
    particles.update(dt);
  }

  // ===================== HUD / overlays =====================
  const hudEntries = new Map();
  function buildHud() {
    const wrap = $('hud-entries');
    wrap.innerHTML = '';
    hudEntries.clear();
    for (const k of state.karts) {
      const el = document.createElement('div');
      el.className = 'e' + (state.karts.length > 5 ? ' small' : '');
      el.style.borderLeftColor = k.color;
      el.innerHTML = `<div class="top"><span class="rk"></span><span class="em">${k.emoji}</span><span class="nm">${esc(k.name)}</span></div><div class="sub"></div>`;
      wrap.appendChild(el);
      hudEntries.set(k, el);
    }
    $('hud-track').textContent = state.track.name;
    $('hud-laps').textContent = `${state.laps} ${state.laps === 1 ? 'vuelta' : 'vueltas'}`;
  }
  let hudTimer = 0;
  function updateHud(dt) {
    $('hud-time').textContent = fmtTime(state.raceTime);
    hudTimer += dt;
    if (hudTimer < 0.15) return;
    hudTimer = 0;
    for (const k of state.karts) {
      const el = hudEntries.get(k); if (!el) continue;
      el.style.order = k.rank;
      el.querySelector('.rk').textContent = ordinal(k.rank);
      el.querySelector('.sub').textContent = k.finished ? `¡Meta! ${fmtTime(k.finishTime)}` : `Vuelta ${displayLap(k)}/${state.laps}` + (k.item ? '  ' + ITEMS[k.item].icon : '');
      el.classList.toggle('fin', k.finished);
    }
  }
  function showBig(text) {
    bigEl.textContent = text;
    bigEl.classList.remove('hidden', 'pop');
    void bigEl.offsetWidth; // reinicia la animación
    bigEl.classList.add('pop');
  }
  function hideBig(ifText) { if (!ifText || bigEl.textContent === ifText) bigEl.classList.add('hidden'); }

  function updateOverlays() {
    lobbyEl.classList.toggle('hidden', state.phase !== 'lobby');
    resultsEl.classList.toggle('hidden', state.phase !== 'results');
    hudEl.classList.toggle('hidden', state.phase === 'lobby');
    if (state.phase !== 'countdown' && state.phase !== 'race') bigEl.classList.add('hidden');
    if (state.phase === 'lobby') renderLobby();
    if (state.phase === 'results') renderResults();
  }

  function renderLobby() {
    $('url').textContent = state.joinUrl || `http://${location.host}/play`;
    const rows = [];
    for (const p of state.players.values()) {
      const ch = CHARS[p.char] || CHARS[0];
      rows.push(`<div class="slot full" style="border-color:${ch.color}"><span class="emoji">${ch.emoji}</span><span>${esc(p.name)}</span>${p.host ? '<span class="tag">👑 anfitrión</span>' : ''}<span class="dot ${p.connected ? '' : 'off'}"></span></div>`);
    }
    if (state.kb) rows.push('<div class="slot full"><span class="emoji">⌨️</span><span>Teclado</span><span class="tag">flechas · ⇧ derrape · espacio objeto</span></div>');
    while (rows.length < MAX_KARTS) rows.push('<div class="slot empty"><span class="emoji">·</span><span>libre</span></div>');
    $('players').innerHTML = rows.slice(0, MAX_KARTS).join('');
    $('setTrack').innerHTML = `Circuito: <b>${esc(TRACKS[state.settings.track].name)}</b>`;
    $('setLaps').innerHTML = `Vueltas: <b>${state.settings.laps}</b>`;
    $('setBots').innerHTML = `Bots: <b>${state.settings.bots}</b>`;
  }

  function renderResults() {
    if (!state.results) return;
    const rows = state.results.map((r) => `<tr><td class="pos">${r.pos}º</td><td class="emoji">${r.emoji}</td><td>${esc(r.name)}</td><td class="time">${r.finished ? fmtTime(r.time) : 'vuelta ' + r.lap}</td></tr>`).join('');
    resultsEl.innerHTML = `<h1>🏆 Resultados · ${esc(state.track.name)}</h1><table>${rows}</table><div class="again">El anfitrión pulsa <b>OTRA CARRERA</b> en su móvil (o <b>Intro</b> en el teclado)</div>`;
  }

  // ===================== Teclado =====================
  function kbInput() { return state.kb ? state.kb.input : null; }
  window.addEventListener('keydown', (e) => {
    ensureAudio();
    const inp = kbInput();
    const key = e.key;
    if (inp && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(key)) {
      e.preventDefault();
      if (state.phase !== 'lobby') {
        if (key === 'ArrowUp') inp.g = 1;
        if (key === 'ArrowDown') inp.b = 1;
        if (key === 'ArrowLeft') inp.s = -1;
        if (key === 'ArrowRight') inp.s = 1;
        if (key === 'Shift') inp.d = 1;
        if (key === ' ' && !e.repeat) { const k = state.karts.find((q) => q.isKb); if (k) useItem(k); }
      }
    }
    if (e.repeat) return;
    if (key === 'f' || key === 'F') { toggleFullscreen(); return; }
    if (state.phase === 'lobby') {
      if (key === 'Enter') startRace();
      else if (key === 'k' || key === 'K') toggleKeyboardPlayer();
      else if (key === 'ArrowLeft') changeSetting('track', -1);
      else if (key === 'ArrowRight') changeSetting('track', 1);
      else if (key === 'b' || key === 'B') changeSetting('bots', 1);
      else if (key === 'n' || key === 'N') changeSetting('bots', -1);
      else if (key === 'l' || key === 'L') changeSetting('laps', 1);
    } else if (state.phase === 'results') {
      if (key === 'Enter') backToLobby();
    }
  });
  window.addEventListener('keyup', (e) => {
    const inp = kbInput();
    if (!inp) return;
    const key = e.key;
    if (key === 'ArrowUp') inp.g = 0;
    if (key === 'ArrowDown') inp.b = 0;
    if (key === 'ArrowLeft' && inp.s === -1) inp.s = 0;
    if (key === 'ArrowRight' && inp.s === 1) inp.s = 0;
    if (key === 'Shift') inp.d = 0;
  });
  window.addEventListener('blur', () => { const inp = kbInput(); if (inp) { inp.s = 0; inp.g = 0; inp.b = 0; inp.d = 0; } });
  window.addEventListener('pointerdown', ensureAudio);
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  // ===================== Audio (sintetizado) =====================
  let ac = null;
  function ensureAudio() {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (_) { ac = null; }
  }
  function tone(freq, dur, opts = {}) {
    if (!ac || ac.state !== 'running') return;
    const o = ac.createOscillator(), g = ac.createGain();
    const t0 = ac.currentTime + (opts.when || 0);
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    g.gain.setValueAtTime(opts.vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function sfx(name) {
    switch (name) {
      case 'beep': tone(440, 0.18); break;
      case 'go': tone(880, 0.6, { vol: 0.15 }); break;
      case 'pickup': tone(600, 0.08); tone(900, 0.12, { when: 0.08 }); break;
      case 'hit': tone(220, 0.35, { type: 'sawtooth', to: 60, vol: 0.15 }); break;
      case 'boost': tone(300, 0.35, { type: 'sine', to: 1000, vol: 0.12 }); break;
      case 'shell': tone(500, 0.12, { type: 'triangle', to: 200 }); break;
      case 'drop': tone(300, 0.1, { type: 'triangle' }); break;
      case 'star': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.15, { when: i * 0.07, type: 'triangle' })); break;
      case 'lightning': tone(120, 0.5, { type: 'sawtooth', to: 40, vol: 0.18 }); break;
      case 'lap': tone(660, 0.1); tone(880, 0.15, { when: 0.1 }); break;
      case 'finishKart': [784, 988, 1175].forEach((f, i) => tone(f, 0.18, { when: i * 0.12, type: 'triangle' })); break;
      case 'finish': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { when: i * 0.15, type: 'triangle', vol: 0.14 })); break;
      case 'boing': tone(180, 0.25, { type: 'sine', to: 420, vol: 0.14 }); break;
      case 'bump': tone(140, 0.12, { type: 'square', to: 90, vol: 0.1 }); break;
      case 'jump': tone(400, 0.25, { type: 'sine', to: 900, vol: 0.08 }); break;
      case 'land': tone(120, 0.15, { type: 'triangle', to: 60, vol: 0.12 }); break;
      case 'trick': [660, 880, 1320].forEach((f, i) => tone(f, 0.1, { when: i * 0.06, type: 'square', vol: 0.08 })); break;
      case 'pad': tone(500, 0.2, { type: 'sawtooth', to: 1400, vol: 0.1 }); break;
      default: break;
    }
  }

  // ===================== Bucle principal =====================
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 6) { update(DT); acc -= DT; n++; }
    if (n === 6) acc = 0;
    updateVisuals(dt);
    updateCamera(dt);
    if (state.phase !== 'lobby') updateHud(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  window.KART_DEBUG = { state, TRACKS, aiInput, startRace, backToLobby, useItem, hitKart, scene, camera, stats };

  if (window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 900 && !location.search.includes('screen')) {
    location.replace('/play');
  } else {
    setWorld(state.track);
    connect();
    updateOverlays();
    requestAnimationFrame(frame);
  }
})();
