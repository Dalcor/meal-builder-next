import type { MealPreset, Product, Dish } from '../types';
import { getSourceNutrients } from '../utils/nutrients';

interface Props {
  presets: MealPreset[];
  products: Product[];
  dishes: Dish[];
  onPaste: (preset: MealPreset) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

export default function CopyMealModal({ presets, products, dishes, onPaste, onDelete, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-[420px] max-w-[95vw] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h2 className="font-semibold">Збережені шаблони</h2>
          <p className="text-xs text-gray-500 mt-1">Оберіть шаблон для вставки</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {presets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Немає збережених шаблонів. Натисніть іконку збереження у прийомі їжі щоб створити.
            </p>
          ) : (
            <div className="space-y-2">
              {presets.map(preset => {
                const totalCal = preset.items.reduce((sum, item) => {
                  const n = getSourceNutrients(item.sourceType, item.sourceId, products, dishes);
                  return sum + (n ? (n.calories * item.grams) / 100 : 0);
                }, 0);
                const totalProt = preset.items.reduce((sum, item) => {
                  const n = getSourceNutrients(item.sourceType, item.sourceId, products, dishes);
                  return sum + (n ? (n.protein * item.grams) / 100 : 0);
                }, 0);

                return (
                  <div
                    key={preset.id}
                    className="border rounded-lg p-3 hover:border-blue-300 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold">{preset.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">
                          {totalCal.toFixed(0)} ккал / Б {totalProt.toFixed(0)}г
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      {preset.items.map(item => {
                        const n = getSourceNutrients(item.sourceType, item.sourceId, products, dishes);
                        return n ? `${n.name} (${item.grams}г)` : null;
                      }).filter(Boolean).join(', ')}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => onPaste(preset)}
                        className="flex-1 text-xs bg-blue-500 text-white py-1.5 rounded font-medium hover:bg-blue-600 transition-colors"
                      >
                        Вставити
                      </button>
                      <button
                        onClick={() => onDelete(preset.id)}
                        className="px-3 py-1.5 text-xs border rounded text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t">
          <button
            onClick={onCancel}
            className="w-full py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
