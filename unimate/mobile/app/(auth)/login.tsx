import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

import { apiClient } from '@/api/client';
import { tokenStorage } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const { data: res } = await apiClient.post('/api/v1/auth/login', {
        username: username.trim(),
        password,
      });

      const { access_token, refresh_token, user } = res.data;

      setTokens(access_token);
      await tokenStorage.save(refresh_token);
      setUser(user);

      router.replace('/(main)/home');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* 로고 영역 */}
        <View style={styles.logoArea}>
          <Text style={styles.appName}>CampusAI</Text>
          <Text style={styles.appSub}>대학생 AI 도우미</Text>
        </View>

        {/* 입력 폼 */}
        <View style={styles.form}>
          {/* 아이디 */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, usernameFocused && styles.inputFocused]}
              placeholder="아이디"
              placeholderTextColor={colors.textSecondary}
              value={username}
              onChangeText={(v) => { setUsername(v); setError(''); }}
              onFocus={() => setUsernameFocused(true)}
              onBlur={() => setUsernameFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* 비밀번호 */}
          <View style={styles.inputWrapper}>
            <View style={[styles.input, styles.passwordRow, passwordFocused && styles.inputFocused]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="비밀번호"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* 에러 메시지 */}
          {error !== '' && <Text style={styles.errorText}>{error}</Text>}

          {/* 로그인 버튼 */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>로그인</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 하단 링크 */}
        <View style={styles.linkRow}>
          <TouchableOpacity>
            <Text style={styles.linkText}>아이디 찾기</Text>
          </TouchableOpacity>
          <Text style={styles.linkDivider}>|</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>비밀번호 찾기</Text>
          </TouchableOpacity>
          <Text style={styles.linkDivider}>|</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={[styles.linkText, styles.signupText]}>회원가입</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  logoArea: {
    alignItems: 'center',
    marginTop: 100,
    marginBottom: 56,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  appSub: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.sm,
  },
  inputWrapper: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.white,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.text,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: -spacing.xs,
    marginLeft: 2,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  linkText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  linkDivider: {
    color: colors.border,
    fontSize: fontSize.sm,
  },
  signupText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
