import { useState, useRef, useEffect } from 'react';
import type { FoodNutrients, ProductUnit } from '../types';

interface Props {
  product: FoodNutrients;
  unit?: ProductUnit;
  initialGrams?: number;
  onConfirm: (grams: number) => void;
  onCancel: () => void;
}

export default function PortionModal({ product, unit, initialGrams, onConfirm, onCancel }: Props) {
  const defaultGrams = unit ? unit.gramsPerUnit : 100;
  const startGrams = initialGrams ?? defaultGrams;

  const [grams, setGrams] = useState(formatNum(startGrams));
  const [calories, setCalories] = useState(formatNum((product.calories * startGrams) / 100));
  const [units, setUnits] = useState(
    unit ? formatNum(startGrams / unit.gramsPerUnit) : '',
  );
  const [editingField, setEditingField] = useState<'grams' | 'calories' | 'units' | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    firstRef.current?.select();
  }, []);

  const handleGramsChange = (val: string) => {
    setGrams(val);
    const g = parseFloat(val) || 0;
    setCalories(formatNum((product.calories * g) / 100));
    if (unit) setUnits(formatNum(g / unit.gramsPerUnit));
  };

  const handleCaloriesChange = (val: string) => {
    setCalories(val);
    const cal = parseFloat(val) || 0;
    if (product.calories > 0) {
      const g = (cal * 100) / product.calories;
      setGrams(formatNum(g));
      if (unit) setUnits(formatNum(g / unit.gramsPerUnit));
    }
  };

  const handleUnitsChange = (val: string) => {
    setUnits(val);
    if (!unit) return;
    const u = parseFloat(val) || 0;
    const g = u * unit.gramsPerUnit;
    setGrams(formatNum(g));
    setCalories(formatNum((product.calories * g) / 100));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(grams);
    if (g > 0) onConfirm(g);
  };

  const g = parseFloat(grams) || 0;
  const unitLabel = unit?.label ?? 'шт';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl p-5 w-full sm:w-80 sm:max-w-[90vw]" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
        <p className="text-xs text-gray-500 mb-4">
          На 100г: {product.calories} ккал | Б {product.protein} | Ж {product.fat} | В {product.carbs}
          {unit && ` · 1 ${unitLabel} = ${formatNum(unit.gramsPerUnit)}г`}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {unit && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Кількість ({unitLabel})
              </label>
              <input
                ref={firstRef}
                type="number"
                value={editingField === 'units' ? units : cleanTrailingZeros(units)}
                onFocus={() => setEditingField('units')}
                onBlur={() => setEditingField(null)}
                onChange={e => handleUnitsChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                min="0"
                step="any"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Грами</label>
            <input
              ref={unit ? undefined : firstRef}
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
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
}

function cleanTrailingZeros(s: string): string {
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
}

function formatDisplay(n: number): string {
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(1)).toString();
}
