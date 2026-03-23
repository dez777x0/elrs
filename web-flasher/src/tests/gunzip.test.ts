import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { gunzipBytes, looksLikeGzip, stripGzipExtension } from '@/core/firmware/gunzip';
import { parseFirmwareFile } from '@/core/firmware/parseFirmwareInput';
import { FlashLogger } from '@/core/logging/FlashLogger';

describe('gunzip', () => {
  it('looksLikeGzip', () => {
    expect(looksLikeGzip(new Uint8Array([0x1f, 0x8b, 8]))).toBe(true);
    expect(looksLikeGzip(new Uint8Array([0, 0]))).toBe(false);
  });

  it('stripGzipExtension', () => {
    expect(stripGzipExtension('a.bin.gz')).toBe('a.bin');
    expect(stripGzipExtension('a.bin')).toBe('a.bin');
  });

  it('gunzipBytes roundtrip', async () => {
    const raw = new Uint8Array([1, 2, 3, 4, 5]);
    const gz = new Uint8Array(gzipSync(Buffer.from(raw)));
    expect(looksLikeGzip(gz)).toBe(true);
    const out = await gunzipBytes(gz);
    expect([...out]).toEqual([...raw]);
  });

  it('parseFirmwareFile принимает .bin.gz', async () => {
    const raw = new Uint8Array(512);
    raw.fill(0xe9);
    const gz = gzipSync(Buffer.from(raw));
    const file = new File([gz], 'test_rx.bin.gz', { type: 'application/gzip' });
    const pkg = await parseFirmwareFile(file, new FlashLogger());
    expect(pkg.segments[0].data.length).toBe(512);
    expect(pkg.sourceName).toBe('test_rx.bin.gz');
    expect(pkg.segments[0].name).toBe('test_rx.bin');
  });
});
