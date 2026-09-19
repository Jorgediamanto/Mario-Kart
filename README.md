# 🏁 Kart Party

Juego de karts **en 3D** al estilo Mario Kart para jugar con amigos en el salón:
**la tele es la pantalla del juego y cada móvil es un mando**. Hasta 8 corredores
(personas + bots), 4 circuitos con rampas, saltos, paneles turbo y bumpers que rebotan,
objetos (champiñón, plátano, caparazones, estrella, rayo), derrape automático con tres niveles de
turbo, trucos
en el aire, vueltas, posiciones y podio final. Físicas exageradas (los karts se aplastan,
se estiran, botan y vuelan) y colores chillones.

No hace falta instalar nada en los móviles: se abre una dirección web (o se escanea un QR).

## Requisitos

- Un ordenador con [Node.js](https://nodejs.org) 18 o superior, conectado a la tele
  (HDMI, AirPlay, Chromecast con "enviar pestaña"…). Vale cualquier portátil de los últimos años.
- Todos los móviles conectados **a la misma WiFi** que ese ordenador.
- Internet solo hace falta una vez, para `npm install`. La fiesta funciona sin conexión.

## Arrancar

```bash
npm install
npm start
```

Al arrancar, la terminal muestra dos direcciones:

```
Pantalla (abrir en el ordenador conectado a la tele):  http://localhost:3000
Mandos (los móviles, misma WiFi):                        http://192.168.1.40:3000/play
```

1. En el ordenador, abre `http://localhost:3000` en Chrome, Edge o Safari y pulsa **F** para
   ponerlo a pantalla completa. Haz clic una vez en la página para activar el sonido.
2. Cada amigo escanea el **código QR** que sale en la tele (o escribe la dirección de los mandos
   en el navegador del móvil), pone su nombre, elige personaje y pulsa **Entrar**.
3. El primero en entrar es el **anfitrión 👑**: desde su móvil elige circuito, vueltas y
   número de bots, y pulsa **¡EMPEZAR!**. Al terminar, pulsa **Otra carrera**.

La primera vez, macOS puede preguntar si permites que `node` acepte conexiones de red:
di que **sí** (si no, los móviles no podrán conectarse).

## Botón de arranque (macOS)

En la carpeta del juego hay una aplicación **`Kart Party.app`** (y un acceso directo con el mismo
nombre en el Escritorio): doble clic y se abre la Terminal con el servidor y, sola, la pantalla del
juego en el navegador. Es lo mismo que `Abrir Kart Party.command`, pero con icono. Para apagar el
juego, cierra esa ventana de la Terminal.

El volante de los móviles funciona igual arrancando así: el certificado se genera solo la primera
vez con el `openssl` que trae macOS, sin instalar nada. La terminal imprime las dos direcciones: la
del QR, por la que se entra siempre, y la del volante.

## Controles

**En el móvil: el móvil ES el volante.** Ponlo **en horizontal**, sujétalo con las dos manos y
**gíralo como si fuera un volante**, igual que el mando de la Wii. Conviene bloquear el giro de
pantalla para que no se dé la vuelta sola (en iPhone, desde el centro de control; en Android, el
botón «Pantalla completa» de la sala lo intenta solo).

Solo hay **dos botones**, cada uno de media pantalla, imposibles de fallar con el pulgar:

| Qué haces | Qué pasa |
|---|---|
| **Girar el móvil** | Girar. Es analógico: un poco de giro, un poco de curva |
| **GAS** (verde, derecha) | Acelerar |
| **OBJETO** (morado, izquierda) | Usar el objeto que llevas |
| **Volantazo en el aire** | Hacer un **truco** en los saltos: al aterrizar recibes turbo |
| **⊙ centrar** (arriba) | Volver a poner a cero el volante si te has torcido |

El volante se pone a cero solo al empezar cada cuenta atrás: sujeta el móvil como te resulte
cómodo y eso pasa a ser el centro. Da igual lo inclinado que lo tengas.

No hay freno ni marcha atrás: si te pierdes, te quedas clavado contra algo o te sales de la pista,
a los 3 segundos te recogen y te dejan otra vez en la carretera mirando hacia donde toca.

> **Cómo se enciende el volante.** Los navegadores solo dejan leer el giroscopio en conexiones
> cifradas, y el certificado del juego es suyo propio, así que el navegador enseña un aviso feo.
> Por eso **el QR lleva a la dirección normal**: se entra siempre a la primera, sin sustos. Ya
> dentro, en la sala del móvil hay un recuadro 🎡 con el botón **«Activar el volante»**, que salta
> a la dirección cifrada llevándose tu nombre y tu personaje. Ahí el navegador dirá que
> **«la conexión no es privada»** o que alguien podría estar robándote los datos: es este
> ordenador, y hay que **continuar igualmente**.
>
> | Navegador | Qué tocar |
> |---|---|
> | Chrome / Android | **Configuración avanzada** → *Acceder a 192.168… (no seguro)* |
> | Safari / iPhone | **Mostrar detalles** → *visitar este sitio web* → **Visitar sitio web** |
> | Firefox | **Avanzado** → *Aceptar el riesgo y continuar* |
>
> Si el móvil abre el QR dentro de otra aplicación (WhatsApp, Instagram, la cámara), esa ventanita
> a veces no deja continuar: abre la dirección en **Chrome o Safari de verdad** y ya está.
>
> ¿Lo quieres sin aviso nunca más en tu móvil? Entra en `http://…:3000/certificado.crt`, instálalo
> y (en iPhone) actívalo en *Ajustes → General → Información → Ajustes de confianza de
> certificados*. Se hace una vez. Para invitados de una noche no compensa.

**Si el móvil no tiene volante** (sin HTTPS, permiso denegado o móvil sin giroscopio), el mando
enseña solo los botones de siempre: ◀ ▶ para girar, los dos a la vez para ir marcha atrás, GAS y
OBJETO. Nadie se queda sin jugar. También puedes elegirlos a mano en la sala, con «Prefiero los
botones ◀ ▶».

**El derrape sale solo**: si aguantas el volante girado hacia el mismo lado a buena velocidad, el
kart empieza a deslizar a los 0,3 s y va cargando turbo. La barra del volante se enciende con el
color del nivel y el móvil vibra al subir: ★ azul (0,5 s), ★★ naranja (0,9 s) y ★★★ rosa (1,4 s).
Al enderezar —o cambiar de lado— sales disparado: 0,6, 1,0 o 1,6 segundos de turbo según lo que
hayas cargado. En las curvas normales se llega a uno o dos niveles; el tres es para las largas.

**En el ordenador** (quien está al lado del teclado también puede jugar):

| Tecla | Qué hace |
|---|---|
| `K` | Añadir/quitar el jugador de teclado (en la sala) |
| `Intro` | Empezar la carrera / volver a la sala tras los resultados |
| `←` `→` | Cambiar de circuito (en la sala; se ve girando detrás) |
| `L` | Cambiar el número de vueltas |
| `B` / `N` | Más / menos bots |
| `F` | Pantalla completa |
| `V` | Vaciar la sala (dos veces seguidas): echa a todos y vuelven a entrar |
| `P` | Ver los fps (para comprobar que va fino con la pantalla dividida) |
| Flechas, `Espacio` (objeto) | Conducir con el jugador de teclado (el derrape también sale solo) |

## La tele durante la carrera: pantalla dividida

Cada persona ve **su kart desde atrás**, en su propio panel de la tele: la cámara va un poco por
encima del kart, mira hacia donde vas, se aleja cuando corres, se abre y tiembla en los turbos y te
sigue en los saltos. Los bots no tienen panel.

| Corredores | Cómo se reparte la tele |
|---|---|
| 1 | pantalla completa |
| 2 | dos paneles anchos, uno encima del otro |
| 3 | dos arriba y uno ancho abajo |
| 4 | 2 × 2 |
| 5 | tres arriba y dos abajo |
| 6 | 3 × 2 |
| 7 | cuatro arriba y tres abajo |
| 8 | 4 × 2 |

Cada panel lleva su marcador pequeño: emoji y nombre, posición, vuelta, el objeto que llevas y los
avisos («¡TRUCO!», «¡ÚLTIMA VUELTA!», las estrellas del derrape). El tiempo de carrera va arriba en
medio, para todos. La sala, la cuenta atrás y los resultados se siguen viendo con la cámara general
del circuito, que enseña la pista entera.

## Cosas del circuito

- **Rampas ↗ SALTO**: la carretera sube y se corta: cuanto más rápido llegues, más lejos vuelas.
  Los lomos de la carretera también te hacen botar si vas a tope.
- **Paneles ➤ turbo**: pásales por encima.
- **Bumpers** de colores en los bordes de algunos tramos: rebotas como en los coches de choque.
- **Chocar con otro kart** lo empuja (y a ti), con un pequeño salto si vais fuerte.
- **Césped/arena/lava**: salirse frena mucho; cortar por fuera no cuenta para la vuelta.

## Objetos

Las cajas `?` del circuito dan un objeto aleatorio; cuanto más atrás vas, mejores objetos.
Si saltas por encima de un plátano o un caparazón, no te alcanzan.

- 🍄 **Champiñón**: turbo (y en el césped no te frena).
- 🍌 **Plátano**: lo dejas detrás; quien lo pise da un trompo y sale volando.
- 🐢 **Caparazón verde**: sale recto hacia delante.
- 🎯 **Caparazón rojo**: persigue al corredor que va justo delante de ti.
- ⭐ **Estrella**: unos segundos invencible y más rápido; si tocas a otro, lo haces girar.
- ⚡ **Rayo**: todos los demás se encogen y van más lentos un rato.

## Circuitos

| Circuito | Ambiente | Particularidad |
|---|---|---|
| Chicle | Prado de chicle: árboles de caramelo, globos, setas | Fácil, una rampa y dos lomos |
| Playa Neón | Atardecer, arena, palmeras, flamencos | Eses y rampa larga |
| Volcán Disco | Suelo morado, lava, cristales | Horquilla con bumpers y rampa alta |
| Luna Loca | Gravedad baja, cráteres, planetas | Dos rampas: saltos larguísimos |

Están en `public/tracks.js`: una lista de puntos por los que pasa la carretera más el relieve
(`features`), paneles turbo (`pads`), cajas (`boxes`) y bumpers (`barriers`). Si añades o cambias
uno, ejecuta `npm run check`: comprueba que no se solapa consigo mismo, que cabe en pantalla, que
no tiene curvas imposibles y que las cajas/paneles no caen encima de una rampa.

## Ajustes rápidos

- Velocidad de los karts: `BASE_MAX_SPEED` al principio de `public/sim.mjs`.
  Gravedad general: `GRAVITY` (y por circuito, `gravity` en `tracks.js`).
- Puerto: `PORT=3001 npm start` (el de HTTPS es ese más 443, o `HTTPS_PORT=...`).
  Para quitar el HTTPS y jugar solo con botones: `KART_HTTPS=0 npm start`.
- Si el QR muestra una IP que no es la de tu WiFi (por ejemplo tienes una VPN):
  `HOST_IP=192.168.1.40 npm start` (la IP correcta sale en la lista que imprime la terminal).

## Si algo no va

- **«La conexión no es privada» y no me deja pasar**: eso sale solo al activar el volante, nunca al
  entrar. Mira la tabla de arriba para saber qué tocar en cada navegador. Si el QR se abrió dentro
  de otra aplicación (WhatsApp, la cámara), esa ventanita no deja continuar: copia la dirección y
  ábrela en Chrome o Safari. Y si aun así no hay manera, **no pasa nada**: se juega igual con los
  botones ◀ ▶, que es lo que sale si no pulsas nada.
- **El volante no responde**: mira en la sala del móvil lo que dice el recuadro 🎡. Si ofrece
  activarlo, púlsalo (en iPhone hay que dar permiso al sensor después). Y si el móvil no tiene
  giroscopio, juega con los botones ◀ ▶.
- **El móvil gira la pantalla mientras juego**: bloquea la rotación (iPhone: centro de control;
  Android: el botón «Pantalla completa» de la sala intenta bloquearla en horizontal).
- **Los móviles no cargan la página**: comprueba que están en la misma WiFi (no en datos
  móviles ni en una WiFi de invitados), que el firewall permite `node`, y que no tienes VPN
  activa en el ordenador. Algunos routers tienen "aislamiento de clientes" que impide que los
  dispositivos se vean entre sí: desactívalo o usa el punto de acceso de un móvil como WiFi.
- **"El puerto 3000 está ocupado"**: arranca con `PORT=3001 npm start`.
- **La pantalla va a tirones**: cierra otras pestañas, conecta el portátil a la corriente y usa
  Chrome. En teles 4K ayuda poner la resolución del escritorio a 1080p.
- **No se oye nada en la tele**: haz clic una vez sobre la página del juego (los navegadores
  bloquean el sonido hasta que interactúas).
- **Dice que hay otra persona de anfitrión y no soy yo**: casi siempre es tu propio móvil, con el
  juego abierto en otra pestaña o en otra aplicación. En la lista de la sala, tu jugador sale
  marcado con **(tú)**: si ves tu nombre dos veces, cierra la otra. Si el anfitrión es alguien que
  ya se fue y nadie puede empezar la carrera, en la tele **pulsa `V` dos veces**: vacía la sala y
  todos vuelven a entrar escaneando el QR.
- **A alguien se le bloquea el móvil**: al desbloquearlo la página se reconecta sola y sigue
  con su kart; su sitio se guarda 90 segundos.
- **Se abrió la pantalla dos veces**: solo la última queda activa; la otra muestra un aviso.

## Comprobaciones y desarrollo nocturno

```bash
npm test        # sintaxis + circuitos + servidor + carreras de bots + móviles de mentira
```

La última fase de `npm test` (`tools/check-sim.js`) corre carreras enteras **sin navegador**: usa la
simulación de `public/sim.mjs` con ocho bots en los cuatro circuitos y comprueba que todos terminan,
que nadie se sale del mapa ni se queda atascado, que el orden de llegada cuadra con los tiempos y que
con la misma semilla sale exactamente la misma carrera. Debajo hay una lista de «escenarios» (el
plátano hace girar, la estrella protege, el derrape da turbo…) a la que conviene sumar uno nuevo cada
vez que se toca el juego. Con esto, un cambio de física se puede comprobar sin encender la tele.

Para mirar el juego de cerca sin jugarlo está `npm run race`:

```bash
npm run race                                  # una carrera en el primer circuito
npm run race -- --track all --runs 3          # los cuatro circuitos, tres carreras cada uno
npm run race -- --track 2 --laps 5 --verbose  # registro de todo, con tiempo y posición
npm run race -- --stats items                 # histogramas: items | drift | speed
npm run race -- --track all --runs 3 --json   # en JSON, para comparar antes y después de un cambio
```

Saca una tabla por carrera (posición, tiempo, mejor vuelta, objetos usados, golpes dados y recibidos,
saltos, trucos, paneles, tiempo fuera de pista y por el aire) y sirve para equilibrar objetos, derrape
y circuitos con datos. `npm run race -- --help` lista todas las opciones.

Un agente de Claude en la nube trabaja en el repositorio **dos veces cada noche** (02:30 y 05:30)
siguiendo el protocolo de `CLAUDE.md`: avanza en orden por la hoja de ruta de `IDEAS.md` (edítala
para mandar), guarda cada paso en una rama `noche/fecha` para no perder nada, y solo fusiona en `main`
cuando `npm test` y la «Comprobación» del punto están en verde. `PROGRESO.md` es su memoria entre
sesiones (dónde se quedó, qué falta) y `CHANGELOG.md` el diario de lo que cambió y cómo probarlo.

## Cómo está hecho

- `server.js`: servidor Node (sin frameworks) que sirve las páginas, genera el QR, sirve
  three.js desde `node_modules` y hace de relé WebSocket entre los móviles y la pantalla.
- `public/sim.mjs`: la simulación del juego (física, saltos, objetos, bots, vueltas, clasificación).
  No sabe nada del navegador: todo lo que se ve o se oye sale por un «hook», así que corre igual en la
  tele que en las pruebas.
- `public/index.html` + `public/screen.js`: la pantalla de la tele con [three.js](https://threejs.org);
  monta la simulación y le pone mundo 3D, modelos, partículas, cámara, HUD y sonido.
- `public/play.html` + `public/play.js`: el mando del móvil.
- `public/volante.js`: las cuentas del volante (de la inclinación del móvil a la dirección). Está
  aparte para poder comprobarlas sin navegador, con poses del móvil conocidas.
- `public/tracks.js` y `public/geom.js`: circuitos y geometría (spline Catmull-Rom).
- `tools/check-tracks.js`: validador de circuitos. `tools/check-sim.js`: carreras de prueba sin navegador.
- `tools/check-protocol.js`: prueba del protocolo con una pantalla y ocho móviles simulados.
- `tools/sim-race.js`: `npm run race`, carreras por consola con estadísticas.
