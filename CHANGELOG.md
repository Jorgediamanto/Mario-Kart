# Historial de cambios

Cada entrada dice qué cambió y cómo probarlo en la fiesta. Las entradas del agente nocturno
llevan la fecha en que se hicieron.

## 2026-09-20 (noche) — Al entrar eliges personaje, y con su cara de verdad

- **El móvil enseña los personajes que hay.** La pantalla de elegir ya existía, pero llevaba la
  lista vieja escrita a mano (Rana, Zorro, Panda…): salían personajes que ya no existen. Ahora la
  lista viaja desde la simulación: la pantalla se la manda al servidor al conectarse (`screen`) y el
  servidor la reparte a los móviles (`roster` y `lobby`), así que lo que se ve al entrar es siempre
  lo que hay de verdad. `play.js` guarda una copia solo como respaldo, para el rato en que la tele
  aún no se ha conectado.
- **Con retrato.** Cada personaje se enseña con **su cara**, no con un emoji parecido: son fotos que
  genera Blender junto a las cabezas (`tools/blender/personajes.py` → `public/modelos/retratos/`),
  en tres cuartos para que se les vean los cuernos, el cigarro o las coletas. Si falta el archivo,
  se ve el emoji de siempre. Tu cara sale también en la cabecera del móvil mientras esperas.
- Los personajes cogidos salen apagados y no se pueden elegir (eso ya iba), y desde la sala se
  puede cambiar de personaje con el botón de siempre.
- **Arreglado de paso**: el botón «Activar el volante» salía metido en una columna de 52 px (se
  comía el ancho de los botones ± de los ajustes). Ahora ocupa la línea entera y se lee.

- **Cómo probarlo**: `npm start`, abre el mando en el móvil y mira la pantalla de entrar: siete
  caras, las cogidas apagadas. Elige una y entra: la misma cara sale arriba, en la tele y en tu kart.
## 2026-09-20 (noche) — Modo fácil: un botón para quien nunca ha jugado

En la sala de cada móvil hay ahora un interruptor **🦺 Modo fácil**. Es por jugador y se recuerda en
ese móvil, así que quien lo enciende una vez lo tiene siempre.

- Con el modo fácil, **el kart acelera solo** (mientras no frenes) y **el volante ayuda**: tira
  hacia la carretera un poco más adelante. Cuanto menos toques tú, más manda la ayuda; si giras a
  tope, mandas tú. Sin tocar nada, el kart da la vuelta entera sin salirse.
- **No es un atajo para ir más rápido**: sin pisar el gas va al 94 % de la velocidad máxima. El
  botón GAS pasa a ser un empujón opcional (y el texto del botón lo dice en la carrera).
- La tele lo enseña en la sala con una etiqueta **🦺 modo fácil** junto al nombre, y en el móvil
  cada jugador de la lista lleva su 🦺, para que se vea quién juega con ayuda.
- **Compatibilidad**: un móvil con la página cargada de antes no manda el campo nuevo y se queda en
  modo normal, como hasta ahora. Nadie tiene que recargar nada.
- Medido en la simulación: un kart en modo fácil **sin que nadie toque el mando** termina la vuelta
  en los cinco circuitos y siempre llega por detrás de un bot.

- **Cómo probarlo en la fiesta**: entra con un móvil, pulsa 🦺 en la sala (tiene que ponerse verde y
  salir la etiqueta en la tele) y empieza una carrera **sin tocar el móvil**: el kart debería irse
  solo y dar la vuelta. Luego apágalo y comprueba que vuelve a hacer falta pisar GAS.
  **Pendiente de probar en fiesta**: si la ayuda se nota demasiado para quien sí sabe jugar, baja
  `EASY_AYUDA` (0,7) en `public/sim.mjs`; si aun así alguien se sale, súbela.

## 2026-09-20 (noche) — Luna Loca, rehecha: un tercio de la carrera por el aire

Cuarto y último de los circuitos cortos. Con esto **los cinco circuitos tienen vueltas de 25-60 s**,
que es lo que pedía la hoja de ruta desde que se juega viendo desde detrás del kart.

- **Luna Loca** pasa de 4.080 px a **13.152 px**, en un mundo propio de **5450x3650**. La vuelta de
  los bots pasa de **10,9 s a 28,3 s**.
