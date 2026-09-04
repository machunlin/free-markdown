import { create } from 'zustand';

interface SearchState {
  isOpen: boolean;
  query: string;
  replaceWith: string;
  caseSensitive: boolean;
  regex: boolean;
  matchCount: number;
  currentMatch: number;
  openRequest: number;

  open: () => void;
  close: () => void;
  setQuery: (q: string) => void;
  setReplaceWith: (r: string) => void;
  toggleCaseSensitive: () => void;
  toggleRegex: () => void;
  setMatchCount: (n: number) => void;
  setCurrentMatch: (n: number) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  query: '',
  replaceWith: '',
  caseSensitive: false,
  regex: false,
  matchCount: 0,
  currentMatch: 0,
  openRequest: 0,

  open: () => set((state) => ({ isOpen: true, openRequest: state.openRequest + 1 })),
  close: () => set({ isOpen: false, query: '', replaceWith: '' }),
  setQuery: (query) => set({ query }),
  setReplaceWith: (replaceWith) => set({ replaceWith }),
  toggleCaseSensitive: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  toggleRegex: () => set((s) => ({ regex: !s.regex })),
  setMatchCount: (matchCount) => set({ matchCount }),
  setCurrentMatch: (currentMatch) => set({ currentMatch }),
}));
