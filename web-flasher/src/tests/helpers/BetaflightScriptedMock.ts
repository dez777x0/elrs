import { MockTransport } from '@/core/transports/MockTransport';
import type { FlashLogger } from '@/core/logging/FlashLogger';

const dec = new TextDecoder('utf-8', { fatal: false });

/**
 * Детерминированные ответы CLI для сквозного теста `runBetaflightPassthrough`.
 */
export class BetaflightScriptedMock extends MockTransport {
  constructor(logger: FlashLogger) {
    super(logger);
  }

  override async write(data: Uint8Array): Promise<void> {
    await super.write(data);
    const s = dec.decode(data);
    this.onHostWrite(data, s);
  }

  private onHostWrite(data: Uint8Array, s: string): void {
    if (s.includes('get serialrx_provider')) {
      this.enqueueText('serialrx_provider = CRSF\r\n');
      return;
    }
    if (s.includes('get serialrx_inverted')) {
      this.enqueueText('serialrx_inverted = OFF\r\n');
      return;
    }
    if (s.includes('get serialrx_halfduplex')) {
      this.enqueueText('serialrx_halfduplex = OFF\r\n');
      return;
    }
    if (s.includes('get rx_spi_protocol')) {
      this.enqueueText('rx_spi_protocol = NONE\r\n');
      return;
    }
    if (s.trim() === '#' || s === '#\r\n' || s === '#\n') {
      this.enqueueText('# \r\n');
      return;
    }
    const low = s.toLowerCase();
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
      this.enqueueText('INTEGRATION_RX_TARGET\r\n');
    }
  }
}
