'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type {
  Product,
  Dish,
  Meals,
  MealTargets,
  MacroTargets,
  MealType,
  MealItem,
  MealPreset,
  UserData,
} from '@/types';
import { getSourceNutrients } from '@/utils/nutrients';

interface DataContextValue extends UserData {
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setDishes: React.Dispatch<React.SetStateAction<Dish[]>>;
  setDailyMeals: React.Dispatch<React.SetStateAction<Record<string, Meals>>>;
  setTargets: React.Dispatch<React.SetStateAction<MealTargets>>;
  setMacroTargets: React.Dispatch<React.SetStateAction<MacroTargets>>;
  setPinnedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setMealsDone: React.Dispatch<React.SetStateAction<Record<string, Partial<Record<MealType, boolean>>>>>;
  setMealPresets: React.Dispatch<React.SetStateAction<MealPreset[]>>;
  setWeightLog: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  loading: boolean;
  logout: () => Promise<void>;
}

const DEFAULTS: UserData = {
  products: [],
  dishes: [],
  dailyMeals: {},
  targets: { breakfast: 500, lunch: 700, dinner: 500, snacks: 300 },
  macroTargets: { proteinGrams: 150, fatPercent: 25 },
  pinnedIds: [],
  mealsDone: {},
  mealPresets: [],
  weightLog: {},
};

const ENDPOINTS: Record<keyof UserData, string> = {
  products: '/api/products',
  dishes: '/api/dishes',
  dailyMeals: '/api/meals',
  targets: '/api/targets',
  macroTargets: '/api/macro-targets',
  pinnedIds: '/api/pinned',
  mealsDone: '/api/meals-done',
  mealPresets: '/api/meal-presets',
  weightLog: '/api/weight-log',
};

const DataContext = createContext<DataContextValue | null>(null);

// One-time enrichment of historical meal items with a snapshot of their
// source nutrition. After this runs, deleting / editing a product or dish
// will not affect items that were added before the change.
function backfillSnapshots(
  daily: Record<string, Meals>,
  presets: MealPreset[],
  products: Product[],
  dishes: Dish[],
): {
  meals: Record<string, Meals>;
  presets: MealPreset[];
  changed: { meals: boolean; presets: boolean };
} {
  let mealsTouched = false;
  let presetsTouched = false;

  const enrichItem = (item: MealItem, mark: () => void): MealItem => {
    if (item.snapshot) return item;
    const live = getSourceNutrients(item.sourceType, item.sourceId, products, dishes);
    if (!live) return item;
    mark();
    if (item.sourceType === 'product') {
      const unit = products.find(p => p.id === item.sourceId)?.unit;
      return { ...item, snapshot: unit ? { ...live, unit } : live };
    }
    return { ...item, snapshot: live };
  };

  const markMeals = () => {
    mealsTouched = true;
  };
  const markPresets = () => {
    presetsTouched = true;
  };

  const enrichedDaily: Record<string, Meals> = {};
  for (const [date, dayMeals] of Object.entries(daily)) {
    enrichedDaily[date] = {
      breakfast: dayMeals.breakfast.map(i => enrichItem(i, markMeals)),
      lunch: dayMeals.lunch.map(i => enrichItem(i, markMeals)),
      dinner: dayMeals.dinner.map(i => enrichItem(i, markMeals)),
      snacks: dayMeals.snacks.map(i => enrichItem(i, markMeals)),
    };
  }
  const enrichedPresets = presets.map(p => ({
    ...p,
    items: p.items.map(i => enrichItem(i, markPresets)),
  }));
  return {
    meals: enrichedDaily,
    presets: enrichedPresets,
    changed: { meals: mealsTouched, presets: presetsTouched },
  };
}

