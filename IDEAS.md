# Hoja de ruta de Kart Party

El agente nocturno trabaja esta lista **en orden**: bugs primero, luego Fase 0, Fase 1, … Cada punto se
termina completo (con su «Comprobación» cumplida y `npm test` en verde) antes de pasar al siguiente. Marca
con `[x]` lo hecho. Edita este archivo para mandar: reordena, añade, tacha. Si un punto es demasiado grande
para una sesión, se parte en subpasos anotados en `PROGRESO.md` y se sigue la noche siguiente.

## Principios (no se negocian)

- **Simple**: el móvil tiene 4 botones y nada que configurar durante la carrera. Si una idea necesita un botón
  más, no vale.
- **Intuitivo**: todo lo que pasa se ve en la tele y se siente en el móvil (vibración, color, texto grande).
  Nadie debería preguntar «¿qué ha pasado?».
- **Divertido y justo**: físicas exageradas pero controlables; el último remonta, el primero suda; nunca
  rachas de golpes que dejen a alguien sin jugar.
- **Verificable a ciegas**: el agente no ve el juego. Cada punto trae una «Comprobación» que `npm test` u otra
  prueba automática debe cumplir. Lo que solo se puede juzgar jugando se marca en `CHANGELOG.md` como
  «pendiente de probar en fiesta» con instrucciones de qué mirar.
- **Español**, **60 fps en un portátil normal**, **sin internet en la fiesta** (nada de CDNs ni recursos externos),
  sin dependencias nuevas salvo que sean imprescindibles y ligeras.

## Bugs conocidos

- [x] **Un bot golpeado se da la vuelta y corre en dirección contraria.** Tras un choque o un
      caparazón, a veces el bot sale mirando hacia atrás y sigue a fondo el sentido contrario varios
      segundos (pierde ~18 s de carrera) antes de girar. Se ve en `npm test` como un aviso ⚠ de la
      fase 4: «Volcán Disco: Bot 4 se fue en dirección contraria hacia t=15 s». Reproducir:
      `node tools/check-sim.js` (circuito 3, semilla 1002, 8 bots). La culpa es de `aiInput` en
      `public/sim.mjs`: mientras está de espaldas sigue acelerando (`g: 1`) y solo da marcha atrás si
      va a menos de 60 de velocidad. Arreglo propuesto: si el ángulo hacia el camino es mayor de
      ~2 rad, soltar el gas (o frenar) hasta estar encarado. Añadir el escenario a `check-sim.js`:
      un kart colocado del revés vuelve a avanzar en menos de 3 s.
      **Hecho el 2026-09-19 (noche 2).** Arreglado justo así, con la constante `AI_WRONG_ANGLE`
      (2,0 rad) al principio de `sim.mjs`: de espaldas se suelta el gas y se frena; la marcha atrás
      se reserva para cuando ya casi está parado. El aviso ⚠ de la fase 4 pasa a ser un fallo de la
      prueba y hay un escenario nuevo («un kart puesto del revés…», los 4 circuitos, pierde menos de
      25 muestras y recupera su avance en < 2,5 s). Volcán Disco: vuelta media 13,5 s → 12,1 s.
      **Segunda mitad, el 2026-09-19 por la mañana.** Trazando el Bot 4 tick a tick salió la otra
      causa, que no era la dirección: tras el plátano salía despedido al césped de la horquilla y
      `nearest()` le devolvía como carretera más cercana el **tramo de enfrente** (81 muestras por
      delante). Se subía a él, el antiatajos no se lo contaba y al pasar de media vuelta su progreso
      saltaba a negativo: una vuelta perdida. El rescate tenía el mismo fallo (dejaba al kart,
      persona o bot, en el tramo más cercano y no en el suyo). Arreglo: `nearestNear()` busca la
      muestra más cercana **solo alrededor del progreso del kart** (±`win`); `aiInput` y el rescate
      usan ese «tramo propio». Dos escenarios más en `check-sim.js`, y `sim-race.js` deja de contar
      las vueltas «de propina» de los karts ya terminados, que falseaban las medias.

- [x] **Te quedas clavado contra el muro rebotando sin avanzar.** Al comerte el quitamiedos en
      diagonal, rebotabas, volvías a entrar y así eternamente; el rescate no entraba porque
      técnicamente te movías (la velocidad alternaba entre +300 y -100). La causa: el rebote llamaba
      a `setVel()`, que cambia la velocidad pero **nunca `k.angle`**, así que seguías apuntando al
      muro. **Hecho el 2026-09-19 (tarde)**: al rebotar, el morro gira también hacia la carretera
      (`BUMPER_ENDEREZA = 0,6` en `sim.mjs`). Antes: 224 px en 6 s con el morro clavado a 63º.
      Ahora: vuelve a rodar recto en 0,18 s y avanza 1.608 px. Escenario nuevo en `check-sim.js`
      («quien se come el quitamiedos en diagonal vuelve a rodar en menos de 1,5 s»).

- [x] **El contador de progreso se congela cuando un kart vuela por encima de un atajo.** Si un kart
      aterriza más de `win` muestras por delante de donde iba (por ejemplo, saliendo disparado de una
      rampa en Volcán Disco), `updateProgress` en `public/sim.mjs` deja de contarle avance hasta que
      vuelve a dar la vuelta entera, y entonces le resta media vuelta de golpe: durante ~10 s su
      posición en la clasificación es mentira. Se ve con el banco de pruebas: el kart recorre 4.000 px
      siguiendo el trazado mientras su `dist` no se mueve. Reproducir: `node tools/check-sim.js`
      (Volcán Disco, semilla 1002, Bot 1 hacia t=21 s). Arreglo propuesto: si el kart está en la
      carretera y el salto de progreso viene de un vuelo (o lleva más de ~1 s congelado), aceptar el
      salto en vez de ignorarlo, y comprobarlo con un escenario nuevo en `check-sim.js`.
      **Hecho el 2026-09-19 (noche 2).** Así, con `PROGRESS_JUMP_WAIT` (1 s) al principio de
      `sim.mjs` y valiendo para saltos en los dos sentidos; escenario «volar por encima de un atajo
      no congela la clasificación» en `check-sim.js`. Los tiempos de los bots no se mueven.

## Fase 0 — Cimientos: que el agente pueda comprobar su trabajo

