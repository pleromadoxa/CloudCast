/**
 * CloudCast Unreal Engine Pixel Streaming — WebRTC client.
 *
 * Epic does not ship an in-browser Unreal scene renderer; the supported way to
 * put an Unreal render on a web page is *Pixel Streaming*: a GPU instance
 * renders the scene and streams it to the browser over WebRTC, with the browser
 * forwarding input back over the data channel.
 *
 * This module speaks **signalling protocol 1.3.0** — the wire protocol of
 * Epic's `PixelStreamingInfrastructure` `UE5.8` branch, which is what
 * `tools/deploy-pixelstreaming-vps.sh` installs on the CloudCast relay. The
 * session is split across two transports that cannot be mixed up:
 *
 * **Signalling WebSocket** (player ↔ relay ↔ streamer) carries only session
 * setup, and the relay forwards *only* the message types in protocol 1.3.0:
 *
 *   player  →  {"type":"listStreamers"}
 *   relay   →  {"type":"streamerList","ids":["Streamer0"]}
 *   player  →  {"type":"subscribe","streamerId":"Streamer0"}
 *   streamer→  {"type":"offer","sdp":…}     player → {"type":"answer","sdp":…}
 *   both    →  {"type":"iceCandidate","candidate":{…}}
 *   relay   ↔  {"type":"ping"} / {"type":"pong"}   keepalive + round-trip
 *
 * The classic-era vocabulary (`connect`, `command`, `latencyTest`, `mouseMove`,
 * `keyDown`, …) does not exist in protocol 1.3.0: the relay logs those as
 * "Unhandled player protocol message" and drops them on the floor. Everything
 * that actually drives the engine therefore travels over the **WebRTC data
 * channel** as Epic's default *binary* framing — a one-byte message id followed
 * by a payload laid out per `TO_STREAMER` (mirroring Epic's
 * `StreamMessageController.populateDefaultProtocol()`):
 *
 *   Command(51)         string  {"ConsoleCommand":"r.Lumen.GlobalIllumination 1"}
 *   RequestInitialSettings(7)   —— engine replies with InitialSettings(7)
 *   MouseMove(74)       u16,u16,i16,i16   position normalised to 0…65535
 *   MouseDown/Up(72/73) u8,u16,u16        button, position
 *   MouseWheel(75)      i16,u16,u16       wheelDelta (positive = up), position
 *   KeyDown(60)         u8,u8             keyCode, isRepeat
 *   KeyUp(61)           u8                keyCode
 *   KeyPress(62)        u16               charCode
 *
 * Console commands additionally require the Unreal instance to be launched
 * with `-AllowPixelStreamingCommands`; the engine reports that flag back in
 * its `InitialSettings` message, which surfaces as
 * `PixelStreamStats.consoleCommandsAllowed` so an operator can see *why*
 * fidelity tuning is being rejected instead of guessing.
 *
 * The fidelity spec (`fidelity.ts`) is pushed through this path — Lumen global
 * illumination and reflections, virtual shadow maps, volumetric fog, TSR — so
 * every Unreal set renders to the identical standard as the R3F and Babylon
 * stages. Commands queue until a data channel is open, so tuning applied
 * before (or during) connection is never lost.
 */
import {
  unrealFidelityCommands,
  unrealScalabilityLevel,
} from '../../../lib/virtualStudio/fidelity';
import type { FidelityTier } from '../../../lib/virtualStudio/fidelity';

export type PixelStreamState =
  | 'idle'
  | 'connecting'
  | 'negotiating'
  | 'streaming'
  | 'reconnecting'
  | 'failed'
  | 'disconnected';

export interface PixelStreamStats {
  state: PixelStreamState;
  message: string | null;
  /** Round-trip latency reported by the relay, in ms (null when unknown). */
  latencyMs: number | null;
  /** Decoded frames per second measured locally. */
  fps: number;
  resolution: { width: number; height: number } | null;
  bytesReceived: number;
  iceConnectionState: string | null;
  /**
   * Whether the Unreal instance accepted `-AllowPixelStreamingCommands`.
   * `null` until the engine reports its InitialSettings — a `false` here means
   * every fidelity console command we send is being silently rejected.
   */
  consoleCommandsAllowed: boolean | null;
}

