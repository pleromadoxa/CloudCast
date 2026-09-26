#!/usr/bin/env bash
# Deploy CloudCast broadcast relay to the shared VPS (isolated from Streama).
#
# Uses the same SSH credentials as the Streama project (Documents/streama/strema/deploy.sh):
#   VPS_HOST=root@72.61.95.36
#   SSH_KEY=~/.ssh/streama_deploy
#
# Installs to /opt/cloudcast-relay — does NOT modify /var/www/strema or nginx.
# Process: pm2 name "cloudcast-relay" (separate from strema-* apps).
#
# Requires in local CloudCast .env: RELAY_TOKEN, RELAY_TUNNEL_TOKEN
# Usage: ./tools/deploy-relay-vps.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@72.61.95.36}"
REMOTE_DIR="/opt/cloudcast-relay"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/streama_deploy}"
NODE_BIN="/root/.nvm/versions/node/v25.1.0/bin"

if [ ! -f "$SSH_KEY" ]; then
  echo "✗ SSH key not found: $SSH_KEY" >&2
  exit 1
fi

SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no)
RSYNC_RSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"

load_env() {
  for f in "$ROOT/.env" "$ROOT/.env.local"; do
    [ -f "$f" ] || continue
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
    return 0
  done
  return 1
}

if ! load_env; then
  echo "✗ Missing $ROOT/.env — run npm run relay:setup first." >&2
  exit 1
fi

if [ -z "${RELAY_TOKEN:-}" ] || [ -z "${RELAY_TUNNEL_TOKEN:-}" ]; then
  echo "✗ RELAY_TOKEN and RELAY_TUNNEL_TOKEN must be set in .env (npm run relay:setup)." >&2
  exit 1
fi

echo "→ CloudCast relay → ${VPS_HOST}:${REMOTE_DIR} (Streama VPS, isolated path)"

"${SSH[@]}" "$VPS_HOST" "mkdir -p ${REMOTE_DIR}/bin"

rsync -az -e "$RSYNC_RSH" \
  "$ROOT/tools/broadcast-relay/serve.mjs" \
  "$ROOT/tools/broadcast-relay/server.mjs" \
  "$ROOT/tools/broadcast-relay/rtmpUrl.mjs" \
  "$ROOT/tools/broadcast-relay/package.json" \
  "${VPS_HOST}:${REMOTE_DIR}/"

# Relay secrets — server-only, not checked into git.
"${SSH[@]}" "$VPS_HOST" "cat > ${REMOTE_DIR}/.env" <<EOF
RELAY_TOKEN=${RELAY_TOKEN}
RELAY_TUNNEL_TOKEN=${RELAY_TUNNEL_TOKEN}
NODE_ENV=production
RELAY_HOST=127.0.0.1
RELAY_PORT=8090
CLOUDFLARED_PATH=${REMOTE_DIR}/bin/cloudflared
EOF

"${SSH[@]}" "$VPS_HOST" "bash -s" <<REMOTE
set -euo pipefail
export PATH=${NODE_BIN}:\$PATH
cd ${REMOTE_DIR}

if [ ! -x bin/cloudflared ]; then
  echo "→ Installing cloudflared to ${REMOTE_DIR}/bin"
  mkdir -p bin
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o bin/cloudflared
  chmod +x bin/cloudflared
fi

echo "→ npm install (ws only)"
npm install --omit=dev --no-audit --no-fund

echo "→ pm2: cloudcast-relay"
if pm2 describe cloudcast-relay >/dev/null 2>&1; then
  pm2 restart cloudcast-relay --update-env
else
  pm2 start serve.mjs --name cloudcast-relay --cwd ${REMOTE_DIR} --interpreter ${NODE_BIN}/node
fi
pm2 save

echo "→ Health (local)"
sleep 2
curl -sf http://127.0.0.1:8090/health || (echo "local health failed" >&2; exit 1)
REMOTE

echo ""
echo "✓ CloudCast relay deployed to ${REMOTE_DIR}"
echo "  pm2:  ssh … 'pm2 logs cloudcast-relay'"
echo "  check: curl -s https://relay.cloudcast.live/health"
