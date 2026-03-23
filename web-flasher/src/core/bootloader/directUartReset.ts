import type { IFirmwareTransport } from '../transports/types';
import type { ScopedLogger } from '../logging/FlashLogger';

export type UartResetStrategy = 'dtr_rts_classic' | 'rts_pulse' | 'rts_pulse_long' | 'none';

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
  log.info('Сброс UART: RTS pulse (200 ms)');
  await t.setRTS(true);
  await new Promise((r) => setTimeout(r, 200));
  await t.setRTS(false);
}

/** Длинный импульс RTS — иногда помогает на «тяжёлой» линии EN/ёмкостях USB‑UART. */
export async function tryRtsPulseLong(t: IFirmwareTransport, log: ScopedLogger): Promise<void> {
  log.info('Сброс UART: RTS pulse long (500 ms)');
  await t.setRTS(true);
  await new Promise((r) => setTimeout(r, 500));
  await t.setRTS(false);
}

/** Несколько стратегий подряд с паузой (passthrough / капризный адаптер). */
export async function runUartResetStrategies(t: IFirmwareTransport, log: ScopedLogger): Promise<void> {
  await tryDtrRtsClassic(t, log);
  await new Promise((r) => setTimeout(r, 120));
  await tryRtsPulse(t, log);
  await new Promise((r) => setTimeout(r, 120));
  await tryRtsPulseLong(t, log);
}
