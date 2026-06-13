# Regal Prism Eye — Mobile VP Camera

Regal Prism Eye uses **CloudCast Mobile** as a wireless virtual production camera — the browser equivalent of Aximetry Eye.

## Quick start

1. Open **Regal Prism** at `/prism` on your production laptop.
2. Go to the **Mobile** panel — copy the **Prism Eye** link (includes your session access code).
3. On iPhone/Android, open the Prism Eye link — **no login required**.
4. Tap **Enable Gyro Tracking** and move the phone to pan the virtual camera on the desktop studio.
5. Alternatively, pair **CloudCast Mobile** with the same access code for wireless camera input.
6. Tune the chroma keyer and virtual set as usual.

**Link rotation:** When you regenerate the access code after a production, the Prism Eye link updates automatically — old links stop working.

## Features (Pro+)

| Capability | Description |
|------------|-------------|
| Wireless camera | Phone streams over Regal Mesh (Free) or Regal Cloud HD+ (Pro) |
| Orientation tracking | Enable **Tracking** panel on the phone browser for gyro-driven virtual camera |
| AR mode | Use Outdoor AR set with live phone camera as background |
| Mixer output | Pro Master: route composite to Video Mixer as **Regal Prism** source |
| RTMP | Pro+: stream composite directly to YouTube/Twitch/custom RTMP |

## Tracking without hardware

Open the **Prism Eye** link (`/prism/eye?code=…`) on a phone or tablet — no account login needed. Enable gyro tracking and move the device to pan the virtual camera on the desktop studio. No OptiTrack or Vive Mars required for basic AR demos.

## Connection modes

Same as CloudCast Video Mixer:

- **Free** — Regal Mesh P2P (low latency, 2 mobile devices)
- **Pro / Pro Master** — Regal Cloud ingest for HD/UHD video + mesh audio path

## Tips

- Use a green or blue screen behind talent for virtual studio mode.
- For AR overlays, switch production mode to **AR** and use a plain background.
- Press **Route to Mixer** before switching to `/dashboard` so the composite stays live on the hidden renderer.

See also: [MOBILE_APP.md](./MOBILE_APP.md) for CloudCast Mobile pairing protocol.
