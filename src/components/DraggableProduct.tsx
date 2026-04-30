import { useDraggable } from '@dnd-kit/core';
import type { FoodNutrients } from '../types';

interface Props {
  id: string;
  sourceType: 'product' | 'dish';
  nutrients: FoodNutrients;
  subtitle?: string;
  pinned?: boolean;
  onTogglePin?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function DraggableProduct({ id, sourceType, nutrients, subtitle, pinned, onTogglePin, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { sourceType, sourceId: id },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 bg-white rounded-lg border shadow-sm group transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      } ${sourceType === 'dish' ? 'border-l-2 border-l-purple-400' : ''} ${
        pinned ? 'border-l-2 border-l-amber-400' : ''
      }`}
    >
      <div
        {...listeners}
        {...attributes}
        className="flex-1 cursor-grab active:cursor-grabbing select-none min-w-0"
      >
        <div className="font-medium text-sm truncate">{nutrients.name}</div>
        {subtitle && <div className="text-xs text-purple-500">{subtitle}</div>}
        <div className="text-xs text-gray-500">
          {nutrients.calories} ккал | Б {nutrients.protein} | Ж {nutrients.fat} | В {nutrients.carbs}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className={`p-1 transition-colors ${pinned ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
            title={pinned ? 'Відкріпити' : 'Закріпити'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.828 3.172a4 4 0 015.656 0l1.344 1.344a4 4 0 010 5.656l-1.05 1.05a.5.5 0 01-.707 0L11.414 7.56a.5.5 0 010-.707l1.05-1.05a2 2 0 00-2.828-2.828L8.586 4.02a.5.5 0 01-.707 0L4.222 .363a.5.5 0 010-.707l1.05-1.05z" />
              {pinned ? (
                <path d="M10 2a1 1 0 00-.894.553l-1 2A1 1 0 008 5v4.586l-4.293 4.293a1 1 0 101.414 1.414L9 11.414V16a1 1 0 001.447.894l2-1A1 1 0 0013 15v-4.586l4.293-4.293a1 1 0 00-1.414-1.414L12 8.586V5a1 1 0 00-.106-.447l-1-2A1 1 0 0010 2z" />
              ) : (
                <path d="M10 2a1 1 0 00-.894.553l-1 2A1 1 0 008 5v4.586l-4.293 4.293a1 1 0 101.414 1.414L9 11.414V16a1 1 0 001.447.894l2-1A1 1 0 0013 15v-4.586l4.293-4.293a1 1 0 00-1.414-1.414L12 8.586V5a1 1 0 00-.106-.447l-1-2A1 1 0 0010 2z" />
              )}
            </svg>
          </button>
        )}
        <button
          onClick={onEdit}
          className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
          title="Редагувати"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Видалити"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
