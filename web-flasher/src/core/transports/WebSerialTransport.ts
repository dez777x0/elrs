import {
  DeviceDisconnectedError,
  PermissionDeniedError,
  PortBusyError,
  ReadTimeoutError,
  TransportUnavailableError,
} from '../errors';
import { FlashLogger } from '../logging/FlashLogger';
import type { IFirmwareTransport, TransportCapabilities } from './types';

export interface WebSerialTransportOptions {
  logger: FlashLogger;
  baudRate?: number;
  /** Если задан — не вызывать requestPort */
  port?: SerialPort;
  filters?: SerialPortFilter[];
}

function bufToString(buf: Uint8Array): string {
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}

export class WebSerialTransport implements IFirmwareTransport {
  readonly capabilities: TransportCapabilities = {
    kind: 'web-serial',
    supportsByteStream: true,
    supportsDtrRts: true,
    supportsEsptoolJs: true,
  };

  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private rxChunks: Uint8Array[] = [];
  private rxWait = new Set<(chunk: Uint8Array) => void>();
  private readLoopRunning = false;
  private readonly log;
  private readonly baudRate: number;
  private readonly filters?: SerialPortFilter[];
  private requestedExternalPort: SerialPort | undefined;

  constructor(opts: WebSerialTransportOptions) {
    this.log = opts.logger.child('WebSerialTransport');
    this.baudRate = opts.baudRate ?? 115200;
    this.filters = opts.filters;
    this.requestedExternalPort = opts.port;
  }

  getSerialPort(): SerialPort | null {
    return this.port;
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new TransportUnavailableError(
        'Web Serial API недоступен в этом браузере или контексте (нужен Chromium / разрешённый контекст).',
      );
    }
    try {
      this.port =
        this.requestedExternalPort ?? (await navigator.serial.requestPort({ filters: this.filters ?? [] }));
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotFoundError') throw new TransportUnavailableError('Порт не выбран.');
      if (name === 'SecurityError')
        throw new PermissionDeniedError('Доступ к последовательному порту запрещён политикой безопасности.');
      throw e;
    }

    try {
      await this.port.open({
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 65536,
        flowControl: 'none',
      });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NetworkError') {
        throw new PortBusyError('Порт уже занят другим приложением или вкладкой.');
      }
      throw e;
    }

    const op = this.port;
    if (!op?.writable) throw new PortBusyError('Serial writable недоступен.');
    this.writer = op.writable.getWriter();
    this.startReadLoop();
    this.log.info(`Подключено, ${this.baudRate} бод`);
  }

  private startReadLoop(): void {
    if (!this.port?.readable || this.readLoopRunning) return;
    this.readLoopRunning = true;
    const pump = async () => {
      const p = this.port;
      if (!p?.readable) return;
      try {
        this.reader = p.readable.getReader();
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value && value.length) this.enqueueRx(value);
        }
      } catch (e) {
        this.log.warn(`read loop: ${String(e)}`);
      } finally {
        this.readLoopRunning = false;
        try {
          this.reader?.releaseLock();
        } catch {
          /* */
        }
        this.reader = null;
      }
    };
    void pump();
  }

  private enqueueRx(chunk: Uint8Array): void {
    const copy = new Uint8Array(chunk);
    if (this.rxWait.size > 0) {
      const fn = [...this.rxWait][0];
      this.rxWait.delete(fn);
      fn(copy);
      return;
    }
    this.rxChunks.push(copy);
  }

  private async waitChunk(timeoutMs: number): Promise<Uint8Array | null> {
    if (this.rxChunks.length) {
      return this.rxChunks.shift()!;
    }
    return await new Promise<Uint8Array | null>((resolve) => {
      const to = window.setTimeout(() => {
        this.rxWait.delete(onChunk);
        resolve(null);
      }, timeoutMs);
      const onChunk = (c: Uint8Array) => {
        window.clearTimeout(to);
        this.rxWait.delete(onChunk);
        resolve(c);
      };
      this.rxWait.add(onChunk);
    });
  }

  /**
   * Освобождает порт для esptool-js (он вызовет SerialPort.open сам).
   * После успешной прошивки пользователь может снова вызвать connect() с тем же объектом через opts.port.
   */
  async handoffToEsptool(): Promise<SerialPort> {
    const p = this.port;
    if (!p) throw new DeviceDisconnectedError('Нет открытого serial-порта для передачи в esptool-js.');
    try {
      await this.reader?.cancel();
    } catch {
      /* */
    }
    try {
      this.reader?.releaseLock();
    } catch {
      /* */
    }
    this.reader = null;
    try {
      await this.writer?.close();
    } catch {
      /* */
    }
    this.writer = null;
    this.readLoopRunning = false;
    this.rxChunks.length = 0;
    this.rxWait.clear();
    try {
      await p.close();
    } catch (e) {
      this.log.warn(`close перед esptool: ${String(e)}`);
    }
    this.port = null;
    this.requestedExternalPort = p;
    this.log.info('Порт закрыт, готов к открытию esptool-js Transport');
    return p;
  }

  async disconnect(): Promise<void> {
    try {
      await this.reader?.cancel();
    } catch {
      /* */
    }
    try {
      this.reader?.releaseLock();
    } catch {
      /* */
    }
    this.reader = null;
    try {
      await this.writer?.close();
    } catch {
      /* */
    }
    this.writer = null;
    try {
      await this.port?.close();
    } catch {
      /* */
    }
    this.port = null;
    this.requestedExternalPort = undefined;
    this.rxChunks.length = 0;
    this.rxWait.clear();
    this.readLoopRunning = false;
    this.log.info('Отключено');
  }

  async read(maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
    if (!this.port) throw new DeviceDisconnectedError('Serial порт не открыт.');
    const out: number[] = [];
    const deadline = Date.now() + timeoutMs;
    while (out.length < maxBytes && Date.now() < deadline) {
      const left = deadline - Date.now();
      if (left <= 0) break;
      const chunk = await this.waitChunk(left);
      if (!chunk) break;
      for (let i = 0; i < chunk.length && out.length < maxBytes; i++) out.push(chunk[i]);
    }
    return new Uint8Array(out);
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writer) throw new DeviceDisconnectedError('Serial порт не открыт.');
    await this.writer.write(data);
  }

  async readLine(delimiters: string[], timeoutMs: number): Promise<string> {
    let buf = '';
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const chunk = await this.read(256, Math.max(50, deadline - Date.now()));
      if (chunk.length) buf += bufToString(chunk);
      for (const d of delimiters) {
        const idx = buf.indexOf(d);
        if (idx >= 0) return buf.slice(0, idx + d.length);
      }
      if (buf.length > 65536) buf = buf.slice(-32768);
    }
    throw new ReadTimeoutError(`Не найдена строка с разделителем за ${timeoutMs} мс`);
  }

  async setDTR(state: boolean): Promise<void> {
    if (!this.port) throw new DeviceDisconnectedError('Serial порт не открыт.');
    await this.port.setSignals({ dataTerminalReady: state });
  }

  async setRTS(state: boolean): Promise<void> {
    if (!this.port) throw new DeviceDisconnectedError('Serial порт не открыт.');
    await this.port.setSignals({ requestToSend: state });
  }
}
