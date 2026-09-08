import { useEffect, useRef, useState } from 'react';
import DrawerHandle from './DrawerHandle';

type Source = 'silpo' | 'tablycja';

export interface NutritionPick {
  title: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  imageUrl?: string;
}

interface Hit extends NutritionPick {
  source: Source;
  id: string;
  brand?: string;
  thumbUrl?: string;
}

interface Props {
  initialQuery: string;
  onPick: (hit: NutritionPick) => void;
  onCancel: () => void;
}

const SOURCES: { key: Source; label: string; hint: string }[] = [
  { key: 'silpo', label: 'Сільпо', hint: 'Показуються лише товари, де на сайті вказана харчова цінність.' },
  { key: 'tablycja', label: 'Таблиця калорійності', hint: 'tablycjakalorijnosti.com.ua — узагальнені значення на 100 г.' },
];

// Search an external catalogue for per-100g nutrition and hand the chosen
// values to the product form. Deliberately separate from the photo picker:
// the user chooses what to import.
export default function NutritionImportModal({ initialQuery, onPick, onCancel }: Props) {
  const [source, setSource] = useState<Source>('silpo');
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const search = async (src: Source, q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nutrition-search?source=${src}&q=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => null);
      if (id !== requestId.current) return;
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

  useEffect(() => {
    if (!initialQuery.trim()) return;
    const t = setTimeout(() => void search('silpo', initialQuery), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchSource = (src: Source) => {
    if (src === source) return;
    setSource(src);
    setHits(null);
    void search(src, query);
  };

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-[560px] sm:max-w-[95vw] max-h-[85svh] sm:max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <DrawerHandle onClose={onCancel} />
        <div className="p-4 border-b space-y-3">
          <h2 className="font-semibold">Імпорт КБЖВ</h2>
          <div className="flex border rounded-lg overflow-hidden text-xs" role="tablist">
            {SOURCES.map(s => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={source === s.key}
                onClick={() => switchSource(s.key)}
                className={`flex-1 px-3 py-1.5 transition-colors ${
                  source === s.key ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void search(source, query);
                }
              }}
              placeholder="Назва продукту"
              className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void search(source, query)}
              disabled={loading || !query.trim()}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-60 transition-colors"
            >
              Шукати
            </button>
          </div>
          <p className="text-[11px] text-gray-400">{SOURCES.find(s => s.key === source)?.hint}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="text-sm text-red-600 mb-2 px-1">{error}</p>}
          {loading && <p className="text-sm text-gray-400 text-center py-6">Шукаю…</p>}
          {!loading && hits && hits.length === 0 && !error && (
            <p className="text-sm text-gray-400 text-center py-6">Нічого з харчовою цінністю не знайдено</p>
          )}
          {!loading && hits && hits.length > 0 && (
            <div className="space-y-1">
              {hits.map(h => (
                <button
                  key={`${h.source}:${h.id}`}
                  type="button"
                  onClick={() => onPick(h)}
                  className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="w-12 h-12 rounded-md bg-gray-50 border overflow-hidden flex-shrink-0">
                    {h.thumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.thumbUrl} alt="" loading="lazy" className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{h.title}</div>
                    {h.brand && <div className="text-[11px] text-gray-400 truncate">{h.brand}</div>}
                    <div className="text-xs text-gray-500">
                      {fmt(h.calories)} ккал | Б {fmt(h.protein)} | Ж {fmt(h.fat)} | В {fmt(h.carbs)}
                      <span className="text-gray-400"> / 100 г</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!hits && !loading && !error && (
            <p className="text-sm text-gray-400 text-center py-6">Введіть назву і натисніть «Шукати»</p>
          )}
        </div>

        <div className="p-3 border-t flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
