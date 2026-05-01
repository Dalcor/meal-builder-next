export interface ProductUnit {
  gramsPerUnit: number;
  label?: string; // default "шт"
}

export interface Product {
  id: string;
  name: string;
  calories: number; // per 100g
  protein: number;
  fat: number;
  carbs: number;
  // Optional unit-based portioning (e.g., 1 яйце = 60г, 1 рафаелло = 10г).
  // KBJU stays per 100g; this just changes how the user inputs/sees grams.
  unit?: ProductUnit;
  // Only meaningful with `unit`: drag-and-drop adds 1 unit without prompting.
  fixedPortion?: boolean;
  // Optional category for grouping in the sidebar. Free-form string;
  // suggestions come from `presetCategories` and the user's existing values.
  category?: string;
}

export interface DishIngredient {
  productId: string;
  grams: number;
}

export interface Dish {
  id: string;
  name: string;
  ingredients: DishIngredient[];
  fixedPortion?: boolean;
}

export interface FoodNutrients {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MealItemSnapshot extends FoodNutrients {
  unit?: ProductUnit;
}

export interface MealItem {
  id: string;
  sourceType: 'product' | 'dish';
  sourceId: string;
  grams: number;
  // Frozen copy of the source nutrition at the moment this item was added.
  // Used as a fallback if the source product/dish is later deleted or
  // edited, so historical meals show what was actually eaten.
  snapshot?: MealItemSnapshot;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface MealTargets {
  breakfast: number;
  lunch: number;
  dinner: number;
  snacks: number;
}

export interface Meals {
  breakfast: MealItem[];
  lunch: MealItem[];
  dinner: MealItem[];
  snacks: MealItem[];
}

export interface MacroTargets {
  proteinGrams: number;
  fatPercent: number;
}

export interface MealPreset {
  id: string;
  name: string;
  items: MealItem[];
}

export interface UserData {
  products: Product[];
  dishes: Dish[];
  dailyMeals: Record<string, Meals>;
  targets: MealTargets;
  macroTargets: MacroTargets;
  pinnedIds: string[];
  mealsDone: Record<string, Partial<Record<MealType, boolean>>>;
  mealPresets: MealPreset[];
  weightLog: Record<string, number>;
}

export type UserSliceKey = keyof UserData;
