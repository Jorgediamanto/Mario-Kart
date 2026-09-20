/*
 * Kart Party — modo torneo (cuentas puras, sin navegador).
 *
 * Un torneo es **varias carreras seguidas** con los mismos karts: se suman puntos por posición,
 * la última carrera vale doble y al final hay podio. Entre carrera y carrera, cada móvil vota el
 * circuito siguiente.
 *
 * Aquí solo viven las cuentas (puntos, tabla, votación), para poder probarlas sin navegador. Lo
 * que se ve —la pantalla de clasificación, el podio, el confeti— está en `screen.js`, y la
 * pantalla de votar, en `play.js`.
 *
 * La **clave** de cada corredor es su personaje (`char`): en una sala hay siete personajes y siete
 * sitios, así que no se repite, y aguanta que los karts se creen de nuevo en cada carrera.
 */

// Puntos por puesto, de primero a séptimo. La última carrera del torneo los dobla.
export const PUNTOS = [10, 8, 6, 4, 3, 2, 1];

export function puntosDe(puesto, doble = false) {
  const p = PUNTOS[puesto - 1] || 0;
  return doble ? p * 2 : p;
}

/*
 * Suma a la tabla los resultados de una carrera. `resultados` es la lista de la carrera, en orden
 * de llegada: `[{ char, nombre, emoji, color }]`. Devuelve una tabla nueva (no toca la de antes).
 */
export function sumarCarrera(tabla, resultados, doble = false) {
  const nueva = new Map();
  for (const [char, fila] of tabla) nueva.set(char, { ...fila });
  resultados.forEach((r, i) => {
    const antes = nueva.get(r.char) || { char: r.char, nombre: r.nombre, emoji: r.emoji, color: r.color, puntos: 0, carreras: 0, victorias: 0 };
    nueva.set(r.char, {
      ...antes,
      nombre: r.nombre, emoji: r.emoji, color: r.color,
      puntos: antes.puntos + puntosDe(i + 1, doble),
      carreras: antes.carreras + 1,
      victorias: antes.victorias + (i === 0 ? 1 : 0),
      ultimosPuntos: puntosDe(i + 1, doble),
      ultimoPuesto: i + 1,
    });
  });
  return nueva;
}

/*
 * La tabla ordenada: más puntos primero; a igualdad, más victorias; y si siguen empatados, el mejor
 * puesto de la última carrera. Cada fila lleva `sube`: cuántos puestos ha ganado (o perdido)
 * respecto a la clasificación de antes, para pintar las flechitas.
 */
export function clasificacion(tabla, tablaAntes = null) {
  const orden = (t) => [...t.values()].sort((a, b) => (
    b.puntos - a.puntos || b.victorias - a.victorias || (a.ultimoPuesto || 99) - (b.ultimoPuesto || 99)
  ));
  const antes = tablaAntes ? orden(tablaAntes).map((f) => f.char) : null;
  return orden(tabla).map((fila, i) => ({
    ...fila,
    puesto: i + 1,
    sube: antes && antes.includes(fila.char) ? antes.indexOf(fila.char) - i : 0,
  }));
}

/*
 * El circuito de la siguiente carrera: gana **el más votado**. Si hay empate, o nadie ha votado, se
 * echa a suertes entre los que no se han jugado todavía (y si ya se han jugado todos, entre todos).
 * `votos` es un Map de jugador -> índice de circuito.
 */
export function circuitoGanador(votos, jugados, totalCircuitos, random = Math.random) {
  const cuenta = new Map();
  for (const i of votos.values()) {
    if (!Number.isInteger(i) || i < 0 || i >= totalCircuitos) continue;
    cuenta.set(i, (cuenta.get(i) || 0) + 1);
  }
  let mejor = -1, mejores = [];
  for (const [i, n] of cuenta) {
    if (n > mejor) { mejor = n; mejores = [i]; }
    else if (n === mejor) mejores.push(i);
  }
  if (mejores.length === 1) return { indice: mejores[0], votos: mejor, porSorteo: false };
  // empate o nadie ha votado: sorteo entre los que quedan por jugar
  const quedan = [];
  for (let i = 0; i < totalCircuitos; i++) if (!jugados.includes(i)) quedan.push(i);
  const bolsa = mejores.length > 1 ? mejores : (quedan.length ? quedan : null);
  const lista = bolsa || Array.from({ length: totalCircuitos }, (_, i) => i);
  return { indice: lista[Math.floor(random() * lista.length) % lista.length], votos: Math.max(0, mejor), porSorteo: true };
}

// ¿Es esta la última carrera del torneo? (la que puntúa doble)
export function esUltima(carreraActual, carrerasTotales) {
  return carreraActual >= carrerasTotales - 1;
}
