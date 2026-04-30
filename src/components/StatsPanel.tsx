import { useState, useMemo, useRef, useEffect } from 'react';
import type { Meals, MealType, Product, Dish } from '../types';
import { getSourceNutrients } from '../utils/nutrients';

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

function drawChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  data: (number | null)[],
  color: string,
  unit: string,
  targetLine?: number,
  minRange?: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const padLeft = 45;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 25;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  ctx.clearRect(0, 0, w, h);

  const validData = data.filter((v): v is number => v !== null);
  if (validData.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Немає даних', w / 2, h / 2);
    return;
  }

  let minVal = Math.min(...validData);
  let maxVal = Math.max(...validData);
  if (targetLine !== undefined) {
    minVal = Math.min(minVal, targetLine);
    maxVal = Math.max(maxVal, targetLine);
  }
  // Enforce minimum range so small changes don't look dramatic
  if (minRange && (maxVal - minVal) < minRange) {
    const mid = (maxVal + minVal) / 2;
    minVal = mid - minRange / 2;
    maxVal = mid + minRange / 2;
  }
  const range = maxVal - minVal || 1;
  const padding = range * 0.05;
  minVal -= padding;
  maxVal += padding;

  const getX = (i: number) => padLeft + (i / (labels.length - 1)) * chartW;
  const getY = (v: number) => padTop + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  // Grid lines
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padTop + (i / gridLines) * chartH;
    const val = maxVal - (i / gridLines) * (maxVal - minVal);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    ctx.fillStyle = '#999';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(val < 10 ? 1 : 0), padLeft - 5, y + 3);
  }

  // Target line
  if (targetLine !== undefined) {
    const ty = getY(targetLine);
    ctx.strokeStyle = '#ef444480';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, ty);
    ctx.lineTo(w - padRight, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`${targetLine}${unit}`, padLeft + 2, ty - 4);
  }

  // X labels (every ~5 days)
  ctx.fillStyle = '#999';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(labels.length / 6));
  for (let i = 0; i < labels.length; i += step) {
    ctx.fillText(formatShortDate(labels[i]), getX(i), h - 5);
  }

  // Line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === null) { started = false; continue; }
    const x = getX(i);
    const y = getY(data[i]!);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Dots
  for (let i = 0; i < data.length; i++) {
    if (data[i] === null) continue;
    const x = getX(i);
    const y = getY(data[i]!);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export default function StatsPanel({ weightLog, dailyMeals, mealsDone, products, dishes, selectedDate, onWeightChange, onClose }: Props) {
  const [weightInput, setWeightInput] = useState(weightLog[selectedDate]?.toString() ?? '');
  const weightCanvasRef = useRef<HTMLCanvasElement>(null);
  const calCanvasRef = useRef<HTMLCanvasElement>(null);

  const days = useMemo(() => getLast30Days(selectedDate), [selectedDate]);

  const weightData = useMemo(
    () => days.map(d => weightLog[d] ?? null),
    [days, weightLog]
  );

  const calData = useMemo(
    () => days.map(d => {
      const meals = dailyMeals[d];
      const done = mealsDone[d];
      if (!meals) return null;

      let total = 0;
      let hasAny = false;
      for (const type of ['breakfast', 'lunch', 'dinner', 'snacks'] as MealType[]) {
        if (!done?.[type]) continue;
        hasAny = true;
        for (const item of meals[type] ?? []) {
          const n = getSourceNutrients(item.sourceType, item.sourceId, products, dishes);
          if (n) total += (n.calories * item.grams) / 100;
        }
      }
      return hasAny ? total : null;
    }),
    [days, dailyMeals, mealsDone, products, dishes]
  );

  // Draw charts
  useEffect(() => {
    if (weightCanvasRef.current) drawChart(weightCanvasRef.current, days, weightData, '#3b82f6', 'кг', undefined, 10);
  }, [days, weightData]);

  useEffect(() => {
    if (calCanvasRef.current) drawChart(calCanvasRef.current, days, calData, '#f59e0b', 'ккал', undefined, 500);
  }, [days, calData]);

  // Sync weight input when date changes
  useEffect(() => {
    setWeightInput(weightLog[selectedDate]?.toString() ?? '');
  }, [selectedDate, weightLog]);

  const saveWeight = () => {
    const val = parseFloat(weightInput);
    onWeightChange(selectedDate, val > 0 ? val : null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[620px] max-w-[95vw] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Статистика</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Weight input */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Вага на {formatShortDate(selectedDate)}:</span>
            <input
              type="number"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              onBlur={saveWeight}
              onKeyDown={e => e.key === 'Enter' && saveWeight()}
              className="w-24 px-2 py-1 border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="кг"
              min="0"
              step="0.1"
            />
            <span className="text-xs text-gray-400">кг</span>
            {weightLog[selectedDate] && (
              <button
                onClick={() => { onWeightChange(selectedDate, null); setWeightInput(''); }}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Очистити
              </button>
            )}
          </div>

          {/* Weight chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Вага (30 днів)</h3>
            <canvas ref={weightCanvasRef} className="w-full h-[180px] border rounded-lg" />
          </div>

          {/* Calories chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Спожиті калорії (30 днів)</h3>
            <p className="text-xs text-gray-400 mb-1">На основі відмічених прийомів їжі</p>
            <canvas ref={calCanvasRef} className="w-full h-[180px] border rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
