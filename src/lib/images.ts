// SERVER-ONLY. Product thumbnails: normalise with sharp, store in Vercel
// Blob, and fetch remote images safely for the "by URL" flow.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { del, put } from '@vercel/blob';
import sharp from 'sharp';

// Final stored thumbnail: square WebP. 512px is plenty for list rows and
// keeps every image in the tens of KB, so the Hobby Blob quota is never a
// concern at this scale.
const THUMB_SIZE = 512;
const THUMB_QUALITY = 80;

// Images fetched by URL are shrunk before being sent back to the browser
// for cropping — the client only needs enough pixels to choose a crop.
const REMOTE_PREVIEW_MAX = 1600;
const REMOTE_MAX_BYTES = 15 * 1024 * 1024;
const REMOTE_TIMEOUT_MS = 15_000;
const REMOTE_MAX_REDIRECTS = 3;

const BLOB_HOST_SUFFIX = 'blob.vercel-storage.com';

function productPrefix(userId: string): string {
  return `products/${userId}/`;
}

// Only accept URLs that live in our Blob store under this user's prefix,
// so a crafted PUT can't point a product at an arbitrary host or at another
// user's uploads (and so cleanup only ever deletes our own objects).
export function isOwnProductImageUrl(url: string, userId: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) return false;
  return parsed.pathname.startsWith('/' + productPrefix(userId));
}

// Re-encode whatever the client sent (already cropped square) into the
// canonical thumbnail. `rotate()` honours EXIF orientation from phone
// photos; `cover` guards against a non-square input.
export async function processProductImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'centre' })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}

export async function uploadProductImage(userId: string, thumb: Buffer): Promise<string> {
  const blob = await put(`${productPrefix(userId)}${Date.now()}.webp`, thumb, {
    access: 'public',
    contentType: 'image/webp',
    addRandomSuffix: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return blob.url;
}

// Best-effort: a stale thumbnail costs a few KB, a thrown error would fail
// the product write that triggered the cleanup.
export async function deleteProductImage(url: string): Promise<void> {
  if (!url.includes(BLOB_HOST_SUFFIX)) return;
  try {
    await del(url);
  } catch (err) {
    console.warn('[images] failed to delete blob', url, err);
  }
}

// ---------- Fetch-by-URL (SSRF-guarded) ----------

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // IPv4-mapped (::ffff:a.b.c.d)
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

export class RemoteImageError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RemoteImageError('Підтримуються лише http/https посилання');
  }
  const host = url.hostname;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new RemoteImageError('Недопустима адреса');
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new RemoteImageError('Недопустима адреса');
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new RemoteImageError('Не вдалося знайти хост');
  }
  if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
    throw new RemoteImageError('Недопустима адреса');
  }
}

async function readCapped(res: Response, cap: number): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > cap) throw new RemoteImageError('Файл завеликий (макс. 15 МБ)', 413);
  const reader = res.body?.getReader();
  if (!reader) throw new RemoteImageError('Порожня відповідь');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new RemoteImageError('Файл завеликий (макс. 15 МБ)', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// Downloads a remote image with manual redirect handling (every hop is
// re-validated against private ranges), a size cap and a timeout, then
// returns a downscaled WebP the browser can decode and crop.
export async function fetchRemoteImage(rawUrl: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RemoteImageError('Некоректне посилання');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= REMOTE_MAX_REDIRECTS; hop++) {
      await assertPublicHost(url);
      res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Some CDNs refuse requests without a browser-like UA / Accept.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) throw new RemoteImageError('Некоректне перенаправлення', 502);
        url = new URL(loc, url);
        res = null;
        continue;
      }
      break;
    }
    if (!res) throw new RemoteImageError('Забагато перенаправлень', 502);
    if (!res.ok) throw new RemoteImageError(`Сервер відповів ${res.status}`, 502);

    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) {
      throw new RemoteImageError('За посиланням не зображення');
    }
    const raw = await readCapped(res, REMOTE_MAX_BYTES);
    try {
      return await sharp(raw)
        .rotate()
        .resize(REMOTE_PREVIEW_MAX, REMOTE_PREVIEW_MAX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer();
    } catch {
      throw new RemoteImageError('Не вдалося прочитати зображення', 415);
    }
  } catch (err) {
    if (err instanceof RemoteImageError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new RemoteImageError('Час очікування вичерпано', 504);
    }
    throw new RemoteImageError('Не вдалося завантажити зображення', 502);
  } finally {
    clearTimeout(timer);
  }
}
