import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { listMealsDone } from '@/lib/db';

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(await listMealsDone(auth.userId));
}
