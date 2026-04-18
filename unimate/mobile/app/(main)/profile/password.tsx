import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '@/api/client';
import { tokenStorage } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

export default function PasswordChangeScreen() {
  const router = useRouter();
  const { clearUser } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [currentError, setCurrentError] = useState('');
  const [newError, setNewError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const validateNew = (v: string) => {
    if (!v) return '새 비밀번호를 입력해주세요.';
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(v)) return '영문+숫자 조합 8자 이상으로 입력해주세요.';
    return '';
  };

  const validateConfirm = (v: string, pw: string) => {
    if (!v) return '비밀번호 확인을 입력해주세요.';
    if (v !== pw) return '비밀번호가 일치하지 않습니다.';
    return '';
  };

  const handleSubmit = async () => {
    const newErr = validateNew(newPassword);
    const confirmErr = validateConfirm(confirmPassword, newPassword);

    if (!currentPassword) setCurrentError('현재 비밀번호를 입력해주세요.');
    setNewError(newErr);
    setConfirmError(confirmErr);

    if (!currentPassword || newErr || confirmErr) return;

    setIsLoading(true);
    try {
      await apiClient.post('/api/v1/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      Alert.alert('완료', '비밀번호가 변경됐습니다.\n다시 로그인해주세요.', [
        {
          text: '확인',
          onPress: async () => {
            await tokenStorage.delete();
            clearUser();
            router.replace('/(auth)/login');
          },
        },
      ]);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        const res = (e as { response?: { status?: number } }).response;
        if (res?.status === 401) {
          setCurrentError('현재 비밀번호가 올바르지 않습니다.');
          return;
        }
      }
      Alert.alert('오류', '비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>비밀번호 변경</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 현재 비밀번호 */}
          <Field label="현재 비밀번호">
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.flex, currentError ? styles.inputError : undefined]}
                placeholder="현재 비밀번호를 입력해주세요"
                placeholderTextColor={colors.textSecondary}
                value={currentPassword}
                onChangeText={(v) => { setCurrentPassword(v); setCurrentError(''); }}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrent((p) => !p)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {currentError ? <Text style={styles.errorText}>{currentError}</Text> : null}
          </Field>

          {/* 새 비밀번호 */}
          <Field label="새 비밀번호">
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.flex, newError ? styles.inputError : undefined]}
                placeholder="영문+숫자 조합 8자 이상"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  setNewError(validateNew(v));
                  if (confirmPassword) setConfirmError(validateConfirm(confirmPassword, v));
                }}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNew((p) => !p)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showNew ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {newError ? <Text style={styles.errorText}>{newError}</Text> : null}
          </Field>

          {/* 새 비밀번호 확인 */}
          <Field label="새 비밀번호 확인">
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.flex, confirmError ? styles.inputError : undefined]}
                placeholder="새 비밀번호를 다시 입력해주세요"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setConfirmError(validateConfirm(v, newPassword));
                }}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirm((p) => !p)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
          </Field>

          <Text style={styles.notice}>
            비밀번호 변경 후 모든 기기에서 자동으로 로그아웃됩니다.
          </Text>

          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.submitButtonText}>변경하기</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },

  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 48,
    gap: spacing.xs,
  },

  field: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },

  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    paddingRight: 12,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  eyeButton: { padding: 4 },
  errorText: { fontSize: fontSize.xs, color: colors.danger, marginTop: 4 },

  notice: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 18,
  },

  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
});
