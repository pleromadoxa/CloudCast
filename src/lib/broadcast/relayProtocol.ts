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

/**
 * Catch unreachable relay configs before attempting a WebSocket that will fail with a
 * generic error — e.g. an insecure ws:// relay from a secure page (blocked by the
 * browser), or a localhost relay referenced from a deployed site.
 */
export function relayUrlProblem(): string | null {
  const url = relayWsUrl();
  if (!url || typeof window === 'undefined') return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Broadcast relay URL is invalid. Set VITE_BROADCAST_RELAY_WS to a ws:// or wss:// URL.';
  }

  const pageSecure = window.location.protocol === 'https:';
  const relayInsecure = parsed.protocol === 'ws:';
  const host = parsed.hostname;
  const relayIsLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const pageIsLocal =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (pageSecure && relayInsecure) {
    return 'The broadcast relay is an insecure ws:// URL, which secure (https) pages block. Host the relay with TLS and set VITE_BROADCAST_RELAY_WS=wss://your-relay-host, then redeploy.';
  }

  if (relayIsLocal && !pageIsLocal) {
    return 'The broadcast relay points to localhost, which this deployed site cannot reach. Run the relay on a public host and set VITE_BROADCAST_RELAY_WS to its wss:// URL, then redeploy.';
  }

  return null;
}
