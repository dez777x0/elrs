import { describe, expect, it } from 'vitest';
import { partitionFirmwarePick } from '@/core/firmware/partitionFirmwarePick';

function mockFile(name: string): File {
  return new File([], name, { lastModified: 0 });
}

describe('partitionFirmwarePick', () => {
  it('single .bin без sidecar', () => {
    const r = partitionFirmwarePick([mockFile('rx.bin')]);
    expect(r.firmware.name).toBe('rx.bin');
    expect(r.sidecar).toBeNull();
  });

  it('.bin + совпадающий по имени .json', () => {
    const r = partitionFirmwarePick([mockFile('rx.bin'), mockFile('rx.bin.json')]);
    expect(r.firmware.name).toBe('rx.bin');
    expect(r.sidecar?.name).toBe('rx.bin.json');
  });

  it('.bin + один произвольный .json', () => {
    const r = partitionFirmwarePick([mockFile('rx.bin'), mockFile('meta.json')]);
    expect(r.sidecar?.name).toBe('meta.json');
  });

  it('.zip + один .json', () => {
    const r = partitionFirmwarePick([mockFile('pkg.zip'), mockFile('pkg.json')]);
    expect(r.firmware.name).toBe('pkg.zip');
    expect(r.sidecar?.name).toBe('pkg.json');
  });

  it('отклоняет два .bin', () => {
    expect(() => partitionFirmwarePick([mockFile('a.bin'), mockFile('b.bin')])).toThrow(/Несколько .bin/);
  });

  it('отклоняет .zip и .bin вместе', () => {
    expect(() => partitionFirmwarePick([mockFile('a.zip'), mockFile('b.bin')])).toThrow(/одном выборе/);
  });

  it('отклоняет два .json при одном .bin', () => {
    expect(() =>
      partitionFirmwarePick([mockFile('rx.bin'), mockFile('a.json'), mockFile('b.json')]),
    ).toThrow(/Несколько .json/);
  });

  it('отклоняет только .bin.json', () => {
    expect(() => partitionFirmwarePick([mockFile('rx.bin.json')])).toThrow(/мультивыбор/);
  });
});
