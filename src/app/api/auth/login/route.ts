import { NextResponse } from 'next/server';
import { getUserByEmail, verifyPassword } from '@/lib/db';
import { setAuthCookie } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(user, password)) {
    return NextResponse.json({ error: 'Невірний email або пароль' }, { status: 401 });
  }
  await setAuthCookie({ userId: user.id, email: user.email });
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
