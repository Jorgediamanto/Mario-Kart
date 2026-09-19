/*
 * Geometría de circuitos: spline Catmull-Rom cerrada + remuestreo uniforme.
 * Compartido entre el navegador (pantalla) y Node (herramienta de validación).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KART_GEOM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Curva cerrada que pasa por todos los puntos de control
  function catmullRomClosed(pts, segs) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let j = 0; j < segs; j++) {
        const t = j / segs, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        out.push({ x, y });
      }
    }
    return out;
  }

  // Polilínea cerrada -> puntos separados exactamente `spacing` px (el último tramo puede ser algo más corto)
  function resampleClosed(pts, spacing) {
    const out = [];
    let carry = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      let d = carry;
      while (d < len) {
        const t = d / len;
        out.push({ x: a.x + dx * t, y: a.y + dy * t });
        d += spacing;
      }
      carry = d - len;
    }
    // evitamos una muestra casi duplicada en la costura
    if (out.length > 2) {
      const a = out[out.length - 1], b = out[0];
      if (Math.hypot(a.x - b.x, a.y - b.y) < spacing * 0.5) out.pop();
    }
    return out;
  }

  // Devuelve las muestras de la línea central con su ángulo (dirección de carrera)
  function buildSamples(points, spacing) {
    const samples = resampleClosed(catmullRomClosed(points, 24), spacing);
    const N = samples.length;
    for (let i = 0; i < N; i++) {
      const a = samples[(i - 1 + N) % N], b = samples[(i + 1) % N];
      samples[i].ang = Math.atan2(b.y - a.y, b.x - a.x);
    }
    return samples;
  }

  return { catmullRomClosed, resampleClosed, buildSamples };
});
