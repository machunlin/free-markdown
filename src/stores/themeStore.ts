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

const BUILTIN_THEMES: Record<ThemeName, Record<string, string>> = {
  office: {
    '--bg-base': '#ffffff',
    '--bg-elevated': '#f6f6f6',
    '--bg-surface': '#ffffff',
    '--text-primary': '#1d1d1f',
    '--text-secondary': '#6e6e73',
    '--accent': '#007aff',
    '--editor-bg': '#ffffff',
    '--editor-text': '#1d1d1f',
    '--preview-bg': '#ffffff',
    '--preview-text': '#1d1d1f',
    '--font-body': '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
    '--font-mono': '"SF Mono", Menlo, monospace',
    '--preview-font-size': '15px',
    '--preview-line-height': '1.7',
    '--preview-max-width': '740px',
  },
  night: {
    '--bg-base': '#1e1e1e',
    '--bg-elevated': '#1c1c1e',
    '--bg-surface': '#2c2c2e',
    '--text-primary': '#f5f5f7',
    '--text-secondary': '#a1a1a6',
    '--accent': '#0a84ff',
    '--editor-bg': '#1e1e1e',
    '--editor-text': '#f5f5f7',
    '--preview-bg': '#1e1e1e',
    '--preview-text': '#f5f5f7',
    '--font-body': '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
    '--font-mono': '"SF Mono", Menlo, monospace',
    '--preview-font-size': '15px',
    '--preview-line-height': '1.7',
    '--preview-max-width': '740px',
  },
  programmer: {
    '--bg-base': '#0d1117',
    '--bg-elevated': '#161b22',
    '--bg-surface': '#161b22',
    '--text-primary': '#c9d1d9',
    '--text-secondary': '#8b949e',
    '--accent': '#58a6ff',
    '--editor-bg': '#0d1117',
    '--editor-text': '#c9d1d9',
    '--preview-bg': '#0d1117',
    '--preview-text': '#c9d1d9',
    '--font-body': '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
    '--font-mono': '"JetBrains Mono", "SF Mono", Menlo, monospace',
    '--preview-font-size': '15px',
    '--preview-line-height': '1.7',
    '--preview-max-width': '740px',
  },
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  current: 'office',
  appearance: 'system',
  customTheme: null,

  setTheme: (theme) => {
    set({ current: theme });
    get().applyTheme();
  },

  setAppearance: (mode) => {
    set({ appearance: mode });
    get().applyTheme();
  },

  setCustomTheme: (vars) => {
    set({ customTheme: vars });
    get().applyTheme();
  },

  applyTheme: () => {
    const { current, appearance, customTheme } = get();
    const vars = customTheme ?? BUILTIN_THEMES[current];
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = appearance === 'dark' || (appearance === 'system' && systemDark);
    root.classList.toggle('dark', isDark);
  },
}));