function useDebouncedSave<T>(
  endpoint: string,
  value: T,
  enabled: React.RefObject<boolean>,
  delayMs = 500,
) {
  useEffect(() => {
    if (!enabled.current) return;
    const timer = setTimeout(() => {
      fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      }).catch(() => {});
    }, delayMs);
    return () => clearTimeout(timer);
  }, [endpoint, value, enabled, delayMs]);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>(DEFAULTS.products);
  const [dishes, setDishes] = useState<Dish[]>(DEFAULTS.dishes);
  const [dailyMeals, setDailyMeals] = useState<Record<string, Meals>>(DEFAULTS.dailyMeals);
  const [targets, setTargets] = useState<MealTargets>(DEFAULTS.targets);
  const [macroTargets, setMacroTargets] = useState<MacroTargets>(DEFAULTS.macroTargets);
  const [pinnedIds, setPinnedIds] = useState<string[]>(DEFAULTS.pinnedIds);
  const [mealsDone, setMealsDone] = useState<Record<string, Partial<Record<MealType, boolean>>>>(DEFAULTS.mealsDone);
  const [mealPresets, setMealPresets] = useState<MealPreset[]>(DEFAULTS.mealPresets);
  const [weightLog, setWeightLog] = useState<Record<string, number>>(DEFAULTS.weightLog);
  const initialized = useRef(false);

  // Load all slices in parallel on mount.
  useEffect(() => {
    let cancelled = false;
    const fetchSlice = <K extends keyof UserData>(key: K): Promise<UserData[K]> =>
      fetch(ENDPOINTS[key])
        .then(r => (r.ok ? (r.json() as Promise<UserData[K]>) : DEFAULTS[key]))
        .catch(() => DEFAULTS[key]);

    Promise.all([
      fetchSlice('products'),
      fetchSlice('dishes'),
      fetchSlice('dailyMeals'),
      fetchSlice('targets'),
      fetchSlice('macroTargets'),
      fetchSlice('pinnedIds'),
      fetchSlice('mealsDone'),
      fetchSlice('mealPresets'),
      fetchSlice('weightLog'),
    ]).then(([
      products,
      dishes,
      dailyMeals,
      targets,
      macroTargets,
      pinnedIds,
      mealsDone,
      mealPresets,
      weightLog,
    ]) => {
      if (cancelled) return;
      const safeProducts = products ?? DEFAULTS.products;
      const safeDishes = dishes ?? DEFAULTS.dishes;
      const rawMeals = dailyMeals ?? DEFAULTS.dailyMeals;
      const rawPresets = mealPresets ?? DEFAULTS.mealPresets;
      const { meals: enrichedMeals, presets: enrichedPresets, changed } =
        backfillSnapshots(rawMeals, rawPresets, safeProducts, safeDishes);
      setProducts(safeProducts);
      setDishes(safeDishes);
      setDailyMeals(enrichedMeals);
      setTargets(targets ?? DEFAULTS.targets);
      setMacroTargets(macroTargets ?? DEFAULTS.macroTargets);
      setPinnedIds(pinnedIds ?? DEFAULTS.pinnedIds);
      setMealsDone(mealsDone ?? DEFAULTS.mealsDone);
      setMealPresets(enrichedPresets);
      setWeightLog(weightLog ?? DEFAULTS.weightLog);
      setLoading(false);
      setTimeout(() => {
        initialized.current = true;
        // useDebouncedSave's effects already fired with initialized=false
        // for the enriched values, so they skipped. Persist the backfill
        // explicitly here, once, only if it actually changed something.
        if (changed.meals) {
          fetch(ENDPOINTS.dailyMeals, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enrichedMeals),
          }).catch(() => {});
        }
        if (changed.presets) {
          fetch(ENDPOINTS.mealPresets, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enrichedPresets),
          }).catch(() => {});
        }
      }, 100);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Per-slice debounced auto-save. Each slice is sent only when its own
  // value reference changes, so a change to e.g. `weightLog` does not
  // re-PUT the entire user data blob.
  useDebouncedSave(ENDPOINTS.products, products, initialized);
  useDebouncedSave(ENDPOINTS.dishes, dishes, initialized);
  useDebouncedSave(ENDPOINTS.dailyMeals, dailyMeals, initialized);
  useDebouncedSave(ENDPOINTS.targets, targets, initialized);
  useDebouncedSave(ENDPOINTS.macroTargets, macroTargets, initialized);
  useDebouncedSave(ENDPOINTS.pinnedIds, pinnedIds, initialized);
  useDebouncedSave(ENDPOINTS.mealsDone, mealsDone, initialized);
  useDebouncedSave(ENDPOINTS.mealPresets, mealPresets, initialized);
  useDebouncedSave(ENDPOINTS.weightLog, weightLog, initialized);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <DataContext.Provider
      value={{
        products,
        setProducts,
        dishes,
        setDishes,
        dailyMeals,
        setDailyMeals,
        targets,
        setTargets,
        macroTargets,
        setMacroTargets,
        pinnedIds,
        setPinnedIds,
        mealsDone,
        setMealsDone,
        mealPresets,
        setMealPresets,
        weightLog,
        setWeightLog,
        loading,
        logout,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useUserData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useUserData must be used within DataProvider');
  return ctx;
}
