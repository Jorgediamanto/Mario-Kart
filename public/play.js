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
    red: { icon: '🎯', name: 'Caparazón rojo: persigue al de delante' },
    star: { icon: '⭐', name: 'Estrella: invencible' },
    lightning: { icon: '⚡', name: 'Rayo: encoge a todos' },
    snail: { icon: '🐌', name: 'Caracol: para todo y eliges' },
  };
  const ITEM_IDS = Object.keys(ITEMS);

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const views = { join: $('v-join'), lobby: $('v-lobby'), race: $('v-race'), pick: $('v-pick'), results: $('v-results') };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('kp.' + k); return v == null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('kp.' + k, v); } catch (_) { /* privado */ } },
  };

  const me = { id: null, token: store.get('token', ''), name: store.get('name', ''), char: parseInt(store.get('char', '-1'), 10), host: false, easy: store.get('facil', '0') === '1' };
  if (!(me.char >= 0 && me.char < CHARS.length)) me.char = -1;
  let joined = false, wantJoin = false, editing = false, spectating = false;
  // calentamiento: mientras el anfitrión no empieza, tu kart ya está en la pista y puedes probarlo
  let probando = false;
  let eligiendo = null;      // caracol: { opciones, hasta } mientras nos toca elegir víctima
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
    send({ t: 'hello', token: me.token || undefined, name: me.name, char: me.char, easy: me.easy });
  }

  function handle(m) {
    switch (m.t) {
      case 'welcome':
        me.id = m.id; me.token = m.token; me.name = m.name; me.char = m.char;
        if (typeof m.easy === 'boolean') me.easy = m.easy;
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
      case 'kicked':
        // nos han sacado de la sala desde la tele: hay que soltarlo todo y **dejar de volver
        // solos**, o al reconectar entraríamos otra vez y la sala nunca quedaría vacía
        joined = false; wantJoin = false; editing = false; spectating = false;
        me.id = null; me.token = ''; me.host = false;
        store.set('token', '');
        lobby = null; status = null;
        setView();
        showErr(m.msg || 'Se ha vaciado la sala. Vuelve a entrar.');
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
        if (m.phase !== 'race') eligiendo = null;
        phase = m.phase;
        if (phase === 'lobby' || phase === 'warmup') { spectating = false; status = null; }
        if (phase !== 'warmup') probando = false;
        if (phase === 'countdown') { showRaceMsg('¡Preparados!'); centrarVolante(); }
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
      /*
       * Caracol: nos ha tocado elegir a quién frenar y **la carrera está parada esperándonos**.
       * Sale la lista de rivales a pantalla completa; al tocar uno, se manda y sigue la carrera.
       */
      case 'pick':
        eligiendo = { opciones: Array.isArray(m.opciones) ? m.opciones : [], hasta: Date.now() + (m.segundos || 6) * 1000 };
        vibrate([40, 50, 40, 50, 120]);
        setView();
        break;
      case 'fx':
        if (m.kind === 'pausa') showRaceMsg('🐌 Alguien está eligiendo a quién frenar…');
        if (m.kind === 'sigue') { if (eligiendo) { eligiendo = null; setView(); } showRaceMsg(''); }
        if (m.kind === 'snail') { vibrate([200, 80, 200]); flashBody('#2d6b1a'); showRaceMsg('🐌 ¡Te han frenado!', 2200); }
        if (m.kind === 'hit') { vibrate([120, 40, 120]); flashBody('#a83232'); }
        if (m.kind === 'rescue') { vibrate([40, 60, 40]); flashBody('#1f6aa8'); showRaceMsg('¡De vuelta a la pista!', 1200); }
        if (m.kind === 'zap') { vibrate([60, 50, 60, 50, 60]); flashBody('#b8a400'); showRaceMsg('⚡ ¡Te han encogido!', 1400); }
        if (m.kind === 'wrong') { vibrate([200, 100, 200]); flashBody('#a83232'); showRaceMsg('↩ ¡Vas al revés! Date la vuelta', 2500); }
        if (m.kind === 'star') { vibrate([25, 40, 25, 40, 60]); flashBody('#6a4fb8'); showRaceMsg('⭐ ¡Invencible!', 1400); }
        // derrape automático: drift0 = se ha soltado; drift1..3 = nivel cargado
        if (typeof m.kind === 'string' && m.kind.startsWith('drift')) pintarDerrape(Number(m.kind.slice(5)) || 0);
        break;
      default: break;
    }
  }

  // ===================== Vistas =====================
  function setView() {
    let v;
    if (!joined || editing) v = 'join';
    else if (eligiendo) v = 'pick';
    else if (phase === 'warmup') v = probando ? 'race' : 'lobby';
    else if (phase === 'lobby') v = 'lobby';
    else if (phase === 'results') v = spectating ? 'lobby' : 'results';
    else v = spectating ? 'lobby' : 'race';
    currentView = v;
    for (const [k, el] of Object.entries(views)) el.classList.toggle('active', k === v);
    if (v === 'join') { renderChars(); if (editing) $('btn-join').textContent = 'Guardar'; else $('btn-join').textContent = 'Entrar'; }
    if (v === 'lobby') renderLobby();
    if (v === 'results') renderResults();
    if (v === 'pick') { releaseAll(); renderPick(); }
    if (v === 'race') {
      releaseAll(); renderStatus();
      if (phase === 'countdown') showRaceMsg('¡Preparados!');
      if (phase === 'warmup') showRaceMsg('Calentamiento: conduce a tu aire 🕹️', 2500);
    }
    $('btn-volver').classList.toggle('hidden', phase !== 'warmup');
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
    pintarFacil();
    // el kart solo está en la pista cuando la tele lo dice (fase «warmup»)
    $('btn-probar').classList.toggle('hidden', phase !== 'warmup' || spectating);
    $('lobby-players').innerHTML = lobby
      ? lobby.players.map((p) => `<li class="${p.connected ? '' : 'off'}">${(CHARS[p.char] || CHARS[0]).emoji} ${esc(p.name)}${p.host ? ' 👑' : ''}${p.easy ? ' 🦺' : ''}${p.id === me.id ? ' <b style="color:#39ff88">(tú)</b>' : ''}${p.connected ? '' : ' <span style="opacity:.7">(sin conexión)</span>'}</li>`).join('')
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
  /*
   * Modo fácil: se guarda en este móvil y se le dice al servidor con un `hello` nuevo (es el mismo
   * mensaje de siempre; un móvil viejo que no lo mande se queda en normal, como hasta ahora).
   * Solo se puede cambiar en la sala: a mitad de carrera sería cambiarle el kart a alguien.
   */
  function pintarFacil() {
    const b = $('btn-facil');
    b.textContent = me.easy ? 'Encendido' : 'Apagado';
    b.style.background = me.easy ? '#16c96a' : '#2a2f65';
    $('facil-caja').style.opacity = spectating ? 0.5 : 1;
  }
  $('btn-facil').addEventListener('click', () => {
    if (spectating) return;
    me.easy = !me.easy;
    store.set('facil', me.easy ? '1' : '0');
    pintarFacil();
    vibrate(15);
    if (joined) sendHello();
  });
  $('btn-probar').addEventListener('click', () => { probando = true; releaseAll(); setView(); requestWakeLock(); vibrate(20); });
  $('btn-volver').addEventListener('click', () => { probando = false; releaseAll(); setView(); });
  $('btn-change').addEventListener('click', () => { editing = true; setView(); });
  $('btn-leave').addEventListener('click', () => {
    send({ t: 'leave' });
    joined = false; me.token = ''; me.id = null; store.set('token', '');
    lobby = null; status = null;
    setView();
  });
  const fsBtn = $('btn-fs');
  if (!document.documentElement.requestFullscreen) fsBtn.classList.add('hidden');
  /*
   * Con el volante el móvil se gira mucho, así que la pantalla se daría la vuelta sola a cada
   * curva. Esto pide pantalla completa y, ya dentro, bloquea el giro en horizontal.
   * Ojo: tiene que llamarse **dentro** de un toque, y en iPhone no existe ninguna de las dos
   * cosas (allí se bloquea a mano desde el centro de control, y así lo dice la ayuda).
   */
  function pantallaCompletaYHorizontal() {
    try {
      const el = document.documentElement;
      if (!el.requestFullscreen || document.fullscreenElement) return;
      el.requestFullscreen()
        .then(() => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (_) { /* no se puede */ } })
        .catch(() => {});
    } catch (_) { /* no se puede */ }
  }
  fsBtn.addEventListener('click', pantallaCompletaYHorizontal);

  // ---- Volante (giroscopio) ----
  /*
   * El móvil se sujeta en horizontal con las dos manos y se gira como un volante, al estilo del
   * mando de la Wii. Cómo se mide: de `deviceorientation` sacamos hacia dónde tira la gravedad
   * **en coordenadas del móvil**; al «centrar» guardamos ese vector, y a partir de ahí el ángulo
   * entre el de ahora y el guardado, medido en el plano de la pantalla, es exactamente cuánto has
   * girado el volante. Da igual lo inclinado que sujetes el móvil y da igual si la pantalla está
   * en horizontal o en vertical: solo cuenta el giro alrededor del eje que sale de la pantalla.
   *
   * Los navegadores solo dan sensores en «contexto seguro» (https://). Si no los hay, si el
   * iPhone no da permiso o si el móvil no tiene giroscopio, `volante.va` se queda en false y el
   * mando enseña los botones ◀ ▶ de siempre: nadie se queda sin jugar.
   */
  const V = window.KART_VOLANTE;          // las cuentas del volante viven en /volante.js
  // Dirección cifrada del mando: hace falta para el giroscopio, pero se entra por la normal (ver
  // `saltarAlVolante`). La pedimos al servidor porque el móvil no sabe el puerto ni la IP.
  let urlVolante = '';
  fetch('/info').then((r) => r.json()).then((info) => { urlVolante = info.urlVolante || ''; pintarVolante(); }).catch(() => {});
  const volante = { pedido: store.get('volante', '1') === '1', va: false, visto: false, centro: null, ang: 0, s: 0, plano: false };

  function alInclinar(e) {
    if (e.beta == null || e.gamma == null) return;
    const g = V.gravedad(e.beta, e.gamma);
    if (!volante.visto) { volante.visto = true; pintarVolante(); }
    volante.plano = !V.hayGravedad(g);
    if (!volante.centro) volante.centro = g;
    // con el móvil plano mirando al techo no se puede saber hacia dónde giras: nos vamos soltando
    volante.ang = volante.plano ? volante.ang * 0.85 : V.suaviza(volante.ang, V.angulo(volante.centro, g));
    volante.s = V.direccion(volante.ang);
  }
  function centrarVolante() { volante.centro = null; volante.ang = 0; volante.s = 0; }
  function hayVolante() { return volante.va && volante.visto; }
  // ¿puede este móvil, en principio? (hace falta https:// o localhost)
  function volantePosible() { return typeof DeviceOrientationEvent !== 'undefined' && window.isSecureContext; }

  async function activarVolante(porGesto) {
    if (!volantePosible()) return false;
    const pedirPermiso = DeviceOrientationEvent.requestPermission;   // iPhone
    if (typeof pedirPermiso === 'function') {
      if (!porGesto) return false;        // en iPhone el permiso solo se puede pedir desde un toque
      try { if ((await pedirPermiso.call(DeviceOrientationEvent)) !== 'granted') return false; } catch (_) { return false; }
    }
    if (!volante.va) window.addEventListener('deviceorientation', alInclinar);
    volante.va = true; volante.pedido = true;
    store.set('volante', '1');
    centrarVolante();
    pintarVolante();
    // algunos móviles no tienen giroscopio: si en dos segundos no llega nada, botones y a jugar
    setTimeout(pintarVolante, 2000);
    return true;
  }
  /*
   * Saltar a la dirección cifrada para poder usar el giroscopio. Es otro origen para el navegador,
   * así que allí no hay ni token ni nombre guardados: se los llevamos en la dirección para que al
   * llegar entre solo, sin tener que escribir nada otra vez. Y soltamos el sitio en la sala antes
   * de irnos, para no dejar un jugador fantasma ocupando plaza.
   */
  function saltarAlVolante() {
    if (!urlVolante) return;
    // Nos llevamos también el token: para el navegador la dirección cifrada es otro sitio y no
    // comparte lo guardado, pero el servidor nos reconoce por el token y seguimos siendo el mismo
    // jugador, con nuestro personaje y la corona si la teníamos. Sin esto aparecería un segundo
    // «yo» en la sala y el fantasma se quedaría de anfitrión.
    const destino = `${urlVolante}#n=${encodeURIComponent(me.name || '')}`
      + `&c=${me.char >= 0 ? me.char : ''}`
      + `&t=${encodeURIComponent(me.token || '')}`;
    location.href = destino;
  }

  function apagarVolante() {
    window.removeEventListener('deviceorientation', alInclinar);
    volante.va = false; volante.visto = false; volante.pedido = false;
    store.set('volante', '0');
    pintarVolante();
  }

  // Pinta el estado del volante en la sala y coloca los botones de la carrera
  function pintarVolante() {
    const con = hayVolante();
    const pad = $('pad'); if (pad) pad.classList.toggle('con-volante', con);
    const bar = $('vbar'); if (bar) bar.classList.toggle('show', con);
    const centrar = $('btn-centrar'); if (centrar) centrar.classList.toggle('hidden', !con);
    const gas = $('gas-hint');
    // en modo fácil el kart acelera solo, así que el botón deja de ser «el que hace que te muevas»
    if (gas) gas.textContent = me.easy ? '🦺 acelera solo · el GAS es un empujón'
      : con ? 'gira el móvil para girar' : 'los dos giros a la vez = marcha atrás';
    const estado = $('volante-estado'), btnV = $('btn-volante'), btnB = $('btn-botones');
    if (!estado) return;
    const saltar = !volantePosible() && !!urlVolante;   // estamos en la dirección normal y hay otra cifrada
    if (con) estado.innerHTML = '<b style="color:#39ff88">Volante listo.</b> Pon el móvil en horizontal y gíralo como un volante.';
    else if (saltar) estado.innerHTML = '¿Quieres girar <b>inclinando el móvil</b>, como el mando de la Wii? Hace falta una conexión cifrada. Al pulsar, el navegador dirá que <b>«la conexión no es privada»</b>: es normal, es el ordenador de la tele. Dale a <b>Avanzado → Continuar</b>.';
    else if (!volantePosible()) estado.innerHTML = 'Este móvil jugará con los botones ◀ ▶. (El volante necesita una conexión cifrada y aquí no la hay.)';
    else if (volante.va) estado.innerHTML = 'Esperando al sensor… si no se enciende, este móvil no tiene giroscopio y jugarás con los botones ◀ ▶.';
    else estado.innerHTML = 'Puedes girar <b>inclinando el móvil</b>, como el mando de la Wii.';
    if (btnV) {
      btnV.classList.toggle('hidden', con || (!volantePosible() && !saltar));
      btnV.textContent = saltar ? 'Activar el volante 🎡 (verás un aviso)' : 'Activar el volante 🎡';
    }
    if (btnB) btnB.classList.toggle('hidden', !con);
  }

  // ---- Carrera ----
  /*
   * Con volante hay dos botones y nada más: OBJETO (media pantalla) y GAS (la otra media). Sin
   * volante salen además los ◀ ▶ de respaldo, y los dos a la vez siguen siendo la marcha atrás.
   *  - derrape: no se pulsa, sale solo al aguantar el giro (`d` va siempre a 0)
   *  - truco en el aire: un volantazo (o tocar ◀ ▶) mientras se vuela, lo detecta la simulación
   */
  const held = { left: false, right: false, g: false };
  let lastSent = '', lastS = 0, lastAt = 0;
  function sendInput(force) {
    const con = hayVolante();
    const ambos = !con && held.left && held.right;
    // con volante la dirección es analógica: un decimal entre -1 y 1
    const s = con ? Math.round(volante.s * 100) / 100 : (ambos ? 0 : held.right ? 1 : held.left ? -1 : 0);
    const g = held.g ? 1 : 0, b = ambos ? 1 : 0;
    const zona = $('turn-zone');
    if (zona) zona.classList.toggle('reverse', ambos);
    const key = `${g}${b}${con ? 'v' : 's' + s}`;
    const ahora = Date.now();
    if (!force && key === lastSent && Math.abs(s - lastS) < 0.03) return;
    if (!force && ahora - lastAt < 40) return;      // como mucho 25 mensajes por segundo
    lastSent = key; lastS = s; lastAt = ahora;
    send({ t: 'i', s, g, b, d: 0 });
  }
  /* Derrape automático: la pantalla avisa con un `fx` cada vez que sube de nivel (y al soltarlo).
   * Aquí solo se pinta: el botón que se está aguantando se enciende con el color del nivel y
   * vibra un pelín, para notar la carga sin mirar la tele. */
  let nivelDerrape = 0;
  function pintarDerrape(nivel) {
    if (nivel === nivelDerrape) return;
    const subeDeNivel = nivel > nivelDerrape;
    nivelDerrape = nivel;
    const zona = $('turn-zone');
    if (zona) { zona.classList.remove('d0', 'd1', 'd2', 'd3'); if (nivel > 0) zona.classList.add('d' + nivel); }
    const bar = $('vbar');
    if (bar) { bar.classList.remove('d1', 'd2', 'd3'); if (nivel > 0) bar.classList.add('d' + nivel); }
    const texto = nivel > 0 ? '★'.repeat(nivel) : '';
    for (const id of ['nivel-left', 'nivel-right']) { const el = $(id); if (el) el.textContent = texto; }
    if (subeDeNivel && nivel > 0) vibrate(nivel === 3 ? [30, 40, 30] : [20 + nivel * 10]);
  }

  function releaseAll() {
    pintarDerrape(0);
    // también el volante: si el móvil se bloquea o se va a otra app, el kart deja de girar
    volante.ang = 0; volante.s = 0;
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
  // Con volante la dirección cambia todo el rato: se mira 30 veces por segundo y solo se manda
  // cuando de verdad ha cambiado (sendInput se encarga de no pasarse de 25 mensajes por segundo).
  setInterval(() => {
    if (!hayVolante()) return;
    if (currentView === 'race') sendInput(false);
    const aguja = $('vaguja'), txt = $('vtxt'), bar = $('vbar');
    if (aguja) aguja.style.left = `calc(50% + ${(volante.s * 42).toFixed(1)}%)`;
    if (bar) bar.classList.toggle('aviso', volante.plano);
    if (txt) txt.textContent = volante.plano ? 'levanta un poco el móvil' : '';
  }, 33);
  $('btn-centrar').addEventListener('click', (e) => { e.preventDefault(); centrarVolante(); vibrate(20); });
  $('btn-volante').addEventListener('click', async () => {
    // desde la dirección normal no hay sensores: lo primero es saltar a la cifrada
    if (!volantePosible() && urlVolante) { saltarAlVolante(); return; }
    // el mismo toque sirve para las dos cosas: pantalla completa en horizontal y permiso del sensor
    pantallaCompletaYHorizontal();
    const ok = await activarVolante(true);
    if (!ok) { volante.pedido = false; pintarVolante(); $('volante-estado').innerHTML = '<b style="color:#ff6b6b">No se ha podido activar el volante.</b> Jugarás con los botones ◀ ▶.'; }
    else vibrate(30);
  });
  $('btn-botones').addEventListener('click', () => { apagarVolante(); vibrate(20); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); else requestWakeLock(); });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('touchmove', (e) => { if (currentView === 'race') e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  let rouletteTimer = null;
  function renderStatus() {
    if (!status) { $('st-pos').textContent = '—'; $('st-lap').textContent = ''; $('st-name').textContent = me.name; return; }
    $('st-name').textContent = me.name;
    // calentando no hay posición ni vueltas que enseñar: solo estás dando vueltas de prueba
    if (phase === 'warmup') {
      $('st-pos').textContent = '🕹️';
      $('st-lap').textContent = 'calentamiento';
    } else if (status.fin) {
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
  function renderPick() {
    const cont = $('pick-lista');
    cont.innerHTML = '';
    for (const o of eligiendo.opciones) {
      const b = document.createElement('button');
      b.style.borderColor = o.color || '#2a2f65';
      b.innerHTML = `<span class="em">${esc(o.emoji || '·')}</span><span>${esc(o.name || '?')}</span>`;
      b.addEventListener('click', () => {
        if (!eligiendo) return;
        send({ t: 'picked', kart: o.kart });
        vibrate(40);
        eligiendo = null;
        setView();
      });
      cont.appendChild(b);
    }
  }
  // cuenta atrás de la elección: si se acaba, la pantalla elige sola y nos manda `sigue`
  setInterval(() => {
    if (!eligiendo || currentView !== 'pick') return;
    const quedan = Math.max(0, Math.ceil((eligiendo.hasta - Date.now()) / 1000));
    $('pick-reloj').textContent = quedan
      ? `Todo está parado esperándote… ${quedan} s`
      : 'Se acabó el tiempo: elige la pantalla';
  }, 250);

  let raceMsgTimer = null;
  // con `ms`, el mensaje se borra solo pasado ese tiempo (avisos cortos como el rescate)
  function showRaceMsg(text, ms) {
    const el = $('race-msg');
    el.textContent = text;
    el.classList.toggle('show', !!text);
    if (raceMsgTimer) { clearTimeout(raceMsgTimer); raceMsgTimer = null; }
    if (text && ms) {
      raceMsgTimer = setTimeout(() => {
        raceMsgTimer = null;
        if (el.textContent === text) { el.textContent = ''; el.classList.remove('show'); }
      }, ms);
    }
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

  /*
   * ¿Venimos del salto al volante? La dirección cifrada es otro origen, así que aquí no hay nada
   * guardado: el nombre y el personaje vienen en la propia dirección. Los recogemos, limpiamos la
   * barra y entramos solos, para que el salto sea un toque y ya está.
   */
  if (location.hash.length > 1) {
    const p = new URLSearchParams(location.hash.slice(1));
    const n = (p.get('n') || '').trim().slice(0, 12);
    const c = parseInt(p.get('c'), 10);
    const t = p.get('t') || '';
    if (n) { me.name = n; store.set('name', n); nameInput.value = n; }
    if (c >= 0 && c < CHARS.length) { me.char = c; store.set('char', c); }
    if (t) { me.token = t; store.set('token', t); }
    if (n && me.char >= 0) wantJoin = true;
    try { history.replaceState(null, '', location.pathname); } catch (_) { location.hash = ''; }
  }

  // Arranque: si ya jugamos antes, volvemos a entrar solos
  if (me.token && me.name && me.char >= 0) wantJoin = true;
  renderChars();
  setView();
  pintarVolante();
  // En Android se puede encender el volante sin preguntar; en iPhone hace falta el botón.
  if (volante.pedido) activarVolante(false).then(pintarVolante);
  connect();
})();
