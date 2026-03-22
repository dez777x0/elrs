/** Эвристики имён файлов ExpressLRS / ESP (без гарантии, только подсказки) */

export interface FilenameHints {
  chip?: string;
  target?: string;
  version?: string;
}

const CHIP_PATTERNS: { re: RegExp; chip: string }[] = [
  { re: /ESP32[-_]?S3/i, chip: 'ESP32-S3' },
  { re: /ESP32[-_]?C3/i, chip: 'ESP32-C3' },
  { re: /ESP32(?!-)/i, chip: 'ESP32' },
  { re: /ESP8285/i, chip: 'ESP8285' },
  { re: /ESP8266/i, chip: 'ESP8266' },
];

export function hintsFromFilename(name: string): FilenameHints {
  const base = name.split(/[/\\]/).pop() ?? name;
  const hints: FilenameHints = {};
  for (const { re, chip } of CHIP_PATTERNS) {
    if (re.test(base)) {
      hints.chip = chip;
      break;
    }
  }
  const unified = base.match(/Unified[_-]([A-Za-z0-9_]+)/i);
  if (unified) hints.target = `Unified_${unified[1]}`;
  const ver = base.match(/(\d+\.\d+\.\d+)/);
  if (ver) hints.version = ver[1];
  return hints;
}
