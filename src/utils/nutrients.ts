import type { Product, Dish, FoodNutrients, MealItem } from '../types';

export function getDishNutrients(dish: Dish, products: Product[]): FoodNutrients {
  let totalWeight = 0;
  let totalCal = 0;
  let totalProt = 0;
  let totalFat = 0;
  let totalCarbs = 0;

  for (const ing of dish.ingredients) {
    const p = products.find(pr => pr.id === ing.productId);
    if (!p) continue;
    const ratio = ing.grams / 100;
    totalWeight += ing.grams;
    totalCal += p.calories * ratio;
    totalProt += p.protein * ratio;
    totalFat += p.fat * ratio;
    totalCarbs += p.carbs * ratio;
  }

  if (totalWeight === 0) {
    return { name: dish.name, calories: 0, protein: 0, fat: 0, carbs: 0 };
  }

  const factor = 100 / totalWeight;
  return {
    name: dish.name,
    calories: round(totalCal * factor),
    protein: round(totalProt * factor),
    fat: round(totalFat * factor),
    carbs: round(totalCarbs * factor),
  };
}

export function getSourceNutrients(
  sourceType: 'product' | 'dish',
  sourceId: string,
  products: Product[],
  dishes: Dish[]
): FoodNutrients | null {
  if (sourceType === 'product') {
    const p = products.find(pr => pr.id === sourceId);
    return p ? { name: p.name, calories: p.calories, protein: p.protein, fat: p.fat, carbs: p.carbs } : null;
  }
  const d = dishes.find(di => di.id === sourceId);
  return d ? getDishNutrients(d, products) : null;
}

export function getDishTotalWeight(dish: Dish): number {
  return dish.ingredients.reduce((sum, ing) => sum + ing.grams, 0);
}

// Resolve nutrients for a meal item: try the live source first, fall
// back to the item's snapshot. Items added before snapshots existed and
// whose source is gone return null.
export function getMealItemNutrients(
  item: MealItem,
  products: Product[],
  dishes: Dish[],
): FoodNutrients | null {
  const live = getSourceNutrients(item.sourceType, item.sourceId, products, dishes);
  if (live) return live;
  return item.snapshot ?? null;
}

export function getMealItemUnit(
  item: MealItem,
  products: Product[],
): { gramsPerUnit: number; label?: string } | undefined {
  if (item.sourceType !== 'product') return undefined;
  const live = products.find(p => p.id === item.sourceId)?.unit;
  if (live) return live;
  return item.snapshot?.unit;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