- **Es el circuito de volar**: con la gravedad a 0,55 se cae despacio, así que las curvas son
  abiertas a propósito (radio mínimo 325, el más generoso de los cinco) y hay **tres rampas**
  grandes. En la simulación los bots pasan **un tercio de la carrera en el aire** (25 s de 79) y
  hacen el doble de trucos que en cualquier otro circuito.
- **Carretera de 220**, la más ancha después de Arcoíris, y los mares de la luna como sube y baja.
- **9 cajas y 5 paneles** (antes 3 y 3) y más cráteres, rocas y banderas.
- **Nuevo en `npm test`**: la fase 4 comprueba ahora que **la vuelta media de cada circuito está
  entre 25 y 60 s**. No cuesta tiempo (se mide sobre las carreras que ya se corren) y evita que un
  circuito nuevo —o un retoque de uno de ahora— vuelva a dejar vueltas de bolsillo.
- `tools/referencia.json` rehecho a propósito (Luna Loca: 10,86 s → 28,28 s).

- **Cómo probarlo en la fiesta**: `npm start`, elige Luna Loca y salta. **Pendiente de probar en
  fiesta**: si tanto tiempo en el aire se hace incómodo con la cámara de detrás, se baja la altura
  de las rampas (`features`) antes que tocar la gravedad, que es lo que le da la gracia.

## 2026-09-20 (noche) — Volcán Disco, rehecho: el técnico de los cinco

Tercero de los cuatro. Mismo molde (mundo propio, trazado por script, validado antes de pegarlo),
pero con otra intención: aquí no se viene a ir rápido, se viene a trazar.

- **Volcán Disco** pasa de 4.544 px a **13.512 px**, en un mundo propio de **5600x3600**. La vuelta
  de los bots pasa de **12,7 s a 30,4 s**.
- **Es el más apretado de los rehechos**: el zigzag, dos curvas cerradas de verdad y el radio más
  pequeño de todos los circuitos (173). La carretera queda en **180** —más estrecha que los otros
  dos rehechos, que van a 200— para que dé algo de respeto, pero lejos del pasillo de 110 de antes.
- **Se sube al cráter y se baja**: 250 px de desnivel repartidos por la vuelta, **tres saltos** (el
  grande, justo después de un panel turbo) y lomos en las rectas.
- **8 cajas y 5 paneles** (antes 3 y 2), quitamiedos a los dos lados en el zigzag y en el salto
  grande, y el doble de lava.
- **Lo que se ha perdido: la horquilla.** El generador de trazados no sabe hacer un giro de 180º sin
  curvas ilegales, así que los circuitos nuevos son circuitos de carreras, no laberintos. Dos
  pruebas de regresión dependían de esa horquilla (la del kart que aparece en el tramo de enfrente
  y se le cuela el contador de progreso): ahora **llevan su propia pista de pruebas dentro de
  `tools/check-sim.js`**, que es el trazado viejo de Volcán Disco tal cual. Siguen midiendo
  exactamente lo mismo, pero ya no se rompen cuando cambia un circuito de la fiesta.
- `tools/referencia.json` rehecho a propósito (Volcán Disco: 12,74 s → 30,40 s).

- **Cómo probarlo en la fiesta**: `npm start`, elige Volcán Disco y fíjate en el zigzag: es donde se
  nota si el derrape automático encadena bien. **Pendiente de probar en fiesta**: si con 180 de
  ancho las cerradas se hacen injustas con 8 karts, subirlo a 200 como los otros.

## 2026-09-20 (noche) — Playa Neón, rehecha: el paseo marítimo de verdad

Segundo de los cuatro circuitos cortos. Mismo molde que Chicle y Arcoíris (mundo propio, trazado
generado por script y validado antes de pegarlo).

- **Playa Neón** pasa de 4.088 px a **13.592 px**, en un mundo propio de **5700x3650**. La vuelta de
  los bots pasa de **10,7 s a 30,6 s**.
- **La recta más larga de los cinco**: 1.500 px seguidos frente al mar, con un salto en mitad. Al
  volver hay curvas de todos los tipos y **la horquilla de la sombrilla**, que es la parte lenta de
  verdad (radio 222): ahí es donde se gana o se pierde la vuelta.