- [x] **0.1 Simulación sin navegador (el «crash-test»): `public/sim.mjs` + carrera de bots en `npm test`.**
      - Qué: mover a `public/sim.mjs` (módulo ES; **`.mjs` y no `.js`**, porque `package.json` no tiene
        `"type": "module"` y Node 18/20 trataría un `.js` como CommonJS al importarlo desde las pruebas; en
        el navegador funciona igual) todo lo que hoy es simulación en `screen.js`: constantes, `CHARS`,
        `ITEMS`, `TER`, `buildTrack(def, index, geom)`, `makeKart` (sin modelo), `startRace`,
        `showResults`/`backToLobby` (la parte de estado), `aiInput`, `stepKart`, `land`, `updateProgress`,
        `finishKart`, `setVel`, `collideKarts`, `hitKart`, `boost`, `rollItem`, `checkBoxes`,
        `finishRoulettes`, `useItem`, `stepProjectiles`, `checkBananas`, `updateRanking`, `update`, `stats`.
        `export function createSim({ geom, trackDefs, hooks = {}, random = Math.random })` devuelve
        `{ tracks, state, stats, startRace({ entries, trackIndex, laps }), update(dt), setInput(kart, input),
        useItem, aiInput, hitKart, backToLobby, allFinished() }`. Cada costura con efectos pasa a ser un hook
        opcional, todos con valor por defecto vacío en un objeto `DEFAULT_HOOKS`: `onPhase`, `onCountdown(n)`,
        `onGo`, `onTrackChanged(t)`, `onKartAdded`/`onKartRemoved`, `onSfx(nombre, kart)`,
        `onParticles(x, h, z, opts)`, `onToast`, `onStatus(kart)`, `onFx(kart, kind)`, `onShake(n, kart)`,
        `onFlash`, `onSquash`/`onStretch(kart, dv)` (sustituyen a `k.model.sq/st.vel`),
        `onProjectileAdded`/`Removed`, `onBananaAdded`/`Removed`, `onResults`. Los objetos del sim llevan una
        ranura `view` que el sim nunca lee (ahí guarda `screen.js` las mallas). Todo `Math.random` del sim pasa
        por `random` (orden de parrilla, `skill`, `lane`, `rollItem`, `itemUseAt`). `screen.js` importa
        `./sim.mjs`, le pasa `KART_GEOM`/`KART_TRACKS` (globales de los scripts clásicos) y las herramientas
        se los pasan con `require`. `server.js`: añadir `'.mjs': 'text/javascript; charset=utf-8'` al mapa
        `MIME`. Refactor puro: ni un número ni una condición de la física cambia. `window.KART_DEBUG` sigue
        exponiendo `state`, `stats`, `TRACKS`, `aiInput`, `startRace`, `backToLobby`, `useItem`, `hitKart`.
      - Qué (pruebas): `tools/check-sim.js`, lanzado por `check-all.js` como fase 4 «Carrera sin pantalla»
        (igual que se lanza `check-tracks.js`): `await import(pathToFileURL(...).href)` de `public/sim.mjs`.
        Por circuito: 7 bots + 1 «pseudo-humano» (`bot: false`, movido por `aiInput`, para ejercitar los
        avisos y el final «todos los humanos han terminado»), 2 vueltas (3 en el primer circuito), semilla
        `1000 + índice`, `dt = 1/60`, tope de `60 s × vueltas + 30 s` de tiempo simulado. Contadores nuevos
        en `stats`: `pickups`, `itemsUsed`, `hits`. `check-sim.js` expone además una lista `escenarios`
        (funciones que montan un sim, fuerzan un estado y comprueban una regla): cada punto futuro añade el
        suyo. En `check-all.js`: `node --check public/sim.mjs` en la fase 1 (sin copia temporal) y
        `['/sim.mjs', 'text/javascript', 'createSim']` en las peticiones de la fase 3.
      - Por qué: sin esto, cada cambio de físicas, objetos o circuitos se sube a ciegas.
      - Comprobación: en los 4 circuitos todos terminan antes del tope, `lapCount` acaba en el número de
        vueltas y `finishRank` coincide con el orden por `finishTime`; en cada tick `x, y, z, vz, speed, angle`
        son finitos, `0 ≤ x ≤ 1920`, `0 ≤ y ≤ 1080`, `|speed| ≤ 2,5 × velocidad base`, `rank` es una
        permutación y `lapCount` no decrece; en toda ventana de 10 s cada kart no terminado avanza ≥ 40
        muestras; por circuito `jumps ≥ 1`, `pads ≥ 1`, `pickups ≥ 8`, `itemsUsed ≥ 8`; en total `hits ≥ 1`;
        dos carreras con la misma semilla dan los mismos `finishTime` (determinismo); `sim.mjs` no contiene
        `Math.random`, `document`, `window`, `THREE`, `setTimeout`, `performance`, `.mesh` ni `.model`
        (grep); todo `hooks.onX` usado existe en `DEFAULT_HOOKS`; la fase imprime el tiempo medio de vuelta
        por circuito y tarda < 20 s (cada carrera < 5 s reales). `npm test` completo en verde. Actualizar la
        frase «No hay tests de navegador» de `CLAUDE.md` y `README.md`, y el aserto de `check-all.js` que
        busca `from 'three'` en `/screen.js` si deja de cumplirse. En CHANGELOG: «primera fiesta tras este
        cambio: jugar con atención».
      - **Hecho el 2026-09-19.** Dos detalles que se resolvieron sobre la marcha, por si hace falta
        revisarlos: (1) la carrera de la fase 4 se corre **dos veces** por circuito — una con 8 bots,
        que es la que comprueba que los 8 terminan (con una persona en la parrilla la carrera acaba
        2,5 s después de que ella cruce, así que los bots no llegan), y otra con 7 bots y el
        pseudo-humano, que comprueba justo ese final; (2) `sim.mjs` menciona `Math.random` una sola
        vez, como valor por defecto del parámetro `random` que pide el propio enunciado, y la prueba
        comprueba que no hay ninguna llamada directa.
- [x] **0.2 `npm run race`: carreras por consola con estadísticas (los ojos del agente).**
      `tools/sim-race.js` con `--track n|all`, `--laps`, `--bots`, `--seed`, `--runs k`, `--verbose`
      (registro por evento: vuelta, objeto cogido/usado, golpe, salto, truco, panel, con tiempo y posición),
      `--stats items|drift|speed` (histogramas) y `--json`. Tabla final por kart: posición, tiempo, mejor
      vuelta, objetos usados, golpes dados/recibidos, tiempo fuera de pista y en el aire. Script `"race"` en
      `package.json`.
      - Por qué: para equilibrar objetos, derrape y circuitos con datos en vez de imaginar la carrera.
      - Comprobación: `npm run race -- --track all --runs 3 --json` produce JSON válido con esos campos;
        `npm test` lo ejecuta una vez en modo silencioso y comprueba que sale con código 0.
      - **Hecho el 2026-09-19.** Primer dato que sale de la herramienta y que conviene tener a mano para
        el punto del derrape automático: con `--stats drift`, de 745 derrapes de bots en 8 carreras, 523
        duran menos de 0,35 s, 204 entre 0,35 y 0,7 s, solo 18 pasan de 0,7 s (el mínimo para el
        miniturbo de hoy) y **ninguno** llega a 1,6 s. Es decir: tal y como conducen los bots hoy, el
        derrape casi nunca da turbo. Los tiempos del derrape automático por niveles habrá que medirlos
        con esto, no a ojo.
- [x] **0.3 Prueba del protocolo con móviles simulados (fase 5 de `npm test`).** `tools/check-protocol.js`
      arranca el servidor en un puerto libre, conecta con `ws` una pantalla falsa y 8 móviles falsos y
      recorre: `hello`/`welcome`, `roster`, sala llena (el 9.º recibe `err`), personaje repetido, cambio de
      ajustes solo por el anfitrión, `start`, botones `i` 10 veces por segundo durante 3 s reenviados a la
      pantalla con el id correcto, `use`, relevo de anfitrión al desconectarse, reconexión con `token` que
      conserva el id, `leave`, y que un móvil no puede hacerse pasar por pantalla.
      - Por qué: en la fiesta lo que falla son los móviles y la red, y hoy nada lo prueba.
      - Comprobación: la fase pasa en < 10 s; cada mensaje del protocolo tiene al menos una aserción; no hay
        excepciones en el servidor.
      - **Hecho el 2026-09-19** (25 comprobaciones en 4,5 s). La prueba cazó un fallo de verdad a la primera:
        **cualquier móvil podía hacerse pasar por la pantalla** mandando `{t:'screen'}`; el servidor le daba
        el relevo y echaba a la tele de la fiesta (la dejaba con el aviso de «se ha abierto en otro sitio»).
        Arreglado en `server.js`: un socket que ya es jugador no puede declararse pantalla.

