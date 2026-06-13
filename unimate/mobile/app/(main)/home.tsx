import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';
import RecommendedNoticesDashboard from '@/components/RecommendedNoticesDashboard';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface SummaryData {
  pendingAssignments: number;
  nextExamDday: number | null;
}

interface DailySummary {
  text: string;
}

interface UpcomingSchedule {
  id: string;
  title: string;
  date: string;
  time: string | null;
  category: string;
  is_completed: boolean;
}

// ─── 날짜 헬퍼 ────────────────────────────────────────────────────────────────

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function getTodayLabel(): string {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  const [upcomingModal, setUpcomingModal] = useState<'과제' | '시험' | null>(null);
  const [upcomingList, setUpcomingList] = useState<UpcomingSchedule[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

  // ── 데이터 페치 ──────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setSummaryLoading(true);
    setAiLoading(true);
    setSummaryError(false);
    setAiError(false);

    await Promise.all([
      (async () => {
        try {
          const [pendingRes, examRes] = await Promise.all([
            apiClient.get('/api/v1/schedules/count', { params: { category: '과제' } }),
            apiClient.get('/api/v1/schedules/next-exam'),
          ]);
          setSummary({
            pendingAssignments: pendingRes.data.data?.count ?? 0,
            nextExamDday: examRes.data.data?.dday ?? null,
          });
        } catch {
          setSummaryError(true);
        } finally {
          setSummaryLoading(false);
        }
      })(),

      (async () => {
        try {
          const res = await apiClient.get('/api/v1/chat/daily-summary');
          setDailySummary({ text: res.data.data?.summary ?? '' });
        } catch {
          setAiError(true);
        } finally {
          setAiLoading(false);
        }
      })(),
    ]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const openUpcomingModal = useCallback(async (category: '과제' | '시험') => {
    setUpcomingModal(category);
    setUpcomingLoading(true);
    try {
      const res = await apiClient.get('/api/v1/schedules/upcoming', { params: { category } });
      setUpcomingList(res.data.data ?? []);
    } catch {
      setUpcomingList([]);
    } finally {
      setUpcomingLoading(false);
    }
  }, []);

  const handleCompleteFromModal = useCallback(async (item: UpcomingSchedule) => {
    setUpcomingList((prev) => prev.filter((s) => s.id !== item.id));
    setSummary((prev) => prev ? { ...prev, pendingAssignments: Math.max(0, prev.pendingAssignments - 1) } : prev);
    try {
      await apiClient.put(`/api/v1/schedules/${item.id}`, { is_completed: true });
    } catch {
      setUpcomingList((prev) => [item, ...prev]);
      setSummary((prev) => prev ? { ...prev, pendingAssignments: prev.pendingAssignments + 1 } : prev);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setDashboardRefreshKey((k: number) => k + 1);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── 헤더 ──────────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>안녕하세요, {user?.name ?? ''}님 👋</Text>
            <Text style={styles.today}>{getTodayLabel()}</Text>
          </View>
          <TouchableOpacity style={styles.bellWrapper} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── AI 오늘의 브리핑 ───────────────────────────────────────────────── */}
        <View style={styles.briefingCard}>
          <View style={styles.briefingHeader}>
            <View style={styles.briefingHeaderLeft}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <Text style={styles.briefingHeaderTitle}>AI 오늘의 브리핑</Text>
            </View>
            <Text style={styles.briefingHeaderDate}>{getTodayLabel()}</Text>
          </View>
          <View style={styles.briefingDivider} />
          <View style={styles.briefingBody}>
            {aiLoading ? (
              <SkeletonLines />
            ) : aiError ? (
              <ErrorRow message="브리핑을 불러오지 못했어요." />
            ) : (
              <Text style={styles.briefingText}>{dailySummary?.text ?? ''}</Text>
            )}
          </View>
          {!aiLoading && !aiError && (
            <TouchableOpacity
              style={styles.briefingCta}
              onPress={() => router.push('/(main)/chat')}
              activeOpacity={0.8}
            >
              <Text style={styles.briefingCtaText}>AI에게 더 물어보기</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── 요약 카드 그리드 ───────────────────────────────────────────────── */}
        <View style={styles.grid}>
          <SummaryCard
            icon="document-text-outline"
            iconColor="#F59E0B"
            label="남은 과제"
            loading={summaryLoading}
            error={summaryError}
            value={summaryLoading ? null : `${summary?.pendingAssignments ?? 0}개`}
            onPress={() => openUpcomingModal('과제')}
          />
          <SummaryCard
            icon="calendar-outline"
            iconColor={colors.danger}
            label="시험 D-Day"
            loading={summaryLoading}
            error={summaryError}
            value={
              summaryLoading
                ? null
                : summary?.nextExamDday != null
                  ? `D-${summary.nextExamDday}`
                  : '없음'
            }
            onPress={() => openUpcomingModal('시험')}
          />
        </View>

        {/* ── 같은 학과가 많이 본 공지 ──────────────────────────────────────── */}
        <RecommendedNoticesDashboard refreshKey={dashboardRefreshKey} />

      </ScrollView>

      {/* ── 다가오는 일정 모달 ──────────────────────────────────────────────── */}
      <Modal
        visible={!!upcomingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setUpcomingModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setUpcomingModal(null)}
          activeOpacity={1}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {upcomingModal === '과제' ? '📋 남은 과제' : '📝 예정된 시험'}
            </Text>
            <TouchableOpacity onPress={() => setUpcomingModal(null)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {upcomingLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.sheetLoader} />
          ) : upcomingList.length === 0 ? (
            <View style={styles.sheetEmpty}>
              <Ionicons name="calendar-outline" size={32} color={colors.border} />
              <Text style={styles.sheetEmptyText}>
                {upcomingModal === '과제' ? '남은 과제가 없습니다.' : '예정된 시험이 없습니다.'}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {upcomingList.map((item, idx) => {
                const isLast = idx === upcomingList.length - 1;
                const dday = Math.ceil(
                  (new Date(item.date).getTime() - new Date().setHours(0, 0, 0, 0)) /
                    (1000 * 60 * 60 * 24),
                );
                return (
                  <View
                    key={item.id}
                    style={[styles.upcomingItem, !isLast && styles.upcomingItemDivider]}
                  >
                    {upcomingModal === '과제' && (
                      <TouchableOpacity
                        onPress={() => handleCompleteFromModal(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.checkCircle}
                      >
                        <Ionicons name="checkmark-circle-outline" size={22} color={colors.border} />
                      </TouchableOpacity>
                    )}
                    <View style={styles.upcomingLeft}>
                      <Text style={styles.upcomingTitle}>{item.title}</Text>
                      <Text style={styles.upcomingDate}>
                        {item.date.replace(/-/g, '.')}
                        {item.time ? ` ${item.time}` : ''}
                      </Text>
                    </View>
                    <View style={[
                      styles.ddayBadge,
                      dday === 0 && styles.ddayBadgeToday,
                      dday < 0 && styles.ddayBadgePast,
                    ]}>
                      <Text style={[styles.ddayText, dday === 0 && styles.ddayTextToday]}>
                        {dday === 0 ? 'D-Day' : dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string | null;
  loading: boolean;
  error: boolean;
  onPress?: () => void;
}

function SummaryCard({ icon, iconColor, label, value, loading, error, onPress }: SummaryCardProps) {
  const content = (
    <>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={styles.summaryValue}>
        {loading ? '...' : error ? '-' : value}
      </Text>
      <View style={styles.summaryLabelRow}>
        <Text style={styles.summaryLabel}>{label}</Text>
        {onPress && <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.summaryCard} onPress={onPress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.summaryCard}>{content}</View>;
}

function SkeletonLines() {
  return (
    <View style={styles.skeletonWrapper}>
      {[0.9, 1, 0.7].map((w, i) => (
        <View key={i} style={[styles.skeletonLine, { width: `${w * 100}%` }]} />
      ))}
    </View>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
      <Text style={styles.errorRowText}>{message}</Text>
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 32,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  today: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bellWrapper: { position: 'relative', padding: 4 },

  // AI 브리핑
  briefingCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...cardShadow,
  },
  briefingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  briefingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  briefingHeaderTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  briefingHeaderDate: {
    fontSize: fontSize.xs,
    color: colors.primary,
    opacity: 0.7,
  },
  briefingDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  briefingBody: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  briefingText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 26,
  },
  briefingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  briefingCtaText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },

  // 요약 그리드
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: 4,
    ...cardShadow,
  },
  summaryValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  // 스켈레톤
  skeletonWrapper: { gap: spacing.sm },
  skeletonLine: {
    height: 14,
    backgroundColor: colors.border,
    borderRadius: borderRadius.sm,
  },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: 36,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  sheetLoader: { paddingVertical: spacing.xl },
  sheetEmpty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  sheetEmptyText: { fontSize: fontSize.sm, color: colors.textSecondary },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: spacing.sm,
  },
  upcomingItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkCircle: { marginRight: 4 },
  upcomingLeft: { flex: 1, gap: 3 },
  upcomingTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  upcomingDate: { fontSize: fontSize.xs, color: colors.textSecondary },
  ddayBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 48,
    alignItems: 'center',
  },
  ddayBadgeToday: { backgroundColor: colors.danger },
  ddayBadgePast: { backgroundColor: colors.border },
  ddayText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },
  ddayTextToday: { color: colors.white },

  // 에러
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  errorRowText: {
    fontSize: fontSize.sm,
    color: colors.danger,
  },
});
