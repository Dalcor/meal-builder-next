import { useCallback, useEffect, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { exportSquareCrop } from '../utils/imageCrop';
import DrawerHandle from './DrawerHandle';

interface Props {
  source: Blob;
  onDone: (cropped: Blob) => void;
  onCancel: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

// Square crop on react-easy-crop: fixed 1:1 aspect, drag-to-pan, zoom via
// slider / wheel / pinch. The library keeps the frame inside the image
// (`restrictPosition`) and reports the crop in natural pixels.
export default function ImageCropModal({ source, onDone, onCancel }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object URL derived from the blob; revoked when it changes / on unmount.
  const src = useMemo(() => URL.createObjectURL(source), [source]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  const confirm = async () => {
    if (!src || !areaPixels) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await exportSquareCrop(src, areaPixels));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:w-[420px] sm:max-w-[95vw] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <DrawerHandle onClose={onCancel} />
        <div className="p-4 border-b">
          <h2 className="font-semibold">Оберіть область</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Перетягніть фото, масштаб — повзунком, коліщатком або двома пальцями.
          </p>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-neutral-800">
            {(
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                aspect={1}
                cropShape="rect"
                showGrid
                restrictPosition
                objectFit="cover"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                onMediaLoaded={() => setError(null)}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 flex-shrink-0">Масштаб</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              className="w-full"
              aria-label="Масштаб"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={confirm}
              disabled={!areaPixels || busy}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-60 transition-colors"
            >
              {busy ? 'Обробка…' : 'Застосувати'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
