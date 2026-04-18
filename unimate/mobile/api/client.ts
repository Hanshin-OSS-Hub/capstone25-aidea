import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { tokenStorage } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/constants/api';
import { router as expoRouter } from 'expo-router';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = await tokenStorage.get();
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/api/v1/auth/refresh`,
            { refresh_token: refreshToken },
          );
          const newAccessToken: string = data.data.access_token;
          const newRefreshToken: string = data.data.refresh_token;
          useAuthStore.getState().setTokens(newAccessToken);
          await tokenStorage.save(newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        } catch {
          await tokenStorage.delete();
        }
      }

      useAuthStore.getState().clearUser();
      expoRouter.replace('/(auth)/login');
    }

    return Promise.reject(error);
  },
);