export interface PixelStreamOptions {
  /** WebSocket endpoint of the Pixel Streaming signalling server. */
  signallingUrl: string;
  forceTURN: boolean;
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
  autoPause: boolean;
  /** Fidelity tier pushed to the streamer once the session is live. */
  fidelity?: FidelityTier;
  onStats?: (stats: PixelStreamStats) => void;
  onFrame?: (frame: { width: number; height: number }) => void;
}

const RECONNECT_DELAY_MS = 2400;
/** How often to ask the relay for a streamer while none is subscribed. */
const STREAMER_POLL_MS = 2000;
/** Give up waiting for the streamer's offer and re-subscribe after this. */
const OFFER_WATCHDOG_MS = 12000;
/** Cap on tuning commands buffered while no data channel is open. */
const MAX_QUEUED_COMMANDS = 256;

/* --------------------------------------- to-streamer binary protocol --- */

export type StreamerField = 'uint8' | 'uint16' | 'int16' | 'string';

interface StreamerMessageSpec {
  id: number;
  structure: readonly StreamerField[];
}

/**
 * Epic's default to-streamer message table (from-streamer ids run 0…255 with
 * `InitialSettings = 7`). Kept as data so the encoder is unit-testable
 * without a GPU or a streamer.
 */
export const TO_STREAMER_MESSAGES: Readonly<Record<string, StreamerMessageSpec>> = {
  RequestInitialSettings: { id: 7, structure: [] },
  Command: { id: 51, structure: ['string'] },
  KeyDown: { id: 60, structure: ['uint8', 'uint8'] },
  KeyUp: { id: 61, structure: ['uint8'] },
  KeyPress: { id: 62, structure: ['uint16'] },
  MouseEnter: { id: 70, structure: [] },
  MouseLeave: { id: 71, structure: [] },
  MouseDown: { id: 72, structure: ['uint8', 'uint16', 'uint16'] },
  MouseUp: { id: 73, structure: ['uint8', 'uint16', 'uint16'] },
  MouseMove: { id: 74, structure: ['uint16', 'uint16', 'int16', 'int16'] },
  MouseWheel: { id: 75, structure: ['int16', 'uint16', 'uint16'] },
};

