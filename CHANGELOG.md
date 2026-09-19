# Historial de cambios

Cada entrada dice qué cambió y cómo probarlo en la fiesta. Las entradas del agente nocturno
llevan la fecha en que se hicieron.

<<<<<<< HEAD
## 2026-09-19 — Entrar vuelve a ser directo: el aviso del navegador ya no está en la puerta

- **Qué pasaba**: al poner el QR apuntando a la dirección cifrada, lo primero que veía cualquiera
  al escanearlo era un aviso de que «podrían estar intentando robarte los datos», y a algunos
  móviles **no les dejaba pasar de ahí**. Poner eso en la entrada deja gente fuera de la fiesta.
- **Y encima el certificado estaba mal**: duraba **diez años** y no decía que fuera de un servidor
  web. Apple rechaza de plano los certificados de más de 825 días o sin `serverAuth`, así que en
  iPhone no salía ni la opción de continuar. Ahora dura **397 días** y lleva las extensiones que
  toca, así que el aviso es el normal y se puede continuar.
- **Cómo funciona ahora**: el QR lleva a la dirección de siempre, sin avisos: todo el mundo entra
  a la primera y juega con los botones ◀ ▶. En la sala del móvil hay un recuadro 🎡 que explica el
  volante y, al pulsar, salta a la dirección cifrada **llevándose el nombre y el personaje**, así
  que al llegar entras solo. La tele explica lo mismo debajo del QR.
- **Para no ver el aviso nunca más** en tu móvil: `http://…:3000/certificado.crt` se descarga e
  instala. En iPhone hay que activarlo además en Ajustes → General → Información → Ajustes de
  confianza de certificados. Se hace una vez; para invitados de una noche no compensa.
- **Cómo probarlo**: escanea el QR: tiene que entrar directo, sin ningún aviso. Luego, en la sala,
  «Activar el volante»: ahí sí sale el aviso, se continúa, y vuelves a estar dentro con tu nombre.
- `npm test` gana dos comprobaciones que habrían cazado esto: que el QR **no** apunta a la
  dirección cifrada, y que el certificado cumple lo que pide un iPhone (días, `serverAuth`, SAN).

## 2026-09-19 — El móvil es el volante (y solo quedan dos botones)

- **Qué cambió**: se acabó girar con los botones ◀ ▶. Ahora el móvil se pone **en horizontal** y se
  **gira como un volante**, al estilo del mando de la Wii. El mando se queda con **dos botones**, de
  media pantalla cada uno: **OBJETO** (morado, izquierda) y **GAS** (verde, derecha). Arriba hay una
  barra que enseña cuánto estás girando y de qué color va el derrape, y un botón **⊙ centrar**.
- **La dirección pasa a ser analógica**: antes el mando solo podía decir «izquierda», «nada» o
  «derecha»; ahora manda un decimal, así que un poco de giro es un poco de curva. El teclado y los
  bots siguen mandando el giro entero y conducen exactamente igual que antes.
- **Cómo se mide el volante**: del sensor del móvil se saca hacia dónde tira la gravedad; al centrar
  se guarda ese vector y a partir de ahí el ángulo girado respecto a él, dentro del plano de la
  pantalla, es el giro del volante. Así **da igual cómo de inclinado sujetes el móvil**: se centra
  solo al empezar cada cuenta atrás, con el móvil donde lo tengas. Zona muerta de 5º y tope a 35º.
- **Sin freno**: no hay marcha atrás (no quedan botones para ella). Si te quedas clavado o te sales,
  el rescate automático te devuelve a la pista a los 3 segundos, como hasta ahora.
- **Lo que ha obligado a tocar el servidor**: los navegadores **solo dejan leer el giroscopio en
  conexiones seguras**, y el juego se servía por `http://192.168.x.x`. Ahora el servidor sirve lo
  mismo **también por HTTPS** (puerto 3443 por defecto) con un certificado propio que se genera solo
  con `openssl` la primera vez, y el QR lleva ahí. **Cada móvil verá una vez el aviso de «conexión
  no privada» y tendrá que continuar**; la tele lo explica en la sala. Si no hay `openssl`, si el
  puerto falla o si se arranca con `KART_HTTPS=0`, todo sigue funcionando por HTTP como siempre.
