# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

## [Unreleased]

## [0.1.3] — 2026-03-22

### Добавлено

- Мультивыбор прошивки **и** sidecar `.json` в одном диалоге / drag-drop (`partitionFirmwarePick`, тесты); подсказки в UI и в `docs/firmware-manifest-format.md`.

## [0.1.2] — 2026-03-22

### Добавлено

- Direct UART: третья стратегия сброса — **длинный импульс RTS** (500 ms) после classic и короткого RTS; тесты `directUartReset.test.ts`.
- Документация OTA: ориентиры по веткам **ExpressLRS v2 / v3** в `docs/ota-endpoints.md`.

## [0.1.1] — 2026-03-22

### Изменено

- Чтение CLI Betaflight/INAV: общий модуль `cliReadLines.ts` — выход из `readLinesForMs` по **короткой тишине** после ответа (`idleFlushMs` ≈ 80 ms), без ожидания полного `totalMs` на каждый опрос `get` / баннер.
- Интеграционные тесты EdgeTX: опция `skipHardwareDelays` (только тесты) убирает намеренные паузы «как на железе».

### Добавлено

- Юнит-тест `cliReadLines.test.ts`.

## [0.1.0] — 2026-03-22

Первый нумерованный пре-релиз **web-flasher** в монорепозитории (критерии этапа 0–4 roadmap).

### Добавлено

- Vue 3 + Vite + PWA: локальный `.bin` / `.zip`, Web Serial + **esptool-js**, OTA multipart.
- Passthrough: Betaflight, INAV, EdgeTX (+ backpack в Expert), строка таргета RX после bootloader.
- Транспорты: Web Serial, WebUSB (CDC, эксперимент), OTA, Native bridge (`__ELRS_FLASHER_NATIVE__`, `getSerialPortForEsptool`), Mock.
- Sidecar JSON, erase all, пресеты пути OTA; Worker SHA-256 для файлов ≥ 2 MiB.
- Vitest; CI [`.github/workflows/web-flasher.yml`](../.github/workflows/web-flasher.yml); [manual-test-checklist.md](../docs/manual-test-checklist.md).
- Документы деплоя и OTA: [web-flasher-deployment.md](../docs/web-flasher-deployment.md), [ota-endpoints.md](../docs/ota-endpoints.md).
- Интеграционные тесты со сценарными моками: Betaflight, INAV, EdgeTX.

### Исправлено

- `parseBetaflightGetValue`: разбор строк `get … = …` с окончанием **CRLF** (`\r\n`), как в реальном выводе Betaflight CLI.

### Ограничения

- См. `docs/honest-gap.md` и `docs/hardware-limitations.md`.
