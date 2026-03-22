# Заметки по реализации

## Расположение

- Веб-приложение: **`web-flasher/`**
- Ядро (без Vue): **`web-flasher/src/core/`**
- UI: **`web-flasher/src/ui/`** (компоненты подключаются из `App.vue`)

## Транспорты

- **`WebSerialTransport`**: обёртка над `SerialPort` + буфер для `read`/`readLine`, DTR/RTS через `setSignals`.
- **`WebUSBTransport`**: поиск интерфейса CDC с bulk IN/OUT (VID Espressif 0x303A); при неудаче — типизированная ошибка.
- **`OtaHttpTransport`**: HTTP(S) загрузка прошивки; «серийные» read/write не используются для ESP ROM — см. `uploadFirmware()`.
- **`NativeBridgeTransport`**: контракт `connect/read/write/...`, реализация через переданные async‑колбэки (интеграция WebView/Capacitor).
- **`MockTransport`**: очереди байт для тестов и сценариев с фикстурами.

## Прошивка ESP

- Используется **`esptool-js`**: `Transport` из пакета + `ESPLoader.connect` / `detectChip` / `writeFlash`.
- Размер блока: поле `FLASH_WRITE_SIZE` у экземпляра `ESPLoader` перед `writeFlash`.

## Passthrough

- Парсинг вывода CLI вынесен в чистые функции в `cliParsers.ts` (например `findBetaflightRxUartIndexFromSerialLines`, баннеры INAV/BF). Строки `key = value` из BF CLI часто приходят с **CRLF**; `parseBetaflightGetValue` нормализует `\r` перед разбором.
- Команда `serialpassthrough` формируется после определения UART и режима (CRSF vs GHST half‑duplex) для Betaflight/INAV.
- **EdgeTX:** `edgetxPassthrough.ts` — последовательность `set` / `serialpassthrough rfmod 0` (вариант backpack в Expert).

Полный список известных пробелов: **[honest-gap.md](./honest-gap.md)**. Roadmap до релиза: **[release-roadmap.md](./release-roadmap.md)**. Деплой и OTA: **[web-flasher-deployment.md](./web-flasher-deployment.md)**, **[ota-endpoints.md](./ota-endpoints.md)**.

## Сборка и тесты

```bash
cd web-flasher
npm install
npm run lint
npm test
npm run build
```

В корне репозитория: GitHub Actions **`.github/workflows/web-flasher.yml`** (триггер при изменениях в `web-flasher/`).

## Workers

- **`firmware-hash.worker.ts`**: SHA-256 для больших буферов; вызывается из `sha256BytesAuto` (порог по умолчанию 2 MiB в `hashes.ts`).
- Разбор ZIP по-прежнему в основном потоке (JSZip).

## Native bridge

- Глобал `window.__ELRS_FLASHER_NATIVE__`, хелперы `getNativeBridgeFromWindow` / `installNativeBridge`: см. **`docs/native-bridge.md`**.
- Опционально **`getSerialPortForEsptool()`** для передачи порта в esptool-js после passthrough.
