# Historial de cambios

Cada entrada dice qué cambió y cómo probarlo en la fiesta. Las entradas del agente nocturno
llevan la fecha en que se hicieron.

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
