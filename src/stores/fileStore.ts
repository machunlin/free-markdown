import { create } from 'zustand';
import { v4 as uuid } from './uuid';
import type { Tab } from '../types';
import { WELCOME_DOCUMENT } from '../content/welcomeDocument';

interface FileState {
  tabs: Tab[];
  activeTabId: string | null;
  recentFiles: string[];
  closedTabs: Tab[];

  openFile: (path: string, content: string, encoding: string) => string;
  createNewTab: () => string;
  closeTab: (tabId: string) => void;
  reopenClosedTab: () => string | null;
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  markTabClean: (tabId: string, originalContent: string) => void;
  updateTabPath: (tabId: string, path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  updateTabCursor: (tabId: string, line: number, column: number) => void;
  updateTabScroll: (tabId: string, scrollPosition: number) => void;
  setRecentFiles: (files: string[]) => void;
  getActiveTab: () => Tab | undefined;
  ensureWelcomeTab: () => string;
}

const MAX_TABS = 20;
const MAX_CLOSED_TABS = 10;

const createTab = (id: string, title: string, content = ''): Tab => ({
  id,
  path: null,
  title,
  content,
  originalContent: content,
  encoding: 'UTF-8',
  isDirty: false,
  cursor: { line: 0, column: 0 },
  scrollPosition: 0,
  hibernated: false,
});

export const useFileStore = create<FileState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  recentFiles: [],
  closedTabs: [],

  openFile: (path, content, encoding) => {
    const existing = get().tabs.find((tab) => tab.path === path);
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const id = uuid();
    if (get().tabs.length >= MAX_TABS) return get().activeTabId ?? id;
    const tab: Tab = {
      ...createTab(id, path.split('/').pop() || 'Untitled', content),
      path,
      encoding,
    };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: id }));
    return id;
  },

  createNewTab: () => {
    const id = uuid();
    if (get().tabs.length >= MAX_TABS) return get().activeTabId ?? id;
    const untitledNum = get().tabs.filter((tab) => tab.path === null).length + 1;
    set((state) => ({
      tabs: [...state.tabs, createTab(id, `Untitled-${untitledNum}`)],
      activeTabId: id,
    }));
    return id;
  },

  closeTab: (tabId) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0) return state;
      const tab = state.tabs[index];
      if (!tab) return state;
      const tabs = state.tabs.filter((item) => item.id !== tabId);
      let activeTabId = state.activeTabId;
      if (activeTabId === tabId) {
        activeTabId = tabs[Math.min(index, tabs.length - 1)]?.id ?? null;
      }
      return {
        tabs,
        activeTabId,
        closedTabs: [tab, ...state.closedTabs].slice(0, MAX_CLOSED_TABS),
      };
    });
  },

  reopenClosedTab: () => {
    const tab = get().closedTabs[0];
    if (!tab || get().tabs.length >= MAX_TABS) return null;
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      closedTabs: state.closedTabs.slice(1),
    }));
    return tab.id;
  },

  setActiveTab: (tabId) => set((state) =>
    state.tabs.some((tab) => tab.id === tabId) ? { activeTabId: tabId } : state
  ),

  updateTabContent: (tabId, content) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === tabId
      ? { ...tab, content, isDirty: content !== tab.originalContent }
      : tab),
  })),

  markTabClean: (tabId, originalContent) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === tabId
      ? { ...tab, originalContent, isDirty: false }
      : tab),
  })),

  updateTabPath: (tabId, path) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === tabId
      ? { ...tab, path, title: path.split('/').pop() || tab.title }
      : tab),
  })),

  reorderTabs: (fromIndex, toIndex) => set((state) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 ||
        fromIndex >= state.tabs.length || toIndex >= state.tabs.length) return state;
    const tabs = [...state.tabs];
    const [tab] = tabs.splice(fromIndex, 1);
    if (!tab) return state;
    tabs.splice(toIndex, 0, tab);
    return { tabs };
  }),

  updateTabCursor: (tabId, line, column) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === tabId
      ? { ...tab, cursor: { line, column } }
      : tab),
  })),

  updateTabScroll: (tabId, scrollPosition) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === tabId ? { ...tab, scrollPosition } : tab),
  })),

  setRecentFiles: (recentFiles) => set({ recentFiles }),
  ensureWelcomeTab: () => {
    const existing = get().tabs.find((tab) => tab.id === 'welcome');
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const tab: Tab = {
      ...createTab('welcome', '开始使用', WELCOME_DOCUMENT),
      id: 'welcome',
    };
    set((state) => ({ tabs: [tab, ...state.tabs], activeTabId: tab.id }));
    return tab.id;
  },
  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((tab) => tab.id === activeTabId);
  },
}));