## Fase 1 — Cambios pedidos por el dueño (hacer en este orden)

- [x] **Mando de móvil con solo 4 botones grandes.** Los botones de girar de ahora son demasiado pequeños.
      Nuevo `play.html`/`play.js`: la mitad izquierda de la pantalla son dos botones enormes ◀ ▶ (cada uno la
      mitad del ancho de esa zona y toda la altura); la mitad derecha son dos botones: arriba **OBJETO** (usar
      la habilidad; muestra el icono del objeto o «—») y abajo **GAS**, más grande que el de objeto. Nada más:
      sin FRENO ni DERRAPE. Tiene que funcionar en vertical y en horizontal, con multitáctil (girar mientras se
      acelera), sin zoom ni scroll accidental.
      - Marcha atrás / freno: pulsar **los dos botones de girar a la vez**. Anúncialo en la sala.
      - Rescate automático: si un kart está más de 3 s parado, atascado o lejos de la carretera, una animación
        lo recoloca en el punto más cercano de la pista mirando en el sentido correcto (como Lakitu en Mario
        Kart), con una pequeña penalización de tiempo. Va en `sim.mjs` (es física) con hook para el efecto.
      - Truco en el aire: al despegar en una rampa, tocar cualquier botón de girar en el aire hace el truco
        (turbo al aterrizar). Documéntalo en la pantalla de la sala.
      - El protocolo de botones (`i`: s,g,b,d) sigue igual: el móvil manda `b` cuando se pulsan los dos giros y
        `d` siempre 0 (el derrape es automático, siguiente punto).
      - Actualiza README.md y los textos de ayuda de la sala.
      - Comprobación: `GET /play` sirve exactamente 4 elementos `.ctl` (dos con `data-k="left"/"right"`, uno
        `#btn-item`, uno `data-k="g"`) y ninguno con `data-k="d"`/`data-k="b"`; `play.js` no envía `d=1` nunca;
        la simulación pasa con el rescate activo (un bot colocado a propósito fuera de pista vuelve a la
        carretera en < 4 s y termina la carrera); prueba de red intacta.
      - **Hecho el 2026-09-19.** Constantes del rescate al principio de `sim.mjs` (`RESCUE_AFTER` 3 s,
        `RESCUE_TIME` 1,2 s, `RESCUE_FAR` 140 px, `RESCUE_SLOW` 40). Tres condiciones para que te
        recojan: perdido lejos de la carretera, acelerando sin moverte (clavado en un muro) o parado
        fuera de pista; quien se para en la carretera sin tocar nada **no** se recoge, que si no es
        un incordio. Cuatro escenarios nuevos en `check-sim.js` y una comprobación del HTML del mando
        en `check-all.js`. El truco en el aire lo dispara ahora un toque de giro; medido con
        `npm run race` antes y después, los tiempos de los bots no se mueven (± 0,13 s).
- [x] **Derrape automático con 3 niveles.** (Antes de tocar los tiempos, mira el dato de `--stats drift`
      anotado en el punto 0.2: hoy los bots casi nunca llegan al miniturbo.) Sin botón de derrape: si el jugador mantiene el giro en la misma
      dirección más de ~0,35 s a velocidad suficiente (> 55 % de la máxima), el kart entra en derrape solo
      (deslizamiento y chispas). Mientras siga girando en esa dirección acumula nivel: **nivel 1** a ~0,8 s
      (chispas azules), **nivel 2** a ~1,6 s (naranjas), **nivel 3** a ~2,6 s (rosas/moradas). Al soltar el giro
      o cambiar de dirección sale disparado con un turbo proporcional al nivel (por ejemplo 0,6 s / 1,0 s /
      1,6 s de turbo, con estirón del kart y sonido creciente). El nivel debe verse en el móvil (texto/color del
      botón de giro y una vibración corta al subir de nivel: manda un `fx` nuevo) y en la pantalla (color de
      chispas y un brillo bajo el kart). Los bots usan el mismo sistema. Ajusta los tiempos para que en curvas
      normales se llegue al nivel 1-2 y solo en horquillas/curvas largas al 3. Quita cualquier resto del derrape
      manual en pantalla, móvil y README. Los tiempos y turbos son constantes con nombre al inicio de `sim.mjs`.
      - Comprobación: en la simulación, un kart controlado con giro mantenido en una curva larga alcanza nivel
        ≥ 1 y recibe un turbo al soltar (aserto sobre `boostUntil`); un kart que gira 0,2 s no entra en
        derrape; los bots siguen terminando todos los circuitos y sus tiempos de vuelta no empeoran más de un
        10 % respecto a la fase 4 anterior (guarda los tiempos de referencia en `tools/referencia.json`).
      - **Hecho el 2026-09-19 (noche 2).** Los tiempos finales son **0,3 s** para empezar a deslizar y
        **0,5 / 0,9 / 1,4 s** para los niveles, con turbos de 0,6 / 1,0 / 1,6 s: los de arriba
        (0,8/1,6/2,6) se midieron y **no se alcanzaban nunca** en estos circuitos, donde una curva dura
        entre 0,5 y 1,5 s a velocidad de carrera. El giro derrapando se queda como estaba (×1,4): al
        bajarlo los bots perdían la trazada y sus vueltas empeoraban hasta un 16 %. Constantes
        `DRIFT_*` al principio de `sim.mjs`, hook `onDrift(kart, nivel)`, `fx` nuevos al móvil
        (`drift0..3`) y `tools/referencia.json` como vara de medir de la fase 4.

- [x] **Vista en tercera persona por jugador (pantalla dividida).** ⭐ **Lo que más quería el dueño
      (pedido el 2026-09-19 a mediodía); hecho esa misma noche.** En vez de la cámara general del circuito,
      cada persona ve **su kart desde atrás y un poco arriba**, cámara que sigue al kart con suavidad (mira
      algo por delante, se aleja un poco con la velocidad, se agita ligeramente en turbos y golpes, y sigue al
      kart en los saltos). Como todos comparten la tele, la pantalla se divide en paneles: 1 jugador →
      pantalla completa; 2 → dos paneles (lado a lado o arriba/abajo, el que mejor aproveche el 16:9); 3-4 →
      2×2; 5-6 → 3×2; 7-8 → 4×2. Solo las personas tienen panel (los bots no). Cada panel lleva su mini-HUD:
      nombre y emoji, posición, vuelta, objeto que lleva, y avisos («¡Última vuelta!», «¡Truco!»). La cuenta
      atrás y el «¡YA!» se ven en todos los paneles. La sala, la cuenta atrás inicial (puede empezar con una
      vista general y hacer zoom a cada kart) y los resultados pueden seguir usando la cámara general.
      Implementación: `renderer.setScissorTest(true)` + `setScissor`/`setViewport` por panel, una cámara por
      jugador, HUD HTML posicionado sobre cada panel. Rendimiento: 60 fps con 4 paneles y al menos 30 con 8
      en un portátil normal (reduce partículas/decoración por panel si hace falta, y mantén las etiquetas de
      nombre legibles a esa distancia de cámara). Los karts deben seguir siendo reconocibles desde atrás:
      refuerza el color y el emoji del piloto. Actualiza README.md.
      - Comprobación: `screen.js` contiene `setScissorTest`, `setScissor` y `setViewport`; la disposición de
      paneles es una función pura en `public/layout.mjs` con prueba en `tools/check-sim.js` (para n = 1..8
      devuelve rectángulos dentro de [0,1] que no se solapan, cubren la pantalla y respetan la tabla de arriba); la simulación no cambia (fase 4 idéntica);
        anota en CHANGELOG el coste estimado de render por panel y márcalo «pendiente de probar en fiesta».
      - **Hecho el 2026-09-19 (noche 2).** `public/layout.mjs` (puro, probado para n = 1..8),
        cámaras de persecución por persona en `screen.js` (constantes `CHASE_*`), render por paneles
        con scissor/viewport, mini-HUD HTML por panel y el marcador grande sustituido por una chapa
        con el tiempo. El campo de visión se fija a lo ancho (70º) y el vertical sale de la forma del
        panel, para que dos paneles anchos no den ojo de pez. Con más de 4 paneles baja la resolución
        interna. Como no hay pruebas de navegador, `npm test` gana una fase «Pantalla» que comprueba
        que no se usan nombres de three.js inexistentes y que siguen ahí scissor y viewport; y la
        tecla `P` enseña los fps para medirlo en la fiesta.
