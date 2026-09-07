import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { listProducts, setProduct } from '@/lib/db';
import { isProduct } from '@/lib/validators';
import { isOwnProductImageUrl } from '@/lib/images';

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
  if (body.imageUrl !== undefined && !isOwnProductImageUrl(body.imageUrl, auth.userId)) {
    return NextResponse.json({ error: 'imageUrl must point to this user\'s uploads' }, { status: 400 });
  }
  await setProduct(auth.userId, body);
  return NextResponse.json({ ok: true, id: body.id });
}
