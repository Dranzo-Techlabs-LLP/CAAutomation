import { create } from 'zustand';
import { api, setTokens, clearTokens, getAccessToken } from './api';

export interface AuthUser {
  id: string;
  firmId: string;
  email: string;
  name: string;
  roleId: string;
  roleName?: string;
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  login: async (email: string, password: string) => {
    const res = await api<{ accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens(res.accessToken, res.refreshToken);
    await get().loadUser();
  },

  logout: () => {
    clearTokens();
    set({ user: null });
  },

  loadUser: async () => {
    if (!getAccessToken()) {
      set({ user: null, loading: false });
      return;
    }
    try {
      const profile = await api<AuthUser>('/auth/profile');
      set({ user: profile, loading: false });
    } catch {
      clearTokens();
      set({ user: null, loading: false });
    }
  },

  hasPermission: (code: string) => {
    const { user } = get();
    return user?.permissions.includes(code) ?? false;
  },

  hasAnyPermission: (...codes: string[]) => {
    const { user } = get();
    if (!user) return false;
    return codes.some((c) => user.permissions.includes(c));
  },
}));
