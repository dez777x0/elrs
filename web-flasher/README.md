# ELRS Web Flasher

Веб-приложение (Vue 3 + Vite + PWA + TypeScript) для локальной прошивки ExpressLRS на ESP8266/8285/ESP32 (включая C3/S3) через Web Serial, с passthrough Betaflight/INAV и OTA.

## Команды

| Команда | Назначение |
|---------|------------|
| `npm install` | Зависимости |
| `npm run dev` | Разработка |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Превью production |
| `npm run lint` | `vue-tsc` проверка типов |
| `npm test` | Vitest |

## Архитектура (кратко)

- `src/core/transports` — WebSerial, WebUSB (CDC bulk), OTA HTTP, Native bridge, Mock
- `src/core/passthrough` — Betaflight / INAV CLI и ELRS bootloader init (как в ExpressLRS/web-flasher)
- `src/core/flash` — обёртка **esptool-js**, проверка чипа vs manifest
- `src/core/firmware` — ZIP + manifest, эвристики имён, SHA-256 / MD5
- `src/ui` / `App.vue` — интерфейс, фазы, лог, Expert Mode
- `src/tests` — unit и мок-интеграции

Подробнее: [../docs/implementation-notes.md](../docs/implementation-notes.md).

## Ограничения

См. [../docs/hardware-limitations.md](../docs/hardware-limitations.md). На iOS Safari проводной UART через обычный браузер недоступен — используйте OTA или нативную оболочку с `NativeBridgeTransport`.

**Что ещё не совпадает с целевой спецификацией:** [../docs/honest-gap.md](../docs/honest-gap.md).

**Roadmap до релиза:** [../docs/release-roadmap.md](../docs/release-roadmap.md).
