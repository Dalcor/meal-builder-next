import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { readSlice, writeSlice } from '@/lib/db';
import { isWeightLog } from '@/lib/validators';

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(await readSlice(auth.userId, 'weightLog'));
}

export async function PUT(req: Request) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isWeightLog(body)) {
    return NextResponse.json({ error: 'Invalid shape: expected Record<string, number>' }, { status: 400 });
  }
  await writeSlice(auth.userId, 'weightLog', body);
  return NextResponse.json({ ok: true });
}
