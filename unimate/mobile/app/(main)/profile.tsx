import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '@/api/client';
import { tokenStorage } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface UserDetail {
  id: number;
  name: string;
  department: string;
  grade: number;
  student_id: string;
  email: string;
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function maskStudentId(id: string): string {
  if (id.length <= 5) return id;
  return id.slice(0, 5) + '****';
}

// ─── 메뉴 아이템 ──────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  labelColor?: string;
  onPress: () => void;
  isLast?: boolean;
}

function MenuItem({ icon, iconColor, label, labelColor, onPress, isLast }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={styles.menuLeft}>
        <View style={[styles.menuIconBox, { backgroundColor: iconColor ? `${iconColor}18` : colors.primaryLight }]}>
          <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />
        </View>
        <Text style={[styles.menuLabel, labelColor ? { color: labelColor } : undefined]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.border} />
    </TouchableOpacity>
  );
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { clearUser } = useAuthStore();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // ── 유저 정보 패치 ────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          const res = await apiClient.get('/api/v1/users/me');
          setUser(res.data.data);
        } catch {
          // 에러 무시 (스토어 데이터로 fallback)
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

  // ── 로그아웃 ──────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await tokenStorage.delete();
          clearUser();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // ── 회원탈퇴 ──────────────────────────────────────────────────────────────

  const handleWithdraw = () => {
    Alert.alert(
      '회원탈퇴',
      '정말 탈퇴하시겠습니까?\n모든 데이터가 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete('/api/v1/users/me');
            } catch {
              // 탈퇴 API 실패해도 로컬 로그아웃 진행
            }
            await tokenStorage.delete();
            clearUser();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} />
          ) : (
            <>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user?.name ?? '?')[0]}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.name ?? '-'}</Text>
                <Text style={styles.profileSub}>{user?.department} · {user?.grade}학년</Text>
                <View style={styles.studentIdRow}>
                  <Ionicons name="card-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.studentIdText}>
                    {user?.student_id ? maskStudentId(user.student_id) : '--------'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 메뉴 그룹 1 */}
        <Text style={styles.groupLabel}>활동</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            icon="heart-outline"
            label="관심 공지 모아보기"
            onPress={() => router.push('/(main)/notices/bookmarks')}
          />
          <MenuItem
            icon="notifications-outline"
            label="알림 설정"
            onPress={() => router.push('/(main)/profile/notification')}
            isLast
          />
        </View>

        {/* 메뉴 그룹 2 */}
        <Text style={styles.groupLabel}>계정</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            icon="lock-closed-outline"
            label="비밀번호 변경"
            onPress={() => router.push('/(main)/profile/password')}
          />
          <MenuItem
            icon="log-out-outline"
            iconColor="#F59E0B"
            label="로그아웃"
            onPress={handleLogout}
          />
          <MenuItem
            icon="trash-outline"
            iconColor={colors.danger}
            label="회원탈퇴"
            labelColor={colors.danger}
            onPress={handleWithdraw}
            isLast
          />
        </View>

        {/* 앱 버전 */}
        <Text style={styles.version}>v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },

  profileCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...cardShadow,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: fontSize.xl, fontWeight: '800', color: colors.white },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  profileSub: { fontSize: fontSize.sm, color: colors.textSecondary },
  studentIdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  studentIdText: { fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1 },

  groupLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: -spacing.xs,
    paddingHorizontal: 4,
  },

  menuGroup: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...cardShadow,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },

  version: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.border,
    marginTop: spacing.sm,
  },
});
