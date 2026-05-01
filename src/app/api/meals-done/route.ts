import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { readSlice, writeSlice } from '@/lib/db';
import { isMealsDone } from '@/lib/validators';

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(await readSlice(auth.userId, 'mealsDone'));
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
  if (!isMealsDone(body)) {
    return NextResponse.json({ error: 'Invalid shape: expected mealsDone record' }, { status: 400 });
  }
  await writeSlice(auth.userId, 'mealsDone', body);
  return NextResponse.json({ ok: true });
}
