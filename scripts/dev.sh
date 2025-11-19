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

wait_for_port() {
	local port="$1"
	local retries=30
	local wait_seconds=2

	for ((i=0; i<retries; i++)); do
		if nc -z localhost "$port"; then
			echo "[dev] port $port is available"
			return 0
		else
			echo "[dev] waiting for port $port to be available..."
			sleep "$wait_seconds"
		fi
	done

	echo "[dev] timeout waiting for port $port"
	return 1
}

start_cmd "backend" docker compose -f docker-compose-dev.yml up --build -d
wait_for_port 8000
start_cmd "svelte watcher" npm run dev:svelte
start_cmd "tailwind watcher" npm run dev:css

wait "${PIDS[@]}"
