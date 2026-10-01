#!/data/data/com.termux/files/usr/bin/bash
# =======================================================
#   TIENDA POS - INICIANDO EN ANDROID TERMUX
# =======================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/backend"

echo ""
echo "======================================================="
echo "  🚀 INICIANDO TIENDA POS (ANDROID TERMUX)"
echo "======================================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "[!] Node.js no detectado. Instalando automaticamente..."
    pkg update -y && pkg install nodejs -y
fi

echo "[OK] Node.js detectado: $(node -v)"
echo "[OK] Iniciando servidor en puerto 3005..."
echo ""
echo "======================================================="
echo "  ✅ ACCESO LOCAL:  http://localhost:3005"
echo "======================================================="
echo ""

# Abrir navegador automaticamente en Android tras 2 segundos
(
    sleep 2
    if command -v termux-open-url &> /dev/null; then
        termux-open-url "http://localhost:3005" &> /dev/null
    elif command -v am &> /dev/null; then
        am start -a android.intent.action.VIEW -d "http://localhost:3005" &> /dev/null
    fi
) &

node server.js
