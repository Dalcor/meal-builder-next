import { useState, useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Meals, MealType, Product, Dish } from '../types';
import { getMealItemNutrients } from '../utils/nutrients';

interface Props {
  weightLog: Record<string, number>;
  dailyMeals: Record<string, Meals>;
  mealsDone: Record<string, Partial<Record<MealType, boolean>>>;
  products: Product[];
  dishes: Dish[];
  selectedDate: string;
  onWeightChange: (date: string, weight: number | null) => void;
  onClose: () => void;
}

const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

function formatShortDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function getLast30Days(today: string): string[] {
  const days: string[] = [];
  const d = new Date(today + 'T00:00:00');
  for (let i = 29; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(dd.getDate() - i);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, '0');
    const day = String(dd.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

interface ChartDatum {
  date: string;
  label: string;
  value: number | null;
}

function buildAxisDomain(values: number[], minRange: number): [number, number] {
  if (values.length === 0) return [0, minRange];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  let min = lo;
  let max = hi;
  if (max - min < minRange) {
    const mid = (max + min) / 2;
    min = mid - minRange / 2;
    max = mid + minRange / 2;
  }
  const pad = (max - min) * 0.08;
  return [Math.max(0, min - pad), max + pad];
}

interface TooltipPayloadItem {
  value?: number | null;
  payload: ChartDatum;
}

function CustomTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  if (item.value == null) return null;
  return (
    <div className="bg-white shadow-lg border rounded-lg px-3 py-2 text-xs">
      <div className="font-medium text-gray-700">{item.payload.label}</div>
      <div className="text-gray-500">
        {typeof item.value === 'number' ? item.value.toFixed(1) : ''} {unit}
      </div>
    </div>
  );
}

export default function StatsPanel({
  weightLog,
  dailyMeals,
  mealsDone,
  products,
  dishes,
  selectedDate,
  onWeightChange,
  onClose,
}: Props) {
  const [weightInput, setWeightInput] = useState(weightLog[selectedDate]?.toString() ?? '');

  // Reset weight input when the selected date changes (React-recommended
  // "adjusting state on prop change" pattern: store previous value as state).
  const [prevDate, setPrevDate] = useState(selectedDate);
  if (prevDate !== selectedDate) {
    setPrevDate(selectedDate);
    setWeightInput(weightLog[selectedDate]?.toString() ?? '');
  }

  const days = useMemo(() => getLast30Days(selectedDate), [selectedDate]);

  const weightSeries = useMemo<ChartDatum[]>(
    () =>
      days.map(d => ({
        date: d,
        label: formatShortDate(d),
        value: weightLog[d] ?? null,
      })),
    [days, weightLog]
  );

  const calorieSeries = useMemo<ChartDatum[]>(
    () =>
      days.map(d => {
        const meals = dailyMeals[d];
        const done = mealsDone[d];
        if (!meals) return { date: d, label: formatShortDate(d), value: null };

        let total = 0;
        let hasAny = false;
        for (const type of ['breakfast', 'lunch', 'dinner', 'snacks'] as MealType[]) {
          if (!done?.[type]) continue;
          hasAny = true;
          for (const item of meals[type] ?? []) {
            const n = getMealItemNutrients(item, products, dishes);
            if (n) total += (n.calories * item.grams) / 100;
          }
        }
        return { date: d, label: formatShortDate(d), value: hasAny ? total : null };
      }),
    [days, dailyMeals, mealsDone, products, dishes]
  );

  const weightDomain = useMemo(
    () =>
      buildAxisDomain(
        weightSeries.map(p => p.value).filter((v): v is number => v != null),
        10
      ),
    [weightSeries]
  );

  const calorieDomain = useMemo(
    () =>
      buildAxisDomain(
        calorieSeries.map(p => p.value).filter((v): v is number => v != null),
        500
      ),
    [calorieSeries]
  );

  const weightStats = useMemo(() => {
    const values = weightSeries.map(p => p.value).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const last = values[values.length - 1];
    const first = values[0];
    return { min, max, last, delta: last - first, count: values.length };
  }, [weightSeries]);

  const calorieStats = useMemo(() => {
    const values = calorieSeries.map(p => p.value).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return { avg: sum / values.length, max: Math.max(...values), days: values.length };
  }, [calorieSeries]);

  const saveWeight = () => {
    const val = parseFloat(weightInput);
    onWeightChange(selectedDate, val > 0 ? val : null);
  };

  const xTicks = useMemo(() => {
    const step = Math.max(1, Math.floor(days.length / 6));
    return days.filter((_, i) => i % step === 0);
  }, [days]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-[760px] sm:max-w-[95vw] max-h-[78svh] sm:max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) — also doubles as a tap target to close */}
        <button
          onClick={onClose}
          className="sm:hidden flex justify-center pt-2 pb-1.5 -mb-1 active:bg-gray-50"
          aria-label="Закрити"
        >
          <span className="block w-10 h-1.5 bg-gray-300 rounded-full" />
        </button>

        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Статистика</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 -m-2 rounded-lg active:bg-gray-100"
            aria-label="Закрити"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* Weight input */}
          <div className="flex flex-wrap items-center gap-3 bg-blue-50/50 border border-blue-100 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-gray-700">
              Вага на {formatShortDate(selectedDate)}:
            </span>
            <input
              type="number"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              onBlur={saveWeight}
              onKeyDown={e => e.key === 'Enter' && saveWeight()}
              className="w-24 px-3 py-1.5 border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="кг"
              min="0"
              step="0.1"
            />
            <span className="text-xs text-gray-500">кг</span>
            {weightLog[selectedDate] != null && (
              <button
                onClick={() => {
                  onWeightChange(selectedDate, null);
                  setWeightInput('');
                }}
                className="text-xs text-red-400 hover:text-red-600 ml-auto"
              >
                Очистити
              </button>
            )}
          </div>

          {/* Weight chart */}
          <section>
            <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-gray-800">Вага · 30 днів</h3>
              {weightStats && (
                <div className="flex gap-3 text-xs text-gray-600">
                  <span>
                    зараз <strong className="text-gray-800">{weightStats.last.toFixed(1)} кг</strong>
                  </span>
                  <span className={weightStats.delta >= 0 ? 'text-orange-600' : 'text-emerald-600'}>
                    Δ {weightStats.delta >= 0 ? '+' : ''}
                    {weightStats.delta.toFixed(1)} кг
                  </span>
                  <span className="hidden sm:inline">
                    мін {weightStats.min.toFixed(1)} / макс {weightStats.max.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-white px-2 py-3 sm:px-4">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={weightSeries} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis
                    dataKey="date"
                    ticks={xTicks}
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#cbd5e1"
                    interval={0}
                  />
                  <YAxis
                    domain={weightDomain}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#cbd5e1"
                    tickFormatter={(v: number) => v.toFixed(1)}
                    width={44}
                  />
                  <Tooltip content={<CustomTooltip unit="кг" />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="none"
                    fill="url(#weightFill)"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#3b82f6' }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              {weightStats == null && (
                <p className="text-center text-sm text-gray-400 -mt-44 mb-44">
                  Немає даних — введіть вагу для будь-якого дня
                </p>
              )}
            </div>
          </section>

          {/* Calories chart */}
          <section>
            <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Спожиті калорії · 30 днів</h3>
                <p className="text-xs text-gray-400">На основі відмічених прийомів їжі</p>
              </div>
              {calorieStats && (
                <div className="flex gap-3 text-xs text-gray-600">
                  <span>
                    середнє{' '}
                    <strong className="text-gray-800">{calorieStats.avg.toFixed(0)} ккал</strong>
                  </span>
                  <span className="hidden sm:inline">
                    максимум {calorieStats.max.toFixed(0)} · {calorieStats.days} дн.
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-white px-2 py-3 sm:px-4">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={calorieSeries} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id="calFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis
                    dataKey="date"
                    ticks={xTicks}
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#cbd5e1"
                    interval={0}
                  />
                  <YAxis
                    domain={calorieDomain}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#cbd5e1"
                    tickFormatter={(v: number) => v.toFixed(0)}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip unit="ккал" />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="none"
                    fill="url(#calFill)"
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#fff', stroke: '#f59e0b', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#f59e0b' }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              {calorieStats == null && (
                <p className="text-center text-sm text-gray-400 -mt-44 mb-44">
                  Немає відмічених прийомів їжі
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