/** From-streamer message id for the engine's InitialSettings reply. */
const FROM_STREAMER_INITIAL_SETTINGS = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Encode one to-streamer binary frame: a one-byte message id followed by the
 * payload fields in wire order (strings are a uint16 code-unit length then
 * UTF-16 code units — the same convention Epic's frontend writes).
 */
export function encodeToStreamerMessage(
  type: string,
  values: readonly (number | string)[] = [],
): ArrayBuffer | null {
  const spec = TO_STREAMER_MESSAGES[type];
  if (!spec) return null;

  let byteLength = 1;
  spec.structure.forEach((field, index) => {
    if (field === 'uint8') byteLength += 1;
    else if (field === 'uint16' || field === 'int16') byteLength += 2;
    else byteLength += 2 + 2 * String(values[index] ?? '').length;
  });

  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  view.setUint8(0, spec.id);
  let offset = 1;
  spec.structure.forEach((field, index) => {
    const value = values[index];
    switch (field) {
      case 'uint8':
        view.setUint8(offset, clamp(typeof value === 'number' ? value : 0, 0, 255));
        offset += 1;
        break;
      case 'uint16':
        view.setUint16(offset, clamp(typeof value === 'number' ? value : 0, 0, 65535), true);
        offset += 2;
        break;
      case 'int16':
        view.setInt16(offset, clamp(typeof value === 'number' ? value : 0, -32768, 32767), true);
        offset += 2;
        break;
      case 'string': {
        const text = String(value ?? '');
        view.setUint16(offset, text.length, true);
        offset += 2;
        for (let i = 0; i < text.length; i += 1) {
          view.setUint16(offset, text.charCodeAt(i), true);
          offset += 2;
        }
        break;
      }
    }
  });
  return buffer;
}

/* ------------------------------------------------ pointer mapping --- */

export interface VideoDisplayMetrics {
  elementWidth: number;
  elementHeight: number;
  /** Letterbox offset of the contained video inside the element. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/**
 * The on-screen rectangle the video actually paints when the element uses
 * `object-fit: contain` — pointer positions must be mapped through it or
 * clicks drift in the letterbox bars.
 */
export function videoDisplayMetrics(
  elementWidth: number,
  elementHeight: number,
  videoWidth: number,
  videoHeight: number,
): VideoDisplayMetrics {
  const scale = Math.min(elementWidth / videoWidth, elementHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  return {
    elementWidth,
    elementHeight,
    offsetX: (elementWidth - width) / 2,
    offsetY: (elementHeight - height) / 2,
    width,
    height,
  };
}

export interface TranslatedPointer {
  x: number;
  y: number;
  inRange: boolean;
}

/**
 * Normalised element position → Epic's fixed-point stream coordinates.
 * Out-of-video positions collapse to the 65535 sentinel, exactly like the
 * official frontend's `InputCoordTranslator`.
 */
export function translatePointer(
  normalisedX: number,
  normalisedY: number,
  metrics: VideoDisplayMetrics,
): TranslatedPointer {
  const x = (normalisedX * metrics.elementWidth - metrics.offsetX) / metrics.width;
  const y = (normalisedY * metrics.elementHeight - metrics.offsetY) / metrics.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return { x: 65535, y: 65535, inRange: false };
  }
  return {
    x: clamp(x * 65536, 0, 65535),
    y: clamp(y * 65536, 0, 65535),
    inRange: true,
  };
}

/** Pixel deltas → Epic's signed 0…32767 half-size normalisation. */
export function translateDelta(
  deltaX: number,
  deltaY: number,
  metrics: VideoDisplayMetrics,
): { x: number; y: number } {
  return {
    x: clamp((deltaX / (metrics.width / 2)) * 32767, -32768, 32767),
    y: clamp((deltaY / (metrics.height / 2)) * 32767, -32768, 32767),
  };
}

/** Decode a uint16-length + UTF-16 string payload out of a data channel frame. */
function readUint16String(view: DataView, offset: number): string | null {
  if (offset + 2 > view.byteLength) return null;
  const length = view.getUint16(offset, true);
  if (offset + 2 + length * 2 > view.byteLength) return null;
  let text = '';
  for (let i = 0; i < length; i += 1) {
    text += String.fromCharCode(view.getUint16(offset + 2 + i * 2, true));
  }
  return text;
}

interface SignallingMessage {
  type: string;
  [key: string]: unknown;
}

function iceServers(options: PixelStreamOptions, peerOptions?: RTCConfiguration): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }];
  if (options.turnUrl) {
    servers.push({
      urls: [options.turnUrl],
      username: options.turnUsername || undefined,
      credential: options.turnCredential || undefined,
    });
  }
  // The relay's config message can carry peer connection options (e.g. a
  // managed TURN); those ride alongside our own entries.
  if (peerOptions?.iceServers?.length) servers.push(...peerOptions.iceServers);
  return servers;
}

export class PixelStreamClient {
  private readonly options: PixelStreamOptions;
  private socket: WebSocket | null = null;
  private peer: RTCPeerConnection | null = null;
  private remoteChannel: RTCDataChannel | null = null;
  private localChannel: RTCDataChannel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private streamerPollTimer: ReturnType<typeof setInterval> | null = null;
  private offerWatchdog: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private frameCounter = 0;
  private lastFpsAt = 0;
  private disposed = false;
  private state: PixelStreamState = 'idle';
  private message: string | null = null;
  private latencyMs: number | null = null;
  private bytesReceived = 0;
  private resolution: { width: number; height: number } | null = null;
  private fidelity: FidelityTier | null;
  private qualityLevel: 'low' | 'medium' | 'high' | 'epic' | 'cinematic' | null = null;
  private resolutionRequest: string | null = null;
  private consoleCommandsAllowed: boolean | null = null;
  private subscribedStreamerId: string | null = null;
  private peerConnectionOptions: RTCConfiguration | null = null;
  /** Tuning commands already flushed through the locally-created channel. */
  private tuningSentOnLocal = false;
  /** Commands held until a data channel is open (the only reliable transport). */
  private pendingCommands: string[] = [];
  private readonly video: HTMLVideoElement;

