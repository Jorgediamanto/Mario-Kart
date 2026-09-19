# Progreso del agente nocturno

Este archivo es la memoria entre sesiones. El agente lo lee al empezar y lo actualiza en **cada guardado**
(commit + push). Formato fijo: no borres secciones; escribe «ninguna» o «—» cuando no aplique. «Último latido»
es la hora del último push de la sesión: si tiene más de 45 minutos, la sesión se da por muerta y otra puede
retomar la rama.

## Sesión en curso
- inicio (UTC): 2026-09-19 03:31
- último latido (UTC): 2026-09-19 03:47
- rama: noche/2026-09-19

## Punto en curso
- IDEAS.md: 0.1 Simulación sin navegador (`public/sim.mjs` + carrera de bots en `npm test`)
- hecho: sim.mjs con toda la simulación + hooks; screen.js ya la usa (k.view para las mallas); server.js sirve .mjs; tools/check-sim.js (fase 4 de npm test) con 4 carreras, determinismo y 8 escenarios. `npm test` en verde.
- siguiente paso: documentación (CLAUDE.md, README.md, CHANGELOG.md), marcar 0.1 en IDEAS.md y anotar el bug del bot que se va en dirección contraria. Ojo: sin permiso de push en GitHub (403), todo está en commits locales.
- intentos fallidos en este punto: 0

## Última sesión
- fin (UTC): —
- resultado: —
- commits: —

## Notas para la siguiente sesión
- Primera noche: empieza por la Fase 0 de IDEAS.md (simulación sin navegador). El juego funciona tal cual está;
  no lo rompas por el camino: mueve código, no lo reescribas.
