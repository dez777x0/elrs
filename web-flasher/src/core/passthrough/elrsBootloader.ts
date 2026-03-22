/**
 * Последовательности входа в UART-загрузчик ELRS (как в ExpressLRS/web-flasher passthrough.js).
 */

function ord(c: string): number {
  return c.charCodeAt(0);
}

const INIT_SEQ = {
  CRSF: [0xec, 0x04, 0x32, ord('b'), ord('l')],
  GHST: [0x89, 0x04, 0x32, ord('b'), ord('l')],
} as const;

export function calcCrc8(payload: Uint8Array, poly = 0xd5): number {
  let crc = 0;
  for (let pos = 0; pos < payload.byteLength; pos++) {
    crc ^= payload[pos];
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x80) !== 0) crc = ((crc << 1) ^ poly) % 256;
      else crc = (crc << 1) % 256;
    }
  }
  return crc;
}

function getTelemetrySeq(seq: readonly number[], key: string | null): Uint8Array {
  const payload = new Uint8Array(seq);
  let u8array = new Uint8Array(0);
  if (key != null) {
    u8array = new Uint8Array(key.length);
    for (let i = 0; i < key.length; i++) u8array[i] = key.charCodeAt(i);
  }
  const tmp = new Uint8Array(payload.byteLength + u8array.byteLength + 1);
  tmp.set(payload, 0);
  tmp[1] = payload[1] + u8array.byteLength;
  tmp.set(u8array, payload.byteLength);
  const crc = calcCrc8(tmp.slice(2, tmp.byteLength - 1));
  tmp[tmp.byteLength - 1] = crc;
  return tmp;
}

export function getElrsBootloaderInitSeq(protocol: 'CRSF' | 'GHST', bindPhraseKey: string | null = null): Uint8Array {
  const base = INIT_SEQ[protocol];
  return getTelemetrySeq(base, bindPhraseKey);
}

/** CRSF: преамбула 0x55 + init; GHST: только init */
export async function enterElrsBootloader(
  write: (u: Uint8Array) => Promise<void>,
  protocol: 'CRSF' | 'GHST',
  bindPhraseKey: string | null,
  log: (m: string) => void,
): Promise<void> {
  if (protocol === 'GHST') {
    log('Bootloader: half-duplex (GHST) init');
    await write(getElrsBootloaderInitSeq('GHST', bindPhraseKey));
    return;
  }
  log('Bootloader: full-duplex (CRSF) preamble + init');
  const train = new Uint8Array(32);
  train.fill(0x55);
  await write(new Uint8Array([0x07, 0x07, 0x12, 0x20]));
  await write(train);
  await new Promise((r) => setTimeout(r, 200));
  await write(getElrsBootloaderInitSeq('CRSF', bindPhraseKey));
  await new Promise((r) => setTimeout(r, 200));
}
