'use client';

import { useState, useMemo } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Product, Dish, DishIngredient, MealItem, MealType, Meals, FoodNutrients, MealPreset } from '@/types';
import { useUserData } from '@/context/DataContext';
import {
  getSourceNutrients,
  getDishNutrients,
  getDishTotalWeight,
  getMealItemNutrients,
  getMealItemUnit,
} from '@/utils/nutrients';
import ProductForm from '@/components/ProductForm';
import DraggableProduct from '@/components/DraggableProduct';
import MealZone from '@/components/MealZone';
import PortionModal from '@/components/PortionModal';
import ProductCatalog from '@/components/ProductCatalog';
import DishConstructor from '@/components/DishConstructor';
import CopyMealModal from '@/components/CopyMealModal';
import { exportDayToPdf } from '@/utils/exportPdf';
import PromptModal from '@/components/PromptModal';
import ReplaceItemModal from '@/components/ReplaceItemModal';
import StatsPanel from '@/components/StatsPanel';
import AddItemModal from '@/components/AddItemModal';

const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Сніданок' },
  { type: 'lunch', label: 'Обід' },
  { type: 'dinner', label: 'Вечеря' },
  { type: 'snacks', label: 'Перекуси' },
];

const EMPTY_MEALS: Meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };

const WEEKDAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

