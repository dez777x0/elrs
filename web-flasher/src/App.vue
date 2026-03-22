<script setup lang="ts">
import { ref } from 'vue';
import { useFlasherSession } from '@/composables/useFlasherSession';
import type { FirmwareSegment } from '@/core/firmware/parseFirmwareInput';

const dropActive = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const sidecarInput = ref<HTMLInputElement | null>(null);
const forceConfirm = ref(false);

const {
  platform,
  logLines,
  phase,
  pathMode,
  expertOpen,
  prefs,
  selectedFile,
  sidecarFile,
  parsed,
  lastError,
  progressFlash,
  transportBadge,
  wiredAvailable,
  canUseUartFlash,
  nativeBridgeAvailable,
  nativeEsptoolReady,
  connectSerial,
  runWorkflow,
  copyLogs,
  downloadLogs,
  updateOtaHost,
  updateOtaUploadPath,
  applyOtaPathPreset,
  persistPrefs,
  toggleExpert,
  probeWebUsb,
  setUartBackend,
} = useFlasherSession();

function onPickFile(e: Event): void {
  const t = e.target as HTMLInputElement;
  const f = t.files?.[0];
  if (f) selectedFile.value = f;
  t.value = '';
}

function onPickSidecar(e: Event): void {
  const t = e.target as HTMLInputElement;
  const f = t.files?.[0];
  sidecarFile.value = f ?? null;
  t.value = '';
}

function clearSidecar(): void {
  sidecarFile.value = null;
  persistPrefs();
}

function onDrop(e: DragEvent): void {
  dropActive.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) selectedFile.value = f;
}

function segOffsets(segments: FirmwareSegment[]): string {
  return segments.map((x) => '0x' + x.offset.toString(16)).join(', ');
}

async function onFlashClick(): Promise<void> {
  if (prefs.value.expert.forceFlash && !forceConfirm.value) {
    alert('Включён Force Flash: отметьте подтверждение опасности ниже.');
    return;
  }
  await runWorkflow();
}

function onUartBackendChange(ev: Event): void {
  const v = (ev.target as HTMLSelectElement).value;
  if (v === 'web-serial' || v === 'native-bridge') setUartBackend(v);
}

