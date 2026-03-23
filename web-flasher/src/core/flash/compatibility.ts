import { ForceFlashRequiredError } from '../errors';
import { chipsCompatible, normalizeChipName } from '../detectors/chipNormalize';

/** Блокирует только если нет подтверждённого Force Flash. */
export function assertFirmwareMatchesDevice(options: {
  firmwareChip?: string;
  detectedChip?: string;
  firmwareTarget?: string;
  detectedTarget?: string;
  forceFlashConfirmed: boolean;
}): void {
  const fc = normalizeChipName(options.firmwareChip);
  const dc = normalizeChipName(options.detectedChip);
  if (fc && dc && !chipsCompatible(fc, dc)) {
    if (!options.forceFlashConfirmed) {
      throw new ForceFlashRequiredError(
        `Чип прошивки (${fc}) не совпадает с обнаруженным (${dc}).`,
        'Включите принудительную прошивку в Expert Mode после явного подтверждения риска.',
      );
    }
  }
  const ft = options.firmwareTarget?.trim();
  const dt = options.detectedTarget?.trim();
  if (ft && dt && ft.toUpperCase() !== dt.toUpperCase()) {
    if (!options.forceFlashConfirmed) {
      throw new ForceFlashRequiredError(
        `Таргет прошивки (${ft}) не совпадает с ответом RX (${dt}).`,
        'Подтвердите Force Flash в Expert Mode, если уверены.',
      );
    }
  }
}