- **Carretera de 200** (antes 110) y **dunas**: el circuito sube hacia el interior a mitad de vuelta
  y baja otra vez hasta la orilla. **Tres saltos** en vez de uno, cada uno en su recta.
- **7 cajas y 5 paneles** (antes 3 y 2), quitamiedos en la horquilla y por fuera de las rápidas, y
  más palmeras, sombrillas y charcos de agua, que ahora se plantan junto a la carretera.
- `tools/referencia.json` rehecho a propósito (Playa Neón: 10,65 s → 30,64 s).

- **Cómo probarlo en la fiesta**: `npm start`, elige Playa Neón y mira si la recta larga se hace
  divertida o larga. **Pendiente de probar en fiesta**: la horquilla con 8 karts a la vez (puede ser
  un tapón alegre o un desastre) y los fps con la tecla `P`.

## 2026-09-20 (noche) — Chicle, rehecho: tres veces más largo, el doble de ancho y con cuestas

Primero de los cuatro circuitos que quedaban en vueltas de 9-12 s. El molde es el de Arcoíris (el
dueño ya eligió que cada circuito tenga **su propio mundo**, y allí salió bien): un polígono con las
esquinas redondeadas, generado por script y validado antes de pegarlo.

- **Chicle** pasa de 3.984 px a **12.832 px**, en un mundo propio de **5400x3600** (antes
  1920x1080). La vuelta de los bots pasa de **9,4 s a 29,2 s**, dentro de los 25-60 s que pide la
  hoja de ruta: ahora una vuelta da tiempo a que pasen cosas.
- **La carretera es casi el doble de ancha** (110 → 200). Con la cámara de detrás, el pasillo de
  antes obligaba a ir mirando el borde; ahora se puede trazar, adelantar por fuera y derrapar sin
  acabar en la hierba. En la simulación nadie se sale ni una décima (columna «Fuera» a 0,0 s).
- **Sube y baja**: cuestas suaves repartidas por la vuelta (ninguna llega al 6 %) y **dos saltos**
  en vez de uno, cada uno en su recta. Es el circuito fácil de los cinco a propósito: curvas
  abiertas, una sola chicane y ninguna curva cerrada de verdad.
- Más sitio quiere más cosas: **7 cajas y 4 paneles turbo** (antes 3 y 2), quitamiedos por fuera de
  las curvas rápidas y en la chicane, y algo más de decoración.
- **La decoración se planta ahora junto a la carretera**, no sorteada por todo el mundo. Con mapas
  ocho veces más grandes, media decoración caía donde no pasa nadie y las curvas se quedaban sin
  referencias visuales. Mismo número de mallas, todas donde se juega. Vale para los cinco circuitos.
- El motor de trazados vive ahora en `tools/traza.js`, compartido: `node tools/traza-circuitos.js
  Chicle --escribir` vuelve a generar el trazado, y `npm run check` lo valida.
- `tools/referencia.json` se ha rehecho **a propósito** (la vuelta de Chicle cambia de 9,42 s a
  29,22 s; los otros cuatro siguen clavados).

- **Cómo probarlo en la fiesta**: `npm start`, elige Chicle y da una vuelta. Debería notarse que la
  carretera es ancha de verdad, que las curvas se ven venir y que la vuelta dura lo suyo.
  **Pendiente de probar en fiesta**: si 3 vueltas (90 s) se hace largo, se baja a 2 desde la sala; y
  medir los fps con la tecla `P` con 8 paneles, que hay más decoración que antes.

## 2026-09-20 (tarde) — Los siete de la fiesta, con cara propia y desfile en la sala

- **Siete personajes, siete sitios**: El Loco (rapado y con un cigarro del que sale humo verde),
  Chuma (turbante y barba), Toro (un toro, con cuernos, morro y anilla), Diamanto (una cabeza de
  diamante con facetas), Leini (melena rubia y bandera de Texas en el kart), Carlota (rubia con
  coletas, y su kart es más pequeño que los demás) y Scarlet (melena castaña y bandera de Cataluña).
  Cada uno con su color de carrocería y su acento. Como hay siete personajes, la sala tiene **siete
  sitios** y nadie repite kart; el número lo manda `MAX_KARTS` en `public/sim.mjs` y el servidor y
  las pruebas lo leen de ahí, en vez de llevar el 8 escrito a mano en cinco sitios.