- **Nadie se queda sin jugar**: si el móvil no tiene giroscopio, no da permiso o ha entrado por
  `http://`, el mando enseña los botones ◀ ▶ de siempre (con los dos a la vez para ir marcha atrás).
  También se pueden elegir a mano en la sala, con «Prefiero los botones ◀ ▶».
- **Cómo probarlo**: `npm start`, escanear el QR, aceptar el aviso del navegador y mirar en la sala
  el recuadro 🎡 («Volante listo»). En la carrera: poner el móvil en horizontal, bloquear la
  rotación y girar. La barra de arriba tiene que moverse con el móvil y volver al centro al
  enderezar. **Pendiente de probar en fiesta**: si 35º de tope es mucho o poco, si la zona muerta de
  5º basta con el coche en marcha, y si se echa de menos la marcha atrás.
- **Lo que sí está comprobado sin fiesta** (`npm test`, 131 comprobaciones): las cuentas del volante
  están en `public/volante.js`, aparte, y se prueban contra poses del móvil conocidas — girarlo 40º
  se mide como 40º con el móvil de pie, tumbado o a 45º, la zona muerta y el tope caen donde deben,
  y girar a la derecha manda a la derecha. Además: el mando sirve dos botones y los ◀ ▶ solo como
  respaldo, el servidor reenvía la dirección decimal sin redondearla y recorta la basura, HTTPS
  sirve el mando, y en la simulación medio volante gira la mitad y un roce de volante no carga
  derrape.
=======
## 2026-09-19 (noche 2) — «¡Vas al revés!» (Fase 3)

- **Qué cambió**: si un kart lleva **más de 1,5 segundos avanzando contra el sentido del circuito**,
  en su panel sale un cartel rojo parpadeante «↩ ¡VAS AL REVÉS!», suena un aviso y **el móvil vibra
  largo** y pone «Date la vuelta». En cuanto se endereza, el aviso se apaga solo.
- **Cuándo no molesta**: no cuenta mientras das un trompo, mientras te recoge el rescate, ni casi
  parado (por debajo de 60 de velocidad), que es cuando cualquiera se lía maniobrando. Dar marcha
  atrás un momento con los dos botones tampoco avisa: hacen falta 1,5 s seguidos.
- **Constantes**: `WRONG_WAY_TIME` y `WRONG_WAY_SPEED` al principio de `public/sim.mjs`; hook nuevo
  `onWrongWay(kart, siVaAlReves)` y avisos `fx` `wrong` / `wrong0` al móvil.
- **Cómo probarlo**: `npm test` (escenario «ir al revés más de 1,5 s dispara el aviso, y girarse lo
  apaga»). En la fiesta: date la vuelta a propósito en una recta y mira que el cartel aparece pronto
  pero no en cuanto rozas un muro. **Pendiente de probar en fiesta**: si 1,5 s es la espera justa.

## 2026-09-19 (noche 2) — Regresión de fase: todo junto, y la lista para la fiesta

- **Qué cambió**: `npm test` tiene un escenario nuevo que corre una carrera entera **de verdad** (8
  karts, 3 vueltas, una persona conducida por el piloto automático a la que se saca al césped a
  propósito) y exige que se disparen **todos los sistemas a la vez**: saltos, paneles de turbo,
  cajas, objetos usados, golpes, rescate, turbo de derrape y el registro de objetos por posición. Si
  algo se desconecta al tocar otra cosa, esto se pone rojo aunque los escenarios sueltos pasen.
  También se apunta `stats.driftBoosts` (cuántos turbos de derrape de cada nivel).

### Lista de comprobación para la próxima fiesta

Lo que ninguna prueba puede mirar. Con el juego abierto y dos o tres móviles:

1. **Mando**: los cuatro botones se pulsan bien con los pulgares, en horizontal y en vertical.
   Girando con los dos a la vez se va marcha atrás (los botones se ponen rojos).
