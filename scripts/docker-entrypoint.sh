#!/usr/bin/env bash
set -euo pipefail

DEV_MODE="${DEV_MODE:-prod}"
PIDS=()

shutdown() {
  for pid in "${PIDS[@]:-}"; do
    if [[ -n "$pid" && "$pid" -ne $$ ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap shutdown EXIT INT TERM

if [[ "$DEV_MODE" == "dev" ]]; then
  echo "[entrypoint] DEV_MODE=dev, installing JS deps and launching watchers"
  npm ci
  echo "[entrypoint] starting Tailwind watcher..."
  npm run dev:css &
  PIDS+=($!)
  echo "[entrypoint] starting Svelte watcher..."
  npm run dev:svelte &
  PIDS+=($!)
else
  echo "[entrypoint] DEV_MODE=$DEV_MODE, starting without watchers"
fi

exec "$@"
