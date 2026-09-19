# Ideas y bugs para Kart Party

El agente nocturno trabaja esta lista **en orden**: cada noche coge el primer punto pendiente,
lo termina completo y probado, hace commit, y si le queda sesión sigue con el siguiente. Los bugs
van siempre primero. Edita este archivo para mandar: reordena, añade, tacha. Marca con `[x]` lo hecho.

## Bugs conocidos

- [ ] (ninguno anotado; si ves uno, escríbelo aquí con cómo reproducirlo)

## Fase 1 — cambios pedidos por el dueño (hacer en este orden)

- [ ] **Mando de móvil con solo 4 botones grandes.** Los botones de girar de ahora son demasiado
      pequeños. Nuevo `play.html`/`play.js`: la mitad izquierda de la pantalla son dos botones
      enormes ◀ ▶ (cada uno la mitad del ancho de esa zona y toda la altura); la mitad derecha son
      dos botones: arriba **OBJETO** (usar la habilidad; muestra el icono del objeto o «—») y
      abajo **GAS**, más grande que el de objeto. Nada más: sin FRENO ni DERRAPE. Tiene que
      funcionar en vertical y en horizontal, con multitáctil (girar mientras se acelera), sin zoom
      ni scroll accidental. Detalles necesarios para que no falte nada:
      - Marcha atrás / freno: pulsar **los dos botones de girar a la vez**. Anúncialo en la sala.
      - Rescate automático: si un kart está más de 3 s parado, atascado o lejos de la carretera,
        una animación lo recoloca en el punto más cercano de la pista mirando en el sentido correcto
        (como Lakitu en Mario Kart), con una pequeña penalización de tiempo.
      - Truco en el aire: al despegar en una rampa, tocar cualquier botón de girar en el aire hace el
        truco (turbo al aterrizar). Documéntalo en la pantalla de la sala.
      - El protocolo de botones (`i`: s,g,b,d) puede seguir igual: el móvil manda `b` cuando se pulsan
        los dos giros y `d` siempre 0 (el derrape es automático, ver siguiente punto).
      - Actualiza README.md y los textos de ayuda de la sala.
- [ ] **Derrape automático con 3 niveles.** Sin botón de derrape: si el jugador mantiene el giro en
      la misma dirección más de ~0,35 s a velocidad suficiente (> 55 % de la máxima), el kart entra
      en derrape solo (deslizamiento y chispas). Mientras siga girando en esa dirección acumula
      nivel: **nivel 1** a ~0,8 s (chispas azules), **nivel 2** a ~1,6 s (naranjas), **nivel 3** a
      ~2,6 s (rosas/moradas). Al soltar el giro o cambiar de dirección sale disparado con un turbo
      proporcional al nivel (por ejemplo 0,6 s / 1,0 s / 1,6 s de turbo, con estirón del kart y
      sonido creciente). El nivel debe verse en el móvil (texto/color del botón de giro y una
      vibración corta al subir de nivel: manda un `fx` nuevo) y en la pantalla (color de chispas y un
      brillo bajo el kart). Los bots usan el mismo sistema. Ajusta los tiempos para que en curvas
      normales se llegue al nivel 1-2 y solo en horquillas/curvas largas al 3. Quita cualquier resto
      del derrape manual en pantalla, móvil y README.
