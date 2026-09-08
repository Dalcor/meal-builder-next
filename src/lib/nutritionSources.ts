// SERVER-ONLY. Look up per-100g nutrition for a product name in external
// catalogues. Both sources are unofficial (the endpoints their own sites
// use), so every parser is defensive and returns [] rather than throwing
// on shape changes. Results are normalised to the app's Product fields.

import { SilpoError } from './silpo';

export type NutritionSource = 'silpo' | 'tablycja';

export interface NutritionHit {
  source: NutritionSource;
  id: string;
  title: string;
  brand?: string;
  thumbUrl?: string;
  // Full-size photo (Silpo 800px, tablycja original ~640px).
  imageUrl?: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const TIMEOUT_MS = 12_000;
// How many candidates get a per-item detail request. Both sources need a
// second fetch per hit for the macros, so this bounds fan-out per search.
const DETAIL_LIMIT = 8;

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: accept, 'Accept-Language': 'uk', 'User-Agent': UA },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

// ---------- Silpo ----------

const SILPO_DETAILS =
  'https://sf-ecom-api.silpo.ua/v1/uk/branches/00000000-0000-0000-0000-000000000000/products/';

interface SilpoAttr {
  attribute?: { key?: unknown };
  value?: { title?: unknown; key?: unknown };
}
interface SilpoDetails {
  attributeGroups?: { key?: unknown; attributes?: SilpoAttr[] }[];
}

async function silpoNutrition(slug: string): Promise<Pick<NutritionHit, 'calories' | 'protein' | 'fat' | 'carbs'> | null> {
  const res = await fetchWithTimeout(SILPO_DETAILS + encodeURIComponent(slug), 'application/json');
  if (!res) return null;
  let d: SilpoDetails;
  try {
    d = (await res.json()) as SilpoDetails;
  } catch {
    return null;
  }
  const group = d.attributeGroups?.find(g => g.key === 'nutrient');
  if (!group?.attributes) return null;
  const byKey = new Map<string, unknown>();
  for (const a of group.attributes) {
    const k = a.attribute?.key;
    if (typeof k === 'string') byKey.set(k, a.value?.title ?? a.value?.key);
  }
  // "329/1377" = kcal/kJ — the first number is what we store.
  const calories = num(byKey.get('calorie'));
  const protein = num(byKey.get('proteins'));
  const fat = num(byKey.get('fats'));
  const carbs = num(byKey.get('carbohydrates'));
  if (calories === null) return null;
  return { calories, protein: protein ?? 0, fat: fat ?? 0, carbs: carbs ?? 0 };
}

async function searchSilpoNutrition(query: string): Promise<NutritionHit[]> {
  // Same storefront search as searchSilpo(), but we need the slug here
  // for the per-item details call, so query it directly.
  const params = new URLSearchParams({
    limit: String(DETAIL_LIMIT),
    offset: '0',
    deliveryType: 'DeliveryHome',
    includeChildCategories: 'true',
    sortBy: 'productsList',
    sortDirection: 'desc',
    inStock: 'false',
    search: query,
  });
  const res = await fetchWithTimeout(
    `https://sf-ecom-api.silpo.ua/v1/uk/branches/00000000-0000-0000-0000-000000000000/products?${params}`,
    'application/json',
  );
  if (!res) throw new SilpoError('Сільпо не відповідає', 504);
  let data: { items?: unknown };
  try {
    data = (await res.json()) as { items?: unknown };
  } catch {
    return [];
  }
  const items = (Array.isArray(data.items) ? data.items : []) as {
    id?: unknown; title?: unknown; slug?: unknown; icon?: unknown; brandTitle?: unknown;
  }[];
  const candidates = items.filter(
    it => typeof it.id === 'string' && typeof it.title === 'string' && typeof it.slug === 'string',
  );
  const details = await Promise.all(candidates.map(it => silpoNutrition(it.slug as string)));
  const hits: NutritionHit[] = [];
  candidates.forEach((it, i) => {
    const n = details[i];
    if (!n) return;
    const icon = typeof it.icon === 'string' && /^[\w.-]+$/.test(it.icon) ? it.icon : null;
    hits.push({
      source: 'silpo',
      id: it.id as string,
      title: it.title as string,
      brand: typeof it.brandTitle === 'string' && it.brandTitle ? it.brandTitle : undefined,
      thumbUrl: icon ? `https://images.silpo.ua/v2/products/300x300/webp/${icon}` : undefined,
      imageUrl: icon ? `https://images.silpo.ua/v2/products/800x800/webp/${icon}` : undefined,
      ...n,
    });
  });
  return hits;
}

