#!/bin/bash
# Doble clic en este archivo para arrancar Kart Party.
cd "$(dirname "$0")" || exit 1
clear
echo "🏁  KART PARTY"
echo

# Node.js: la ventana de Terminal abierta desde el Finder a veces no tiene el PATH completo
if ! command -v node >/dev/null 2>&1; then
  for p in /opt/homebrew/bin /usr/local/bin "$HOME"/.nvm/versions/node/*/bin "$HOME"/.volta/bin; do
    if [ -x "$p/node" ]; then export PATH="$p:$PATH"; break; fi
  done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "No encuentro Node.js. Instálalo desde https://nodejs.org (versión LTS) y vuelve a hacer doble clic."
  echo; read -n 1 -s -r -p "Pulsa cualquier tecla para cerrar…"; echo; exit 1
fi

# Dependencias (solo la primera vez o si faltan)
if [ ! -d node_modules/three ] || [ ! -d node_modules/ws ] || [ ! -d node_modules/qrcode ]; then
  echo "Instalando lo necesario (solo la primera vez, hace falta internet)…"
  npm install --no-fund --no-audit || { echo; echo "La instalación ha fallado. ¿Hay conexión a internet?"; read -n 1 -s -r -p "Pulsa una tecla para cerrar…"; echo; exit 1; }
  echo
fi

PORT="${PORT:-3000}"
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Kart Party ya parece estar en marcha en el puerto $PORT. Abro la pantalla…"
  open "http://localhost:$PORT"
  echo; read -n 1 -s -r -p "Pulsa una tecla para cerrar esta ventana…"; echo; exit 0
fi

# Abre la pantalla del juego en el navegador en cuanto arranque el servidor
( sleep 1.5; open "http://localhost:$PORT" ) &

echo "Para apagar el juego: cierra esta ventana o pulsa Ctrl+C."
echo "Pulsa F en la pantalla del juego para ponerla a pantalla completa."
echo
PORT="$PORT" node server.js
