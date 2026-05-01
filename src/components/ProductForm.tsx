import { useState } from 'react';
import type { Product } from '../types';

interface Props {
  onSave: (product: Omit<Product, 'id'>) => void;
  initial?: Product;
  onCancel?: () => void;
  categorySuggestions?: string[];
}

export default function ProductForm({ onSave, initial, onCancel, categorySuggestions = [] }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [calories, setCalories] = useState(initial?.calories?.toString() ?? '');
  const [protein, setProtein] = useState(initial?.protein?.toString() ?? '');
  const [fat, setFat] = useState(initial?.fat?.toString() ?? '');
  const [carbs, setCarbs] = useState(initial?.carbs?.toString() ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [hasUnit, setHasUnit] = useState(!!initial?.unit);
  const [gramsPerUnit, setGramsPerUnit] = useState(
    initial?.unit?.gramsPerUnit?.toString() ?? '',
  );
  const [unitLabel, setUnitLabel] = useState(initial?.unit?.label ?? '');
  const [fixedPortion, setFixedPortion] = useState(!!initial?.fixedPortion);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data: Omit<Product, 'id'> = {
      name: name.trim(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
      carbs: parseFloat(carbs) || 0,
    };

    const trimmedCategory = category.trim();
    if (trimmedCategory) data.category = trimmedCategory;

    if (hasUnit) {
      const g = parseFloat(gramsPerUnit);
      if (!(g > 0)) return;
      data.unit = { gramsPerUnit: g };
      const trimmed = unitLabel.trim();
      if (trimmed) data.unit.label = trimmed;
      if (fixedPortion) data.fixedPortion = true;
    }

    onSave(data);

    if (!initial) {
      setName('');
      setCalories('');
      setProtein('');
      setFat('');
      setCarbs('');
      setCategory('');
      setHasUnit(false);
      setGramsPerUnit('');
      setUnitLabel('');
      setFixedPortion(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        placeholder="Назва продукту"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        type="text"
        placeholder="Категорія (необов'язково)"
        value={category}
        onChange={e => setCategory(e.target.value)}
        list="product-form-categories"
        className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {categorySuggestions.length > 0 && (
        <datalist id="product-form-categories">
          {categorySuggestions.map(c => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Ккал/100г"
          value={calories}
          onChange={e => setCalories(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min="0"
          step="any"
        />
        <input
          type="number"
          placeholder="Білки/100г"
          value={protein}
          onChange={e => setProtein(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min="0"
          step="any"
        />
        <input
          type="number"
          placeholder="Жири/100г"
          value={fat}
          onChange={e => setFat(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min="0"
          step="any"
        />
        <input
          type="number"
          placeholder="Вуглеводи/100г"
          value={carbs}
          onChange={e => setCarbs(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min="0"
          step="any"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm pt-1">
        <input
          type="checkbox"
          checked={hasUnit}
          onChange={e => setHasUnit(e.target.checked)}
          className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
        />
        <span className="text-gray-700">Зберігати в штуках</span>
        <span className="text-xs text-gray-400">— наприклад, 1 яйце = 60г</span>
      </label>

      {hasUnit && (
        <div className="space-y-2 pl-6 border-l-2 border-blue-100">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Грамів на штуку"
              value={gramsPerUnit}
              onChange={e => setGramsPerUnit(e.target.value)}
              className="flex-1 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0.001"
              step="any"
              required
            />
            <input
              type="text"
              placeholder="шт"
              value={unitLabel}
              onChange={e => setUnitLabel(e.target.value)}
              className="w-20 px-2 py-1.5 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
              maxLength={12}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={fixedPortion}
              onChange={e => setFixedPortion(e.target.checked)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
            />
            <span className="text-gray-700">Фіксована порція</span>
            <span className="text-xs text-gray-400">— перетягування додає 1 шт без запиту</span>
          </label>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 bg-blue-500 text-white py-1.5 rounded text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          {initial ? 'Зберегти' : 'Додати'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 transition-colors"
          >
            Скасувати
          </button>
        )}
      </div>
    </form>
  );
}
