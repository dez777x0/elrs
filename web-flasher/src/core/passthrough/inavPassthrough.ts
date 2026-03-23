import { CliPromptNotFoundError, InavConfigInvalidError, RxUartNotFoundError } from '../errors';
import type { ScopedLogger } from '../logging/FlashLogger';
import type { IFirmwareTransport } from '../transports/types';
import { enterElrsBootloader, readBootloaderTargetLine } from './elrsBootloader';
import type { PassthroughBootloaderResult } from './betaflightPassthrough';
import { findBetaflightRxUartIndexFromSerialLines, parseInavVersionBanner } from './cliParsers';
import { DEFAULT_CLI_LINE_IDLE_FLUSH_MS, readLinesForMs } from './cliReadLines';

const enc = new TextEncoder();

async function writeLine(t: IFirmwareTransport, s: string): Promise<void> {
  await t.write(enc.encode(s.endsWith('\n') ? s : s + '\r\n'));
}

export interface InavPassthroughOptions {
  baud: number;
  halfDuplex: boolean;
  manualUartIndex?: number;
  bindPhraseKey?: string | null;
  logger: ScopedLogger;
}

/**
 * INAV использует схожий CLI; serial / serialpassthrough совместимы с CF/BF во многих сборках.
 */
export async function runInavPassthrough(
  t: IFirmwareTransport,
  opt: InavPassthroughOptions,
): Promise<PassthroughBootloaderResult> {
  const log = opt.logger;
  await writeLine(t, '#');
  let lines = await readLinesForMs(t, 600, { idleFlushMs: DEFAULT_CLI_LINE_IDLE_FLUSH_MS });
  let blob = lines.join('');
  if (!parseInavVersionBanner(blob)) {
    await writeLine(t, 'version');
    lines = await readLinesForMs(t, 800, { idleFlushMs: DEFAULT_CLI_LINE_IDLE_FLUSH_MS });
    blob += lines.join('');
  }
  const ver = parseInavVersionBanner(blob);
  if (!ver) {
    throw new InavConfigInvalidError('Баннер INAV не распознан. Убедитесь, что это INAV CLI.');
  }
  log.info(`INAV ${ver} — вход в passthrough`);
  if (!blob.includes('#') && !/#\s*$/m.test(blob)) {
    throw new CliPromptNotFoundError('Нет приглашения CLI INAV (#).');
  }

  let uart = opt.manualUartIndex;
  if (uart === undefined) {
    await writeLine(t, 'serial');
    const serialLines = await readLinesForMs(t, 1200, { idleFlushMs: DEFAULT_CLI_LINE_IDLE_FLUSH_MS });
    uart = findBetaflightRxUartIndexFromSerialLines(serialLines.map((l) => l.trim())) ?? undefined;
  }
  if (uart === undefined) throw new RxUartNotFoundError('INAV: не найден RX UART в выводе serial.');

  const mode = opt.halfDuplex ? '1' : '0';
  log.info(`serialpassthrough ${uart} ${opt.baud} ${mode}`);
  await writeLine(t, `serialpassthrough ${uart} ${opt.baud} ${mode}`);
  await new Promise((r) => setTimeout(r, 300));
  await readLinesForMs(t, 500, { idleFlushMs: DEFAULT_CLI_LINE_IDLE_FLUSH_MS });

  await enterElrsBootloader(
    (u) => t.write(u),
    opt.halfDuplex ? 'GHST' : 'CRSF',
    opt.bindPhraseKey ?? null,
    (m) => log.info(m),
  );

  const rxTargetReported = await readBootloaderTargetLine(t);
  if (rxTargetReported) log.info(`RX target (bootloader): ${rxTargetReported}`);
  else log.info('RX target: пусто (слепая прошивка или таймаут строки)');
  return { rxTargetReported };
}
