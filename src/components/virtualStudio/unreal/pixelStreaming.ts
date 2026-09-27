/**
 * Unreal Engine Pixel Streaming — WebRTC client.
 *
 * Epic does not ship an in-browser Unreal scene renderer; the supported way to
 * put an Unreal render on a web page is *Pixel Streaming*: a GPU instance
 * renders the scene and streams it to the browser over WebRTC, with the browser
 * forwarding input back over the data channel.
 *
 * This module implements the player side of that protocol against the
 * Pixel Streaming infrastructure's signalling server (the WebSocket endpoint
 * exposed by `SignallingWebServer` / the C++ `Streamer` stack):
 *
 *   player  →  {"type":"connect"}
 *   streamer →  {"type":"offer","sdp":…}
 *   player  →  {"type":"answer","sdp":…}
 *   both    →  {"type":"iceCandidate","candidate":{…}}
 *   streamer →  {"type":"ping"}     player → {"type":"pong"}
 *
 * and the input messages (`mouseMove`, `mouseDown`, `mouseUp`, `mouseWheel`,
 * `keyDown`, `keyUp`) that make the remote render interactive — which is what
 * lets CloudCast drive an Aximmetry-grade Unreal set from the browser.
 *
 * The data channel also carries **console commands**, which is how CloudCast
 * enforces the same physical-fidelity spec the R3F and Babylon stages implement
 * in-engine: Lumen global illumination and reflections, virtual shadow maps,
 * volumetric fog and TSR are all pushed from `fidelity.ts` so every virtual set
 * renders to the identical standard on all three engines.
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
  /** Round-trip latency reported by the streamer, in ms (null when unknown). */
  latencyMs: number | null;
  /** Decoded frames per second measured locally. */
  fps: number;
  resolution: { width: number; height: number } | null;
  bytesReceived: number;
  iceConnectionState: string | null;
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

interface SignallingMessage {
  type: string;
  [key: string]: unknown;
}

function iceServers(options: PixelStreamOptions): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }];
  if (options.turnUrl) {
    servers.push({
      urls: [options.turnUrl],
      username: options.turnUsername || undefined,
      credential: options.turnCredential || undefined,
    });
  }
  return servers;
}

export class PixelStreamClient {
  private readonly options: PixelStreamOptions;
  private socket: WebSocket | null = null;
  private peer: RTCPeerConnection | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.setState('connecting', 'Contacting the Pixel Streaming host…');

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.options.signallingUrl);
    } catch (error) {
      this.setState('failed', describe(error, 'Could not open the signalling socket'));
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.send({ type: 'connect' });
      this.setState('negotiating', 'Waiting for the streamer offer…');
    };
    socket.onmessage = (event) => void this.handleMessage(event);
    socket.onerror = () => {
      if (!this.disposed) this.setState('failed', 'Signalling socket error');
    };
    socket.onclose = () => {
      if (this.disposed) return;
      this.teardownPeer();
      this.scheduleReconnect();
    };

    this.startStats();
  }

  disconnect(): void {
    this.clearReconnect();
    this.stopStats();
    this.teardownPeer();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* already closed */
      }
      this.socket = null;
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
    };
  }

  /* ---------------------------------------------------------------- input --- */

  /** Normalised pointer position (0…1) over the video element. */
  mouseMove(x: number, y: number, deltaX: number, deltaY: number): void {
    this.send({ type: 'mouseMove', x, y, deltaX, deltaY });
  }

  mouseDown(button: number, x: number, y: number): void {
    this.send({ type: 'mouseDown', button, x, y });
  }

  mouseUp(button: number, x: number, y: number): void {
    this.send({ type: 'mouseUp', button, x, y });
  }

  mouseWheel(delta: number, x: number, y: number): void {
    this.send({ type: 'mouseWheel', delta, x, y });
  }

  keyDown(key: string, keyCode: number): void {
    this.send({ type: 'keyDown', key, keyCode });
  }

  keyUp(key: string, keyCode: number): void {
    this.send({ type: 'keyUp', key, keyCode });
  }

  /** Send an Unreal console command through the streamer. */
  sendCommand(command: string): void {
    this.send({ type: 'command', command });
  }

  /** Ask the streamer for a latency probe. */
  requestLatencyTest(): void {
    this.send({ type: 'latencyTest' });
  }

  /** Request a quality preset by pushing Unreal scalability console commands. */
  applyQuality(level: 'low' | 'medium' | 'high' | 'epic' | 'cinematic'): void {
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
   * queue until the session is streaming.
   */
  applyFidelity(tier: FidelityTier): void {
    this.fidelity = tier;
    this.pushFidelity();
  }

  /** Apply a render resolution request (Unreal console). */
  applyResolution(resolution: string): void {
    const [width, height] = resolution.split('x').map((v) => Number.parseInt(v, 10));
    if (!width || !height) return;
    this.sendCommand(`r.SetRes ${width}x${height}w`);
  }

  private pushFidelity(): void {
    const tier = this.fidelity;
    if (!tier || this.state !== 'streaming') return;
    for (const command of unrealScalabilityLevel(tier)) this.sendCommand(command);
    for (const command of unrealFidelityCommands(tier)) this.sendCommand(command);
  }

  /* ------------------------------------------------------------- private --- */

  private send(message: SignallingMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.setState('reconnecting', 'Reconnecting to the Pixel Streaming host…');
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
      case 'connect':
        // The streamer acknowledged; wait for its offer.
        this.setState('negotiating', 'Streamer acknowledged — negotiating video…');
        break;

      case 'offer':
        await this.acceptOffer(String(message.sdp ?? ''));
        break;

      case 'answer':
        // A player does not normally receive answers, but tolerate it.
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
        this.send({ type: 'pong', time: Date.now() });
        if (typeof message.time === 'number') {
          this.latencyMs = Math.max(0, Date.now() - message.time);
        }
        break;

      case 'latencyTest':
        this.send({ type: 'latencyResponse', time: Date.now() });
        break;

      case 'streamerReady':
        this.setState('negotiating', 'Streamer ready — requesting the session…');
        this.send({ type: 'connect' });
        break;

      case 'playerConnected':
      case 'playerCount':
      case 'config':
      case 'kick':
        break;

      default:
        break;
    }
    this.emit();
  }

  private async acceptOffer(sdp: string): Promise<void> {
    this.teardownPeer();
    const peer = new RTCPeerConnection({
      iceServers: iceServers(this.options),
      iceTransportPolicy: this.options.forceTURN ? 'relay' : 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    this.peer = peer;

    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });

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
      // The data channel is live — enforce the fidelity spec now.
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
        this.setState('reconnecting', `ICE ${state} — retrying…`);
        this.scheduleReconnect();
      }
      this.emit();
    };

    try {
      await peer.setRemoteDescription({ type: 'offer', sdp });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.send({ type: 'answer', sdp: answer.sdp ?? '' });
      this.setState('negotiating', 'Answer sent — waiting for media…');
    } catch (error) {
      this.setState('failed', describe(error, 'WebRTC negotiation failed'));
    }
    this.emit();
  }

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
