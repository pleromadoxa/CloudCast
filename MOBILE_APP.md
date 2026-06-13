# Mobile App Integration — CloudCast by Quantum Regal

Integration guide for iOS/Android (and USB capture) clients pairing to a CloudCast dashboard session.

**Dashboard users** sign in at `/login`. **Mobile devices** use a **6-character access code** only.

---

## One app — Video Mixer + Audio Mixer

**CloudCast Mobile** is a single companion app for both products. There is **one access code per account** — the same code shown on the Video Mixer and Audio Mixer dashboards.

1. Enter the access code in CloudCast Mobile once.
2. The phone pairs to your shared session and appears on **both** dashboards.
3. **Video Mixer** uses the stream for picture (Regal Mesh on Free, Regal Cloud on Pro+).
4. **Audio Mixer** uses the **audio** from the same device (always Regal Mesh P2P when possible).

On **Pro / Pro Master** video plans, the mobile app should:

- Publish **video** through Regal Cloud (HD / UHD), **and**
- Keep a **Regal Mesh** peer connection alive for **audio** so the Audio Mixer receives direct low-latency audio.

`get_mixer_session` returns `product_type: 'video'` for the shared pairing session. Route by `connection_mode` for video ingest; always join the Realtime channel and answer mesh offers for audio.

---

## Overview

1. User enters access code → `get_mixer_session` validates and returns **plan + connection mode**
2. App pairs → `pair_device` assigns a slot (enforces plan limits)
3. App joins Realtime channel `cloudcast-{session_id}`
4. App streams based on `connection_mode`:
   - **`mesh`** (Free) — **Regal Mesh** direct connect to dashboard
   - **`regal`** (Pro / Pro Master) — **Regal Cloud** high-quality ingest (HD or UHD)
5. App listens for **`device-ack`** / **`pairing-status`** to confirm dashboard connection

---

## Plan detection (automatic)

| Plan | `plan_id` | `connection_mode` | Mobile | USB | Quality |
|------|-----------|-------------------|--------|-----|---------|
| Free | `free` | `mesh` | 2 | 0 | Standard |
| Pro | `pro` | `regal` | 4 | 0 | **HD** |
| Pro Master | `pro_master` | `regal` | 8 | 2 | **UHD** |

```typescript
const { data, error } = await supabase.rpc('get_mixer_session', {
  p_access_code: userEnteredCode.toUpperCase().trim(),
});

const {
  plan_id,              // 'free' | 'pro' | 'pro_master'
  plan_name,
  connection_mode,      // 'mesh' | 'regal'
  max_devices,
  max_mobile_devices,
  max_usb_devices,
  realtime_channel,
} = data;

if (connection_mode === 'mesh') {
  await startRegalMeshStream(realtime_channel);
} else {
  await startRegalCloudStream(plan_id); // HD for pro, UHD for pro_master
}
```

> Legacy sessions may return `cloudflare` for `connection_mode` — treat as `regal`.

---

## Connection modes

### Regal Mesh (`connection_mode: 'mesh'`)

Free plan. Direct peer connection between mobile and dashboard.

- No cloud ingest required
- Join realtime channel, create peer connection, send `offer`
- Wait for dashboard `answer` and `device-ack`
- Update status to `live` after acknowledgment

### Regal Cloud (`connection_mode: 'regal'`)

Pro and Pro Master plans. High-quality video through Regal's delivery network.

| Plan | Video quality |
|------|---------------|
| Pro | HD |
| Pro Master | UHD |

- Mobile obtains ingest and playback endpoints from your Regal Cloud provisioning flow
- Pass endpoints to `update_paired_device` (see Step 4)
- Dashboard plays back automatically — mobile does not need to know internal protocol details

---

## Pairing flow

