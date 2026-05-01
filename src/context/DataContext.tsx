'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type {
  Product,
  Dish,
  Meals,
  MealTargets,
  MacroTargets,
  MealType,
  MealPreset,
  UserData,
} from '@/types';

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
      setProducts(products ?? DEFAULTS.products);
      setDishes(dishes ?? DEFAULTS.dishes);
      setDailyMeals(dailyMeals ?? DEFAULTS.dailyMeals);
      setTargets(targets ?? DEFAULTS.targets);
      setMacroTargets(macroTargets ?? DEFAULTS.macroTargets);
      setPinnedIds(pinnedIds ?? DEFAULTS.pinnedIds);
      setMealsDone(mealsDone ?? DEFAULTS.mealsDone);
      setMealPresets(mealPresets ?? DEFAULTS.mealPresets);
      setWeightLog(weightLog ?? DEFAULTS.weightLog);
      setLoading(false);
      // Allow initial render to settle before enabling auto-save.
      setTimeout(() => {
        initialized.current = true;
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