- [ ] **Vista en tercera persona por jugador (pantalla dividida).** En vez de la cámara general del
      circuito, cada persona ve **su kart desde atrás y un poco arriba**, cámara que sigue al kart
      con suavidad (mira algo por delante, se aleja un poco con la velocidad, se agita ligeramente en
      turbos y golpes, y sigue al kart en los saltos). Como todos comparten la tele, la pantalla se
      divide en paneles: 1 jugador → pantalla completa; 2 → dos paneles (lado a lado o arriba/abajo,
      el que mejor aproveche el 16:9); 3-4 → 2×2; 5-6 → 3×2; 7-8 → 4×2. Solo las personas tienen
      panel (los bots no). Cada panel lleva su mini-HUD: nombre y emoji, posición, vuelta, objeto que
      lleva, y avisos («¡Última vuelta!», «¡Truco!»). La cuenta atrás y el «¡YA!» se ven en todos
      los paneles. La sala, la cuenta atrás inicial (puede empezar con una vista general y hacer zoom
      a cada kart) y los resultados pueden seguir usando la cámara general. Implementación: render
      con `renderer.setScissor`/`setViewport` por panel, una cámara por jugador, HUD HTML posicionado
      sobre cada panel. Rendimiento: 60 fps con 4 paneles y al menos 30 con 8 en un portátil normal
      (reduce partículas/decoración por panel si hace falta, y mantén las etiquetas de nombre legibles
      a esa distancia de cámara). Los karts deben seguir siendo reconocibles desde atrás: refuerza
      el color y el emoji del piloto. Actualiza README.md.

## Fase 2 — iterar sobre la versión final (cuando la fase 1 esté completa)

- [ ] **Mejorar los circuitos para la vista en tercera persona.** Ahora se juega viendo desde
      detrás: las rampas, paneles turbo, cajas y bumpers deben verse venir con antelación (carteles,
      arcos, luces); las curvas deben tener referencias visuales (bordillos altos, decoración en el
      exterior) y ninguna curva ciega peligrosa. Añade variedad: chicanes, curvas largas para derrapar
      al nivel 3, algún atajo con riesgo (más corto pero estrecho o con salto exigente). Revisa la
      anchura de la carretera (quizá algo más ancha) y valida todo con `npm run check`. Hazlo circuito
      a circuito, con una entrada en CHANGELOG por cada uno.
- [ ] **Afinar las habilidades (objetos).** Con la nueva vista y el derrape automático, equilibra:
      duración y potencia de turbo/estrella/rayo, velocidad y homing de los caparazones, distancia de
      lanzamiento, probabilidades por posición (el último debe remontar pero el primero no debe sentirse
      injusto) y feedback en pantalla y móvil (vibración, flash, sonido) de cada objeto. Que funcione
      igual de bien con 2 y con 8 corredores. Anota en CHANGELOG los valores antes/después y el porqué.
- [ ] Tras cada iteración, jugar mentalmente una carrera completa con 4 personas y revisar que
      nada de lo anterior (rescate, derrape, paneles, objetos) se haya roto.

## Fase 3 — más ideas (por orden de prioridad)

- [ ] Música de fondo sintetizada (WebAudio) con un tema alegre en la sala y otro más rápido en
      carrera, con botón/tecla para silenciar. Nada de archivos externos.
- [ ] Sonido de motor por kart (pitch según velocidad) que suene bien con 8 karts sin saturar.
- [ ] Un quinto circuito con cruce a distinto nivel (puente) o un túnel; validar con `npm run check`.
- [ ] Selección de kart en el móvil: 3 tipos (ligero: acelera más pero le empujan; medio; pesado:
      más velocidad punta y empuja más) que cambien de verdad las físicas.
- [ ] Control por inclinación del móvil (giroscopio) como opción, además de los botones.
- [ ] Objeto nuevo: «bomba» que se lanza y explota al cabo de 2 s empujando a los karts cercanos.
- [ ] Repetición de los últimos 5 segundos de la llegada del ganador (cámara cinematográfica) en
      la pantalla de resultados.
- [ ] Modo torneo: 3 carreras seguidas con puntuación acumulada y podio final.
- [ ] Mejorar los bots: que usen los paneles turbo a propósito, que esquiven plátanos y que sea
      configurable su dificultad (fácil/normal/difícil) desde el móvil del anfitrión.
- [ ] Efecto de «rubber banding» suave para que los rezagados no se descuelguen (solo bots).
- [ ] Estadísticas de fin de carrera: mejor vuelta, más saltos, más golpes recibidos, etc.
- [ ] Accesibilidad: colores de los karts también distinguibles por forma/icono para daltónicos.
