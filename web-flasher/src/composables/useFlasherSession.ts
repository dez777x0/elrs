import { computed, ref, shallowRef } from 'vue';
import { FlashLogger } from '@/core/logging/FlashLogger';
import { parseFirmwareFile, type ParsedFirmwarePackage } from '@/core/firmware/parseFirmwareInput';
import { WebSerialTransport } from '@/core/transports/WebSerialTransport';
import { OtaHttpTransport } from '@/core/transports/OtaHttpTransport';
import { getPlatformCapabilities } from '@/core/transports/platformCapabilities';
import { runBetaflightPassthrough } from '@/core/passthrough/betaflightPassthrough';
import { runInavPassthrough } from '@/core/passthrough/inavPassthrough';
import { assertFirmwareMatchesDevice } from '@/core/flash/compatibility';
import { prepareEspLoader, writeSegmentsWithLoader } from '@/core/flash/espFlashEngine';
import { tryDtrRtsClassic } from '@/core/bootloader/directUartReset';
import { FlasherError } from '@/core/errors';

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

export type PathMode = 'direct' | 'betaflight' | 'inav' | 'ota';

const LS_KEY = 'elrs-web-flasher-prefs-v1';

interface Prefs {
  otaHost: string;
  expert: {
    forceFlash: boolean;
    halfDuplex: boolean;
    uartIndex: string;
    passthroughBaud: number;
    resetMode: 'default_reset' | 'no_reset';
    flashWriteSize: number;
  };
  recent: { name: string; size: number; lastModified: number; sha256?: string }[];
}

function loadPrefs(): Prefs {
  try {
    const r = localStorage.getItem(LS_KEY);
    if (r) return { ...defaultPrefs(), ...JSON.parse(r) };
  } catch {
    /* */
  }
  return defaultPrefs();
}

function defaultPrefs(): Prefs {
  return {
    otaHost: 'http://10.0.0.1',
    expert: {
      forceFlash: false,
      halfDuplex: false,
      uartIndex: '',
      passthroughBaud: 420000,
      resetMode: 'no_reset',
      flashWriteSize: 0,
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
  const parsed = shallowRef<ParsedFirmwarePackage | null>(null);
  const lastError = ref<string | null>(null);
  const serialTransport = shallowRef<WebSerialTransport | null>(null);
  const progressFlash = ref(0);

  const transportBadge = computed(() => {
    if (pathMode.value === 'ota') return 'OTA / Wi‑Fi';
    if (pathMode.value === 'betaflight') return 'Betaflight passthrough';
    if (pathMode.value === 'inav') return 'INAV passthrough';
    if (!platform.wiredSerialLikelyWorks) return 'Проводной UART недоступен (платформа)';
    return 'Direct UART';
  });

  const wiredAvailable = computed(() => platform.hasWebSerialApi && platform.wiredSerialLikelyWorks);

  async function parseSelectedFile(): Promise<void> {
    if (!selectedFile.value) return;
    parsed.value = await parseFirmwareFile(selectedFile.value, logger);
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

  async function connectSerial(): Promise<WebSerialTransport> {
    phase.value = 'connect';
    const t = new WebSerialTransport({
      logger,
      baudRate: 115200,
      port: serialTransport.value?.getSerialPort() ?? undefined,
    });
    await t.connect();
    serialTransport.value = t;
    return t;
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
          uploadPath: 'update',
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

      if (!wiredAvailable.value) {
        throw new Error('На этой платформе проводная прошивка недоступна. Используйте OTA.');
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
      } else {
        phase.value = 'bootloader';
        await tryDtrRtsClassic(t, logger.child('reset'));
      }

      phase.value = 'bootloader';
      const port = await t.handoffToEsptool();

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
        eraseAll: false,
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

  function persistPrefs(): void {
    savePrefs(prefs.value);
  }

  function toggleExpert(): void {
    expertOpen.value = !expertOpen.value;
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
    parsed,
    lastError,
    serialTransport,
    progressFlash,
    transportBadge,
    wiredAvailable,
    parseSelectedFile,
    connectSerial,
    runWorkflow,
    copyLogs,
    downloadLogs,
    updateOtaHost,
    persistPrefs,
    toggleExpert,
  };
}
