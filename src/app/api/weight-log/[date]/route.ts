import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { setWeightForDate, deleteWeightForDate } from '@/lib/db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Context {
  params: Promise<{ date: string }>;
}

export async function PUT(req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { date } = await ctx.params;
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof body !== 'number' || !Number.isFinite(body) || body <= 0) {
    return NextResponse.json({ error: 'Invalid weight (positive number expected)' }, { status: 400 });
  }
  await setWeightForDate(auth.userId, date, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { date } = await ctx.params;
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  await deleteWeightForDate(auth.userId, date);
  return NextResponse.json({ ok: true });
}
