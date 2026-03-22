import {
  BetaflightConfigInvalidError,
  CliPromptNotFoundError,
  RxUartNotFoundError,
} from '../errors';
import type { IFirmwareTransport } from '../transports/types';
import type { ScopedLogger } from '../logging/FlashLogger';
import { enterElrsBootloader, readBootloaderTargetLine } from './elrsBootloader';
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
  const issues: string[] = [];

  const provider = await getCliValue(t, 'serialrx_provider', log);
  if (!provider || !proto.some((p) => provider.toUpperCase().includes(p))) {
    issues.push(`serialrx_provider должен быть ${proto.join('/')}, сейчас: ${provider ?? 'нет ответа'}`);
  }
  const inv = await getCliValue(t, 'serialrx_inverted', log);
  if (inv && inv.toUpperCase() !== 'OFF') {
    issues.push('Установите serialrx_inverted = OFF');
  }
  const hd = await getCliValue(t, 'serialrx_halfduplex', log);
  if (halfDuplex) {
    if (hd && !['ON', 'AUTO'].includes(hd.toUpperCase())) {
      issues.push('Для GHST обычно нужен half-duplex ON/AUTO');
    }
  } else if (hd && !['OFF', 'AUTO'].includes(hd.toUpperCase())) {
    issues.push('Для CRSF установите serialrx_halfduplex = OFF');
  }

  if (issues.length === 0) return;

  const spi = await getCliValue(t, 'rx_spi_protocol', log);
  if (spi && spi.toUpperCase().includes('EXPRESSLRS')) {
    issues.push('Обнаружен ExpressLRS SPI RX — UART passthrough для прошивки ESP здесь не подходит.');
    issues.push('См. https://www.expresslrs.org/2.0/hardware/spi-receivers/');
  }

  throw new BetaflightConfigInvalidError(issues.join('\n'));
}

export interface BetaflightPassthroughOptions {
  baud: number;
  halfDuplex: boolean;
  /** Индекс UART из `serial` (Expert), иначе авто */
  manualUartIndex?: number;
  bindPhraseKey?: string | null;
  logger: ScopedLogger;
}

export interface PassthroughBootloaderResult {
  /** Ответ RX после входа в bootloader (может быть пустым) */
  rxTargetReported: string;
}

/**
 * Вход в CLI, проверка CRSF/GHST, serialpassthrough, затем ELRS bootloader init.
 */
export async function runBetaflightPassthrough(
  t: IFirmwareTransport,
  opt: BetaflightPassthroughOptions,
): Promise<PassthroughBootloaderResult> {
  const log = opt.logger;
  await writeLine(t, '#');
  const head = await readLinesForMs(t, 600);
  const blob = head.join('');
  if (blob.includes('CCC')) {
    log.info('Уже в passthrough / загрузчик (метка CCC)');
    const rxTargetReported = await readBootloaderTargetLine(t);
    if (rxTargetReported) log.info(`RX target (bootloader): ${rxTargetReported}`);
    return { rxTargetReported };
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

  const rxTargetReported = await readBootloaderTargetLine(t);
  if (rxTargetReported) log.info(`RX target (bootloader): ${rxTargetReported}`);
  else log.info('RX target: пусто (слепая прошивка или таймаут строки)');
  return { rxTargetReported };
}
