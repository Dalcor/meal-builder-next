import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { listDishes, setDish } from '@/lib/db';
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
  if (v.cookedWeight !== undefined) {
    if (!isNum(v.cookedWeight) || v.cookedWeight <= 0) return false;
  }
  return true;
}

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(await listDishes(auth.userId));
}

export async function POST(req: Request) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isDish(body)) {
    return NextResponse.json({ error: 'Invalid Dish shape' }, { status: 400 });
  }
  await setDish(auth.userId, body);
  return NextResponse.json({ ok: true, id: body.id });
}
