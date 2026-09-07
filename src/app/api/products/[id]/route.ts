import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { getProduct, setProduct, deleteProduct } from '@/lib/db';
import { isProduct } from '@/lib/validators';
import { deleteProductImage, isOwnProductImageUrl } from '@/lib/images';

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
  if (body.imageUrl !== undefined && !isOwnProductImageUrl(body.imageUrl, auth.userId)) {
    return NextResponse.json({ error: 'imageUrl must point to this user\'s uploads' }, { status: 400 });
  }
  const previous = await getProduct(auth.userId, id);
  await setProduct(auth.userId, body);
  // The old thumbnail is orphaned once the product points elsewhere (or
  // nowhere). Best-effort cleanup after the write so a Blob hiccup never
  // fails the save.
  if (previous?.imageUrl && previous.imageUrl !== body.imageUrl) {
    await deleteProductImage(previous.imageUrl);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Context) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });
  const { id } = await ctx.params;
  const previous = await getProduct(auth.userId, id);
  await deleteProduct(auth.userId, id);
  if (previous?.imageUrl) await deleteProductImage(previous.imageUrl);
  return NextResponse.json({ ok: true });
}
