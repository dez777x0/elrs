import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { DEFAULT_CLI_LINE_IDLE_FLUSH_MS, readLinesForMs } from '@/core/passthrough/cliReadLines';
import { MockTransport } from '@/core/transports/MockTransport';

describe('readLinesForMs', () => {
  it('выходит по тишине, не дожидаясь полного totalMs', async () => {
    const t = new MockTransport(new FlashLogger());
    await t.connect();
    t.enqueueText('ok\r\n');

    const t0 = Date.now();
    const lines = await readLinesForMs(t, 5000, { idleFlushMs: DEFAULT_CLI_LINE_IDLE_FLUSH_MS });
    const dt = Date.now() - t0;

    expect(lines.join('')).toContain('ok');
    expect(dt).toBeLessThan(1500);
  });
});
