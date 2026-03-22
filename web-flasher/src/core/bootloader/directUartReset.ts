import type { IFirmwareTransport } from '../transports/types';
import type { ScopedLogger } from '../logging/FlashLogger';

export type UartResetStrategy = 'dtr_rts_classic' | 'rts_pulse' | 'none';

/** Классическая последовательность EN/IO0 для входа в ROM bootloader */
export async function tryDtrRtsClassic(t: IFirmwareTransport, log: ScopedLogger): Promise<void> {
  log.info('Сброс UART: DTR/RTS classic (EN + IO0)');
  await t.setDTR(false);
  await t.setRTS(true);
  await new Promise((r) => setTimeout(r, 100));
  await t.setDTR(true);
  await new Promise((r) => setTimeout(r, 50));
  await t.setDTR(false);
  await new Promise((r) => setTimeout(r, 50));
  await t.setRTS(false);
}

export async function tryRtsPulse(t: IFirmwareTransport, log: ScopedLogger): Promise<void> {
  log.info('Сброс UART: RTS pulse');
  await t.setRTS(true);
  await new Promise((r) => setTimeout(r, 200));
  await t.setRTS(false);
}
