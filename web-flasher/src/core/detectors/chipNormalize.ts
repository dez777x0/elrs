/** Нормализация имён чипов для сравнения manifest ↔ esptool-js */

const CANON: Record<string, string> = {
  esp8266: 'ESP8266',
  esp8285: 'ESP8285',
  esp32: 'ESP32',
  'esp32-s3': 'ESP32-S3',
  'esp32s3': 'ESP32-S3',
  'esp32-c3': 'ESP32-C3',
  'esp32c3': 'ESP32-C3',
  'esp32-c2': 'ESP32-C2',
  'esp32-c6': 'ESP32-C6',
};

export function normalizeChipName(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const k = raw.trim().toLowerCase().replace(/\s+/g, '');
  return CANON[k] ?? raw.trim().toUpperCase().replace(/\s+/g, '-');
}

export function chipsCompatible(expected: string | undefined, detected: string | undefined): boolean {
  if (!expected || !detected) return true;
  return normalizeChipName(expected) === normalizeChipName(detected);
}