2. **Derrape**: aguantar el giro en una curva larga enciende el botón (azul ★ → naranja ★★ → rosa
   ★★★) con una vibración en cada escalón, y al soltar el kart sale disparado. ¿Se llega al ★★★
   alguna vez? ¿Apetece derrapar o estorba?
3. **Pantalla dividida**: cada persona se reconoce en su panel a la primera. Con 4 paneles, pulsa
   `P` en el ordenador: ¿60 fps? Con 8, ¿al menos 30? ¿Marea la cámara en las curvas cerradas?
4. **Avisos**: ¿da tiempo a reaccionar a los arcos de las rampas y los paneles de turbo?
5. **Rescate**: sal del circuito a propósito y quédate quieto: a los 3 s te recogen. ¿Se entiende lo
   que ha pasado? ¿La espera es larga?
6. **Objetos**: ¿alguien se queja de que le pegan sin parar? ¿El primero se siente robado? ¿El
   último remonta? Si el rayo se nota poco, está limitado a uno por kart cada 30 s a propósito.
7. **Sonido**: haz clic una vez en la pantalla al empezar; comprueba que se oyen turbos, golpes y
   los escalones del derrape.
8. **Final**: los resultados se leen desde el sofá y «Otra carrera» funciona a la primera.

Lo que salga de aquí, a `IDEAS.md`: son los datos que el agente nocturno no puede medir solo.

## 2026-09-19 (noche 2) — Los objetos, medidos y con dos reglas de justicia (Fase 2)

- **Lo primero, los números** (8 carreras de 8 bots, 3 vueltas, medidos antes de tocar nada). Objetos
  usados: 57 caparazones verdes, 50 champiñones, 39 plátanos, 24 rojos, 12 estrellas y 7 rayos. De
  cada uno, cuántos hacen daño: **rojo 71 %**, **plátano 67 %**, **verde 25 %** y el rayo pilla a
  cuatro karts de media. El reparto por posición hace lo que promete: al primero nunca le sale rojo
  ni rayo; al octavo le salen estrella (22 %) y rayo (16 %). En 8 carreras, el último de la parrilla
  acabó **2 veces en el podio**. Conclusión: el equilibrio de fondo está bien y **no se ha tocado
  ninguna potencia ni duración**; solo se han puesto dos reglas de justicia que faltaban.
- **Regla 1 — no te pueden encoger dos veces seguidas**: a quien le cae un rayo queda inmune al rayo
  **30 segundos** (`LIGHTNING_IMMUNITY`). Antes, dos rayos seguidos podían dejar al líder encogido
  media carrera sin nada que hacer.
- **Regla 2 — no más de tres golpes en diez segundos**: tras un golpe ahora hay **2,5 s** de
  inmunidad en vez de 1,5 (`HIT_IMMUNITY`), que es lo que hace falta para que ni con mala suerte te
  peguen cuatro veces seguidas. Medido: la peor racha de las 8 carreras baja de 3 golpes a 2.
- **Se nota en el móvil**: si te encoge un rayo, el móvil vibra distinto y pone «⚡ ¡Te han
  encogido!»; al coger estrella, «⭐ ¡Invencible!». (Mensajes `fx` nuevos: `zap` y `star`.)
- **Se puede vigilar**: la simulación apunta ahora `stats.itemsByPos` (qué objeto sale en cada
  posición) y `kart.hitsTaken`, y `npm test` comprueba cuatro reglas: el reparto por posición
  coincide con la tabla declarada (±2,5 puntos en 20.000 tiradas), el rayo no repite en 30 s, nadie
  se come más de 3 golpes en 10 s y el último de la parrilla sube al podio alguna vez en 8 carreras.
  Con dos corredores la carrera también acaba y no sale el rayo.
- **Cómo probarlo**: `npm test` y `npm run race -- --track all --runs 2 --stats items`. En la fiesta:
  **pendiente de probar** si la inmunidad de 2,5 s se nota demasiado generosa cuando alguien va
  pegado detrás tirando caparazones.

