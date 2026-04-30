import { NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/db';
import { setAuthCookie } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, name, password } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Всі поля обов\'язкові' }, { status: 400 });
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: 'Користувач вже існує' }, { status: 400 });
  }
  const user = createUser(email, name, password);
  await setAuthCookie({ userId: user.id, email: user.email });
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