async function onProbeWebUsb(): Promise<void> {
  try {
    await probeWebUsb();
    alert('WebUSB: тест OK (см. лог). Прошивка ESP в этом приложении использует Web Serial + esptool-js, не WebUSB.');
  } catch (e) {
    alert(String(e));
  }
}
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>ELRS Web Flasher</h1>
      <p class="sub">Локальный файл → детект → прошивка (ESP / ExpressLRS)</p>
      <div class="badges">
        <span class="badge">{{ transportBadge }}</span>
        <span v-if="pathMode !== 'ota' && !canUseUartFlash" class="badge warn">UART-прошивка сейчас недоступна (Web Serial или Native bridge)</span>
        <span v-if="prefs.uartBackend === 'native-bridge' && !nativeEsptoolReady" class="badge warn">
          Native bridge без getSerialPortForEsptool — esptool не сможет прошить (см. docs/native-bridge.md)
        </span>
        <span v-if="platform.hasWebUsbApi" class="badge muted">WebUSB API есть (не путь прошивки ESP здесь)</span>
      </div>
    </header>

    <main class="main">
      <section
        class="dropzone"
        :class="{ active: dropActive }"
        @dragenter.prevent="dropActive = true"
        @dragover.prevent="dropActive = true"
        @dragleave.prevent="dropActive = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <p class="cta-primary">Выбрать файл прошивки</p>
        <p class="hint">Перетащите .bin или .zip сюда, или нажмите</p>
        <input ref="fileInput" type="file" accept=".bin,.zip" class="hidden" @change="onPickFile" />
      </section>

      <div class="row">
        <button type="button" class="btn secondary" :disabled="pathMode === 'ota' || !canUseUartFlash" @click="connectSerial()">
          Подключить устройство (UART)
        </button>
        <button type="button" class="btn" :disabled="!selectedFile || (pathMode !== 'ota' && !canUseUartFlash)" @click="onFlashClick">
          Прошить
        </button>
      </div>

      <section class="panel">
        <h2>Режим</h2>
        <div class="modes">
          <label><input v-model="pathMode" type="radio" value="direct" :disabled="!canUseUartFlash" /> Прямой UART</label>
          <label><input v-model="pathMode" type="radio" value="betaflight" :disabled="!canUseUartFlash" /> Betaflight passthrough</label>
          <label><input v-model="pathMode" type="radio" value="inav" :disabled="!canUseUartFlash" /> INAV passthrough</label>
          <label><input v-model="pathMode" type="radio" value="edgetx" :disabled="!canUseUartFlash" /> EdgeTX passthrough</label>
          <label><input v-model="pathMode" type="radio" value="ota" /> OTA / Wi‑Fi</label>
        </div>
        <div v-if="pathMode === 'ota'" class="ota">
          <label>OTA хост <input :value="prefs.otaHost" @input="updateOtaHost(($event.target as HTMLInputElement).value)" /></label>
          <label class="ota-path"
            >Путь загрузки
            <input
              :value="prefs.otaUploadPath"
              placeholder="update"
              @input="updateOtaUploadPath(($event.target as HTMLInputElement).value)"
            />
          </label>
          <div class="ota-presets">
            <span class="preset-label">Пресеты:</span>
            <button type="button" class="btn small" @click="applyOtaPathPreset('update')">update</button>
            <button type="button" class="btn small" @click="applyOtaPathPreset('upload')">upload</button>
            <button type="button" class="btn small" @click="applyOtaPathPreset('api/update')">api/update</button>
          </div>
        </div>
      </section>

      <section v-if="parsed" class="panel summary">
        <h2>Сводка перед прошивкой</h2>
        <ul>
          <li>Файл: {{ parsed.sourceName }}</li>
          <li>Сегменты: {{ parsed.segments.length }} ({{ segOffsets(parsed.segments) }})</li>
          <li>Чип (метаданные): {{ parsed.effectiveChip ?? '—' }}</li>
          <li>Таргет: {{ parsed.effectiveTarget ?? '—' }}</li>
          <li>Версия: {{ parsed.effectiveVersion ?? '—' }}</li>
          <li>SHA-256: <code>{{ parsed.sha256.slice(0, 24) }}…</code></li>
          <li>MD5: <code>{{ parsed.md5 }}</code></li>
          <li v-if="sidecarFile">Sidecar: {{ sidecarFile.name }}</li>
          <li v-if="prefs.expert.eraseAll" class="danger">Будет выполнено полное стирание flash (erase all)</li>
        </ul>
      </section>

      <section class="panel">
        <h2>Фаза: <code>{{ phase }}</code></h2>
        <div v-if="pathMode !== 'ota'" class="phases">
          <span :class="{ on: ['connect', 'passthrough', 'bootloader', 'detect_chip', 'flash', 'verify', 'reboot', 'done'].includes(phase) }">connect</span>
          <span :class="{ on: ['detect_chip', 'flash', 'verify', 'reboot', 'done'].includes(phase) }">detect</span>
          <span :class="{ on: ['passthrough', 'bootloader', 'detect_chip', 'flash', 'verify', 'reboot', 'done'].includes(phase) }">passthrough</span>
          <span :class="{ on: ['bootloader', 'detect_chip', 'flash', 'verify', 'reboot', 'done'].includes(phase) }">bootloader</span>
          <span :class="{ on: ['flash', 'verify', 'reboot', 'done'].includes(phase) }">flash</span>
          <span :class="{ on: ['verify', 'reboot', 'done'].includes(phase) }">verify</span>
          <span :class="{ on: ['reboot', 'done'].includes(phase) }">reboot</span>
        </div>
        <div v-else class="phases">
          <span :class="{ on: phase !== 'idle' }">OTA upload</span>
        </div>
        <div v-if="pathMode === 'ota' && progressFlash" class="prog">Прогресс: {{ progressFlash }}%</div>
      </section>

      <section v-if="lastError" class="panel error">
        <h2>Ошибка</h2>
        <pre>{{ lastError }}</pre>
      </section>

      <section class="panel">
        <div class="row spread">
          <h2>Лог</h2>
          <div>
            <button type="button" class="btn small" @click="copyLogs">Копировать</button>
            <button type="button" class="btn small" @click="downloadLogs">Скачать</button>
          </div>
        </div>
        <pre class="log">{{ logLines.join('\n') || '…' }}</pre>
      </section>

      <section class="panel">
        <button type="button" class="btn secondary" @click="toggleExpert">{{ expertOpen ? 'Скрыть' : 'Expert Mode' }}</button>
        <div v-if="expertOpen" class="expert">
          <label
            >UART backend
            <select :value="prefs.uartBackend" @change="onUartBackendChange($event)">
              <option value="web-serial">Web Serial (Chromium)</option>
              <option value="native-bridge" :disabled="!nativeBridgeAvailable">Native bridge (оболочка)</option>
            </select></label
          >
          <p v-if="prefs.uartBackend === 'web-serial' && !wiredAvailable" class="expert-hint">
            Web Serial на этой платформе недоступен — переключитесь на OTA или соберите приложение с Native bridge.
          </p>
          <label>Force Flash <input v-model="prefs.expert.forceFlash" type="checkbox" @change="persistPrefs" /></label>
          <label v-if="prefs.expert.forceFlash" class="danger">
            <input v-model="forceConfirm" type="checkbox" /> Я понимаю риск окирпичивания
          </label>
          <label v-if="pathMode === 'edgetx'"
            >EdgeTX backpack (RF module) <input v-model="prefs.expert.edgeTxBackpack" type="checkbox" @change="persistPrefs"
          /></label>
          <label>Half duplex (GHST) <input v-model="prefs.expert.halfDuplex" type="checkbox" @change="persistPrefs" /></label>
          <label>UART индекс (пусто = авто) <input v-model="prefs.expert.uartIndex" @change="persistPrefs" /></label>
          <label>Passthrough baud <input v-model.number="prefs.expert.passthroughBaud" type="number" @change="persistPrefs" /></label>
          <label
            >esptool reset
            <select v-model="prefs.expert.resetMode" @change="persistPrefs">
              <option value="no_reset">no_reset</option>
              <option value="default_reset">default_reset</option>
            </select></label
          >
          <label>Flash block size (0 = по умолчанию) <input v-model.number="prefs.expert.flashWriteSize" type="number" @change="persistPrefs" /></label>
          <label class="danger"
            >Полное стирание flash (erase all) <input v-model="prefs.expert.eraseAll" type="checkbox" @change="persistPrefs"
          /></label>
          <p class="expert-hint">Sidecar JSON (опционально, только без manifest в ZIP):</p>
          <button type="button" class="btn secondary small" @click="sidecarInput?.click()">Выбрать .json</button>
          <span v-if="sidecarFile" class="sidecar-name">{{ sidecarFile.name }}</span>
          <button v-if="sidecarFile" type="button" class="btn small" @click="clearSidecar">Сбросить sidecar</button>
          <input ref="sidecarInput" type="file" accept=".json,application/json" class="hidden" @change="onPickSidecar" />
          <p class="expert-hint">Большие файлы: SHA-256 считается в Worker при размере ≥ 2 MiB.</p>
          <div v-if="platform.hasWebUsbApi" class="webusb-row">
            <button type="button" class="btn secondary small" @click="onProbeWebUsb">Проверить WebUSB (эксперимент)</button>
            <span class="expert-hint inline">Не используется для esptool-js.</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
