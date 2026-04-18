import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { tokenStorage } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const refreshToken = await tokenStorage.get();
      if (refreshToken) {
        router.replace('/(main)/home');
      } else {
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
