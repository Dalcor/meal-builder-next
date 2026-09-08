import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { searchSilpo, SilpoError } from '@/lib/silpo';

const MAX_QUERY = 100;

export async function GET(req: Request) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ error: 'Порожній запит' }, { status: 400 });
  if (q.length > MAX_QUERY) return NextResponse.json({ error: 'Запит задовгий' }, { status: 400 });

  try {
    return NextResponse.json({ hits: await searchSilpo(q) });
  } catch (err) {
    if (err instanceof SilpoError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[product-image/silpo] unexpected', err);
    return NextResponse.json({ error: 'Пошук у Сільпо не вдався' }, { status: 502 });
  }
}
