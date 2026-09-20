# Progreso del agente nocturno

Este archivo es la memoria entre sesiones. El agente lo lee al empezar y lo actualiza en **cada guardado**
(commit + push). Formato fijo: no borres secciones; escribe «ninguna» o «—» cuando no aplique. «Último latido»
es la hora del último push de la sesión: si tiene más de 45 minutos, la sesión se da por muerta y otra puede
retomar la rama.

## Sesión en curso
- inicio (UTC): 2026-09-20 00:31
- último latido (UTC): 2026-09-20 00:47
- rama: noche/2026-09-20

## Punto en curso
- IDEAS.md: Fase 2 — «Mejorar los circuitos para la vista en tercera persona» (los cuatro circuitos
  que siguen en 9-12 s de vuelta: Costa, Volcán, Bosque, Ciudad… el que toque según `tracks.js`).
- hecho: motor compartido `tools/traza.js`; decoración junto a la carretera; **Chicle** (12.832 px,
  vuelta 29,2 s) y **Playa Neón** (13.592 px, vuelta 30,6 s) rehechos, cada uno con su entrada en
  CHANGELOG y `npm test` en verde.
- siguiente paso: **Volcán Disco** (el técnico, vértices ya validados: 12.496 px, 8 % de curvas
  cerradas) y luego Luna Loca. Después: escenario en `check-sim.js` que exija vuelta de 25-60 s en
  todos los circuitos, y cerrar el punto en IDEAS.md.
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

**El dueño trabajó con el agente la tarde del 2026-09-19** (sesión a mano, no nocturna). Lo que
cambió y lo que queda:

1. **Arreglado el atasco del muro** (`BUMPER_ENDEREZA`), **rehecho el trazado de Arcoíris** (15.728
   px en un mundo de 6550x4050, 38,6 s de vuelta), **Arcoíris es ahora el primer circuito** y su
   carretera **flota en el espacio** (`theme.cielo`: sin terreno ni suelo debajo, un poco
   transparente). Los circuitos se piden **por nombre** en las pruebas, no por número.
2. **Gráficos nuevos**: los karts, el plátano y el caparazón son modelos de Blender hechos **por
   script** (`tools/blender/*.py` → `public/modelos/*.glb`), con contorno oscuro de dibujo animado
   —también en quitamiedos y cajas—. Hay un visor en `/visor.html` para verlos de cerca. Blender
   está instalado en este Mac (`blender --background --python tools/blender/kart.py`). Medido: 60
   fps con 8 karts y 8 paneles.
3. **A prueba, pendiente de la opinión del dueño**: el volante responde más fino cerca del centro
   (`CURVA` 0,18 → 0,32 en `public/volante.js`, el tope sigue en 35º). Si dice que va blando, se
   vuelve a 0,18. **No tocar el tope de 35º sin preguntarle.**
4. **Segunda tanda del 2026-09-20** (también a mano, con el dueño): Arcoíris tiene **cuestas**
   (`relieve` en `tracks.js`), los **saltos dan turbo al despegar** (`RAMPA_TURBO`) y vuelan de
   verdad, las curvas del sector medio están más apretadas (radio mínimo 166), la velocidad base
   sube a 445, las ruedas del modelo son más gordas y el «¡ÚLTIMA VUELTA!» dura 4 s en vez de toda
   la vuelta. De rebote: tope al rebote de aterrizaje, el bot ya no se queda marcha atrás, y a
   quien corre al revés o vaga fuera de la pista se le recoge. El trazado se regenera con
   `node tools/traza-arcoiris.js`.
5. **Tercera tanda del 2026-09-20**: **siete personajes** con nombre y cara propia (El Loco, Chuma,
   Toro, Diamanto, Leini, Carlota, Scarlet), cabezas modeladas en `tools/blender/personajes.py`,
   humo verde para El Loco, banderas de Texas y Cataluña, Carlota más pequeña, y **desfile de karts
   girando en la sala**. Siete personajes = siete sitios: `MAX_KARTS` manda y el servidor y las
   pruebas lo leen de ahí. Si algún día hace falta un octavo sitio, hay que inventar un personaje
   más (el dueño eligió siete a propósito).
6. **Lo siguiente que pidió, por orden**: seguir haciendo el juego más fácil sin quitar gracia, y
   seguir mejorando los gráficos con el mismo estilo (simple y gracioso). Los otros cuatro
   circuitos siguen con vueltas de 9-12 s y **sin cuestas**: se pueden rehacer igual que Arcoíris,
   con el script y con su propio `relieve`.
7. **Ojo**: en `CHANGELOG.md` había marcadores de conflicto de git (`<<<<<<<`) commitados en `main`
   desde un merge anterior; se quitaron conservando los dos bloques de entradas.

