import type { MealType, Meals, MealTargets, MacroTargets, Product, Dish } from '../types';
import { getMealItemNutrients } from './nutrients';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Сніданок',
  lunch: 'Обід',
  dinner: 'Вечеря',
  snacks: 'Перекуси',
};

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

const WEEKDAYS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];
const MONTHS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

function formatDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

export function exportDayToPdf(
  dateKey: string,
  meals: Meals,
  targets: MealTargets,
  macroTargets: MacroTargets,
  products: Product[],
  dishes: Dish[]
) {
  // Calculate day totals
  const dayTotals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  for (const items of Object.values(meals)) {
    for (const item of items) {
      const n = getMealItemNutrients(item, products, dishes);
      if (!n) continue;
      const r = item.grams / 100;
      dayTotals.calories += n.calories * r;
      dayTotals.protein += n.protein * r;
      dayTotals.fat += n.fat * r;
      dayTotals.carbs += n.carbs * r;
    }
  }

  const totalTarget = targets.breakfast + targets.lunch + targets.dinner + targets.snacks;
  const fatPercent = dayTotals.calories > 0 ? (dayTotals.fat * 9 / dayTotals.calories) * 100 : 0;

  // Build meal sections HTML
  let mealsHtml = '';
  for (const type of MEAL_ORDER) {
    const items = meals[type];
    if (items.length === 0) continue;

    const mealTotals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
    let rowsHtml = '';

    for (const item of items) {
      const n = getMealItemNutrients(item, products, dishes);
      if (!n) continue;
      const r = item.grams / 100;
      const cal = n.calories * r;
      const prot = n.protein * r;
      const fat = n.fat * r;
      const carb = n.carbs * r;
      mealTotals.calories += cal;
      mealTotals.protein += prot;
      mealTotals.fat += fat;
      mealTotals.carbs += carb;

      rowsHtml += `
        <tr>
          <td>${n.name}</td>
          <td class="num">${fmt(item.grams)}</td>
          <td class="num">${fmt(cal)}</td>
          <td class="num">${fmt(prot)}</td>
          <td class="num">${fmt(fat)}</td>
          <td class="num">${fmt(carb)}</td>
        </tr>`;
    }

    mealsHtml += `
      <div class="meal">
        <div class="meal-header">
          <span class="meal-title">${MEAL_LABELS[type]}</span>
          <span class="meal-target">Ціль: ${targets[type]} ккал</span>
        </div>
        <table>
          <thead>
            <tr>
              <th class="left">Продукт</th>
              <th>Грами</th>
              <th>Ккал</th>
              <th>Білки</th>
              <th>Жири</th>
              <th>Вугл.</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td class="bold">Разом</td>
              <td></td>
              <td class="num bold">${fmt(mealTotals.calories)}</td>
              <td class="num bold">${fmt(mealTotals.protein)}</td>
              <td class="num bold">${fmt(mealTotals.fat)}</td>
              <td class="num bold">${fmt(mealTotals.carbs)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<title>Раціон — ${formatDate(dateKey)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .date { color: #666; margin-bottom: 16px; }
  .summary { background: #f5f5f5; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 24px; flex-wrap: wrap; }
  .summary-item { display: flex; flex-direction: column; }
  .summary-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-value { font-size: 16px; font-weight: 600; }
  .summary-sub { font-size: 11px; color: #999; }
  .over { color: #dc2626; }
  .ok { color: #16a34a; }
  .meal { margin-bottom: 16px; }
  .meal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #e5e5e5; }
  .meal-title { font-weight: 600; font-size: 15px; }
  .meal-target { font-size: 11px; color: #888; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: right; padding: 4px 8px; font-weight: 500; color: #888; border-bottom: 1px solid #eee; font-size: 11px; }
  th.left { text-align: left; }
  td { padding: 4px 8px; border-bottom: 1px solid #f5f5f5; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.bold, th.bold { font-weight: 600; }
  tfoot td { border-top: 1px solid #ddd; border-bottom: none; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <h1>Meal Builder</h1>
  <div class="date">${formatDate(dateKey)}</div>

  <div class="summary">
    <div class="summary-item">
      <span class="summary-label">Калорії</span>
      <span class="summary-value">${fmt(dayTotals.calories)}</span>
      ${totalTarget > 0 ? `<span class="summary-sub">з ${totalTarget} ккал</span>` : ''}
    </div>
    <div class="summary-item">
      <span class="summary-label">Білки</span>
      <span class="summary-value ${dayTotals.protein >= macroTargets.proteinGrams ? 'ok' : ''}">${fmt(dayTotals.protein)}г</span>
      ${macroTargets.proteinGrams > 0 ? `<span class="summary-sub">ціль ${macroTargets.proteinGrams}г</span>` : ''}
    </div>
    <div class="summary-item">
      <span class="summary-label">Жири</span>
      <span class="summary-value ${fatPercent > macroTargets.fatPercent ? 'over' : ''}">${fmt(dayTotals.fat)}г (${fmt(fatPercent)}%)</span>
      ${macroTargets.fatPercent > 0 ? `<span class="summary-sub">макс ${macroTargets.fatPercent}%</span>` : ''}
    </div>
    <div class="summary-item">
      <span class="summary-label">Вуглеводи</span>
      <span class="summary-value">${fmt(dayTotals.carbs)}г</span>
    </div>
  </div>

  ${mealsHtml}

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
