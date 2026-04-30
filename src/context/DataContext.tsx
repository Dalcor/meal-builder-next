'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Product, Dish, Meals, MealTargets, MacroTargets, MealType, MealPreset } from '@/types';

interface UserData {
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

const DataContext = createContext<DataContextValue | null>(null);

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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  // Load data from server
  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then((data: UserData) => {
        if (data) {
          setProducts(data.products ?? []);
          setDishes(data.dishes ?? []);
          setDailyMeals(data.dailyMeals ?? {});
          setTargets(data.targets ?? DEFAULTS.targets);
          setMacroTargets(data.macroTargets ?? DEFAULTS.macroTargets);
          setPinnedIds(data.pinnedIds ?? []);
          setMealsDone(data.mealsDone ?? {});
          setMealPresets(data.mealPresets ?? []);
          setWeightLog(data.weightLog ?? {});
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        // Small delay to prevent initial load from triggering save
        setTimeout(() => { initialized.current = true; }, 100);
      });
  }, []);

  // Auto-save to server on changes (debounced)
  const save = useCallback(() => {
    if (!initialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const data: UserData = {
        products, dishes, dailyMeals, targets, macroTargets,
        pinnedIds, mealsDone, mealPresets, weightLog,
      };
      fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    }, 500);
  }, [products, dishes, dailyMeals, targets, macroTargets, pinnedIds, mealsDone, mealPresets, weightLog]);

  useEffect(() => { save(); }, [save]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <DataContext.Provider
      value={{
        products, setProducts, dishes, setDishes, dailyMeals, setDailyMeals,
        targets, setTargets, macroTargets, setMacroTargets, pinnedIds, setPinnedIds,
        mealsDone, setMealsDone, mealPresets, setMealPresets, weightLog, setWeightLog,
        loading, logout,
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