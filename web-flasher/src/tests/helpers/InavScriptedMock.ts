import { MockTransport } from '@/core/transports/MockTransport';
import type { FlashLogger } from '@/core/logging/FlashLogger';

const dec = new TextDecoder('utf-8', { fatal: false });

/**
 * Детерминированные ответы INAV CLI для `runInavPassthrough` (без веток Betaflight `get`).
 */
export class InavScriptedMock extends MockTransport {
  constructor(logger: FlashLogger) {
    super(logger);
  }

  override async write(data: Uint8Array): Promise<void> {
    await super.write(data);
    const s = dec.decode(data);
    this.onHostWrite(data, s);
  }

  private onHostWrite(data: Uint8Array, s: string): void {
    const low = s.toLowerCase();
    const oneLine = s.replace(/\r/g, '').trim();

    if (s.trim() === '#' || s === '#\r\n' || s === '#\n') {
      this.enqueueText('INAV 7.1.0\r\n# \r\n');
      return;
    }
    if (oneLine === 'version') {
      this.enqueueText('INAV 7.1.0\r\n# \r\n');
      return;
    }
    if (low.includes('serialpassthrough')) {
      this.enqueueText('Forwarding\r\n');
      return;
    }
    if (low.startsWith('serial\r') || low.startsWith('serial\n')) {
      this.enqueueText('serial 0 1 115200 57600 0 115200 0 0 0\r\n');
      this.enqueueText('serial 2 64 115200 57600 0 115200 0 0 0\r\n');
      this.enqueueText('\r\n');
      return;
    }
    if (data[0] === 0xec || data[0] === 0x89) {
      this.enqueueText('INTEGRATION_INAV_RX_TARGET\r\n');
    }
  }
}
