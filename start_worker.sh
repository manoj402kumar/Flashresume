#!/usr/bin/env bash
# FlashResume — Heavy Worker startup script
#
# Same rationale as start.sh — uses the project venv Python directly.
#
# USAGE (from the repo root ~/Desktop/Flashresume):
#   chmod +x start_worker.sh
#   ./start_worker.sh
#
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
PYTHON="$BACKEND_DIR/venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "ERROR: venv not found at $BACKEND_DIR/venv"
  exit 1
fi

# Auto-start Redis if not running locally
REDIS_BIN="$SCRIPT_DIR/redis-stable/src/redis-server"
if [[ -x "$REDIS_BIN" ]]; then
  if ! "$PYTHON" -c "import socket; s = socket.socket(); s.settimeout(1); s.connect(('127.0.0.1', 6379))" 2>/dev/null; then
    echo "[start_worker.sh] Redis server not detected on localhost:6379. Auto-starting Redis..."
    nohup "$REDIS_BIN" > "$SCRIPT_DIR/redis.log" 2>&1 &
    sleep 1
  fi
fi

echo "Python:  $("$PYTHON" -c 'import sys; print(sys.executable)')"
echo "Version: $("$PYTHON" --version)"
echo ""

cd "$BACKEND_DIR"
exec "$PYTHON" worker.py
