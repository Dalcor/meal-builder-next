import { useEffect, useRef, useState } from 'react';
import DrawerHandle from './DrawerHandle';

interface Hit {
  id: string;
  title: string;
  brand?: string;
  thumbUrl: string;
  imageUrl: string;
}

interface Props {
  initialQuery: string;
  busy?: boolean;
  onPick: (imageUrl: string) => void;
  onCancel: () => void;
}

// Search silpo.ua for a product and pick one of its photos. The chosen
// 800px image then goes through the usual fetch → crop → upload path.
export default function SilpoImagePicker({ initialQuery, busy = false, onPick, onCancel }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const search = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/product-image/silpo?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => null);
      if (id !== requestId.current) return; // stale response
      if (!res.ok) {
        setError(data?.error || 'Пошук не вдався');
        setHits([]);
        return;
      }
      setHits(Array.isArray(data?.hits) ? data.hits : []);
    } catch {
      if (id === requestId.current) setError('Помилка мережі');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // Auto-search with the product name on open (deferred so the effect body
  // itself doesn't set state).
  useEffect(() => {
    if (!initialQuery.trim()) return;
    const t = setTimeout(() => void search(initialQuery), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-[520px] sm:max-w-[95vw] max-h-[85svh] sm:max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <DrawerHandle onClose={onCancel} />
        <div className="p-4 border-b space-y-2">
          <h2 className="font-semibold">Фото з Сільпо</h2>
          {/* Not a <form>: this modal renders inside the product form, and a
              nested form's submit button would submit the outer one. */}
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void search(query);
                }
              }}
              placeholder="Назва товару"
              className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void search(query)}
              disabled={loading || !query.trim()}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-60 transition-colors"
            >
              Шукати
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          {loading && <p className="text-sm text-gray-400 text-center py-6">Шукаю…</p>}
          {!loading && hits && hits.length === 0 && !error && (
            <p className="text-sm text-gray-400 text-center py-6">Нічого не знайдено</p>
          )}
          {!loading && hits && hits.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {hits.map(h => (
                <button
                  key={h.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(h.imageUrl)}
                  title={h.title}
                  className="text-left rounded-lg border hover:border-blue-400 hover:shadow-sm active:bg-gray-50 disabled:opacity-60 transition-all overflow-hidden"
                >
                  <div className="aspect-square bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={h.thumbUrl} alt="" loading="lazy" className="w-full h-full object-contain" />
                  </div>
                  <div className="px-1.5 py-1">
                    <div className="text-[11px] leading-tight text-gray-700 line-clamp-2">{h.title}</div>
                    {h.brand && <div className="text-[10px] text-gray-400 truncate">{h.brand}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {!hits && !loading && !error && (
            <p className="text-sm text-gray-400 text-center py-6">Введіть назву і натисніть «Шукати»</p>
          )}
        </div>

        <div className="p-3 border-t flex justify-between items-center">
          <span className="text-[11px] text-gray-400">Зображення з сайту silpo.ua</span>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {busy ? 'Завантажую…' : 'Закрити'}
          </button>
        </div>
      </div>
    </div>
  );
}
