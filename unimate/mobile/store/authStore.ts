import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email?: string;
  department: string;
  grade: number;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isLoggedIn: boolean;
  setTokens: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isLoggedIn: false,
  setTokens: (accessToken) => set({ accessToken, isLoggedIn: true }),
  setUser: (user) => set({ user }),
  clearUser: () => set({ accessToken: null, user: null, isLoggedIn: false }),
}));