```
Dashboard (authenticated)              Supabase                         Mobile App
    │                                 │                                 │
    ├── create_mixer_session() ──────►│                                 │
    │◄── access_code + plan info ─────│                                 │
    │                                 │◄── get_mixer_session(code) ─────┤
    │                                 │──► plan_id, connection_mode ───►│
    │                                 │◄── pair_device(code, ...) ──────┤
    │                                 │──► paired: true, slot, plan ───►│
    │◄── postgres_changes ────────────│                                 │
    │                                 │                                 │
    ├── Regal Mesh: direct answer ◄────────────────── P2P (free) ───────┤
    │   device-ack ──────────────────────────────────────────────────────►│
    │                                 │                                 │
    ├── Regal Cloud: HD/UHD playback ◄──────── Regal Cloud (pro+) ──────┤
```

---

## Access code uniqueness

Every active dashboard session has a **unique 6-character code**. The system enforces this at multiple levels:

1. **Database unique index** — no two active sessions can share the same code
2. **`generate_unique_access_code()`** — loops until a unused code is found (up to 50 attempts)
3. **Uppercase normalization** — codes are stored as uppercase; lookups are case-insensitive
4. **One active session per owner** — creating a new session deactivates previous codes for that user
5. **`get_or_create_owner_session()`** — dashboard reuses your existing session instead of minting duplicates

Regenerating a code invalidates the old one and assigns a new globally unique code.

---

## Step 1 — Validate access code

```typescript
const { data, error } = await supabase.rpc('get_mixer_session', {
  p_access_code: accessCode,
});
```

**Key response fields:** `session_id`, `plan_id`, `connection_mode`, `max_devices`, `max_mobile_devices`, `max_usb_devices`, `realtime_channel`

---

## Step 2 — Pair the device

### Video camera (mobile or USB capture)

```typescript
const { data, error } = await supabase.rpc('pair_device', {
  p_access_code: accessCode,
  p_device_id: deviceId,
  p_label: 'Field Camera 1',
  p_platform: 'ios',            // 'ios' | 'android' | 'usb'
  p_device_type: 'mobile',      // 'mobile' | 'usb' (Pro Master only for USB video)
});
```

### USB audio-only device (lapel mic, audio interface)

Pair with `device_type: 'usb'` and set `device_role: 'audio'` when your client supports it (or use platform `usb` with an audio-only label). The dashboard links USB audio devices to video inputs in the **Audio** / **Devices** panel.

```typescript
// Example — audio-only USB input (Pro Master recommended for multi-source shows)
await supabase.rpc('pair_device', {
  p_access_code: accessCode,
  p_device_id: audioDeviceId,
  p_label: 'Lapel Mic 1',
  p_platform: 'usb',
  p_device_type: 'usb',
  // device_role: 'audio' — set via update_paired_device if not supported at pair time
});
```

Returns `paired: true`, `plan_id`, `connection_mode`, and `device` with `slot_number`.

---

## Step 3 — Join Realtime channel

```typescript
channel
  .on('broadcast', { event: 'answer' }, handleAnswer)
  .on('broadcast', { event: 'ice' }, handleIce)
  .on('broadcast', { event: 'device-ack' }, handleDeviceAck)
  .on('broadcast', { event: 'pairing-status' }, handlePairingStatus)
  .on('broadcast', { event: 'request-reoffer' }, handleRequestReoffer)
  .subscribe();
```

---

## Step 4 — Streaming

### Regal Mesh (free)

1. `getUserMedia({ video: true, audio: true })`
2. Create peer connection with STUN (multiple servers recommended)
3. Broadcast `offer`; handle `answer` and trickle `ice`
4. On `device-ack` with `status: 'connected'`:

```typescript
await supabase.rpc('update_paired_device', {
  p_access_code: accessCode,
  p_device_id: deviceId,
  p_status: 'live',
});
```

Show **Connected** in the mobile UI.

### Dashboard reload — `request-reoffer` (Regal Mesh)

When the mixer dashboard refreshes, crashes, or reconnects to Realtime, it broadcasts **`request-reoffer`**. Mobile apps **must** handle this to restore preview without user action:

