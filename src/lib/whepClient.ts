import { ICE_SERVERS } from './constants';
import { waitForIceGathering } from './utils';

export type WhepConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface WhepClientOptions {
  whepUrl: string;
  onTrack?: (stream: MediaStream) => void;
  onStateChange?: (state: WhepConnectionState) => void;
}

/**
 * Regal Cloud stream playback client.
 * Negotiates a secure playback session and attaches incoming tracks to a MediaStream.
 */
export class WhepClient {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private mediaStream: MediaStream | null = null;
  private state: WhepConnectionState = 'idle';
  private options: WhepClientOptions;

  constructor(options: WhepClientOptions) {
    this.options = options;
  }

  get stream(): MediaStream | null {
    return this.mediaStream;
  }

  get connectionState(): WhepConnectionState {
    return this.state;
  }

  private setState(next: WhepConnectionState) {
    this.state = next;
    this.options.onStateChange?.(next);
  }

  async connect(): Promise<MediaStream> {
    await this.disconnect();

    this.setState('connecting');
    this.mediaStream = new MediaStream();

    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      bundlePolicy: 'max-bundle',
    });

    this.pc.addTransceiver('video', { direction: 'recvonly' });
    this.pc.addTransceiver('audio', { direction: 'recvonly' });

    this.pc.addEventListener('track', (event) => {
      if (event.track && this.mediaStream) {
        this.mediaStream.addTrack(event.track);
        this.options.onTrack?.(this.mediaStream);
      }
    });

    this.pc.addEventListener('connectionstatechange', () => {
      const cs = this.pc?.connectionState;
      if (cs === 'connected') this.setState('connected');
      else if (cs === 'disconnected') this.setState('disconnected');
      else if (cs === 'failed') this.setState('failed');
    });

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);

    const response = await fetch(this.options.whepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: this.pc.localDescription!.sdp,
    });

    if (response.status !== 201) {
      const errorText = await response.text();
      this.setState('failed');
      throw new Error(`Stream negotiation failed (${response.status}): ${errorText}`);
    }

    this.resourceUrl = response.headers.get('Location');
    const answerSdp = await response.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    this.setState('connected');

    return this.mediaStream;
  }

  async disconnect(): Promise<void> {
    if (this.resourceUrl) {
      try {
        await fetch(this.resourceUrl, { method: 'DELETE' });
      } catch {
        /* best-effort teardown */
      }
      this.resourceUrl = null;
    }

    this.pc?.close();
    this.pc = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.setState('idle');
  }
}
