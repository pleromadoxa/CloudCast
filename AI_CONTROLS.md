# AI Control Registry — CloudCast Dashboard

Programmatic control surface for the CloudCast video mixer dashboard. AI agents and automation scripts can invoke these actions to operate the production switcher.

## Dispatch mechanism

Controls are defined in `src/config/aiControlRegistry.ts`. Import helpers or dispatch browser events:

```typescript
import { dispatchAIControl } from './config/aiControlRegistry';

dispatchAIControl('cutToPreview');
dispatchAIControl('setTransitionType', { type: 'fade' });
```

Or via `CustomEvent`:

```javascript
window.dispatchEvent(new CustomEvent('cloudcast:control', {
  detail: { action: 'toggleOnAir', params: {} }
}));
```

> **Note:** The dashboard is a broadcast mixer (PST/PGM), not a simple camera grid. Many legacy grid actions remain in the registry; primary production controls are listed under **Mixer** below.

---

## Mixer — production switcher

### `sendToPst`
Route a source to preview (PST).

| Parameter | Type | Required |
|-----------|------|----------|
| `deviceId` | string | Yes |

### `cutToPreview`
Instant cut — move PST source to PGM (no transition).

### `take`
Animated transition from PST to PGM (uses current transition type/duration).

### `cutToDevice`
Instant cut directly to a specific source on PGM.

| Parameter | Type | Required |
|-----------|------|----------|
| `deviceId` | string | Yes |

### `swapPstPgm`
Swap preview and program buses.

### `setTransitionType`
Set transition style.

| Parameter | Values |
|-----------|--------|
| `type` | `cut`, `mix`, `fade`, `wipe`, `dip` |

### `setTransitionDuration`
Transition length in milliseconds (e.g. `800`, `1000`, `2000`).

### `setTransitionProgress`
T-bar position 0–100.

### `toggleOnAir`
Toggle ON AIR / LIVE state on PGM output.

### `toggleRecording`
Toggle record indicator (UI state).

### `toggleMultiview`
Open/close multiview modal (plan-aware slot count, up to 10).

### `toggleFullscreen`
Fullscreen PGM monitor.

### `setOutputMode`
Switch compositing mode.

| Parameter | Values |
|-----------|--------|
| `mode` | `main`, `pip`, `key` |

### `setAspectRatio`
Video frame aspect ratio for monitors and source strip.

| Parameter | Values |
|-----------|--------|
| `aspectRatio` | `16:9`, `9:16`, `4:3`, `1:1` |

---

## Audio

### `toggleMasterMute`
Mute/unmute PGM master output.

### `setMasterVolume`
Master fader 0–100.

### `setInputVolume`
Per-input fader.

| Parameter | Type |
|-----------|------|
| `deviceId` | string |
| `volume` | number 0–100 |

### `toggleInputMute` / `toggleInputSolo`
Mute or solo a specific input on the PGM audio bus.

### `toggleViewAudioMute`
Mute/unmute preview audio on a source tile or multiview (video still visible).

| Parameter | Type |
|-----------|------|
| `deviceId` | string |

### `setInputAudioSource`
Choose audio source for a video input.

| Parameter | Values |
|-----------|--------|
| `deviceId` | string |
| `source` | `camera`, `capture_card`, `usb_audio` |

### `setLinkedUsbAudio`
Link a paired USB audio-only device to a video input (when `source` is `usb_audio`).

| Parameter | Type |
|-----------|------|
| `deviceId` | string (video input) |
| `audioDeviceId` | string \| null |

---

## Streaming

Stream destinations are managed in the **Stream** panel and persisted per user in Supabase.

### Plan limits

| Plan | Max simultaneous | Platforms |
|------|-------------------|-----------|
| Free | 1 | YouTube, Custom |
| Pro | 3 | YouTube (multiple), Twitch, Facebook, Custom |
| Pro Master | 5 | YouTube (multiple), Twitch, Facebook, Custom |

### `toggleOnAir`
When ON AIR, all **enabled** saved destinations receive the PGM program feed.

### Stream destination fields

| Field | Description |
|-------|-------------|
| `name` | User label |
| `platform` | `youtube`, `twitch`, `facebook`, `custom` |
| `streamUrl` | RTMP server URL |
| `streamKey` | Stream key |
| `isEnabled` | Include when going live |

