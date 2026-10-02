import 'server-only';
import { NextRequest } from 'next/server';
export function sameOrigin(request: NextRequest) {
  const expected = process.env.NEXT_PUBLIC_APP_URL;
  return !!expected && request.headers.get('origin') === new URL(expected).origin;
}
export async function readBody(request: NextRequest, limit: number) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('JSON_REQUIRED');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('BODY_REQUIRED');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); } chunks.push(value); }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(result));
  } finally { reader.releaseLock(); }
}
