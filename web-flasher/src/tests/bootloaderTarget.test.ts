import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { MockTransport } from '@/core/transports/MockTransport';
import { readBootloaderTargetLine } from '@/core/passthrough/elrsBootloader';

describe('readBootloaderTargetLine', () => {
  it('returns trimmed first line', async () => {
    const t = new MockTransport(new FlashLogger());
    await t.connect();
    t.enqueueText('Unified_ESP32_900_RX\r\n');
    const s = await readBootloaderTargetLine(t, 300);
    expect(s).toBe('Unified_ESP32_900_RX');
  });

  it('returns empty on timeout', async () => {
    const t = new MockTransport(new FlashLogger());
    await t.connect();
    const s = await readBootloaderTargetLine(t, 80);
    expect(s).toBe('');
  });
});
