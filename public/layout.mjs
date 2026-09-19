/*
 * Kart Party — reparto de la tele en paneles (pantalla dividida).
 *
 * Función pura, sin navegador ni three.js: dado cuántas personas juegan (1 a 8), devuelve un
 * rectángulo por persona en fracciones de pantalla (0 a 1), con el origen ARRIBA a la izquierda,
 * como el CSS. `screen.js` los convierte en `setViewport`/`setScissor` (que cuentan desde abajo)
 * y en la posición del mini-HUD de cada panel. Los bots no tienen panel.
 *
 * La tele es 16:9, así que el reparto busca paneles lo más anchos posible sin dejar huecos:
 *
 *   1 persona  → pantalla completa
 *   2          → dos paneles anchos, uno encima del otro (como en los juegos de karts de consola:
 *                 en 16:9, partir por la mitad a lo ancho deja dos paneles muy estrechos)
 *   3          → arriba 2, abajo 1 (ancho)
 *   4          → 2 × 2
 *   5          → arriba 3, abajo 2
 *   6          → 3 × 2
 *   7          → arriba 4, abajo 3
 *   8          → 4 × 2
 *
 * Con un número impar, la fila de abajo lleva un panel menos y sus paneles salen más anchos: así
 * no queda un cuadro negro en la tele.
 */

// Cuántos paneles van en cada fila, de arriba abajo
export function filasDePaneles(n) {
  const total = Math.max(1, Math.min(8, Math.floor(n) || 1));
  if (total === 1) return [1];
  if (total === 2) return [1, 1];
  const arriba = Math.ceil(total / 2);
  return [arriba, total - arriba];
}

/**
 * Rectángulos de los paneles, en el mismo orden que las personas que se pasen.
 * Cada uno es { x, y, w, h } en fracciones de pantalla, con y = 0 arriba.
 */
export function panelLayout(n) {
  const filas = filasDePaneles(n);
  const alto = 1 / filas.length;
  const rects = [];
  for (let f = 0; f < filas.length; f++) {
    const cuantos = filas[f];
    const ancho = 1 / cuantos;
    for (let c = 0; c < cuantos; c++) {
      rects.push({ x: c * ancho, y: f * alto, w: ancho, h: alto });
    }
  }
  return rects;
}

/**
 * El mismo rectángulo en píxeles y con el origen ABAJO, que es como lo quiere el renderer de
 * three.js (`setViewport`, `setScissor`).
 */
export function panelEnPixeles(rect, anchoTele, altoTele) {
  return {
    x: Math.round(rect.x * anchoTele),
    y: Math.round((1 - rect.y - rect.h) * altoTele),
    w: Math.round(rect.w * anchoTele),
    h: Math.round(rect.h * altoTele),
  };
}