- **Las cabezas son modelos de verdad** (`tools/blender/personajes.py` → `public/modelos/cabezas.glb`),
  con el mismo contorno de dibujo animado que el kart, y bien cabezonas a propósito. Si faltara el
  archivo, vuelve el emoji de siempre y no pasa nada.
- **Desfile en la sala**: los karts de quien ya ha entrado dan vueltas en la franja de abajo de la
  tele, cada uno con su cara, su color y su bandera. En cuanto eliges personaje en el móvil, te ves
  girando en la pantalla. Cuantos menos sois, más grandes se ven. El texto de ayuda se ha movido a
  la columna del QR para dejarles sitio.
- De paso, dos arreglos que salieron probando y que valen para cualquier partida:
  - **con un turbo puesto ahora se puede frenar** (antes el turbo sostenía la velocidad al 85 % del
    máximo aunque pisaras el freno: un kart que se liaba se quedaba dando vueltas a toda pastilla
    sin poder encararse, bots incluidos);
  - **el reloj de «vas al revés» ya no se pone a cero con cada coletazo**, así que a quien da
    bandazos a contramano se le acaba recogiendo de verdad.

- **Cómo probarlo**: `npm start`, entra con dos o tres móviles y mira la franja de abajo de la tele:
  cada uno con su personaje dando vueltas. En carrera, fíjate en el humo verde de El Loco, en las
  banderas de Leini y Scarlet, y en que el kart de Carlota es más pequeño.
- **Pendiente de probar en fiesta**: si siete sitios se quedan cortos cuando sois ocho (habría que
  inventar un personaje más), y si las caras se distinguen desde el sofá con la tele a dos metros.

## 2026-09-20 — Arcoíris con cuestas, saltos de verdad y un pelín más rápido

Todo lo que pidió el dueño después de probarlo:

- **El circuito sube y baja.** Arcoíris ya no es una mesa: tiene cuestas arriba y abajo a lo largo
  de toda la vuelta, de −80 a +210 px, con pendientes de alrededor del 5 % (la subida gorda, del
  10 %). Se define en `tracks.js` con `relieve: [{ at, h }, …]` — alturas repartidas por la vuelta
  que la simulación une con transiciones suaves; las rampas y los lomos se suman encima. Cualquier
  circuito puede tener el suyo.
- **Los saltos son saltos.** Las rampas son más empinadas (la grande, 110 px de alto en 170 de
  largo) y, sobre todo, **al despegar del filo se regala turbo** (`RAMPA_TURBO`): con él se vuela
  más de un segundo, se suben 245 px y se cruza el aro por dentro de sobra. Medido en la prueba
  «saltar una rampa da turbo y hace volar de verdad»: con turbo se llega un 15 % más lejos como
  mínimo. El turbo solo cuenta si entras **derecho** a la rampa y no se puede cobrar dos veces
  seguidas en la misma.
- **Alguna curva más pronunciada.** El sector medio y la cerrada de verdad se han apretado: el radio
  más cerrado pasa de 199 a 166 px (el mínimo que deja el validador son 140). El trazado se
  regenera con `node tools/traza-arcoiris.js`, que ahora vive en el repo.
- **Un pelín más rápido**: la velocidad base pasa de 420 a 445 (+6 %).
- **Las ruedas, más gorditas** (modelo de Blender: 7,3 delante y 9,0 detrás).
- **El «¡ÚLTIMA VUELTA!» ya no se queda clavado**: sale al cruzar la meta y se va a los 4 segundos,
  en vez de tapar el marcador la vuelta entera y esconder el derrape, el truco o el rescate.

Por el camino, cuatro cosas que aparecieron al probar con datos y que también arreglan partidas:

- **Los aterrizajes fuertes ya no dejan botando**: el rebote tiene tope (`REBOTE_MAX`). Sin él, al
  caer del salto grande se rebotaba una y otra vez y el kart se quedaba trotando en el sitio, sin
  poder acelerar (en el aire no se acelera).
