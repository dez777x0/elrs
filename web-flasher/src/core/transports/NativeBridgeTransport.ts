import { DeviceDisconnectedError, ReadTimeoutError, TransportUnavailableError } from '../errors';
import { FlashLogger } from '../logging/FlashLogger';
import type { IFirmwareTransport, TransportCapabilities } from './types';

/**
 * Контракт для нативной оболочки (Capacitor, WKWebView и т.д.): те же операции, что у UART.
 */
export interface NativeBridgeHandlers {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  read: (maxBytes: number, timeoutMs: number) => Promise<Uint8Array>;
  write: (data: Uint8Array) => Promise<void>;
  readLine?: (delimiters: string[], timeoutMs: number) => Promise<string>;
  setDTR?: (state: boolean) => Promise<void>;
  setRTS?: (state: boolean) => Promise<void>;
  /** Для esptool-js после passthrough; см. docs/native-bridge.md */
  getSerialPortForEsptool?: () => SerialPort | null | undefined | Promise<SerialPort | null | undefined>;
}

export class NativeBridgeTransport implements IFirmwareTransport {
  readonly capabilities: TransportCapabilities = {
    kind: 'native-bridge',
    supportsByteStream: true,
    supportsDtrRts: true,
    supportsEsptoolJs: false,
  };

  private readonly log;
  private active = false;

  private readonly handlers: NativeBridgeHandlers;

  constructor(handlers: NativeBridgeHandlers, logger: FlashLogger) {
    this.handlers = handlers;
    this.log = logger.child('NativeBridgeTransport');
  }

  async connect(): Promise<void> {
    if (!this.handlers) throw new TransportUnavailableError('Native bridge handlers не заданы.');
    await this.handlers.connect();
    this.active = true;
    this.log.info('Native bridge: connect');
  }

  async disconnect(): Promise<void> {
    await this.handlers.disconnect();
    this.active = false;
    this.log.info('Native bridge: disconnect');
  }

  async read(maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
    if (!this.active) throw new DeviceDisconnectedError('Native bridge не подключён.');
    return this.handlers.read(maxBytes, timeoutMs);
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.active) throw new DeviceDisconnectedError('Native bridge не подключён.');
    await this.handlers.write(data);
  }

  async readLine(delimiters: string[], timeoutMs: number): Promise<string> {
    if (!this.active) throw new DeviceDisconnectedError('Native bridge не подключён.');
    if (this.handlers.readLine) return this.handlers.readLine(delimiters, timeoutMs);
    throw new ReadTimeoutError('Native bridge: readLine не реализован в оболочке');
  }

  async setDTR(state: boolean): Promise<void> {
    if (!this.active) throw new DeviceDisconnectedError('Native bridge не подключён.');
    await this.handlers.setDTR?.(state);
  }

  async setRTS(state: boolean): Promise<void> {
    if (!this.active) throw new DeviceDisconnectedError('Native bridge не подключён.');
    await this.handlers.setRTS?.(state);
  }

  async getSerialPortForEsptool(): Promise<SerialPort | null> {
    const fn = this.handlers.getSerialPortForEsptool;
    if (!fn) return null;
    const p = await fn();
    return p ?? null;
  }
}
