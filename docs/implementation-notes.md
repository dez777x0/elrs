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

- Парсинг вывода CLI вынесен в чистые функции в `cliParsers.ts` (например `findBetaflightRxUartIndexFromSerialLines`, баннеры INAV/BF).
- Команда `serialpassthrough` формируется после определения UART и режима (CRSF vs GHST half‑duplex).

Полный список известных пробелов: **[honest-gap.md](./honest-gap.md)**. Roadmap до релиза: **[release-roadmap.md](./release-roadmap.md)**.

## Сборка и тесты

```bash
cd web-flasher
npm install
npm run lint
npm test
npm run build
```

## Workers

Каталог `web-flasher/src/workers/` зарезервирован под тяжёлый хеш и разбор больших архивов в отдельном потоке при необходимости; сейчас хеширование выполняется в основном потоке (`crypto.subtle` / spark-md5).