- **Un bot ya no se queda marcha atrás para siempre**: pasado `AI_REVERSE_MAX` pisa el gas para
  pararla. Antes, con el freno y la velocidad ya negativa, solo conseguía ir más rápido hacia atrás.
- **A quien corre al revés mucho rato (4,5 s) lo recogen**, y también **a quien lleva 3,5 s vagando
  fuera de la pista** aunque se mueva: antes se podían perder diez segundos penando por el campo a
  un tercio de velocidad.
- **`npm test` ya no confunde «le están machacando» con «está atascado»**: si en esos diez segundos
  el kart estaba de trompo, en rescate, encogido por un rayo o con el caracol, no cuenta como
  atasco. Saltaba con el Bot 1 de Chicle, que se comió caracol + rayo + dos caparazones seguidos.

- **Cómo probarlo**: `npm start`, circuito Arcoíris (el primero). Mira que la pista suba y baje, y
  tírate al salto grande: tienes que volar por dentro del aro y caer lejos. `npm test` pasa 182
  comprobaciones; la vuelta media de los bots queda en 32,8 s (antes 38,6).
- **Pendiente de probar en fiesta**: si con el turbo de salto los saltos se van de las manos con 8
  jugadores, si las cuestas marean con la cámara de detrás, y si 445 de velocidad es «un poquito»
  más rápido o ya demasiado.

## 2026-09-19 (tarde) — Ya no te quedas clavado en el muro, Arcoíris de verdad y karts con cara

Cuatro cosas, en el orden que las pidió el dueño.

**1. Se acabó quedarse picoteando el quitamiedos.** Era lo que más molestaba jugando: entrabas en
diagonal al muro, rebotabas, seguías apuntando al muro, el gas te metía otra vez, y así sin avanzar
(el rescate tampoco entraba, porque técnicamente te movías). El rebote cambiaba la velocidad pero
nunca **hacia dónde mira el kart**; ahora, al rebotar, el morro también gira hacia la carretera
(`BUMPER_ENDEREZA` en `public/sim.mjs`). Medido en Arcoíris: antes 224 px en 6 s con el morro
clavado a 63º; ahora vuelve a rodar recto en 0,18 s y avanza 1.608 px. Lo ata la prueba «quien se
come el quitamiedos en diagonal vuelve a rodar en menos de 1,5 s».

**2. Arcoíris es otro circuito.** Eran tres rectas larguísimas unidas por horquillas de 180º y no
parecía un circuito. El trazado nuevo se generó con un script (un polígono alrededor de un centro
con las esquinas redondeadas: redondeo grande = curva rápida, pequeño = curva cerrada) y se validó
antes de pegarlo: recta de meta larga con la meta en mitad, curvón rapidísimo, barrido, dos curvas
medias, **una cerrada de verdad** y un sector rápido de vuelta a meta. Mide **15.728 px** en un
mundo de 6550x4050 (antes 12.632 en 3400x1950) y la vuelta media de los bots pasa de 30,3 s a
**38,6 s**. Se mantiene lo bueno: 260 de ancho, quitamiedos en los dos lados de todo el recorrido,
los saltos, el aro y el castillo. Además, como pidió el dueño, **Arcoíris es el primero de la
lista** (el que sale por defecto) y **la carretera flota en el espacio**: sin terreno ni suelo
debajo y un poco transparente, para que se vean las estrellas a través (`theme.cielo`).

**3. Más fácil en general.** Tres ayudas que no quitan gracia: tras el trompo de un golpe el morro
vuelve a apuntar a la carretera (`GOLPE_ENDEREZA`), los arcos de aviso salen 340 unidades antes en
vez de 200, y el rescate entra a los 2,2 s en vez de 3.
**A prueba, pendiente de que el dueño diga**: el volante mantiene el tope de 35º pero responde más
fino cerca del centro (`CURVA` 0,18 → 0,32 en `public/volante.js`). Lo que hay que mirar jugando:
si ahora cuesta menos ir recto y corregir sin volantazos, y si al final del recorrido sigue girando
igual de fuerte. Si parece blando, se vuelve a 0,18 y no se toca nada más.

