import SparkMD5 from 'spark-md5';

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Bytes(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const hash = await crypto.subtle.digest('SHA-256', copy.buffer as ArrayBuffer);
  return bufferToHex(hash);
}

export function md5Bytes(data: Uint8Array): string {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return SparkMD5.ArrayBuffer.hash(copy.buffer as ArrayBuffer);
}
