#!/usr/bin/env bash
# Startet LetsMeet lokal (Vite + Netlify Functions) auf http://localhost:8888
set -euo pipefail

cd "$(dirname "$0")"

# Verwaiste Dev-Server auf den Ports beenden, sonst schlaegt der Start fehl
for port in 5173 8888; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Beende Prozess(e) auf Port $port: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
done

npm run dev:netlify
