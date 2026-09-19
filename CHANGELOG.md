# Historial de cambios

Cada entrada dice qué cambió y cómo probarlo en la fiesta. Las entradas del agente nocturno
llevan la fecha en que se hicieron.

## 2026-09-19 — Mando de cuatro botones y rescate automático (Fase 1)

- **Qué cambió en el móvil**: el mando se queda con **cuatro botones grandes**: la mitad izquierda
  es ◀ y ▶ (cada uno la mitad del ancho y toda la altura, para girar sin mirar), y la derecha lleva
  OBJETO arriba y GAS abajo, más grande. Se acabaron los botones de FRENO y DERRAPE. Para ir marcha
  atrás se pulsan **los dos botones de girar a la vez** (los botones se ponen rojos para que se vea).
- **Trucos**: en las rampas, ahora se hace el truco tocando un botón de girar mientras se vuela
  (antes era el botón de derrape, que ya no existe). Turbo al aterrizar, igual que antes.
- **Rescate automático**: si un kart lleva 3 segundos perdido lejos de la carretera, clavado contra
  algo o parado fuera de pista, se le recoge y se le deja en el punto más cercano de la carretera
  mirando en el sentido correcto. La penalización es el segundo largo que dura la maniobra. Si te
  paras a propósito en medio de la pista sin tocar nada, nadie te molesta. El móvil vibra y avisa.
- **Ojo**: el derrape todavía **no es automático** (eso es el punto siguiente de la hoja de ruta).
  Esta noche el derrape de las personas queda desactivado: el kart gira normal y los miniturbos solo
  salen de los paneles, las rampas y los objetos. Los bots siguen derrapando como siempre.
- **Cómo probarlo**: `npm start`, entrar con dos móviles y mirar que los cuatro botones se pulsan
  bien con los pulgares en horizontal y en vertical, que girando con los dos a la vez se va marcha
  atrás, y que al salirte del circuito te devuelven a la pista. **Pendiente de probar en fiesta**:
  el tamaño de los botones y si 3 segundos es demasiado (o poco) para que te recojan.

## 2026-09-19 — Ocho móviles de mentira prueban la fiesta (punto 0.3)

- **Qué cambió**: `npm test` tiene una fase nueva que arranca el servidor de verdad y conecta una
  pantalla y ocho móviles falsos por WebSocket: entrar en la sala, sala llena, personaje repetido,
  ajustes solo del anfitrión, empezar, 30 pulsaciones de botón seguidas, usar objeto, avisos a un
  móvil concreto, relevo de anfitrión al desconectarse, volver con el token y salir. 25
  comprobaciones en 4,5 segundos.
- **Fallo gordo arreglado**: cualquier móvil podía **hacerse pasar por la pantalla** mandando un
  mensaje `screen`. El servidor le daba el relevo y la tele se quedaba inactiva con el aviso de «se
  ha abierto la pantalla en otro sitio», es decir, adiós a la carrera. Ahora un móvil que ya está
  jugando no puede declararse pantalla.
- **Cómo probarlo**: `npm test` (la última fase, «Móviles de mentira»). En la fiesta no se nota nada
  nuevo; lo que se nota es que ya no se puede tirar la pantalla desde un móvil.

## 2026-09-19 — `npm run race`: ver las carreras por consola (punto 0.2)

- **Qué cambió**: nueva herramienta `npm run race`. Corre carreras de bots sin navegador y saca una
  tabla por carrera (posición, tiempo, mejor vuelta, objetos usados, golpes dados y recibidos, saltos,
  trucos, paneles, tiempo fuera de pista y por el aire), con opciones `--track`, `--laps`, `--bots`,
  `--seed`, `--runs`, `--verbose` (registro de todo lo que pasa, con tiempo y posición),
  `--stats items|drift|speed` (histogramas) y `--json`. La simulación aprende a decir **quién** ha
  dado cada golpe (hook `onHit`), que es lo único que le faltaba para estas cuentas.
- **Qué gana la fiesta**: a partir de ahora los cambios de objetos, derrape o circuitos se pueden
  equilibrar con números. El primer dato ya dice algo: los bots casi nunca mantienen el derrape lo
  bastante como para que salte el miniturbo (queda anotado en `IDEAS.md`, punto 0.2).
- **Cómo probarlo**: `npm run race -- --track all --runs 3`, o `npm run race -- --help`. No cambia
  nada de lo que se ve en la tele: el juego se juega exactamente igual que ayer.

## 2026-09-19 — La simulación sale de la pantalla (punto 0.1)

- **Qué cambió**: la física del juego (karts, saltos, bumpers, paneles, objetos, bots, vueltas y
  clasificación) se ha mudado de `public/screen.js` a `public/sim.mjs`, un módulo que funciona sin
  navegador. `screen.js` se queda con lo que se ve y se oye y le engancha la simulación por «hooks».
  Es una mudanza, no una reforma: no se ha tocado ni un número ni una condición de la física, así que
  el juego tiene que sentirse exactamente igual que antes.
- **Qué gana la fiesta**: `npm test` corre ahora carreras enteras de bots en los cuatro circuitos
  (fase «Carrera sin pantalla») y comprueba que todos terminan, que nadie se atasca ni se sale del
  mapa, que el orden de llegada cuadra y que la misma semilla da la misma carrera. A partir de
  ahora, cualquier cambio de físicas u objetos se puede comprobar antes de la fiesta.
- **Cómo probarlo**: `npm ci && npm test` (todo en verde, con la fase 4 al final). Y en la tele,
  `npm start`: sala, cuenta atrás, carrera con bots (tecla `K` e `Intro` para jugar con el teclado),
  objetos, plátanos, caparazones, meta y resultados. **Pendiente de probar en fiesta**: al ser una
  mudanza grande, en la primera fiesta tras este cambio conviene jugar con atención y avisar si algo
  se siente distinto (velocidad, derrape, golpes, saltos) o si algún móvil deja de recibir avisos.
- **De regalo**: las pruebas han sacado a la luz un fallo viejo de los bots (a veces uno se da la
  vuelta tras un golpe y corre en dirección contraria unos segundos). Queda anotado en `IDEAS.md`,
  en «Bugs conocidos»; `npm test` lo avisa con un ⚠ pero no lo da por fallo.

## 2026-09-19 — Versión inicial 3D

- Juego completo: servidor + pantalla 3D (three.js) + mando de móvil con QR.
- 4 circuitos (Chicle, Playa Neón, Volcán Disco, Luna Loca con gravedad baja), rampas, lomos,
  paneles turbo, bumpers, trucos en el aire, objetos (champiñón, plátano, caparazones, estrella,
  rayo), bots, derrape con miniturbo, clasificación y podio.
- Cómo probar: `npm start`, abrir http://localhost:3000, pulsar `K` e `Intro` para correr con el
  teclado contra bots; escanear el QR con un móvil para probar el mando.