**4. Gráficos «tipo Mario Kart».** El kart era un montón de cajas; ahora es un modelo de verdad
(bañera redondeada, pontones, alerón, asiento con el piloto y ruedas gordas con llanta), y el
plátano y el caparazón también. Están hechos **con Blender, por script**: `tools/blender/kart.py` y
`tools/blender/objetos.py` se pueden volver a ejecutar y rehacen los `.glb` de `public/modelos/`.
Encima, todo lleva **contorno oscuro de dibujo animado**: karts, objetos, quitamiedos y cajas. El
alerón y el parachoques trasero llevan el color del personaje, que es lo que se ve desde la cámara
de detrás. Si un modelo falta o falla, se dibuja lo de antes: la fiesta nunca se queda sin karts.

- **Cómo probarlo**: `npm start` y abrir la pantalla. El circuito que sale es Arcoíris. Lánzate
  contra el quitamiedos en diagonal: tienes que rebotar y seguir, no quedarte picoteando. Con
  `/visor.html?m=kart.glb` se ve el kart de cerca (y con `?m=platano.glb`, el plátano).
- **Medido en el navegador**: 60 fps con 8 karts y 8 paneles, con los modelos y los contornos.
- **Pendiente de probar en fiesta**: el volante más fino (punto 3), si 38 s de vuelta se hacen
  largos con 3 vueltas, y si la carretera transparente se ve bien en la tele de verdad (en el
  portátil se ve; en una tele grande y con la luz de la fiesta puede pedir menos transparencia:
  es `cielo ? 0.72 : 1` en `buildWorld`, en `public/screen.js`).

## 2026-09-19 — Una sola habilidad a la vez (ya era así, ahora está atado)

- El dueño pidió que solo se pueda llevar una habilidad guardada. **Ya funcionaba así** desde el
  principio: el kart tiene una única ranura, y con algo en la mano (o con la ruleta girando) pasar
  por una caja no hace nada. La caja ni se gasta: se queda para el siguiente.
- Lo que se ha hecho es **dejarlo atado con una prueba**, para que no se rompa sin querer al tocar
  los objetos: «solo se puede llevar una habilidad». Comprueba las cuatro situaciones (con objeto,
  con la ruleta girando, después de usarlo, y con las manos vacías).

## 2026-09-19 — Fuera el caparazón verde, llega el caracol 🐌

- **Se va el caparazón verde.** Era el objeto que menos hacía: salía recto y casi nunca acertaba.
- **Llega el caracol**, y es otra cosa: al usarlo **se para la carrera entera**, en tu móvil sale
  la lista de rivales, eliges a uno y esa persona va **un 75 % más lenta durante tres segundos**.
  En la tele se ve el cartelón con quién está eligiendo y los candidatos numerados, para que todo
  el mundo sepa por qué se ha parado todo y se vayan metiendo con el que tarda.
- **Para que la fiesta no se quede colgada**: quien elige tiene **seis segundos**; si no elige, se
  lo lleva quien vaya justo delante de él. Y si se le bloquea el móvil o se va en ese momento, se
  resuelve solo igual. Con el juego parado no corre ni el reloj de vuelta ni los turbos ni las
  estrellas de nadie: se congela todo de verdad.
- **Es raro a propósito**: al que va primero nunca le sale, y al último le sale una de cada diez
  cajas. Con el teclado se elige con los números 1 a 8.
- **Reparto de objetos**: al quitar el verde, el que va primero se quedaba con champiñón o plátano
  y casi siempre plátano; se le ha subido el champiñón para que sea mitad y mitad. La tabla exacta
  por posición está en la prueba «el reparto de objetos por posición es el declarado».
- **Cómo probarlo**: `npm start`, correr con un par de móviles hasta que a alguien le salga el
  caracol (o con el teclado, forzarlo desde la consola: `KART_DEBUG.state.karts[0].item='snail'`).
  Al usarlo todo tiene que congelarse, salir la lista en el móvil de quien lo usó y, al elegir,
  seguir la carrera con el elegido arrastrándose y dejando baba verde.
  **Pendiente de probar en fiesta**: si parar la carrera se hace pesado cuando pasa dos veces en
  la misma vuelta, y si seis segundos para elegir son muchos o pocos.

## 2026-09-19 — Retoques pedidos: volante como antes, habilidad abajo a la izquierda

