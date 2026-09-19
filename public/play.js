/*
 * Kart Party — mando (móvil)
 * Envía los botones al servidor; la pantalla de la tele hace el resto.
 */
(() => {
  'use strict';

  const CHARS = [
    { name: 'Rana', emoji: '🐸', color: '#3ddc84' },
    { name: 'Zorro', emoji: '🦊', color: '#ff8c42' },
    { name: 'Panda', emoji: '🐼', color: '#f2f2f2' },
    { name: 'Tigre', emoji: '🐯', color: '#ffd23f' },
    { name: 'Unicornio', emoji: '🦄', color: '#ff6bcb' },
    { name: 'Pulpo', emoji: '🐙', color: '#a66cff' },
    { name: 'Pingüino', emoji: '🐧', color: '#4cc9f0' },
    { name: 'Dino', emoji: '🦖', color: '#ff4d4d' },
  ];
  const ITEMS = {
    mushroom: { icon: '🍄', name: 'Champiñón: turbo' },
    banana: { icon: '🍌', name: 'Plátano: lo sueltas detrás' },
    green: { icon: '🐢', name: 'Caparazón verde: recto' },
    red: { icon: '🎯', name: 'Caparazón rojo: persigue al de delante' },
    star: { icon: '⭐', name: 'Estrella: invencible' },
    lightning: { icon: '⚡', name: 'Rayo: encoge a todos' },
  };
  const ITEM_IDS = Object.keys(ITEMS);

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const views = { join: $('v-join'), lobby: $('v-lobby'), race: $('v-race'), results: $('v-results') };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('kp.' + k); return v == null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('kp.' + k, v); } catch (_) { /* privado */ } },
  };

  const me = { id: null, token: store.get('token', ''), name: store.get('name', ''), char: parseInt(store.get('char', '-1'), 10), host: false };
  if (!(me.char >= 0 && me.char < CHARS.length)) me.char = -1;
  let joined = false, wantJoin = false, editing = false, spectating = false;
  let phase = 'lobby', lobby = null, status = null, currentView = 'join';
  let takenChars = new Set();
  let ws = null, connected = false, retry = 500;

  // ===================== Red =====================
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => {
      connected = true; retry = 500;
      $('conn').classList.remove('show');
      if (joined || wantJoin) sendHello();
    };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } handle(m); };
    ws.onclose = () => {
      connected = false;
      $('conn').classList.add('show');
      setTimeout(connect, retry);
      retry = Math.min(4000, retry * 1.6);
    };
    ws.onerror = () => { /* onclose reconecta */ };
  }
  function sendHello() {
    if (!connected) return;
    send({ t: 'hello', token: me.token || undefined, name: me.name, char: me.char });
  }

  function handle(m) {
    switch (m.t) {
      case 'welcome':
        me.id = m.id; me.token = m.token; me.name = m.name; me.char = m.char;
        store.set('token', me.token); store.set('name', me.name); store.set('char', me.char);
        joined = true; wantJoin = false; editing = false;
        phase = m.phase;
        spectating = phase !== 'lobby';
        status = null;
        setView();
        break;
      case 'err':
        showErr(m.msg || 'Error');
        wantJoin = false;
        if (!joined) setView();
        break;
      case 'roster':
        takenChars = new Set(m.taken);
        renderChars();
        break;
      case 'lobby':
        lobby = m;
        me.host = m.hostId === me.id;
        phase = m.phase;
        takenChars = new Set(m.players.filter((p) => p.id !== me.id).map((p) => p.char));
        renderChars();
        if (currentView === 'lobby') renderLobby();
        if (currentView === 'results') renderResults();
        break;
      case 'phase':
        phase = m.phase;
        if (phase === 'lobby') { spectating = false; status = null; }
        if (phase === 'countdown') showRaceMsg('¡Preparados!');
        if (phase === 'race') showRaceMsg('');
        setView();
        break;
      case 'spectate':
        spectating = true;
        setView();
        break;
      case 'st':
        // recibir estado de carrera significa que tenemos kart: ya no somos espectadores
        status = m;
        if (spectating) { spectating = false; setView(); }
        renderStatus();
        if (currentView === 'results') renderResults();
        break;
      case 'fx':
        if (m.kind === 'hit') { vibrate([120, 40, 120]); flashBody('#a83232'); }
        break;
      default: break;
    }
  }

  // ===================== Vistas =====================
  function setView() {
    let v;
    if (!joined || editing) v = 'join';
    else if (phase === 'lobby') v = 'lobby';
    else if (phase === 'results') v = spectating ? 'lobby' : 'results';
    else v = spectating ? 'lobby' : 'race';
    currentView = v;
    for (const [k, el] of Object.entries(views)) el.classList.toggle('active', k === v);
    if (v === 'join') { renderChars(); if (editing) $('btn-join').textContent = 'Guardar'; else $('btn-join').textContent = 'Entrar'; }
    if (v === 'lobby') renderLobby();
    if (v === 'results') renderResults();
    if (v === 'race') { releaseAll(); renderStatus(); if (phase === 'countdown') showRaceMsg('¡Preparados!'); }
    if (v !== 'race') showRaceMsg('');
  }

  // ---- Entrar ----
  const nameInput = $('name');
  nameInput.value = me.name;
  function showErr(msg) { $('join-err').textContent = msg || ''; }
  function renderChars() {
    const el = $('chars');
    el.innerHTML = '';
    CHARS.forEach((c, i) => {
      const b = document.createElement('button');
      const taken = takenChars.has(i) && i !== me.char;
      b.className = 'char' + (i === me.char ? ' sel' : '') + (taken ? ' taken' : '');
      b.style.borderColor = i === me.char ? c.color : 'transparent';
      b.innerHTML = `${c.emoji}<small>${c.name}</small>`;
      b.addEventListener('click', () => {
        if (taken) { showErr('Ese personaje ya está cogido.'); return; }
        me.char = i; showErr(''); renderChars();
      });
      el.appendChild(b);
    });
  }
  $('btn-join').addEventListener('click', () => {
    const n = nameInput.value.trim().slice(0, 12);
    if (!n) { showErr('Escribe tu nombre.'); nameInput.focus(); return; }
    if (me.char < 0) { showErr('Elige un personaje.'); return; }
    me.name = n; store.set('name', n); store.set('char', me.char);
    showErr('');
    wantJoin = true;
    nameInput.blur();
    requestWakeLock();
    if (connected) sendHello(); else $('conn').classList.add('show');
  });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });

  // ---- Sala ----
  function renderLobby() {
    const ch = CHARS[me.char] || CHARS[0];
    $('me-emoji').textContent = ch.emoji;
    $('me-name').textContent = me.name;
    const hostP = lobby ? lobby.players.find((p) => p.id === lobby.hostId) : null;
    let text;
    if (spectating) text = 'Hay una carrera en marcha. Entrarás en la siguiente. 🍿';
    else if (me.host) text = 'Eres el anfitrión 👑. Elige el circuito y pulsa EMPEZAR cuando estéis todos.';
    else text = `Esperando a que ${hostP ? hostP.name : 'el anfitrión'} 👑 empiece la carrera…`;
    $('lobby-status').textContent = text;
    $('host-controls').classList.toggle('hidden', !me.host || spectating);
    $('no-screen').classList.toggle('hidden', !lobby || lobby.screen);
    const s = lobby ? lobby.settings : { track: 0, laps: 3, bots: 2 };
    const tracks = lobby ? lobby.tracks : [];
    const trackName = tracks[s.track] || `Circuito ${s.track + 1}`;
    $('set-track').textContent = trackName;
    $('set-laps').textContent = s.laps;
    $('set-bots').textContent = s.bots;
    $('guest-settings').textContent = me.host ? '' : `Circuito: ${trackName} · ${s.laps} vueltas · ${s.bots} bots`;
    $('lobby-players').innerHTML = lobby
      ? lobby.players.map((p) => `<li class="${p.connected ? '' : 'off'}">${(CHARS[p.char] || CHARS[0]).emoji} ${esc(p.name)}${p.host ? ' 👑' : ''}</li>`).join('')
      : '';
  }
  document.querySelectorAll('[data-set]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!lobby || !me.host) return;
      const key = b.dataset.set, d = parseInt(b.dataset.d, 10);
      const s = { ...lobby.settings };
      const n = Math.max(1, lobby.tracks.length);
      if (key === 'track') s.track = ((s.track + d) % n + n) % n;
      if (key === 'laps') s.laps = Math.min(9, Math.max(1, s.laps + d));
      if (key === 'bots') s.bots = Math.min(7, Math.max(0, s.bots + d));
      send({ t: 'set', settings: s });
      vibrate(15);
    });
  });
  $('btn-start').addEventListener('click', () => { send({ t: 'start' }); vibrate(30); requestWakeLock(); });
  $('btn-change').addEventListener('click', () => { editing = true; setView(); });
  $('btn-leave').addEventListener('click', () => {
    send({ t: 'leave' });
    joined = false; me.token = ''; me.id = null; store.set('token', '');
    lobby = null; status = null;
    setView();
  });
  const fsBtn = $('btn-fs');
  if (!document.documentElement.requestFullscreen) fsBtn.classList.add('hidden');
  fsBtn.addEventListener('click', () => { document.documentElement.requestFullscreen().catch(() => {}); });

  // ---- Carrera ----
  const held = { left: false, right: false, g: false, b: false, d: false };
  let lastSent = '';
  function sendInput(force) {
    const m = {
      t: 'i',
      s: held.right && !held.left ? 1 : held.left && !held.right ? -1 : 0,
      g: held.g ? 1 : 0, b: held.b ? 1 : 0, d: held.d ? 1 : 0,
    };
    const key = `${m.s}${m.g}${m.b}${m.d}`;
    if (!force && key === lastSent) return;
    lastSent = key;
    send(m);
  }
  function releaseAll() {
    for (const k of Object.keys(held)) held[k] = false;
    document.querySelectorAll('.ctl.on').forEach((el) => el.classList.remove('on'));
    sendInput(true);
  }
  document.querySelectorAll('.ctl[data-k]').forEach((el) => {
    const k = el.dataset.k;
    const down = (e) => {
      e.preventDefault();
      held[k] = true; el.classList.add('on');
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      sendInput(false);
    };
    const up = () => {
      if (!held[k]) return;
      held[k] = false; el.classList.remove('on');
      sendInput(false);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  $('btn-item').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (status && status.item) { send({ t: 'use' }); vibrate(25); }
  });
  $('btn-item').addEventListener('contextmenu', (e) => e.preventDefault());
  setInterval(() => { if (currentView === 'race') sendInput(true); }, 250); // por si se pierde un mensaje
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); else requestWakeLock(); });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('touchmove', (e) => { if (currentView === 'race') e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  let rouletteTimer = null;
  function renderStatus() {
    if (!status) { $('st-pos').textContent = '—'; $('st-lap').textContent = ''; $('st-name').textContent = me.name; return; }
    $('st-name').textContent = me.name;
    if (status.fin) {
      $('st-pos').textContent = `${status.finPos}º`;
      $('st-lap').textContent = '🏁 ¡Meta!';
      if (currentView === 'race') showRaceMsg(`🏁 ¡Has terminado ${status.finPos}º!`);
    } else {
      $('st-pos').textContent = `${status.pos}º`;
      $('st-lap').textContent = `de ${status.n} · Vuelta ${status.lap}/${status.laps}`;
    }
    const iconEl = $('item-icon'), nameEl = $('item-name');
    clearInterval(rouletteTimer); rouletteTimer = null;
    if (status.rolling) {
      let i = 0;
      rouletteTimer = setInterval(() => { iconEl.textContent = ITEMS[ITEM_IDS[i++ % ITEM_IDS.length]].icon; }, 90);
      nameEl.textContent = '…';
    } else if (status.item && ITEMS[status.item]) {
      iconEl.textContent = ITEMS[status.item].icon;
      nameEl.textContent = ITEMS[status.item].name;
    } else {
      iconEl.textContent = '·';
      nameEl.textContent = 'sin objeto';
    }
  }
  function showRaceMsg(text) {
    const el = $('race-msg');
    el.textContent = text;
    el.classList.toggle('show', !!text);
  }

  // ---- Resultados ----
  function renderResults() {
    const fin = status && status.fin;
    $('res-title').textContent = fin ? '🏁 ¡Carrera terminada!' : 'Carrera terminada';
    $('res-pos').textContent = status ? `${fin ? status.finPos : status.pos}º` : '—';
    $('res-sub').textContent = status ? (fin ? `de ${status.n} corredores` : `No llegaste a la meta (vuelta ${status.lap}/${status.laps})`) : '';
    $('btn-again').classList.toggle('hidden', !me.host);
    $('res-wait').classList.toggle('hidden', me.host);
  }
  $('btn-again').addEventListener('click', () => { send({ t: 'again' }); vibrate(30); });

  // ===================== Extras =====================
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) { /* ignore */ } }
  function flashBody(color) {
    document.body.style.transition = 'none'; document.body.style.background = color;
    setTimeout(() => { document.body.style.transition = 'background .4s'; document.body.style.background = '#0b0d17'; }, 60);
  }
  let wakeLock = null;
  function requestWakeLock() {
    try {
      if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then((wl) => { wakeLock = wl; wl.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
    } catch (_) { /* no disponible en http */ }
  }

  // Arranque: si ya jugamos antes, volvemos a entrar solos
  if (me.token && me.name && me.char >= 0) wantJoin = true;
  renderChars();
  setView();
  connect();
})();
