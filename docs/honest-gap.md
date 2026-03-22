# Честный gap: заявленный объём vs текущий код

Документ фиксирует **реальные** пробелы, чтобы не смешивать целевую спецификацию с уже работающим поведением. Обновляйте его при существенных изменениях в `web-flasher/`.

## Критичные для «полного» acceptance criteria

| Тема | Статус | Комментарий |
|------|--------|-------------|
| **Таргет RX после bootloader** | **Сделано для BF/INAV** | После `enterElrsBootloader` вызывается `readBootloaderTargetLine`; строка передаётся в `assertFirmwareMatchesDevice` из `useFlasherSession`. Для **direct UART** и **OTA** по-прежнему нет строки от RX (ожидаемо). Пустой ответ RX не блокирует прошивку. |
| **Фазы verify / reboot в UI** | **Частично** | `verify` ставится после успешного `writeFlash`; `reboot` — перед `loader.after`; `done` — после `disconnect`. Детализации шагов внутри esptool-js в UI нет. |
| **Erase flash / полная очистка** | **Expert** | Чекбокс «Полное стирание flash (erase all)» в Expert Mode, прокидывается в esptool-js. |
| **Сторонний JSON (sidecar) к .bin** | **Сделано (Expert)** | Отдельный выбор `.json` в Expert; при наличии manifest в ZIP sidecar игнорируется. Авто-поиск `*.json` без второго выбора файла в браузере не делался. |
| **WebUSB в основном потоке прошивки** | **Намеренно не основной путь** | Класс `WebUSBTransport` остаётся; в UI — честные бейджи и кнопка проверки в Expert. **esptool-js** по-прежнему только через **Web Serial** (или `getSerialPortForEsptool` из native bridge). |
| **NativeBridgeTransport** | **Сделано** | [native-bridge.md](./native-bridge.md), глобал, Expert UART backend, `getSerialPortForEsptool`. Демо WebView в репозитории не обязателен. |
| **Workers** | **Частично** | SHA-256 ≥ 2 MiB в worker; разбор ZIP в main thread (JSZip). |
| **EdgeTX passthrough** | **Сделано** | `runEdgeTxPassthrough` (обычный + backpack в Expert), режим UI «EdgeTX passthrough». |
| **Betaflight SPI RX (ExpressLRS SPI)** | **Сделано** | При ошибках UART проверяется `rx_spi_protocol`; при EXPRESSLRS добавляется сообщение и ссылка на wiki SPI RX. |
| **Несколько стратегий сброса с fallback** | **Частично** | Для direct UART: `DTR/RTS classic`, затем `RTS pulse` с паузой; обе логируются. Полного перебора режимов esptool нет. |
| **OTA endpoint** | **Частично** | Путь задаётся вручную + кнопки-пресеты (`update`, `upload`, `api/update`). Ориентиры по URL: [ota-endpoints.md](./ota-endpoints.md). Автоопределения по устройству нет. |

## Passthrough / CLI

| Тема | Статус |
|------|--------|
| Автодетект UART по `serial` | Реализован для типичной маски RX (64), как в web-flasher; экзотические конфигурации BF/INAV могут не распознаться. |
| CRSF vs GHST | Реализовано через half-duplex флаг; тонкие различия версий BF по `serialpassthrough` не покрыты тестами на железе. |
| Надёжность таймингов | Зависит от скорости ответа FC; увеличены таймауты для `get`, но passthrough на слабых связях остаётся зоной риска. |

## Тесты

| Тема | Статус |
|------|--------|
| End-to-end на железе | Нет в CI (ожидаемо). |
| Интеграция Betaflight passthrough до bootloader | **Сценарный мок** `BetaflightScriptedMock` + `passthroughBf.integration.test.ts`; парсер `get` учитывает `\r\n` (реальный вывод BF CLI). |
| Интеграция EdgeTX (мок) | `EdgeTxScriptedMock` + `edgetx.integration.test.ts`. |
| Интеграция INAV (мок) | `InavScriptedMock` + `passthroughInav.integration.test.ts`. |
| WebUSB / Web Serial | Нет автоматизированных тестов (нужен браузер/драйверы). |

## Платформы

| Платформа | Честно |
|-----------|--------|
| Windows Chromium + UART | Основной рабочий путь по задумке; не гарантируется для каждого адаптера без ручной проверки. |
| Android | `navigator.serial` зависит от сборки браузера; UI помечает доступность, но стабильность не сертифицирована. |
| iOS Safari | Проводной UART **не заявляется**; OTA путь есть, но успех зависит от точного URL и режима RX. |

## Этап 2 (платформы / транспорты) — состояние

| Тема | Статус |
|------|--------|
| **Native bridge** | **Сделано:** [native-bridge.md](./native-bridge.md), глобал, Expert UART backend, `getSerialPortForEsptool` для esptool-js. |
| **WebUSB** | **Честный UI:** бейдж + проверка в Expert; не путь прошивки ESP для esptool-js. |
| **Worker SHA-256** | **Сделано:** ≥ 2 MiB в worker, иначе main thread. |

## Документация и структура

- В `implementation-notes.md` ранее могли упоминаться имена функций, которых нет в коде — сверяйте с `src/core/passthrough/cliParsers.ts`.

Если закрываете пункт из этой таблицы — измените статус здесь в том же PR.

План доведения до релиза: [release-roadmap.md](./release-roadmap.md).
