/** Базовая ошибка прошивальщика с кодом для UI и логов */
export abstract class FlasherError extends Error {
  abstract readonly code: string;
  readonly actionableHint?: string;

  constructor(message: string, actionableHint?: string) {
    super(message);
    this.name = new.target.name;
    this.actionableHint = actionableHint;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PortBusyError extends FlasherError {
  readonly code = 'PORT_BUSY';
}

export class PermissionDeniedError extends FlasherError {
  readonly code = 'PERMISSION_DENIED';
}

export class TransportUnavailableError extends FlasherError {
  readonly code = 'TRANSPORT_UNAVAILABLE';
}

export class CliPromptNotFoundError extends FlasherError {
  readonly code = 'CLI_PROMPT_NOT_FOUND';
}

export class BetaflightConfigInvalidError extends FlasherError {
  readonly code = 'BETAFLIGHT_CONFIG_INVALID';
}

export class InavConfigInvalidError extends FlasherError {
  readonly code = 'INAV_CONFIG_INVALID';
}

export class RxUartNotFoundError extends FlasherError {
  readonly code = 'RX_UART_NOT_FOUND';
}

export class BootloaderEntryFailedError extends FlasherError {
  readonly code = 'BOOTLOADER_ENTRY_FAILED';
}

export class ChipMismatchError extends FlasherError {
  readonly code = 'CHIP_MISMATCH';
}

export class TargetMismatchError extends FlasherError {
  readonly code = 'TARGET_MISMATCH';
}

export class FirmwareManifestInvalidError extends FlasherError {
  readonly code = 'FIRMWARE_MANIFEST_INVALID';
}

export class OtaUploadFailedError extends FlasherError {
  readonly code = 'OTA_UPLOAD_FAILED';
}

export class VerificationFailedError extends FlasherError {
  readonly code = 'VERIFICATION_FAILED';
}

export class DeviceDisconnectedError extends FlasherError {
  readonly code = 'DEVICE_DISCONNECTED';
}

export class ReadTimeoutError extends FlasherError {
  readonly code = 'READ_TIMEOUT';
}

export class ForceFlashRequiredError extends FlasherError {
  readonly code = 'FORCE_FLASH_REQUIRED';
}
