/**
 * Разбор списка файлов из input[type=file] multiple / drag-drop:
 * один .bin или один .zip + опционально один .json sidecar.
 */

export interface PartitionedFirmwarePick {
  firmware: File;
  sidecar: File | null;
}

function lower(n: string): string {
  return n.toLowerCase();
}

function isJsonFile(f: File): boolean {
  const n = lower(f.name);
  return n.endsWith('.json') || f.type === 'application/json';
}

/** Прошивка: .bin или .bin.gz (не .bin.json). */
export function isFirmwareBinLike(f: File): boolean {
  const n = lower(f.name);
  if (n.endsWith('.bin.gz')) return true;
  if (n.endsWith('.bin') && !n.endsWith('.bin.json')) return true;
  return false;
}

function pickSidecarForFirmware(firmwareName: string, jsons: File[]): File | null {
  if (jsons.length === 0) return null;
  const logical =
    lower(firmwareName).endsWith('.bin.gz') ? firmwareName.slice(0, -3) : firmwareName;
  const wantExact = `${firmwareName}.json`;
  const wantLogical = `${logical}.json`;
  const exact = jsons.find((j) => j.name === wantExact || j.name === wantLogical);
  if (exact) return exact;
  if (jsons.length === 1) return jsons[0];
  const names = jsons.map((j) => j.name).join(', ');
  throw new Error(
    `Несколько .json (${names}): оставьте один sidecar или «${wantLogical}» / «${wantExact}».`,
  );
}

/**
 * @throws Error с понятным текстом при конфликте имён / типов
 */
export function partitionFirmwarePick(files: File[]): PartitionedFirmwarePick {
  if (files.length === 0) {
    throw new Error('Нет файлов');
  }

  if (files.length === 1) {
    const f = files[0];
    const n = lower(f.name);
    if (isJsonFile(f)) {
      if (n.endsWith('.bin.json')) {
        throw new Error('Нужен файл .bin вместе с .json: выберите оба (мультивыбор).');
      }
      throw new Error('Один .json без прошивки: добавьте в выбор .bin или .zip.');
    }
    if (!isFirmwareBinLike(f) && !n.endsWith('.zip')) {
      throw new Error('Ожидался файл .bin, .bin.gz или .zip прошивки.');
    }
    return { firmware: f, sidecar: null };
  }

  const zips = files.filter((f) => lower(f.name).endsWith('.zip'));
  const bins = files.filter(isFirmwareBinLike);
  const jsons = files.filter(isJsonFile);

  const odd = files.filter(
    (f) => !lower(f.name).endsWith('.zip') && !isFirmwareBinLike(f) && !isJsonFile(f),
  );
  if (odd.length) {
    throw new Error(`Неизвестные типы в выборе: ${odd.map((x) => x.name).join(', ')}`);
  }

  if (zips.length >= 1 && bins.length >= 1) {
    throw new Error('В одном выборе укажите либо .zip, либо .bin, не оба.');
  }
  if (zips.length > 1) {
    throw new Error('Выберите не более одного .zip.');
  }
  if (bins.length > 1) {
    throw new Error('Несколько файлов прошивки (.bin / .bin.gz): оставьте один или один .zip.');
  }

  if (zips.length === 1) {
    const firmware = zips[0];
    if (jsons.length === 0) return { firmware, sidecar: null };
    const sidecar = pickSidecarForFirmware(firmware.name, jsons);
    return { firmware, sidecar };
  }

  const firmware = bins[0];
  if (jsons.length === 0) return { firmware, sidecar: null };
  const sidecar = pickSidecarForFirmware(firmware.name, jsons);
  return { firmware, sidecar };
}
