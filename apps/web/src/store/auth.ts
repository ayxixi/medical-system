import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthAccount } from '@/api/auth';

interface AuthState {
  token: string | null;
  account: AuthAccount | null;
  setSession: (token: string, account: AuthAccount) => void;
  setAccount: (account: AuthAccount) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      account: null,
      setSession: (token, account) => set({ token, account }),
      setAccount: (account) => set({ account }),
      clear: () => set({ token: null, account: null }),
    }),
    {
      name: 'medical-system.auth',
      partialize: (state) => ({ token: state.token, account: state.account }),
    },
  ),
);
