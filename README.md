# CloudCast by Quantum Regal

Multi-source video production platform — a browser-based broadcast mixer that pairs mobile cameras and USB capture devices via access code, with plan-aware streaming through **Regal Mesh** (direct connect) or **Regal Cloud** (HD / UHD).

## Quick Start

```bash
cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open `http://localhost:5173`.

| Route | Description |
|-------|-------------|
| `/` | Landing page — product info, broadcast firms, about Regal |
| `/login` | Sign in / sign up (Supabase Auth) |
| `/pricing` | Free, Pro, Pro Master plans |
| `/profile` | Account dashboard — plan, cloud storage, mixer recordings |
| `/admin` | Admin dashboard — users, plans, mixer usage, activity & error logs |
| `/dashboard` | Protected video mixer (requires login) |

## Pricing & streaming tiers

| Plan | Price | Channels | Ingest | Live output |
|------|-------|----------|--------|-------------|
| **Free** | $0/mo | 2 mobile | Regal Mesh (direct connect) | 1 destination — YouTube **or** Custom RTMP |
| **Pro** | $29/mo | 4 mobile | Regal Cloud — **HD** | Up to 3 simultaneous — YouTube, Twitch, Facebook, Custom |
| **Pro Master** | $79/mo | 8 mobile + 2 USB (10 total) | Regal Cloud — **UHD** | Up to 5 simultaneous — multiple YouTube accounts + all platforms |

- Dashboard users authenticate with email/password.
- Mobile apps pair with a **6-character access code** only (no mobile login).
- The access code encodes the session owner's plan — mobile reads `plan_id` and `connection_mode` from Supabase.
- **Stream destinations** (URL, stream key, platform) are saved per user account in Supabase and configured in the dashboard **Stream** panel.

## Architecture

```
Marketing site (/)          Auth (/login)              Dashboard (/dashboard)
     │                           │                              │
     └───────────────────────────┴── Supabase Auth ─────────────┤
                                                                │
                    create_mixer_session() ◄── authenticated ───┤
                    (limits from user's plan)                   │
                                                                │
     Mobile App ── get_mixer_session(code) ──► plan + channel ──┤
              ── pair_device(code) ──────────► slot assignment ─┤
              ── Regal Mesh OR Regal Cloud ──► dashboard playback
```

### Free plan — Regal Mesh

Mobile connects directly to the dashboard over a secure peer link. Signaling runs on Supabase Realtime (`cloudcast-{session_id}`). Dashboard confirms with `device-ack` so mobile knows it is connected.

### Pro / Pro Master — Regal Cloud

Mobile ingests high-quality video through Regal's global delivery network. Pro delivers **HD**; Pro Master delivers **UHD**. Playback URLs are stored in `paired_devices` (internal fields — not exposed in user-facing UI).

## Dashboard features

- **PST / PGM** dual monitors with landscape 16:9 default (configurable in Setup)
- **2–10 input slots** depending on plan (source strip + control deck)
- **Transitions** — CUT, TAKE, T-bar, mix/fade/wipe/dip, fade-to-black
- **Output modes** — MAIN, PiP, chroma KEY
- **Layers** — overlays, logo bug, lower third, safe zone, crosshair
- **Audio mixer** — master fader, per-input faders, mute, solo, AFV (audio follow video)
- **Per-view preview mute** — mute/unmute audio on each source tile and multiview (video-only preview)
- **Audio source routing** — per input: phone/camera mic, USB capture card audio, or linked USB audio device (lapel mic)
- **USB audio devices** — pair audio-only USB inputs and link them to camera slots
- **Stream panel** — save YouTube, Twitch, Facebook Live, or Custom RTMP destinations to your account; plan-aware simultaneous stream limits
- **Multiview**, fullscreen PGM, record indicator (UI)
- **Keyboard shortcuts** — `1–9` PST preview, `0` = Input 10, **Enter** / **Space** TAKE, `Ctrl+1–0` CUT, `C` CUT, `B` FTB, `O` ON AIR, `M` multiview, `S` swap

### Control deck panels

| Panel | Purpose |
|-------|---------|
| Sources | Route inputs to PST / PGM / sub |
| Layers | Overlays, PiP, chroma key |
| Audio | Faders, AFV, audio source per input |
| Trans | Transition type, T-bar, CUT/TAKE |
| Devices | Paired devices, quality, audio routing, USB audio pairing |
| **Stream** | RTMP destinations, stream keys, GO LIVE |
| Setup | Aspect ratio, quality, multiview, shortcuts |

## Supabase database

Migrations live in `supabase/migrations/`. Applied to project `ixjydnkpnyxnckhkqhue`.

### Tables

**`subscription_plans`** — plan definitions (free, pro, pro_master)

**`profiles`** — one row per auth user; `plan_id` defaults to `free`

**`mixer_sessions`**

| Column | Description |
|--------|-------------|
| `access_code` | 6-char code — **globally unique among all active sessions** |
| `owner_id` | FK to auth user who created the session |
| `plan_id` | Session plan tier |
| `connection_mode` | `mesh` or `regal` |
| `max_devices` | Total channel limit (2 / 4 / 10) |
| `max_mobile_devices` | Mobile camera limit |
| `max_usb_devices` | USB capture limit (Pro Master only) |
| `expires_at` | Default 7 days |

**`paired_devices`**

