import { useDroppable } from '@dnd-kit/core';
import type { Product, Dish, MealItem, MealType, FoodNutrients } from '../types';
import { getSourceNutrients } from '../utils/nutrients';

interface Props {
  type: MealType;
  label: string;
  items: MealItem[];
  products: Product[];
  dishes: Dish[];
  targetCalories: number;
  onTargetChange: (value: number) => void;
  onEditItem: (itemId: string) => void;
  onReplaceItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onPastePreset: () => void;
  onSavePreset: () => void;
  hasMatchingPreset: boolean;
  done: boolean;
  onToggleDone: () => void;
}

const MEAL_COLORS: Record<MealType, { bg: string; border: string; header: string }> = {
  breakfast: { bg: 'bg-amber-50', border: 'border-amber-200', header: 'bg-amber-100' },
  lunch: { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100' },
  dinner: { bg: 'bg-indigo-50', border: 'border-indigo-200', header: 'bg-indigo-100' },
  snacks: { bg: 'bg-pink-50', border: 'border-pink-200', header: 'bg-pink-100' },
};

export default function MealZone({
  type,
  label,
  items,
  products,
  dishes,
  targetCalories,
  onTargetChange,
  onEditItem,
  onReplaceItem,
  onDeleteItem,
  onPastePreset,
  onSavePreset,
  hasMatchingPreset,
  done,
  onToggleDone,
}: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: type });
  const colors = MEAL_COLORS[type];

  const getNutrients = (item: MealItem): FoodNutrients | null =>
    getSourceNutrients(item.sourceType, item.sourceId, products, dishes);

  const totals = items.reduce(
    (acc, item) => {
      const n = getNutrients(item);
      if (!n) return acc;
      const ratio = item.grams / 100;
      return {
        calories: acc.calories + n.calories * ratio,
        protein: acc.protein + n.protein * ratio,
        fat: acc.fat + n.fat * ratio,
        carbs: acc.carbs + n.carbs * ratio,
      };
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const caloriePercent = targetCalories > 0 ? (totals.calories / targetCalories) * 100 : 0;
  const isOverTarget = caloriePercent > 103;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 transition-all ${colors.border} ${colors.bg} ${
        isOver ? 'ring-2 ring-blue-400 scale-[1.005]' : ''
      } ${done ? 'opacity-80' : ''}`}
    >
      <div className={`${colors.header} rounded-t-[5px] px-3 py-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={done}
              onChange={onToggleDone}
              className="rounded border-gray-300 text-green-500 focus:ring-green-400 h-3.5 w-3.5 cursor-pointer"
              title={done ? 'Позначити як незавершене' : 'Позначити як з\'їдене'}
            />
            <h3 className={`font-semibold text-sm ${done ? 'line-through text-gray-500' : ''}`}>{label}</h3>
            {items.length > 0 && (
              <button
                onClick={onSavePreset}
                className={`p-0.5 transition-colors ${
                  hasMatchingPreset
                    ? 'text-green-500'
                    : 'text-gray-400 hover:text-green-500'
                }`}
                title={hasMatchingPreset ? 'Шаблон збережено' : 'Зберегти як шаблон'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                </svg>
              </button>
            )}
            <button
              onClick={onPastePreset}
              className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
              title="Вставити з шаблону"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <input
              type="number"
              value={targetCalories || ''}
              onChange={e => onTargetChange(parseInt(e.target.value) || 0)}
              className="w-16 px-1.5 py-0.5 border rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="ккал"
              min="0"
            />
            <span className="text-gray-500">ккал</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {targetCalories > 0 && (
            <div className="flex-1 bg-white/60 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${isOverTarget ? 'bg-orange-400' : 'bg-green-400'}`}
                style={{ width: `${Math.min(caloriePercent, 100)}%` }}
              />
            </div>
          )}
          <div className="flex gap-3 text-xs flex-shrink-0">
            <span className={isOverTarget ? 'text-orange-600 font-semibold' : ''}>
              {totals.calories.toFixed(0)} ккал
            </span>
            <span>Б {totals.protein.toFixed(1)}</span>
            <span>Ж {totals.fat.toFixed(1)}</span>
            <span>В {totals.carbs.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="px-2 py-1.5 min-h-[40px]">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-3">
            Перетягніть сюди
          </div>
        ) : (
          <div className="space-y-0.5">
            {items.map(item => {
              const n = getNutrients(item);
              if (!n) return null;
              const ratio = item.grams / 100;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-white rounded px-2 py-1 shadow-sm group"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">
                      {item.sourceType === 'dish' && (
                        <span className="text-purple-500 mr-0.5">[С]</span>
                      )}
                      {n.name}
                    </span>
                    <span className="text-xs text-gray-400 ml-1.5">
                      {item.grams}г — {(n.calories * ratio).toFixed(0)} ккал
                      | Б {(n.protein * ratio).toFixed(1)}
                      | Ж {(n.fat * ratio).toFixed(1)}
                      | В {(n.carbs * ratio).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <button
                      onClick={() => onEditItem(item.id)}
                      className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Змінити грами"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onReplaceItem(item.id)}
                      className="p-0.5 text-gray-400 hover:text-orange-500 transition-colors"
                      title="Замінити продукт"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
