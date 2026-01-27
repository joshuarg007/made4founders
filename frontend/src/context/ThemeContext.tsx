import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
}

const THEME_KEY = 'made4founders_theme';

const ThemeContext = createContext<ThemeContextType | null>(null);

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return 'dark'; // Default to dark (current app theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => {
    const stored = getStoredTheme();
    return stored === 'system' ? getSystemTheme() : stored;
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    let resolved: 'dark' | 'light';
    if (theme === 'system') {
      resolved = getSystemTheme();
    } else {
      resolved = theme;
    }

    // Set data-theme attribute for CSS
    root.setAttribute('data-theme', resolved);
    setResolvedTheme(resolved);

    // Add smooth transition class for theme changes
    root.classList.add('theme-transition');
    const timeout = setTimeout(() => root.classList.remove('theme-transition'), 300);

    return () => clearTimeout(timeout);
  }, [theme]);

  // Listen for system preference changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

    const handleChange = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newResolved);
      setResolvedTheme(newResolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch {
      // localStorage not available
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
