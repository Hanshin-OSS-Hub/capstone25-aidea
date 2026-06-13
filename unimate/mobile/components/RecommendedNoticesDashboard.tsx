import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface RecommendedNotice {
  rank: number;
  id: string;
  title: string;
  category: string;
  published_at: string;
}

// ─── 목업 데이터 ───────────────────────────────────────────────────────────────

const MOCK_DAILY: RecommendedNotice[] = [
  { rank: 1, id: '', title: '캡스톤디자인 신청 마감 안내', category: '학사', published_at: '2025-01-14' },
  { rank: 2, id: '', title: '2025년 1학기 장학금 신청 안내', category: '장학', published_at: '2025-01-13' },
  { rank: 3, id: '', title: '취업 특강 참가 신청', category: '취업', published_at: '2025-01-12' },
];

const MOCK_WEEKLY: RecommendedNotice[] = [
  { rank: 1, id: '', title: '2025학년도 수강신청 안내', category: '학사', published_at: '2025-01-10' },
  { rank: 2, id: '', title: '국가장학금 2차 신청 마감 공지', category: '장학', published_at: '2025-01-09' },
  { rank: 3, id: '', title: '봄 축제 행사 참가자 모집', category: '행사', published_at: '2025-01-08' },
];

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const RANK_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32'];
const RANK_BG_COLORS = ['#FEF3C7', '#F3F4F6', '#FEF0DC'];

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  '학사':     { bg: '#EEF2FF', text: '#4F46E5' },
  '장학':     { bg: '#D1FAE5', text: '#059669' },
  '취업':     { bg: '#FEF3C7', text: '#D97706' },
  '행사':     { bg: '#EDE9FE', text: '#7C3AED' },
  '공지사항': { bg: '#EEF2FF', text: '#4F46E5' },
  '개인정보': { bg: '#F3F4F6', text: '#6B7280' },
};

const IS_WIDE = Dimensions.get('window').width >= 768;

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
});

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? { bg: colors.border, text: colors.textSecondary };
}

function formatPublishedAt(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function SkeletonCard({ isLast }: { isLast: boolean }) {
  return (
    <View style={[styles.noticeCard, !isLast && styles.noticeCardDivider]}>
      <View style={styles.skeletonRank} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonLine, { width: '80%' }]} />
        <View style={[styles.skeletonLine, { width: '55%', marginTop: 8 }]} />
      </View>
    </View>
  );
}

function NoticeCard({ notice, isLast, onPress }: { notice: RecommendedNotice; isLast: boolean; onPress: () => void }) {
  const rankColor = RANK_COLORS[notice.rank - 1] ?? colors.textSecondary;
  const rankBg = RANK_BG_COLORS[notice.rank - 1] ?? colors.border;
  const catStyle = getCategoryStyle(notice.category);

  return (
    <TouchableOpacity
      style={[styles.noticeCard, !isLast && styles.noticeCardDivider]}
      onPress={onPress}
      activeOpacity={notice.id ? 0.7 : 1}
    >
      <View style={[styles.rankBadge, { backgroundColor: rankBg }]}>
        <Text style={[styles.rankText, { color: rankColor }]}>{notice.rank}</Text>
      </View>
      <View style={styles.noticeContent}>
        <Text style={styles.noticeTitle} numberOfLines={2}>
          {notice.title}
        </Text>
        <View style={styles.noticeMeta}>
          <View style={[styles.categoryTag, { backgroundColor: catStyle.bg }]}>
            <Text style={[styles.categoryText, { color: catStyle.text }]}>{notice.category}</Text>
          </View>
          <Text style={styles.dateText}>{formatPublishedAt(notice.published_at)}</Text>
        </View>
      </View>
      {notice.id ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface Props {
  refreshKey?: number;
}

export default function RecommendedNoticesDashboard({ refreshKey }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [dailyData, setDailyData] = useState<RecommendedNotice[]>([]);
  const [weeklyData, setWeeklyData] = useState<RecommendedNotice[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [refreshKey]);

  const fetchAll = async () => {
    setDailyLoading(true);
    setWeeklyLoading(true);

    await Promise.all([
      (async () => {
        try {
          const res = await apiClient.get('/api/v1/notices/daily-top3');
          setDailyData(res.data.data ?? MOCK_DAILY);
        } catch {
          setDailyData(MOCK_DAILY);
        } finally {
          setDailyLoading(false);
        }
      })(),
      (async () => {
        try {
          const res = await apiClient.get('/api/v1/notices/weekly-top3');
          setWeeklyData(res.data.data ?? MOCK_WEEKLY);
        } catch {
          setWeeklyData(MOCK_WEEKLY);
        } finally {
          setWeeklyLoading(false);
        }
      })(),
    ]);
  };

  const activeData = activeTab === 'daily' ? dailyData : weeklyData;
  const isLoading = activeTab === 'daily' ? dailyLoading : weeklyLoading;

  return (
    <View style={styles.wrapper}>
      {/* 섹션 헤더 */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="flame-outline" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>같은 학과가 많이 본 공지</Text>
        </View>
      </View>

      {/* 카드 */}
      <View style={[styles.card, IS_WIDE && styles.cardWide]}>
        {/* 탭 버튼 */}
        <View style={[styles.tabRow, IS_WIDE && styles.tabRowWide]}>
          <TouchableOpacity
            style={[styles.tabButton, !IS_WIDE && styles.tabButtonFlex, activeTab === 'daily' && styles.tabButtonActive]}
            onPress={() => setActiveTab('daily')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>
              일간 TOP 3
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, !IS_WIDE && styles.tabButtonFlex, activeTab === 'weekly' && styles.tabButtonActive]}
            onPress={() => setActiveTab('weekly')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
              주간 TOP 3
            </Text>
          </TouchableOpacity>
        </View>

        {/* 구분선 */}
        <View style={styles.tabDivider} />

        {/* 공지 목록 */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <>
              <SkeletonCard isLast={false} />
              <SkeletonCard isLast={false} />
              <SkeletonCard isLast />
            </>
          ) : activeData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="bar-chart-outline" size={28} color={colors.border} />
              <Text style={styles.emptyText}>아직 집계된 데이터가 없습니다</Text>
            </View>
          ) : (
            activeData.map((notice, idx) => (
              <NoticeCard
                key={`${activeTab}-${notice.rank}`}
                notice={notice}
                isLast={idx === activeData.length - 1}
                onPress={() => {
                  if (notice.id) router.push(`/(main)/notices/${notice.id}` as any);
                }}
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },

  // 섹션 헤더
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },

  // 카드
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardWide: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 800,
  },

  // 탭
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  tabRowWide: {
    justifyContent: 'flex-start',
  },
  tabButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
  },
  tabButtonFlex: {
    flex: 1,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.md,
  },

  // 공지 목록
  listContainer: {
    paddingHorizontal: spacing.md,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: spacing.md,
  },
  noticeCardDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // 순위 배지
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rankText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },

  // 공지 내용
  noticeContent: {
    flex: 1,
    gap: 6,
  },
  noticeTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  noticeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryTag: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewCountText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },

  // 빈 상태
  emptyContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // 스켈레톤
  skeletonRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    flexShrink: 0,
  },
  skeletonContent: {
    flex: 1,
    paddingTop: 4,
  },
  skeletonLine: {
    height: 13,
    backgroundColor: colors.border,
    borderRadius: borderRadius.sm,
  },
});
