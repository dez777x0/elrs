import { describe, expect, it, vi } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { MockTransport } from '@/core/transports/MockTransport';

describe('MockTransport read after scripted write', () => {
  it('delivers enqueued response after write', async () => {
    const t = new MockTransport(new FlashLogger());
    await t.connect();
    vi.spyOn(t, 'write').mockImplementation(async (data) => {
      await MockTransport.prototype.write.call(t, data);
      const s = new TextDecoder().decode(data);
      if (s.includes('serialrx_provider')) {
        t.enqueueText('serialrx_provider = CRSF\r\n');
      }
    });
    await t.write(new TextEncoder().encode('get serialrx_provider\r\n'));
    const x = await t.read(200, 300);
    expect(new TextDecoder().decode(x)).toContain('CRSF');
  });
});
