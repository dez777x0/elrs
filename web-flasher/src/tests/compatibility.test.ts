import { describe, expect, it } from 'vitest';
import { assertFirmwareMatchesDevice } from '@/core/flash/compatibility';
import { ForceFlashRequiredError } from '@/core/errors';

describe('assertFirmwareMatchesDevice', () => {
  it('blocks chip mismatch without force', () => {
    expect(() =>
      assertFirmwareMatchesDevice({
        firmwareChip: 'ESP32',
        detectedChip: 'ESP32-C3',
        forceFlashConfirmed: false,
      }),
    ).toThrow(ForceFlashRequiredError);
  });

  it('allows chip mismatch with force', () => {
    expect(() =>
      assertFirmwareMatchesDevice({
        firmwareChip: 'ESP32',
        detectedChip: 'ESP32-C3',
        forceFlashConfirmed: true,
      }),
    ).not.toThrow();
  });

  it('blocks target mismatch without force', () => {
    expect(() =>
      assertFirmwareMatchesDevice({
        firmwareTarget: 'A',
        detectedTarget: 'B',
        forceFlashConfirmed: false,
      }),
    ).toThrow(ForceFlashRequiredError);
  });
});
