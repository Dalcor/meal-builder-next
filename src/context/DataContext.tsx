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
): { meals: Record<string, Meals>; presets: MealPreset[] } {
  const enrichItem = (item: MealItem): MealItem => {
    if (item.snapshot) return item;
    const live = getSourceNutrients(item.sourceType, item.sourceId, products, dishes);
    if (!live) return item;
    if (item.sourceType === 'product') {
      const unit = products.find(p => p.id === item.sourceId)?.unit;
      return { ...item, snapshot: unit ? { ...live, unit } : live };
    }
    return { ...item, snapshot: live };
  };

  const enrichedDaily: Record<string, Meals> = {};
  for (const [date, dayMeals] of Object.entries(daily)) {
    enrichedDaily[date] = {
      breakfast: dayMeals.breakfast.map(enrichItem),
      lunch: dayMeals.lunch.map(enrichItem),
      dinner: dayMeals.dinner.map(enrichItem),
      snacks: dayMeals.snacks.map(enrichItem),
    };
  }
  const enrichedPresets = presets.map(p => ({ ...p, items: p.items.map(enrichItem) }));
  return { meals: enrichedDaily, presets: enrichedPresets };
}

type BaselinesRef = React.MutableRefObject<Partial<UserData>>;

// Persist `value` to `endpoint` with bounded retries. Network blips and
// brief Vercel function unavailability during a deploy are common; we
// retry transient failures so the user's edit survives. Validation
// failures (4xx) are NOT retried — those are bugs in our code that
// repeating won't fix, but we DO log them so they show up in DevTools
// rather than disappearing into a silent .catch.
async function persistSlice(endpoint: string, body: string): Promise<void> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
      if (r.ok) return;
      if (r.status >= 400 && r.status < 500) {
        console.error(
          `[meal-builder] PUT ${endpoint} → ${r.status}; not retrying. ` +
            `Body shape was likely rejected by the validator.`,
        );
        return;
      }
      console.warn(
        `[meal-builder] PUT ${endpoint} → ${r.status} (attempt ${attempt}/${maxAttempts})`,
      );
    } catch (err) {
      console.warn(
        `[meal-builder] PUT ${endpoint} network error (attempt ${attempt}/${maxAttempts}):`,
        err,
      );
    }
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 400 * attempt));
    }
  }
  console.error(`[meal-builder] PUT ${endpoint} gave up after ${maxAttempts} attempts`);
}

