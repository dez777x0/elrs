import { describe, expect, it } from 'vitest';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { MockTransport } from '@/core/transports/MockTransport';
import { OtaHttpTransport } from '@/core/transports/OtaHttpTransport';

describe('integration mocks', () => {
  it('direct UART flash path: mock transport records writes (smoke)', async () => {
    const log = new FlashLogger();
    const t = new MockTransport(log);
    await t.connect();
    await t.write(new TextEncoder().encode('ping'));
    expect(t.txWritten.length).toBe(1);
  });

  it('OTA transport upload uses FormData path', async () => {
    const log = new FlashLogger();
    const ota = new OtaHttpTransport({ logger: log, baseUrl: 'http://127.0.0.1:9' });
    await ota.connect();
    await expect(
      ota.uploadFirmware(new Blob([new Uint8Array([1, 2, 3])]), { filename: 'x.bin' }),
    ).rejects.toThrow();
    await ota.disconnect();
  });
});
