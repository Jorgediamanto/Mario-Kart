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
- fin (UTC): 2026-09-20 02:29
- resultado: **siete puntos cerrados y fusionados en `main`, `npm test` en verde** (con `npm ci`
  limpio). Por orden: los **cinco circuitos rehechos** (Fase 2, el punto gordo); **modo fácil por
  jugador**; **calentamiento en la sala**; **cámara con carácter**; **estelas y marcas**; **sonido
  de motor por kart** (con bus, compresor y tecla `M`); y **música sintetizada**.
- también: el dueño estuvo trabajando **a la vez**, de madrugada (`12c1d9e` retratos de personajes,
  `43efe58` el «otro yo» con la corona). Sus dos commits están fusionados sin perder nada; el único
  choque fue en `CHANGELOG.md` (dos entradas nuevas arriba) y se conservaron las dos.
- commits: rama `noche/2026-09-20`, fusionada en `main` con siete merges (uno por punto).

## Notas para la siguiente sesión

1. **Lo primero: los dos puntos que se saltaron.** «Ayuda la primera vez» y «Móvil legible de un
   vistazo» (Fase 3) están sin hacer **solo** porque el dueño estaba despierto a las 3:52 tocando
   `play.html`/`play.js`, que es donde viven enteros. No hay nada que decidir: mirar `git log` de
   esos dos archivos y, si ya no está encima, hacerlos.
2. **Lo que hay pendiente de oír y de medir** (está en cada entrada del CHANGELOG, y son tres cosas
   que esta sesión **no ha podido comprobar**):
   - **fps con la tecla `P`, con 4 y con 8 paneles**, por las marcas de neumático y las estelas. Si
     baja de 60, subir `MARCA_CADA` en `screen.js`.
   - **cómo suena** el motor por kart (`MOTOR_VOL` 0,05 · `MOTOR_BOT` 0,34) y la música
     (`MUSICA_VOL` 0,055). Con `M` se calla todo; poniendo los volúmenes a 0 se quita sin más.
   - **el hit-stop** de 30 ms (`CAM_HITSTOP`): congela la imagen de todos aunque el golpe sea de
     uno. Si molesta con ocho jugadores, a 0.
3. **Los circuitos ya no son los de antes.** Los cinco miden 12.800-15.900 px en mundos propios
   (5400x3600 y parecidos) y la vuelta dura 28-33 s. `npm test` **exige** ahora que la vuelta media
   esté entre 25 y 60 s, y que una persona que sostiene el volante llegue al nivel 3 de derrape en
   algún circuito. Un trazado nuevo se genera con `node tools/traza-circuitos.js "<nombre>"
   --escribir` (el motor está en `tools/traza.js`, compartido con Arcoíris).
4. **Lo único que no salió**: el «atajo con riesgo» de Fase 2. Está **medido**, no abandonado: un
   kart vuela 270-490 px y no hay ninguna curva de los cinco circuitos que se pueda cortar por el
   aire ganando terreno, porque ahora son curvas abiertas. Para atajos de verdad la simulación
   necesita **ramas** (hoy `nearest` + `lat` define una sola carretera). Está anotado en el punto de
   Fase 6 con el porqué, y es una decisión para el dueño.
5. **Ojo con las pruebas que dependían de la forma de un circuito**: las dos de la horquilla llevan
   ahora **su propia pista dentro de `check-sim.js`** (el trazado viejo de Volcán Disco). Si algún
   día se vuelve a tocar un circuito, esas dos ya no se rompen.
6. **Cuidado con `git checkout`**: esta sesión llegó a commitear un trozo de trabajo en `main` local
   por despiste (se movió a la rama de la noche y se reseteó `main` a `origin/main`, sin perder
   nada). Comprobar la rama antes de cada commit.
