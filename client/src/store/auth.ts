'use client';

import { create } from 'zustand';
import type { Player, User } from '@/types/game';
import { api } from '@/lib/api';

interface AuthState {
  user: User | null;
  player: Player | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  setAuth: (userOrToken: User | string | null, player?: Player | null) => void;
  setPlayer: (player: Player) => void;
  refreshPlayer: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  player: null,
  token: readToken(),
  loading: false,
  error: null,

  setAuth: (userOrToken, player) => {
    if (typeof userOrToken === 'string') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', userOrToken);
      }
      set({ token: userOrToken, player: player ?? get().player, error: null });
      return;
    }
    set({ user: userOrToken, player: player ?? null, error: null });
  },

  setPlayer: (player) => set({ player }),

  refreshPlayer: async () => {
    set({ loading: true, error: null });
    try {
      const player = (await api.me()) as Player;
      set({ player, loading: false, token: readToken() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      set({ error: msg, loading: false });
      if (
        msg.includes('Unauthorized') ||
        msg.includes('401') ||
        msg.includes('not found')
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
    set({ user: null, player: null, token: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

export const useAuth = useAuthStore;
