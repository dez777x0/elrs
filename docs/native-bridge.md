# Native Bridge: контракт для оболочки (iOS / Android / десктоп WebView)

Веб-приложение в обычном браузере не имеет доступа к USB-UART на iOS. Оболочка (Capacitor, нативная обёртка с WKWebView, custom Chromium) может пробросить UART в страницу двумя способами.

## 1. Глобальный объект (рекомендуется для простых случаев)

До загрузки приложения (или до `connect`) оболочка выставляет:

```ts
window.__ELRS_FLASHER_NATIVE__ = {
  async connect() { /* открыть порт */ },
  async disconnect() { /* закрыть */ },
  async read(maxBytes: number, timeoutMs: number) { return new Uint8Array(...) },
  async write(data: Uint8Array) { /* */ },
  async setDTR?(state: boolean) { /* */ },
  async setRTS?(state: boolean) { /* */ },
  async readLine?(delimiters: string[], timeoutMs: number) { return '...' },
  /**
   * Опционально: вернуть Web Serial `SerialPort` для esptool-js после passthrough.
   * Порт должен быть в состоянии, при котором `esptool-js` может вызвать `.open()`.
   * Если не реализовано — прошивка ESP из веб-ядра недоступна (см. сообщение в UI).
   */
  async getSerialPortForEsptool?() {
    return null;
  },
};
```

Имена методов и сигнатуры должны совпадать с `NativeBridgeHandlers` в коде (`web-flasher/src/core/transports/NativeBridgeTransport.ts`).

## 2. Проверка наличия моста

Приложение вызывает `getNativeBridgeFromWindow()` (`nativeBridgeGlobal.ts`). Если объект неполный (нет `connect` / `read` / `write` / `disconnect`), режим Native bridge в UI недоступен.

## 3. Поток прошивки

1. UART до passthrough идёт через `NativeBridgeTransport` (те же байты, что Web Serial).
2. После Betaflight/INAV passthrough и входа в bootloader ядру нужен **`SerialPort`** для **esptool-js**.
3. Если реализован **`getSerialPortForEsptool`**, он должен вернуть совместимый с [Web Serial API](https://wicg.github.io/serial/) порт (часто это shim от оболочки).
4. Если метод отсутствует или возвращает `null`, приложение останавливается с ошибкой и ссылкой на этот документ — это ожидаемо, пока оболочка не даст порт.

## 4. Альтернатива: полифилл `navigator.serial`

Оболочка может не использовать `__ELRS_FLASHER_NATIVE__`, а подменить **`navigator.serial`** до загрузки приложения. Тогда в UI остаётся режим **Web Serial**, а реализация идёт нативно. Этот путь не документируется здесь детально, но он часто проще для полного паритета с десктопом.

## 5. Безопасность

Не передавайте произвольный JS из сети в `__ELRS_FLASHER_NATIVE__`. Только код, подписанный и встроенный в оболочку.
