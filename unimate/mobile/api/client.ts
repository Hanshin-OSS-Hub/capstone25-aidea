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

// ── 뮤텍스 ────────────────────────────────────────────────────────────────────
// 진행 중인 토큰 갱신 Promise를 저장. null이면 갱신 중 아님.
// 401이 동시에 여러 개 와도 갱신은 딱 1번만 실행되고 나머지는 이걸 기다림.
let refreshingPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStorage.get();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      { refresh_token: refreshToken },
    );
    const newAccessToken: string = data.data.access_token;
    const newRefreshToken: string = data.data.refresh_token;
    useAuthStore.getState().setTokens(newAccessToken);
    await tokenStorage.save(newRefreshToken);
    return newAccessToken;
  } catch {
    await tokenStorage.delete();
    return null;
  }
}

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

      // 갱신 중이 아니면 새로 시작, 이미 갱신 중이면 그 Promise를 공유
      if (!refreshingPromise) {
        refreshingPromise = refreshAccessToken().finally(() => {
          refreshingPromise = null;
        });
      }

      const newAccessToken = await refreshingPromise;

      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      }

      useAuthStore.getState().clearUser();
      expoRouter.replace('/(auth)/login');
    }

    return Promise.reject(error);
  },
);
