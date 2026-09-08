// SERVER-ONLY. Product image lookup on silpo.ua via the public storefront
// API their SPA uses (no auth). We only relay title + image URLs; the
// image itself is then pulled through fetchRemoteImage for cropping.

const SEARCH_URL =
  'https://sf-ecom-api.silpo.ua/v1/uk/branches/00000000-0000-0000-0000-000000000000/products';
const IMAGE_BASE = 'https://images.silpo.ua/v2/products';
const TIMEOUT_MS = 12_000;
const LIMIT = 16;

export interface SilpoHit {
  id: string;
  title: string;
  brand?: string;
  // 300px preview for the picker grid; 800px source for the crop step.
  thumbUrl: string;
  imageUrl: string;
}

interface SilpoItem {
  id?: unknown;
  title?: unknown;
  brandTitle?: unknown;
  icon?: unknown;
}

export class SilpoError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export async function searchSilpo(query: string): Promise<SilpoHit[]> {
  const params = new URLSearchParams({
    limit: String(LIMIT),
    offset: '0',
    deliveryType: 'DeliveryHome',
    includeChildCategories: 'true',
    sortBy: 'productsList',
    sortDirection: 'desc',
    inStock: 'false',
    search: query,
  });
  let res: Response;
  try {
    res = await fetch(`${SEARCH_URL}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'uk',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
      },
    });
  } catch (err) {
    if ((err as Error).name === 'TimeoutError') throw new SilpoError('Сільпо не відповідає', 504);
    throw new SilpoError('Не вдалося зв\'язатися з Сільпо');
  }
  if (!res.ok) throw new SilpoError(`Сільпо відповіло ${res.status}`);

  let data: { items?: unknown };
  try {
    data = (await res.json()) as { items?: unknown };
  } catch {
    throw new SilpoError('Несподівана відповідь від Сільпо');
  }
  const items = Array.isArray(data.items) ? (data.items as SilpoItem[]) : [];
  const hits: SilpoHit[] = [];
  for (const it of items) {
    if (typeof it.id !== 'string' || typeof it.title !== 'string' || typeof it.icon !== 'string') continue;
    // `icon` is a bare file name like "<uuid>.png"; never let a path escape the images host.
    if (!/^[\w.-]+$/.test(it.icon)) continue;
    hits.push({
      id: it.id,
      title: it.title,
      brand: typeof it.brandTitle === 'string' && it.brandTitle ? it.brandTitle : undefined,
      thumbUrl: `${IMAGE_BASE}/300x300/webp/${it.icon}`,
      imageUrl: `${IMAGE_BASE}/800x800/webp/${it.icon}`,
    });
  }
  return hits;
}
