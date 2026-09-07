import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { processProductImage, uploadProductImage } from '@/lib/images';

// The client sends an already-cropped square image (≤ ~1 MB after canvas
// export). Vercel functions cap request bodies at 4.5 MB, so anything
// larger is rejected here rather than failing opaquely at the edge.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Очікується multipart/form-data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Поле file відсутнє' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Файл не є зображенням' }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Файл завеликий (макс. 4 МБ)' }, { status: 413 });
  }

  let thumb: Buffer;
  try {
    thumb = await processProductImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: 'Не вдалося обробити зображення' }, { status: 415 });
  }
  try {
    const url = await uploadProductImage(auth.userId, thumb);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[product-image] upload failed', err);
    return NextResponse.json({ error: 'Не вдалося зберегти зображення' }, { status: 502 });
  }
}
