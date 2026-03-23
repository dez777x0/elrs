import { DeviceDisconnectedError, TransportUnavailableError } from '../errors';
import { FlashLogger } from '../logging/FlashLogger';
import type { IFirmwareTransport, TransportCapabilities } from './types';

const ESPRESSIF_VID = 0x303a;

export interface WebUSBTransportOptions {
  logger: FlashLogger;
  filters?: USBDeviceFilter[];
}

interface BulkEndpoints {
  ifaceNumber: number;
  epIn: number;
  epOut: number;
  inPacketSize: number;
}

function findCdcBulk(device: USBDevice): BulkEndpoints | null {
  for (const cfg of device.configurations ?? []) {
    for (const iface of cfg.interfaces) {
      for (const alt of iface.alternates) {
        const eps = alt.endpoints.filter((e) => e.type === 'bulk');
        const epIn = eps.find((e) => e.direction === 'in');
        const epOut = eps.find((e) => e.direction === 'out');
        if (epIn && epOut && (alt.interfaceClass === 0x0a || alt.interfaceClass === 0xff)) {
          return {
            ifaceNumber: iface.interfaceNumber,
            epIn: epIn.endpointNumber,
            epOut: epOut.endpointNumber,
            inPacketSize: epIn.packetSize,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Экспериментальный транспорт: bulk CDC для некоторых плат Espressif с нативным USB.
 * Для большинства ELRS RX удобнее Web Serial + USB-UART.
 */
export class WebUSBTransport implements IFirmwareTransport {
  readonly capabilities: TransportCapabilities = {
    kind: 'web-usb',
    supportsByteStream: true,
    supportsDtrRts: false,
    supportsEsptoolJs: false,
  };

  private device: USBDevice | null = null;
  private bulk: BulkEndpoints | null = null;
  private rxBuf = new Uint8Array(0);
  private readonly log;

  private readonly opts: WebUSBTransportOptions;

  constructor(opts: WebUSBTransportOptions) {
    this.opts = opts;
    this.log = opts.logger.child('WebUSBTransport');
  }

  async connect(): Promise<void> {
    if (!('usb' in navigator)) {
      throw new TransportUnavailableError('WebUSB недоступен в этом браузере.');
    }
    try {
      const nav = navigator as Navigator & { usb?: USB };
      if (!nav.usb) throw new TransportUnavailableError('WebUSB недоступен.');
      this.device = await nav.usb.requestDevice({
        filters: this.opts.filters ?? [{ vendorId: ESPRESSIF_VID }],
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        throw new TransportUnavailableError('USB-устройство не выбрано.');
      }
      throw e;
    }
    await this.device.open();
    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1);
    }
    const bulk = findCdcBulk(this.device);
    if (!bulk) {
      await this.device.close();
      this.device = null;
      throw new TransportUnavailableError(
        'Не найден CDC bulk-интерфейс на выбранном устройстве. Используйте Web Serial с USB-UART.',
      );
    }
    this.bulk = bulk;
    try {
      await this.device.claimInterface(bulk.ifaceNumber);
    } catch (e) {
      await this.device.close();
      this.device = null;
      this.bulk = null;
      throw new TransportUnavailableError(
        `Не удалось захватить USB interface ${bulk.ifaceNumber}: ${String(e)}`,
      );
    }
    this.log.info(`WebUSB: interface ${bulk.ifaceNumber}, IN ${bulk.epIn}, OUT ${bulk.epOut}`);
  }

  async disconnect(): Promise<void> {
    if (this.device && this.bulk) {
      try {
        await this.device.releaseInterface(this.bulk.ifaceNumber);
      } catch {
        /* */
      }
    }
    try {
      await this.device?.close();
    } catch {
      /* */
    }
    this.device = null;
    this.bulk = null;
    this.rxBuf = new Uint8Array(0);
  }

  private appendRx(data: Uint8Array): void {
    const next = new Uint8Array(this.rxBuf.length + data.length);
    next.set(this.rxBuf);
    next.set(data, this.rxBuf.length);
    this.rxBuf = next;
  }

  async read(maxBytes: number, timeoutMs: number): Promise<Uint8Array> {
    if (!this.device || !this.bulk) throw new DeviceDisconnectedError('WebUSB не подключён.');
    const deadline = Date.now() + timeoutMs;
    while (this.rxBuf.length < maxBytes && Date.now() < deadline) {
      const transfer = await this.device.transferIn(this.bulk.epIn, this.bulk.inPacketSize);
      if (transfer.status !== 'ok' || !transfer.data?.byteLength) {
        await new Promise((r) => setTimeout(r, 10));
        continue;
      }
      this.appendRx(new Uint8Array(transfer.data.buffer));
    }
    const take = Math.min(maxBytes, this.rxBuf.length);
    const out = this.rxBuf.slice(0, take);
    this.rxBuf = this.rxBuf.slice(take);
    return out;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.device || !this.bulk) throw new DeviceDisconnectedError('WebUSB не подключён.');
    let offset = 0;
    while (offset < data.length) {
      const raw = data.subarray(offset, offset + 64);
      const chunk = new Uint8Array(raw.byteLength);
      chunk.set(raw);
      const r = await this.device.transferOut(this.bulk.epOut, chunk);
      if (r.status !== 'ok') throw new TransportUnavailableError(`USB transferOut failed: ${r.status}`);
      offset += chunk.length;
    }
  }

  async readLine(delimiters: string[], timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let text = '';
    while (Date.now() < deadline) {
      const more = await this.read(64, Math.max(20, deadline - Date.now()));
      for (let i = 0; i < more.length; i++) text += String.fromCharCode(more[i]);
      for (const d of delimiters) {
        const j = text.indexOf(d);
        if (j >= 0) return text.slice(0, j + d.length);
      }
    }
    throw new TransportUnavailableError('readLine: таймаут WebUSB');
  }

  async setDTR(_state: boolean): Promise<void> {
    this.log.debug('WebUSB: DTR не поддерживается на этом транспорте');
  }

  async setRTS(_state: boolean): Promise<void> {
    this.log.debug('WebUSB: RTS не поддерживается на этом транспорте');
  }
}
