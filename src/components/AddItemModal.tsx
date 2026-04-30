import { useState, useMemo } from 'react';
import type { Product, Dish, MealType } from '../types';
import { getDishNutrients, getDishTotalWeight } from '../utils/nutrients';

interface Props {
  mealType: MealType;
  mealLabel: string;
  products: Product[];
  dishes: Dish[];
  pinnedIds: string[];
  onPick: (sourceType: 'product' | 'dish', sourceId: string) => void;
  onCancel: () => void;
}

type Tab = 'product' | 'dish';

export default function AddItemModal({
  mealLabel,
  products,
  dishes,
  pinnedIds,
  onPick,
  onCancel,
}: Props) {
  const [tab, setTab] = useState<Tab>('product');
  const [search, setSearch] = useState('');
  const query = search.toLowerCase().trim();

  const filteredProducts = useMemo(() => {
    const list = query
      ? products.filter(p => p.name.toLowerCase().includes(query))
      : products;
    return [...list].sort((a, b) => {
      const ap = pinnedIds.includes(a.id);
      const bp = pinnedIds.includes(b.id);
      if (ap && !bp) return -1;
      if (!ap && bp) return 1;
      return 0;
    });
  }, [products, query, pinnedIds]);

  const filteredDishes = useMemo(() => {
    return query
      ? dishes.filter(d => d.name.toLowerCase().includes(query))
      : dishes;
  }, [dishes, query]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full sm:w-[440px] sm:max-w-[95vw] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Додати в «{mealLabel}»</h2>
              <p className="text-xs text-gray-500 mt-0.5">Оберіть продукт або страву</p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 p-1 -m-1"
              aria-label="Закрити"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setTab('product')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === 'product'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Продукти ({products.length})
          </button>
          <button
            onClick={() => setTab('dish')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === 'dish'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Страви ({dishes.length})
          </button>
        </div>

        <div className="p-3 border-b">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук..."
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {tab === 'product' && (
            filteredProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {products.length === 0
                  ? 'Немає продуктів. Додайте з каталогу або вручну.'
                  : 'Нічого не знайдено'}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredProducts.map(p => {
                  const pinned = pinnedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onPick('product', p.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg active:bg-gray-100 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors ${
                        pinned ? 'border-l-2 border-l-amber-400' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.calories} ккал | Б {p.protein} | Ж {p.fat} | В {p.carbs}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}

          {tab === 'dish' && (
            filteredDishes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {dishes.length === 0
                  ? 'Немає страв. Створіть першу зі своїх продуктів.'
                  : 'Нічого не знайдено'}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredDishes.map(d => {
                  const dn = getDishNutrients(d, products);
                  const tw = getDishTotalWeight(d);
                  return (
                    <button
                      key={d.id}
                      onClick={() => onPick('dish', d.id)}
                      className="w-full text-left px-3 py-3 rounded-lg active:bg-gray-100 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors border-l-2 border-l-purple-400"
                    >
                      <div className="font-medium text-sm">{d.name}</div>
                      <div className="text-xs text-gray-500">
                        {dn.calories} ккал/100г | Б {dn.protein} | Ж {dn.fat} | В {dn.carbs} | {tw}г порція{d.fixedPortion ? ' (фікс.)' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
