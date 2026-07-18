'use client';

import { useEffect, useState } from 'react';

export default function ThemeInit() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Restore saved theme
    const saved = localStorage.getItem('theme');
    const wasDark = saved === 'dark';
    document.documentElement.classList.toggle('dark', wasDark);
    // Store as cookie so server can read it on next navigation
    document.cookie = `theme=${wasDark ? 'dark' : 'light'};path=/;max-age=31536000`;
    setReady(true);
  }, []);
  return ready ? null : null;
}