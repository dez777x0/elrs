import { MockTransport } from '@/core/transports/MockTransport';
import type { FlashLogger } from '@/core/logging/FlashLogger';

const dec = new TextDecoder('utf-8', { fatal: false });

/** Минимальные ответы CLI EdgeTX для интеграционного теста. */
export class EdgeTxScriptedMock extends MockTransport {
  constructor(logger: FlashLogger) {
    super(logger);
  }

  override async connect(): Promise<void> {
    await super.connect();
    this.enqueueText('EdgeTX\r\n> ');
  }

  override async write(data: Uint8Array): Promise<void> {
    await super.write(data);
    const s = dec.decode(data);
    if (s.toLowerCase().includes('serialpassthrough')) {
      this.enqueueText('passthrough active\r\n');
      return;
    }
    if (s.trim().toLowerCase().startsWith('set ')) {
      this.enqueueText('set: OK\r\n> ');
    }
    if (data[0] === 0xec || data[0] === 0x89) {
      this.enqueueText('EDGE_TX_RX_NAME\r\n');
    }
  }
}
