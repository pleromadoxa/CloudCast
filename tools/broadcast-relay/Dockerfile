# CloudCast broadcast relay — FFmpeg WebM → RTMP + Cloudflare Tunnel connector.
# Build from repo root: docker build -f tools/broadcast-relay/Dockerfile -t cloudcast-relay .
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && ARCH="$(dpkg --print-architecture)" \
  && case "$ARCH" in amd64) CF_ARCH=amd64 ;; arm64) CF_ARCH=arm64 ;; *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;; esac \
  && curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
    -o /usr/local/bin/cloudflared \
  && chmod +x /usr/local/bin/cloudflared \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY tools/broadcast-relay/package.json tools/broadcast-relay/
RUN cd tools/broadcast-relay && npm install --omit=dev

COPY tools/broadcast-relay/serve.mjs tools/broadcast-relay/server.mjs tools/broadcast-relay/rtmpUrl.mjs tools/broadcast-relay/

ENV NODE_ENV=production
ENV RELAY_HOST=127.0.0.1
ENV RELAY_PORT=8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8090/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "tools/broadcast-relay/serve.mjs"]
