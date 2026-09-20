# Kart Party — guía para trabajar en este repo

Juego de karts 3D para fiestas: **la tele es la pantalla** (un navegador en un ordenador) y **cada
móvil es un mando** (una página web). Todo es JavaScript sin frameworks ni bundlers; la única
dependencia de render es three.js, servida desde `node_modules` en `/vendor/`.

## Cómo está montado

- `server.js` — servidor Node (http + `ws`): sirve `public/`, genera el QR (`qrcode`), sirve three.js
  y hace de **relé WebSocket** entre móviles y pantalla. No contiene lógica de juego.
- `public/sim.mjs` — **toda la simulación** (módulo ES, sin navegador): física (saltos, gravedad,
  bumpers, paneles turbo), objetos, bots, vueltas y clasificación. `createSim({ geom, trackDefs,
  hooks, random })` devuelve la carrera; cada efecto visible o audible sale por un hook de
  `DEFAULT_HOOKS` y las mallas de three.js viven en la ranura `view` de cada objeto, que la
  simulación nunca lee. Todo su azar pasa por `random`, así que con una semilla las carreras se
  repiten clavadas.
- `public/index.html` + `public/screen.js` — la pantalla de la tele (módulo ES, three.js). Monta la
  simulación y le pone lo que se ve y se oye: mundo 3D, modelos de kart, partículas, cámara, HUD,
  audio sintetizado y la conexión con los móviles. La sala y los resultados son HTML encima del canvas.
- `public/play.html` + `public/play.js` — el mando del móvil: botones táctiles, sala, estado de carrera.
- `public/torneo.mjs` — las cuentas del **modo torneo** (puntos por puesto, tabla con subidas y
  bajadas, votación del circuito siguiente). Sin navegador y probado en `npm test`; el hilo de la
  sesión (cuándo se enseña qué) está en `screen.js`.
- `public/tracks.js` — circuitos (puntos de control, `relieve` con el sube y baja de la vuelta,
  rampas y lomos, cajas, paneles, bumpers, tema de colores). `tools/traza-arcoiris.js` genera el
  trazado de Arcoíris (polígono con las esquinas redondeadas) y lo valida antes de pegarlo.
  `public/geom.js` — spline Catmull-Rom y remuestreo (compartido con Node).
- `tools/check-tracks.js` — validador de circuitos. `tools/check-sim.js` — carreras de bots sin
  navegador (fase 4 de `npm test`), con una lista de «escenarios» a la que cada punto nuevo suma el
  suyo. `tools/check-protocol.js` — el protocolo con una pantalla y la sala llena de móviles de mentira (fase 5).
  `tools/sim-race.js` — `npm run race`: carreras por consola con tabla, registro y histogramas, para
  equilibrar con datos (`npm run race -- --help`). `tools/check-all.js` — comprobación completa
  (`npm test`).
- `public/modelos/*.glb` — los modelos 3D (kart, plátano, caparazón, las **cabezas de los siete
  personajes**, en `cabezas.glb`: un objeto por personaje, con su nombre sin artículos ni espacios, y
  las **montañas** de `montanas.glb`: seis tipos, uno por objeto, que la tele reparte con mallas
  instanciadas y tiñe con el color del bioma). **No se editan a mano**: los
  genera `tools/blender/*.py` con Blender sin abrir ventana (`blender --background --python
  tools/blender/kart.py`, `objetos.py`, `personajes.py`, `montanas.py`). Regla de los modelos: los materiales se llaman por su papel, no por su
  color — `Carroceria` lleva el color del personaje y `Detalle` su acento; el resto (`Oscuro`,
  `Metal`, `Goma`, `Piel`, `Claro`) los pinta `COLOR_MATERIAL` en `screen.js`. Si un modelo falta,
  la tele monta el kart de cajas de siempre, así que la fiesta nunca se queda sin karts.
- `public/visor.html` — herramienta de desarrollo para ver un modelo de cerca con la luz del juego:
  `http://localhost:3000/visor.html?m=kart.glb` (`?ang=90` lo gira, `?girar=0` lo para).