Default RTMP URLs (Setup → Stream panel):

| Platform | Default URL |
|----------|-------------|
| YouTube | `rtmp://a.rtmp.youtube.com/live2` |
| Twitch | `rtmp://live.twitch.tv/app` |
| Facebook | `rtmps://live-api-s.facebook.com:443/rtmp` |
| Custom | User-provided |

---

## Layers & overlays

### `setGlobalOverlay`
Apply overlay to all sources.

| Values | `none`, `timestamp`, `device-label`, `crosshair`, `safe-zone` |

### `patchLayers`
Update layer settings (logo bug, lower third, safe zone, crosshair).

### `patchPip` / `patchKey`
PiP position/size/opacity or chroma key color/tolerance.

---

## Devices & session

### `unpairDevice`
Remove a paired mobile/USB device from the session.

| Parameter | Type |
|-----------|------|
| `deviceId` | string |

### `reconnectStream`
Force stream reconnection (Regal Cloud plans) via `cloudcast:reconnect` event.

| Parameter | Type |
|-----------|------|
| `deviceId` | string |

### `regenerateAccessCode`
Invalidate current 6-char code and generate a new one.

---

## Legacy grid controls

These apply to the older grid/focus layout components if enabled:

| Action | Description |
|--------|-------------|
| `selectStream` | Toggle device in grid |
| `selectAllLiveStreams` | Fill grid with live devices |
| `clearStreamSelection` | Clear grid selection |
| `setStreamQuality` / `setDefaultQuality` | Stream quality presets |
| `setOverlay` | Per-device overlay |
| `setStatusFilter` | Filter by `live`, `offline`, etc. |
| `setViewMode` | `grid`, `focus`, `single` |
| `focusDevice` | Focus one device |
| `toggleAudioMute` | Global playback mute |

---

## Keyboard shortcuts (dashboard)

| Key | Action |
|-----|--------|
| `1`–`9` | Select source 1–9 to PST (preview) |
| `0` | Select source 10 to PST (Pro Master) |
| `Ctrl/Cmd + 1`–`0` | Cut source to PGM |
| **Enter** or **Space** | TAKE — PST → PGM (go live to program) |
| `C` | CUT |
| `B` | Fade to black |
| `O` | Toggle ON AIR |
| `M` | Toggle multiview |
| `S` | Swap PST/PGM |

Shortcuts are ignored when focus is in an input field. Per-view mic buttons on source tiles toggle preview audio independently of PGM master mute.

## Example sequences

**Cut camera 2 to program:**
```javascript
dispatchAIControl('cutToDevice', { deviceId: '<device-uuid>' });
```

**Preview cam 3, fade to program:**
```javascript
dispatchAIControl('sendToPst', { deviceId: '<device-uuid>' });
dispatchAIControl('setTransitionType', { type: 'fade' });
dispatchAIControl('take');
```

**Keyboard-equivalent: preview camera 2, then go live:**
```javascript
// User presses "2" then Enter — preview input 2, TAKE to PGM
dispatchAIControl('sendToPst', { deviceId: '<slot-2-device-id>' });
dispatchAIControl('take');
```

**Use video without preview audio:**
```javascript
dispatchAIControl('toggleViewAudioMute', { deviceId: '<device-uuid>' });
```

**Route USB lapel mic to camera 1:**
```javascript
dispatchAIControl('setInputAudioSource', { deviceId: '<cam-1-id>', source: 'usb_audio' });
dispatchAIControl('setLinkedUsbAudio', { deviceId: '<cam-1-id>', audioDeviceId: '<usb-mic-id>' });
```

**Go live with lower third:**
```javascript
dispatchAIControl('patchLayers', { showLowerThird: true, lowerThirdText: 'CloudCast Live' });
dispatchAIControl('toggleOnAir', { onAir: true });
```

**Switch to portrait framing:**
```javascript
dispatchAIControl('setAspectRatio', { aspectRatio: '9:16' });
```

---

## Connection modes

The dashboard adapts playback per session plan:

| Plan | Mode | Playback |
|------|------|----------|
| Free | `mesh` | Regal Mesh — direct P2P |
| Pro | `regal` | Regal Cloud — HD |
| Pro Master | `regal` | Regal Cloud — UHD |

Mobile integration details: [MOBILE_APP.md](./MOBILE_APP.md)

Project overview: [README.md](./README.md)