- [x] **Volante de giroscopio: el móvil se inclina como el mando de la Wii.** ⭐ Segunda cosa
      que más quiere el dueño. Girar con los botones ◀ ▶ es incómodo: se acabaron. El móvil se pone
      **en horizontal, con el giro de pantalla bloqueado**, se sujeta con las dos manos y se **gira
      como un volante**. Solo quedan **dos botones**: **GAS** (mitad derecha, toda la altura) y
      **OBJETO** (mitad izquierda). Nada de freno ni marcha atrás: si te quedas clavado, el rescate
      automático te recoge a los 3 s.
      - La dirección pasa a ser **analógica**: el mando manda `s` como decimal entre −1 y 1 (antes
        era −1, 0 o 1). La simulación ya multiplica por `s`, así que solo hay que dejar de
        redondear y que los bots y el teclado sigan mandando ±1.
      - Cómo se mide el volante: de `deviceorientation` se saca el vector de la gravedad en
        coordenadas del móvil y se compara con el que se guardó al **centrar**; el ángulo entre
        los dos, medido en el plano de la pantalla, es el giro del volante. Así da igual cómo de
        inclinado se sujete el móvil. Zona muerta de unos 5°, tope a unos 35°.
      - **Ojo, esto es lo difícil**: los navegadores solo dan el giroscopio en **contexto seguro**
        (HTTPS). El juego se sirve por `http://192.168.x.x:3000`, así que hoy **no hay sensores en
        ningún móvil**. Hay que servir también por **HTTPS con un certificado propio** generado al
        arrancar (con `openssl`, que viene en macOS; sin dependencias nuevas), y que el QR apunte
        ahí. Cada móvil tendrá que aceptar el aviso del navegador **una vez**. En iPhone hay además
        que pedir permiso con `DeviceOrientationEvent.requestPermission()` desde un botón.
      - **Siempre con respaldo**: si el móvil no da sensores (no hay HTTPS, permiso denegado,
        navegador viejo), el mando enseña los botones ◀ ▶ de ahora y se juega igual. Nadie se queda
        sin jugar en la fiesta por esto.
      - Comprobación: `GET /play` sirve los dos botones grandes (`#btn-item` y `data-k="g"`) y los
        de giro solo dentro del bloque de respaldo; `play.js` manda `s` decimal; la prueba del
        protocolo acepta y reenvía un `s` decimal sin redondearlo; en la simulación, un kart con
        `s = 0,5` gira la mitad que uno con `s = 1`; el servidor sigue sirviendo por HTTP aunque no
        haya certificado, y `npm test` pasa sin `openssl` instalado.
      - **Hecho el 2026-09-19 por la tarde.** Salió tal cual, con un cambio de sitio que conviene
        recordar: las cuentas del volante **no están en `play.js`** sino en `public/volante.js`,
        con el mismo envoltorio que `geom.js` y `tracks.js` (vale como script en el navegador y
        como `require` en Node). Así se pueden comprobar sin navegador, y la fase «Volante» de
        `npm test` las mide contra poses del móvil conocidas: girarlo 40º se mide como 40º tanto
        de pie como tumbado o a 45º. El sentido está fijado ahí: **girar en el sentido de las
        agujas del reloj manda a la derecha**. Constantes: zona muerta 5º, tope 35º, filtro 0,35,
        y `STEER_FIRME = 0.55` en `sim.mjs` (cuánto hay que girar para que cuente como «aguantar
        el giro» y cargue derrape o dispare el truco del aire). El servidor abre HTTPS en
        `PORT + 443` con `.cert/` (ignorado por git), que se rehace solo si cambian las IPs.

- [x] **Circuito Arcoíris: ancho, larguísimo y sin salirse.** ⭐ Pedido por el dueño el 2026-09-19
      por la tarde, después de probar el volante: «es muy complicado, la carretera es superestrecha».
      Carretera de 260 (el doble), quitamiedos en los dos lados de **todo** el recorrido, 12.632 px
      (tres veces los demás), tres rampas, dos lomos, un aro gigante por el que se vuela y un
      castillo con árbol de cristal por debajo del que se pasa.
      - **Hecho el 2026-09-19.** Lo que hay que saber si se tocan circuitos a partir de ahora:
        1. **Cada circuito puede tener su propio mundo** (`world: { w, h }` en `tracks.js`). La
           malla del terreno (`terrenoDe`), los bordes del mapa, los proyectiles, la cámara general,
           la niebla y `check-tracks` van con el mundo del circuito. El tamaño de casilla del
           terreno se estira solo para que la malla tenga siempre ~13.500 casillas.
        2. **Los puntos de control van repartidos a 120 px**. La spline es Catmull-Rom uniforme y
           con espaciados dispares se pasa de frenada justo en las transiciones de recta a curva
           (salían radios de 37 px donde tenía que haber 200). Si editas el trazado, mantén el
           reparto y pasa `npm run check`.
        3. **`theme.props`** planta cosas sobre la carretera en una fracción exacta (el castillo y
           el aro), a diferencia de `theme.decor`, que las reparte al azar fuera de la pista. Dentro
           del grupo, **+X es hacia donde se corre y +Z hacia el lado**.
        4. **`theme.arcoiris`** pinta la carretera con todos los colores en vez de con dos.
        5. Medido: los ocho bots pasan **0,0 s fuera de pista** y la vuelta media es de 30,5 s
           (guardada en `tools/referencia.json`).
      - **No se pudo hacer el looping** que pedía el dueño: la física es plana con altura (`z`), el
        kart nunca se pone boca abajo y permitirlo sería rehacer el motor. Queda el aro por el que
        se vuela. Si alguna vez se quiere de verdad, es un punto de Fase 8, no un retoque.
- [x] **Fuera el caparazón verde, dentro el caracol.** Pedido por el dueño el 2026-09-19: «quita el
      caparazón verde, y mete una habilidad, que sea menos común, que se pare el juego, y elijas a
      quién quieres ir a hacer 75 % lento 3 segundos».
      - **Hecho el 2026-09-19.** Constantes en `sim.mjs`: `SNAIL_SLOW` (0,25), `SNAIL_TIME` (3 s) y
        `SNAIL_CHOICE_TIME` (6 s para elegir). Lo delicado y por qué está así:
        1. **Parar el juego de verdad**: mientras `state.eligiendo` no es null, `update()` no toca
           nada y **`simTime` tampoco avanza**. Si avanzara, los turbos, las estrellas y los trompos
           de todo el mundo se irían consumiendo con el juego parado.
        2. **Nunca se puede quedar colgado**: si se acaba el tiempo o si quien elige se va de la
           partida (`removeKart`), se resuelve solo con el que va justo delante.
        3. **El móvil sigue con dos botones**: la lista de víctimas es una vista a pantalla completa
           que solo sale en ese momento, no un botón nuevo. Protocolo: `pick` (pantalla → móvil) y
           `picked` (móvil → pantalla), con su comprobación en `check-protocol.js`.
        4. **Medir el freno con la distancia recorrida, no con la velocidad**: al frenado le dan
           empujones por detrás y la velocidad da saltos de 98 a 277. La prueba compara cuánto
           avanza en esos 3 segundos, apartando antes a quien lo lanzó.
