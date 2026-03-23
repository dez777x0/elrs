import { describe, expect, it } from 'vitest';
import { hintsFromFilename } from '@/core/firmware/filenameHeuristics';

describe('hintsFromFilename', () => {
  it('detects ESP32-C3', () => {
    expect(hintsFromFilename('ELRS_900_RX_ESP32C3_3.5.0.bin').chip).toBe('ESP32-C3');
  });
  it('detects Unified target', () => {
    expect(hintsFromFilename('firmware_Unified_ESP8285_2400_RX.bin').target).toBe('Unified_ESP8285_2400_RX');
  });
});
