import { FirmwareManifestInvalidError } from '../errors';

/** Расслабленная схема для `firmware.bin.json` рядом с .bin (Expert). */
export interface SidecarMetadata {
  chip?: string;
  target?: string;
  firmwareVersion?: string;
  offset?: number | string;
}

export function coerceFlashOffset(s: string | number): number {
  if (typeof s === 'number') return s;
  const t = s.trim();
  if (t.startsWith('0x') || t.startsWith('0X')) return parseInt(t.slice(2), 16);
  return parseInt(t, 10);
}

export function parseSidecarJson(raw: string): SidecarMetadata {
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    throw new FirmwareManifestInvalidError('Sidecar JSON не удалось разобрать.');
  }
  if (!o || typeof o !== 'object') throw new FirmwareManifestInvalidError('Sidecar: ожидался объект.');
  const r = o as Record<string, unknown>;
  const meta: SidecarMetadata = {};
  if (typeof r.chip === 'string') meta.chip = r.chip;
  if (typeof r.target === 'string') meta.target = r.target;
  if (typeof r.firmwareVersion === 'string') meta.firmwareVersion = r.firmwareVersion;
  if (r.offset !== undefined) meta.offset = r.offset as number | string;
  return meta;
}
