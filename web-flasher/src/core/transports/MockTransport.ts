import { DeviceDisconnectedError, ReadTimeoutError } from '../errors';
import { FlashLogger } from '../logging/FlashLogger';
import type { IFirmwareTransport, TransportCapabilities } from './types';

/**
 * Для тестов: управляемые очереди RX и запись в TX.
 */
export class MockTransport implements IFirmwareTransport {
  readonly capabilities: TransportCapabilities = {
    kind: 'mock',
    supportsByteStream: true,
    supportsDtrRts: true,
    supportsEsptoolJs: false,
  };

  private connected = false;
  private rxQueue: Uint8Array[] = [];
  readonly txWritten: Uint8Array[] = [];
  dtr = false;
  rts = false;
  private readonly log;

  constructor(logger: FlashLogger) {
    this.log = logger.child('MockTransport');
  }

  /** Симуляция входящих байт от устройства */
  enqueueRx(data: Uint8Array): void {
    this.rxQueue.push(new Uint8Array(data));
  }

  enqueueText(s: string): void {
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    this.enqueueRx(u);
  }

  reset(): void {
    this.rxQueue = [];
    this.txWritten.length = 0;
    this.dtr = false;
    this.rts = false;
    this.connected = false;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.log.info('mock connect');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async read(maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
    if (!this.connected) throw new DeviceDisconnectedError('mock offline');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.rxQueue.length) {
        const chunk = this.rxQueue.shift()!;
        return chunk.length <= maxBytes ? chunk : chunk.slice(0, maxBytes);
      }
      await new Promise((r) => setTimeout(r, 5));
    }
    return new Uint8Array(0);
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.connected) throw new DeviceDisconnectedError('mock offline');
    this.txWritten.push(new Uint8Array(data));
  }

  async readLine(delimiters: string[], timeoutMs: number): Promise<string> {
    let buf = '';
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const chunk = await this.read(256, Math.max(10, deadline - Date.now()));
      if (chunk.length) {
        for (let i = 0; i < chunk.length; i++) buf += String.fromCharCode(chunk[i]);
      }
      for (const d of delimiters) {
        const idx = buf.indexOf(d);
        if (idx >= 0) return buf.slice(0, idx + d.length);
      }
    }
    throw new ReadTimeoutError('mock readLine timeout');
  }

  async setDTR(state: boolean): Promise<void> {
    this.dtr = state;
  }

  async setRTS(state: boolean): Promise<void> {
    this.rts = state;
  }
}
