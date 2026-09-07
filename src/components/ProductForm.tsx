import { useEffect, useState } from 'react';
import type { Product } from '../types';
import CameraScanner from './CameraScanner';
import ProductImageField, { releaseDraft, type ImageDraft } from './ProductImageField';

interface Props {
  onSave: (product: Omit<Product, 'id'>) => void;
  initial?: Product;
  onCancel?: () => void;
  categorySuggestions?: string[];
}

export default function ProductForm({ onSave, initial, onCancel, categorySuggestions = [] }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [calories, setCalories] = useState(initial?.calories?.toString() ?? '');
  const [protein, setProtein] = useState(initial?.protein?.toString() ?? '');
  const [fat, setFat] = useState(initial?.fat?.toString() ?? '');
  const [carbs, setCarbs] = useState(initial?.carbs?.toString() ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [hasUnit, setHasUnit] = useState(!!initial?.unit);
  const [gramsPerUnit, setGramsPerUnit] = useState(
    initial?.unit?.gramsPerUnit?.toString() ?? '',
  );
  const [unitLabel, setUnitLabel] = useState(initial?.unit?.label ?? '');
  const [fixedPortion, setFixedPortion] = useState(!!initial?.fixedPortion);

  // Appearance photo. Uploaded only on submit, so cancelling the form
  // never leaves an orphaned blob behind.
  const [imageDraft, setImageDraft] = useState<ImageDraft>({ kind: 'unchanged' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => () => releaseDraft(imageDraft), [imageDraft]);

  // Сканування етикетки через DeepSeek
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const handleCapture = async (dataUrl: string) => {
    setShowScanner(false);
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch('/api/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanMsg({ kind: 'error', text: data?.error || 'Не вдалося розпізнати фото' });
        return;
      }
      if (data.name) setName(data.name);
      setCalories(String(data.calories ?? ''));
      setProtein(String(data.protein ?? ''));
      setFat(String(data.fat ?? ''));
      setCarbs(String(data.carbs ?? ''));
      const conf =
        data.confidence === 'low'
          ? ' (низька впевненість — перевірте значення)'
          : data.confidence === 'medium'
            ? ' (перевірте значення)'
            : '';
      setScanMsg({ kind: 'info', text: `Заповнено з фото${conf}` });
    } catch {
      setScanMsg({ kind: 'error', text: 'Помилка мережі під час розпізнавання' });
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    const data: Omit<Product, 'id'> = {
      name: name.trim(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
      carbs: parseFloat(carbs) || 0,
    };

    const trimmedCategory = category.trim();
    if (trimmedCategory) data.category = trimmedCategory;

    if (hasUnit) {
      const g = parseFloat(gramsPerUnit);
      if (!(g > 0)) return;
      data.unit = { gramsPerUnit: g };
      const trimmed = unitLabel.trim();
      if (trimmed) data.unit.label = trimmed;
      if (fixedPortion) data.fixedPortion = true;
    }

    if (imageDraft.kind === 'unchanged' && initial?.imageUrl) {
      data.imageUrl = initial.imageUrl;
    } else if (imageDraft.kind === 'new') {
      setSaving(true);
      setSaveError(null);
      try {
        const form = new FormData();
        form.append('file', imageDraft.blob, 'product.webp');
        const res = await fetch('/api/product-image', { method: 'POST', body: form });
        const json = await res.json().catch(() => null);
        if (!res.ok || typeof json?.url !== 'string') {
          setSaveError(json?.error || 'Не вдалося завантажити фото');
          return;
        }
        data.imageUrl = json.url;
      } catch {
        setSaveError('Помилка мережі під час завантаження фото');
        return;
      } finally {
        setSaving(false);
      }
    }

    onSave(data);

    if (!initial) {
      setImageDraft({ kind: 'unchanged' });
      setName('');
      setCalories('');
      setProtein('');
      setFat('');
      setCarbs('');
      setCategory('');
      setHasUnit(false);
      setGramsPerUnit('');
      setUnitLabel('');
      setFixedPortion(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <button
        type="button"
        onClick={() => setShowScanner(true)}
        disabled={scanning}
        className="w-full flex items-center justify-center gap-2 py-2 rounded border border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 disabled:opacity-60 transition-colors"
      >
        {scanning ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
            Розпізнаю фото…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Сканувати етикетку
          </>
        )}
      </button>

      {scanMsg && (
        <p className={`text-xs ${scanMsg.kind === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {scanMsg.text}
        </p>
      )}

      {showScanner && (
        <CameraScanner onCapture={handleCapture} onCancel={() => setShowScanner(false)} />
      )}

      <ProductImageField
        currentUrl={initial?.imageUrl}
        draft={imageDraft}
        onChange={setImageDraft}
      />

      <input
        type="text"
        placeholder="Назва продукту"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        type="text"
        placeholder="Категорія (необов'язково)"
        value={category}
        onChange={e => setCategory(e.target.value)}
        list="product-form-categories"
        className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {categorySuggestions.length > 0 && (
        <datalist id="product-form-categories">
          {categorySuggestions.map(c => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Ккал/100г"
          value={calories}
          onChange={e => setCalories(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min="0"
          step="any"
        />
        <input
          type="number"
          placeholder="Білки/100г"
          value={protein}
          onChange={e => setProtein(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min="0"
          step="any"
        />
        <input
          type="number"
          placeholder="Жири/100г"
          value={fat}
          onChange={e => setFat(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min="0"
          step="any"
        />
        <input
          type="number"
          placeholder="Вуглеводи/100г"
          value={carbs}
          onChange={e => setCarbs(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          min="0"
          step="any"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm pt-1">
        <input
          type="checkbox"
          checked={hasUnit}
          onChange={e => setHasUnit(e.target.checked)}
          className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
        />
        <span className="text-gray-700">Зберігати в штуках</span>
        <span className="text-xs text-gray-400">— наприклад, 1 яйце = 60г</span>
      </label>

      {hasUnit && (
        <div className="space-y-2 pl-6 border-l-2 border-blue-100">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Грамів на штуку"
              value={gramsPerUnit}
              onChange={e => setGramsPerUnit(e.target.value)}
              className="flex-1 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0.001"
              step="any"
              required
            />
            <input
              type="text"
              placeholder="шт"
              value={unitLabel}
              onChange={e => setUnitLabel(e.target.value)}
              className="w-20 px-2 py-1.5 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
              maxLength={12}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={fixedPortion}
              onChange={e => setFixedPortion(e.target.checked)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
            />
            <span className="text-gray-700">Фіксована порція</span>
            <span className="text-xs text-gray-400">— перетягування додає 1 шт без запиту</span>
          </label>
        </div>
      )}

      {saveError && <p className="text-xs text-red-600">{saveError}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-500 text-white py-1.5 rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Завантажую фото…' : initial ? 'Зберегти' : 'Додати'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 transition-colors"
          >
            Скасувати
          </button>
        )}
      </div>
    </form>
  );
}
