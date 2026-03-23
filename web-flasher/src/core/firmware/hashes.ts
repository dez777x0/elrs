import SparkMD5 from 'spark-md5';
import { sha256BytesInWorker } from './sha256Worker';

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Порог: SHA-256 больших образов в Worker, чтобы не блокировать UI. */
export const DEFAULT_SHA256_WORKER_THRESHOLD = 2 * 1024 * 1024;

export async function sha256Bytes(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const hash = await crypto.subtle.digest('SHA-256', copy.buffer as ArrayBuffer);
  return bufferToHex(hash);
}

export async function sha256BytesAuto(
  data: Uint8Array,
  threshold = DEFAULT_SHA256_WORKER_THRESHOLD,
): Promise<string> {
  if (data.byteLength < threshold || typeof Worker === 'undefined') {
    return sha256Bytes(data);
  }
  try {
    return await sha256BytesInWorker(data);
  } catch {
    return sha256Bytes(data);
  }
}

export function md5Bytes(data: Uint8Array): string {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return SparkMD5.ArrayBuffer.hash(copy.buffer as ArrayBuffer);
}
