import { describe, expect, it } from 'vitest';
import { sha256Bytes, sha256BytesAuto } from '@/core/firmware/hashes';

describe('sha256BytesAuto', () => {
  it('matches sha256Bytes for small payload', async () => {
    const u = new TextEncoder().encode('hello');
    const a = await sha256BytesAuto(u, 10_000_000);
    const b = await sha256Bytes(u);
    expect(a).toBe(b);
  });
});
