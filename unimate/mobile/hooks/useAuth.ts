import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/authStore';

const REFRESH_TOKEN_KEY = 'unimate_refresh_token';

const isWeb = Platform.OS === 'web';

export const tokenStorage = {
  save: (token: string): Promise<void> => {
    if (isWeb) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },
  get: (): Promise<string | null> => {
    if (isWeb) {
      return Promise.resolve(localStorage.getItem(REFRESH_TOKEN_KEY));
    }
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  delete: (): Promise<void> => {
    if (isWeb) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
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
