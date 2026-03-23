type WorkerResult = { id: number; ok: true; hex: string } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../../workers/firmware-hash.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev: MessageEvent<WorkerResult>) => {
    const d = ev.data;
    const p = pending.get(d.id);
    pending.delete(d.id);
    if (!p) return;
    if (d.ok) p.resolve(d.hex);
    else p.reject(new Error(d.error));
  };
  worker.onerror = (e) => {
    for (const [, pr] of pending) pr.reject(new Error(e.message));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Для тестов / смены окружения */
export function resetSha256WorkerForTests(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}

export function sha256BytesInWorker(data: Uint8Array): Promise<string> {
  const w = getWorker();
  const id = seq++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    try {
      w.postMessage({ id, buffer: buf }, [buf]);
    } catch (e) {
      pending.delete(id);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