- **El volante vuelve a ser el de siempre.** Me pasé de frenada al suavizarlo: el tope había subido
  de 35º a 55º con mucha curva y el kart parecía que no giraba. Vuelve el tope de **35º** y queda
  solo un pelín de curva (`CURVA = 0.18`), lo justo para que el temblor de la mano cerca del centro
  no dé un volantazo. A mitad de recorrido gira un 43 % (antes de todo esto, un 50 %).
- **La habilidad, abajo a la izquierda** de cada panel y con su propio recuadro oscuro, que es
  donde se mira en carrera. La posición se va abajo a la derecha.
- **Los nombres, diminutos y siempre del mismo tamaño**, esté el kart cerca o lejos: 11 píxeles,
  los mismos en todos los paneles. Para conseguirlo sin el fallo de los nombres gigantes, el tamaño
  se calcula **panel a panel** (en `carteles()`, con la cámara y el alto de ese panel) en vez de una
  vez por frame con la cámara del primero.
- **Cómo probarlo**: una carrera con varios móviles. Los nombres tienen que verse igual de pequeños
  te acerques o te alejes, y la habilidad en la esquina de abajo a la izquierda.

## 2026-09-19 — Con pantalla dividida ya se ve la carretera

- **Qué pasaba**: con varias personas, los nombres flotando sobre los karts tapaban media pantalla.
  Y no era solo que fueran grandes: los carteles se medían **en píxeles**, con la cámara del primer
  panel. La escena se dibuja una vez por panel pero el tamaño de un sprite es uno solo, así que un
  kart que estaba lejos de esa primera cámara y pegado a otra salía con el nombre **gigante** en el
  panel del vecino. Con ocho personas eran 64 nombres a la vez.
- **Qué cambió**:
  - Con pantalla dividida los carteles tienen **tamaño fijo en el mundo**, así que cada panel los
    ve del tamaño que toca según lo lejos que estén, como cualquier otra cosa de la escena.
  - **En tu panel no sale tu nombre ni tu objeto** flotando: ya los tienes en el mini-marcador de
    la esquina y ahí solo te tapaban la carretera que viene.
  - **Solo las personas llevan nombre encima.** Los bots no: saber cuál de los karts es tu amigo
    importa, los ocho nombres de los bots no. Y al nombre se le quita el «(bot)».
  - Los nombres de muy lejos no se dibujan, y el icono del objeto es bastante más pequeño.
  - **Tu kart se ve más grande**: la cámara va más cerca (210 → 180) y algo más baja, y el campo de
    visión se cierra un poco (70º → 66º).
- **Dónde tocarlo**: todos los números están juntos al principio de `public/screen.js`
  (`ETIQ_MUNDO`, `ICONO_MUNDO`, `CABEZA_MUNDO`, `ETIQ_LEJOS`, `CHASE_DIST`, `CHASE_HFOV`).
- **Cómo probarlo**: una carrera con dos o más móviles en Arcoíris. Tiene que verse la carretera
  entera, el castillo y el aro de lejos, y como mucho un nombre pequeño sobre la otra persona.
  **Pendiente de probar en fiesta**: si con 6-8 personas los nombres siguen siendo legibles a la
  distancia de un sofá.

## 2026-09-19 — Circuito Arcoíris, y el volante deja de ser un susto

Dos cosas que el dueño pidió después de probar el volante: que girar no fuera tan brusco y un
circuito ancho, largo y en el que no te salgas.

- **El volante ya no se va de lado**. Antes, con 35º de giro ya ibas a tope y la respuesta era
  recta: al sujetar el móvil la mano nunca está del todo quieta y cualquier temblor era medio
  volantazo. Ahora hay que girar hasta **55º** para el tope y, sobre todo, la respuesta es
  **progresiva**: a mitad del recorrido el kart gira un 27 % en vez de un 50 %, así que cerca del
  centro se puede corregir con finura y el giro fuerte se reserva para cuando tuerces el móvil de
  verdad. Los números están en `public/volante.js` (`MUERTA`, `TOPE`, `CURVA`).
- **Circuito nuevo: Arcoíris.** Es el «fácil»: la carretera mide **260 en vez de 110** (el doble
  de ancha) y lleva **quitamiedos en los dos lados de todo el recorrido**. Medido con
  `npm run race`: los ocho bots pasan **0,0 segundos fuera de pista**. No te sales, rebotas.
