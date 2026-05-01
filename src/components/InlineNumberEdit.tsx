import { useState, useRef, useEffect } from 'react';

interface Props {
  value: number;
  onSave: (value: number) => void;
  unit?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  // Compact = no unit suffix when displaying, only when editing.
  compact?: boolean;
  // Width class for the input (Tailwind, e.g. "w-16").
  widthClass?: string;
  // Aria-label / title for the edit button.
  ariaLabel?: string;
}

// Static value with a pencil to enter edit mode. While editing,
// the input lives entirely in local state — no parent state changes,
// no network calls. Save on Enter / Save button; Cancel / Escape /
// blur (without an explicit Save) drops the change. This is what
// the user wanted instead of an onChange-debounced number field.
export default function InlineNumberEdit({
  value,
  onSave,
  unit,
  placeholder = '',
  min = 0,
  max,
  compact = false,
  widthClass = 'w-16',
  ariaLabel = 'Редагувати',
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(value.toString());
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed) && parsed >= min && (max === undefined || parsed <= max)) {
      if (parsed !== value) onSave(parsed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value.toString());
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors text-xs"
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <span className="font-medium tabular-nums">
          {value > 0 ? value : (placeholder || '—')}
        </span>
        {!compact && unit && <span className="text-gray-500">{unit}</span>}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className={`${widthClass} px-1.5 py-0.5 border rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-400`}
        placeholder={placeholder}
        min={min}
        max={max}
        step="any"
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
      <button
        type="button"
        onClick={commit}
        className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded font-medium hover:bg-blue-600"
      >
        OK
      </button>
      <button
        type="button"
        onClick={cancel}
        className="px-1.5 py-0.5 text-xs border rounded hover:bg-gray-50"
        aria-label="Скасувати"
      >
        ✕
      </button>
    </span>
  );
}
