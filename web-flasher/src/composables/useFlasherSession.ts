import { computed, ref, shallowRef, watch } from 'vue';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { partitionFirmwarePick } from '@/core/firmware/partitionFirmwarePick';
import { parseFirmwareFile, type ParsedFirmwarePackage } from '@/core/firmware/parseFirmwareInput';
import { WebSerialTransport } from '@/core/transports/WebSerialTransport';
import { NativeBridgeTransport } from '@/core/transports/NativeBridgeTransport';
import { getNativeBridgeFromWindow, nativeBridgeSerialPortAvailable } from '@/core/transports/nativeBridgeGlobal';
import { OtaHttpTransport } from '@/core/transports/OtaHttpTransport';
import { getPlatformCapabilities } from '@/core/transports/platformCapabilities';
import { runBetaflightPassthrough } from '@/core/passthrough/betaflightPassthrough';
import { runInavPassthrough } from '@/core/passthrough/inavPassthrough';
import { runEdgeTxPassthrough } from '@/core/passthrough/edgetxPassthrough';
import { assertFirmwareMatchesDevice } from '@/core/flash/compatibility';
import { prepareEspLoader, writeSegmentsWithLoader } from '@/core/flash/espFlashEngine';
import { runUartResetStrategies } from '@/core/bootloader/directUartReset';
import { FlasherError, TransportUnavailableError } from '@/core/errors';

export type FlashPhase =
  | 'idle'
  | 'connect'
  | 'detect_chip'
  | 'passthrough'
  | 'bootloader'
  | 'flash'
  | 'verify'
  | 'reboot'
  | 'done'
  | 'error';

export type PathMode = 'direct' | 'betaflight' | 'inav' | 'edgetx' | 'ota';

const LS_KEY = 'elrs-web-flasher-prefs-v1';

interface Prefs {
  otaHost: string;
  /** Путь относительно хоста OTA, напр. update */
  otaUploadPath: string;
  /** UART: браузер Web Serial или нативный мост (оболочка) */
  uartBackend: 'web-serial' | 'native-bridge';
  expert: {
    forceFlash: boolean;
    halfDuplex: boolean;
    uartIndex: string;
    passthroughBaud: number;
    resetMode: 'default_reset' | 'no_reset';
    flashWriteSize: number;
    /** Полное стирание flash перед записью (опасно) */
    eraseAll: boolean;
    /** EdgeTX: сценарий backpack (RF модуль) */
    edgeTxBackpack: boolean;
  };
  recent: { name: string; size: number; lastModified: number; sha256?: string }[];
}

function loadPrefs(): Prefs {
  const d = defaultPrefs();
  try {
    const r = localStorage.getItem(LS_KEY);
    if (!r) return d;
    const p = JSON.parse(r) as Partial<Prefs>;
    return {
      ...d,
      ...p,
      uartBackend: p.uartBackend === 'native-bridge' ? 'native-bridge' : d.uartBackend,
      expert: { ...d.expert, ...p.expert },
      recent: Array.isArray(p.recent) ? p.recent : d.recent,
    };
  } catch {
    /* */
  }
  return d;
}

function defaultPrefs(): Prefs {
  return {
    otaHost: 'http://10.0.0.1',
    otaUploadPath: 'update',
    uartBackend: 'web-serial',
    expert: {
      forceFlash: false,
      halfDuplex: false,
      uartIndex: '',
      passthroughBaud: 420000,
      resetMode: 'no_reset',
      flashWriteSize: 0,
      eraseAll: false,
      edgeTxBackpack: false,
    },
    recent: [],
  };
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* */
  }
}