## 2026-09-19 (noche 2) — Lo que viene se ve venir: arcos y bordillos (Fase 2, primer paso)

- **Qué cambió**: con la cámara detrás del kart ya no se ve el circuito entero, así que ahora un
  **arco de color cruza la carretera** unas 200 unidades (algo más de medio segundo) antes de cada
  **rampa** (amarillo) y de cada **panel de turbo** (del color del panel), y las **curvas llevan
  bordillos altos por fuera**, que es la referencia para saber cuánto falta y por dónde se entra.
- **Sin coste**: todo va en mallas instanciadas (seis dibujados más en total, no uno por arco),
  porque con la pantalla dividida cada dibujado se multiplica por el número de paneles. La
  simulación no cambia: la fase 4 de `npm test` da exactamente lo mismo que antes.
- **Cómo probarlo**: `npm start` y una vuelta mirando si da tiempo a reaccionar a las rampas y a los
  paneles desde el panel propio. **Pendiente de probar en fiesta**: si 200 unidades de aviso son
  suficientes (la constante es `ARCO_ANTES`, en `setWorld` de `public/screen.js`).
- **Queda pendiente** lo gordo de este punto: rehacer los trazados. Antes hay que decidir una cosa
  que está anotada con números en `IDEAS.md`: la hoja de ruta pide vueltas de 25-60 s y hoy son de
  9-12 s, y para eso o se juegan más vueltas, o el mapa se hace más grande, o los circuitos se
  vuelven serpientes. Es una decisión del dueño, no del agente.
>>>>>>> origin/main

## 2026-09-19 — Nadie pierde una vuelta en la horquilla (segunda mitad del bug de los bots)

- **Qué pasaba**: el arreglo de esta madrugada curó la mitad del bug (el bot de espaldas). La otra
  mitad no era la dirección: tras un plátano en la horquilla de Volcán Disco el bot salía despedido
  al césped y la simulación lo daba por más cerca del **tramo de enfrente** de la horquilla. Se
  subía a él, y como eso es un atajo de 81 muestras, el antiatajos no se lo contaba: al cabo de
  media vuelta perdía la vuelta entera. El rescate automático tenía el mismo fallo y podía dejar a
  una **persona** en el tramo equivocado, haciéndole perder la vuelta.
- **Qué cambió**: la simulación busca la carretera más cercana **solo alrededor del tramo por el que
  iba cada kart**. Los bots vuelven al suyo y el rescate te deja en el tuyo.
- **Cómo probarlo**: `npm test`, con dos escenarios nuevos (un bot que cae en el tramo de enfrente y
  un rescate desde allí). Medido con `npm run race`: Volcán Disco pasa de 12,5 a 11,8 s de vuelta
  media y la carrera de 51 a 39 s; los otros tres circuitos no se mueven. En la fiesta: si en la
  horquilla de Volcán Disco te sacan de la pista y te recogen, sigues por tu tramo.

## 2026-09-19 (noche 2) — Pantalla dividida: cada uno ve su kart desde atrás (Fase 1)

- **Qué cambió**: durante la carrera, la tele deja de enseñar el circuito entero desde arriba y se
  reparte en **paneles, uno por persona** (los bots no tienen). En cada panel, la cámara va detrás y
  un poco por encima de tu kart, mira hacia donde vas, se aleja cuando corres, se abre siete grados
  y tiembla en los turbos, y te acompaña en los saltos. La sala, la cuenta atrás y los resultados
  siguen con la cámara general, que enseña la pista entera.
- **Cómo se reparte**: 1 → completa · 2 → dos anchos, uno encima del otro · 3 → dos arriba y uno
  ancho abajo · 4 → 2×2 · 5 → tres y dos · 6 → 3×2 · 7 → cuatro y tres · 8 → 4×2. Con número impar,
  la fila de abajo lleva uno menos y sus paneles salen más anchos: así no queda un cuadro negro.
