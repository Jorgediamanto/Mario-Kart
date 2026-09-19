# Progreso del agente nocturno

Este archivo es la memoria entre sesiones. El agente lo lee al empezar y lo actualiza en **cada guardado**
(commit + push). Formato fijo: no borres secciones; escribe «ninguna» o «—» cuando no aplique. «Último latido»
es la hora del último push de la sesión: si tiene más de 45 minutos, la sesión se da por muerta y otra puede
retomar la rama.

## Sesión en curso
- inicio (UTC): 2026-09-19 10:32
- último latido (UTC): 2026-09-19 15:30
- rama: noche/2026-09-19

## Punto en curso
- IDEAS.md: ninguno (tres puntos cerrados y fusionados en `main` esta noche)
- hecho: pantalla dividida completa y fusionada con lo que el dueño empujó a mediodía
- siguiente paso: Fase 2, «Mejorar los circuitos para la vista en tercera persona»
- intentos fallidos en este punto: 0

## ⚠️ Aviso: el dueño está trabajando en paralelo
- A mediodía (12:58-13:00 hora local) empujó a `main` el arreglo de la horquilla (`nearestNear`) y
  dos peticiones nuevas en `IDEAS.md`. Todo fusionado y con `npm test` en verde.
- El punto **«Volante de giroscopio»** lo está haciendo **él**: no tocarlo.
- **Ojo para él**: esta noche `play.html` y `play.js` han cambiado (los botones de girar muestran el
  nivel del derrape con color, ★ y vibración, y la sala explica el derrape automático). Si está
  rehaciendo el mando para el volante, que parta de `main` actualizado; el respaldo con ◀ ▶ debería
  conservar el pintado del nivel (`pintarDerrape`) y los `fx` `drift0..3`.

## Última sesión
- fin (UTC): 2026-09-19 04:03
- resultado: **cuatro puntos cerrados, `npm test` en verde en `main`** (en local: ver el aviso de abajo).
  Fase 0 entera (0.1 simulación sin navegador, 0.2 `npm run race`, 0.3 prueba del protocolo) y el primer
  punto de la Fase 1 (mando de 4 botones + rescate automático). Dos fallos de verdad encontrados y uno
  arreglado: cualquier móvil podía hacerse pasar por la pantalla (arreglado en `server.js`) y los bots a
  veces se dan la vuelta y corren en dirección contraria (anotado en «Bugs conocidos»).
- commits: rama `noche/2026-09-19`, fusionada en `main` con cuatro merges (uno por punto).

## ⚠️ AVISO IMPORTANTE PARA LA SIGUIENTE SESIÓN: no se pudo hacer push
- Durante toda la noche GitHub devolvió **403** (`Claude doesn't have GitHub access to
  Jorgediamanto/Mario-Kart`) tanto en `git push` como en la API. Leer el repositorio sí funcionaba.
- Por eso **todo el trabajo está solo en commits locales** y en un **bundle de git** que se le envió al
  dueño en el chat (`kart-party-fase0-completa.bundle` y otro final con los cuatro puntos).
- Si al empezar ves que `main` en GitHub sigue en `e4bf6f0` («Afina el protocolo nocturno…»), esta noche
  se perdió: hay que recuperarla del bundle (`git fetch <bundle> main:noche-recuperada`) o rehacerla.
- Antes de nada, comprueba que puedes hacer push (por ejemplo, empujando el candado de PROGRESO.md). Si
  vuelve a dar 403, avisa al dueño en el primer momento en vez de trabajar cuatro horas a ciegas.
- El arreglo es suyo: instalar/reinstalar la Claude GitHub App con permiso de escritura
  (https://github.com/apps/claude/installations/select_target) o reconectar GitHub en claude.ai.

## Notas para la siguiente sesión
- **Siguiente punto**: «Derrape automático con 3 niveles» (Fase 1). Antes de tocar nada, corre
  `npm run race -- --track all --runs 2 --stats drift`: hoy, de ~745 derrapes de bots, 523 duran menos de
  0,35 s y **ninguno** pasa de 1,6 s, así que con los tiempos de ahora el nivel 3 no se ve nunca. Mide
  otra vez después de cada ajuste y compara los tiempos de vuelta (guarda la referencia en
  `tools/referencia.json`, como pide el punto).
- Al quitar el botón de derrape, **las personas se han quedado sin derrape**: `play.js` manda `d: 0`
  siempre y la simulación solo derrapa si le llega `d`. El punto del derrape automático es justo lo que
  lo arregla, así que conviene hacerlo la próxima noche y no dejarlo pasar.
- La simulación ya tiene sitio para ello: `stepKart` en `public/sim.mjs`, donde está `drifting`, con los
  hooks `onSfx`/`onParticles`/`onFx` para chispas, sonido y vibración del móvil, y `onStretch` para el
  estirón del kart al salir disparado.
- Para cualquier cambio de físicas: añade su escenario a la lista `escenarios` de `tools/check-sim.js`
  (hay 11) y comprueba con `npm run race` que los bots no se vuelven tontos ni imbatibles.
- Sigue pendiente de mirar en la fiesta lo que dice `CHANGELOG.md`: que el juego se sienta igual que
  antes del refactor, el tamaño de los botones del mando nuevo y si 3 s es buen tiempo para el rescate.
