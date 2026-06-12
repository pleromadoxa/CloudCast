import type { RelayClientMessage, RelayDestination, RelayServerMessage } from './relayProtocol';

export interface RelayClientOptions {
  url: string;
  onServerMessage?: (msg: RelayServerMessage) => void;
  onClose?: () => void;
  onError?: (message: string) => void;
}

export class BroadcastRelayClient {
  private ws: WebSocket | null = null;
  private options: RelayClientOptions;

  constructor(options: RelayClientOptions) {
    this.options = options;
  }

  connect(timeoutMs = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.options.url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      const timer = setTimeout(() => {
        reject(new Error('Broadcast relay connection timed out.'));
        ws.close();
      }, timeoutMs);

      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };

      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Could not connect to the broadcast relay.'));
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        try {
          const msg = JSON.parse(ev.data) as RelayServerMessage;
          this.options.onServerMessage?.(msg);
          if (msg.type === 'error') this.options.onError?.(msg.message);
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        this.options.onClose?.();
        this.ws = null;
      };
    });
  }

  waitForReady(timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.options.onServerMessage = prev;
        reject(new Error('Relay did not confirm broadcast start.'));
      }, timeoutMs);
      const prev = this.options.onServerMessage;
      this.options.onServerMessage = (msg) => {
        prev?.(msg);
        if (msg.type === 'ready') {
          clearTimeout(timer);
          this.options.onServerMessage = prev;
          resolve();
        }
        if (msg.type === 'error') {
          clearTimeout(timer);
          this.options.onServerMessage = prev;
          reject(new Error(msg.message));
        }
      };
    });
  }

  sendJson(message: RelayClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Broadcast relay is not connected.');
    }
    this.ws.send(JSON.stringify(message));
  }

  sendChunk(chunk: Blob) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(chunk);
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export async function startRelaySession(
  url: string,
  destinations: RelayDestination[],
  token?: string,
  hooks?: { onRelayClose?: () => void },
): Promise<BroadcastRelayClient> {
  const client = new BroadcastRelayClient({
    url,
    onClose: hooks?.onRelayClose,
  });
  await client.connect();
  const readyWait = client.waitForReady();
  client.sendJson({ type: 'start', destinations, token });
  await readyWait;
  return client;
}
