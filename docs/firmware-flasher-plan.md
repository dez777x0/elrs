# План: веб-прошивальщик (ExpressLRS-style)

## Текущее состояние репозитория

- Корень: прошивка **ExpressLRS** (C++/PlatformIO), каталог `src/` занят исходниками MCU.
- Отдельного фронтенда не было: **новое приложение** размещается в **`web-flasher/`** со своим `package.json` и `src/`, без конфликта с прошивкой.

## Цели MVP

1. **Vue 3 + Vite + TypeScript + PWA** в `web-flasher/`.
2. **UI-agnostic ядро** (`web-flasher/src/core/*`): транспорты, детекция ESP, passthrough Betaflight/INAV, вход в загрузчик, парсинг прошивки, движок прошивки на **esptool-js**.
3. **Честная матрица платформ**: Windows Chromium — Web Serial; iOS Safari — без проводного USB, OTA; Android — Serial при наличии API; Native Bridge — интерфейс для оболочки.
4. **Локальный файл** как главный вход: `.bin`, несколько сегментов, `.zip` + manifest.
5. **Типизированные ошибки**, лог-панель, Expert Mode, локальное хранилище недавних файлов/настроек.
6. **Тесты** (Vitest): парсинг, эвристики, mismatch, passthrough по транскриптам, мок-интеграции.

## Этапы реализации

| Этап | Содержание |
|------|------------|
| A | Документация: matrix, manifest, hardware, implementation-notes |
| B | `core/errors`, `core/logging`, `core/transports`, `platformCapabilities` |
| C | `core/firmware` (manifest, zip, хеши, эвристики имени) |
| D | `core/detectors` (нормализация чипов ESP8266/8285/32/C3/S3) |
| E | `core/passthrough` (Betaflight/INAV CLI + serialpassthrough) |
| F | `core/bootloader` (CRSF/GHST init, DTR/RTS стратегии) |
| G | `core/flash` (обёртка ESPLoader, verify, reboot, chunk size) |
| H | UI: первый экран файл + подключение, фазы, логи, Expert, OTA форма |
| I | Тесты и фикстуры транскриптов |
| J | `npm run build`, `npm test`, правки по результатам |

## Зависимости

- `esptool-js` — прошивка ESP в браузере через Web Serial `Transport`.
- `jszip` — распаковка zip-пакетов с manifest.

## Не входит в MVP

- Облачная компиляция прошивки.
- Полная поддержка всех STM32/ELRS без ESP (только детекция/блокировка с понятным сообщением).

После утверждения плана реализация выполняется в той же ветке без остановки на отдельное согласование.

Актуальный **gap** относительно полной спецификации: [honest-gap.md](./honest-gap.md).
