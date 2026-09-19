# Progreso del agente nocturno

Este archivo es la memoria entre sesiones. El agente lo lee al empezar y lo actualiza en **cada guardado**
(commit + push). Formato fijo: no borres secciones; escribe «ninguna» o «—» cuando no aplique. «Último latido»
es la hora del último push de la sesión: si tiene más de 45 minutos, la sesión se da por muerta y otra puede
retomar la rama.

## Sesión en curso
- inicio (UTC): ninguna
- último latido (UTC): ninguno
- rama: ninguna

## Punto en curso
- IDEAS.md: ninguno
- hecho: —
- siguiente paso: —
- intentos fallidos en este punto: 0

## Última sesión
- fin (UTC): 2026-09-19 17:50
- resultado: **siete puntos cerrados y fusionados en `main`, `npm test` en verde** (comprobado con
  `npm ci` limpio al final). Por orden: el bug del piloto automático de los bots; el **derrape
  automático de tres niveles**; el bug del contador de progreso; la **pantalla dividida en tercera
  persona** (lo que más quería el dueño); el primer paso de los circuitos (arcos de aviso y
  bordillos); el **afinado de los objetos**; la **regresión de fase** con lista para la fiesta; y el
  aviso **«¡Vas al revés!»**.
- también: se fusionó sin perder nada lo que el dueño empujó a `main` a mediodía (su arreglo de la
  horquilla con `nearestNear`) y se dejó intacto su punto del volante de giroscopio.
- commits: rama `noche/2026-09-19`, fusionada en `main` con siete merges (uno por punto).

## Notas para la siguiente sesión

1. **Lo primero: mirar si el dueño ha contestado dos cosas** que se le dejaron por escrito.
   - En `IDEAS.md`, dentro de «Mejorar los circuitos para la vista en tercera persona», hay una
     decisión con números: la hoja de ruta pide vueltas de **25-60 s** y hoy son de **9-12 s**. Las
     salidas son: más vueltas (barato), mapa más grande (`MAP_W`/`MAP_H`, el cambio serio) o
     trazados en serpiente (feo con la cámara nueva). **Sin esa respuesta no se rehacen trazados.**
   - Si ya ha jugado una fiesta, en `CHANGELOG.md` está la **lista de ocho comprobaciones**: lo que
     conteste de ahí (derrape, fps con 4 y 8 paneles, avisos, rescate, objetos) manda sobre la hoja
     de ruta.
2. **No tocar `play.html` / `play.js` sin mirar antes `git log`**: el dueño estaba rehaciendo el
   mando para el **volante de giroscopio** (punto marcado «en curso, lo hace él»). Por eso se saltó
   el **«Modo fácil por jugador»**, que necesita un interruptor en la sala del móvil: retomarlo
   cuando el volante esté dentro.
3. **Siguiente punto pendiente en orden**: «Salida perfecta» (Fase 3). Ojo con los bots: hoy aprietan
   el gas durante toda la cuenta atrás, así que si «pisar antes de tiempo» penaliza, hay que darles
   un tiempo de reacción propio o se quedarían todos patinando en la salida.
4. **Herramientas que ya existen y conviene usar** antes de tocar física:
   - `tools/referencia.json` + fase 4: si los bots empeoran más de un 10 %, `npm test` se pone rojo.
     Para remedir a propósito: `KART_REFERENCIA=escribir node tools/check-sim.js`.
   - `npm run race -- --track all --runs 2 --stats drift|items|speed` para decidir con datos.
   - La fase «Pantalla» de `npm test` caza nombres de three.js que no existan: es lo único que
     protege a `screen.js`, que no tiene pruebas de navegador. Si añades APIs nuevas, mira que estén
     en `node_modules/three/build/three.module.js`.
   - Tecla `P` en la pantalla: fps y número de paneles (para el rendimiento de la pantalla dividida).
5. **Pendiente de probar en fiesta** (está en cada entrada del CHANGELOG): la sensación del derrape
   (0,5 / 0,9 / 1,4 s), la altura de la cámara de persecución (`CHASE_*`), los fps con 8 paneles, los
   200 unidades de aviso de los arcos (`ARCO_ANTES`) y la inmunidad de 2,5 s tras un golpe.