// Persists `value` to `endpoint` with a debounce, but only when `value`
// differs (by reference) from the last successfully-saved baseline. The
// baseline is seeded from the bootstrap fetch, so the immediate
// post-bootstrap render does NOT cause a redundant save of the just-
// loaded data. Crucially, it also does NOT depend on a timer-based
// "initialized" flag — the previous implementation lost any user edit
// made in the first ~100ms after loading, because an explicit save
// fired with a stale captured value.
function useDebouncedSliceSave<K extends keyof UserData>(
  key: K,
  endpoint: string,
  value: UserData[K],
  ready: boolean,
  baselines: BaselinesRef,
  delayMs = 500,
) {
  // Mirror the current state value into a ref so the pagehide flush below
  // can reach the latest version even though it lives in a separate effect.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!ready) return;
    const base = baselines.current[key];
    if (base === undefined) return; // bootstrap hasn't populated baselines yet
    if (base === value) return; // unchanged from last persisted state
    const captured = value;
    const timer = setTimeout(() => {
      baselines.current[key] = captured;
      persistSlice(endpoint, JSON.stringify(captured));
    }, delayMs);
    return () => clearTimeout(timer);
  }, [key, endpoint, value, ready, baselines, delayMs]);

  // Flush any unsaved change synchronously when the tab is hidden / closed
  // (mobile browsers may never run the debounce timer otherwise). The
  // request is sent with `keepalive: true` so it survives page unload.
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      const current = valueRef.current;
      if (baselines.current[key] === current) return;
      // Single best-effort fire (no retries — the page is going away).
      try {
        fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(current),
          keepalive: true,
        });
        baselines.current[key] = current;
      } catch {
        // can't surface anything at unload time
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [key, endpoint, ready, baselines]);
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

  const baselines = useRef<Partial<UserData>>({});

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
      productsData,
      dishesData,
      dailyMealsData,
      targetsData,
      macroTargetsData,
      pinnedIdsData,
      mealsDoneData,
      mealPresetsData,
      weightLogData,
    ]) => {
      if (cancelled) return;
      const safeProducts = productsData ?? DEFAULTS.products;
      const safeDishes = dishesData ?? DEFAULTS.dishes;
      const rawMeals = dailyMealsData ?? DEFAULTS.dailyMeals;
      const rawPresets = mealPresetsData ?? DEFAULTS.mealPresets;
      const safeTargets = targetsData ?? DEFAULTS.targets;
      const safeMacroTargets = macroTargetsData ?? DEFAULTS.macroTargets;
      const safePinnedIds = pinnedIdsData ?? DEFAULTS.pinnedIds;
      const safeMealsDone = mealsDoneData ?? DEFAULTS.mealsDone;
      const safeWeightLog = weightLogData ?? DEFAULTS.weightLog;

      const { meals: enrichedMeals, presets: enrichedPresets } = backfillSnapshots(
        rawMeals,
        rawPresets,
        safeProducts,
        safeDishes,
      );

      // Seed baselines BEFORE setStates so the effects fired by the
      // upcoming render compare the new value to the correct baseline.
      // For dailyMeals/mealPresets we seed the RAW (pre-enrichment) value,
      // so the enriched setState triggers exactly one save per affected
      // slice (which persists the snapshots).
      baselines.current = {
        products: safeProducts,
        dishes: safeDishes,
        dailyMeals: rawMeals,
        targets: safeTargets,
        macroTargets: safeMacroTargets,
        pinnedIds: safePinnedIds,
        mealsDone: safeMealsDone,
        mealPresets: rawPresets,
        weightLog: safeWeightLog,
      };

      setProducts(safeProducts);
      setDishes(safeDishes);
      setDailyMeals(enrichedMeals);
      setTargets(safeTargets);
      setMacroTargets(safeMacroTargets);
      setPinnedIds(safePinnedIds);
      setMealsDone(safeMealsDone);
      setMealPresets(enrichedPresets);
      setWeightLog(safeWeightLog);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const ready = !loading;
  // Discrete slices change once per user action (click / drag / toggle),
  // so a tiny debounce is enough to coalesce React's batched re-renders.
  // The two `*Targets` slices are bound to <input type="number"> fields
  // that update on every keystroke, so they need real batching.
  useDebouncedSliceSave('products', ENDPOINTS.products, products, ready, baselines, 50);
  useDebouncedSliceSave('dishes', ENDPOINTS.dishes, dishes, ready, baselines, 50);
  useDebouncedSliceSave('dailyMeals', ENDPOINTS.dailyMeals, dailyMeals, ready, baselines, 50);
  useDebouncedSliceSave('targets', ENDPOINTS.targets, targets, ready, baselines, 400);
  useDebouncedSliceSave('macroTargets', ENDPOINTS.macroTargets, macroTargets, ready, baselines, 400);
  useDebouncedSliceSave('pinnedIds', ENDPOINTS.pinnedIds, pinnedIds, ready, baselines, 50);
  useDebouncedSliceSave('mealsDone', ENDPOINTS.mealsDone, mealsDone, ready, baselines, 50);
  useDebouncedSliceSave('mealPresets', ENDPOINTS.mealPresets, mealPresets, ready, baselines, 50);
  useDebouncedSliceSave('weightLog', ENDPOINTS.weightLog, weightLog, ready, baselines, 50);

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
