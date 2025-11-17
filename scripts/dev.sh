#!/usr/bin/env bash
set -euo pipefail

PIDS=()

cleanup() {
	echo "\n[dev] stopping services..."
	for pid in "${PIDS[@]}"; do
		if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
			kill "$pid" 2>/dev/null || true
		fi
	done
	wait "${PIDS[@]}" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

start_cmd() {
	local label="$1"
	shift
	echo "[dev] starting $label -> $*"
	"$@" &
	PIDS+=($!)
}

start_cmd "tailwind watcher" npm run dev:css
start_cmd "svelte watcher" npm run dev:svelte
start_cmd "backend" docker compose -f docker-compose-dev.yml up --build

wait "${PIDS[@]}"
