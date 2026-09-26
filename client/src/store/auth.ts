'use client';

import { create } from 'zustand';
import type { Player, User } from '@/types/game';
import { api } from '@/lib/api';

interface AuthState {
  user: User | null;
  player: Player | null;
  loading: boolean;
  error: string | null;
  setAuth: (user: User | null, player: Player | null) => void;
  refreshPlayer: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  player: null,
  loading: false,
  error: null,

  setAuth: (user, player) => set({ user, player, error: null }),

  refreshPlayer: async () => {
    set({ loading: true, error: null });
    try {
      const player = (await api.me()) as Player;
      set({ player, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
      if (
        e.message?.includes('Unauthorized') ||
        e.message?.includes('401') ||
        e.message?.includes('not found')
      ) {
        get().logout();
      }
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    set({ user: null, player: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
