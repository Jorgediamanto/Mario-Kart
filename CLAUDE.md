# Kart Party — guía para trabajar en este repo

Juego de karts 3D para fiestas: **la tele es la pantalla** (un navegador en un ordenador) y **cada
móvil es un mando** (una página web). Todo es JavaScript sin frameworks ni bundlers; la única
dependencia de render es three.js, servida desde `node_modules` en `/vendor/`.

## Cómo está montado

- `server.js` — servidor Node (http + `ws`): sirve `public/`, genera el QR (`qrcode`), sirve three.js
  y hace de **relé WebSocket** entre móviles y pantalla. No contiene lógica de juego.
- `public/index.html` + `public/screen.js` — la pantalla de la tele (módulo ES, three.js). Aquí vive
  **toda la simulación**: física (saltos, gravedad, bumpers, paneles turbo), objetos, bots, vueltas,
  clasificación, cámara, partículas, HUD y audio sintetizado. La sala y los resultados son HTML encima
  del canvas.
- `public/play.html` + `public/play.js` — el mando del móvil: botones táctiles, sala, estado de carrera.
- `public/tracks.js` — circuitos (puntos de control + relieve, cajas, paneles, bumpers, tema de colores).
  `public/geom.js` — spline Catmull-Rom y remuestreo (compartido con Node).
- `tools/check-tracks.js` — validador de circuitos. `tools/check-all.js` — comprobación completa (`npm test`).
- `Abrir Kart Party.command` — lanzador de doble clic para macOS.

Protocolo móvil ↔ servidor ↔ pantalla (JSON por WebSocket): `hello/welcome`, `lobby`, `roster`,
`phase`, `i` (botones: s,g,b,d), `use`, `start`, `again`, `set`, `st` (estado al móvil), `fx`,
`spectate`. Si cambias un mensaje, cambia las tres partes y mantén compatibilidad con móviles que
lleven la página cargada de antes (recarga automática no hay).

## Comprobar que no se rompe nada

```bash
npm ci
npm test        # sintaxis de todos los archivos + validador de circuitos + arranque real del servidor
```

`npm test` tiene que pasar antes de subir nada a `main`. No hay tests de navegador: cuando toques
`screen.js`, revisa con cuidado que el código sea válido como módulo ES y que no uses APIs de
three.js que no existan en la versión instalada (`node_modules/three/package.json`).

## Reglas

- La interfaz y los textos están en **español** (tono cercano, sin tecnicismos).
- Sin dependencias nuevas salvo que sean imprescindibles y ligeras; nunca subas `node_modules`.
- La fiesta se juega en una WiFi local sin internet: nada de CDNs ni servicios externos en tiempo de juego.
- Mantén el rendimiento: la pantalla debe ir a 60 fps en un portátil normal (ojo con partículas,
  sombras y mallas grandes). Máximo 8 karts.
- Las físicas son exageradas pero controlables: los cambios de sensación (velocidad, gravedad, giro)
  deben ser pequeños y justificados. Constantes principales al inicio de `screen.js`.
- Circuitos nuevos: añade la definición en `tracks.js` y pasa `npm run check` (sin solapes, radios de
  curva válidos, cajas/paneles fuera de rampas).
- Commits en español, con un mensaje que explique el porqué.

## Trabajo nocturno automático

Un agente en la nube trabaja en este repo cada noche. Su guion:

1. Lee `IDEAS.md` (lista priorizada por fases, editada por el dueño) y `CHANGELOG.md`.
2. Avanza por `IDEAS.md` **en orden**: primero los bugs anotados, luego el primer punto pendiente.
   Cada punto tiene que quedar terminado y probado antes de pasar al siguiente; mejor dos perfectos
   que tres a medias. Si un punto no cabe en una noche, deja una parte coherente y anota qué falta.
3. Por cada punto: implementa, ejecuta `npm test` y corrige hasta que pase.
4. Si pasa: marca el punto en `IDEAS.md`, añade una entrada fechada en `CHANGELOG.md` (qué cambió,
   cómo probarlo en la fiesta) y sube a `main` (un commit por punto). Si queda sesión, siguiente punto.
5. Si no pasa o hay dudas de que el juego siga funcionando: **no toques `main`** con ese punto; sube
   una rama `noche/AAAA-MM-DD` y abre un Pull Request explicando qué falta.
