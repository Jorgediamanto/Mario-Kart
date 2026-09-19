# 🏁 Kart Party

Juego de karts **en 3D** al estilo Mario Kart para jugar con amigos en el salón:
**la tele es la pantalla del juego y cada móvil es un mando**. Hasta 8 corredores
(personas + bots), 4 circuitos con rampas, saltos, paneles turbo y bumpers que rebotan,
objetos (champiñón, plátano, caparazones, estrella, rayo), derrapes con miniturbo, trucos
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

## Controles

**En el móvil** (mejor en horizontal):

| Botón | Qué hace |
|---|---|
| ◀ ▶ | Girar |
| GAS | Acelerar |
| FRENO | Frenar / marcha atrás |
| DERRAPE | Mantén pulsado en las curvas mientras giras: gira más cerrado y, al soltar tras ~0,7 s, sale un **miniturbo** (más largo si aguantas 1,6 s). **En el aire**, púlsalo para hacer un **truco**: al aterrizar recibes turbo |
| Objeto (morado) | Usar el objeto que llevas |

**En el ordenador** (quien está al lado del teclado también puede jugar):

| Tecla | Qué hace |
|---|---|
| `K` | Añadir/quitar el jugador de teclado (en la sala) |
| `Intro` | Empezar la carrera / volver a la sala tras los resultados |
| `←` `→` | Cambiar de circuito (en la sala; se ve girando detrás) |
| `L` | Cambiar el número de vueltas |
| `B` / `N` | Más / menos bots |
| `F` | Pantalla completa |
| Flechas, `⇧` (derrape/truco), `Espacio` (objeto) | Conducir con el jugador de teclado |

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

- Velocidad de los karts: `BASE_MAX_SPEED` al principio de `public/screen.js`.
  Gravedad general: `GRAVITY` (y por circuito, `gravity` en `tracks.js`).
- Puerto: `PORT=3001 npm start`.
- Si el QR muestra una IP que no es la de tu WiFi (por ejemplo tienes una VPN):
  `HOST_IP=192.168.1.40 npm start` (la IP correcta sale en la lista que imprime la terminal).

## Si algo no va

- **Los móviles no cargan la página**: comprueba que están en la misma WiFi (no en datos
  móviles ni en una WiFi de invitados), que el firewall permite `node`, y que no tienes VPN
  activa en el ordenador. Algunos routers tienen "aislamiento de clientes" que impide que los
  dispositivos se vean entre sí: desactívalo o usa el punto de acceso de un móvil como WiFi.
- **"El puerto 3000 está ocupado"**: arranca con `PORT=3001 npm start`.
- **La pantalla va a tirones**: cierra otras pestañas, conecta el portátil a la corriente y usa
  Chrome. En teles 4K ayuda poner la resolución del escritorio a 1080p.
- **No se oye nada en la tele**: haz clic una vez sobre la página del juego (los navegadores
  bloquean el sonido hasta que interactúas).
- **A alguien se le bloquea el móvil**: al desbloquearlo la página se reconecta sola y sigue
  con su kart; su sitio se guarda 90 segundos.
- **Se abrió la pantalla dos veces**: solo la última queda activa; la otra muestra un aviso.

## Comprobaciones y desarrollo nocturno

```bash
npm test        # sintaxis + validador de circuitos + arranca el servidor y pide cada página
```

Un agente de Claude en la nube trabaja en el repositorio **dos veces cada noche** (02:30 y 05:30)
siguiendo el protocolo de `CLAUDE.md`: avanza en orden por la hoja de ruta de `IDEAS.md` (edítala
para mandar), guarda cada paso en una rama `noche/fecha` para no perder nada, y solo fusiona en `main`
cuando `npm test` y la «Comprobación» del punto están en verde. `PROGRESO.md` es su memoria entre
sesiones (dónde se quedó, qué falta) y `CHANGELOG.md` el diario de lo que cambió y cómo probarlo.

## Cómo está hecho

- `server.js`: servidor Node (sin frameworks) que sirve las páginas, genera el QR, sirve
  three.js desde `node_modules` y hace de relé WebSocket entre los móviles y la pantalla.
- `public/index.html` + `public/screen.js`: la pantalla de la tele con [three.js](https://threejs.org);
  aquí corre toda la simulación (física, saltos, objetos, bots, clasificación) y el render 3D.
- `public/play.html` + `public/play.js`: el mando del móvil.
- `public/tracks.js` y `public/geom.js`: circuitos y geometría (spline Catmull-Rom).
- `tools/check-tracks.js`: validador de circuitos.
