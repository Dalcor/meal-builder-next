import { useState, useRef, useEffect } from 'react';
import { presetCategories } from '../data/presets';
import type { Product } from '../types';

interface Props {
  onAdd: (product: Omit<Product, 'id'>) => void;
}

export default function ProductCatalog({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const query = search.toLowerCase().trim();

  const filtered = query
    ? presetCategories
        .map(cat => ({
          ...cat,
          items: cat.items.filter(p => p.name.toLowerCase().includes(query)),
        }))
        .filter(cat => cat.items.length > 0)
    : presetCategories;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2 px-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium hover:bg-green-100 transition-colors"
      >
        Каталог продуктів
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-[480px] max-w-[95vw] max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-lg">Каталог продуктів</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Пошук..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Нічого не знайдено</p>
              ) : (
                filtered.map(cat => {
                  const isExpanded = query.length > 0 || expandedCategory === cat.name;
                  return (
                    <div key={cat.name} className="mb-1">
                      <button
                        onClick={() => setExpandedCategory(isExpanded && !query ? null : cat.name)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <span>{cat.name} ({cat.items.length})</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="ml-1 space-y-0.5">
                          {cat.items.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-50 group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{item.name}</div>
                                <div className="text-xs text-gray-400">
                                  {item.calories} ккал | Б {item.protein} | Ж {item.fat} | В {item.carbs}
                                </div>
                              </div>
                              <button
                                onClick={() => onAdd(item)}
                                className="ml-2 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                              >
                                + Додати
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
