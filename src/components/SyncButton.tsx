import { useEffect, useState } from 'react';
import { useUserData } from '@/context/DataContext';

function formatAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 45) return 'щойно';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} год тому`;
  return `${Math.round(hours / 24)} дн тому`;
}

// Shows how fresh the on-screen copy is and forces a re-read on tap.
// Data also refreshes on its own whenever the tab regains focus — this is
// for the case where the user wants to be sure before editing.
export default function SyncButton() {
  const { refresh, syncing, lastSyncedAt, syncError } = useUserData();
  // Clock kept in state: reading Date.now() during render is impure, and
  // the label has to tick anyway.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const label = syncing
    ? 'Синхронізую…'
    : syncError
      ? 'Не оновилось'
      : lastSyncedAt === null
        ? 'Оновити'
        : now === null
          ? 'щойно'
          : formatAgo(now - lastSyncedAt);

  return (
    <button
      onClick={() => void refresh()}
      disabled={syncing}
      title={
        syncError
          ? `${syncError}. Натисніть, щоб спробувати ще раз.`
          : 'Оновити дані з сервера. Це відбувається автоматично, коли ви повертаєтесь у вкладку.'
      }
      className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-60 ${
        syncError ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v4.99h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}
