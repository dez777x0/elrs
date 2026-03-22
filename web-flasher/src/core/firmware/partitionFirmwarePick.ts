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

function pickSidecarForFirmware(firmwareName: string, jsons: File[]): File | null {
  if (jsons.length === 0) return null;
  const wantBinJson = `${firmwareName}.json`;
  const exact = jsons.find((j) => j.name === wantBinJson);
  if (exact) return exact;
  if (jsons.length === 1) return jsons[0];
  const names = jsons.map((j) => j.name).join(', ');
  throw new Error(
    `Несколько .json (${names}): оставьте один sidecar или назовите его «${firmwareName}.json» (рядом с прошивкой).`,
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
    if (!n.endsWith('.bin') && !n.endsWith('.zip')) {
      throw new Error('Ожидался файл .bin или .zip прошивки.');
    }
    return { firmware: f, sidecar: null };
  }

  const zips = files.filter((f) => lower(f.name).endsWith('.zip'));
  const bins = files.filter((f) => lower(f.name).endsWith('.bin'));
  const jsons = files.filter(isJsonFile);

  const odd = files.filter(
    (f) =>
      !lower(f.name).endsWith('.zip') &&
      !lower(f.name).endsWith('.bin') &&
      !isJsonFile(f),
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
    throw new Error('Несколько .bin: оставьте один файл прошивки или один .zip.');
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
