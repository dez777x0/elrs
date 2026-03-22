/**
 * Парсинг вывода CLI Betaflight / INAV для тестов и автодетекта.
 * Маска SERIAL_FUNCTION_RX_SERIAL в Betaflight = 64 (0x40).
 */
export const BF_RX_SERIAL_MASK = 64;

export function parseBetaflightGetValue(line: string): { key: string; value: string } | null {
  const m = line.match(/^\s*(\S+)\s*=\s*(.+)$/);
  if (!m) return null;
  return { key: m[1], value: m[2].trim() };
}

/** Строки вида `serial N <functionMask> ...` */
export function findBetaflightRxUartIndexFromSerialLines(lines: string[]): number | null {
  for (const line of lines) {
    const t = line.trim();
    if (!t.toLowerCase().startsWith('serial ')) continue;
    const parts = t.split(/\s+/);
    if (parts.length < 3) continue;
    const port = parseInt(parts[1], 10);
    const mask = parseInt(parts[2], 10);
    if (!Number.isFinite(port) || !Number.isFinite(mask)) continue;
    if ((mask & BF_RX_SERIAL_MASK) !== 0) return port;
  }
  return null;
}

export function parseBetaflightVersionBanner(transcript: string): string | null {
  const m = transcript.match(/Betaflight\s+(\S+)/i);
  return m ? m[1] : null;
}

export function parseInavVersionBanner(transcript: string): string | null {
  const m = transcript.match(/INAV\s+(\S+)/i);
  return m ? m[1] : null;
}

export function isLikelyBetaflightCli(transcript: string): boolean {
  return /Betaflight/i.test(transcript) && /#/.test(transcript);
}

export function isLikelyInavCli(transcript: string): boolean {
  return /INAV/i.test(transcript) && /#/.test(transcript);
}
