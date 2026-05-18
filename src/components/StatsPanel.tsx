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
const WEEKDAYS_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

// Week starts on Tuesday. Returns the YYYY-MM-DD of the Tuesday on/before dateKey.
function getWeekStart(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  const day = d.getDay();
  const offset = -((day - 2 + 7) % 7);
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
}

function getWeekDays(weekStart: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(shiftDateKey(weekStart, i));
  return out;
}

function formatShortDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`;
}

function formatTooltipDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(weekStart + 'T00:00:00');
  end.setDate(end.getDate() + 6);
  const sM = MONTHS_SHORT[start.getMonth()];
  const eM = MONTHS_SHORT[end.getMonth()];
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${sM}`;
  }
  return `${start.getDate()} ${sM} – ${end.getDate()} ${eM}`;
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
      <div className="font-medium text-gray-700">{formatTooltipDate(item.payload.date)}</div>
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
  const [weekStart, setWeekStart] = useState(() => getWeekStart(selectedDate));

  // Reset weight input and week anchor when the selected date changes
  // (React-recommended "adjusting state on prop change" pattern).
  const [prevDate, setPrevDate] = useState(selectedDate);
  if (prevDate !== selectedDate) {
    setPrevDate(selectedDate);
    setWeightInput(weightLog[selectedDate]?.toString() ?? '');
    setWeekStart(getWeekStart(selectedDate));
  }

  const todayWeekStart = useMemo(() => getWeekStart(toDateKey(new Date())), []);
  const isCurrentWeek = weekStart === todayWeekStart;
  const isFutureWeek = weekStart > todayWeekStart;

  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const weightSeries = useMemo<ChartDatum[]>(
    () =>
      days.map(d => ({
        date: d,
        label: formatDayLabel(d),
        value: weightLog[d] ?? null,
      })),
    [days, weightLog]
  );

  const calorieSeries = useMemo<ChartDatum[]>(
    () =>
      days.map(d => {
        const meals = dailyMeals[d];
        const done = mealsDone[d];
        if (!meals) return { date: d, label: formatDayLabel(d), value: null };

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
        return { date: d, label: formatDayLabel(d), value: hasAny ? total : null };
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

  const goPrevWeek = () => setWeekStart(shiftDateKey(weekStart, -7));
  const goNextWeek = () => setWeekStart(shiftDateKey(weekStart, 7));
  const goCurrentWeek = () => setWeekStart(todayWeekStart);

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

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Week switcher */}
          <div className="flex items-center justify-between gap-2 bg-gray-50 border rounded-lg px-2 py-2">
            <button
              onClick={goPrevWeek}
              className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-200 active:bg-gray-300"
              aria-label="Попередній тиждень"
            >
              ←
            </button>
            <div className="flex flex-col items-center text-center flex-1 min-w-0">
              <span className="text-sm font-semibold text-gray-800 truncate">
                {formatWeekRange(weekStart)}
              </span>
              <span className="text-[11px] text-gray-500">
                {isCurrentWeek
                  ? 'поточний тиждень'
                  : isFutureWeek
                  ? 'майбутній тиждень'
                  : 'минулий тиждень'}
                {!isCurrentWeek && (
                  <>
                    {' · '}
                    <button onClick={goCurrentWeek} className="text-blue-600 hover:underline">
                      до поточного
                    </button>
                  </>
                )}
              </span>
            </div>
            <button
              onClick={goNextWeek}
              disabled={isCurrentWeek || isFutureWeek}
              className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="Наступний тиждень"
            >
              →
            </button>
          </div>

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
              <h3 className="text-base font-semibold text-gray-800">Вага · за тиждень</h3>
              {weightStats && (
                <div className="flex gap-3 text-xs text-gray-600">
                  <span>
                    зараз <strong className="text-gray-800">{weightStats.last.toFixed(1)} кг</strong>
                  </span>
                  {weightStats.count >= 2 && (
                    <span className={weightStats.delta >= 0 ? 'text-orange-600' : 'text-emerald-600'}>
                      Δ {weightStats.delta >= 0 ? '+' : ''}
                      {weightStats.delta.toFixed(1)} кг
                    </span>
                  )}
                  <span className="hidden sm:inline">
                    мін {weightStats.min.toFixed(1)} / макс {weightStats.max.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-white px-2 py-3 sm:px-4">
              <ResponsiveContainer width="100%" height={260}>
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
                    ticks={days}
                    tickFormatter={formatDayLabel}
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
                <p className="text-center text-sm text-gray-400 -mt-36 mb-36">
                  Немає даних — введіть вагу для будь-якого дня тижня
                </p>
              )}
            </div>
          </section>

          {/* Calories chart */}
          <section>
            <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Спожиті калорії · за тиждень</h3>
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
              <ResponsiveContainer width="100%" height={260}>
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
                    ticks={days}
                    tickFormatter={formatDayLabel}
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
                <p className="text-center text-sm text-gray-400 -mt-36 mb-36">
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
