import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { listProducts, setProduct } from '@/lib/db';
import type { Product } from '@/types';

// Lightweight inline validators — same shape checks as `isProduct` from
// validators.ts but applied to a single Product (creating one) rather
// than a full array. Kept minimal to avoid coupling to validators.ts'
// list-shaped helpers.
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

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(await listProducts(auth.userId));
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
  if (!isProduct(body)) {
    return NextResponse.json({ error: 'Invalid Product shape' }, { status: 400 });
  }
  await setProduct(auth.userId, body);
  return NextResponse.json({ ok: true, id: body.id });
}
