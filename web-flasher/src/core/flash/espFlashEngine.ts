import { ESPLoader, Transport as EspTransport } from 'esptool-js';
import type { IEspLoaderTerminal } from 'esptool-js';
import { BootloaderEntryFailedError, VerificationFailedError } from '../errors';
import type { FlashLogger, ScopedLogger } from '../logging/FlashLogger';
import { md5Bytes } from '../firmware/hashes';
import type { FirmwareSegment } from '../firmware/parseFirmwareInput';

export type EspLoaderResetMode = 'default_reset' | 'usb_reset' | 'no_reset' | 'no_reset_no_sync';
export type EspLoaderAfterMode = 'hard_reset' | 'soft_reset' | 'no_reset' | 'no_reset_stub';

export interface EspFlashEngineOptions {
  logger: FlashLogger;
  resetMode?: EspLoaderResetMode;
  baudRate?: number;
  romBaudRate?: number;
  flashWriteSize?: number;
  espRamBlock?: number;
  eraseAll?: boolean;
}

function makeTerminal(scope: ScopedLogger): IEspLoaderTerminal {
  return {
    clean: () => {},
    write: (d) => scope.debug(d),
    writeLine: (d) => scope.info(d),
  };
}

export interface PreparedEspLoader {
  loader: ESPLoader;
  chipName: string;
  disconnect: () => Promise<void>;
}

/** События для UI: фазы verify / reboot привязаны к завершению writeFlash и вызову after(). */
export interface FlashWriteHooks {
  onFlashProgress?: (fileIndex: number, written: number, total: number) => void;
  /** Сразу после успешного `writeFlash` (внутри esptool-js уже мог быть MD5). */
  onFlashWriteSettled?: () => void;
  /** Перед `loader.after(reset)`. */
  onDeviceRebootInvoke?: () => void;
  /** После `transport.disconnect()`. */
  onTransportClosed?: () => void;
}

/** Подключение к ROM, detectChip, загрузка stub — до проверки совместимости прошивки. */
export async function prepareEspLoader(port: SerialPort, opt: EspFlashEngineOptions): Promise<PreparedEspLoader> {
  const scope = opt.logger.child('espFlashEngine');
  const baudrate = opt.baudRate ?? 460800;
  const romBaudrate = opt.romBaudRate ?? 115200;
  const mode = opt.resetMode ?? 'default_reset';

  const transport = new EspTransport(port, false, true);
  const loader = new ESPLoader({
    transport,
    baudrate,
    romBaudrate,
    terminal: makeTerminal(scope.child('ESPLoader')),
    debugLogging: false,
    enableTracing: false,
  });

  if (opt.flashWriteSize) loader.FLASH_WRITE_SIZE = opt.flashWriteSize;
  if (opt.espRamBlock) loader.ESP_RAM_BLOCK = opt.espRamBlock;

  try {
    await loader.main(mode);
  } catch (e) {
    try {
      await transport.disconnect();
    } catch {
      /* */
    }
    throw new BootloaderEntryFailedError(
      `Не удалось подключиться к ROM bootloader: ${String(e)}`,
      'Проверьте проводку, питание RX, скорость passthrough и попробуйте другой reset mode в Expert Mode.',
    );
  }

  const chipName = loader.chip.CHIP_NAME;
  scope.info(`Обнаружен чип: ${chipName}`);

  return {
    loader,
    chipName,
    disconnect: () => transport.disconnect(),
  };
}

export async function writeSegmentsWithLoader(
  prepared: PreparedEspLoader,
  segments: FirmwareSegment[],
  opt: Pick<EspFlashEngineOptions, 'logger' | 'eraseAll'> & { hooks?: FlashWriteHooks },
): Promise<void> {
  const log = opt.logger.child('espFlashEngine');
  const { loader } = prepared;
  const chipName = prepared.chipName;
  const hooks = opt.hooks;

  const fileArray = segments.map((s) => ({
    data: loader.ui8ToBstr(s.data),
    address: s.offset,
  }));

  loader.IS_STUB = true;

  try {
    await loader.writeFlash({
      fileArray,
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll: opt.eraseAll ?? false,
      compress: true,
      calculateMD5Hash: (image) => md5Bytes(loader.bstrToUi8(image)),
      reportProgress: hooks?.onFlashProgress,
    });
  } catch (e) {
    throw new VerificationFailedError(`Ошибка записи/проверки flash: ${String(e)}`);
  }

  hooks?.onFlashWriteSettled?.();

  const after: EspLoaderAfterMode = chipName.startsWith('ESP32') ? 'hard_reset' : 'soft_reset';
  hooks?.onDeviceRebootInvoke?.();
  try {
    await loader.after(after);
  } catch {
    log.warn('after(reset): проигнорировано');
  }

  try {
    await prepared.disconnect();
  } catch {
    /* */
  }
  hooks?.onTransportClosed?.();
}

/** Полный цикл без паузы на проверку метаданных (тесты / простые сценарии). */
export async function flashEspWithEsptoolJs(
  port: SerialPort,
  segments: FirmwareSegment[],
  opt: EspFlashEngineOptions,
): Promise<{ chipName: string }> {
  const p = await prepareEspLoader(port, opt);
  await writeSegmentsWithLoader(p, segments, opt);
  return { chipName: p.chipName };
}
