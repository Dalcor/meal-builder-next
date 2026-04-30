'use client';

import { DataProvider } from '@/context/DataContext';
import App from '@/App';

export default function Home() {
  return (
    <DataProvider>
      <App />
    </DataProvider>
  );
}
