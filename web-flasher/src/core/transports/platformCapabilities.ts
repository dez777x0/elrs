/** Детекция окружения без ложных обещаний о проводном USB на iOS */

export type OsFamily = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';

export interface PlatformCapabilities {
  os: OsFamily;
  /** Web Serial API присутствует в объекте navigator */
  hasWebSerialApi: boolean;
  /** WebUSB API присутствует */
  hasWebUsbApi: boolean;
  /** Мы считаем проводной UART через браузер реалистичным на этой платформе */
  wiredSerialLikelyWorks: boolean;
  userAgent: string;
}

function detectOs(ua: string): OsFamily {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Win/i.test(ua)) return 'windows';
  if (/Mac OS X/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = detectOs(userAgent);
  const hasWebSerialApi = typeof navigator !== 'undefined' && 'serial' in navigator;
  const hasWebUsbApi = typeof navigator !== 'undefined' && 'usb' in navigator;

  // iOS (в т.ч. iPadOS в режиме desktop) — нет полноценного Web Serial для UART-адаптеров
  const isIos =
    os === 'ios' ||
    (os === 'macos' && /Mobile/i.test(userAgent)) ||
    (typeof navigator !== 'undefined' && (navigator as { standalone?: boolean }).standalone === true);

  const wiredSerialLikelyWorks = hasWebSerialApi && !isIos;

  return {
    os: isIos ? 'ios' : os,
    hasWebSerialApi,
    hasWebUsbApi,
    wiredSerialLikelyWorks,
    userAgent,
  };
}
