import { useState, useMemo } from 'react';
import type { Product, Dish, MealItem, FoodNutrients } from '../types';
import { getSourceNutrients, getDishNutrients, getDishTotalWeight } from '../utils/nutrients';

interface Props {
  currentItem: MealItem;
  currentNutrients: FoodNutrients;
  products: Product[];
  dishes: Dish[];
  onReplace: (sourceType: 'product' | 'dish', sourceId: string, grams: number) => void;
  onCancel: () => void;
}

export default function ReplaceItemModal({ currentItem, currentNutrients, products, dishes, onReplace, onCancel }: Props) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'product' | 'dish' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const currentCalories = (currentNutrients.calories * currentItem.grams) / 100;

  const query = search.toLowerCase().trim();

  const filteredProducts = useMemo(() => {
    return query
      ? products.filter(p => p.name.toLowerCase().includes(query))
      : products;
  }, [products, query]);

  const filteredDishes = useMemo(() => {
    return query
      ? dishes.filter(d => d.name.toLowerCase().includes(query))
      : dishes;
  }, [dishes, query]);

  const selectedNutrients = useMemo(() => {
    if (!selectedType || !selectedId) return null;
    return getSourceNutrients(selectedType, selectedId, products, dishes);
  }, [selectedType, selectedId, products, dishes]);

  const newGrams = selectedNutrients && selectedNutrients.calories > 0
    ? (currentCalories * 100) / selectedNutrients.calories
    : 0;

  const handleConfirm = () => {
    if (!selectedType || !selectedId || newGrams <= 0) return;
    onReplace(selectedType, selectedId, Math.round(newGrams * 10) / 10);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-[440px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h2 className="font-semibold">Замінити продукт</h2>
          <div className="text-xs text-gray-500 mt-1">
            <span className="font-medium">{currentNutrients.name}</span> — {currentItem.grams}г, {currentCalories.toFixed(0)} ккал
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Калорії буде збережено, грами перераховано автоматично
          </p>
        </div>

        <div className="p-3 border-b">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук..."
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredProducts.length > 0 && (
            <>
              <div className="text-xs text-gray-400 font-medium px-2 py-1">Продукти</div>
              {filteredProducts.map(p => {
                const isSelected = selectedType === 'product' && selectedId === p.id;
                const calcGrams = p.calories > 0 ? (currentCalories * 100) / p.calories : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedType('product'); setSelectedId(p.id); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-xs">{p.name}</span>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {calcGrams > 0 ? `${calcGrams.toFixed(0)}г` : '—'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.calories} ккал/100г | Б {p.protein} | Ж {p.fat} | В {p.carbs}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {filteredDishes.length > 0 && (
            <>
              <div className="text-xs text-gray-400 font-medium px-2 py-1 mt-1">Страви</div>
              {filteredDishes.map(d => {
                const dn = getDishNutrients(d, products);
                const isSelected = selectedType === 'dish' && selectedId === d.id;
                const calcGrams = dn.calories > 0 ? (currentCalories * 100) / dn.calories : 0;
                const tw = getDishTotalWeight(d);
                return (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedType('dish'); setSelectedId(d.id); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-xs">[С] {d.name}</span>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                        {calcGrams > 0 ? `${calcGrams.toFixed(0)}г` : '—'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {dn.calories} ккал/100г | {tw}г порція
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {filteredProducts.length === 0 && filteredDishes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Нічого не знайдено</p>
          )}
        </div>

        {/* Preview */}
        {selectedNutrients && newGrams > 0 && (
          <div className="px-4 py-2 border-t bg-gray-50 text-xs">
            <div className="flex justify-between">
              <span>
                <span className="font-medium">{selectedNutrients.name}</span> — {newGrams.toFixed(1)}г
              </span>
              <span className="text-gray-500">
                {currentCalories.toFixed(0)} ккал |
                Б {(selectedNutrients.protein * newGrams / 100).toFixed(1)} |
                Ж {(selectedNutrients.fat * newGrams / 100).toFixed(1)} |
                В {(selectedNutrients.carbs * newGrams / 100).toFixed(1)}
              </span>
            </div>
          </div>
        )}

        <div className="p-3 border-t flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={!selectedId || newGrams <= 0}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Замінити
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}