```typescript
async function handleRequestReoffer(payload: { from?: string; reason?: string }) {
  if (connectionMode !== 'mesh' || !localStream || !peerConnection) return;

  // Close stale peer state and send a fresh offer (same flow as initial Go Live).
  peerConnection.close();
  peerConnection = createPeerConnection();
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  channel.send({
    type: 'broadcast',
    event: 'offer',
    payload: {
      from: deviceId,
      deviceId,
      sdp: offer.sdp,
      timestamp: new Date().toISOString(),
    },
  });
}
```

The dashboard sends this when:

- It joins or re-subscribes to the session channel
- It becomes the signaling leader tab
- A paired phone is online on presence but no mesh media has arrived yet

**Regal Cloud** clients can ignore `request-reoffer` — ingest continues server-side and the dashboard replays via WHEP.

### Regal Cloud — HD / UHD (pro / pro_master)

Pro and Pro Master use **Cloudflare Stream WebRTC** (WHIP ingest → WHEP playback) instead of mesh P2P. This is more stable across NATs and scales to many dashboard viewers with sub-second latency.

1. **Provision** a live input (creates WHIP + WHEP URLs and stores them on the paired device):

```typescript
const res = await fetch(`${SUPABASE_URL}/functions/v1/cloudcast-stream`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({
    action: 'provision',
    access_code: accessCode,
    device_id: deviceId,
  }),
});
const { whip_url, whep_url, stream_id, quality_tier } = await res.json();
// quality_tier: 'hd' (pro) | 'uhd' (pro_master)
```

2. **Publish** camera/audio to `whip_url` using a WHIP client (e.g. Larix Broadcaster, `@eyevinn/whip-web-client`, or native WebRTC).

3. Confirm device is live:

```typescript
await supabase.rpc('update_paired_device', {
  p_access_code: accessCode,
  p_device_id: deviceId,
  p_status: 'live',
  p_whep_url: whep_url,
  p_whip_url: whip_url,
  p_stream_id: stream_id,
});
```

4. Optionally broadcast `stream-ready` — dashboard auto-plays WHEP from `paired_devices.whep_url`.

5. On unpair, release the live input:

```typescript
await fetch(`${SUPABASE_URL}/functions/v1/cloudcast-stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
  body: JSON.stringify({ action: 'delete', access_code: accessCode, device_id: deviceId }),
});
```

**Do not** surface vendor or protocol names in the mobile UI. Display:
- Free → **Regal Mesh**
- Pro → **Regal Cloud HD**
- Pro Master → **Regal Cloud UHD**

### Audio tracks

The dashboard mixer can route audio per video input from:

| `audio_source` | Description |
|----------------|-------------|
| `camera` | Phone / built-in camera microphone (default) |
| `capture_card` | Audio embedded in USB capture card stream |
| `usb_audio` | Separate paired USB audio device (`linked_audio_device_id`) |

When the dashboard changes audio routing, read `audio_source` and `linked_audio_device_id` from the paired device record (or listen for postgres changes on `paired_devices`).

For **USB audio-only** devices, stream audio only (no video track required). The dashboard links them to a camera slot when `audio_source = 'usb_audio'`.

---

## Signaling events

| Event | Direction | When |
|-------|-----------|------|
| `offer` | Mobile → Dashboard | Regal Mesh: start stream |
| `answer` | Dashboard → Mobile | Regal Mesh: reply |
| `ice` | Both | ICE candidates |
| `device-ack` | Dashboard → Mobile | Stream received — show Connected |
| `device-connected` | Dashboard → Mobile | Peer linked |
| `pairing-status` | Dashboard → Mobile | Plan + mode confirmation |
| `stream-ready` | Mobile → Dashboard | Regal Cloud: stream live |
| `stream-stopped` | Mobile → Dashboard | Stream ended |
| `request-reoffer` | Dashboard → Mobile | Dashboard reconnected — resend mesh `offer` |

---

## Dashboard broadcast resume

If the operator was **ON AIR** and the dashboard reloads within **6 hours**, the web mixer:

1. Restores session, PGM source, and mixer state from browser storage
2. Reconnects camera preview (mesh re-offer or Regal Cloud WHEP)
3. Automatically restarts the PGM encoder to enabled stream destinations when program video returns

Operators should still verify the **STREAM** indicator and destination health after any crash. Use **Stop stream** before closing the browser when ending a show.

---

## Heartbeat & disconnect

```typescript
await supabase.rpc('update_paired_device', {
  p_access_code: accessCode,
  p_device_id: deviceId,
  p_status: 'live',
  p_battery_level: batteryLevel,
  p_network_type: networkType,
});

