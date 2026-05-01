import type {
  Product,
  Dish,
  DishIngredient,
  MealItem,
  MealPreset,
  MealTargets,
  MacroTargets,
  Meals,
  MealType,
} from '@/types';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isProduct(v: unknown): v is Product {
  if (!isObj(v)) return false;
  if (
    !isStr(v.id) ||
    !isStr(v.name) ||
    !isNum(v.calories) ||
    !isNum(v.protein) ||
    !isNum(v.fat) ||
    !isNum(v.carbs)
  ) {
    return false;
  }
  if (v.unit !== undefined) {
    if (!isObj(v.unit)) return false;
    if (!isNum(v.unit.gramsPerUnit) || v.unit.gramsPerUnit <= 0) return false;
    if (v.unit.label !== undefined && !isStr(v.unit.label)) return false;
  }
  if (v.fixedPortion !== undefined && !isBool(v.fixedPortion)) return false;
  if (v.category !== undefined && !isStr(v.category)) return false;
  return true;
}

export function isProductArray(v: unknown): v is Product[] {
  return Array.isArray(v) && v.every(isProduct);
}

function isDishIngredient(v: unknown): v is DishIngredient {
  if (!isObj(v)) return false;
  return isStr(v.productId) && isNum(v.grams);
}

function isDish(v: unknown): v is Dish {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !isStr(v.name)) return false;
  if (!Array.isArray(v.ingredients) || !v.ingredients.every(isDishIngredient)) return false;
  if (v.fixedPortion !== undefined && !isBool(v.fixedPortion)) return false;
  return true;
}

export function isDishArray(v: unknown): v is Dish[] {
  return Array.isArray(v) && v.every(isDish);
}

function isMealItem(v: unknown): v is MealItem {
  if (!isObj(v)) return false;
  if (
    !isStr(v.id) ||
    !(v.sourceType === 'product' || v.sourceType === 'dish') ||
    !isStr(v.sourceId) ||
    !isNum(v.grams)
  ) {
    return false;
  }
  if (v.snapshot !== undefined) {
    if (!isObj(v.snapshot)) return false;
    const s = v.snapshot as Record<string, unknown>;
    if (
      !isStr(s.name) ||
      !isNum(s.calories) ||
      !isNum(s.protein) ||
      !isNum(s.fat) ||
      !isNum(s.carbs)
    ) {
      return false;
    }
    if (s.unit !== undefined) {
      if (!isObj(s.unit)) return false;
      if (!isNum(s.unit.gramsPerUnit) || s.unit.gramsPerUnit <= 0) return false;
      if (s.unit.label !== undefined && !isStr(s.unit.label)) return false;
    }
  }
  return true;
}

function isMeals(v: unknown): v is Meals {
  if (!isObj(v)) return false;
  for (const t of MEAL_TYPES) {
    const arr = v[t];
    if (!Array.isArray(arr) || !arr.every(isMealItem)) return false;
  }
  return true;
}

export function isDailyMeals(v: unknown): v is Record<string, Meals> {
  if (!isObj(v)) return false;
  return Object.values(v).every(isMeals);
}

function isMealPreset(v: unknown): v is MealPreset {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !isStr(v.name)) return false;
  return Array.isArray(v.items) && v.items.every(isMealItem);
}

export function isMealPresetArray(v: unknown): v is MealPreset[] {
  return Array.isArray(v) && v.every(isMealPreset);
}

export function isMealTargets(v: unknown): v is MealTargets {
  if (!isObj(v)) return false;
  return MEAL_TYPES.every(t => isNum(v[t]));
}

export function isMacroTargets(v: unknown): v is MacroTargets {
  if (!isObj(v)) return false;
  return isNum(v.proteinGrams) && isNum(v.fatPercent);
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isStr);
}

export function isMealsDone(
  v: unknown,
): v is Record<string, Partial<Record<MealType, boolean>>> {
  if (!isObj(v)) return false;
  for (const dayValue of Object.values(v)) {
    if (!isObj(dayValue)) return false;
    for (const [k, val] of Object.entries(dayValue)) {
      if (!MEAL_TYPES.includes(k as MealType)) return false;
      if (val !== undefined && !isBool(val)) return false;
    }
  }
  return true;
}

export function isWeightLog(v: unknown): v is Record<string, number> {
  if (!isObj(v)) return false;
  return Object.values(v).every(isNum);
}