- **Marcador**: el marcador grande de arriba desaparece durante la carrera (tapaba los paneles de la
  fila de arriba) y queda el tiempo en una chapa centrada. Cada panel lleva el suyo: emoji, nombre,
  posición, vuelta, objeto y avisos («¡TRUCO!», «¡ÚLTIMA VUELTA!», las estrellas del derrape, el
  rescate). El «¡YA!» de la salida sigue saliendo grande en medio de la tele, para todos.
- **Cuánto cuesta**: cada panel es **un dibujado completo de la escena**, así que el coste sube casi
  en proporción al número de paneles; a cambio, cada cámara ve solo un trozo del circuito y three.js
  se ahorra lo que queda fuera. Con **más de cuatro paneles** se baja la resolución interna a un
  píxel por píxel (en una pantalla Retina, hasta cuatro veces menos píxeles que dibujar). Esto **no
  se puede medir sin navegador**, así que hay una tecla nueva: **`P` enseña los fps** y cuántos
  paneles hay.
- **Cómo probarlo**: `npm start`, entrar con dos o tres móviles y mirar que cada uno ve su kart desde
  atrás en su panel, que el nombre y el emoji se leen, y que la cámara no marea en las curvas.
  **Pendiente de probar en fiesta**: pulsar `P` y comprobar que con 4 paneles se mantienen los 60 fps
  y con 8 no baja de 30 en el portátil de casa; si baja, lo primero que hay que tocar son las
  partículas (`particles.emit`) y las sombras de los karts. También está por ver si la cámara (210
  unidades por detrás, 105 por encima, 70º a lo ancho) queda a buena altura: son las constantes
  `CHASE_*` al principio de `public/screen.js`.

## 2026-09-19 (noche 2) — La clasificación deja de mentir tras un vuelo (bug)

- **Qué pasaba**: si un kart aterrizaba muy por delante de donde iba (saliendo disparado de una rampa
  o de un bumper), el contador de progreso **dejaba de contarle** hasta que daba la vuelta entera al
  circuito, y entonces le restaba media vuelta de golpe. Durante unos diez segundos su posición en la
  clasificación era falsa: podía ir tercero y aparecer último. Pasaba igual con los empujones hacia
  atrás. El guardia existía para que cortar el circuito no saliera gratis, pero no sabía volver atrás.
- **Qué cambió**: el salto grande sigue sin contar **al momento**, pero si el kart sigue ahí pasado
  `PROGRESS_JUMP_WAIT` (1 segundo), se acepta: si de verdad está ahí, mentir en la clasificación es
  mucho peor que el atajo. Vale para saltos adelante y atrás.
- **Cómo probarlo**: `npm test` (escenario «volar por encima de un atajo no congela la clasificación»).
  En la fiesta: tirarse por la rampa larga de Volcán Disco y mirar que la posición en la tele se
  actualiza al caer en vez de quedarse clavada. Los tiempos de los bots no se mueven.

## 2026-09-19 (noche 2) — Derrape automático con tres niveles (Fase 1)

- **Qué cambió**: se acabó el botón de derrape. Si aguantas el giro hacia el mismo lado a buena
  velocidad (más del 55 % de la máxima), el kart empieza a deslizar solo a los **0,3 s** y va
  cargando turbo: **★ nivel 1 a los 0,5 s** (chispas azules), **★★ nivel 2 a los 0,9 s** (naranjas)
  y **★★★ nivel 3 a los 1,4 s** (rosas). Al soltar el giro —o cambiar de lado— sales disparado
  **0,6 / 1,0 / 1,6 segundos** según el nivel. Un salto no te quita la carga: el derrape se queda en
  pausa en el aire.
- **Dónde se ve**: en la tele, las chispas cambian de color y el kart lleva un **brillo en el suelo**
  que crece con el nivel, con un sonido que sube en cada escalón. En el móvil, el botón de girar que
  estás aguantando **se enciende con el color del nivel**, muestra ★ / ★★ / ★★★ y **vibra** al subir.
