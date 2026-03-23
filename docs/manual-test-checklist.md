# Чек-лист ручного теста (web-flasher)

Использовать после изменений в `web-flasher/` или перед тегом/релизом (в т.ч. после **1.0.0**). Отмечайте **OK / Fail** и кратко что пошло не так.

## Окружение

| Шаг | Результат |
|-----|-----------|
| ОС + браузер (версия) записаны | |
| URL: `https://…` или `http://localhost:5173` (Serial только secure context) | |
| При проверке с другого хоста — см. [web-flasher-deployment.md](./web-flasher-deployment.md) (HTTPS) | |
| `cd web-flasher && npm run dev` или production `npm run build` + `preview` | |

## 1. Парсинг прошивки

| Шаг | Результат |
|-----|-----------|
| Выбор одного `.bin` — сводка, SHA-256, MD5 | |
| Выбор `.zip` с `firmware-manifest.json` — сегменты и адреса | |
| Sidecar JSON (Expert) без manifest в ZIP — chip/target/offset применяются | |
| Мультивыбор в основном поле: `.bin` + `.json` за один раз — тот же эффект, что sidecar в Expert | |
| Sidecar с ZIP manifest — sidecar игнорируется (лог предупреждение) | |

## 2. Web Serial (Windows / Linux Chromium)

| Шаг | Результат |
|-----|-----------|
| Подключить USB-UART, **Подключить устройство** — порт открывается | |
| **Direct UART** + прошивка на известный ESP — успех или ожидаемая ошибка чипа | |
| В логе direct: три стратегии сброса (classic, RTS 200 ms, RTS 500 ms) | |
| **Betaflight passthrough** — вход в CLI, serialpassthrough, прошивка | |
| **INAV passthrough** — аналогично | |
| **EdgeTX** / **EdgeTX backpack** (Expert) — последовательность set / serialpassthrough | |
| Неверный таргет + без Force Flash — блокировка | |
| Force Flash + подтверждение — проходит при осознанном риске | |

## 3. OTA

| Шаг | Результат |
|-----|-----------|
| RX в режиме Wi‑Fi, хост `http://10.0.0.1` (или свой) | |
| Смена пути + пресеты `update` / `upload` / `api/update` | |
| Загрузка завершается или понятная ошибка HTTP | |

## 4. Платформы / границы

| Шаг | Результат |
|-----|-----------|
| iOS Safari: проводной UART помечен недоступным; OTA доступен | |
| **Native bridge** (если есть оболочка): глобал выставлен, UART backend, при необходимости `getSerialPortForEsptool` | |
| **Проверить WebUSB** (Expert): диалог выбора устройства или понятная ошибка | |

## 5. UI / стабильность

| Шаг | Результат |
|-----|-----------|
| Фазы connect → … → done отображаются при успехе | |
| Лог копируется / скачивается | |
| Большой файл (>2 MiB): UI не зависает надолго при выборе (SHA в worker) | |

---

Платы для регрессии (пример): один **ESP32**/**ESP32-C3** RX, один полётник с **Betaflight** или **INAV** на свободном UART.
