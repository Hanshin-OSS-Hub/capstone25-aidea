import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/authStore';

const REFRESH_TOKEN_KEY = 'unimate_refresh_token';

export const tokenStorage = {
  save: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  get: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  delete: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};

export function useAuth() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/(main)/home');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isLoggedIn]);
}
