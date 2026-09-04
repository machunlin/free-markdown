import { create } from 'zustand';
import type { AppSettings } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  autoSave: false,
  autoSaveInterval: 30000,
  defaultEncoding: 'UTF-8',
  recentFilesLimit: 20,
  editorFontFamily: '"SF Mono", Menlo, Monaco, monospace',
  editorFontSize: 14,
  editorLineHeight: 1.6,
  editorTabSize: 4,
  editorShowLineNumbers: true,
  editorWordWrap: true,
  previewMarkdownMode: 'gfm',
  previewFontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
  previewFontSize: 15,
  previewLineHeight: 1.7,
  previewAllowHtml: false,
  previewMaxWidth: 740,
  theme: 'office',
  appearance: 'system',
  markdownTypographer: true,
  markdownBreaks: false,
  markdownLinkify: true,
};

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  updateSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),
  resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),
}));
