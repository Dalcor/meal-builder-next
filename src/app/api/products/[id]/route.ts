import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { setProduct, deleteProduct } from '@/lib/db';
import type { Product } from '@/types';

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isProduct(v: unknown): v is Product {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !isStr(v.name)) return false;
  if (!isNum(v.calories) || !isNum(v.protein) || !isNum(v.fat) || !isNum(v.carbs)) return false;
  if (v.unit !== undefined) {
    if (!isObj(v.unit)) return false;
    if (!isNum(v.unit.gramsPerUnit) || v.unit.gramsPerUnit <= 0) return false;
    if (v.unit.label !== undefined && !isStr(v.unit.label)) return false;
  }
  if (v.fixedPortion !== undefined && typeof v.fixedPortion !== 'boolean') return false;
  if (v.category !== undefined && !isStr(v.category)) return false;
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
  if (!isProduct(body)) {
    return NextResponse.json({ error: 'Invalid Product shape' }, { status: 400 });
  }
  if (body.id !== id) {
    return NextResponse.json({ error: 'Body id must match URL id' }, { status: 400 });
  }
  await setProduct(auth.userId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { id } = await ctx.params;
  await deleteProduct(auth.userId, id);
  return NextResponse.json({ ok: true });
}