- [x] **Los nombres tapaban la pantalla dividida.** Pedido por el dueño el 2026-09-19: «los nombres
      de la gente cubren toda la pantalla cuando somos más personas, que sea mucho más pequeño y
      que nos hagan grandes; que la visibilidad del jugador sea mucho más clara».
      - **Segundo repaso, el mismo día**, pedido por el dueño: los nombres van **siempre al mismo
        tamaño** (11 px, no cambian con la distancia) y la habilidad al **ángulo de abajo a la
        izquierda** de cada panel. Y el volante, que se había suavizado de más, vuelve al tope de
        35º de siempre.
      - **Hecho el 2026-09-19. La trampa, para que no se repita:** `screenScale()` mide los sprites
        en píxeles usando `camActiva`, que con paneles es **la cámara del primer panel**. Como la
        escena se dibuja una vez por panel pero el sprite tiene un solo tamaño, un kart lejos de esa
        cámara y pegado a otra salía enorme en el panel del vecino. Con pantalla dividida los
        carteles van con **tamaño fijo en unidades del mundo** (`ETIQ_MUNDO`, `ICONO_MUNDO`,
        `CABEZA_MUNDO`); `screenScale` se queda solo para la cámara general, donde hay una sola.
      - Además: en tu panel no se dibujan tu nombre ni tu objeto, solo las personas llevan nombre
        (los bots no), los de muy lejos se esconden (`ETIQ_LEJOS`) y la cámara va más cerca.
        `carteles()` en `screen.js` decide esto panel a panel, justo antes de cada dibujado.
- [x] **El volante giraba demasiado.** El dueño: «giras un poquito y se te gira totalmente el
      coche». Tope de 35º → **55º** y respuesta **progresiva** en vez de recta (`CURVA` en
      `public/volante.js`): a mitad de recorrido gira un 27 % en vez de un 50 %. La prueba del
      volante comprueba que la respuesta sube siempre y que a mitad de recorrido gira poco.

## Fase 2 — Iterar sobre la versión final

- [x] **Mejorar los circuitos para la vista en tercera persona.** Ahora se juega viendo desde detrás: las
      rampas, paneles turbo, cajas y bumpers deben verse venir con antelación (carteles, arcos, luces); las
      curvas deben tener referencias visuales (bordillos altos, decoración en el exterior) y ninguna curva ciega
      peligrosa. Añade variedad: chicanes, curvas largas para derrapar al nivel 3, algún atajo con riesgo (más
      corto pero estrecho o con salto exigente). Revisa la anchura de la carretera (quizá algo más ancha) y
      valida todo con `npm run check`. Hazlo circuito a circuito, con una entrada en CHANGELOG por cada uno.
      - Comprobación: `npm run check` en verde; en la simulación todos los bots terminan cada circuito y el
        tiempo medio de vuelta queda entre 25 y 60 s; los atajos se validan con un bot que los toma
        (variante de `aiInput` con carril alternativo) y llega antes que uno que no.
      - **Primer subpaso hecho el 2026-09-19 (noche 2)**, el que vale para los cuatro circuitos:
        arcos de aviso cruzando la carretera 200 unidades antes de cada rampa y de cada panel, y
        bordillos altos por fuera de las curvas. Falta el trazado circuito a circuito.
      - ⚠️ **Decisión para el dueño antes de rehacer los trazados (medido, no opinado).** La
        comprobación pide **vueltas de 25-60 s** y hoy son de **9-12 s**: los circuitos miden unos
        4.000 px de trazado y los karts van a ~380 unidades/s. Para una vuelta de 25 s harían falta
        **~9.500 px dentro de un mapa de 1920×1080**, y el validador exige 140 px de separación entre
        tramos y radios de curva de 65 px como mínimo. Cabe, pero solo en forma de **serpiente**
        (unas 6 pasadas de lado a lado), que se parece más a un laberinto que a un circuito de karts.
        Las salidas posibles, de menos a más invasiva:
        1. **Más vueltas** (5-7 en vez de 3): carreras de 60-90 s sin tocar los trazados. Es un
           cambio de un número en la sala y no rompe nada. *Lo más barato con diferencia.*
        2. **Mapa más grande** (`MAP_W`/`MAP_H` en `sim.mjs`, p. ej. 2880×1620): trazados de verdad
           más largos y con sitio para chicanes y atajos. Toca terreno, decoración, cámara general,
           validador y los cuatro circuitos; es el cambio serio.
        3. **Trazados en serpiente** dentro del mapa de ahora: cumple el número, pero el circuito
           pierde gracia y con la cámara de detrás se vuelve mareante.
        **Contestado y hecho para Arcoíris el 2026-09-19 (tarde)**: el dueño eligió la salida 2 (mapa
        más grande), pero **por circuito**, no para todos: cada circuito puede traer su propio
        `world: { w, h }`. Arcoíris se rehízo entero con un script (polígono alrededor de un centro
        con las esquinas redondeadas) y quedó en 15.728 px dentro de 6550x4050, con **38,6 s de
        vuelta media** — dentro de los 25-60 s que pide la comprobación. Falta hacer lo mismo con
        los otros cuatro, que siguen en 9-12 s.
        Mientras no haya respuesta, lo que sí se puede hacer sin decidir nada: chicanes y curvas
        largas para el nivel 3 del derrape reaprovechando la longitud de ahora, y repasar el ancho.
      - ✅ **Terminado la noche del 2026-09-20.** Los **cinco** circuitos están rehechos con el
        molde de Arcoíris (mundo propio por circuito, trazado generado con `tools/traza.js` y
        validado antes de pegarlo), una entrada de CHANGELOG por circuito:
        | circuito | antes | ahora | mundo | ancho | vuelta |
        |---|---|---|---|---|---|
        | Chicle | 3.984 px | 12.832 px | 5400x3600 | 110 → 200 | 9,4 → 29,2 s |
        | Playa Neón | 4.088 px | 13.592 px | 5700x3650 | 110 → 200 | 10,7 → 30,6 s |
        | Volcán Disco | 4.544 px | 13.512 px | 5600x3600 | 110 → 180 | 12,7 → 30,4 s |
        | Luna Loca | 4.080 px | 13.152 px | 5450x3650 | 110 → 220 | 10,9 → 28,3 s |
        | Arcoíris | (ya estaba) | 15.936 px | 6650x4100 | 260 | 33,5 s |
        Todos con **cuestas** (`relieve`), dos o tres saltos, el doble de cajas y paneles, y
        quitamiedos por fuera de las curvas. `npm run check` en verde, los siete bots terminan en
        los cinco y casi no se sale nadie. La vuelta de 25-60 s la vigila ahora `npm test`, y que
        el **nivel 3 de derrape** se alcance, también (con un conductor que sostiene el volante:
        con bots no sale ni uno, ni antes ni ahora).
      - ⏭ **Lo único que no se ha hecho: el atajo con riesgo**, y está medido, no abandonado. La
        idea era una rampa que volara por encima de una curva. Con la física de ahora un kart vuela
        **entre 270 y 490 px** (`2·v²·(alto/largo)/gravedad`, con el turbo de salto incluido), y en
        los cinco circuitos **no hay ni una curva que se pueda cortar con ese alcance ganando algo**
        (se buscó a lo largo de todo el trazado, tirando una recta desde cada punto: cero sitios con
        ahorro positivo). No es mala suerte, es la consecuencia de lo que pidió el dueño: curvas
        abiertas y carretera ancha, donde la cuerda ya es casi la recta. Para tener atajos de verdad
        hacen falta **caminos alternativos en la simulación** (hoy `nearest` + `lat` define una sola
        carretera, sin ramas). Se apunta en el punto de Fase 6, que ya existía.
      - Nota para quien lo haga: **la simulación no sabe de caminos alternativos** (`nearest` + `lat`
        define la carretera, no hay ramas). Un «atajo con riesgo» se puede hacer con una **rampa que
        salte por encima de una curva**: si llegas rápido, caes más adelante y el contador de
        progreso ya lo acepta (`PROGRESS_JUMP_WAIT`); si llegas lento, caes al césped o al agua y
        pierdes más de lo que ganabas.
