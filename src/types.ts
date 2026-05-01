export interface Product {
  id: string;
  name: string;
  calories: number; // per 100g
  protein: number;
  fat: number;
  carbs: number;
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

export interface MealItem {
  id: string;
  sourceType: 'product' | 'dish';
  sourceId: string;
  grams: number;
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
