import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { getUserData, saveUserData, type UserData } from '@/lib/db';

export async function GET() {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const data = getUserData(auth.userId);
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const body: UserData = await req.json();
  saveUserData(auth.userId, body);
  return NextResponse.json({ ok: true });
}