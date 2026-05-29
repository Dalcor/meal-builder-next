import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

const MAX_DIM = 1280; // макс. сторона зображення перед відправкою

// Малює зображення/відео на canvas зі зменшенням до MAX_DIM і повертає JPEG data URI.
function toScaledDataUrl(source: HTMLVideoElement | HTMLImageElement, w: number, h: number): string {
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, cw, ch);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function CameraScanner({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Камера недоступна в цьому браузері');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch {
        setError('Не вдалося отримати доступ до камери. Дозвольте доступ або скористайтеся галереєю.');
      }
    }
    start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  const handleShot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const url = toScaledDataUrl(video, video.videoWidth, video.videoHeight);
    if (url) {
      stopStream();
      onCapture(url);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const url = toScaledDataUrl(img, img.naturalWidth, img.naturalHeight);
        if (url) {
          stopStream();
          onCapture(url);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const close = () => {
    stopStream();
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm font-medium">Наведіть на етикетку з КБЖУ</span>
        <button
          onClick={close}
          className="p-2 -m-2 rounded-lg active:bg-white/10"
          aria-label="Закрити"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-center text-white/80 px-8 text-sm">{error}</div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      <div className="p-6 flex items-center justify-center gap-8">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-1 text-white/80 active:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
          </svg>
          <span className="text-xs">Галерея</span>
        </button>

        <button
          onClick={handleShot}
          disabled={!ready || !!error}
          className="rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          style={{ height: 72, width: 72 }}
          aria-label="Зробити фото"
        >
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>

        <div className="w-7" />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
