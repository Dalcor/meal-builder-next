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
  UserSettings,
} from '@/types';
import { getSourceNutrients } from '@/utils/nutrients';

interface DataContextValue extends UserData {
  // Targets and macroTargets stay as blob slices (single objects, no
  // multi-tab risk worth granular ops).
  setTargets: React.Dispatch<React.SetStateAction<MealTargets>>;
  setMacroTargets: React.Dispatch<React.SetStateAction<MacroTargets>>;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;

  // Granular per-item ops. Each one optimistically updates local state,
  // fires a per-id/per-date request, and reverts on failure.
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (product: Product) => Promise<boolean>;
  removeProduct: (productId: string) => Promise<boolean>;
  pinProduct: (productId: string) => Promise<boolean>;
  unpinProduct: (productId: string) => Promise<boolean>;

  addDish: (dish: Dish) => Promise<boolean>;
  updateDish: (dish: Dish) => Promise<boolean>;
  removeDish: (dishId: string) => Promise<boolean>;

  setMealsForDate: (date: string, meals: Meals) => Promise<boolean>;
  deleteMealsForDate: (date: string) => Promise<boolean>;

  addMealPreset: (preset: MealPreset) => Promise<boolean>;
  removeMealPreset: (presetId: string) => Promise<boolean>;

  setMealsDoneForDate: (date: string, flags: Partial<Record<MealType, boolean>>) => Promise<boolean>;
  setWeightForDate: (date: string, weight: number) => Promise<boolean>;
  deleteWeightForDate: (date: string) => Promise<boolean>;

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
  settings: { weekStartDay: 1 },
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
  settings: '/api/settings',
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

// Persist `value` to `endpoint` with bounded retries. Returns true on
// success, false on any failure (validation 4xx, exhausted 5xx/network
// retries). Network blips and brief Vercel function unavailability
// during a deploy are common; transient failures are retried so the
// user's edit survives.
async function persistSlice(endpoint: string, body: string): Promise<boolean> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
      if (r.ok) return true;
      if (r.status >= 400 && r.status < 500) {
        console.error(
          `[meal-builder] PUT ${endpoint} → ${r.status}; not retrying. ` +
            `Body shape was likely rejected by the validator.`,
        );
        return false;
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
  return false;
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
    const timer = setTimeout(async () => {
      // Update the baseline ONLY after the server confirms the write.
      // Otherwise a failed PUT (deploy mid-request, validator reject,
      // network drop) would mark the value as "saved" locally while
      // KV still holds the old data — a reload would resurrect it.
      const ok = await persistSlice(endpoint, JSON.stringify(captured));
      if (ok) baselines.current[key] = captured;
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
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS.settings);

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
      fetchSlice('settings'),
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
      settingsData,
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
      const safeSettings = settingsData ?? DEFAULTS.settings;

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
        settings: safeSettings,
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
      setSettings(safeSettings);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const ready = !loading;
  // Only the two singular *Targets slices are still saved as a blob —
  // they're single objects bound to <input type="number"> fields that
  // update on every keystroke, so they need real keystroke batching.
  // Everything else goes through the granular helpers below.
  useDebouncedSliceSave('targets', ENDPOINTS.targets, targets, ready, baselines, 400);
  useDebouncedSliceSave('macroTargets', ENDPOINTS.macroTargets, macroTargets, ready, baselines, 400);
  useDebouncedSliceSave('settings', ENDPOINTS.settings, settings, ready, baselines, 400);

  // ---------- Granular mutators for products + pinned ----------
  // These optimistically update local state, then fire the granular
  // request. On failure, revert and surface a console.error so the
  // problem is debuggable.

  const addProduct = async (product: Product): Promise<boolean> => {
    setProducts(prev => [...prev, product]);
    try {
      const r = await fetch(ENDPOINTS.products, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
        keepalive: true,
      });
      if (!r.ok) throw new Error(`POST ${ENDPOINTS.products} → ${r.status}`);
      return true;
    } catch (err) {
      setProducts(prev => prev.filter(p => p.id !== product.id));
      console.error('[meal-builder] addProduct failed:', err);
      return false;
    }
  };

  const updateProduct = async (product: Product): Promise<boolean> => {
    let prevProduct: Product | undefined;
    setProducts(prev => {
      prevProduct = prev.find(p => p.id === product.id);
      return prev.map(p => (p.id === product.id ? product : p));
    });
    try {
      const r = await fetch(`${ENDPOINTS.products}/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
        keepalive: true,
      });
      if (!r.ok) throw new Error(`PUT ${ENDPOINTS.products}/${product.id} → ${r.status}`);
      return true;
    } catch (err) {
      if (prevProduct) {
        const revert = prevProduct;
        setProducts(prev => prev.map(p => (p.id === revert.id ? revert : p)));
      }
      console.error('[meal-builder] updateProduct failed:', err);
      return false;
    }
  };

  const removeProduct = async (productId: string): Promise<boolean> => {
    let removed: Product | undefined;
    let removedIndex = -1;
    setProducts(prev => {
      removedIndex = prev.findIndex(p => p.id === productId);
      removed = prev[removedIndex];
      return prev.filter(p => p.id !== productId);
    });
    try {
      const r = await fetch(`${ENDPOINTS.products}/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        keepalive: true,
      });
      if (!r.ok) throw new Error(`DELETE ${ENDPOINTS.products}/${productId} → ${r.status}`);
      return true;
    } catch (err) {
      if (removed && removedIndex >= 0) {
        const restore = removed;
        const at = removedIndex;
        setProducts(prev => {
          const next = [...prev];
          next.splice(at, 0, restore);
          return next;
        });
      }
      console.error('[meal-builder] removeProduct failed:', err);
      return false;
    }
  };

