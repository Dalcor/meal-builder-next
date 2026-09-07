import { NextResponse } from 'next/server';
import { getAuthFromCookie } from '@/lib/auth';
import { fetchRemoteImage, RemoteImageError } from '@/lib/images';

// Proxies a remote image so the browser can crop it: most image hosts
// don't send CORS headers, which would taint the canvas client-side.
export async function POST(req: Request) {
  const auth = await getAuthFromCookie();
  if (!auth) return NextResponse.json(null, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const url = (body as { url?: unknown })?.url;
  if (typeof url !== 'string' || url.length > 2048) {
    return NextResponse.json({ error: 'Очікується поле url' }, { status: 400 });
  }

  try {
    const image = await fetchRemoteImage(url);
    return new NextResponse(new Uint8Array(image), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof RemoteImageError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[product-image/fetch] unexpected', err);
    return NextResponse.json({ error: 'Не вдалося завантажити зображення' }, { status: 502 });
  }
}
