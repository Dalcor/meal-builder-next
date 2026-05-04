import { useState } from 'react';
import type { Product, Dish, DishIngredient } from '../types';
import DrawerHandle from './DrawerHandle';
import ProductForm from './ProductForm';

interface Props {
  products: Product[];
  onSave: (
    name: string,
    ingredients: DishIngredient[],
    fixedPortion: boolean,
    cookedWeight: number | undefined,
  ) => void;
  onCancel: () => void;
  // Creates a product in the catalog and returns it so we can immediately
  // add it as an ingredient. Resolves to null when persistence failed.
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<Product | null>;
  categorySuggestions: string[];
  initial?: Dish;
}

export default function DishConstructor({
  products,
  onSave,
  onCancel,
  onAddProduct,
  categorySuggestions,
  initial,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [ingredients, setIngredients] = useState<DishIngredient[]>(
    initial?.ingredients ?? []
  );
  const [fixedPortion, setFixedPortion] = useState(initial?.fixedPortion ?? false);
  const [hasCookedWeight, setHasCookedWeight] = useState(
    initial?.cookedWeight !== undefined && initial.cookedWeight > 0,
  );
  const [cookedWeightInput, setCookedWeightInput] = useState(
    initial?.cookedWeight ? String(initial.cookedWeight) : '',
  );
  const [selectedProductId, setSelectedProductId] = useState('');
  const [showNewProductForm, setShowNewProductForm] = useState(false);

  const addIngredient = () => {
    if (!selectedProductId) return;
    if (ingredients.some(i => i.productId === selectedProductId)) return;
    setIngredients(prev => [...prev, { productId: selectedProductId, grams: 100 }]);
    setSelectedProductId('');
  };

  const updateGrams = (productId: string, grams: number) => {
    setIngredients(prev =>
      prev.map(i => (i.productId === productId ? { ...i, grams } : i))
    );
  };

  const removeIngredient = (productId: string) => {
    setIngredients(prev => prev.filter(i => i.productId !== productId));
  };

  const handleNewProductSave = async (data: Omit<Product, 'id'>) => {
    const created = await onAddProduct(data);
    if (!created) return;
    setIngredients(prev =>
      prev.some(i => i.productId === created.id)
        ? prev
        : [...prev, { productId: created.id, grams: 100 }]
    );
    setShowNewProductForm(false);
  };

  const parsedCookedWeight = parseFloat(cookedWeightInput);
  const cookedWeightValid = hasCookedWeight
    ? Number.isFinite(parsedCookedWeight) && parsedCookedWeight > 0
    : true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || ingredients.length === 0) return;
    if (!cookedWeightValid) return;
    const cookedWeight = hasCookedWeight ? parsedCookedWeight : undefined;
    onSave(name.trim(), ingredients, fixedPortion, cookedWeight);
  };

  // Calculate totals (raw — sum of ingredient grams). When the dish
  // declares a cooked weight, that becomes the denominator for per-100g
  // and the practical "weight of the dish" the user sees.
  let rawWeight = 0;
  let totalCal = 0;
  let totalProt = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  for (const ing of ingredients) {
    const p = products.find(pr => pr.id === ing.productId);
    if (!p) continue;
    const ratio = ing.grams / 100;
    rawWeight += ing.grams;
    totalCal += p.calories * ratio;
    totalProt += p.protein * ratio;
    totalFat += p.fat * ratio;
    totalCarbs += p.carbs * ratio;
  }

  const effectiveWeight =
    hasCookedWeight && parsedCookedWeight > 0 ? parsedCookedWeight : rawWeight;

  const per100 = effectiveWeight > 0
    ? {
        cal: (totalCal / effectiveWeight) * 100,
        prot: (totalProt / effectiveWeight) * 100,
        fat: (totalFat / effectiveWeight) * 100,
        carbs: (totalCarbs / effectiveWeight) * 100,
      }
    : { cal: 0, prot: 0, fat: 0, carbs: 0 };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-[520px] sm:max-w-[95vw] max-h-[78svh] sm:max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <DrawerHandle onClose={onCancel} />
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            {initial ? 'Редагувати страву' : 'Нова страва'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-2 -m-2 rounded-lg active:bg-gray-100"
            aria-label="Закрити"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Назва страви"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />

          {/* Add ingredient */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Оберіть продукт...</option>
                {products
                  .filter(p => !ingredients.some(i => i.productId === p.id))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addIngredient}
                disabled={!selectedProductId}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                + Додати
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowNewProductForm(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              + Створити новий продукт
            </button>
          </div>

          {/* Ingredients list */}
          {ingredients.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Інгредієнти
              </div>
              {ingredients.map(ing => {
                const p = products.find(pr => pr.id === ing.productId);
                if (!p) return null;
                const ratio = ing.grams / 100;
                return (
                  <div
                    key={ing.productId}
                    className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">
                        {(p.calories * ratio).toFixed(0)} ккал |
                        Б {(p.protein * ratio).toFixed(1)} |
                        Ж {(p.fat * ratio).toFixed(1)} |
                        В {(p.carbs * ratio).toFixed(1)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={ing.grams || ''}
                        onChange={e => updateGrams(ing.productId, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                        min="0"
                        step="any"
                      />
                      <span className="text-xs text-gray-500">г</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeIngredient(ing.productId)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cooked weight */}
          {ingredients.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCookedWeight}
                  onChange={e => setHasCookedWeight(e.target.checked)}
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                />
                <span className="text-sm text-gray-700">
                  Страва змінює вагу при приготуванні
                </span>
              </label>
              {hasCookedWeight && (
                <div className="pl-6 border-l-2 border-blue-100 space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={cookedWeightInput}
                      onChange={e => setCookedWeightInput(e.target.value)}
                      placeholder="Вага після приготування"
                      className="flex-1 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      min="0.001"
                      step="any"
                    />
                    <span className="text-xs text-gray-500">г</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Сировина: {rawWeight}г. КБЖУ перерахується на 100г готової страви.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Totals */}
          {ingredients.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 font-medium mb-2">
                Загалом ({effectiveWeight}г{hasCookedWeight && parsedCookedWeight > 0 ? ' готової' : ''}) / На 100г
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <div className="font-semibold">{totalCal.toFixed(0)} / {per100.cal.toFixed(0)}</div>
                  <div className="text-xs text-gray-500">ккал</div>
                </div>
                <div>
                  <div className="font-semibold">{totalProt.toFixed(1)} / {per100.prot.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">білки</div>
                </div>
                <div>
                  <div className="font-semibold">{totalFat.toFixed(1)} / {per100.fat.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">жири</div>
                </div>
                <div>
                  <div className="font-semibold">{totalCarbs.toFixed(1)} / {per100.carbs.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">вугл.</div>
                </div>
              </div>
            </div>
          )}

          {ingredients.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fixedPortion}
                onChange={e => setFixedPortion(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
              />
              <span className="text-sm text-gray-600">
                Фіксована порція ({effectiveWeight}г)
              </span>
              <span className="text-xs text-gray-400">
                — додавати без запиту грамів
              </span>
            </label>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={!name.trim() || ingredients.length === 0 || !cookedWeightValid}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {initial ? 'Зберегти' : 'Створити страву'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Скасувати
            </button>
          </div>
        </form>
      </div>

      {/* Inline product creation modal — nested above the dish constructor */}
      {showNewProductForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-[60]"
          onClick={() => setShowNewProductForm(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-[420px] sm:max-w-[95vw] max-h-[78svh] sm:max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <DrawerHandle onClose={() => setShowNewProductForm(false)} />
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Новий продукт</h3>
              <button
                type="button"
                onClick={() => setShowNewProductForm(false)}
                className="text-gray-400 hover:text-gray-600 p-2 -m-2 rounded-lg active:bg-gray-100"
                aria-label="Закрити"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <ProductForm
                onSave={handleNewProductSave}
                onCancel={() => setShowNewProductForm(false)}
                categorySuggestions={categorySuggestions}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
