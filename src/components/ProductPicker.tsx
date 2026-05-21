import { useMemo, useState } from 'react';
import type { Product } from '../types';

interface Props {
  products: Product[];
  onPick: (productId: string) => void;
  // Hide already-used products (e.g. ingredients already in the dish).
  excludedIds?: string[];
  // Show these products on top under "★ Закріплені" and mark them with a stripe.
  pinnedIds?: string[];
  autoFocus?: boolean;
  emptyText?: string;
  // Tailwind classes for the scrollable list container — controls height
  // because the picker lives inside containers of different sizes.
  listClassName?: string;
  searchPlaceholder?: string;
}

const NO_CATEGORY = 'Без категорії';
const PINNED_GROUP = '★ Закріплені';
const SEARCH_GROUP = 'Результати';

type Group = { name: string; items: Product[] };

export default function ProductPicker({
  products,
  onPick,
  excludedIds,
  pinnedIds,
  autoFocus,
  emptyText,
  listClassName,
  searchPlaceholder,
}: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const query = search.toLowerCase().trim();

  const excludedSet = useMemo(() => new Set(excludedIds ?? []), [excludedIds]);
  const pinnedSet = useMemo(() => new Set(pinnedIds ?? []), [pinnedIds]);

  const available = useMemo(
    () => products.filter(p => !excludedSet.has(p.id)),
    [products, excludedSet],
  );

  const groups = useMemo<Group[]>(() => {
    if (query) {
      const flat = available.filter(p => p.name.toLowerCase().includes(query));
      flat.sort((a, b) => {
        const ap = pinnedSet.has(a.id);
        const bp = pinnedSet.has(b.id);
        if (ap && !bp) return -1;
        if (!ap && bp) return 1;
        return a.name.localeCompare(b.name, 'uk');
      });
      return [{ name: SEARCH_GROUP, items: flat }];
    }
    const pinned = available.filter(p => pinnedSet.has(p.id));
    const rest = available.filter(p => !pinnedSet.has(p.id));
    const byCat = new Map<string, Product[]>();
    for (const p of rest) {
      const cat = p.category?.trim() || NO_CATEGORY;
      const arr = byCat.get(cat);
      if (arr) arr.push(p);
      else byCat.set(cat, [p]);
    }
    const result: Group[] = [];
    if (pinned.length > 0) result.push({ name: PINNED_GROUP, items: pinned });
    const keys = [...byCat.keys()].sort((a, b) => {
      if (a === NO_CATEGORY) return 1;
      if (b === NO_CATEGORY) return -1;
      return a.localeCompare(b, 'uk');
    });
    for (const k of keys) {
      const items = byCat.get(k)!.slice().sort((a, b) => a.name.localeCompare(b.name, 'uk'));
      result.push({ name: k, items });
    }
    return result;
  }, [available, pinnedSet, query]);

  const toggle = (name: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex flex-col min-h-0">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={searchPlaceholder ?? 'Пошук продукту…'}
          className="w-full pl-9 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus={autoFocus}
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.817-4.817A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            aria-label="Очистити пошук"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      <div className={`mt-2 overflow-y-auto ${listClassName ?? 'max-h-72'}`}>
        {totalItems === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {query ? 'Нічого не знайдено' : emptyText ?? 'Немає продуктів'}
          </p>
        ) : (
          <div className="space-y-1">
            {groups.map(group => {
              const isFlat = group.name === SEARCH_GROUP;
              const isCollapsed = !isFlat && collapsed.has(group.name);
              return (
                <div key={group.name} className="space-y-1">
                  {!isFlat && (
                    <button
                      type="button"
                      onClick={() => toggle(group.name)}
                      className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors sticky top-0 bg-white z-10"
                    >
                      <span className="truncate">
                        {group.name}{' '}
                        <span className="text-gray-400 font-normal">
                          ({group.items.length})
                        </span>
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-3.5 w-3.5 text-gray-400 flex-shrink-0 transition-transform ${
                          isCollapsed ? '' : 'rotate-180'
                        }`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                  {!isCollapsed && (
                    <div className="space-y-1 pt-0.5 pl-1">
                      {group.items.map(p => {
                        const pinned = pinnedSet.has(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onPick(p.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg active:bg-gray-100 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors ${
                              pinned ? 'border-l-2 border-l-amber-400' : ''
                            }`}
                          >
                            <div className="font-medium text-sm truncate">{p.name}</div>
                            <div className="text-xs text-gray-500">
                              {p.calories} ккал | Б {p.protein} | Ж {p.fat} | В {p.carbs}
                              {p.unit && (
                                <span className="text-amber-600">
                                  {' · 1 '}{p.unit.label ?? 'шт'} = {p.unit.gramsPerUnit}г
                                  {p.fixedPortion ? ' (фікс.)' : ''}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
