import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const user = getUserById(auth.userId);
  if (!user) return NextResponse.json(null, { status: 401 });
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}