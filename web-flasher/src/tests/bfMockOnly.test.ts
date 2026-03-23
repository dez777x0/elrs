import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { DEFAULT_CLI_LINE_IDLE_FLUSH_MS, readLinesForMs } from '@/core/passthrough/cliReadLines';
import { BetaflightScriptedMock } from './helpers/BetaflightScriptedMock';

describe('BetaflightScriptedMock', () => {
  it('CLI preamble then get serialrx_provider (как в runBetaflightPassthrough)', async () => {
    const t = new BetaflightScriptedMock(new FlashLogger());
    await t.connect();
    const enc = new TextEncoder();
    await t.write(enc.encode('#\r\n'));
    await readLinesForMs(t, 600, { idleFlushMs: DEFAULT_CLI_LINE_IDLE_FLUSH_MS });
    await t.write(enc.encode('get serialrx_provider\r\n'));
    const lines = await readLinesForMs(t, 1200, { idleFlushMs: DEFAULT_CLI_LINE_IDLE_FLUSH_MS });
    expect(lines.join('')).toContain('CRSF');
  });

  it('responds to get serialrx_provider with a parsable line', async () => {
    const t = new BetaflightScriptedMock(new FlashLogger());
    await t.connect();
    const enc = new TextEncoder();
    await t.write(enc.encode('get serialrx_provider\r\n'));
    const lines = await readLinesForMs(t, 500, { idleFlushMs: DEFAULT_CLI_LINE_IDLE_FLUSH_MS });
    expect(lines.join('')).toContain('serialrx_provider');
    expect(lines.join('')).toContain('CRSF');
  });
});