// On exit:
await supabase.rpc('unpair_device', { p_access_code: accessCode, p_device_id: deviceId });
```

---

## Database reference

### `connection_mode` values

| Value | User-facing name | Description |
|-------|------------------|-------------|
| `mesh` | Regal Mesh | Direct P2P (Free) |
| `regal` | Regal Cloud | HD / UHD via Regal network (Pro+) |

### `mixer_sessions`

Includes `plan_id`, `connection_mode`, `max_mobile_devices`, `max_usb_devices`, `max_devices`.

### `paired_devices`

Includes `device_type`, `device_role` (`video` | `audio`), `platform`, `status`, `audio_source`, `linked_audio_device_id`, and internal stream endpoint fields for Regal Cloud plans.

### `stream_destinations`

Per-user saved RTMP outputs (dashboard only — not used by mobile pairing):

| Column | Description |
|--------|-------------|
| `platform` | `youtube`, `twitch`, `facebook`, `custom` |
| `stream_url` | RTMP ingest URL |
| `stream_key` | Stream key |
| `is_enabled` | Active when user goes ON AIR |

---

## RPC reference

| Function | Caller | Purpose |
|----------|--------|---------|
| `get_mixer_session(code)` | Mobile | Validate + plan info |
| `pair_device(…)` | Mobile | Pair device |
| `update_paired_device(…)` | Mobile | Status + stream endpoints |
| `unpair_device(…)` | Mobile | Disconnect |
| `list_paired_devices(code)` | Mobile | List devices |
| `update_device_audio_settings(…)` | Dashboard | Set `audio_source` + linked USB audio |
| `list_stream_destinations()` | Dashboard | Saved RTMP destinations |
| `upsert_stream_destination(…)` | Dashboard | Save stream URL/key |
| `delete_stream_destination(id)` | Dashboard | Remove destination |

---

## Live streaming (dashboard)

Stream output is configured in the dashboard **Stream** panel — not on mobile.

| Plan | Simultaneous streams | Platforms |
|------|---------------------|-----------|
| Free | 1 | YouTube, Custom RTMP |
| Pro | 3 | YouTube (multiple), Twitch, Facebook, Custom |
| Pro Master | 5 | YouTube (multiple), Twitch, Facebook, Custom |

Mobile apps deliver **ingest** (cameras/audio). The dashboard switches PGM and pushes to saved RTMP destinations when ON AIR.

---

## Pricing

| Plan | Price | Channels | Quality |
|------|-------|----------|---------|
| Free | $0/mo | 2 mobile | Standard (Regal Mesh) |
| Pro | $29/mo | 4 mobile | HD (Regal Cloud) |
| Pro Master | $79/mo | 8 mobile + 2 USB | UHD (Regal Cloud) |

---

## Mobile UI recommendations

- After `get_mixer_session` — show plan name and quality badge (Standard / HD / UHD)
- After `pair_device` — show slot number and "Connecting…"
- On `device-ack` — show **Connected** (green)
- Badge by mode: **Regal Mesh** | **Regal Cloud HD** | **Regal Cloud UHD**
- For USB capture — label as **USB Capture**; for USB audio — label as **USB Audio**
- Respect dashboard `audio_source` when sending multiple audio tracks
- Never display third-party infrastructure names to end users

---

## TypeScript contract

```typescript
type PlanTier = 'free' | 'pro' | 'pro_master';
type ConnectionMode = 'mesh' | 'regal';
type DeviceRole = 'video' | 'audio';
type AudioInputSource = 'camera' | 'capture_card' | 'usb_audio';
type StreamPlatform = 'youtube' | 'twitch' | 'facebook' | 'custom';
```

See also: [README.md](./README.md) · [AI_CONTROLS.md](./AI_CONTROLS.md)
