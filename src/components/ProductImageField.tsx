import { useEffect, useRef, useState } from 'react';
import ImageCropModal from './ImageCropModal';
import { imageFromDataTransfer, looksLikeHttpUrl } from '../utils/imageCrop';

// What the form will do with the image on save.
export type ImageDraft =
  | { kind: 'unchanged' }
  | { kind: 'new'; blob: Blob; previewUrl: string }
  | { kind: 'removed' };

interface Props {
  currentUrl?: string;
  draft: ImageDraft;
  onChange: (next: ImageDraft) => void;
}

// Object URLs are owned by the form (revoked in its effect cleanup), so
// this field only creates them.
export function releaseDraft(draft: ImageDraft) {
  if (draft.kind === 'new') URL.revokeObjectURL(draft.previewUrl);
}

// Product appearance photo: from a file, the clipboard, or a URL. Every
// source funnels into the same crop step so the result is always square.
export default function ProductImageField({ currentUrl, draft, onChange }: Props) {
  const [cropSource, setCropSource] = useState<Blob | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const previewUrl =
    draft.kind === 'new' ? draft.previewUrl : draft.kind === 'unchanged' ? currentUrl : undefined;

  const startCrop = (blob: Blob) => {
    setMessage(null);
    setCropSource(blob);
  };

  const fetchByUrl = async (raw: string) => {
    const trimmed = raw.trim();
    if (!looksLikeHttpUrl(trimmed)) {
      setMessage('Введіть посилання, що починається з http:// або https://');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/product-image/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage(data?.error || 'Не вдалося завантажити зображення');
        return;
      }
      startCrop(await res.blob());
      setShowUrl(false);
      setUrl('');
    } catch {
      setMessage('Помилка мережі');
    } finally {
      setBusy(false);
    }
  };

  // Explicit "paste" button via the async Clipboard API (needs a user
  // gesture). Falls back to a hint about Ctrl+V, which the form-level
  // onPaste handler below picks up.
  const pasteFromClipboard = async () => {
    setMessage(null);
    if (!navigator.clipboard?.read) {
      setMessage('Натисніть Ctrl+V (⌘V) з фото або посиланням у буфері');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) {
          startCrop(await item.getType(type));
          return;
        }
      }
      for (const item of items) {
        if (item.types.includes('text/plain')) {
          const text = await (await item.getType('text/plain')).text();
          if (looksLikeHttpUrl(text)) {
            await fetchByUrl(text);
            return;
          }
        }
      }
      setMessage('У буфері немає зображення чи посилання');
    } catch {
      setMessage('Немає доступу до буфера — натисніть Ctrl+V (⌘V)');
    }
  };

  // Ctrl+V anywhere in the product form.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Let the URL field handle its own text paste normally.
      if (target?.dataset?.imageUrlInput) return;
      const file = imageFromDataTransfer(e.clipboardData);
      if (file) {
        e.preventDefault();
        startCrop(file);
        return;
      }
      const text = e.clipboardData?.getData('text/plain') ?? '';
      // Only hijack text paste when it's clearly an image link and the
      // user isn't typing into another input.
      if (looksLikeHttpUrl(text) && !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        void fetchByUrl(text);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCropDone = (blob: Blob) => {
    setCropSource(null);
    onChange({ kind: 'new', blob, previewUrl: URL.createObjectURL(blob) });
  };

  const remove = () => {
    onChange(currentUrl ? { kind: 'removed' } : { kind: 'unchanged' });
    setMessage(null);
  };

  const btn =
    'px-2.5 py-1 border rounded text-xs hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60 transition-colors';

  return (
    <div className="flex gap-3 items-start">
      <div className="w-20 h-20 rounded-lg border bg-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-xs text-gray-500">Фото продукту (як виглядає)</div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btn} onClick={() => fileInput.current?.click()} disabled={busy}>
            Файл
          </button>
          <button type="button" className={btn} onClick={pasteFromClipboard} disabled={busy}>
            Вставити
          </button>
          <button
            type="button"
            className={`${btn} ${showUrl ? 'bg-gray-100' : ''}`}
            onClick={() => setShowUrl(v => !v)}
            disabled={busy}
          >
            За посиланням
          </button>
          {previewUrl && (
            <button type="button" className={`${btn} text-red-600`} onClick={remove} disabled={busy}>
              Прибрати
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) startCrop(f);
          }}
        />
        {showUrl && (
          <div className="flex gap-1.5">
            <input
              type="url"
              data-image-url-input="1"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void fetchByUrl(url);
                }
              }}
              placeholder="https://…/photo.jpg"
              className="flex-1 min-w-0 px-2 py-1 border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <button
              type="button"
              className={`${btn} bg-blue-500 text-white border-blue-500 hover:bg-blue-600`}
              onClick={() => void fetchByUrl(url)}
              disabled={busy || !url.trim()}
            >
              {busy ? '…' : 'Завантажити'}
            </button>
          </div>
        )}
        {message && <p className="text-xs text-red-600">{message}</p>}
      </div>

      {cropSource && (
        <ImageCropModal
          source={cropSource}
          onDone={onCropDone}
          onCancel={() => setCropSource(null)}
        />
      )}
    </div>
  );
}
