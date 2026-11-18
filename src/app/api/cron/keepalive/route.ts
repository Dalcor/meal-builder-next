import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { keepAlive } from '@/lib/db';

// Called daily by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set
// in the project env. No user cookie here, so this route is excluded from
// the middleware auth redirect and checks the secret itself (fail closed).
function isAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json(null, { status: 401 });
  }
  try {
    const at = await keepAlive();
    return NextResponse.json({ ok: true, at });
  } catch (err) {
    console.error('[cron/keepalive] Upstash write failed', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
