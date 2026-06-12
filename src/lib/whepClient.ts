import { REGAL_WHEP_PC_CONFIG } from './meshConfig';
import { waitForIceGathering } from './utils';

export type WhepConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'reconnecting';

export interface WhepClientOptions {
  whepUrl: string;
  onTrack?: (stream: MediaStream) => void;
  onStateChange?: (state: WhepConnectionState) => void;
}

/** Regal Cloud playback client — stable relayed WebRTC for Pro / Pro Master plans. */
export class WhepClient {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private mediaStream: MediaStream | null = null;
  private state: WhepConnectionState = 'idle';
  private options: WhepClientOptions;
  private aborted = false;

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
    this.aborted = false;
    await this.disconnect(false);

    this.setState('connecting');
    this.mediaStream = new MediaStream();

    this.pc = new RTCPeerConnection(REGAL_WHEP_PC_CONFIG);

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

    this.pc.addEventListener('iceconnectionstatechange', () => {
      const ice = this.pc?.iceConnectionState;
      if (ice === 'failed' || ice === 'disconnected') {
        this.setState(ice === 'failed' ? 'failed' : 'disconnected');
      }
    });

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);

    const response = await fetch(this.options.whepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: this.pc.localDescription!.sdp,
    });

    if (this.aborted) {
      throw new Error('Connection aborted');
    }

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

  async disconnect(markIdle = true): Promise<void> {
    this.aborted = true;

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
    if (markIdle) this.setState('idle');
  }
}
