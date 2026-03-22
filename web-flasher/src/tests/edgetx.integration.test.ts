import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { runEdgeTxPassthrough } from '@/core/passthrough/edgetxPassthrough';
import { EdgeTxScriptedMock } from './helpers/EdgeTxScriptedMock';

describe('EdgeTX passthrough integration (scripted mock)', () => {
  it('non-backpack path reaches bootloader line', async () => {
    const log = new FlashLogger();
    const t = new EdgeTxScriptedMock(log);
    await t.connect();

    const r = await runEdgeTxPassthrough(t, {
      baud: 420000,
      halfDuplex: false,
      backpack: false,
      logger: log.child('ETX'),
    });

    expect(r.rxTargetReported).toBe('EDGE_TX_RX_NAME');
    expect(t.txWritten.some((b) => new TextDecoder().decode(b).includes('serialpassthrough'))).toBe(true);
  });

  it(
    'backpack path sends rfmod power commands',
    async () => {
    const log = new FlashLogger();
    const t = new EdgeTxScriptedMock(log);
    await t.connect();

    await runEdgeTxPassthrough(t, {
      baud: 115200,
      halfDuplex: false,
      backpack: true,
      logger: log.child('ETX'),
    });

    const blob = t.txWritten.map((b) => new TextDecoder().decode(b)).join('');
    expect(blob).toContain('rfmod 0 power off');
    },
    15_000,
  );
});
