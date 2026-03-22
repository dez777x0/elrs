import { DeviceDisconnectedError, OtaUploadFailedError, ReadTimeoutError, TransportUnavailableError } from '../errors';
import { FlashLogger } from '../logging/FlashLogger';
import type { IFirmwareTransport, TransportCapabilities } from './types';

export interface OtaHttpTransportOptions {
  logger: FlashLogger;
  /** Базовый URL, например http://10.0.0.1 */
  baseUrl: string;
  /** Путь загрузки (зависит от прошивки устройства) */
  uploadPath?: string;
}

/**
 * OTA не использует UART-протокол ROM; read/write оставлены как безопасные заглушки для единого интерфейса.
 * Реальная отправка — `uploadFirmware`.
 */
export class OtaHttpTransport implements IFirmwareTransport {
  readonly capabilities: TransportCapabilities = {
    kind: 'ota-http',
    supportsByteStream: false,
    supportsDtrRts: false,
    supportsEsptoolJs: false,
  };

  private connected = false;
  private readonly log;
  private baseUrl: URL;

  private readonly opts: OtaHttpTransportOptions;

  constructor(opts: OtaHttpTransportOptions) {
    this.opts = opts;
    this.log = opts.logger.child('OtaHttpTransport');
    try {
      this.baseUrl = new URL(opts.baseUrl.endsWith('/') ? opts.baseUrl : opts.baseUrl + '/');
    } catch {
      throw new TransportUnavailableError(`Некорректный baseUrl: ${opts.baseUrl}`);
    }
  }

  setBaseUrl(url: string): void {
    this.baseUrl = new URL(url.endsWith('/') ? url : url + '/');
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.log.info(`OTA: базовый URL ${this.baseUrl.href}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async read(_maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
    if (!this.connected) throw new DeviceDisconnectedError('OTA не подключена.');
    await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 50)));
    return new Uint8Array(0);
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.connected) throw new DeviceDisconnectedError('OTA не подключена.');
    if (data.length)
      this.log.debug(`OTA: игнорируем write (${data.length} байт) — используйте uploadFirmware`);
  }

  async readLine(_delimiters: string[], timeoutMs: number): Promise<string> {
    if (!this.connected) throw new DeviceDisconnectedError('OTA не подключена.');
    await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 50)));
    throw new ReadTimeoutError('OTA-транспорт не получает построчный UART-вывод');
  }

  async setDTR(): Promise<void> {}
  async setRTS(): Promise<void> {}

  getUploadUrl(): string {
    const path = this.opts.uploadPath ?? 'update';
    return new URL(path.replace(/^\//, ''), this.baseUrl).href;
  }

  async uploadFirmware(
    blob: Blob,
    options?: { filename?: string; signal?: AbortSignal; onProgress?: (p: number) => void },
  ): Promise<void> {
    if (!this.connected) throw new DeviceDisconnectedError('Сначала вызовите connect() для OTA.');
    const url = this.getUploadUrl();
    const form = new FormData();
    form.append('firmware', blob, options?.filename ?? 'firmware.bin');
    this.log.info(`POST ${url} (${blob.size} байт)`);
    const xhr = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
      xhr.open('POST', url);
      xhr.responseType = 'text';
      if (options?.signal) {
        const abort = () => {
          xhr.abort();
          reject(new OtaUploadFailedError('Загрузка прервана (abort).'));
        };
        if (options.signal.aborted) {
          abort();
          return;
        }
        options.signal.addEventListener('abort', abort, { once: true });
      }
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && options?.onProgress) options.onProgress(ev.loaded / ev.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          options?.onProgress?.(1);
          resolve();
        } else {
          reject(
            new OtaUploadFailedError(
              `OTA HTTP ${xhr.status}: ${xhr.responseText?.slice(0, 200) ?? ''}`,
              'Проверьте URL, что RX в режиме Wi‑Fi и что путь совпадает с прошивкой на устройстве.',
            ),
          );
        }
      };
      xhr.onerror = () =>
        reject(
          new OtaUploadFailedError(
            'Сетевая ошибка при OTA',
            'Убедитесь, что вы подключены к точке доступа приёмника и что хост доступен.',
          ),
        );
      xhr.send(form);
    });
  }
}
