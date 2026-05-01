import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { setMealPreset, deleteMealPreset } from '@/lib/db';
import type { MealPreset } from '@/types';

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isMealItem(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (
    !isStr(v.id) ||
    !(v.sourceType === 'product' || v.sourceType === 'dish') ||
    !isStr(v.sourceId) ||
    !isNum(v.grams)
  ) {
    return false;
  }
  if (v.snapshot !== undefined) {
    if (!isObj(v.snapshot)) return false;
    const s = v.snapshot as Record<string, unknown>;
    if (!isStr(s.name) || !isNum(s.calories) || !isNum(s.protein) || !isNum(s.fat) || !isNum(s.carbs)) return false;
  }
  return true;
}
function isMealPreset(v: unknown): v is MealPreset {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !isStr(v.name)) return false;
  return Array.isArray(v.items) && v.items.every(isMealItem);
}

interface Context {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isMealPreset(body)) {
    return NextResponse.json({ error: 'Invalid MealPreset shape' }, { status: 400 });
  }
  if (body.id !== id) {
    return NextResponse.json({ error: 'Body id must match URL id' }, { status: 400 });
  }
  await setMealPreset(auth.userId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { id } = await ctx.params;
  await deleteMealPreset(auth.userId, id);
  return NextResponse.json({ ok: true });
}