| Column | Description |
|--------|-------------|
| `device_id` | Client-generated stable ID |
| `slot_number` | 1–10 |
| `device_type` | `mobile` or `usb` |
| `device_role` | `video` (default) or `audio` (USB audio-only) |
| `platform` | `ios`, `android`, `usb`, `unknown` |
| `status` | `live`, `offline`, `connecting`, `error` |
| `audio_source` | `camera`, `capture_card`, or `usb_audio` |
| `linked_audio_device_id` | Optional FK to a paired USB audio device |

> Internal ingest/playback URL columns exist for Regal Cloud plans. Mobile integrators receive these via RPC — they are not labeled with vendor names in product UI or public docs.

**`mixer_recordings`** — cloud-saved PGM recordings per authenticated user (Pro / Pro Master)

| Column | Description |
|--------|-------------|
| `user_id` | FK to auth user |
| `storage_path` | Path in `mixer-recordings` storage bucket |
| `file_name` | Original download filename |
| `size_bytes` | File size for quota tracking |
| `created_at` | Upload timestamp |

**`stream_destinations`** — saved RTMP output configs per authenticated user

| Column | Description |
|--------|-------------|
| `user_id` | FK to auth user |
| `name` | User label (e.g. "Main YouTube") |
| `platform` | `youtube`, `twitch`, `facebook`, `custom` |
| `stream_url` | RTMP server URL / host |
| `stream_key` | Stream key (stored per user, RLS-protected) |
| `is_enabled` | Whether destination is active for GO LIVE |
| `sort_order` | Display order |

### RPC functions

| Function | Caller | Purpose |
|----------|--------|---------|
| `create_mixer_session()` | Dashboard | Create session with new unique code (deactivates prior owner sessions) |
| `get_or_create_owner_session()` | Dashboard | Return existing active session or create one |
| `get_mixer_session(code)` | Mobile | Validate code; returns plan + limits |
| `get_mixer_session_by_id(id, code)` | Dashboard | Restore stored session |
| `pair_device(code, device_id, …)` | Mobile | Assign slot; enforces plan limits |
| `update_paired_device(…)` | Mobile | Update status, stream endpoints, telemetry |
| `unpair_device(code, device_id)` | Mobile / Dashboard | Remove device |
| `list_paired_devices_by_session(…)` | Dashboard | List session devices |
| `regenerate_access_code(…)` | Dashboard | New code (invalidates old) |
| `generate_unique_access_code()` | Internal | Mint a globally unique active code |
| `get_user_profile()` | Dashboard / Profile | Current user + plan |
| `update_user_profile(full_name)` | Profile | Update display name |
| `update_user_plan(plan_id)` | Dashboard / Pricing | Change subscription tier |
| `get_recording_storage_usage()` | Profile | Used / quota bytes for cloud recordings |
| `list_user_recordings()` | Profile | List saved PGM recordings |
| `register_mixer_recording(…)` | Dashboard | Register uploaded recording + enforce quota |
| `delete_mixer_recording(id)` | Profile | Delete recording metadata (storage path returned) |
| `admin_get_overview()` | Admin | Platform stats |
| `admin_list_users(…)` | Admin | Search users, plans, session counts |
| `admin_set_user_plan(…)` | Admin | Change a user's plan |
| `admin_update_plan(…)` | Super admin | Edit subscription tier limits & pricing |
| `admin_list_mixer_sessions(…)` | Admin | Mixer session usage |
| `admin_list_activity_logs(…)` | Admin | User & system activity |
| `admin_list_error_logs(…)` | Admin | Client / mixer error logs |
| `log_client_error(…)` | Client | Report errors from dashboard |
| `admin_bootstrap_super_admin()` | Auth user | One-time first super admin setup |
| `list_subscription_plans()` | Public | All plans for pricing page |
| `list_stream_destinations()` | Dashboard | List saved RTMP destinations |
| `upsert_stream_destination(…)` | Dashboard | Create/update a stream destination |
| `delete_stream_destination(id)` | Dashboard | Remove a saved destination |
| `update_device_audio_settings(…)` | Dashboard | Set audio source + linked USB audio per device |

### Realtime

Per-session channel: `cloudcast-{session_id}`

- **Broadcast** — signaling (`offer`, `answer`, `ice`, `device-ack`, …)
- **Presence** — dashboard + mobile clients
- **Postgres changes** — `paired_devices` sync to dashboard

## Project structure

```
src/
├── lib/
│   ├── branding.ts           # Regal Mesh / Regal Cloud labels, device limits
│   ├── streamingService.ts   # Stream destination CRUD
│   └── streamingLimits.ts    # Plan-aware stream output limits
├── pages/                    # Landing, Auth, Pricing, Dashboard
├── context/                  # Auth + CloudCast session/signaling
├── components/
│   └── mixer/panels/
│       ├── StreamSettingsPanel.tsx
│       ├── AudioMixerPanel.tsx
│       └── DevicesPanel.tsx
├── hooks/                    # Mixer state, keyboard shortcuts, stream playback
└── types/
    ├── streaming.ts          # RTMP destination types
    └── audio.ts              # Audio source types
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/publishable key |

Enable **Realtime** and **Auth** (email) in your Supabase project.

## Mobile integration

See **[MOBILE_APP.md](./MOBILE_APP.md)** for pairing, plan detection, Regal Mesh vs Regal Cloud flows, and signaling payloads.

## AI controls

See **[AI_CONTROLS.md](./AI_CONTROLS.md)** for the programmatic control registry.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
