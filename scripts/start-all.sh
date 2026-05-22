#!/usr/bin/env bash
# Start A1111 + canon-forge in one command.
# Usage: npm run dev:all
set -euo pipefail

SD_LAUNCH="$HOME/stable-diffusion-webui/launch-canon-forge.sh"
SD_URL="http://localhost:7860"

if curl -s --max-time 2 "$SD_URL/sdapi/v1/sd-models" &>/dev/null; then
  echo "[A1111] Already running at $SD_URL — skipping startup"
  exec npx concurrently \
    --names "vite,server" \
    --prefix-colors "cyan,magenta" \
    --kill-others \
    "npx vite" \
    "node server/index.js"
fi

if [[ ! -f "$SD_LAUNCH" ]]; then
  echo "[warn] A1111 not found — run scripts/setup-local-sd.sh first"
  echo "[warn] Starting canon-forge only..."
  exec npx concurrently \
    --names "vite,server" \
    --prefix-colors "cyan,magenta" \
    --kill-others \
    "npx vite" \
    "node server/index.js"
fi

# Run all three together so A1111 status is visible inline
exec npx concurrently \
  --names "a1111,vite,server" \
  --prefix-colors "yellow,cyan,magenta" \
  --kill-others-on-fail \
  "bash \"$SD_LAUNCH\"" \
  "npx vite" \
  "node server/index.js"
