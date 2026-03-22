# Roadmap до релиза (web-flasher)

Дорожная карта без календарных дат: только **технические вехи** и критерии готовности. Источник правды по пробелам — [honest-gap.md](./honest-gap.md); при закрытии пунктов обновляйте оба файла.

## Текущий прогресс (живое состояние)

| Этап | Статус |
|------|--------|
| **Этап 0** (честный MVP) | В основном выполнен: сборка, тесты, доки, PWA; CI в репозитории — по усмотрению команды. |
| **Этап 1 P0** | **Сделано:** таргет RX (BF/INAV), фазы verify/reboot, прогресс. |
| **Этап 1 P1/P2** | **Частично:** erase all, sidecar JSON, пресеты пути OTA, BF SPI RX, двойной UART reset. |
| **Этап 2** | **Сделано:** Native bridge (док + UI + `getSerialPortForEsptool`), честный WebUSB в UI, Worker SHA-256 для больших файлов. |
| **Этап 3** | **Сделано:** CI `web-flasher.yml`, `CHANGELOG.md`, [manual-test-checklist.md](./manual-test-checklist.md), интеграционные тесты BF/EdgeTX со сценарным моком, **EdgeTX passthrough** в ядре и UI; **исправлен** разбор строк `get … = …` с `\r\n` в `parseBetaflightGetValue`. |
| **Этап 4** (pre-1.0) | **Сделано:** версия **0.1.0** в `web-flasher/package.json`, [web-flasher-deployment.md](./web-flasher-deployment.md), [ota-endpoints.md](./ota-endpoints.md), интеграционный тест **INAV** (`InavScriptedMock`). |

---

## Этап 0 — «честный MVP» (можно пометить как pre-release)

**Цель:** стабильный сценарий «локальный файл → Web Serial → esptool-js» на десктопном Chromium без вводящих в заблуждение заявлений.

| Веха | Критерий готовности |
|------|---------------------|
| Документация | `honest-gap.md`, `hardware-limitations.md`, `transport-matrix.md` актуальны; в UI или README явно сказано, что не гарантируется. |
| Сборка | `npm run lint`, `npm test`, `npm run build` проходят в CI: workflow [`.github/workflows/web-flasher.yml`](../.github/workflows/web-flasher.yml) при изменениях в `web-flasher/`. |
| Версионирование | В `web-flasher/package.json` осмысленная версия (например `0.1.0`); при необходимости тег в git. |
| PWA / деплой | Описан способ хостинга (статический хостинг, HTTPS для Serial). |

**Не блокирует MVP:** EdgeTX, WebUSB в UI, Native bridge, workers.

---

## Этап 1 — закрытие критичных acceptance criteria (кандидат в **1.0**)

| Приоритет | Работа | Зачем |
|-----------|--------|--------|
| P0 | Прочитать строку таргета RX после ELRS bootloader init и передать в `assertFirmwareMatchesDevice` (`detectedTarget`) | **Сделано** для BF+INAV. Direct/OTA без строки RX — ок. |
| P0 | Развести фазы **verify** / **reboot** в UI по реальным событиям esptool-js (колбэки прогресса / завершения writeFlash / after reset) | **Сделано:** `FlashWriteHooks` + прогресс по сегментам. |
| P1 | Опция **erase all** (с предупреждением) в Expert Mode, прокинуть в `writeFlash` | **Сделано** + предупреждение в сводке. |
| P1 | **Sidecar JSON** к выбранному `.bin` (второй выбор файла или авто-поиск `*.bin.json`) с приоритетом из ТЗ | **Сделано** второй выбор в Expert; авто-поиск без file picker — нет. |
| P1 | **OTA:** пресеты путей или документированная матрица «версия ELRS → URL» + поле в UI | **Частично:** поле пути + пресеты кнопками; матрица версий не автоматизирована. |
| P2 | Несколько **стратегий сброса** DTR/RTS с логированием попыток и fallback | **Частично:** classic + RTS pulse подряд. |
| P2 | Ветка **Betaflight SPI RX** (`rx_spi_protocol`) с понятным сообщением | **Сделано.** |

---

## Этап 2 — платформы и транспорты

| Приоритет | Работа |
|-----------|--------|
| P1 | **NativeBridgeTransport:** контракт **[native-bridge.md](./native-bridge.md)**, глобал `__ELRS_FLASHER_NATIVE__`, Expert «UART backend», опциональный **`getSerialPortForEsptool`**. |
| P2 | **WebUSB:** честные бейджи + кнопка проверки в Expert; esptool-js по-прежнему только Web Serial. |
| P2 | **Worker** SHA-256 при размере ≥ 2 MiB (`sha256BytesAuto`). |

---

## Этап 3 — качество и доверие к релизу

| Приоритет | Работа |
|-----------|--------|
| P1 | Расширить **интеграционные тесты** passthrough (стабильный сценарный мок или записанные транскрипты end-to-end до handoff) |
| P2 | Чек-лист **ручного теста на железе** (1–2 платы ESP + BF/INAV) в `docs/` |
| P2 | Минимальный **CHANGELOG** для web-flasher |
| P3 | **EdgeTX** passthrough (если остаётся в продуктовом scope) |

---

## Этап 4 — подготовка к объявлению **1.0.0** (pre-release)

**Цель:** закрыть явные пункты критерия релиза из шапки документа: осмысленная версия артефакта, описание деплоя для пользователей/админов, документированная матрица OTA, паритет интеграционных тестов по passthrough (INAV).

| Веха | Критерий готовности |
|------|---------------------|
| Версия | `web-flasher/package.json` ≠ `0.0.0` (например **0.1.0**); запись в [CHANGELOG](../web-flasher/CHANGELOG.md). |
| Деплой | [web-flasher-deployment.md](./web-flasher-deployment.md): сборка `dist/`, HTTPS / secure context, статический хостинг, замечания по PWA. |
| OTA | [ota-endpoints.md](./ota-endpoints.md): типичные хосты/пути и отладка; ссылка из матрицы транспортов при необходимости. |
| Тесты passthrough | Интеграция **INAV** со сценарным моком (аналог Betaflight/EdgeTX). |

---

## Критерий «релиз 1.0.0»

Считать готовым, когда одновременно:

1. Закрыт **P0** из этапа 1 (таргет RX + честные фазы verify/reboot).  
2. Документ **honest-gap** не содержит незакрытых P0/P1, которые вы сами объявили блокирующими для 1.0.  
3. Сборка и тесты зелёные; описан способ развёртывания для пользователей.

Версии **0.x** допускают явные ограничения при условии, что они перечислены в `honest-gap.md` и в UI не скрываются.

---

## Связанные документы

- [honest-gap.md](./honest-gap.md)  
- [firmware-flasher-plan.md](./firmware-flasher-plan.md)  
- [hardware-limitations.md](./hardware-limitations.md)
