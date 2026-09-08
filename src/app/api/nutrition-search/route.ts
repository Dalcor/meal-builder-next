import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { searchNutrition, NutritionSourceError, type NutritionSource } from '@/lib/nutritionSources';

const MAX_QUERY = 100;

export async function GET(req: Request) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });

  const params = new URL(req.url).searchParams;
  const q = params.get('q')?.trim() ?? '';
  const source = params.get('source');
  if (source !== 'silpo' && source !== 'tablycja') {
    return NextResponse.json({ error: 'Невідоме джерело' }, { status: 400 });
  }
  if (!q) return NextResponse.json({ error: 'Порожній запит' }, { status: 400 });
  if (q.length > MAX_QUERY) return NextResponse.json({ error: 'Запит задовгий' }, { status: 400 });

  try {
    return NextResponse.json({ hits: await searchNutrition(source as NutritionSource, q) });
  } catch (err) {
    if (err instanceof NutritionSourceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[nutrition-search] unexpected', err);
    return NextResponse.json({ error: 'Пошук не вдався' }, { status: 502 });
  }
}
