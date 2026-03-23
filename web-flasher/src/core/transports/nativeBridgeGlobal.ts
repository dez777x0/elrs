import type { NativeBridgeHandlers } from './NativeBridgeTransport';

/** Имя глобала, который выставляет нативная оболочка */
export const NATIVE_BRIDGE_GLOBAL = '__ELRS_FLASHER_NATIVE__' as const;

export type NativeBridgeHost = NativeBridgeHandlers;

declare global {
  interface Window {
    [NATIVE_BRIDGE_GLOBAL]?: NativeBridgeHost;
  }
}

function isFn(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === 'function';
}

/** Оболочка может вызвать из инжектированного скрипта для явной регистрации. */
export function installNativeBridge(handlers: NativeBridgeHost): void {
  if (typeof window === 'undefined') return;
  window[NATIVE_BRIDGE_GLOBAL] = handlers;
}

/** Снимает мост (например при выходе из WebView). */
export function clearNativeBridge(): void {
  if (typeof window === 'undefined') return;
  delete window[NATIVE_BRIDGE_GLOBAL];
}

/**
 * Возвращает обработчики, если глобал полный; иначе `null`.
 */
export function getNativeBridgeFromWindow(): NativeBridgeHost | null {
  if (typeof window === 'undefined') return null;
  const b = window[NATIVE_BRIDGE_GLOBAL];
  if (!b || !isFn(b.connect) || !isFn(b.disconnect) || !isFn(b.read) || !isFn(b.write)) {
    return null;
  }
  return b;
}

export function nativeBridgeSerialPortAvailable(): boolean {
  const b = getNativeBridgeFromWindow();
  return Boolean(b && isFn(b.getSerialPortForEsptool));
}
