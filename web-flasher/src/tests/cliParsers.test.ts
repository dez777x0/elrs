import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findBetaflightRxUartIndexFromSerialLines,
  parseBetaflightGetValue,
  parseBetaflightVersionBanner,
  parseInavVersionBanner,
} from '@/core/passthrough/cliParsers';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('cliParsers', () => {
  it('parses get line', () => {
    expect(parseBetaflightGetValue('serialrx_provider = CRSF')).toEqual({
      key: 'serialrx_provider',
      value: 'CRSF',
    });
  });

  it('parses get line with CRLF (Betaflight CLI)', () => {
    expect(parseBetaflightGetValue('serialrx_provider = CRSF\r\n')).toEqual({
      key: 'serialrx_provider',
      value: 'CRSF',
    });
  });

  it('finds RX uart from betaflight fixture', () => {
    const txt = readFileSync(join(__dirname, 'fixtures/betaflight-serial.txt'), 'utf8');
    const lines = txt.split(/\r?\n/);
    expect(findBetaflightRxUartIndexFromSerialLines(lines)).toBe(2);
  });

  it('parses INAV banner fixture', () => {
    const txt = readFileSync(join(__dirname, 'fixtures/inav-version.txt'), 'utf8');
    expect(parseInavVersionBanner(txt)).toBeTruthy();
  });

  it('parses betaflight banner', () => {
    expect(parseBetaflightVersionBanner('Betaflight 4.4.0')).toBe('4.4.0');
  });
});
