import { useState, useRef, useEffect } from 'react';
import type { FoodNutrients } from '../types';

interface Props {
  product: FoodNutrients;
  initialGrams?: number;
  onConfirm: (grams: number) => void;
  onCancel: () => void;
}

export default function PortionModal({ product, initialGrams, onConfirm, onCancel }: Props) {
  const [grams, setGrams] = useState(initialGrams?.toString() ?? '100');
  const [calories, setCalories] = useState(() => {
    const g = initialGrams ?? 100;
    return formatNum((product.calories * g) / 100);
  });
  const [editingField, setEditingField] = useState<'grams' | 'calories' | null>(null);
  const gramsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    gramsRef.current?.focus();
    gramsRef.current?.select();
  }, []);

  const handleGramsChange = (val: string) => {
    setGrams(val);
    const g = parseFloat(val) || 0;
    setCalories(formatNum((product.calories * g) / 100));
  };

  const handleCaloriesChange = (val: string) => {
    setCalories(val);
    const cal = parseFloat(val) || 0;
    if (product.calories > 0) {
      setGrams(formatNum((cal * 100) / product.calories));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(grams);
    if (g > 0) onConfirm(g);
  };

  const g = parseFloat(grams) || 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-80 max-w-[90vw]" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
        <p className="text-xs text-gray-500 mb-4">
          На 100г: {product.calories} ккал | Б {product.protein} | Ж {product.fat} | В {product.carbs}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Грами</label>
            <input
              ref={gramsRef}
              type="number"
              value={editingField === 'grams' ? grams : cleanTrailingZeros(grams)}
              onFocus={() => setEditingField('grams')}
              onBlur={() => setEditingField(null)}
              onChange={e => handleGramsChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0"
              step="any"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Калорії</label>
            <input
              type="number"
              value={editingField === 'calories' ? calories : cleanTrailingZeros(calories)}
              onFocus={() => setEditingField('calories')}
              onBlur={() => setEditingField(null)}
              onChange={e => handleCaloriesChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0"
              step="any"
            />
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600">
            <div className="grid grid-cols-4 gap-1 text-center">
              <div>
                <div className="font-medium">{formatDisplay((product.calories * g) / 100)}</div>
                <div>ккал</div>
              </div>
              <div>
                <div className="font-medium">{formatDisplay((product.protein * g) / 100)}</div>
                <div>білки</div>
              </div>
              <div>
                <div className="font-medium">{formatDisplay((product.fat * g) / 100)}</div>
                <div>жири</div>
              </div>
              <div>
                <div className="font-medium">{formatDisplay((product.carbs * g) / 100)}</div>
                <div>вугл.</div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              {initialGrams ? 'Оновити' : 'Додати'}
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
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(1)).toString();
}

function cleanTrailingZeros(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(1)).toString();
}

function formatDisplay(n: number): string {
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(1)).toString();
}
