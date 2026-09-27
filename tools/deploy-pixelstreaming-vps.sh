#!/usr/bin/env bash
# Deploy Unreal Pixel Streaming signalling server to the shared VPS.
#
# Uses the same SSH credentials as the Streama/CloudCast relay deployments:
#   VPS_HOST=root@72.61.95.36
#   SSH_KEY=~/.ssh/streama_deploy
#
# Installs to /opt/pixelstreaming — does NOT modify /var/www/strema or other apps.
# Process: pm2 name "pixelstreaming-signal" (separate from cloudcast-relay).
#
# Ports exposed:
#   8091 — Player WebSocket (CloudCast connects here)
#   8888 — Streamer port (UE5 instances connect here)
#   8889 — SFU port (optional multi-viewer)
#
# Usage: ./tools/deploy-pixelstreaming-vps.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@72.61.95.36}"
REMOTE_DIR="/opt/pixelstreaming"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/streama_deploy}"
NODE_BIN="/root/.nvm/versions/node/v25.1.0/bin"

if [ ! -f "$SSH_KEY" ]; then
  echo "✗ SSH key not found: $SSH_KEY" >&2
  exit 1
fi

SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no)
RSYNC_RSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"

echo "→ Pixel Streaming signalling server → ${VPS_HOST}:${REMOTE_DIR}"

# ── 1. Clone / update the PixelStreamingInfrastructure repo on VPS ──────────
"${SSH[@]}" "$VPS_HOST" bash -s <<REMOTE
set -euo pipefail
export PATH=${NODE_BIN}:\$PATH

if [ -d "${REMOTE_DIR}/.git" ]; then
  echo "→ Pulling latest UE5.8 branch..."
  cd ${REMOTE_DIR}
  git fetch origin UE5.8
  git checkout UE5.8
  git reset --hard origin/UE5.8
else
  echo "→ Cloning PixelStreamingInfrastructure (UE5.8)..."
  rm -rf ${REMOTE_DIR}
  git clone --depth 1 --branch UE5.8 https://github.com/EpicGames/PixelStreamingInfrastructure.git ${REMOTE_DIR}
  cd ${REMOTE_DIR}
fi

echo "→ Installing dependencies..."
npm install --no-audit --no-fund 2>&1 | tail -3

echo "→ Building..."
npm run build:all:cjs 2>&1 | tail -3

echo "→ Build complete."
REMOTE

# ── 2. Write config override (player port 8091 to avoid clash with nginx) ──
"${SSH[@]}" "$VPS_HOST" "cat > ${REMOTE_DIR}/SignallingWebServer/config.local.json" <<'EOF'
{
  "player_port": 8091,
  "streamer_port": 8888,
  "sfu_port": 8889,
  "log_level_console": "info",
  "console_messages": "verbose",
  "serve": true,
  "https": false,
  "https_redirect": false
}
EOF

# ── 3. Start / restart as pm2 process ──────────────────────────────────────
"${SSH[@]}" "$VPS_HOST" bash -s <<REMOTE
set -euo pipefail
export PATH=${NODE_BIN}:\$PATH
cd ${REMOTE_DIR}/SignallingWebServer

echo "→ Starting pixelstreaming-signal via pm2..."
if pm2 describe pixelstreaming-signal >/dev/null 2>&1; then
  pm2 restart pixelstreaming-signal --update-env
else
  pm2 start ./dist/index.js \
    --name pixelstreaming-signal \
    --cwd ${REMOTE_DIR}/SignallingWebServer \
    --interpreter ${NODE_BIN}/node \
    -- --serve \
       --console_messages verbose \
       --log_config \
       --player_port 8091 \
       --streamer_port 8888
fi
pm2 save

sleep 2
echo "→ Health check..."
if curl -sf http://127.0.0.1:8091/ >/dev/null 2>&1; then
  echo "✓ Player port 8091 responding"
else
  echo "⚠ Player port 8091 not responding yet (may need a streamer to connect first)"
fi
REMOTE

echo ""
echo "✓ Pixel Streaming signalling server deployed to ${REMOTE_DIR}"
echo ""
echo "  CloudCast Signalling URL:  ws://72.61.95.36:8091"
echo "  UE5 Streamer port:         72.61.95.36:8888"
echo ""
echo "  NOTE: launch the Unreal instance with -AllowPixelStreamingCommands"
echo "  or every CloudCast fidelity command (Lumen, virtual shadows, texture"
echo "  pool, screen percentage) is rejected by the engine."
echo ""
echo "  Logs:    ssh … 'pm2 logs pixelstreaming-signal'"
echo "  Restart: ssh … 'pm2 restart pixelstreaming-signal'"
echo "  Stop:    ssh … 'pm2 stop pixelstreaming-signal'"
