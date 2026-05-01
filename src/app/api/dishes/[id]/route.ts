import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { setDish, deleteDish } from '@/lib/db';
import type { Dish } from '@/types';

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isDishIngredient(v: unknown): boolean {
  if (!isObj(v)) return false;
  return isStr(v.productId) && isNum(v.grams);
}
function isDish(v: unknown): v is Dish {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !isStr(v.name)) return false;
  if (!Array.isArray(v.ingredients) || !v.ingredients.every(isDishIngredient)) return false;
  if (v.fixedPortion !== undefined && !isBool(v.fixedPortion)) return false;
  return true;
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
  if (!isDish(body)) {
    return NextResponse.json({ error: 'Invalid Dish shape' }, { status: 400 });
  }
  if (body.id !== id) {
    return NextResponse.json({ error: 'Body id must match URL id' }, { status: 400 });
  }
  await setDish(auth.userId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { id } = await ctx.params;
  await deleteDish(auth.userId, id);
  return NextResponse.json({ ok: true });
}
