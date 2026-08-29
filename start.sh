#!/usr/bin/env bash
# FlashResume — Backend API startup script
#
# WHY THIS EXISTS:
#   Running `uvicorn main:app` directly resolves to the GLOBAL uvicorn at
#   ~/.local/bin/uvicorn (shebang: #!/usr/bin/python3), which loads
#   ~/.local/lib/python3.14/site-packages — including a broken appmap
#   that prints ModuleNotFoundError: No module named 'yaml' on every startup.
#
#   This script bypasses the global binary by invoking the venv's Python
#   directly.  The venv has include-system-site-packages = false, so
#   ~/.local is never loaded.
#
#   AUTHORITATIVE RUNTIME: Python 3.11 (matches Dockerfile/Production)
#
# USAGE (from the repo root ~/Desktop/Flashresume):
#   chmod +x start.sh
#   ./start.sh            # plain start, port 8000
#   ./start.sh --reload   # hot-reload for development
#
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
PYTHON="$BACKEND_DIR/venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "ERROR: venv not found at $BACKEND_DIR/venv"
  echo "       Run: python3.11 -m venv backend/venv && backend/venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

# Strict runtime validation
PYTHON_VERSION=$("$PYTHON" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
if [[ "$PYTHON_VERSION" != "3.11" ]]; then
  echo "ERROR: Virtual environment is using Python $PYTHON_VERSION."
  echo "       FlashResume requires Python 3.11 to match the production container."
  echo "       Please delete the venv and recreate it using python3.11:"
  echo "       rm -rf backend/venv && python3.11 -m venv backend/venv"
  exit 1
fi

# Auto-start Redis if not running locally
REDIS_BIN="$SCRIPT_DIR/redis-stable/src/redis-server"
if [[ -x "$REDIS_BIN" ]]; then
  if ! "$PYTHON" -c "import socket; s = socket.socket(); s.settimeout(1); s.connect(('127.0.0.1', 6379))" 2>/dev/null; then
    echo "[start.sh] Redis server not detected on localhost:6379. Auto-starting Redis..."
    nohup "$REDIS_BIN" > "$SCRIPT_DIR/redis.log" 2>&1 &
    sleep 1
  fi
fi

echo "Python:  $("$PYTHON" -c 'import sys; print(sys.executable)')"
echo "Version: $("$PYTHON" --version)"
echo ""

cd "$BACKEND_DIR"
exec "$PYTHON" -m uvicorn main:app --port 8000 "$@"
