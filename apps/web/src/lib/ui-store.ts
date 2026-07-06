import { create } from 'zustand';

interface UiState {
  dark: boolean;
  sidebarOpen: boolean;
  /** Id of the task shown in the global task-detail pop-up (null = closed). */
  taskDetailId: string | null;
  toggleDark: () => void;
  toggleSidebar: () => void;
  openTask: (id: string) => void;
  closeTask: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  dark: false,
  sidebarOpen: false,
  taskDetailId: null,
  toggleDark: () =>
    set((s) => {
      document.documentElement.classList.toggle('dark', !s.dark);
      return { dark: !s.dark };
    }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openTask: (id) => set({ taskDetailId: id }),
  closeTask: () => set({ taskDetailId: null }),
}));