  const pinProduct = async (productId: string): Promise<boolean> => {
    setPinnedIds(prev => (prev.includes(productId) ? prev : [...prev, productId]));
    try {
      const r = await fetch(`${ENDPOINTS.pinnedIds}/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        keepalive: true,
      });
      if (!r.ok) throw new Error(`PUT ${ENDPOINTS.pinnedIds}/${productId} → ${r.status}`);
      return true;
    } catch (err) {
      setPinnedIds(prev => prev.filter(x => x !== productId));
      console.error('[meal-builder] pinProduct failed:', err);
      return false;
    }
  };

  const unpinProduct = async (productId: string): Promise<boolean> => {
    setPinnedIds(prev => prev.filter(x => x !== productId));
    try {
      const r = await fetch(`${ENDPOINTS.pinnedIds}/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        keepalive: true,
      });
      if (!r.ok) throw new Error(`DELETE ${ENDPOINTS.pinnedIds}/${productId} → ${r.status}`);
      return true;
    } catch (err) {
      setPinnedIds(prev => (prev.includes(productId) ? prev : [...prev, productId]));
      console.error('[meal-builder] unpinProduct failed:', err);
      return false;
    }
  };

  // ---------- Dishes ----------

  const addDish = async (dish: Dish): Promise<boolean> => {
    setDishes(prev => [...prev, dish]);
    try {
      const r = await fetch(ENDPOINTS.dishes, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dish),
        keepalive: true,
      });
      if (!r.ok) throw new Error(`POST ${ENDPOINTS.dishes} → ${r.status}`);
      return true;
    } catch (err) {
      setDishes(prev => prev.filter(d => d.id !== dish.id));
      console.error('[meal-builder] addDish failed:', err);
      return false;
    }
  };

  const updateDish = async (dish: Dish): Promise<boolean> => {
    let prev: Dish | undefined;
    setDishes(curr => {
      prev = curr.find(d => d.id === dish.id);
      return curr.map(d => (d.id === dish.id ? dish : d));
    });
    try {
      const r = await fetch(`${ENDPOINTS.dishes}/${encodeURIComponent(dish.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dish),
        keepalive: true,
      });
      if (!r.ok) throw new Error(`PUT ${ENDPOINTS.dishes}/${dish.id} → ${r.status}`);
      return true;
    } catch (err) {
      if (prev) {
        const restore = prev;
        setDishes(curr => curr.map(d => (d.id === restore.id ? restore : d)));
      }
      console.error('[meal-builder] updateDish failed:', err);
      return false;
    }
  };

  const removeDish = async (dishId: string): Promise<boolean> => {
    let removed: Dish | undefined;
    let removedIndex = -1;
    setDishes(prev => {
      removedIndex = prev.findIndex(d => d.id === dishId);
      removed = prev[removedIndex];
      return prev.filter(d => d.id !== dishId);
    });
    try {
      const r = await fetch(`${ENDPOINTS.dishes}/${encodeURIComponent(dishId)}`, {
        method: 'DELETE',
        keepalive: true,
      });
      if (!r.ok) throw new Error(`DELETE ${ENDPOINTS.dishes}/${dishId} → ${r.status}`);
      return true;
    } catch (err) {
      if (removed && removedIndex >= 0) {
        const restore = removed;
        const at = removedIndex;
        setDishes(prev => {
          const next = [...prev];
          next.splice(at, 0, restore);
          return next;
        });
      }
      console.error('[meal-builder] removeDish failed:', err);
      return false;
    }
  };

  // ---------- Daily meals (per date) ----------

  const setMealsForDate = async (date: string, meals: Meals): Promise<boolean> => {
    let prev: Meals | undefined;
    setDailyMeals(curr => {
      prev = curr[date];
      return { ...curr, [date]: meals };
    });
    try {
      const r = await fetch(`${ENDPOINTS.dailyMeals}/${encodeURIComponent(date)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meals),
        keepalive: true,
      });
      if (!r.ok) throw new Error(`PUT ${ENDPOINTS.dailyMeals}/${date} → ${r.status}`);
      return true;
    } catch (err) {
      const restore = prev;
      setDailyMeals(curr => {
        const next = { ...curr };
        if (restore) next[date] = restore;
        else delete next[date];
        return next;
      });
      console.error('[meal-builder] setMealsForDate failed:', err);
      return false;
    }
  };

  const deleteMealsForDate = async (date: string): Promise<boolean> => {
    let prev: Meals | undefined;
    setDailyMeals(curr => {
      prev = curr[date];
      const next = { ...curr };
      delete next[date];
      return next;
    });
    try {
      const r = await fetch(`${ENDPOINTS.dailyMeals}/${encodeURIComponent(date)}`, {
        method: 'DELETE',
        keepalive: true,
      });
      if (!r.ok) throw new Error(`DELETE ${ENDPOINTS.dailyMeals}/${date} → ${r.status}`);
      return true;
    } catch (err) {
      if (prev) {
        const restore = prev;
        setDailyMeals(curr => ({ ...curr, [date]: restore }));
      }
      console.error('[meal-builder] deleteMealsForDate failed:', err);
      return false;
    }
  };

  // ---------- Meal presets ----------

  const addMealPreset = async (preset: MealPreset): Promise<boolean> => {
    setMealPresets(prev => [...prev, preset]);
    try {
      const r = await fetch(ENDPOINTS.mealPresets, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
        keepalive: true,
      });
      if (!r.ok) throw new Error(`POST ${ENDPOINTS.mealPresets} → ${r.status}`);
      return true;
    } catch (err) {
      setMealPresets(prev => prev.filter(p => p.id !== preset.id));
      console.error('[meal-builder] addMealPreset failed:', err);
      return false;
    }
  };

  const removeMealPreset = async (presetId: string): Promise<boolean> => {
    let removed: MealPreset | undefined;
    let removedIndex = -1;
    setMealPresets(prev => {
      removedIndex = prev.findIndex(p => p.id === presetId);
      removed = prev[removedIndex];
      return prev.filter(p => p.id !== presetId);
    });
    try {
      const r = await fetch(`${ENDPOINTS.mealPresets}/${encodeURIComponent(presetId)}`, {
        method: 'DELETE',
        keepalive: true,
      });
      if (!r.ok) throw new Error(`DELETE ${ENDPOINTS.mealPresets}/${presetId} → ${r.status}`);
      return true;
    } catch (err) {
      if (removed && removedIndex >= 0) {
        const restore = removed;
        const at = removedIndex;
        setMealPresets(prev => {
          const next = [...prev];
          next.splice(at, 0, restore);
          return next;
        });
      }
      console.error('[meal-builder] removeMealPreset failed:', err);
      return false;
    }
  };

  // ---------- Meals-done flags (per date) ----------

  const setMealsDoneForDateHandler = async (
    date: string,
    flags: Partial<Record<MealType, boolean>>,
  ): Promise<boolean> => {
    let prev: Partial<Record<MealType, boolean>> | undefined;
    setMealsDone(curr => {
      prev = curr[date];
      return { ...curr, [date]: flags };
    });
    try {
      const r = await fetch(`${ENDPOINTS.mealsDone}/${encodeURIComponent(date)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flags),
        keepalive: true,
      });
      if (!r.ok) throw new Error(`PUT ${ENDPOINTS.mealsDone}/${date} → ${r.status}`);
      return true;
    } catch (err) {
      const restore = prev;
      setMealsDone(curr => {
        const next = { ...curr };
        if (restore) next[date] = restore;
        else delete next[date];
        return next;
      });
      console.error('[meal-builder] setMealsDoneForDate failed:', err);
      return false;
    }
  };

  // ---------- Weight log (per date) ----------

  const setWeightForDateHandler = async (date: string, weight: number): Promise<boolean> => {
    let prev: number | undefined;
    setWeightLog(curr => {
      prev = curr[date];
      return { ...curr, [date]: weight };
    });
    try {
      const r = await fetch(`${ENDPOINTS.weightLog}/${encodeURIComponent(date)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weight),
        keepalive: true,
      });
      if (!r.ok) throw new Error(`PUT ${ENDPOINTS.weightLog}/${date} → ${r.status}`);
      return true;
    } catch (err) {
      const restore = prev;
      setWeightLog(curr => {
        const next = { ...curr };
        if (restore !== undefined) next[date] = restore;
        else delete next[date];
        return next;
      });
      console.error('[meal-builder] setWeightForDate failed:', err);
      return false;
    }
  };

  const deleteWeightForDateHandler = async (date: string): Promise<boolean> => {
    let prev: number | undefined;
    setWeightLog(curr => {
      prev = curr[date];
      const next = { ...curr };
      delete next[date];
      return next;
    });
    try {
      const r = await fetch(`${ENDPOINTS.weightLog}/${encodeURIComponent(date)}`, {
        method: 'DELETE',
        keepalive: true,
      });
      if (!r.ok) throw new Error(`DELETE ${ENDPOINTS.weightLog}/${date} → ${r.status}`);
      return true;
    } catch (err) {
      if (prev !== undefined) {
        const restore = prev;
        setWeightLog(curr => ({ ...curr, [date]: restore }));
      }
      console.error('[meal-builder] deleteWeightForDate failed:', err);
      return false;
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <DataContext.Provider
      value={{
        products,
        dishes,
        dailyMeals,
        targets,
        setTargets,
        macroTargets,
        setMacroTargets,
        pinnedIds,
        mealsDone,
        mealPresets,
        weightLog,
        settings,
        setSettings,
        addProduct,
        updateProduct,
        removeProduct,
        pinProduct,
        unpinProduct,
        addDish,
        updateDish,
        removeDish,
        setMealsForDate,
        deleteMealsForDate,
        addMealPreset,
        removeMealPreset,
        setMealsDoneForDate: setMealsDoneForDateHandler,
        setWeightForDate: setWeightForDateHandler,
        deleteWeightForDate: deleteWeightForDateHandler,
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
