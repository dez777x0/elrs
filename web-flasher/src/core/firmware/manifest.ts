import { FirmwareManifestInvalidError } from '../errors';

export interface FirmwareManifestSegment {
  file: string;
  offset: number;
}

export interface FirmwareManifest {
  version?: string;
  target?: string;
  chip?: string;
  firmwareVersion?: string;
  segments: FirmwareManifestSegment[];
  sha256?: string;
  md5?: string;
}

function parseOffset(s: string | number): number {
  if (typeof s === 'number') return s;
  const t = s.trim();
  if (t.startsWith('0x') || t.startsWith('0X')) return parseInt(t.slice(2), 16);
  return parseInt(t, 10);
}

export function parseManifestJson(raw: string): FirmwareManifest {
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    throw new FirmwareManifestInvalidError('Manifest не является валидным JSON.');
  }
  if (!o || typeof o !== 'object') throw new FirmwareManifestInvalidError('Manifest: ожидался объект.');
  const obj = o as Record<string, unknown>;
  const segmentsIn = obj.segments;
  if (!Array.isArray(segmentsIn) || segmentsIn.length === 0) {
    throw new FirmwareManifestInvalidError('Manifest: нужен непустой массив segments.');
  }
  const segments: FirmwareManifestSegment[] = [];
  for (const row of segmentsIn) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const file = r.file;
    const offset = r.offset;
    if (typeof file !== 'string' || !file.length) {
      throw new FirmwareManifestInvalidError('Manifest: у сегмента должен быть file (string).');
    }
    if (offset === undefined) throw new FirmwareManifestInvalidError(`Manifest: сегмент ${file} без offset.`);
    segments.push({ file, offset: parseOffset(offset as string | number) });
  }
  if (!segments.length) throw new FirmwareManifestInvalidError('Manifest: не удалось разобрать segments.');
  return {
    version: typeof obj.version === 'string' ? obj.version : undefined,
    target: typeof obj.target === 'string' ? obj.target : undefined,
    chip: typeof obj.chip === 'string' ? obj.chip : undefined,
    firmwareVersion: typeof obj.firmwareVersion === 'string' ? obj.firmwareVersion : undefined,
    segments,
    sha256: typeof obj.sha256 === 'string' ? obj.sha256 : undefined,
    md5: typeof obj.md5 === 'string' ? obj.md5 : undefined,
  };
}
