import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { setSetting } from '../db/repo';

export type ThemeMode = 'system' | 'light' | 'dark';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  header: string;
  onHeader: string;
  accent: string;
  danger: string;
  dangerSoft: string;
  warnSoft: string;
  warnText: string;
  success: string;
  text: string;
  muted: string;
  border: string;
};

const light: Palette = {
  bg: '#F2F6F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EAF1F0',
  primary: '#0F766E',
  primarySoft: '#D5F2EE',
  onPrimary: '#FFFFFF',
  header: '#0F766E',
  onHeader: '#FFFFFF',
  accent: '#F59E0B',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warnSoft: '#FEF3C7',
  warnText: '#92400E',
  success: '#16A34A',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
};

const dark: Palette = {
  bg: '#0A1110',
  surface: '#131C1B',
  surfaceAlt: '#1B2827',
  primary: '#2DD4BF',
  primarySoft: '#123530',
  onPrimary: '#042F2B',
  header: '#0B3F3B',
  onHeader: '#FFFFFF',
  accent: '#FBBF24',
  danger: '#F87171',
  dangerSoft: '#3B1717',
  warnSoft: '#3A2E10',
  warnText: '#FCD34D',
  success: '#4ADE80',
  text: '#F1F5F9',
  muted: '#94A3B8',
  border: '#263534',
};

type ThemeValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue>({
  mode: 'system',
  isDark: false,
  colors: light,
  setMode: () => {},
});

export function ThemeProvider({ initialMode, children }: { initialMode: ThemeMode; children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setSetting('theme', next).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
    return { mode, isDark, colors: isDark ? dark : light, setMode };
  }, [mode, system, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Estilos dependientes del tema; `factory` debe ser una función estable de módulo. */
export function useStyles<T>(factory: (c: Palette, isDark: boolean) => T): T {
  const { colors, isDark } = useTheme();
  return useMemo(() => factory(colors, isDark), [factory, colors, isDark]);
}
