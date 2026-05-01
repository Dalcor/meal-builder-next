import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { readSlice, writeSlice } from '@/lib/db';
import { isMealTargets } from '@/lib/validators';

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(readSlice(auth.userId, 'targets'));
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
  if (!isMealTargets(body)) {
    return NextResponse.json({ error: 'Invalid shape: expected MealTargets' }, { status: 400 });
  }
  writeSlice(auth.userId, 'targets', body);
  return NextResponse.json({ ok: true });
}
