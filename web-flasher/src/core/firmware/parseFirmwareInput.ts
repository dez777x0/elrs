import JSZip from 'jszip';
import { FirmwareManifestInvalidError } from '../errors';
import { FlashLogger } from '../logging/FlashLogger';
import { hintsFromFilename } from './filenameHeuristics';
import { md5Bytes, sha256BytesAuto } from './hashes';
import { parseManifestJson, type FirmwareManifest } from './manifest';
import { coerceFlashOffset, parseSidecarJson, type SidecarMetadata } from './sidecar';
import type { ScopedLogger } from '../logging/FlashLogger';

export interface FirmwareSegment {
  name: string;
  offset: number;
  data: Uint8Array;
}

export interface ParsedFirmwarePackage {
  manifest?: FirmwareManifest;
  segments: FirmwareSegment[];
  /** Приоритет метаданных: manifest > filename */
  effectiveChip?: string;
  effectiveTarget?: string;
  effectiveVersion?: string;
  sha256: string;
  md5: string;
  filenameHints: ReturnType<typeof hintsFromFilename>;
  sourceName: string;
}

const MANIFEST_NAMES = ['firmware-manifest.json', 'manifest.json'];

async function tryParseZip(file: File, log: FlashLogger): Promise<ParsedFirmwarePackage> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  let manifest: FirmwareManifest | undefined;
  let manifestRaw: string | undefined;
  for (const n of MANIFEST_NAMES) {
    const entry = zip.file(n);
    if (entry) {
      manifestRaw = await entry.async('string');
      break;
    }
  }
  if (manifestRaw) {
    try {
      manifest = parseManifestJson(manifestRaw);
    } catch (e) {
      log.child('firmware').warn(String(e));
      throw e;
    }
  }
  const segments: FirmwareSegment[] = [];
  if (manifest) {
    for (const s of manifest.segments) {
      const f = zip.file(s.file);
      if (!f) throw new FirmwareManifestInvalidError(`В ZIP нет файла сегмента: ${s.file}`);
      const ab = await f.async('arraybuffer');
      segments.push({ name: s.file, offset: s.offset, data: new Uint8Array(ab) });
    }
  } else {
    const bins = Object.keys(zip.files).filter(
      (k) => !zip.files[k].dir && k.toLowerCase().endsWith('.bin'),
    );
    if (!bins.length) throw new FirmwareManifestInvalidError('ZIP без manifest и без .bin файлов.');
    for (const path of bins.sort()) {
      const ab = await zip.file(path)!.async('arraybuffer');
      segments.push({ name: path, offset: 0, data: new Uint8Array(ab) });
    }
  }
  const cat = concatSegments(segments);
  const sha256 = await sha256BytesAuto(cat);
  const md5 = md5Bytes(cat);
  const hints = hintsFromFilename(file.name);
  return {
    manifest,
    segments,
    effectiveChip: manifest?.chip ?? hints.chip,
    effectiveTarget: manifest?.target ?? hints.target,
    effectiveVersion: manifest?.firmwareVersion ?? hints.version,
    sha256,
    md5,
    filenameHints: hints,
    sourceName: file.name,
  };
}

/**
 * Sidecar имеет приоритет ниже manifest из ZIP (см. ТЗ). Для одиночного .bin усиливает эвристики имени.
 */
export function mergeSidecarIntoParsed(
  pkg: ParsedFirmwarePackage,
  side: SidecarMetadata,
  log: ScopedLogger,
): ParsedFirmwarePackage {
  if (pkg.manifest) {
    log.warn('Sidecar не применён: в пакете уже есть manifest из ZIP (приоритет выше).');
    return pkg;
  }
  const segs = pkg.segments.map((s, i) => {
    if (i !== 0 || side.offset === undefined) return s;
    const off = coerceFlashOffset(side.offset);
    return { ...s, offset: off };
  });
  return {
    ...pkg,
    segments: segs,
    effectiveChip: side.chip ?? pkg.effectiveChip,
    effectiveTarget: side.target ?? pkg.effectiveTarget,
    effectiveVersion: side.firmwareVersion ?? pkg.effectiveVersion,
  };
}

function concatSegments(segments: FirmwareSegment[]): Uint8Array {
  const total = segments.reduce((a, s) => a + s.data.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const s of segments) {
    out.set(s.data, o);
    o += s.data.length;
  }
  return out;
}

export async function parseFirmwareFile(
  file: File,
  logger: FlashLogger,
  sidecarFile?: File | null,
): Promise<ParsedFirmwarePackage> {
  const log = logger.child('parseFirmware');
  const name = file.name.toLowerCase();
  let pkg: ParsedFirmwarePackage;
  if (name.endsWith('.zip')) {
    pkg = await tryParseZip(file, logger);
  } else {
    const data = new Uint8Array(await file.arrayBuffer());
    const hints = hintsFromFilename(file.name);
    const sha256 = await sha256BytesAuto(data);
    const md5 = md5Bytes(data);
    log.info(`Одиночный .bin: ${file.name} (${data.length} байт)`);
    pkg = {
      segments: [{ name: file.name, offset: 0, data }],
      effectiveChip: hints.chip,
      effectiveTarget: hints.target,
      effectiveVersion: hints.version,
      sha256,
      md5,
      filenameHints: hints,
      sourceName: file.name,
    };
  }

  if (sidecarFile && sidecarFile.size > 0) {
    const raw = await sidecarFile.text();
    const side = parseSidecarJson(raw);
    pkg = mergeSidecarIntoParsed(pkg, side, log);
    log.info(`Sidecar применён: ${sidecarFile.name}`);
  }

  return pkg;
}
