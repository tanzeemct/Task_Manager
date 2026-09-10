import { useEffect, useState } from 'react';

const STORAGE_KEY = 'team-tasks-theme';

function apply(theme) {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// Reads/writes the user's explicit light/dark choice. `null` means "follow
// the system setting" — theme.css already handles that case via
// prefers-color-scheme, so we only ever stamp data-theme when overridden.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    apply(theme);
    try {
      if (theme) localStorage.setItem(STORAGE_KEY, theme);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
  }, [theme]);

  function toggle() {
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const currentlyDark = theme ? theme === 'dark' : systemDark;
    setTheme(currentlyDark ? 'light' : 'dark');
  }

  const isDark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  return { isDark, toggle };
}