- **Por qué estos tiempos y no los de la hoja de ruta** (0,8 / 1,6 / 2,6 s): se midió cuánto duran de
  verdad las curvas de los cuatro circuitos a velocidad de carrera. Con los tiempos de la hoja de
  ruta, el nivel 2 casi no salía y el 3 **no salía nunca**. Con los de ahora, de 893 derrapes de bots
  en 8 carreras: 404 sin nivel, 427 de nivel 1, 52 de nivel 2 y 10 de nivel 3. Es decir: en curvas
  normales se llega a 1-2 y el 3 se reserva para las curvas largas, que es lo que se pedía.
- **Cuánto gira el kart derrapando**: se mantiene el giro de antes (1,4 veces el normal). Se probó
  bajarlo para poder aguantar derrapes más largos, pero los bots perdían la trazada y sus vueltas
  empeoraban hasta un 16 %; con el valor de ahora quedan entre **-7 % y +6 %** de la referencia.
- **Herramientas**: `tools/referencia.json` guarda la vuelta media de los bots por circuito y `npm
  test` falla si un cambio de física los empeora más de un 10 % (para remedir a propósito:
  `KART_REFERENCIA=escribir node tools/check-sim.js`). El histograma de `npm run race -- --stats
  drift` ahora enseña los niveles y sus turbos.
- **Cómo probarlo**: `npm start`, entrar con un móvil y **aguantar el giro en una curva larga**: el
  botón tiene que ponerse azul, luego naranja y luego rosa, vibrando en cada escalón, y al soltar hay
  que salir disparado. En la tele se ven las chispas del color del nivel y el brillo bajo el kart.
  **Pendiente de probar en fiesta**: si 0,5 / 0,9 / 1,4 s se sienten bien con el mando en la mano y
  si el nivel 3 sale demasiado poco (subir o bajar `DRIFT_L1..L3` al principio de `public/sim.mjs`).

## 2026-09-19 (noche 2) — Los bots ya no corren en dirección contraria (bug)

- **Qué pasaba**: después de un golpe o un caparazón, un bot podía quedarse mirando hacia atrás y
  seguir **acelerando a fondo en sentido contrario** varios segundos (en Volcán Disco perdía medio
  circuito) antes de darse la vuelta. La culpa era del piloto automático: mientras estuviera de
  espaldas seguía apretando el gas y solo daba marcha atrás si iba a menos de 60 de velocidad.
- **Qué cambió**: ahora, si el morro apunta a más de 2 radianes (unos 115º) del camino, el bot
  **suelta el gas y frena** hasta encararse, y solo da marcha atrás cuando ya casi está parado.
  Es una constante con nombre al principio de `sim.mjs` (`AI_WRONG_ANGLE`).
- **Qué se gana**: en Volcán Disco la vuelta media de los bots baja de 13,5 s a 12,1 s; en los otros
  tres circuitos los tiempos no se mueven ni una décima. Un kart plantado del revés a 300 de
  velocidad recupera su avance en 2,0 s (antes, entre 2,7 y 3,8 s, y perdiendo hasta 70 muestras
  de pista).
- **Corrección (misma noche)**: al mirarlo con más calma, aquel aviso ⚠ **no era** un bot conduciendo
  al revés, sino el contador de progreso congelándose cuando un kart vuela por encima de un atajo
  (ver «Bugs conocidos» de IDEAS.md). El arreglo del piloto automático sigue siendo bueno y medido
  (el kart del revés se recupera el doble de rápido y la vuelta media de Volcán Disco baja), pero el
  detector de la prueba ahora mide el avance siguiendo el trazado, que es lo que quería medir.
- **Cómo probarlo**: `npm test`. El aviso ⚠ «se fue en dirección contraria» de la fase 4 ya no sale,
  y ahora es un **fallo** de la prueba, no un aviso: si el bug vuelve, `npm test` se pone rojo. Hay
  además un escenario nuevo en `tools/check-sim.js` que planta un kart del revés en los 4 circuitos.
- **En la fiesta**: se nota en que los bots dejan de hacer el tonto tras un choque. **Pendiente de
  probar en fiesta**: que un bot golpeado se recupere de forma creíble y no parezca que «frena» raro.

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
