import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { mergeSidecarIntoParsed, type ParsedFirmwarePackage } from '@/core/firmware/parseFirmwareInput';
import { parseSidecarJson } from '@/core/firmware/sidecar';

function basePkg(): ParsedFirmwarePackage {
  return {
    segments: [{ name: 'x.bin', offset: 0, data: new Uint8Array([1, 2]) }],
    effectiveChip: undefined,
    effectiveTarget: undefined,
    effectiveVersion: undefined,
    sha256: 'a',
    md5: 'b',
    filenameHints: {},
    sourceName: 'x.bin',
  };
}

describe('sidecar', () => {
  it('parseSidecarJson reads chip and offset', () => {
    const m = parseSidecarJson('{"chip":"ESP32-C3","offset":"0x10000"}');
    expect(m.chip).toBe('ESP32-C3');
    expect(m.offset).toBe('0x10000');
  });

  it('mergeSidecar overrides metadata and first segment offset', () => {
    const log = new FlashLogger().child('t');
    const pkg = mergeSidecarIntoParsed(
      basePkg(),
      parseSidecarJson('{"chip":"ESP32","target":"T","firmwareVersion":"1.0.0","offset":4096}'),
      log,
    );
    expect(pkg.effectiveChip).toBe('ESP32');
    expect(pkg.effectiveTarget).toBe('T');
    expect(pkg.effectiveVersion).toBe('1.0.0');
    expect(pkg.segments[0].offset).toBe(4096);
  });

  it('mergeSidecar skipped when manifest present', () => {
    const log = new FlashLogger().child('t');
    const pkg: ParsedFirmwarePackage = {
      ...basePkg(),
      manifest: {
        segments: [{ file: 'a', offset: 0 }],
        chip: 'ESP8266',
      },
      effectiveChip: 'ESP8266',
    };
    const out = mergeSidecarIntoParsed(
      pkg,
      parseSidecarJson('{"chip":"ESP32"}'),
      log,
    );
    expect(out.effectiveChip).toBe('ESP8266');
  });
});
