import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { addPin, removePin } from '@/lib/db';

interface Context {
  params: Promise<{ id: string }>;
}

export async function PUT(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await addPin(auth.userId, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await removePin(auth.userId, id);
  return NextResponse.json({ ok: true });
}
