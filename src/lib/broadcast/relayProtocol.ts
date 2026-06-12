export interface RelayDestination {
  streamUrl: string;
  streamKey: string;
  name?: string;
}

export type RelayClientMessage =
  | { type: 'start'; destinations: RelayDestination[]; token?: string }
  | { type: 'stop' };

export type RelayServerMessage =
  | { type: 'ready'; destinations: number }
  | { type: 'error'; message: string }
  | { type: 'stopped' };

export function relayWsUrl(): string | null {
  const url = import.meta.env.VITE_BROADCAST_RELAY_WS as string | undefined;
  return url?.trim() || null;
}

export function relayAuthToken(): string | undefined {
  const token = import.meta.env.VITE_BROADCAST_RELAY_TOKEN as string | undefined;
  return token?.trim() || undefined;
}
