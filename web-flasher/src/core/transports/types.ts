import type { FlashLogger } from '../logging/FlashLogger';

export type TransportKind =
  | 'web-serial'
  | 'web-usb'
  | 'ota-http'
  | 'native-bridge'
  | 'mock';

export interface TransportCapabilities {
  kind: TransportKind;
  /** Линейный байтовый поток как у UART */
  supportsByteStream: boolean;
  /** Управление линиями DTR/RTS (или эквивалент) */
  supportsDtrRts: boolean;
  /** Можно использовать с esptool-js Transport (только Web Serial в браузере) */
  supportsEsptoolJs: boolean;
}

export interface IFirmwareTransport {
  readonly capabilities: TransportCapabilities;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Читать до `maxBytes` или пока не истечёт timeoutMs */
  read(maxBytes: number, timeoutMs: number): Promise<Uint8Array>;
  write(data: Uint8Array): Promise<void>;
  readLine(delimiters: string[], timeoutMs: number): Promise<string>;
  setDTR(state: boolean): Promise<void>;
  setRTS(state: boolean): Promise<void>;
  /** Текущий SerialPort если есть (для esptool-js) */
  getSerialPort?(): SerialPort | null;
}

export interface TransportOptions {
  logger: FlashLogger;
}
