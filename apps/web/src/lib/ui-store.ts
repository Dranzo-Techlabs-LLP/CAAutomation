import { create } from 'zustand';

interface UiState {
  dark: boolean;
  sidebarOpen: boolean;
  toggleDark: () => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  dark: false,
  sidebarOpen: false,
  toggleDark: () =>
    set((s) => {
      document.documentElement.classList.toggle('dark', !s.dark);
      return { dark: !s.dark };
    }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
