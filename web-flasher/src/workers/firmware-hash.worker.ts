function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

onmessage = async (ev: MessageEvent<{ id: number; buffer: ArrayBuffer }>) => {
  const { id, buffer } = ev.data;
  try {
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    const hex = bufferToHex(hash);
    postMessage({ id, ok: true as const, hex });
  } catch (e) {
    postMessage({
      id,
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};

export {};
