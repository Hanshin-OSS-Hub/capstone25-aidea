import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { tokenStorage } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/api/client';
import { API_BASE_URL } from '@/constants/api';
import { colors } from '@/constants/theme';

export default function Index() {
  const router = useRouter();
  const { setTokens, setUser, clearUser } = useAuthStore();

  useEffect(() => {
    (async () => {
      const refreshToken = await tokenStorage.get();

      if (!refreshToken) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        // 1. Refresh Token으로 새 Access Token 발급
        const { data: res } = await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          { refresh_token: refreshToken },
        );
        const { access_token, refresh_token: newRefresh } = res.data;

        setTokens(access_token);
        await tokenStorage.save(newRefresh);

        // 2. Access Token으로 user 정보 복원
        const userRes = await apiClient.get('/api/v1/users/me');
        const u = userRes.data.data;
        setUser({
          id: u.id,
          name: u.name,
          email: u.email,
          department: u.department,
          grade: u.grade,
        });

        router.replace('/(main)/home');
      } catch {
        // Refresh Token 만료 또는 오류 → 로그인 화면
        await tokenStorage.delete();
        clearUser();
        router.replace('/(auth)/login');
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
