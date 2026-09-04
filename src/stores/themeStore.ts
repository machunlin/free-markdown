import { create } from 'zustand';
import type { ThemeName, AppearanceMode } from '../types';

interface ThemeState {
  current: ThemeName;
  appearance: AppearanceMode;
  customTheme: Record<string, string> | null;
  setTheme: (theme: ThemeName) => void;
  setAppearance: (mode: AppearanceMode) => void;
  setCustomTheme: (vars: Record<string, string>) => void;
  applyTheme: () => void;
}

const THEME_NAMES: ThemeName[] = ['office', 'night', 'programmer'];

export const useThemeStore = create<ThemeState>((set, get) => ({
  current: 'office',
  appearance: 'system',
  customTheme: null,
  setTheme: (current) => { set({ current }); get().applyTheme(); },
  setAppearance: (appearance) => { set({ appearance }); get().applyTheme(); },
  setCustomTheme: (customTheme) => { set({ customTheme }); get().applyTheme(); },
  applyTheme: () => {
    const { current, appearance, customTheme } = get();
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = appearance === 'dark' || (appearance === 'system' && systemDark);
    root.classList.toggle('dark', dark);
    THEME_NAMES.forEach((theme) => root.classList.toggle(`theme-${theme}`, theme === current));

    // Remove legacy inline palette values so the theme token cascade controls appearance.
    if (!customTheme) {
      const themeKeys = [
        '--bg-base', '--bg-elevated', '--bg-surface', '--text-primary', '--text-secondary',
        '--accent', '--editor-bg', '--editor-text', '--preview-bg', '--preview-text',
        '--font-body', '--font-mono', '--preview-font-size', '--preview-line-height',
        '--preview-max-width',
      ];
      themeKeys.forEach((key) => root.style.removeProperty(key));
    } else {
      Object.entries(customTheme).forEach(([key, value]) => root.style.setProperty(key, value));
    }
  },
}));
