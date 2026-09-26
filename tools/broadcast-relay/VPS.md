# CloudCast broadcast relay (production)

Isolated from Streama (`/var/www/strema`). Do not modify Streama nginx or pm2 apps.

## Role

- Receives WebM from https://cloudcast.live over `wss://relay.cloudcast.live`
- Transcodes via FFmpeg → RTMP (YouTube, Twitch, etc.)
- Cloudflare Tunnel connector runs via `serve.mjs` → `bin/cloudflared`

## Manage

```bash
export PATH=/root/.nvm/versions/node/v25.1.0/bin:$PATH
pm2 logs cloudcast-relay
pm2 restart cloudcast-relay
curl -s http://127.0.0.1:8090/health   # → ok
curl -s https://relay.cloudcast.live/health
```

## Redeploy (from CloudCast repo on your laptop)

```bash
npm run relay:deploy:vps
```

## Files

| Path | Purpose |
|------|---------|
| serve.mjs | Supervises relay + cloudflared |
| server.mjs | WebSocket relay + FFmpeg |
| .env | RELAY_TOKEN, RELAY_TUNNEL_TOKEN (secrets) |
| bin/cloudflared | Tunnel connector |
