import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import {
  runUartResetStrategies,
  tryDtrRtsClassic,
  tryRtsPulse,
  tryRtsPulseLong,
} from '@/core/bootloader/directUartReset';
import { MockTransport } from '@/core/transports/MockTransport';

describe('directUartReset', () => {
  it('tryDtrRtsClassic переключает DTR/RTS', async () => {
    const t = new MockTransport(new FlashLogger());
    await t.connect();
    await tryDtrRtsClassic(t, new FlashLogger().child('r'));
    expect(t.dtr).toBe(false);
    expect(t.rts).toBe(false);
    expect(t.txWritten.length).toBe(0);
  });

  it('tryRtsPulse завершает с RTS false', async () => {
    const t = new MockTransport(new FlashLogger());
    await t.connect();
    await tryRtsPulse(t, new FlashLogger().child('r'));
    expect(t.rts).toBe(false);
  });

  it('tryRtsPulseLong завершает с RTS false', async () => {
    const t = new MockTransport(new FlashLogger());
    await t.connect();
    await tryRtsPulseLong(t, new FlashLogger().child('r'));
    expect(t.rts).toBe(false);
  });

  it('runUartResetStrategies выполняет три волны сброса', async () => {
    const t = new MockTransport(new FlashLogger());
    await t.connect();
    const log = new FlashLogger();
    await runUartResetStrategies(t, log.child('reset'));
    const entries = log.getEntries().map((e) => e.message);
    expect(entries.some((m) => m.includes('DTR/RTS classic'))).toBe(true);
    expect(entries.some((m) => m.includes('RTS pulse (200 ms)'))).toBe(true);
    expect(entries.some((m) => m.includes('RTS pulse long'))).toBe(true);
  });
});
