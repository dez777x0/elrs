import { CliPromptNotFoundError, InavConfigInvalidError, RxUartNotFoundError } from '../errors';
import type { ScopedLogger } from '../logging/FlashLogger';
import type { IFirmwareTransport } from '../transports/types';
import { enterElrsBootloader } from './elrsBootloader';
import { findBetaflightRxUartIndexFromSerialLines, parseInavVersionBanner } from './cliParsers';

const enc = new TextEncoder();

async function writeLine(t: IFirmwareTransport, s: string): Promise<void> {
  await t.write(enc.encode(s.endsWith('\n') ? s : s + '\r\n'));
}

async function readLinesForMs(t: IFirmwareTransport, totalMs: number): Promise<string[]> {
  const out: string[] = [];
  const deadline = Date.now() + totalMs;
  let buf = '';
  while (Date.now() < deadline) {
    const chunk = await t.read(512, Math.min(200, deadline - Date.now()));
    if (!chunk.length) continue;
    for (let i = 0; i < chunk.length; i++) buf += String.fromCharCode(chunk[i]);
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      out.push(buf.slice(0, idx + 1));
      buf = buf.slice(idx + 1);
    }
  }
  return out;
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
export async function runInavPassthrough(t: IFirmwareTransport, opt: InavPassthroughOptions): Promise<void> {
  const log = opt.logger;
  await writeLine(t, '#');
  let lines = await readLinesForMs(t, 600);
  let blob = lines.join('');
  if (!parseInavVersionBanner(blob)) {
    await writeLine(t, 'version');
    lines = await readLinesForMs(t, 800);
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
    const serialLines = await readLinesForMs(t, 1200);
    uart = findBetaflightRxUartIndexFromSerialLines(serialLines.map((l) => l.trim())) ?? undefined;
  }
  if (uart === undefined) throw new RxUartNotFoundError('INAV: не найден RX UART в выводе serial.');

  const mode = opt.halfDuplex ? '1' : '0';
  log.info(`serialpassthrough ${uart} ${opt.baud} ${mode}`);
  await writeLine(t, `serialpassthrough ${uart} ${opt.baud} ${mode}`);
  await new Promise((r) => setTimeout(r, 300));
  await readLinesForMs(t, 500);

  await enterElrsBootloader(
    (u) => t.write(u),
    opt.halfDuplex ? 'GHST' : 'CRSF',
    opt.bindPhraseKey ?? null,
    (m) => log.info(m),
  );
}
