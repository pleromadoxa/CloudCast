export type SignalingEventType = 'offer' | 'answer' | 'ice' | 'stream-ready' | 'stream-stopped';

export interface SignalingPayload {
  from: string;
  to?: string;
  deviceId: string;
  streamId: string;
  timestamp: string;
}

export interface OfferPayload extends SignalingPayload {
  sdp: string;
  type: RTCSdpType;
}

export interface AnswerPayload extends SignalingPayload {
  sdp: string;
  type: RTCSdpType;
}

export interface IcePayload extends SignalingPayload {
  candidate: RTCIceCandidateInit;
}

export interface StreamReadyPayload extends SignalingPayload {
  whepUrl: string;
  label: string;
}

export interface StreamStoppedPayload extends SignalingPayload {
  reason?: string;
}

export type SignalingEvent =
  | { event: 'offer'; payload: OfferPayload }
  | { event: 'answer'; payload: AnswerPayload }
  | { event: 'ice'; payload: IcePayload }
  | { event: 'stream-ready'; payload: StreamReadyPayload }
  | { event: 'stream-stopped'; payload: StreamStoppedPayload };
