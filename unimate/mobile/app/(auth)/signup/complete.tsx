import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';

import { apiClient } from '@/api/client';
import { tokenStorage } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

const INTEREST_TAGS = ['장학', '공모전', '교내행사', '취업', '수업', '시설'];

export default function SignupCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    username: string;
    password: string;
    name: string;
    birthdate: string;
    phone: string;
    department: string;
    studentId: string;
    grade: string;
    email: string;
  }>();

  const { setTokens, setUser } = useAuthStore();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleRegister = async () => {
    setError('');
    setIsLoading(true);

    try {
      const { data } = await apiClient.post('/api/v1/auth/register', {
        username: params.username,
        password: params.password,
        name: params.name,
        birthdate: params.birthdate,
        phone: params.phone,
        department: params.department,
        student_number: params.studentId,
        grade: Number(params.grade),
        email: params.email,
        interest_tags: selectedTags,
      });

      const { access_token, refresh_token, user } = data;

      setTokens(access_token);
      await tokenStorage.save(refresh_token);
      setUser(user);

      router.replace('/(main)/home');
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setError('이미 가입된 계정입니다.');
      } else {
        setError('가입에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 진행 바 */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '100%' }]} />
      </View>
      <Text style={styles.progressLabel}>3 / 3 단계</Text>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>관심 분야 선택</Text>
        <Text style={styles.subtitle}>관심 있는 분야를 선택해주세요.</Text>
        <Text style={styles.description}>선택한 분야의 공지를 먼저 알려드려요.</Text>

        {/* 태그 선택 */}
        <View style={styles.tagGrid}>
          {INTEREST_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, active && styles.tagActive]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.75}
              >
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedTags.length > 0 && (
          <Text style={styles.selectedCount}>{selectedTags.length}개 선택됨</Text>
        )}

        {error !== '' && <Text style={styles.errorText}>{error}</Text>}

        {/* 가입 완료 버튼 */}
        <TouchableOpacity
          style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.registerButtonText}>가입 완료</Text>
          }
        </TouchableOpacity>

        <Text style={styles.skipHint}>관심 분야는 나중에 프로필에서 변경할 수 있어요.</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  progressBar: { height: 4, backgroundColor: colors.border },
  progressFill: { height: 4, backgroundColor: colors.primary },
  progressLabel: {
    textAlign: 'right',
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 48,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tag: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  tagActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  tagTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  selectedCount: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  registerButtonDisabled: { opacity: 0.7 },
  registerButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  skipHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
