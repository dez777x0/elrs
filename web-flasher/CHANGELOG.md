# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

## [Unreleased]

### Исправлено

- Разбор строк `get` Betaflight CLI с окончанием **CRLF** (`\r\n`) в `parseBetaflightGetValue` — иначе значение не извлекалось из буфера `readLinesForMs`.

### Добавлено

- Vue 3 + Vite + PWA: локальный выбор `.bin` / `.zip`, Web Serial + **esptool-js**, OTA multipart.
- Passthrough: **Betaflight**, **INAV**, **EdgeTX** / **EdgeTX backpack** (CLI `set` / `serialpassthrough rfmod`), строка таргета RX после bootloader.
- CI (workflow в корне репозитория), чек-лист ручного теста в `docs/manual-test-checklist.md`, интеграционные тесты со сценарными моками.
- Транспорты: Web Serial, WebUSB (CDC, эксперимент), OTA, **Native bridge** (`__ELRS_FLASHER_NATIVE__`, `getSerialPortForEsptool`), Mock.
- Sidecar JSON, erase all, пресеты пути OTA; Worker SHA-256 для файлов ≥ 2 MiB.
- Vitest; документация в `docs/` репозитория.

### Ограничения

- См. `docs/honest-gap.md` и `docs/hardware-limitations.md`.