export function useFlasherSession() {
  const platform = getPlatformCapabilities();
  const logger = new FlashLogger();
  const logLines = ref<string[]>([]);
  logger.addListener((e) => {
    logLines.value.push(`[${e.ts}] ${e.level.toUpperCase()} ${e.scope}: ${e.message}`);
    if (logLines.value.length > 500) logLines.value.shift();
  });

  const phase = ref<FlashPhase>('idle');
  const pathMode = ref<PathMode>('direct');
  const expertOpen = ref(false);
  const prefs = ref<Prefs>(loadPrefs());
  const selectedFile = shallowRef<File | null>(null);
  const sidecarFile = shallowRef<File | null>(null);
  const parsed = shallowRef<ParsedFirmwarePackage | null>(null);
  const lastError = ref<string | null>(null);
  const serialTransport = shallowRef<WebSerialTransport | NativeBridgeTransport | null>(null);
  const progressFlash = ref(0);

  const nativeBridgeAvailable = computed(() => getNativeBridgeFromWindow() !== null);

  const nativeEsptoolReady = computed(() => nativeBridgeSerialPortAvailable());

  const canUseUartFlash = computed(() => {
    if (prefs.value.uartBackend === 'native-bridge') return nativeBridgeAvailable.value;
    return platform.hasWebSerialApi && platform.wiredSerialLikelyWorks;
  });

  const transportBadge = computed(() => {
    if (pathMode.value === 'ota') return 'OTA / Wi‑Fi';
    const back = prefs.value.uartBackend === 'native-bridge' ? 'Native bridge' : 'Web Serial';
    if (pathMode.value === 'betaflight') return `Betaflight passthrough (${back})`;
    if (pathMode.value === 'inav') return `INAV passthrough (${back})`;
    if (pathMode.value === 'edgetx') return `EdgeTX passthrough (${back})`;
    if (prefs.value.uartBackend === 'web-serial' && !platform.wiredSerialLikelyWorks) {
      return 'Web Serial недоступен (платформа)';
    }
    if (prefs.value.uartBackend === 'native-bridge' && !nativeBridgeAvailable.value) {
      return 'Native bridge не обнаружен';
    }
    return `Direct UART (${back})`;
  });

  const wiredAvailable = computed(() => platform.hasWebSerialApi && platform.wiredSerialLikelyWorks);

  async function parseSelectedFile(): Promise<void> {
    if (!selectedFile.value) return;
    parsed.value = await parseFirmwareFile(selectedFile.value, logger, sidecarFile.value);
    const r = prefs.value.recent.filter((x) => x.name !== selectedFile.value!.name);
    r.unshift({
      name: selectedFile.value.name,
      size: selectedFile.value.size,
      lastModified: selectedFile.value.lastModified,
      sha256: parsed.value.sha256,
    });
    prefs.value.recent = r.slice(0, 8);
    savePrefs(prefs.value);
  }

  watch(
    () => [selectedFile.value, sidecarFile.value] as const,
    async ([f]) => {
      if (f) await parseSelectedFile();
    },
  );

  async function clearSerialConnection(): Promise<void> {
    const cur = serialTransport.value;
    if (!cur) return;
    try {
      await cur.disconnect();
    } catch {
      /* */
    }
    serialTransport.value = null;
  }

  async function connectSerial(): Promise<WebSerialTransport | NativeBridgeTransport> {
    phase.value = 'connect';
    if (prefs.value.uartBackend === 'native-bridge') {
      const host = getNativeBridgeFromWindow();
      if (!host) {
        throw new TransportUnavailableError(
          'Native bridge не найден: ожидается window.__ELRS_FLASHER_NATIVE__',
          'См. docs/native-bridge.md',
        );
      }
      const t = new NativeBridgeTransport(host, logger);
      await t.connect();
      serialTransport.value = t;
      return t;
    }
    const prev =
      serialTransport.value instanceof WebSerialTransport ? serialTransport.value.getSerialPort() : undefined;
    const t = new WebSerialTransport({
      logger,
      baudRate: 115200,
      port: prev ?? undefined,
    });
    await t.connect();
    serialTransport.value = t;
    return t;
  }

  async function probeWebUsb(): Promise<void> {
    const { WebUSBTransport } = await import('@/core/transports/WebUSBTransport');
    const t = new WebUSBTransport({ logger });
    await t.connect();
    await t.disconnect();
    logger
      .child('WebUSB')
      .info('Проверка WebUSB: устройство открыто и закрыто. Прошивка ESP здесь идёт через Web Serial + esptool-js, не через WebUSB.');
  }

  async function runWorkflow(): Promise<void> {
    lastError.value = null;
    progressFlash.value = 0;
    try {
      if (!selectedFile.value) throw new Error('Выберите файл прошивки.');
      await parseSelectedFile();
      if (!parsed.value) throw new Error('Не удалось разобрать прошивку.');

      if (pathMode.value === 'ota') {
        phase.value = 'flash';
        const ota = new OtaHttpTransport({
          logger,
          baseUrl: prefs.value.otaHost,
          uploadPath: prefs.value.otaUploadPath?.trim() || 'update',
        });
        await ota.connect();
        const total = parsed.value.segments.reduce((a, s) => a + s.data.length, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const s of parsed.value.segments) {
          merged.set(s.data, off);
          off += s.data.length;
        }
        const blob = new Blob([merged], { type: 'application/octet-stream' });
        await ota.uploadFirmware(blob, {
          filename: selectedFile.value.name,
          onProgress: (p) => (progressFlash.value = Math.round(p * 100)),
        });
        await ota.disconnect();
        phase.value = 'done';
        return;
      }

      if (!canUseUartFlash.value) {
        throw new Error(
          prefs.value.uartBackend === 'native-bridge'
            ? 'Native bridge не доступен. Задайте window.__ELRS_FLASHER_NATIVE__ или используйте OTA.'
            : 'На этой платформе Web Serial недоступен. Используйте OTA или оболочку с Native bridge.',
        );
      }

      const t = serialTransport.value ?? (await connectSerial());

      let detectedTarget: string | undefined;

      if (pathMode.value === 'betaflight') {
        phase.value = 'passthrough';
        const uartStr = prefs.value.expert.uartIndex.trim();
        const r = await runBetaflightPassthrough(t, {
          baud: prefs.value.expert.passthroughBaud,
          halfDuplex: prefs.value.expert.halfDuplex,
          manualUartIndex: uartStr === '' ? undefined : parseInt(uartStr, 10),
          logger: logger.child('BF'),
        });
        detectedTarget = r.rxTargetReported.trim() || undefined;
      } else if (pathMode.value === 'inav') {
        phase.value = 'passthrough';
        const uartStr = prefs.value.expert.uartIndex.trim();
        const r = await runInavPassthrough(t, {
          baud: prefs.value.expert.passthroughBaud,
          halfDuplex: prefs.value.expert.halfDuplex,
          manualUartIndex: uartStr === '' ? undefined : parseInt(uartStr, 10),
          logger: logger.child('INAV'),
        });
        detectedTarget = r.rxTargetReported.trim() || undefined;
      } else if (pathMode.value === 'edgetx') {
        phase.value = 'passthrough';
        const r = await runEdgeTxPassthrough(t, {
          baud: prefs.value.expert.passthroughBaud,
          halfDuplex: prefs.value.expert.halfDuplex,
          backpack: prefs.value.expert.edgeTxBackpack,
          logger: logger.child('EdgeTX'),
        });
        detectedTarget = r.rxTargetReported.trim() || undefined;
      } else {
        phase.value = 'bootloader';
        await runUartResetStrategies(t, logger.child('reset'));
      }

      phase.value = 'bootloader';
      let port: SerialPort;
      if (t instanceof WebSerialTransport) {
        port = await t.handoffToEsptool();
      } else if (t instanceof NativeBridgeTransport) {
        const sp = await t.getSerialPortForEsptool();
        if (!sp) {
          throw new TransportUnavailableError(
            'Native bridge: не реализован getSerialPortForEsptool() — esptool-js требует SerialPort как у Web Serial API.',
            'См. docs/native-bridge.md или полифилл navigator.serial.',
          );
        }
        await t.disconnect();
        port = sp;
      } else {
        throw new Error('Неизвестный UART-транспорт');
      }

      phase.value = 'detect_chip';
      const prepared = await prepareEspLoader(port, {
        logger,
        resetMode: prefs.value.expert.resetMode,
        baudRate: pathMode.value === 'direct' ? 460800 : prefs.value.expert.passthroughBaud,
        romBaudRate: 115200,
        flashWriteSize: prefs.value.expert.flashWriteSize > 0 ? prefs.value.expert.flashWriteSize : undefined,
        espRamBlock: pathMode.value !== 'direct' ? 0x800 : undefined,
      });

      assertFirmwareMatchesDevice({
        firmwareChip: parsed.value.effectiveChip,
        detectedChip: prepared.chipName,
        firmwareTarget: parsed.value.effectiveTarget,
        detectedTarget,
        forceFlashConfirmed: prefs.value.expert.forceFlash,
      });

      const nFiles = parsed.value.segments.length;
      phase.value = 'flash';
      progressFlash.value = 0;
      await writeSegmentsWithLoader(prepared, parsed.value.segments, {
        logger,
        eraseAll: prefs.value.expert.eraseAll,
        hooks: {
          onFlashProgress: (fileIndex, written, total) => {
            const part = total > 0 ? written / total : 0;
            progressFlash.value = Math.min(99, Math.round(((fileIndex + part) / Math.max(1, nFiles)) * 100));
          },
          onFlashWriteSettled: () => {
            progressFlash.value = 100;
            phase.value = 'verify';
          },
          onDeviceRebootInvoke: () => {
            phase.value = 'reboot';
          },
          onTransportClosed: () => {
            phase.value = 'done';
          },
        },
      });
    } catch (e) {
      phase.value = 'error';
      const msg = e instanceof FlasherError ? `${e.message}${e.actionableHint ? ' — ' + e.actionableHint : ''}` : String(e);
      lastError.value = msg;
      logger.child('workflow').error(msg);
    }
  }

  function copyLogs(): void {
    void navigator.clipboard?.writeText(logLines.value.join('\n'));
  }

  function downloadLogs(): void {
    const blob = new Blob([logLines.value.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flasher-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function updateOtaHost(h: string): void {
    prefs.value.otaHost = h;
    savePrefs(prefs.value);
  }

  function updateOtaUploadPath(p: string): void {
    prefs.value.otaUploadPath = p;
    savePrefs(prefs.value);
  }

  function applyOtaPathPreset(preset: string): void {
    if (!preset) return;
    prefs.value.otaUploadPath = preset;
    savePrefs(prefs.value);
  }

  function persistPrefs(): void {
    savePrefs(prefs.value);
  }

  /** Один или несколько файлов из диалога / drag-drop: .bin|.zip [+ .json]. */
  function applyPickedFiles(files: File[]): void {
    if (!files.length) return;
    lastError.value = null;
    try {
      const { firmware, sidecar } = partitionFirmwarePick(files);
      selectedFile.value = firmware;
      sidecarFile.value = sidecar;
      if (sidecar) {
        logger.log('info', 'FlasherSession', `Sidecar из мультивыбора: ${sidecar.name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError.value = msg;
      logger.log('error', 'FlasherSession', msg);
    }
  }

  function toggleExpert(): void {
    expertOpen.value = !expertOpen.value;
  }

  function setUartBackend(b: 'web-serial' | 'native-bridge'): void {
    void clearSerialConnection();
    prefs.value.uartBackend = b;
    savePrefs(prefs.value);
  }

  return {
    platform,
    logger,
    logLines,
    phase,
    pathMode,
    expertOpen,
    prefs,
    selectedFile,
    sidecarFile,
    parsed,
    lastError,
    serialTransport,
    progressFlash,
    transportBadge,
    wiredAvailable,
    nativeBridgeAvailable,
    nativeEsptoolReady,
    canUseUartFlash,
    parseSelectedFile,
    connectSerial,
    clearSerialConnection,
    probeWebUsb,
    setUartBackend,
    runWorkflow,
    copyLogs,
    downloadLogs,
    updateOtaHost,
    updateOtaUploadPath,
    applyOtaPathPreset,
    persistPrefs,
    toggleExpert,
    applyPickedFiles,
  };
}
