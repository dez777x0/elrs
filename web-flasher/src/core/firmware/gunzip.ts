/** Магия gzip (RFC 1952). */
export function looksLikeGzip(data: Uint8Array): boolean {
  return data.byteLength >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

/**
 * Распаковка gzip в браузере (Chromium) и в Node ≥ 18 с Web Streams.
 */
export async function gunzipBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Распаковка .bin.gz недоступна: в этом окружении нет DecompressionStream. Используйте актуальный Chromium или распакуйте файл вручную.',
    );
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const blob = new Blob([copy]);
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

/** Имя для эвристик: `firmware.bin.gz` → `firmware.bin`. */
export function stripGzipExtension(filename: string): string {
  const n = filename.toLowerCase();
  if (n.endsWith('.gz')) return filename.slice(0, -3);
  return filename;
}
