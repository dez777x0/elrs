import type { IFirmwareTransport } from '../transports/types';

/** После последнего байта и пустого буфера строки ждём столько мс тишины перед выходом (вместо полного `totalMs`). */
export const DEFAULT_CLI_LINE_IDLE_FLUSH_MS = 80;

export interface ReadLinesForMsOptions {
  idleFlushMs?: number;
}

/**
 * Собирает строки по `\n` до `totalMs` или (если задан `idleFlushMs`) до тишины на линии при пустом незавершённом буфере.
 * Уменьшает задержки после быстрого ответа CLI (Betaflight/INAV).
 */
export async function readLinesForMs(
  t: IFirmwareTransport,
  totalMs: number,
  opts?: ReadLinesForMsOptions,
): Promise<string[]> {
  const idleFlushMs = opts?.idleFlushMs ?? 0;
  const out: string[] = [];
  const deadline = Date.now() + totalMs;
  let buf = '';
  let idleSince: number | null = null;

  while (Date.now() < deadline) {
    const now = Date.now();
    const remaining = deadline - now;
    if (remaining <= 0) break;

    const baseTimeout = Math.min(200, Math.max(10, remaining));
    const readTimeout =
      idleFlushMs > 0 && idleSince !== null ? Math.min(25, Math.max(5, remaining)) : baseTimeout;

    const chunk = await t.read(512, readTimeout);
    if (chunk.length) {
      idleSince = null;
      for (let i = 0; i < chunk.length; i++) buf += String.fromCharCode(chunk[i]);
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        out.push(buf.slice(0, idx + 1));
        buf = buf.slice(idx + 1);
      }
      continue;
    }

    if (idleFlushMs > 0 && buf.length === 0) {
      if (idleSince === null) idleSince = Date.now();
      else if (Date.now() - idleSince >= idleFlushMs) break;
    } else {
      idleSince = null;
    }
  }
  return out;
}
