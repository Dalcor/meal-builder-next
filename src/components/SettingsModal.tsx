import { useState } from 'react';
import type { MacroTargets, UserSettings, Weekday } from '../types';
import DrawerHandle from './DrawerHandle';

interface Props {
  macroTargets: MacroTargets;
  settings: UserSettings;
  onSave: (next: { macroTargets: MacroTargets; settings: UserSettings }) => void;
  onCancel: () => void;
}

// Ordered Mon → Sun for display; the value is Date#getDay().
const WEEKDAY_OPTIONS: { value: Weekday; label: string; title: string }[] = [
  { value: 1, label: 'пн', title: 'Понеділок' },
  { value: 2, label: 'вт', title: 'Вівторок' },
  { value: 3, label: 'ср', title: 'Середа' },
  { value: 4, label: 'чт', title: 'Четвер' },
  { value: 5, label: 'пт', title: "П'ятниця" },
  { value: 6, label: 'сб', title: 'Субота' },
  { value: 0, label: 'нд', title: 'Неділя' },
];

// Single-Save modal: edit values freely in local state, click "Зберегти"
// to commit. Replaces the inline header inputs that were onChange-bound
// and required a 400ms debounce.
export default function SettingsModal({ macroTargets, settings, onSave, onCancel }: Props) {
  const [proteinGrams, setProteinGrams] = useState(
    macroTargets.proteinGrams.toString(),
  );
  const [fatPercent, setFatPercent] = useState(macroTargets.fatPercent.toString());
  const [weekStartDay, setWeekStartDay] = useState<Weekday>(settings.weekStartDay);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(proteinGrams);
    const f = parseFloat(fatPercent);
    onSave({
      macroTargets: {
        proteinGrams: Number.isFinite(p) && p >= 0 ? p : 0,
        fatPercent: Number.isFinite(f) && f >= 0 ? Math.min(f, 100) : 0,
      },
      settings: { ...settings, weekStartDay },
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-[420px] sm:max-w-[95vw] max-h-[78svh] sm:max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <DrawerHandle onClose={onCancel} />
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Налаштування</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-2 -m-2 rounded-lg active:bg-gray-100"
            aria-label="Закрити"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Білки (ціль)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={proteinGrams}
                onChange={e => setProteinGrams(e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                min="0"
                step="any"
              />
              <span className="text-sm text-gray-500">г / день</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Жири (максимум)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={fatPercent}
                onChange={e => setFatPercent(e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                min="0"
                max="100"
                step="any"
              />
              <span className="text-sm text-gray-500">% від калорій</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Початок тижня
            </label>
            <div
              className="flex border rounded-lg overflow-hidden text-sm"
              role="radiogroup"
              aria-label="Початок тижня"
            >
              {WEEKDAY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={weekStartDay === opt.value}
                  title={opt.title}
                  onClick={() => setWeekStartDay(opt.value)}
                  className={`flex-1 py-2 transition-colors ${
                    weekStartDay === opt.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Від цього дня рахується тиждень у статистиці.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              Зберегти
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