- **Tres veces más largo**: 12.632 px frente a los ~4.000 de los demás, unos **30 segundos por
  vuelta**. En la sala conviene ponerle **1 o 2 vueltas**, no 3. Tres rectas larguísimas unidas
  por dos horquillas anchas y un barrido enorme de vuelta por el fondo.
- **Lo que hay dentro**: tres rampas de salto, dos lomos, cinco paneles de turbo, un **aro gigante
  por el que se vuela** en el salto grande, y un **castillo con un árbol de cristal** por debajo
  del que se pasa a mitad del circuito. La carretera va cambiando de color a lo largo de la vuelta.
- **Lo que ha hecho falta por debajo**: un circuito así no cabe en la pantalla de 1920x1080 de
  siempre, así que ahora **cada circuito puede pedir su propio tamaño de mundo** (`world: {w,h}`
  en `tracks.js`; Arcoíris usa 3400x1950). La malla del terreno, los bordes, la cámara general, la
  niebla y el validador van con el mundo del circuito. Los cuatro circuitos de antes no cambian ni
  un pixel: `npm test` lo comprueba comparando sus tiempos con `tools/referencia.json`.
- **Lo que NO se ha podido hacer**: un **looping de verdad** (dar la vuelta completa boca abajo).
  La física del juego es plana con altura: hay saltos y cuestas, pero el kart nunca se pone del
  revés, y hacerlo posible sería rehacer el motor entero. El aro gigante por el que se vuela es lo
  más parecido que cabe hoy.
- **Cómo probarlo**: `npm start`, elegir **Arcoíris** en la sala (`←` `→`), poner 1 vuelta y correr.
  Mirar que no hay forma de salirse, que el castillo y el aro se ven venir de lejos, y que con el
  móvil se puede ir recto sin pelearse con el volante. **Pendiente de probar en fiesta**: si 55º de
  tope es mucho o poco, si 30 s por vuelta se hace largo, y los fps con 8 paneles en la tele de
  verdad (en pruebas, 51).

## 2026-09-19 — Se acabaron los anfitriones fantasma

- **Qué pasaba**: al entrar, a veces salía que **ya había otra persona de anfitrión** aunque
  estuvieras solo. Eran fantasmas de uno mismo: el móvil con el juego abierto en otra pestaña o en
  otra aplicación se reconecta solo y se queda con la corona, y como el sitio de un móvil
  desconectado se guarda 90 segundos, además te bloqueaba tu propio personaje. Activar el volante
  lo empeoraba: la dirección cifrada es otro sitio para el navegador, así que llegabas como un
  jugador nuevo y tu «yo» anterior se quedaba ahí.
- **Tres arreglos**:
  1. Al **activar el volante**, el salto se lleva tu identidad: llegas como el mismo jugador, con
     tu personaje y tu corona. Ya no aparece un segundo «tú».
  2. Si vuelves **sin identidad** (has borrado datos, o vienes de otra dirección) y pides el
     personaje de un jugador **desconectado**, recuperas su sitio en vez de chocar con un «ese
     personaje ya está cogido» contra tu propio fantasma.
  3. En la tele, **`V` dos veces vacía la sala**: echa a todos y todos vuelven a entrar. Es el
     último recurso cuando un móvil que ya nadie tiene delante se ha quedado de anfitrión. A los
     móviles echados les llega un aviso y **dejan de reconectarse solos** (si no, volvían a entrar
     al instante y no se vaciaba nada).
- **Y para verlo**: en la lista de la sala del móvil, tu jugador sale marcado con **(tú)** y los
  desconectados con **(sin conexión)**. Si ves tu nombre dos veces, ya sabes qué pasa.
- **Cómo probarlo**: entra con el móvil, pulsa «Activar el volante» y mira que en la sala sigues
  saliendo una sola vez y con tu corona. Y con alguien dentro, pulsa `V` dos veces en la tele: la
  sala tiene que quedarse vacía y ese móvil volver a su pantalla de entrar.
- `npm test`: tres comprobaciones nuevas en la prueba del protocolo (recuperar el sitio al volver
  por otra dirección, que no queda fantasma, y que al vaciar la sala llega `kicked` y quien entra
  después se queda solo y de anfitrión).

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