// ---------- tablycjakalorijnosti.com.ua ----------

const TK_BASE = 'https://www.tablycjakalorijnosti.com.ua';

interface TkSuggestion {
  clazz?: unknown;
  id?: unknown;
  url?: unknown;
  title?: unknown;
  value?: unknown;
  hasImage?: unknown;
  brandName?: unknown;
}

// The product page is an AngularJS template with server-rendered fallback
// values; the JSON-LD "keywords" list is the most stable place to read
// the macros from ("Білки : 3.38 г", …). kcal comes from the autocomplete.
function parseTkMacros(html: string): { protein: number; fat: number; carbs: number } | null {
  const pick = (label: string): number | null => {
    const m = html.match(new RegExp(`"${label}\\s*:\\s*(-?\\d+(?:[.,]\\d+)?)\\s*г`));
    return m ? num(m[1]) : null;
  };
  const protein = pick('Білки');
  const fat = pick('Жири');
  const carbs = pick('Вуглеводи');
  if (protein === null && fat === null && carbs === null) return null;
  return { protein: protein ?? 0, fat: fat ?? 0, carbs: carbs ?? 0 };
}

async function searchTablycja(query: string): Promise<NutritionHit[]> {
  const res = await fetchWithTimeout(
    `${TK_BASE}/autocomplete/foodstuff-activity-meal?query=${encodeURIComponent(query)}&format=json`,
    'application/json',
  );
  if (!res) throw new SilpoError('Таблиця калорійності не відповідає', 504);
  let list: unknown;
  try {
    list = await res.json();
  } catch {
    return [];
  }
  const candidates = (Array.isArray(list) ? (list as TkSuggestion[]) : [])
    .filter(
      s =>
        s.clazz === 'foodstuff' &&
        typeof s.id === 'string' &&
        typeof s.url === 'string' &&
        /^[\w-]+$/.test(s.url) &&
        typeof s.title === 'string' &&
        num(s.value) !== null,
    )
    .slice(0, DETAIL_LIMIT);
  const pages = await Promise.all(
    candidates.map(async s => {
      const r = await fetchWithTimeout(`${TK_BASE}/foodstuff/${s.url}`, 'text/html');
      if (!r) return null;
      try {
        return parseTkMacros(await r.text());
      } catch {
        return null;
      }
    }),
  );
  const hits: NutritionHit[] = [];
  candidates.forEach((s, i) => {
    const m = pages[i];
    if (!m) return;
    hits.push({
      source: 'tablycja',
      id: s.id as string,
      title: s.title as string,
      brand: typeof s.brandName === 'string' && s.brandName ? s.brandName : undefined,
      thumbUrl: s.hasImage ? `${TK_BASE}/file/image/thumb/foodstuff/${s.id}` : undefined,
      imageUrl: s.hasImage ? `${TK_BASE}/file/image/foodstuff/${s.id}` : undefined,
      calories: num(s.value)!,
      ...m,
    });
  });
  return hits;
}

export async function searchNutrition(source: NutritionSource, query: string): Promise<NutritionHit[]> {
  return source === 'silpo' ? searchSilpoNutrition(query) : searchTablycja(query);
}

export { SilpoError as NutritionSourceError };
