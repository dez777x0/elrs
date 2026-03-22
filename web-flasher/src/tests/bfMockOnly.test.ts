import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { BetaflightScriptedMock } from './helpers/BetaflightScriptedMock';

async function readLinesForMs(t: BetaflightScriptedMock, totalMs: number): Promise<string[]> {
  const out: string[] = [];
  const deadline = Date.now() + totalMs;
  let buf = '';
  while (Date.now() < deadline) {
    const chunk = await t.read(512, Math.min(200, deadline - Date.now()));
    if (!chunk.length) continue;
    for (let i = 0; i < chunk.length; i++) buf += String.fromCharCode(chunk[i]);
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      out.push(buf.slice(0, idx + 1));
      buf = buf.slice(idx + 1);
    }
  }
  return out;
}

describe('BetaflightScriptedMock', () => {
  it('CLI preamble then get serialrx_provider (как в runBetaflightPassthrough)', async () => {
    const t = new BetaflightScriptedMock(new FlashLogger());
    await t.connect();
    const enc = new TextEncoder();
    await t.write(enc.encode('#\r\n'));
    await readLinesForMs(t, 600);
    await t.write(enc.encode('get serialrx_provider\r\n'));
    const lines = await readLinesForMs(t, 1200);
    expect(lines.join('')).toContain('CRSF');
  });

  it('responds to get serialrx_provider with a parsable line', async () => {
    const t = new BetaflightScriptedMock(new FlashLogger());
    await t.connect();
    const enc = new TextEncoder();
    await t.write(enc.encode('get serialrx_provider\r\n'));
    const lines = await readLinesForMs(t, 500);
    expect(lines.join('')).toContain('serialrx_provider');
    expect(lines.join('')).toContain('CRSF');
  });
});
