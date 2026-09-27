import { describe, expect, it } from 'vitest';
import { createZip, crc32 } from './zipBundle';

function u32(data: Uint8Array, offset: number): number {
  return (
    (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0
  );
}
function u16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

describe('crc32', () => {
  it('matches the canonical "123456789" check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('is 0 for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('createZip', () => {
  it('writes valid local headers, central directory and EOCD', async () => {
    const entries = [
      { name: '01-kick.wav', data: new Uint8Array([1, 2, 3, 4, 5]) },
      { name: '02-bass.wav', data: new Uint8Array([9, 8, 7]) },
    ];
    const blob = createZip(entries);
    expect(blob.type).toBe('application/zip');
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // First local file header
    expect(u32(bytes, 0)).toBe(0x04034b50);
    expect(u16(bytes, 8)).toBe(0); // store method
    expect(u32(bytes, 14)).toBe(crc32(entries[0].data));
    expect(u32(bytes, 18)).toBe(5); // compressed size
    expect(u32(bytes, 22)).toBe(5); // uncompressed size
    const nameLen = u16(bytes, 26);
    expect(new TextDecoder().decode(bytes.slice(30, 30 + nameLen))).toBe('01-kick.wav');
    const dataOffset = 30 + nameLen;
    expect(Array.from(bytes.slice(dataOffset, dataOffset + 5))).toEqual([1, 2, 3, 4, 5]);

    // EOCD at the end (22 bytes, no comment)
    const eocd = bytes.length - 22;
    expect(u32(bytes, eocd)).toBe(0x06054b50);
    expect(u16(bytes, eocd + 8)).toBe(2); // entries on this disk
    expect(u16(bytes, eocd + 10)).toBe(2); // total entries
    expect(u32(bytes, eocd + 16) + u32(bytes, eocd + 12)).toBe(eocd); // CD offset + CD size = EOCD offset
  });

  it('round-trips entry payloads through the archive layout', async () => {
    const payload = new Uint8Array(1024).map((_, i) => (i * 31) & 0xff);
    const blob = createZip([{ name: 'stem.wav', data: payload }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const nameLen = u16(bytes, 26);
    const dataOffset = 30 + nameLen;
    expect(Array.from(bytes.slice(dataOffset, dataOffset + payload.length))).toEqual(Array.from(payload));
    // Central directory follows the data and precedes the EOCD
    const centralOffset = dataOffset + payload.length;
    expect(u32(bytes, centralOffset)).toBe(0x02014b50);
    expect(u32(bytes, centralOffset + 16)).toBe(crc32(payload));
  });

  it('produces an empty archive with a lone EOCD', async () => {
    const bytes = new Uint8Array(await createZip([]).arrayBuffer());
    expect(bytes.length).toBe(22);
    expect(u32(bytes, 0)).toBe(0x06054b50);
    expect(u16(bytes, 10)).toBe(0);
  });
});
