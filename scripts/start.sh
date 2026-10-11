#!/usr/bin/env bash
# Start the LearnLoop API (port 8000) and web app (port 5173) together. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python
[ -x "$PY" ] || PY=.venv/Scripts/python
"$PY" -m uvicorn api.main:app --host 127.0.0.1 --port 8000 &
API=$!
trap 'kill $API 2>/dev/null' EXIT
cd web && npm run dev -- --strictPort