- `Abrir Kart Party.command` — lanzador de doble clic para macOS.

Los **personajes** (`CHARS` en `sim.mjs`) los conoce solo la pantalla: se los manda al servidor en
`screen` (junto a los circuitos) y el servidor los reparte a los móviles en `roster` y `lobby`, para
que la pantalla de elegir del móvil enseñe los que hay de verdad. `public/play.js` guarda una copia
como respaldo para el rato en que la pantalla aún no se ha conectado. Los **retratos** que se ven al
elegir (`public/modelos/retratos/*.png`) los genera `tools/blender/personajes.py` junto a las cabezas.


Protocolo móvil ↔ servidor ↔ pantalla (JSON por WebSocket): `hello/welcome` (con `easy`: el **modo fácil** por jugador, que un mando viejo no manda y se queda en normal), `lobby`, `roster`,
`phase`, `i` (botones: s analógico de -1 a 1, g, b, d), `use`, `start`, `again`, `set`, `st`
(estado al móvil), `fx`, `spectate`, `vaciar` (la tele echa a todos), `kicked` (al móvil: te han
echado, deja de reconectarte solo), `pick` (al móvil: elige víctima del caracol), `picked` (del
móvil: a quién ha elegido), `votar` (al móvil: elige circuito entre carreras del torneo) y `voto`
(del móvil: qué circuito). Si cambias un mensaje, cambia las tres partes, añade su comprobación en
`tools/check-protocol.js` y mantén compatibilidad con móviles que lleven la página cargada de antes
(recarga automática no hay).

## Comprobar que no se rompe nada

```bash
npm ci
npm test        # sintaxis de todos los archivos + validador de circuitos + arranque real del servidor
```

`npm test` tiene que pasar antes de subir nada a `main`. La física se puede comprobar a ciegas: la
fase 4 corre carreras de bots dentro de `public/sim.mjs` y cada cambio de juego debería añadir su
escenario a `tools/check-sim.js`. Lo que sigue sin prueba automática es el navegador: cuando toques
`screen.js`, revisa con cuidado que el código sea válido como módulo ES y que no uses APIs de
three.js que no existan en la versión instalada (`node_modules/three/package.json`).

## Reglas

- La interfaz y los textos están en **español** (tono cercano, sin tecnicismos).
- Sin dependencias nuevas salvo que sean imprescindibles y ligeras; nunca subas `node_modules`.
- La fiesta se juega en una WiFi local sin internet: nada de CDNs ni servicios externos en tiempo de juego.
- Mantén el rendimiento: la pantalla debe ir a 60 fps en un portátil normal (ojo con partículas,
  sombras y mallas grandes). **Siete personajes, siete sitios**: `MAX_KARTS` (sim.mjs) manda, y el
  servidor y las pruebas lo leen de ahí en vez de escribir el número a mano.
- Las físicas son exageradas pero controlables: los cambios de sensación (velocidad, gravedad, giro)
  deben ser pequeños y justificados. Constantes principales al inicio de `screen.js`.
- Circuitos nuevos: añade la definición en `tracks.js` y pasa `npm run check` (sin solapes, radios de
  curva válidos, cajas/paneles fuera de rampas, carriles de 120 px como mínimo donde haya muro
  central y cruces de carril dentro de un muro y lejos de las rampas). Los puntos de control van **repartidos a distancia
  constante** (la spline es Catmull-Rom uniforme): con espaciados dispares salen radios de 37 px
  donde tocan 200. Un trazado nuevo se genera con un script y se valida antes de pegarlo.
- Los circuitos se piden **por nombre**, no por número: el orden de la lista ya ha cambiado una vez
  (Arcoíris pasó a ser el primero) y las pruebas que necesitan una horquilla o un mundo grande
  tienen que seguir cogiendo el circuito que les toca.
- Gráficos: el estilo es dibujo animado — colores planos (`MeshToonMaterial`), contorno oscuro
  (`ponerContorno` / `contornoInstanciado` en `screen.js`) y formas redondeadas. Los modelos se
  hacen con Blender por script, nunca a mano, para que se puedan rehacer. Cada malla de contorno es
  un dibujado más y la escena se pinta **una vez por panel**: con 8 jugadores, cada dibujado se
  multiplica por 8. Mide los fps con la tecla `P` antes de dar por bueno un cambio de gráficos.
