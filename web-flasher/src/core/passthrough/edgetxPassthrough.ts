import type { ScopedLogger } from '../logging/FlashLogger';
import type { IFirmwareTransport } from '../transports/types';
import { enterElrsBootloader, readBootloaderTargetLine } from './elrsBootloader';
import type { PassthroughBootloaderResult } from './betaflightPassthrough';

const enc = new TextEncoder();

async function writeLine(t: IFirmwareTransport, s: string): Promise<void> {
  await t.write(enc.encode(s.endsWith('\n') ? s : s + '\r\n'));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendExpect(
  t: IFirmwareTransport,
  cmd: string,
  expectSubstr: string,
  delayMs: number,
  log: ScopedLogger,
  skipHardwareDelays: boolean,
): Promise<void> {
  const line = cmd.replace(/\n/g, '').replace(/\r/g, '');
  await writeLine(t, line);
  const deadline = Date.now() + 800;
  let buf = '';
  while (Date.now() < deadline) {
    const chunk = await t.read(512, Math.min(150, deadline - Date.now()));
    for (let i = 0; i < chunk.length; i++) buf += String.fromCharCode(chunk[i]);
    if (buf.includes(expectSubstr)) {
      log.debug(`EdgeTX: ok «${expectSubstr}»`);
      if (!skipHardwareDelays && delayMs > 0) await sleep(delayMs);
      return;
    }
  }
  throw new Error(`EdgeTX: ожидали «${expectSubstr}», буфер: ${buf.slice(0, 120)}`);
}

export interface EdgeTxPassthroughOptions {
  baud: number;
  halfDuplex: boolean;
  /** true = EdgeTX с backpack (RF модуль) */
  backpack: boolean;
  bindPhraseKey?: string | null;
  logger: ScopedLogger;
  /**
   * Только для юнит-тестов: не ждать паузы между шагами и короткий drain (на железе оставьте false).
   * @internal
   */
  skipHardwareDelays?: boolean;
}

/**
 * Passthrough через EdgeTX CLI (по логике ExpressLRS/web-flasher).
 */
export async function runEdgeTxPassthrough(
  t: IFirmwareTransport,
  opt: EdgeTxPassthroughOptions,
): Promise<PassthroughBootloaderResult> {
  const log = opt.logger;
  const q = opt.skipHardwareDelays === true;
  if (opt.backpack) {
    log.info('EdgeTX backpack passthrough');
    await sendExpect(t, 'set rfmod 0 power off', 'set:', 100, log, q);
    await sendExpect(t, 'set pulses 0', 'set:', 500, log, q);
    await sendExpect(t, 'set rfmod 0 power on', 'set:', 2500, log, q);
    await sendExpect(t, 'set rfmod 0 bootpin 1', 'set:', 100, log, q);
    await sendExpect(t, 'set rfmod 0 bootpin 0', 'set:', 100, log, q);
    log.info(`serialpassthrough rfmod 0 ${opt.baud}`);
    await writeLine(t, `serialpassthrough rfmod 0 ${opt.baud}`);
  } else {
    log.info('EdgeTX passthrough');
    await sendExpect(t, 'set pulses 0', 'set:', 500, log, q);
    await sendExpect(t, 'set rfmod 0 power off', 'set:', 500, log, q);
    await sendExpect(t, 'set rfmod 0 bootpin 1', 'set:', 100, log, q);
    await sendExpect(t, 'set rfmod 0 power on', 'set:', 100, log, q);
    await sendExpect(t, 'set rfmod 0 bootpin 0', 'set:', 0, log, q);
    log.info(`serialpassthrough rfmod 0 ${opt.baud}`);
    await writeLine(t, `serialpassthrough rfmod 0 ${opt.baud}`);
  }
  if (!q) await sleep(200);
  await readEdgeTxDrain(t, q ? 50 : 400);

  await enterElrsBootloader(
    (u) => t.write(u),
    opt.halfDuplex ? 'GHST' : 'CRSF',
    opt.bindPhraseKey ?? null,
    (m) => log.info(m),
  );

  const rxTargetReported = await readBootloaderTargetLine(t);
  if (rxTargetReported) log.info(`RX target (bootloader): ${rxTargetReported}`);
  return { rxTargetReported };
}

async function readEdgeTxDrain(t: IFirmwareTransport, totalMs: number): Promise<void> {
  const deadline = Date.now() + totalMs;
  while (Date.now() < deadline) {
    await t.read(256, Math.min(80, deadline - Date.now()));
  }
}
