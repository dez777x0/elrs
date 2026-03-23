import { describe, expect, it } from 'vitest';
import { parseManifestJson } from '@/core/firmware/manifest';

describe('parseManifestJson', () => {
  it('parses segments with hex offsets', () => {
    const m = parseManifestJson(
      JSON.stringify({
        version: '1',
        chip: 'ESP32',
        target: 'Unified_ESP32_900_RX',
        segments: [
          { file: 'a.bin', offset: '0x1000' },
          { file: 'b.bin', offset: 65536 },
        ],
      }),
    );
    expect(m.segments[0].offset).toBe(0x1000);
    expect(m.segments[1].offset).toBe(65536);
    expect(m.chip).toBe('ESP32');
  });

  it('throws on empty segments', () => {
    expect(() => parseManifestJson('{"segments":[]}')).toThrow();
  });
});