  constructor(options: PixelStreamOptions, video: HTMLVideoElement) {
    this.options = options;
    this.video = video;
    this.fidelity = options.fidelity ?? null;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.setAttribute('data-pgm-capture', 'true');
  }

  /* ---------------------------------------------------------- lifecycle --- */

  connect(): void {
    if (this.disposed) return;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.setState('connecting', 'Connecting to CloudCast Relay…');

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.options.signallingUrl);
    } catch (error) {
      this.setState('failed', describe(error, 'Could not open the signalling socket'));
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.setState('negotiating', 'Relay connected — looking for the UE5 instance…');
      this.send({ type: 'listStreamers' });
      this.startStreamerPoll();
    };
    socket.onmessage = (event) => void this.handleMessage(event);
    socket.onerror = () => {
      if (!this.disposed) this.setState('failed', 'Relay connection error');
    };
    socket.onclose = () => {
      if (this.disposed) return;
      // Superseded by an intentional teardown (disconnect / reconnect hop).
      if (this.socket !== socket) return;
      this.socket = null;
      this.resetSubscription();
      this.teardownPeer();
      this.scheduleReconnect();
    };

    this.startStats();
  }

  disconnect(): void {
    this.clearReconnect();
    this.stopStats();
    this.resetSubscription();
    this.teardownPeer();
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      try {
        socket.close();
      } catch {
        /* already closed */
      }
    }
    this.setState('disconnected', 'Disconnected');
  }

  dispose(): void {
    this.disposed = true;
    this.disconnect();
  }

  /* --------------------------------------------------------------- stats --- */

  getStats(): PixelStreamStats {
    return {
      state: this.state,
      message: this.message,
      latencyMs: this.latencyMs,
      fps: this.frameCounter,
      resolution: this.resolution,
      bytesReceived: this.bytesReceived,
      iceConnectionState: this.peer?.iceConnectionState ?? null,
      consoleCommandsAllowed: this.consoleCommandsAllowed,
    };
  }

  /* ---------------------------------------------------------------- input --- */

  /**
   * Normalised pointer position (0…1) over the video element. Positions map
   * through the letterboxed video rect before quantising, so a click on the
   * rendered set lands where the operator aimed.
   */
  mouseMove(x: number, y: number, deltaX: number, deltaY: number): void {
    const metrics = this.displayMetrics();
    if (!metrics) return;
    const position = translatePointer(x, y, metrics);
    const delta = translateDelta(deltaX, deltaY, metrics);
    this.sendInput('MouseMove', [position.x, position.y, delta.x, delta.y]);
  }

  mouseDown(button: number, x: number, y: number): void {
    const metrics = this.displayMetrics();
    if (!metrics) return;
    const position = translatePointer(x, y, metrics);
    this.sendInput('MouseDown', [button, position.x, position.y]);
  }

  mouseUp(button: number, x: number, y: number): void {
    const metrics = this.displayMetrics();
    if (!metrics) return;
    const position = translatePointer(x, y, metrics);
    this.sendInput('MouseUp', [button, position.x, position.y]);
  }

  /** `delta` is a scroll amount in pixels, positive = scroll down. */
  mouseWheel(delta: number, x: number, y: number): void {
    const metrics = this.displayMetrics();
    if (!metrics) return;
    const position = translatePointer(x, y, metrics);
    // The engine consumes Epic's wheelDelta convention: positive = scroll up.
    this.sendInput('MouseWheel', [-delta, position.x, position.y]);
  }

  keyDown(key: string, keyCode: number): void {
    const code = clamp(keyCode, 0, 255);
    if (!code || code === 229) return;
    this.sendInput('KeyDown', [code, 0]);
    // UE text fields consume characters through KeyPress (including
    // Backspace), mirroring Epic's keyboard controller.
    const charCode = key === 'Backspace' ? 8 : key.length === 1 ? key.charCodeAt(0) : 0;
    if (charCode > 0 && charCode <= 0xffff) {
      this.sendInput('KeyPress', [charCode]);
    }
  }

  keyUp(_key: string, keyCode: number): void {
    const code = clamp(keyCode, 0, 255);
    if (!code) return;
    this.sendInput('KeyUp', [code]);
  }

  /**
   * Send an Unreal console command over the data channel. Queued while no
   * channel is open, so tuning pushed before the session is live is applied
   * the moment the streamer is reachable.
   */
  sendCommand(command: string): void {
    if (this.writeCommand(command)) return;
    // Tuning is pushed as whole sets (scalability + fidelity + resolution);
    // identical commands queued twice would flush as duplicates.
    if (this.pendingCommands.includes(command)) return;
    this.pendingCommands.push(command);
    if (this.pendingCommands.length > MAX_QUEUED_COMMANDS) this.pendingCommands.shift();
  }

  /** Ask the relay for a latency probe round-trip. */
  requestLatencyTest(): void {
    this.send({ type: 'ping', time: Date.now() });
  }

  /** Request a quality preset by pushing Unreal scalability console commands. */
  applyQuality(level: 'low' | 'medium' | 'high' | 'epic' | 'cinematic'): void {
    this.qualityLevel = level;
    const sg = { low: 1, medium: 2, high: 3, epic: 4, cinematic: 4 }[level];
    this.sendCommand(`sg.ShadowQuality ${sg}`);
    this.sendCommand(`sg.PostProcessQuality ${sg}`);
    this.sendCommand(`sg.TextureQuality ${sg}`);
    this.sendCommand(`sg.EffectsQuality ${sg}`);
    this.sendCommand(`sg.FoliageQuality ${sg}`);
    this.sendCommand(`sg.ViewDistanceQuality ${sg}`);
    this.sendCommand(`sg.AntiAliasingQuality ${sg}`);
    if (level === 'cinematic') this.sendCommand('r.ScreenPercentage 150');
    else if (level === 'epic') this.sendCommand('r.ScreenPercentage 125');
    else this.sendCommand('r.ScreenPercentage 100');
  }

  /**
   * Push the shared fidelity spec to the Unreal instance: scalability groups,
   * then the physical rendering features (Lumen GI + reflections, virtual
   * shadow maps, volumetric fog, TSR, anisotropy, streaming pool). Commands
   * queue until a data channel is open.
   */
  applyFidelity(tier: FidelityTier): void {
    this.fidelity = tier;
    this.pushFidelity();
  }

  /** Apply a render resolution request (Unreal console). */
  applyResolution(resolution: string): void {
    this.resolutionRequest = resolution;
    const [width, height] = resolution.split('x').map((v) => Number.parseInt(v, 10));
    if (!width || !height) return;
    this.sendCommand(`r.SetRes ${width}x${height}w`);
  }

  private pushFidelity(): void {
    // Scalability groups first (operator preset when set, otherwise the tier's
    // own mapping), then the physical rendering features, then resolution.
    const tier = this.fidelity;
    this.applyQuality(this.qualityLevel ?? (tier ? unrealScalabilityLevel(tier) : 'epic'));
    if (tier) {
      for (const command of unrealFidelityCommands(tier)) this.sendCommand(command);
    }
    if (this.resolutionRequest) this.applyResolution(this.resolutionRequest);
  }

  /* ------------------------------------------------------------- private --- */

  private send(message: SignallingMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /** Ask the relay which streamers exist; drives the subscribe handshake. */
  private startStreamerPoll(): void {
    this.clearStreamerPoll();
    this.streamerPollTimer = setInterval(() => {
      if (this.subscribedStreamerId || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }
      this.send({ type: 'listStreamers' });
    }, STREAMER_POLL_MS);
  }

  private clearStreamerPoll(): void {
    if (this.streamerPollTimer) {
      clearInterval(this.streamerPollTimer);
      this.streamerPollTimer = null;
    }
  }

  private clearOfferWatchdog(): void {
    if (this.offerWatchdog) {
      clearTimeout(this.offerWatchdog);
      this.offerWatchdog = null;
    }
  }

  private resetSubscription(): void {
    this.subscribedStreamerId = null;
    this.clearStreamerPoll();
    this.clearOfferWatchdog();
  }

  private onStreamerList(ids: unknown): void {
    if (this.subscribedStreamerId) return;
    const streamerId = Array.isArray(ids) ? ids.find((id) => typeof id === 'string') : undefined;
    if (!streamerId) return; // no UE instance yet — the poll keeps asking
    this.subscribedStreamerId = streamerId;
    this.send({ type: 'subscribe', streamerId });
    this.setState('negotiating', `UE5 instance “${streamerId}” found — waiting for its offer…`);
    // If the instance never offers (busy, paused, mid-restart), re-subscribe
    // instead of hanging on the negotiating screen forever.
    this.clearOfferWatchdog();
    this.offerWatchdog = setTimeout(() => {
      this.offerWatchdog = null;
      if (this.state === 'negotiating') {
        this.subscribedStreamerId = null;
        this.send({ type: 'listStreamers' });
        this.setState('negotiating', 'Relay: instance did not offer — retrying…');
      }
    }, OFFER_WATCHDOG_MS);
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    this.clearReconnect();
    this.setState('reconnecting', 'Connection lost — reconnecting…');
    // The subscription and peer connection both die with the socket — close it
    // so connect() starts a genuinely fresh session rather than early-returning
    // on the still-open signalling connection.
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      this.teardownPeer();
      this.resetSubscription();
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private teardownPeer(): void {
    this.remoteChannel = null;
    this.localChannel = null;
    this.tuningSentOnLocal = false;
    if (this.peer) {
      try {
        this.peer.close();
      } catch {
        /* already closed */
      }
      this.peer = null;
    }
    if (this.video.srcObject) {
      this.video.srcObject = null;
    }
    this.resolution = null;
  }

  private async handleMessage(event: MessageEvent<string>): Promise<void> {
    let message: SignallingMessage;
    try {
      message = JSON.parse(event.data) as SignallingMessage;
    } catch {
      return;
    }

    switch (message.type) {
      case 'config': {
        // Peer options from the relay (managed TURN, ICE servers).
        const options = message.peerConnectionOptions;
        if (options && typeof options === 'object') {
          this.peerConnectionOptions = options as RTCConfiguration;
        }
        break;
      }

      case 'streamerList':
        this.onStreamerList(message.ids);
        break;

      case 'subscribeFailed': {
        const reason = typeof message.message === 'string' ? message.message : 'subscribe failed';
        this.subscribedStreamerId = null;
        this.clearOfferWatchdog();
        this.setState('negotiating', `Relay: ${reason}`);
        break;
      }

      case 'streamerIdChanged':
        if (typeof message.newID === 'string') this.subscribedStreamerId = message.newID;
        break;

      case 'offer':
        this.clearOfferWatchdog();
        await this.acceptOffer(String(message.sdp ?? ''));
        break;

      case 'answer':
        // A player does not normally receive answers; tolerate them.
        if (this.peer && typeof message.sdp === 'string') {
          await this.peer.setRemoteDescription({ type: 'answer', sdp: message.sdp });
        }
        break;

      case 'iceCandidate': {
        const candidate = message.candidate as RTCIceCandidateInit | undefined;
        if (this.peer && candidate) {
          try {
            await this.peer.addIceCandidate(candidate);
          } catch {
            /* candidate raced the remote description — safe to drop */
          }
        }
        break;
      }

      case 'ping':
        this.send({ type: 'pong', time: message.time ?? Date.now() });
        break;

      case 'pong':
        if (typeof message.time === 'number') {
          this.latencyMs = Math.max(0, Date.now() - message.time);
        }
        break;

      case 'streamerDisconnected':
        // Our instance went away — fall back to polling for a new one.
        this.subscribedStreamerId = null;
        this.clearOfferWatchdog();
        this.send({ type: 'listStreamers' });
        break;

      case 'playerConnected':
      case 'playerDisconnected':
      case 'playerCount':
      case 'layerPreference':
        break;

      default:
        break;
    }
    this.emit();
  }

  private async acceptOffer(sdp: string): Promise<void> {
    this.teardownPeer();
    const peer = new RTCPeerConnection({
      iceServers: iceServers(this.options, this.peerConnectionOptions ?? undefined),
      iceTransportPolicy: this.options.forceTURN ? 'relay' : 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    this.peer = peer;

    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });

    // Epic's streamer opens a data channel of its own (received below); create
    // a fallback channel too so there is a send path even if the instance is
    // configured not to open one. Both multiplex over the same SCTP
    // association, and tuning commands are idempotent, so overlap is safe.
    this.attachChannel(peer.createDataChannel('cloudcast'), true);
    peer.ondatachannel = (event) => this.attachChannel(event.channel, false);

    const activateStream = () => {
      if (this.state === 'streaming') return;
      // Prefer the video element's decoded dimensions (most reliable) and
      // fall back to track settings when the video hasn't decoded yet.
      const videoTrack = this.video.srcObject instanceof MediaStream
        ? (this.video.srcObject as MediaStream).getVideoTracks()[0]
        : undefined;
      const settings = videoTrack?.getSettings();
      this.resolution =
        (this.video.videoWidth > 0 && this.video.videoHeight > 0)
          ? { width: this.video.videoWidth, height: this.video.videoHeight }
          : { width: settings?.width ?? 0, height: settings?.height ?? 0 };
      this.options.onFrame?.(this.resolution);
      this.setState('streaming', null);
      // Re-push the fidelity spec for this session — commands queue until a
      // data channel is open, so this lands the moment the streamer is ready.
      this.pushFidelity();
      this.emit();
    };

    peer.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.video.srcObject = stream;

      const track = event.track;

      // Retry play — browsers may block autoplay even when muted.
      const tryPlay = () => {
        void this.video.play().catch(() => {
          // Autoplay blocked — retry once on user interaction.
          const retry = () => {
            window.removeEventListener('pointerdown', retry);
            void this.video.play().catch(() => undefined);
          };
          window.addEventListener('pointerdown', retry, { once: true });
        });
      };
      tryPlay();

      if (track.kind === 'video') {
        // The track may already be unmuted by the time ontrack fires —
        // WebRTC often delivers tracks in an active state. If we only
        // listen for `unmute` we miss the initial activation and the
        // state stays stuck at `negotiating` (black overlay).
        const onTrackActive = () => {
          track.removeEventListener('unmute', onTrackActive);
          activateStream();
        };

        if (track.readyState === 'live' && !track.muted) {
          // Track is already producing frames — activate immediately
          // after a microtask so the video element has time to attach
          // the stream and start decoding.
          queueMicrotask(activateStream);
        } else {
          track.addEventListener('unmute', onTrackActive);
        }

        // Belt-and-suspenders: also catch the `playing` event on the
        // video element as a fallback for environments where the track
        // mute/unmute events are unreliable (e.g. Safari).
        this.video.addEventListener('playing', () => {
          activateStream();
        }, { once: true });
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: 'iceCandidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        this.setState('reconnecting', `Connection unstable — retrying…`);
        this.scheduleReconnect();
      }
      this.emit();
    };

    try {
      await peer.setRemoteDescription({ type: 'offer', sdp });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.send({ type: 'answer', sdp: answer.sdp ?? '' });
      this.setState('negotiating', 'Negotiating video stream…');
    } catch (error) {
      this.setState('failed', describe(error, 'Connection failed'));
    }
    this.emit();
  }

  /* -------------------------------------------------------- data channel --- */

  private attachChannel(channel: RTCDataChannel, isLocal: boolean): void {
    channel.binaryType = 'arraybuffer';
    if (isLocal) this.localChannel = channel;
    else this.remoteChannel = channel;

    channel.onopen = () => this.handleChannelOpen(channel);
    channel.onclose = () => {
      if (this.localChannel === channel) this.localChannel = null;
      if (this.remoteChannel === channel) this.remoteChannel = null;
      this.emit();
    };
    channel.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
      if (typeof event.data !== 'string') this.handleStreamMessage(event.data);
    };

    // ondatachannel can arrive with the channel already open.
    if (channel.readyState === 'open') this.handleChannelOpen(channel);
  }

  private handleChannelOpen(channel: RTCDataChannel): void {
    const isRemote = channel !== this.localChannel;
    if (isRemote) this.remoteChannel = channel;
    this.flushCommands();
    if (isRemote && this.tuningSentOnLocal) {
      // Tuning was flushed through the fallback channel first; re-send it
      // through the streamer's own channel (which the engine is guaranteed to
      // read). Console commands are idempotent, so overlap is harmless.
      this.tuningSentOnLocal = false;
      this.pushFidelity();
    }
    // Ask the engine for its settings so we learn whether console commands
    // (and therefore the whole fidelity spec) are permitted.
    this.writeRaw('RequestInitialSettings', []);
    this.emit();
  }

  /** The channel the streamer is known to read; the local one is a fallback. */
  private preferredChannel(): RTCDataChannel | null {
    if (this.remoteChannel && this.remoteChannel.readyState === 'open') return this.remoteChannel;
    if (this.localChannel && this.localChannel.readyState === 'open') return this.localChannel;
    return null;
  }

  private writeRaw(type: string, values?: readonly (number | string)[]): boolean {
    const channel = this.preferredChannel();
    if (!channel) return false;
    const bytes = encodeToStreamerMessage(type, values);
    if (!bytes) return false;
    try {
      channel.send(bytes);
      return true;
    } catch {
      return false;
    }
  }

  private writeCommand(command: string): boolean {
    const channel = this.preferredChannel();
    const written = this.writeRaw('Command', [command]);
    if (written && channel === this.localChannel) this.tuningSentOnLocal = true;
    return written;
  }

  private flushCommands(): void {
    while (this.pendingCommands.length > 0) {
      if (!this.writeCommand(this.pendingCommands[0])) return;
      this.pendingCommands.shift();
    }
  }

  /** Input is live-only: events raised before the channel exists are dropped. */
  private sendInput(type: string, values: readonly (number | string)[]): void {
    const channel = this.preferredChannel();
    if (!channel) return;
    const bytes = encodeToStreamerMessage(type, values);
    if (!bytes) return;
    try {
      channel.send(bytes);
    } catch {
      /* channel raced closed */
    }
  }

  private handleStreamMessage(data: ArrayBuffer): void {
    if (data.byteLength < 1) return;
    const view = new DataView(data);
    if (view.getUint8(0) !== FROM_STREAMER_INITIAL_SETTINGS) return;

    let text = readUint16String(view, 1);
    if (text === null) {
      // Fallback: some builds frame JSON payloads as plain UTF-8.
      const bytes = new Uint8Array(data, 1);
      const decoded = new TextDecoder().decode(bytes);
      const start = decoded.indexOf('{');
      const end = decoded.lastIndexOf('}');
      text = start >= 0 && end > start ? decoded.slice(start, end + 1) : null;
    }
    if (!text) return;

    try {
      const parsed = JSON.parse(text) as {
        PixelStreamingSettings?: { AllowPixelStreamingCommands?: boolean };
      };
      const allowed = parsed?.PixelStreamingSettings?.AllowPixelStreamingCommands;
      if (typeof allowed === 'boolean') {
        this.consoleCommandsAllowed = allowed;
        this.emit();
      }
    } catch {
      /* not a JSON payload we understand — ignore */
    }
  }

  private displayMetrics(): VideoDisplayMetrics | null {
    const rect = this.video.getBoundingClientRect();
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    if (rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return null;
    return videoDisplayMetrics(rect.width, rect.height, width, height);
  }

  /* --------------------------------------------------------------- stats --- */

  private startStats(): void {
    this.stopStats();
    this.lastFpsAt = performance.now();
    this.statsTimer = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - this.lastFpsAt) / 1000;
      if (elapsed > 0) {
        // `frameCounter` is incremented by the video element's rVFC callback.
        this.lastFpsAt = now;
      }
      const peer = this.peer;
      if (peer) {
        void peer.getStats().then((report) => {
          report.forEach((entry) => {
            const stat = entry as unknown as {
              type: string;
              bytesReceived?: number;
              framesDecoded?: number;
            };
            if (stat.type === 'inbound-rtp' && typeof stat.bytesReceived === 'number') {
              this.bytesReceived = stat.bytesReceived;
            }
          });
        });
      }
      this.emit();
    }, 1000);
  }

  private stopStats(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private setState(state: PixelStreamState, message: string | null): void {
    this.state = state;
    this.message = message;
    this.emit();
  }

  private emit(): void {
    this.options.onStats?.(this.getStats());
  }
}

function describe(error: unknown, fallback: string): string {
  return error instanceof Error ? `${fallback}: ${error.message}` : fallback;
}
