// Client-side helpers for the product thumbnail flow. The browser picks a
// square crop; the server re-encodes to the final 512px WebP.

// Output edge for the exported crop. Larger than the stored 512px so the
// server has headroom, small enough that the upload stays ~100–300 KB.
const EXPORT_MAX = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не вдалося прочитати зображення'));
    img.src = src;
  });
}

// `area` comes from react-easy-crop's onCropComplete in natural pixels.
// With aspect 1 it is square already; `size` guards against rounding.
export async function exportSquareCrop(
  src: string,
  area: { x: number; y: number; width: number; height: number },
): Promise<Blob> {
  const img = await loadImage(src);
  const size = Math.min(area.width, area.height);
  const out = Math.max(1, Math.min(EXPORT_MAX, Math.round(size)));
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступний');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, area.x, area.y, size, size, 0, 0, out, out);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (blob && blob.type === 'image/webp') return blob;
  // Safari < 16 has no WebP encoder — JPEG is fine, the server re-encodes.
  const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!jpeg) throw new Error('Не вдалося експортувати зображення');
  return jpeg;
}

// Best-effort image extraction from a paste event / clipboard read.
export function imageFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const file of Array.from(dt.files)) {
    if (file.type.startsWith('image/')) return file;
  }
  for (const item of Array.from(dt.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

export function looksLikeHttpUrl(text: string): boolean {
  const t = text.trim();
  if (!/^https?:\/\/\S+$/i.test(t)) return false;
  try {
    new URL(t);
    return true;
  } catch {
    return false;
  }
}
