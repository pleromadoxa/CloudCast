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

function readU32BE(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
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
    const keyPart = new Uint8Array(keyBytes.length);
    keyPart.set(keyBytes);
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

function buildRtmpChunk(messageType: number, payload: Uint8Array, chunkStreamId = 3): Uint8Array {
  const header = new Uint8Array(12);
  header[0] = chunkStreamId & 0x3f;
  const view = new DataView(header.buffer);
  writeU32BE(view, 4, payload.length);
  header[8] = messageType;
  writeU32BE(view, 9, 0);
  return concat(header, payload);
}

async function readExact(conn: Deno.Conn, length: number, timeoutMs: number): Promise<Uint8Array | null> {
  const buf = new Uint8Array(length);
  let read = 0;
  const deadline = Date.now() + timeoutMs;

  while (read < length) {
    if (Date.now() > deadline) return null;
    const n = await conn.read(buf.subarray(read));
    if (n === null) return null;
    read += n;
  }
  return buf;
}

async function readAvailable(conn: Deno.Conn, timeoutMs: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const deadline = Date.now() + timeoutMs;
  let total = 0;

  while (Date.now() < deadline) {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    if (n === null) break;
    chunks.push(buf.subarray(0, n));
    total += n;
    if (total > 65536) break;
    await new Promise((r) => setTimeout(r, 100));
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

export async function validateRtmpDestination(
  streamUrl: string,
  streamKey: string,
): Promise<{ ok: boolean; message: string; stage?: string }> {
  const parsed = parseRtmpUrl(streamUrl);
  const key = streamKey.trim();
  if (key.length < 4) {
    return { ok: false, message: "Stream key looks too short.", stage: "format" };
  }

  let conn: Deno.Conn | null = null;

  try {
    conn = parsed.tls
      ? await Deno.connectTls({ hostname: parsed.host, port: parsed.port })
      : await Deno.connect({ hostname: parsed.host, port: parsed.port });

    conn.setReadTimeout?.(8000);
    conn.setWriteTimeout?.(8000);
  } catch {
    return {
      ok: false,
      message: `Cannot reach stream server at ${parsed.host}:${parsed.port}. Check the stream URL / host.`,
      stage: "connect",
    };
  }

  try {
    await conn.write(buildHandshakeC0C1());

    const s0 = await readExact(conn, 1, 8000);
    if (!s0 || s0[0] !== 0x03) {
      return {
        ok: false,
        message: "Stream server did not respond with a valid RTMP handshake.",
        stage: "handshake",
      };
    }

    const s1 = await readExact(conn, 1536, 8000);
    const s2 = await readExact(conn, 1536, 8000);
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
    const connectResponse = await readAvailable(conn, 4000);
    const connectFail = responseIndicatesFailure(connectResponse);
    if (connectFail) {
      return { ok: false, message: connectFail, stage: "connect" };
    }

    const releasePayload = buildAmfCommand("releaseStream", 2, null, amfNull(), amfString(key));
    await conn.write(buildRtmpChunk(0x14, releasePayload));

    const publishPayload = buildAmfCommand("publish", 3, null, amfString(key), amfString("live"));
    await conn.write(buildRtmpChunk(0x14, publishPayload));

    const publishResponse = await readAvailable(conn, 5000);
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
