import {
  BetaflightConfigInvalidError,
  CliPromptNotFoundError,
  RxUartNotFoundError,
} from '../errors';
import type { IFirmwareTransport } from '../transports/types';
import type { ScopedLogger } from '../logging/FlashLogger';
import { enterElrsBootloader } from './elrsBootloader';
import {
  findBetaflightRxUartIndexFromSerialLines,
  parseBetaflightGetValue,
} from './cliParsers';

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

async function getCliValue(t: IFirmwareTransport, key: string, log: ScopedLogger): Promise<string | null> {
  await writeLine(t, `get ${key}`);
  const lines = await readLinesForMs(t, 1200);
  for (const line of lines) {
    const p = parseBetaflightGetValue(line);
    if (p && p.key === key) return p.value;
  }
  log.debug(`get ${key}: нет ответа, строки: ${lines.join('|').slice(0, 200)}`);
  return null;
}

async function validateSerialRx(
  t: IFirmwareTransport,
  halfDuplex: boolean,
  log: ScopedLogger,
): Promise<void> {
  const proto = halfDuplex ? ['GHST'] : ['CRSF', 'ELRS'];
  const provider = await getCliValue(t, 'serialrx_provider', log);
  if (!provider || !proto.some((p) => provider.toUpperCase().includes(p))) {
    throw new BetaflightConfigInvalidError(
      `serialrx_provider должен быть ${proto.join('/')}, сейчас: ${provider ?? 'нет ответа'}`,
    );
  }
  const inv = await getCliValue(t, 'serialrx_inverted', log);
  if (inv && inv.toUpperCase() !== 'OFF') {
    throw new BetaflightConfigInvalidError('Установите serialrx_inverted = OFF');
  }
  const hd = await getCliValue(t, 'serialrx_halfduplex', log);
  if (halfDuplex) {
    if (hd && !['ON', 'AUTO'].includes(hd.toUpperCase())) {
      throw new BetaflightConfigInvalidError('Для GHST обычно нужен half-duplex ON/AUTO');
    }
  } else if (hd && !['OFF', 'AUTO'].includes(hd.toUpperCase())) {
    throw new BetaflightConfigInvalidError('Для CRSF установите serialrx_halfduplex = OFF');
  }
}

export interface BetaflightPassthroughOptions {
  baud: number;
  halfDuplex: boolean;
  /** Индекс UART из `serial` (Expert), иначе авто */
  manualUartIndex?: number;
  bindPhraseKey?: string | null;
  logger: ScopedLogger;
}

/**
 * Вход в CLI, проверка CRSF/GHST, serialpassthrough, затем ELRS bootloader init.
 */
export async function runBetaflightPassthrough(
  t: IFirmwareTransport,
  opt: BetaflightPassthroughOptions,
): Promise<void> {
  const log = opt.logger;
  await writeLine(t, '#');
  const head = await readLinesForMs(t, 600);
  const blob = head.join('');
  if (blob.includes('CCC')) {
    log.info('Уже в passthrough / загрузчик (метка CCC)');
    return;
  }
  const hasPrompt = /(^|\n|\r)#\s*$/m.test(blob) || blob.includes('# ');
  if (!hasPrompt) {
    throw new CliPromptNotFoundError(
      'Не найден приглашение CLI Betaflight (#). Перезагрузите FC и проверьте порт.',
    );
  }

  await validateSerialRx(t, opt.halfDuplex, log);

  let uart = opt.manualUartIndex;
  if (uart === undefined) {
    await writeLine(t, 'serial');
    const serialLines = await readLinesForMs(t, 1200);
    uart = findBetaflightRxUartIndexFromSerialLines(serialLines.map((l) => l.trim())) ?? undefined;
  }
  if (uart === undefined) throw new RxUartNotFoundError('Не найден UART с функцией RX (маска 64).');

  log.info(`serialpassthrough ${uart} ${opt.baud}`);
  await writeLine(t, `serialpassthrough ${uart} ${opt.baud}`);
  await new Promise((r) => setTimeout(r, 250));
  await readLinesForMs(t, 500);

  await enterElrsBootloader(
    (u) => t.write(u),
    opt.halfDuplex ? 'GHST' : 'CRSF',
    opt.bindPhraseKey ?? null,
    (m) => log.info(m),
  );
}
