import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { runInavPassthrough } from '@/core/passthrough/inavPassthrough';
import { InavScriptedMock } from './helpers/InavScriptedMock';

describe('INAV passthrough integration (scripted mock)', () => {
  it('completes CLI, serialpassthrough, bootloader init and returns target line', async () => {
    const log = new FlashLogger();
    const t = new InavScriptedMock(log);
    await t.connect();

    const r = await runInavPassthrough(t, {
      baud: 420000,
      halfDuplex: false,
      logger: log.child('INAV'),
    });

    expect(r.rxTargetReported).toBe('INTEGRATION_INAV_RX_TARGET');
    const blob = t.txWritten.map((b) => new TextDecoder().decode(b)).join('');
    expect(blob).toContain('serialpassthrough');
  });
});
