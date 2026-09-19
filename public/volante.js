/*
 * Kart Party — el volante del móvil (cuentas puras, sin navegador).
 *
 * El móvil se sujeta en horizontal con las dos manos y se gira como un volante, al estilo del
 * mando de la Wii. La idea: de `deviceorientation` sacamos hacia dónde tira **la gravedad en
 * coordenadas del móvil**; al «centrar» guardamos ese vector, y a partir de ahí el ángulo entre
 * el de ahora y el guardado, medido en el plano de la pantalla, es exactamente cuánto has girado
 * el volante.
 *
 * Lo bueno de medirlo así:
 *  - da igual lo inclinado que sujetes el móvil (tumbado, de pie, a 45°): solo cuenta el giro
 *    alrededor del eje que sale de la pantalla, que es el del volante;
 *  - da igual si la pantalla está en horizontal o en vertical, porque ese eje no cambia;
 *  - no hace falta brújula (`alpha`), que es justo lo que va mal en los móviles.
 * Lo único que no se puede medir es con el móvil **plano** mirando al techo: ahí la gravedad no
 * dice hacia dónde has girado (`hayGravedad` avisa).
 *
 * Está aparte de `play.js` para poder probarlo sin navegador, igual que `geom.js`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KART_VOLANTE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /*
   * Cuánto hay que girar el móvil y con qué finura.
   *
   * Historia, para no volver a pasarse: primero el tope estaba en 35º con respuesta recta y al
   * dueño le pareció brusco; se subió a 55º con respuesta muy progresiva y entonces le pareció
   * que el kart no giraba («¿te has tomado demasiado en serio lo de girar menos?»). Así que
   * vuelve el tope de 35º de siempre y queda solo un pelín de curva, lo justo para que el
   * temblor de la mano cerca del centro no dé un volantazo. Si hay que retocarlo otra vez, es
   * aquí y en un solo número: `TOPE` para cuánto hay que girar, `CURVA` para la finura.
   */
  const MUERTA = 5 * Math.PI / 180;    // zona muerta: por debajo de esto no cuenta como girar
  const TOPE = 35 * Math.PI / 180;     // a partir de aquí, volante a tope
  const CURVA = 0.18;                  // cuánta parte de la respuesta es progresiva (0 = recta)
  const PLANO = 0.3;                   // con el móvil más plano que esto no se puede medir el giro
  const FILTRO = 0.35;                 // suavizado del temblor de la mano (0 = nada, 1 = sin filtrar)

  // Hacia dónde tira la gravedad, en coordenadas del móvil, solo el plano de la pantalla.
  // (beta y gamma en grados, tal como los da `deviceorientation`.)
  function gravedad(beta, gamma) {
    const b = beta * Math.PI / 180, g = gamma * Math.PI / 180;
    return { x: Math.sin(g) * Math.cos(b), y: -Math.sin(b) };
  }
  // ¿Se puede medir el giro, o el móvil está demasiado plano?
  function hayGravedad(v) { return Math.hypot(v.x, v.y) >= PLANO; }
  // Ángulo girado desde el centro guardado (radianes; negativo = a la izquierda).
  function angulo(centro, v) {
    return Math.atan2(centro.x * v.y - centro.y * v.x, centro.x * v.x + centro.y * v.y);
  }
  // Del ángulo a la dirección que entiende el juego: -1 (todo a la izquierda) .. 1 (a la derecha).
  // La respuesta no es recta: `t` (lo girado, de 0 a 1) pasa por una curva que aplasta el
  // principio del recorrido, para poder corregir sin que el kart dé un volantazo.
  function direccion(ang) {
    const a = Math.abs(ang);
    if (a <= MUERTA) return 0;
    const t = Math.min(1, (a - MUERTA) / (TOPE - MUERTA));
    const suave = t * ((1 - CURVA) + CURVA * t * t);
    return (ang < 0 ? -1 : 1) * suave;
  }
  function suaviza(anterior, nuevo) { return anterior + (nuevo - anterior) * FILTRO; }

  return { MUERTA, TOPE, PLANO, FILTRO, gravedad, hayGravedad, angulo, direccion, suaviza };
});