- [x] **Afinar las habilidades (objetos).** Con la nueva vista y el derrape automático, equilibra: duración y
      potencia de turbo/estrella/rayo, velocidad y homing de los caparazones, distancia de lanzamiento,
      probabilidades por posición (el último debe remontar pero el primero no debe sentirse injusto) y feedback
      en pantalla y móvil (vibración, flash, sonido) de cada objeto. Que funcione igual de bien con 2 y con 8
      corredores. Anota en CHANGELOG los valores antes/después y el porqué.
      - Comprobación: la simulación registra por carrera cuántos objetos de cada tipo salen por posición y
        cuántos golpes recibe cada kart; asertos: el líder nunca recibe rayo dos veces en 30 s, nadie
        acumula más de 3 golpes en 10 s (inmunidad), el reparto por posición sigue las probabilidades
        declaradas (±10 %), y en 8 carreras simuladas de 8 bots el último de la parrilla termina alguna vez
        en el podio.
      - **Hecho el 2026-09-19 (noche 2).** Medido primero: el reparto y los aciertos (rojo 71 %,
        plátano 67 %, verde 25 %) ya estaban sanos, así que **no se ha tocado ninguna potencia ni
        duración**; lo que faltaba eran dos reglas de justicia: inmunidad al rayo de 30 s
        (`LIGHTNING_IMMUNITY`) y 2,5 s de inmunidad tras un golpe (`HIT_IMMUNITY`, antes 1,5), con
        lo que la peor racha baja de 3 golpes a 2 en 10 s. `stats.itemsByPos` y `kart.hitsTaken`
        nuevos, cinco escenarios en `check-sim.js` y avisos `fx` `zap`/`star` al móvil. Lo que sigue
        sin tocar y quizá pida la fiesta: la velocidad y el homing de los caparazones.
- [x] **Regresión de fase.** Repasa que rescate, derrape, paneles, objetos y pantalla dividida siguen
      funcionando juntos: simulación + `npm test` + una lista de comprobación manual en `CHANGELOG.md` para la
      próxima fiesta.
      - **Hecho el 2026-09-19 (noche 2).** Escenario «en una carrera normal se disparan todos los
        sistemas a la vez» (carrera entera con una persona a la que se saca al césped: exige saltos,
        paneles, cajas, objetos, golpes, rescate y turbo de derrape en la misma carrera) y lista de
        ocho comprobaciones para la fiesta en `CHANGELOG.md`.

## Fase 3 — Intuitivo y simple (que cualquiera juegue a la primera)

- [x] **Modo fácil por jugador.** Un interruptor en la sala del móvil («Modo fácil»): el kart acelera solo
      (GAS pasa a ser turbo suave opcional) y una asistencia de dirección leve lo atrae hacia el centro de la
      carretera. Se recuerda en el móvil. Comprobación: en la simulación un kart con «modo fácil» y sin
      entradas termina la carrera solo (más lento que un bot); el mensaje `hello` lleva el flag y la pantalla lo
      muestra en la sala.
      - ⏭ **Saltado a propósito la noche del 2026-09-19**: el interruptor va en la **sala del móvil**
        y el dueño estaba rehaciendo `play.html`/`play.js` esa misma tarde para el volante de
        giroscopio. Hacerlo a la vez era pisarse. Retomarlo cuando el volante esté dentro.
      - ✅ **Hecho la noche del 2026-09-20**, ya con el volante dentro. Botón 🦺 en la sala del móvil
        (se recuerda en `localStorage`), el flag viaja en `hello` (un mando con la página cargada de
        antes no lo manda y se queda en normal), el servidor lo reparte en `lobby`/`join` y la tele
        lo enseña con una etiqueta en la sala. En la simulación: `EASY_AYUDA` 0,7 (la ayuda manda
        cuando tú no tocas el volante; girando a tope mandas tú), `EASY_MIRA` 22 muestras por
        delante y `EASY_MAX` 0,94 si no pisas el gas, para que nadie lo encienda buscando ir más
        rápido. Medido sin tocar el mando: termina los cinco circuitos, siempre por detrás del bot.
        Escenario en `check-sim.js` y cuatro comprobaciones en `check-protocol.js`.
- [x] **Aviso «¡Vas al revés!».** Si un kart avanza en sentido contrario más de 1,5 s: cartel en su panel,
      flecha grande hacia la dirección correcta y vibración larga en el móvil. Comprobación: simulación con un
      kart forzado al revés dispara el hook `onWrongWay` y deja de dispararlo al girar.
      - **Hecho el 2026-09-19 (noche 2).** Con `WRONG_WAY_TIME` (1,5 s) y `WRONG_WAY_SPEED` (60) en
        `sim.mjs`; cartel rojo parpadeante en el panel, sonido y vibración larga en el móvil (`fx`
        `wrong`/`wrong0`). No cuenta en trompos, rescates ni casi parado.
- [ ] **Salida perfecta.** Pulsar GAS justo en el «¡YA!» (ventana de 0,4 s) da un turbo de salida; pulsarlo
      demasiado pronto hace patinar 0,8 s. Cuenta atrás con vibración en cada número. Comprobación: simulación
      con entradas programadas: GAS en la ventana → turbo; GAS 1 s antes → patinazo.
- [x] **Calentamiento en la sala.** Mientras el anfitrión no pulsa EMPEZAR, los karts ya están en la pista
      (zona de pruebas junto a la meta) y se pueden conducir para aprender los botones. Comprobación: la
      simulación admite fase «calentamiento» sin vueltas ni objetos; al empezar la carrera todos vuelven a la
      parrilla.
      - ✅ **Hecho la noche del 2026-09-20.** Fase `warmup` en `sim.mjs` (`sim.warmup({entries,
        trackIndex})`): se conduce, se choca y te recogen si te clavas; ni vueltas, ni cajas, ni
        objetos, ni clasificación. Quien entra nuevo no mueve de su sitio a quien ya conducía, y
        cambiar de circuito devuelve a todos a la parrilla nueva. En el móvil, botón **«🕹️ Probar
        el mando»** en la sala y «↩ sala» para volver. En la tele la sala sigue puesta (el anfitrión
        tiene que poder empezar) y —esto con cuidado— **el desfile de karts del dueño se mantiene**:
        mientras nadie toca el mando se ve la sala de siempre, y en cuanto alguien se mueve la
        cámara se va con los karts. Escenario en `check-sim.js` y la fase en `check-protocol.js`.
