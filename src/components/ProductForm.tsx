import { useState } from 'react';
import type { Product } from '../types';

interface Props {
  onSave: (product: Omit<Product, 'id'>) => void;
  initial?: Product;
  onCancel?: () => void;
}

export default function ProductForm({ onSave, initial, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [calories, setCalories] = useState(initial?.calories?.toString() ?? '');
  const [protein, setProtein] = useState(initial?.protein?.toString() ?? '');
  const [fat, setFat] = useState(initial?.fat?.toString() ?? '');
  const [carbs, setCarbs] = useState(initial?.carbs?.toString() ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
      carbs: parseFloat(carbs) || 0,
    });
    if (!initial) {
      setName('');
      setCalories('');
      setProtein('');
      setFat('');
      setCarbs('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 bg-white rounded-lg shadow-sm border">
      <input
        type="text"
        placeholder="Назва продукту"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
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
      <div className="flex gap-2">
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