- Commits en español, con un mensaje que explique el porqué.

## Trabajo nocturno automático

Un agente en la nube (Claude Code, dos sesiones por noche) trabaja en este repo mientras el dueño duerme.
Nadie revisa hasta la mañana, así que la prioridad es **avanzar todo lo posible sin perder nada y sin romper
el juego**. La memoria entre sesiones es `PROGRESO.md`; la hoja de ruta, `IDEAS.md`; el diario, `CHANGELOG.md`.

1. **Candado.** `git fetch --all --prune`. Lee `PROGRESO.md` de la rama `noche/*` más reciente (o de `main`
   si no hay ninguna). Si «Sesión en curso» tiene un inicio de hace **menos de 2,5 horas** y un «último
   latido» de hace **menos de 45 minutos**, otra sesión está trabajando: termina sin tocar nada. Si el
   latido es más viejo, esa sesión murió: retómala. Una rama `noche/*` ya contenida en `main`
   (`git merge-base --is-ancestor origin/noche/X origin/main`) son restos de una noche terminada: bórrala
   en el remoto y sigue. Si no hay nada activo, apunta tu inicio (UTC), tu rama y tu primer latido y haz
   push: ese push es tu candado.
2. **Retomar.** Si hay un «Punto en curso», sigue por su «siguiente paso» en esa misma rama (rebase sobre
   `main` si `main` avanzó). Si no, coge el primer punto pendiente de `IDEAS.md` (bugs → Fase 0 → Fase 1 → …)
   y crea `noche/AAAA-MM-DD` desde `main`.
3. **Guardar.** Tras cada subpaso coherente, y como máximo cada 20-30 minutos: actualiza `PROGRESO.md`
   (hecho / siguiente paso / «último latido» con `date -u`) + `git commit` + `git push origin noche/<fecha>`.
   Solo lo que está en GitHub sobrevive a un corte de sesión. Si un push es rechazado: `git fetch` y mira
   el «inicio» de «Sesión en curso» en el `PROGRESO.md` remoto; si no es el tuyo, has perdido el candado:
   **para inmediatamente** sin más push; si es el tuyo, `git pull --rebase` y reintenta.
4. **Cerrar un punto.** Solo con `npm ci && npm test` en verde y la «Comprobación» del punto cumplida:
   marca `[x]` en `IDEAS.md`, entrada fechada en `CHANGELOG.md` (qué cambió, cómo probarlo en la fiesta,
   «pendiente de probar en fiesta» si aplica), `PROGRESO.md` sin punto en curso, `git checkout main &&
   git pull --ff-only && git merge --no-ff noche/<fecha>`, `npm test` otra vez en `main`, `git push origin
   main`. Nunca `push --force`, nunca reescribas `main`.
5. **Seguir.** Mientras quede capacidad, vuelve al paso 2 con el siguiente punto (misma rama de la noche).
   Trabaja hasta que el contexto esté casi agotado; no pares tras un solo punto. Mejor dos puntos perfectos
   que tres a medias.
6. **Si `npm test` no pasa** al cerrar y no lo consigues arreglar: no fusiones. Deja la rama subida, anota el
   bloqueo en `PROGRESO.md` y suma 1 a «intentos fallidos». Con **2 sesiones fallidas** en el mismo punto,
   abre un Pull Request con lo que hay, márcalo en `IDEAS.md` como «⏸ pendiente de revisión humana» y pasa
   al siguiente punto.
7. **Relevo.** Cuando quede poco contexto o acabes: push final, vacía «Sesión en curso», rellena «Última
   sesión» y «Notas para la siguiente sesión». Termina con un resumen breve en español: qué hiciste, dónde te
   quedaste y cómo probarlo.
8. Nunca subas `node_modules` ni secretos; no toques archivos ajenos al punto; sin dependencias pesadas.