function generateId() {
  return crypto.randomUUID();
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  const weekday = WEEKDAYS[d.getDay()];
  return `${weekday}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function todayKey(): string {
  return toDateKey(new Date());
}

function shiftDate(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

type LeftTab = 'products' | 'dishes';

export default function App() {
  const {
    products, setProducts, dishes, setDishes, dailyMeals, setDailyMeals,
    targets, setTargets, macroTargets, setMacroTargets, pinnedIds, setPinnedIds,
    mealsDone, setMealsDone, mealPresets, setMealPresets, weightLog, setWeightLog,
    loading, logout,
  } = useUserData();

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const isToday = selectedDate === todayKey();

  const meals = useMemo<Meals>(
    () => dailyMeals[selectedDate] ?? { ...EMPTY_MEALS },
    [dailyMeals, selectedDate]
  );

  const setMeals = (updater: (prev: Meals) => Meals) => {
    setDailyMeals(prev => ({
      ...prev,
      [selectedDate]: updater(prev[selectedDate] ?? { ...EMPTY_MEALS }),
    }));
  };

  const [leftTab, setLeftTab] = useState<LeftTab>('products');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDishConstructor, setShowDishConstructor] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSourceType, setActiveSourceType] = useState<'product' | 'dish' | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showMacroSettings, setShowMacroSettings] = useState(false);
  const [pastePresetForMeal, setPastePresetForMeal] = useState<MealType | null>(null);
  const [savePresetModal, setSavePresetModal] = useState<{ type: MealType; defaultName: string } | null>(null);
  const [replaceModal, setReplaceModal] = useState<{ mealType: MealType; item: MealItem; nutrients: FoodNutrients } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [addItemFor, setAddItemFor] = useState<{ mealType: MealType; mealLabel: string } | null>(null);

  const [portionModal, setPortionModal] = useState<{
    nutrients: FoodNutrients;
    sourceType: 'product' | 'dish';
    sourceId: string;
    mealType: MealType;
    editItemId?: string;
    initialGrams?: number;
    unit?: Product['unit'];
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    })
  );

  // --- Products ---
  const handleAddProduct = (data: Omit<Product, 'id'>) => {
    setProducts(prev => [...prev, { ...data, id: generateId() }]);
    setShowAddForm(false);
  };

  const handleEditProduct = (data: Omit<Product, 'id'>) => {
    if (!editingProduct) return;
    // Replace the product entirely — using `{ ...p, ...data }` here would
    // leak old optional fields (e.g. `unit` when the user unchecked
    // "Зберігати в штуках"), because the form omits absent keys instead
    // of setting them to undefined.
    setProducts(prev =>
      prev.map(p => (p.id === editingProduct.id ? { id: p.id, ...data } : p))
    );
    setEditingProduct(null);
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    // Past meal items keep their snapshot, so they stay visible in
    // historical days even though the product is gone from the catalog.
  };

  // --- Dishes ---
  const handleSaveDish = (name: string, ingredients: DishIngredient[], fixedPortion: boolean) => {
    if (editingDish) {
      setDishes(prev =>
        prev.map(d => (d.id === editingDish.id ? { ...d, name, ingredients, fixedPortion } : d))
      );
      setEditingDish(null);
    } else {
      setDishes(prev => [...prev, { id: generateId(), name, ingredients, fixedPortion }]);
    }
    setShowDishConstructor(false);
  };

  const handleDeleteDish = (id: string) => {
    setDishes(prev => prev.filter(d => d.id !== id));
    // Past meal items keep their snapshot, so historical days still
    // show the dish that was eaten with the original ingredient list.
  };

  // --- Drag & Drop ---
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveSourceType(event.active.data.current?.sourceType ?? 'product');
  };

  const buildSnapshot = (
    sourceType: 'product' | 'dish',
    sourceId: string,
    nutrients: FoodNutrients,
  ) => {
    if (sourceType !== 'product') return nutrients;
    const unit = products.find(p => p.id === sourceId)?.unit;
    return unit ? { ...nutrients, unit } : nutrients;
  };

  const startAddingToMeal = (
    sourceType: 'product' | 'dish',
    sourceId: string,
    mealType: MealType,
  ) => {
    const nutrients = getSourceNutrients(sourceType, sourceId, products, dishes);
    if (!nutrients) return;

    if (sourceType === 'dish') {
      const dish = dishes.find(d => d.id === sourceId);
      if (dish?.fixedPortion) {
        const totalWeight = getDishTotalWeight(dish);
        const newItem: MealItem = {
          id: generateId(),
          sourceType,
          sourceId,
          grams: totalWeight,
          snapshot: buildSnapshot(sourceType, sourceId, nutrients),
        };
        setMeals(prev => ({ ...prev, [mealType]: [...prev[mealType], newItem] }));
        return;
      }
      setPortionModal({ nutrients, sourceType, sourceId, mealType });
      return;
    }

    // Product path
    const product = products.find(p => p.id === sourceId);
    if (product?.unit && product.fixedPortion) {
      const newItem: MealItem = {
        id: generateId(),
        sourceType,
        sourceId,
        grams: product.unit.gramsPerUnit,
        snapshot: buildSnapshot(sourceType, sourceId, nutrients),
      };
      setMeals(prev => ({ ...prev, [mealType]: [...prev[mealType], newItem] }));
      return;
    }
    setPortionModal({ nutrients, sourceType, sourceId, mealType, unit: product?.unit });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveSourceType(null);
    const { active, over } = event;
    if (!over) return;

    const mealType = over.id as MealType;
    if (!['breakfast', 'lunch', 'dinner', 'snacks'].includes(mealType)) return;

    const sourceType = active.data.current?.sourceType as 'product' | 'dish';
    const sourceId = active.id as string;

    startAddingToMeal(sourceType, sourceId, mealType);
  };

  const handlePickerSelect = (sourceType: 'product' | 'dish', sourceId: string) => {
    if (!addItemFor) return;
    const mealType = addItemFor.mealType;
    setAddItemFor(null);
    startAddingToMeal(sourceType, sourceId, mealType);
  };

  // --- Meal items ---
  const handlePortionConfirm = (grams: number) => {
    if (!portionModal) return;
    const { mealType, editItemId, sourceType, sourceId, nutrients } = portionModal;

    if (editItemId) {
      setMeals(prev => ({
        ...prev,
        [mealType]: prev[mealType].map(item =>
          item.id === editItemId ? { ...item, grams } : item
        ),
      }));
    } else {
      const newItem: MealItem = {
        id: generateId(),
        sourceType,
        sourceId,
        grams,
        snapshot: buildSnapshot(sourceType, sourceId, nutrients),
      };
      setMeals(prev => ({
        ...prev,
        [mealType]: [...prev[mealType], newItem],
      }));
    }
    setPortionModal(null);
  };

  const handleEditMealItem = (mealType: MealType, itemId: string) => {
    const item = meals[mealType].find(i => i.id === itemId);
    if (!item) return;
    const nutrients = getMealItemNutrients(item, products, dishes);
    if (!nutrients) return;
    setPortionModal({
      nutrients,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      mealType,
      editItemId: itemId,
      initialGrams: item.grams,
      unit: getMealItemUnit(item, products),
    });
  };

  const handleReplaceMealItem = (mealType: MealType, itemId: string) => {
    const item = meals[mealType].find(i => i.id === itemId);
    if (!item) return;
    const nutrients = getMealItemNutrients(item, products, dishes);
    if (!nutrients) return;
    setReplaceModal({ mealType, item, nutrients });
  };

  const handleConfirmReplace = (sourceType: 'product' | 'dish', sourceId: string, grams: number) => {
    if (!replaceModal) return;
    const newNutrients = getSourceNutrients(sourceType, sourceId, products, dishes);
    setMeals(prev => ({
      ...prev,
      [replaceModal.mealType]: prev[replaceModal.mealType].map(item =>
        item.id === replaceModal.item.id
          ? {
              ...item,
              sourceType,
              sourceId,
              grams,
              snapshot: newNutrients
                ? buildSnapshot(sourceType, sourceId, newNutrients)
                : item.snapshot,
            }
          : item
      ),
    }));
    setReplaceModal(null);
  };

  const handleDeleteMealItem = (mealType: MealType, itemId: string) => {
    setMeals(prev => ({
      ...prev,
      [mealType]: prev[mealType].filter(i => i.id !== itemId),
    }));
  };

  const handleSavePreset = (mealType: MealType) => {
    const items = meals[mealType];
    if (items.length === 0) return;
    const label = MEAL_TYPES.find(m => m.type === mealType)?.label ?? mealType;
    setSavePresetModal({ type: mealType, defaultName: label });
  };

  const confirmSavePreset = (name: string) => {
    if (!savePresetModal) return;
    const items = meals[savePresetModal.type];
    setMealPresets(prev => [...prev, { id: generateId(), name, items: [...items] }]);
    setSavePresetModal(null);
  };

  const handlePastePreset = (preset: MealPreset, mealType: MealType) => {
    const copied = preset.items.map(item => ({ ...item, id: generateId() }));
    setMeals(prev => ({
      ...prev,
      [mealType]: [...prev[mealType], ...copied],
    }));
    setPastePresetForMeal(null);
  };

  const handleDeletePreset = (id: string) => {
    setMealPresets(prev => prev.filter(p => p.id !== id));
  };

  const mealMatchesPreset = (mealType: MealType): boolean => {
    const items = meals[mealType];
    if (items.length === 0) return false;
    return mealPresets.some(preset => {
      if (preset.items.length !== items.length) return false;
      const presetFingerprint = preset.items
        .map(i => `${i.sourceType}:${i.sourceId}:${i.grams}`)
        .sort()
        .join('|');
      const mealFingerprint = items
        .map(i => `${i.sourceType}:${i.sourceId}:${i.grams}`)
        .sort()
        .join('|');
      return presetFingerprint === mealFingerprint;
    });
  };

  // --- Totals ---
  const dayTotals = useMemo(() => {
    return Object.values(meals)
      .flat()
      .reduce(
        (acc, item) => {
          const n = getMealItemNutrients(item, products, dishes);
          if (!n) return acc;
          const ratio = item.grams / 100;
          return {
            calories: acc.calories + n.calories * ratio,
            protein: acc.protein + n.protein * ratio,
            fat: acc.fat + n.fat * ratio,
            carbs: acc.carbs + n.carbs * ratio,
          };
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );
  }, [meals, products, dishes]);

  const totalTarget = targets.breakfast + targets.lunch + targets.dinner + targets.snacks;
  const fatCalories = dayTotals.fat * 9;
  const fatPercent = dayTotals.calories > 0 ? (fatCalories / dayTotals.calories) * 100 : 0;

  // --- Sorted products (pinned first, then filtered by search) ---
  const sortedProducts = useMemo(() => {
    const query = productSearch.toLowerCase().trim();
    const filtered = query
      ? products.filter(p => p.name.toLowerCase().includes(query))
      : products;
    return [...filtered].sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [products, pinnedIds, productSearch]);

  const togglePin = (id: string) => {
    setPinnedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const activeNutrients =
    activeId && activeSourceType
      ? getSourceNutrients(activeSourceType, activeId, products, dishes)
      : null;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-400">Завантаження...</div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b px-3 sm:px-6 py-2 sm:py-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-bold text-gray-800">Meal Builder</h1>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <button
                  onClick={() => setShowStats(true)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Статистика
                </button>
                <button
                  onClick={() => setShowMacroSettings(!showMacroSettings)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showMacroSettings ? 'Сховати' : 'Налаштування'}
                </button>
                <button
                  onClick={logout}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Вийти
                </button>
              </div>
            </div>

            {/* Macro summary bar */}
            <div className="flex items-center gap-3 sm:gap-6 mt-2 text-xs sm:text-sm flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Ккал:</span>
                <span className="font-semibold">{dayTotals.calories.toFixed(0)}</span>
                {totalTarget > 0 && (
                  <span className="text-gray-400">/ {totalTarget}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Білки:</span>
                <span className={`font-semibold ${
                  macroTargets.proteinGrams > 0 && dayTotals.protein >= macroTargets.proteinGrams
                    ? 'text-green-600' : ''
                }`}>
                  {dayTotals.protein.toFixed(1)}г
                </span>
                {macroTargets.proteinGrams > 0 && (
                  <span className="text-gray-400">/ {macroTargets.proteinGrams}г</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Жири:</span>
                <span className={`font-semibold ${
                  macroTargets.fatPercent > 0 && fatPercent > macroTargets.fatPercent
                    ? 'text-red-600' : ''
                }`}>
                  {fatPercent.toFixed(1)}%
                </span>
                {macroTargets.fatPercent > 0 && (
                  <span className="text-gray-400 hidden sm:inline">/ max {macroTargets.fatPercent}%</span>
                )}
                <span className="text-gray-400 text-xs hidden sm:inline">({dayTotals.fat.toFixed(1)}г)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Вуглеводи:</span>
                <span className="font-semibold">{dayTotals.carbs.toFixed(1)}г</span>
              </div>
            </div>

            {/* Progress bars */}
            <div className="hidden sm:flex gap-4 mt-2">
              {totalTarget > 0 && (
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        dayTotals.calories > totalTarget ? 'bg-red-400' : 'bg-blue-400'
                      }`}
                      style={{ width: `${Math.min((dayTotals.calories / totalTarget) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {macroTargets.proteinGrams > 0 && (
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all bg-green-400"
                      style={{ width: `${Math.min((dayTotals.protein / macroTargets.proteinGrams) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Macro settings */}
            {showMacroSettings && (
              <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                <label className="flex items-center gap-1.5">
                  <span className="text-gray-500">Білки (ціль):</span>
                  <input
                    type="number"
                    value={macroTargets.proteinGrams || ''}
                    onChange={e => setMacroTargets(prev => ({ ...prev, proteinGrams: parseInt(e.target.value) || 0 }))}
                    className="w-16 px-2 py-0.5 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="г"
                    min="0"
                  />
                  <span className="text-gray-400">г/день</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-gray-500">Жири (макс):</span>
                  <input
                    type="number"
                    value={macroTargets.fatPercent || ''}
                    onChange={e => setMacroTargets(prev => ({ ...prev, fatPercent: parseInt(e.target.value) || 0 }))}
                    className="w-16 px-2 py-0.5 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="%"
                    min="0"
                    max="100"
                  />
                  <span className="text-gray-400">% калорій</span>
                </label>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full gap-2 md:gap-4 p-2 md:p-4 min-h-0">
          {/* Left panel: sidebar (desktop) / slide-over (mobile) */}
          {showSidebar && (
            <div
              className="md:hidden fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowSidebar(false)}
            />
          )}
          <aside
            className={`${
              showSidebar
                ? 'fixed inset-y-0 right-0 z-50 w-[88vw] max-w-sm bg-white shadow-2xl p-3 overflow-y-auto'
                : 'hidden'
            } md:static md:flex md:z-auto md:w-72 md:max-w-none md:p-0 md:bg-transparent md:shadow-none md:flex-shrink-0 md:flex-col md:gap-2 md:overflow-y-auto flex flex-col gap-2`}
          >
            <div className="flex md:hidden items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-700">Каталог</h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Закрити"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {/* Tabs */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setLeftTab('products')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  leftTab === 'products'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Продукти ({products.length})
              </button>
              <button
                onClick={() => setLeftTab('dishes')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  leftTab === 'dishes'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Страви ({dishes.length})
              </button>
            </div>

            {leftTab === 'products' && (
              <>
                <ProductCatalog
                  onAdd={data => {
                    setProducts(prev => [...prev, { ...data, id: generateId() }]);
                    setShowSidebar(false);
                  }}
                />

                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-700 text-sm">Мої продукти</h2>
                  <button
                    onClick={() => {
                      setShowAddForm(!showAddForm);
                      setEditingProduct(null);
                    }}
                    className="text-sm text-blue-500 hover:text-blue-700 font-medium transition-colors"
                  >
                    {showAddForm ? 'Сховати' : '+ Вручну'}
                  </button>
                </div>

                {products.length > 5 && (
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Пошук продукту..."
                    className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                )}

                {showAddForm && (
                  <ProductForm
                    onSave={handleAddProduct}
                    onCancel={() => setShowAddForm(false)}
                  />
                )}

                {editingProduct && (
                  <ProductForm
                    initial={editingProduct}
                    onSave={handleEditProduct}
                    onCancel={() => setEditingProduct(null)}
                  />
                )}

                <div className="flex-1 space-y-2 overflow-y-auto">
                  {products.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      Додайте продукт з каталогу або вручну
                    </p>
                  ) : sortedProducts.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Нічого не знайдено
                    </p>
                  ) : (
                    sortedProducts.map(product => {
                      const unitSubtitle = product.unit
                        ? `1 ${product.unit.label ?? 'шт'} = ${product.unit.gramsPerUnit}г${product.fixedPortion ? ' (фікс.)' : ''}`
                        : undefined;
                      return (
                        <DraggableProduct
                          key={product.id}
                          id={product.id}
                          sourceType="product"
                          nutrients={product}
                          subtitle={unitSubtitle}
                          pinned={pinnedIds.includes(product.id)}
                          onTogglePin={() => togglePin(product.id)}
                          onEdit={() => {
                            setEditingProduct(product);
                            setShowAddForm(false);
                          }}
                          onDelete={() => handleDeleteProduct(product.id)}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}

            {leftTab === 'dishes' && (
              <>
                <button
                  onClick={() => {
                    setShowDishConstructor(true);
                    setEditingDish(null);
                  }}
                  className="w-full py-2 px-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700 font-medium hover:bg-purple-100 transition-colors"
                >
                  + Створити страву
                </button>

                <div className="flex-1 space-y-2 overflow-y-auto">
                  {dishes.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      Створіть першу страву з ваших продуктів
                    </p>
                  ) : (
                    dishes.map(dish => {
                      const nutrients = getDishNutrients(dish, products);
                      const totalWeight = getDishTotalWeight(dish);
                      return (
                        <DraggableProduct
                          key={dish.id}
                          id={dish.id}
                          sourceType="dish"
                          nutrients={nutrients}
                          subtitle={`${dish.ingredients.length} інгр. / ${totalWeight}г${dish.fixedPortion ? ' (фікс.)' : ''}`}
                          onEdit={() => {
                            setEditingDish(dish);
                            setShowDishConstructor(true);
                          }}
                          onDelete={() => handleDeleteDish(dish.id)}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}
          </aside>

          {/* Right: Meals */}
          <main className="flex-1 overflow-y-auto space-y-3 min-w-0">
            {/* Mobile-only sidebar opener */}
            <button
              onClick={() => setShowSidebar(true)}
              className="md:hidden w-full py-2 px-3 bg-white border rounded-lg text-sm font-medium text-gray-700 shadow-sm flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 5a1 1 0 100 2h12a1 1 0 100-2H4z" />
              </svg>
              Каталог: продукти ({products.length}) / страви ({dishes.length})
            </button>

            {/* Date picker */}
            <div className="flex items-center justify-center gap-1 sm:gap-2 bg-white rounded-lg border px-2 sm:px-3 py-1.5 shadow-sm sticky top-0 z-10">
              <button
                onClick={() => setSelectedDate(prev => shiftDate(prev, -1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              <div className="flex items-center gap-2 min-w-[180px] justify-center">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => e.target.value && setSelectedDate(e.target.value)}
                  className="border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-sm font-medium text-gray-700">
                  {formatDateLabel(selectedDate)}
                </span>
              </div>

              <button
                onClick={() => setSelectedDate(prev => shiftDate(prev, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {!isToday && (
                <button
                  onClick={() => setSelectedDate(todayKey())}
                  className="ml-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                  Сьогодні
                </button>
              )}

              <button
                onClick={() => exportDayToPdf(selectedDate, meals, targets, macroTargets, products, dishes)}
                className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                title="Експорт в PDF"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {MEAL_TYPES.map(({ type, label }) => (
              <MealZone
                key={type}
                type={type}
                label={label}
                items={meals[type]}
                products={products}
                dishes={dishes}
                targetCalories={targets[type]}
                onTargetChange={value =>
                  setTargets(prev => ({ ...prev, [type]: value }))
                }
                onAddItem={() => setAddItemFor({ mealType: type, mealLabel: label })}
                onEditItem={itemId => handleEditMealItem(type, itemId)}
                onReplaceItem={itemId => handleReplaceMealItem(type, itemId)}
                onDeleteItem={itemId => handleDeleteMealItem(type, itemId)}
                onSavePreset={() => handleSavePreset(type)}
                onPastePreset={() => setPastePresetForMeal(type)}
                hasMatchingPreset={mealMatchesPreset(type)}
                done={!!mealsDone[selectedDate]?.[type]}
                onToggleDone={() => setMealsDone(prev => ({
                  ...prev,
                  [selectedDate]: {
                    ...prev[selectedDate],
                    [type]: !prev[selectedDate]?.[type],
                  },
                }))}
              />
            ))}
          </main>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeNutrients && (
          <div className="bg-white rounded-lg border-2 border-blue-400 shadow-xl px-3 py-2 opacity-90">
            <div className="font-medium text-sm">{activeNutrients.name}</div>
            <div className="text-xs text-gray-500">
              {activeNutrients.calories} ккал/100г
            </div>
          </div>
        )}
      </DragOverlay>

      {/* Add item picker (mobile primary, also available on desktop) */}
      {addItemFor && (
        <AddItemModal
          mealType={addItemFor.mealType}
          mealLabel={addItemFor.mealLabel}
          products={products}
          dishes={dishes}
          pinnedIds={pinnedIds}
          onPick={handlePickerSelect}
          onCancel={() => setAddItemFor(null)}
        />
      )}

      {/* Portion modal */}
      {portionModal && (
        <PortionModal
          product={portionModal.nutrients}
          unit={portionModal.unit}
          initialGrams={portionModal.initialGrams}
          onConfirm={handlePortionConfirm}
          onCancel={() => setPortionModal(null)}
        />
      )}

      {/* Stats panel */}
      {showStats && (
        <StatsPanel
          weightLog={weightLog}
          dailyMeals={dailyMeals}
          mealsDone={mealsDone}
          products={products}
          dishes={dishes}
          selectedDate={selectedDate}
          onWeightChange={(date, weight) => {
            setWeightLog(prev => {
              const next = { ...prev };
              if (weight === null) delete next[date];
              else next[date] = weight;
              return next;
            });
          }}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* Replace item modal */}
      {replaceModal && (
        <ReplaceItemModal
          currentItem={replaceModal.item}
          currentNutrients={replaceModal.nutrients}
          products={products}
          dishes={dishes}
          onReplace={handleConfirmReplace}
          onCancel={() => setReplaceModal(null)}
        />
      )}

      {/* Save preset name modal */}
      {savePresetModal && (
        <PromptModal
          title="Назва шаблону"
          defaultValue={savePresetModal.defaultName}
          placeholder="Введіть назву..."
          onConfirm={confirmSavePreset}
          onCancel={() => setSavePresetModal(null)}
        />
      )}

      {/* Paste preset modal */}
      {pastePresetForMeal && (
        <CopyMealModal
          presets={mealPresets}
          products={products}
          dishes={dishes}
          onPaste={preset => handlePastePreset(preset, pastePresetForMeal)}
          onDelete={handleDeletePreset}
          onCancel={() => setPastePresetForMeal(null)}
        />
      )}

      {/* Dish constructor modal */}
      {showDishConstructor && (
        <DishConstructor
          products={products}
          initial={editingDish ?? undefined}
          onSave={handleSaveDish}
          onCancel={() => {
            setShowDishConstructor(false);
            setEditingDish(null);
          }}
        />
      )}
    </DndContext>
  );
}