- [ ] **Ayuda la primera vez.** En el móvil, una sola pantalla con dibujos de los 4 botones y qué hacen (giro
      mantenido = derrape; dos giros = marcha atrás; giro en el aire = truco). Se muestra una vez y hay un botón
      «?» para volver a verla. Comprobación: `GET /play` contiene la ayuda y `play.js` guarda el flag en
      `localStorage`.
      - ⏭ **Saltado la noche del 2026-09-20**: el dueño estaba despierto a las 3:52 de la mañana
        tocando `play.html` y `play.js` (la pantalla de elegir personaje con retratos). Este punto
        vive entero en esos dos archivos, así que hacerlo a la vez era pisarse. Se retoma en cuanto
        él lo suelte; no hay nada que decidir, solo hacerlo.
- [ ] **Móvil legible de un vistazo.** Posición y vuelta enormes en la barra de estado, fondo del móvil que
      cambia de color con el nivel de derrape y con el turbo, borde rojo mientras estás girando/golpeado.
      Comprobación: `play.js` reacciona a los campos de `st` y `fx` con clases CSS (prueba estática).
      - ⏭ **Saltado la noche del 2026-09-20**: el dueño estaba despierto a las 3:52 de la mañana
        tocando `play.html` y `play.js` (la pantalla de elegir personaje con retratos). Este punto
        vive entero en esos dos archivos, así que hacerlo a la vez era pisarse. Se retoma en cuanto
        él lo suelte; no hay nada que decidir, solo hacerlo.

## Fase 4 — Sensación de juego

- [x] **Cámara con carácter.** FOV que se abre con el turbo, sacudida corta en golpes y aterrizajes fuertes,
      pequeño «hit-stop» (20-40 ms) en choques, la cámara mira más lejos a más velocidad. Comprobación:
      parámetros como constantes; simulación intacta; «pendiente de probar en fiesta».
      - ✅ **Hecho la noche del 2026-09-20.** El FOV en turbo ya estaba (`CHASE_FOV_BOOST`). Nuevo:
        la **sacudida es de cada uno** (antes un golpe a cualquiera temblaba en los ocho paneles;
        `onShake` ya traía el kart y la tele no lo usaba), **sacudida al aterrizar** medida desde la
        tele con la velocidad de caída (`CAM_SACUDIDA_CAIDA_FUERTE`), **hit-stop de 30 ms** en
        golpes y rayo (`CAM_HITSTOP`, no en los quitamiedos) y la cámara **mira hasta 170 unidades
        más lejos** a tope de velocidad (`CHASE_AHEAD_SPEED`). Todo en constantes al inicio de
        `screen.js` y `public/sim.mjs` sin tocar ni una línea.
- [x] **Estelas y marcas.** Estelas de velocidad en turbo, marcas de neumático en derrape (decal que se
      desvanece), humo al aterrizar. Presupuesto: sin bajar de 60 fps con 4 paneles. Comprobación: partículas
      con tope máximo por panel (constante) y sin fugas (contador de instancias vivas acotado en una prueba de
      la simulación con hook de partículas).
      - ✅ **Hecho la noche del 2026-09-20.** Los tres efectos salen del **saco de partículas que ya
        había** (900 como mucho, un solo dibujado), así que no añaden **ni una llamada de dibujo**
        más por panel: las marcas de neumático son partículas quietas y estiradas pegadas al suelo
        (opción `ang`/`largo` nueva: se orientan en vez de dar volteretas), la estela son rayas
        largas por detrás y el humo de aterrizaje sale de la velocidad de caída, mirada desde la
        tele. Fuga no puede haber (el saco es un anillo fijo), así que lo que se vigila es el
        **presupuesto**: escenario nuevo en `check-sim.js` que mide cuántas pediría una carrera de
        8 karts (160 de 900) y la cuenta del peor caso está escrita junto a las constantes (≈700).
      - ⏳ **Falta medirlo en la fiesta**: la tecla `P` con 4 y 8 paneles. Si baja de 60, lo primero
        que hay que subir es `MARCA_CADA` (menos marcas).
- [ ] **Sonido de motor por kart.** Oscilador por kart con tono según velocidad y turbo, mezclado sin saturar
      con 8 karts (compresor). Comprobación: código sin errores, tecla `M` silencia todo, volumen global
      constante; «pendiente de probar en fiesta».
- [ ] **Música sintetizada.** Tema alegre en la sala, tema rápido en carrera, versión acelerada en la última
      vuelta y fanfarria de podio; todo generado con WebAudio (sin archivos). Tecla `M` para silenciar.
      Comprobación: código sin errores; «pendiente de probar en fiesta».
- [ ] **Callouts.** Carteles breves en el panel del jugador: «¡PRIMERO!», «¡Adelantamiento!», «¡Nivel 3!»,
      «¡Última vuelta!», «¡Golpe!». Comprobación: hooks de la simulación (`onOvertake`, `onLeader`) con prueba.
- [ ] **Vibraciones con significado.** Patrones distintos en el móvil para golpe, turbo, subir de nivel de
      derrape, caja cogida, salida, meta. Comprobación: tabla de patrones en `play.js` y `fx` con `kind` para
      cada evento.

## Fase 5 — Habilidades

- [ ] **Reequilibrio con datos.** Usa la simulación para medir: golpes por kart, remontadas, tiempo medio con
      turbo, y ajusta valores. Deja en CHANGELOG una tabla antes/después. Comprobación: asertos de la Fase 2
      siguen pasando con los nuevos valores.
- [ ] **Aviso de caparazón rojo entrante.** Icono parpadeante y vibración en el móvil del objetivo desde que se
      lanza; puede esquivarse saltando en una rampa o cubrirse soltando un plátano justo detrás. Comprobación:
      hook `onIncoming` en simulación; un kart con plátano detrás bloquea el rojo.
- [ ] **Nuevos objetos**, uno por commit: **bomba** (se lanza hacia delante, explota a los 2 s y empuja a los
      karts cercanos con salto), **triple plátano** (tres seguidos), **escudo/burbuja** (bloquea un golpe, 8 s),
      **imán** (atrae cajas y monedas 6 s), **caparazón azul** (raro, va al líder, con aviso a todos).
      Comprobación: cada objeto tiene su prueba en la simulación (efecto sobre karts de prueba) y aparece en
      el reparto por posición donde toca.
- [ ] **Tope de proyectiles.** Máximo de proyectiles simultáneos en pista para que no sea un caos con 8
      jugadores. Comprobación: aserto en simulación.

## Fase 6 — Mecánicas

- [ ] **Rebufo.** Ir justo detrás de otro kart 1 s da un empujón de velocidad al salir. Comprobación:
      simulación con dos karts en línea → el de detrás supera la velocidad máxima brevemente.
- [ ] **Monedas.** Monedas por la pista (+2 % de velocidad máxima cada una, hasta 10; se pierden 3 al recibir un
      golpe). Comprobación: simulación cuenta monedas y velocidad máxima resultante.
- [ ] **Catch-up suave para personas.** Los rezagados (no el líder) reciben objetos algo mejores y un 3-5 %
      más de velocidad máxima según la distancia al líder. Comprobación: simulación mide la dispersión final
      con y sin catch-up.
- [ ] **Trucos con estilo.** Turbo del truco proporcional al tiempo en el aire (mínimo 0,4 s), con nombres en
      pantalla. Comprobación: prueba en simulación con distintos tiempos de vuelo.
