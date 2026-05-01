import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { setMealsForDate, deleteMealsForDate } from '@/lib/db';
import type { Meals, MealType } from '@/types';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
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
    if (s.unit !== undefined) {
      if (!isObj(s.unit)) return false;
      if (!isNum(s.unit.gramsPerUnit) || s.unit.gramsPerUnit <= 0) return false;
      if (s.unit.label !== undefined && !isStr(s.unit.label)) return false;
    }
  }
  return true;
}
function isMeals(v: unknown): v is Meals {
  if (!isObj(v)) return false;
  for (const t of MEAL_TYPES) {
    const arr = v[t];
    if (!Array.isArray(arr) || !arr.every(isMealItem)) return false;
  }
  return true;
}

// Date format: YYYY-MM-DD
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Context {
  params: Promise<{ date: string }>;
}

export async function PUT(req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { date } = await ctx.params;
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD expected)' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isMeals(body)) {
    return NextResponse.json({ error: 'Invalid Meals shape' }, { status: 400 });
  }
  await setMealsForDate(auth.userId, date, body);
  // Suppress the "isBool unused" warning
  void isBool;
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { date } = await ctx.params;
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  await deleteMealsForDate(auth.userId, date);
  return NextResponse.json({ ok: true });
}
