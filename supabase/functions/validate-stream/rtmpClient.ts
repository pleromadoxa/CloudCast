export interface ParsedRtmp {
  host: string;
  port: number;
  app: string;
  tls: boolean;
  tcUrl: string;
}

export function parseRtmpUrl(raw: string): ParsedRtmp {
  const trimmed = raw.trim();
  if (!/^rtmps?:\/\//i.test(trimmed)) {
    throw new Error("Stream URL must start with rtmp:// or rtmps://");
  }

  const tls = /^rtmps:\/\//i.test(trimmed);
  const withoutScheme = trimmed.replace(/^rtmps?:\/\//i, "");
  const slashIdx = withoutScheme.indexOf("/");
  const hostPart = slashIdx >= 0 ? withoutScheme.slice(0, slashIdx) : withoutScheme;
  const pathPart = slashIdx >= 0 ? withoutScheme.slice(slashIdx + 1) : "";

  const [host, portStr] = hostPart.split(":");
  if (!host) throw new Error("Stream URL is missing a host name.");

  const port = portStr ? Number(portStr) : tls ? 443 : 1935;
  const app = pathPart.replace(/\/+$/, "") || "live";
  const scheme = tls ? "rtmps" : "rtmp";

  return { host, port, app, tls, tcUrl: `${scheme}://${hostPart}/${app}` };
}

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function writeU32BE(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, false);
}

function buildHandshakeC0C1(): Uint8Array {
  const packet = new Uint8Array(1537);
  packet[0] = 0x03;
  const view = new DataView(packet.buffer);
  const now = (Date.now() & 0xffffffff) >>> 0;
  writeU32BE(view, 1, now);
  writeU32BE(view, 5, 0);
  packet.set(randomBytes(1528), 9);
  return packet;
}

function buildHandshakeC2(s1: Uint8Array): Uint8Array {
  const c2 = new Uint8Array(1536);
  c2.set(s1.slice(0, 1536));
  return c2;
}

function amfString(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  const out = new Uint8Array(3 + encoded.length);
  out[0] = 0x02;
  out[1] = (encoded.length >> 8) & 0xff;
  out[2] = encoded.length & 0xff;
  out.set(encoded, 3);
  return out;
}

function amfNumber(value: number): Uint8Array {
  const out = new Uint8Array(9);
  out[0] = 0x00;
  new DataView(out.buffer).setFloat64(1, value, false);
  return out;
}

function amfBool(value: boolean): Uint8Array {
  return new Uint8Array([0x01, value ? 1 : 0]);
}

function amfNull(): Uint8Array {
  return new Uint8Array([0x05]);
}

function amfObject(pairs: Record<string, Uint8Array>): Uint8Array {
  const chunks: Uint8Array[] = [new Uint8Array([0x03])];
  for (const [key, val] of Object.entries(pairs)) {
    const keyBytes = new TextEncoder().encode(key);
    // AMF0 object keys are length-prefixed with a 2-byte (U16 BE) length, no type marker.
    const keyPart = new Uint8Array(2 + keyBytes.length);
    keyPart[0] = (keyBytes.length >> 8) & 0xff;
    keyPart[1] = keyBytes.length & 0xff;
    keyPart.set(keyBytes, 2);
    chunks.push(keyPart, val);
  }
  chunks.push(new Uint8Array([0x00, 0x00, 0x09]));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function buildAmfCommand(
  name: string,
  transactionId: number,
  commandObject: Record<string, Uint8Array> | null,
  ...args: Uint8Array[]
): Uint8Array {
  const parts = [amfString(name), amfNumber(transactionId)];
  if (commandObject) parts.push(amfObject(commandObject));
  else parts.push(amfNull());
  parts.push(...args);
  return concat(...parts);
}

/** Max payload bytes per RTMP chunk before a continuation header is required. */
const RTMP_CHUNK_SIZE = 128;

function buildRtmpChunk(messageType: number, payload: Uint8Array, chunkStreamId = 3): Uint8Array {
  const csid = chunkStreamId & 0x3f;

  // Type 0 chunk: 1-byte basic header + 11-byte message header = 12 bytes.
  const header = new Uint8Array(12);
  header[0] = csid; // fmt (0) << 6 | csid
  // bytes 1-3: timestamp (0)
  const len = payload.length;
  header[4] = (len >> 16) & 0xff; // bytes 4-6: message length (3-byte BE)
  header[5] = (len >> 8) & 0xff;
  header[6] = len & 0xff;
  header[7] = messageType; // byte 7: message type id
  // bytes 8-11: message stream id (4-byte LE, 0)

  const parts: Uint8Array[] = [header, payload.subarray(0, RTMP_CHUNK_SIZE)];

  // Split payloads larger than the chunk size with fmt=3 continuation headers.
  let offset = RTMP_CHUNK_SIZE;
  while (offset < payload.length) {
    parts.push(new Uint8Array([0xc0 | csid]));
    parts.push(payload.subarray(offset, offset + RTMP_CHUNK_SIZE));
    offset += RTMP_CHUNK_SIZE;
  }

  return concat(...parts);
}

/**
 * Race a promise against a timer. `Deno.Conn.read` has no native timeout and can
 * block forever, so every read/connect must be wrapped or the function hangs.
 */
function raceTimeout<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout?.();
      resolve(null);
    }, ms);
    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      });
  });
}

