#!/usr/bin/env bash
set -euo pipefail

PIDS=()

cleanup() {
	echo "\n[dev] stopping services..."
	docker compose -f docker-compose-dev.yml down
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

start_cmd "backend" docker compose -f docker-compose-dev.yml up --build
start_cmd "svelte watcher" corepack pnpm run dev:svelte
start_cmd "tailwind watcher" corepack pnpm run dev:css
start_cmd "main watcher" npx esbuild app/static/js/main.ts --bundle --format=esm --target=es2022 --sourcemap --outfile=app/static/js/main.js --watch

wait "${PIDS[@]}"
