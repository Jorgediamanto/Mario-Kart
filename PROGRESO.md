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
2. **El volante de giroscopio ya está dentro** (el dueño lo cerró el 2026-09-19 por la tarde, tras
   el relevo de esta sesión). Lo que hay que saber antes de tocar el mando o la dirección:
   - El mando tiene **dos botones** (OBJETO y GAS) y se gira **inclinando el móvil**. Los ◀ ▶
     siguen existiendo pero **solo como respaldo**, dentro del bloque `#turn-zone` marcado con
     `data-respaldo="1"`; `npm test` comprueba que no hay botones de girar fuera de ahí.
   - La dirección es **analógica**: `s` es un decimal de −1 a 1 en el móvil, el servidor y
     `sim.mjs`. Para el derrape y el truco del aire **no se compara `s` directamente**: se usa
     `dir` (el lado, con `STEER_FIRME = 0.55` de umbral). Si añades algo que dependa del giro,
     usa `dir`, no `s`, o con el volante no saltará nunca.
   - Las cuentas del volante están en **`public/volante.js`**, aparte y sin navegador, con el
     mismo envoltorio que `geom.js`. La fase «Volante» de `npm test` las mide contra poses del
     móvil conocidas. Si tocas ángulos o zona muerta, es ahí y con esa fase.
   - El servidor sirve **también por HTTPS** (`PORT + 443`) con un certificado propio en `.cert/`
     (ignorado por git, se rehace solo si cambian las IPs). Hace falta porque los navegadores solo
     dan sensores en contexto seguro. `KART_HTTPS=0` lo apaga; `npm test` pasa con y sin `openssl`.
   - **El «Modo fácil por jugador»** (Fase 3), que se saltó por esto, ya se puede hacer: el
     interruptor va en la sala del móvil, junto al recuadro 🎡 del volante.
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
   200 unidades de aviso de los arcos (`ARCO_ANTES`) y la inmunidad de 2,5 s tras un golpe. Y del
   volante: si el tope de 35º es mucho o poco, si la zona muerta de 5º basta con el kart en marcha,
   y si se echa de menos la marcha atrás (ya no hay botón para ella: recoge el rescate).
