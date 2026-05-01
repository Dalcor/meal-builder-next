import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { setMealsDoneForDate, deleteMealsDoneForDate } from '@/lib/db';
import type { MealType } from '@/types';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isMealsDoneFlags(v: unknown): boolean {
  if (!isObj(v)) return false;
  for (const [k, val] of Object.entries(v)) {
    if (!MEAL_TYPES.includes(k as MealType)) return false;
    if (val !== undefined && typeof val !== 'boolean') return false;
  }
  return true;
}

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
  if (!isMealsDoneFlags(body)) {
    return NextResponse.json({ error: 'Invalid mealsDone flags shape' }, { status: 400 });
  }
  await setMealsDoneForDate(auth.userId, date, body as Partial<Record<MealType, boolean>>);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { date } = await ctx.params;
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  await deleteMealsDoneForDate(auth.userId, date);
  return NextResponse.json({ ok: true });
}
