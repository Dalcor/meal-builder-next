import { useMemo, useState } from 'react';
import type { Product } from '../types';
import DrawerHandle from './DrawerHandle';

interface Props {
  products: Product[];
  onRename: (oldName: string, newName: string) => void;
  onClear: (name: string) => void;
  onCancel: () => void;
}

export default function CategoriesModal({ products, onRename, onClear, onCancel }: Props) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const cat = p.category?.trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, 'uk'));
  }, [products]);

  const uncategorizedCount = useMemo(
    () => products.filter(p => !p.category?.trim()).length,
    [products],
  );

  const [edits, setEdits] = useState<Record<string, string>>({});

  const startEditing = (name: string) =>
    setEdits(prev => ({ ...prev, [name]: name }));

  const cancelEditing = (name: string) =>
    setEdits(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });

  const commitRename = (oldName: string) => {
    const newName = (edits[oldName] ?? '').trim();
    if (!newName || newName === oldName) {
      cancelEditing(oldName);
      return;
    }
    onRename(oldName, newName);
    cancelEditing(oldName);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-[480px] sm:max-w-[95vw] max-h-[78svh] sm:max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <DrawerHandle onClose={onCancel} />
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Керування категоріями</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 p-2 -m-2 rounded-lg active:bg-gray-100"
              aria-label="Закрити"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Перейменування змінить категорію всім продуктам у цьому розділі.
            Очистка переведе їх у «Без категорії». Щоб додати нову — просто
            введіть її назву при створенні/редагуванні продукту.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Категорій немає. Введіть назву категорії при створенні або
              редагуванні продукту.
            </p>
          ) : (
            categories.map(([name, count]) => {
              const editing = name in edits;
              return (
                <div
                  key={name}
                  className="flex items-center gap-2 border rounded-lg p-2.5"
                >
                  {editing ? (
                    <input
                      type="text"
                      value={edits[name]}
                      onChange={e =>
                        setEdits(prev => ({ ...prev, [name]: e.target.value }))
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(name);
                        if (e.key === 'Escape') cancelEditing(name);
                      }}
                      className="flex-1 min-w-0 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{name}</div>
                      <div className="text-xs text-gray-400">
                        {count} продукт{count === 1 ? '' : count < 5 ? 'и' : 'ів'}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1 flex-shrink-0">
                    {editing ? (
                      <>
                        <button
                          onClick={() => commitRename(name)}
                          className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded font-medium hover:bg-blue-600 transition-colors"
                        >
                          Зберегти
                        </button>
                        <button
                          onClick={() => cancelEditing(name)}
                          className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors"
                        >
                          Скасувати
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(name)}
                          className="px-2.5 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors"
                          title="Перейменувати категорію"
                        >
                          Перейменувати
                        </button>
                        <button
                          onClick={() => onClear(name)}
                          className="px-2.5 py-1.5 text-xs border rounded text-red-500 hover:bg-red-50 transition-colors"
                          title="Прибрати цю категорію в усіх її продуктах"
                        >
                          Очистити
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {uncategorizedCount > 0 && (
            <div className="text-xs text-gray-400 text-center pt-2">
              Без категорії: {uncategorizedCount} продукт(ів). Призначте через
              редагування продукту.
            </div>
          )}
        </div>

        <div className="p-3 border-t">
          <button
            onClick={onCancel}
            className="w-full py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
