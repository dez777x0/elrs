import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { runBetaflightPassthrough } from '@/core/passthrough/betaflightPassthrough';
import { BetaflightScriptedMock } from './helpers/BetaflightScriptedMock';

describe('Betaflight passthrough integration (scripted mock)', () => {
  it(
    'completes CLI validation, serialpassthrough, bootloader init and returns target line',
    async () => {
      const log = new FlashLogger();
      const t = new BetaflightScriptedMock(log);
      await t.connect();

      const r = await runBetaflightPassthrough(t, {
        baud: 420000,
        halfDuplex: false,
        logger: log.child('BF'),
      });

      expect(r.rxTargetReported).toBe('INTEGRATION_RX_TARGET');
      expect(t.txWritten.length).toBeGreaterThan(4);
    },
    8_000,
  );
});