- [ ] **Atajos con riesgo** en al menos dos circuitos (Fase 2 los define; aquí se pulen con obstáculos).
      - ⚠️ **Medido la noche del 2026-09-20**: con los circuitos rehechos no sale con una rampa. Un
        kart vuela 270-490 px y no hay ninguna curva de los cinco circuitos que se pueda cortar por
        el aire ganando terreno. Para esto hace falta que la simulación entienda **ramas** (hoy
        `nearest` + `lat` define una sola carretera): un atajo sería un segundo trazado corto con su
        entrada y su salida, y el contador de progreso tendría que aceptar las dos. Es un cambio de
        `sim.mjs`, no de `tracks.js`, y conviene decidirlo con el dueño antes de meterse.

## Fase 7 — Gráficos

- [ ] **Sombras reales de los karts** si el rendimiento lo permite (mapa de sombras 2048 solo sobre karts;
      medir con `renderer.info` y dejar un interruptor). Comprobación: código sin errores; «pendiente de probar
      en fiesta» con instrucciones de comparar fps.
- [ ] **Agua y lava animadas** (vértices ondulando, brillo emisivo pulsante) y nubes con sombra suave en el
      suelo. Comprobación: sin errores; presupuesto de triángulos anotado.
- [ ] **Culling e instancing de la decoración** para la pantalla dividida (misma escena renderizada hasta 8
      veces). Comprobación: contador de draw calls por frame anotado antes/después en CHANGELOG.
- [ ] **Calidad adaptativa.** Si los fps caen por debajo de 50 durante 3 s, reduce partículas y decoración; si
      suben de 58, restaura. Comprobación: lógica como función pura con prueba.
- [ ] **Karts personalizables.** Color secundario y gorro/accesorio elegidos en el móvil, visibles en el kart.
      Comprobación: `hello` lleva la elección, la pantalla la muestra en la sala.
- [ ] **`nearest()` con ventana local.** Buscar la muestra más cercana desde el último índice conocido
      ±80 muestras y solo hacer la búsqueda completa si la distancia sale grande (hoy es un recorrido de
      ~500-900 muestras varias veces por kart y tick). Comprobación: fase 4 con los mismos tiempos que antes
      (determinismo) y carrera más rápida (`npm run race -- --bench`).
- [ ] **Piloto con vida.** El emoji/cabeza se inclina en curvas, se encoge con el rayo, mira atrás cuando viene
      un rojo. Comprobación: sin errores; «pendiente de probar en fiesta».

## Fase 8 — Circuitos

- [ ] **5.º circuito «Puente Loco»**: cruce a distinto nivel (puente sobre otra parte de la pista) o túnel.
      Requiere que la altura de la carretera y la búsqueda de muestra más cercana tengan en cuenta la altura
      (evitar que la física salte al tramo de abajo). Comprobación: `npm run check` ampliado para cruces; bots
      terminan.
- [ ] **6.º circuito «Nieve»** con tramos de hielo (menos agarre, derrape más largo). Comprobación: propiedad de
      superficie por tramo en `tracks.js`; simulación.
- [ ] **7.º circuito «Ciudad Neón»** nocturno con luces. Comprobación: `npm run check`; bots terminan.
- [ ] **Obstáculos móviles**: bola de lava que rueda, olas que barren la playa, barreras giratorias.
      Comprobación: en simulación, los bots los esquivan o los sufren sin quedarse atascados.
- [ ] **Variantes inversas** de cada circuito (sentido contrario) como circuitos extra. Comprobación:
      `check-tracks` sobre las variantes; bots terminan.
- [ ] **Presentación del circuito**: vuelo de cámara de 4 s con el nombre antes de la cuenta atrás.
      Comprobación: fase «presentación» en la simulación (sin física) y en pantalla.

## Fase 9 — Modos

- [ ] **Torneo**: 3 carreras seguidas (circuitos al azar o elegidos), puntos por posición, tabla entre
      carreras y podio final. Comprobación: la simulación encadena 3 carreras y calcula la tabla.
- [ ] **Batalla de globos**: arena, cada kart con 3 globos, se los explotan con objetos. Comprobación:
      simulación de batalla termina con un ganador.
- [ ] **Contrarreloj con fantasma**: un jugador contra su mejor vuelta grabada (guardada en la tele).
      Comprobación: grabación/reproducción de entradas en la simulación reproduce la misma vuelta.
- [ ] **Equipos** (2 vs 2, 4 vs 4) con suma de puntos. Comprobación: tabla por equipos en simulación.

## Fase 10 — Fiesta y social

- [ ] **Premios y estadísticas** de fin de carrera: mejor vuelta, más saltos, más golpes dados/recibidos, rey
      del derrape. Comprobación: la simulación produce las estadísticas.
- [ ] **Podio animado** con los tres primeros karts y confeti; los demás aplauden. «Pendiente de probar en
      fiesta».
- [ ] **Historial de victorias** entre sesiones (guardado en la tele) y racha del campeón. Comprobación:
      función pura con prueba.
- [ ] **Revancha por votación**: cualquiera puede pulsar «Revancha» en el móvil; con mayoría, empieza.
      Comprobación: prueba de red con varios clientes votando.
- [ ] **QR pequeño durante la carrera** para que los que llegan tarde entren en la siguiente. Comprobación:
      `GET /` contiene el QR fuera de la sala.
- [ ] **Emoji libre** y nombre recordado en el móvil. Comprobación: `hello` acepta cualquier emoji válido y el
      servidor lo valida.

## Fase 11 — Robustez, rendimiento y accesibilidad

- [ ] **Entradas con marca de tiempo y suavizado** para redes lentas (el móvil manda `t`; la pantalla
      interpola). Comprobación: prueba de red con retardo artificial.
- [ ] **Consumo del móvil**: menos redibujados, `wakeLock` cuando esté disponible, envío de estado solo si
      cambia. Comprobación: mensajes `st` por segundo acotados en la prueba de red.
- [ ] **Daltonismo**: cada kart lleva además un icono/forma distintivo y el HUD no depende solo del color.
      Comprobación: prueba estática de que cada personaje tiene icono único.
- [ ] **Texto grande y vibración configurable** en el móvil. Comprobación: ajustes guardados en
      `localStorage`.
- [ ] **Versión del protocolo y recarga de móviles antiguos.** Campo `v` en `hello`; si no coincide con la
      del servidor, responde `reload` y el móvil se recarga solo (un móvil con la página vieja tras una
      actualización nocturna no debe romper la partida). Comprobación: en `check-protocol.js`, un `hello` con
      `v` antigua recibe `reload`.
- [ ] **Pantalla recargada en mitad de carrera.** La pantalla nueva recibe `init` con fase `race`, avisa
      «carrera perdida, volvemos a la sala» y manda a todos a la sala. Comprobación: en `check-protocol.js`,
      al reconectar la pantalla los móviles reciben `phase: lobby`.
- [ ] **Ritmo de mensajes y salud de la red.** El móvil manda como mucho 30 `i`/s, el servidor descarta
      ráfagas y el móvil muestra «red: buena/regular/mala» con un ping cada 2 s. Comprobación: 200 mensajes
      seguidos no bloquean al servidor (< 50 ms de respuesta) y a la pantalla solo llega el último estado.
- [ ] **Errores no capturados en la pantalla.** `window.onerror`/`unhandledrejection` muestran «algo ha
      fallado: pulsa F5» sin dejar la tele en negro. Comprobación: el manejador existe (estática); GET `/` en
      verde.
- [ ] **Regresión final de fase**: `npm test` completo, simulación de 8 carreras seguidas sin fugas de memoria
      (contador de objetos vivos estable).
