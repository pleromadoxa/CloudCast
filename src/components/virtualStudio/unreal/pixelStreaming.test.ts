import { describe, expect, it } from 'vitest';
import {
  encodeToStreamerMessage,
  translateDelta,
  translatePointer,
  videoDisplayMetrics,
  TO_STREAMER_MESSAGES,
} from './pixelStreaming';

function decodeStringPayload(buffer: ArrayBuffer, offset: number): string {
  const view = new DataView(buffer);
  const length = view.getUint16(offset, true);
  let text = '';
  for (let i = 0; i < length; i += 1) {
    text += String.fromCharCode(view.getUint16(offset + 2 + i * 2, true));
  }
  return text;
}

describe('to-streamer binary framing', () => {
  it('encodes a console command as id 51 + uint16 length + UTF-16 payload', () => {
    const command = 'r.Lumen.GlobalIllumination 1';
    const buffer = encodeToStreamerMessage('Command', [command]);
    expect(buffer).not.toBeNull();

    const view = new DataView(buffer!);
    expect(view.getUint8(0)).toBe(TO_STREAMER_MESSAGES.Command.id);
    expect(view.getUint8(0)).toBe(51);
    // 1 id byte + 2 length bytes + 2 bytes per UTF-16 code unit
    expect(buffer!.byteLength).toBe(1 + 2 + command.length * 2);
    expect(view.getUint16(1, true)).toBe(command.length);
    expect(decodeStringPayload(buffer!, 1)).toBe(command);
  });

  it('encodes MouseMove as u16,u16,i16,i16 after the id byte', () => {
    const buffer = encodeToStreamerMessage('MouseMove', [65535, 32768, -1234, 4321]);
    const view = new DataView(buffer!);
    expect(view.getUint8(0)).toBe(74);
    expect(view.getUint16(1, true)).toBe(65535);
    expect(view.getUint16(3, true)).toBe(32768);
    expect(view.getInt16(5, true)).toBe(-1234);
    expect(view.getInt16(7, true)).toBe(4321);
    expect(buffer!.byteLength).toBe(1 + 2 + 2 + 2 + 2);
  });

  it('clamps fields into their wire ranges instead of wrapping', () => {
    const buffer = encodeToStreamerMessage('KeyDown', [999, 3]);
    const view = new DataView(buffer!);
    expect(view.getUint8(0)).toBe(60);
    expect(view.getUint8(1)).toBe(255); // keyCode saturated, not 999 % 256
    expect(view.getUint8(2)).toBe(3);
  });

  it('encodes the settings probe as a bare id', () => {
    const buffer = encodeToStreamerMessage('RequestInitialSettings');
    expect(buffer!.byteLength).toBe(1);
    expect(new DataView(buffer!).getUint8(0)).toBe(7);
  });

  it('rejects message types outside the protocol', () => {
    // The classic-era vocabulary must never be encoded — if it reaches the
    // relay, protocol 1.3.0 drops it as an unhandled message.
    expect(encodeToStreamerMessage('connect')).toBeNull();
    expect(encodeToStreamerMessage('mouseMove', [0, 0, 0, 0])).toBeNull();
    expect(encodeToStreamerMessage('latencyTest')).toBeNull();
  });
});

describe('pointer translation', () => {
  const metrics = videoDisplayMetrics(1000, 500, 1920, 1080);

  it('letterboxes the contained video rect inside the element', () => {
    const scale = Math.min(1000 / 1920, 500 / 1080);
    expect(metrics.width).toBeCloseTo(1920 * scale, 6);
    expect(metrics.height).toBeCloseTo(1080 * scale, 6);
    // The element is wider than the video aspect → horizontal pillarbox.
    expect(metrics.offsetX).toBeGreaterThan(0);
    expect(metrics.offsetY).toBeCloseTo(0, 6);
  });

  it('maps the centre of the video to the centre of the stream range', () => {
    const centre = translatePointer(0.5, 0.5, metrics);
    expect(centre.inRange).toBe(true);
    expect(centre.x).toBeCloseTo(32768, -2);
    expect(centre.y).toBeCloseTo(32768, -2);
  });

  it('collapses positions in the letterbox bars to the out-of-range sentinel', () => {
    // Far-left element pixels fall outside the pillarboxed video.
    const inBar = translatePointer(0.01, 0.5, metrics);
    expect(inBar.inRange).toBe(false);
    expect(inBar.x).toBe(65535);
    expect(inBar.y).toBe(65535);
  });

  it('scales pixel deltas against the displayed video and clamps to int16', () => {
    const delta = translateDelta(metrics.width / 2, -metrics.height, metrics);
    expect(delta.x).toBe(32767);
    expect(delta.y).toBe(-32768);

    const tiny = translateDelta(1, 1, metrics);
    expect(tiny.x).toBeGreaterThanOrEqual(0);
    expect(tiny.x).toBeLessThan(100);
  });
});
