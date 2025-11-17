#!/bin/bash
set -euo pipefail

npm run dev:css &
npm run dev:svelte &
docker compose up