async function readExact(conn: Deno.Conn, length: number, timeoutMs: number): Promise<Uint8Array | null> {
  const buf = new Uint8Array(length);
  let read = 0;
  const deadline = Date.now() + timeoutMs;

  while (read < length) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    const n = await raceTimeout(conn.read(buf.subarray(read)), remaining, () => {
      try {
        conn.close();
      } catch {
        /* already closed */
      }
    });
    if (n === null || n === 0) return null; // timeout, EOF, or closed
    read += n;
  }
  return buf;
}

async function readAvailable(conn: Deno.Conn, timeoutMs: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const deadline = Date.now() + timeoutMs;
  let total = 0;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const buf = new Uint8Array(4096);
    const n = await raceTimeout(conn.read(buf), remaining);
    if (n === null || n === 0) break; // timeout, EOF, or closed
    chunks.push(buf.subarray(0, n));
    total += n;
    if (total > 65536) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function responseIndicatesFailure(bytes: Uint8Array): string | null {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lower = text.toLowerCase();

  if (
    (lower.includes("auth") && lower.includes("fail")) ||
    (lower.includes("invalid") && lower.includes("key")) ||
    lower.includes("badname") ||
    lower.includes("publish.badname") ||
    lower.includes("connect.failed") ||
    lower.includes("access denied") ||
    lower.includes("unauthorized") ||
    lower.includes("_error")
  ) {
    return "Stream server rejected the connection or stream key. Check your URL and key.";
  }

  if (lower.includes("success") || lower.includes("start") || lower.includes("_result")) {
    return null;
  }

  return null;
}

// Bounded so the whole probe finishes well under the client-side 14s timeout.
const CONNECT_TIMEOUT_MS = 3500;
const HANDSHAKE_TIMEOUT_MS = 2500;
const CONNECT_RESPONSE_TIMEOUT_MS = 2500;
const PUBLISH_RESPONSE_TIMEOUT_MS = 2500;

export async function validateRtmpDestination(
  streamUrl: string,
  streamKey: string,
): Promise<{ ok: boolean; message: string; stage?: string }> {
  const parsed = parseRtmpUrl(streamUrl);
  const key = streamKey.trim();
  if (key.length < 4) {
    return { ok: false, message: "Stream key looks too short.", stage: "format" };
  }

  const connectAttempt = parsed.tls
    ? Deno.connectTls({ hostname: parsed.host, port: parsed.port })
    : Deno.connect({ hostname: parsed.host, port: parsed.port });

  const conn = await raceTimeout(connectAttempt, CONNECT_TIMEOUT_MS);
  if (!conn) {
    return {
      ok: false,
      message: `Cannot reach stream server at ${parsed.host}:${parsed.port}. Check the stream URL / host.`,
      stage: "connect",
    };
  }

  try {
    await conn.write(buildHandshakeC0C1());

    const s0 = await readExact(conn, 1, HANDSHAKE_TIMEOUT_MS);
    if (!s0 || s0[0] !== 0x03) {
      return {
        ok: false,
        message: "Stream server did not respond with a valid RTMP handshake.",
        stage: "handshake",
      };
    }

    const s1 = await readExact(conn, 1536, HANDSHAKE_TIMEOUT_MS);
    const s2 = await readExact(conn, 1536, HANDSHAKE_TIMEOUT_MS);
    if (!s1 || !s2) {
      return {
        ok: false,
        message: "Stream server handshake timed out.",
        stage: "handshake",
      };
    }

    await conn.write(buildHandshakeC2(s1));

    const connectPayload = buildAmfCommand("connect", 1, {
      app: amfString(parsed.app),
      flashVer: amfString("FMLE/3.0 (compatible; CloudCast)"),
      tcUrl: amfString(parsed.tcUrl),
      fpad: amfBool(false),
      capabilities: amfNumber(15),
      audioCodecs: amfNumber(3575),
      videoCodecs: amfNumber(252),
      videoFunction: amfNumber(1),
    });

    await conn.write(buildRtmpChunk(0x14, connectPayload));
    const connectResponse = await readAvailable(conn, CONNECT_RESPONSE_TIMEOUT_MS);
    const connectFail = responseIndicatesFailure(connectResponse);
    if (connectFail) {
      return { ok: false, message: connectFail, stage: "connect" };
    }

    const releasePayload = buildAmfCommand("releaseStream", 2, null, amfNull(), amfString(key));
    await conn.write(buildRtmpChunk(0x14, releasePayload));

    const publishPayload = buildAmfCommand("publish", 3, null, amfString(key), amfString("live"));
    await conn.write(buildRtmpChunk(0x14, publishPayload));

    const publishResponse = await readAvailable(conn, PUBLISH_RESPONSE_TIMEOUT_MS);
    const publishFail = responseIndicatesFailure(publishResponse);
    if (publishFail) {
      return { ok: false, message: publishFail, stage: "publish" };
    }

    if (connectResponse.length === 0 && publishResponse.length === 0) {
      return {
        ok: true,
        message: "Stream server is reachable. Connection looks good.",
        stage: "connect",
      };
    }

    return {
      ok: true,
      message: "Stream server accepted the connection details.",
      stage: "publish",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Stream validation failed.",
      stage: "connect",
    };
  } finally {
    try {
      conn?.close();
    } catch {
      /* ignore */
    }
  }
}
