import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Linking,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface NoticeDetail {
  id: number;
  title: string;
  category: string;
  source: string;
  created_at: string;
  content: string;
  is_bookmarked: boolean;
  source_url?: string;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  학사: { bg: '#DBEAFE', text: '#1D4ED8' },
  장학: { bg: '#D1FAE5', text: '#065F46' },
  행사: { bg: '#FEF3C7', text: '#92400E' },
  기타: { bg: colors.primaryLight, text: colors.primary },
};

function getCategoryStyle(cat: string) {
  return CATEGORY_STYLE[cat] ?? CATEGORY_STYLE['기타'];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState('');

  const show = (msg: string) => {
    setMessage(msg);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const Toast = () =>
    message ? (
      <Animated.View style={[styles.toast, { opacity }]}>
        <Ionicons name="checkmark-circle" size={16} color={colors.white} />
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    ) : null;

  return { show, Toast };
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { show, Toast } = useToast();

  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [noticeError, setNoticeError] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  // ── 데이터 패치 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;

    // 공지 상세
    (async () => {
      try {
        const res = await apiClient.get(`/api/v1/notices/${id}`);
        setNotice(res.data.data);
      } catch {
        setNoticeError(true);
      } finally {
        setNoticeLoading(false);
      }
    })();

    // AI 요약 (독립 패치)
    (async () => {
      try {
        const res = await apiClient.get(`/api/v1/notices/${id}/summary`);
        setSummary(res.data.data?.summary ?? '');
      } catch {
        setSummary('');
      } finally {
        setSummaryLoading(false);
      }
    })();
  }, [id]);

  // ── 북마크 토글 ──────────────────────────────────────────────────────────────

  const toggleBookmark = async () => {
    if (!notice) return;
    const next = !notice.is_bookmarked;
    setNotice((prev) => prev && { ...prev, is_bookmarked: next });
    try {
      await apiClient.post(`/api/v1/notices/${id}/bookmark`);
      show(next ? '북마크에 추가됐어요.' : '북마크를 해제했어요.');
    } catch {
      setNotice((prev) => prev && { ...prev, is_bookmarked: !next });
    }
  };

  // ── 관심활동 추가 ────────────────────────────────────────────────────────────

  const handleAddActivity = async () => {
    if (!notice || activityLoading) return;
    setActivityLoading(true);
    try {
      await apiClient.post('/api/v1/activities', {
        notice_id: notice.id,
        title: notice.title,
        category: notice.category,
      });
      show('관심활동에 추가됐어요!');
    } catch {
      show('추가에 실패했어요. 다시 시도해주세요.');
    } finally {
      setActivityLoading(false);
    }
  };

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  if (noticeLoading) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (noticeError || !notice) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.border} />
        <Text style={styles.errorText}>공지를 불러오지 못했어요.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catStyle = getCategoryStyle(notice.category);

  return (
    <SafeAreaView style={styles.screen}>
      {/* 상단 네비 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>공지사항</Text>
        <TouchableOpacity onPress={toggleBookmark} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={notice.is_bookmarked ? 'heart' : 'heart-outline'}
            size={24}
            color={notice.is_bookmarked ? colors.danger : colors.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* AI 요약 카드 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="sparkles" size={14} color={colors.white} />
            <Text style={styles.summaryLabel}>AI 요약</Text>
          </View>
          {summaryLoading ? (
            <View style={styles.skeletonWrapper}>
              {[1, 0.85, 0.6].map((w, i) => (
                <View key={i} style={[styles.skeletonLine, { width: `${w * 100}%` }]} />
              ))}
            </View>
          ) : summary ? (
            <Text style={styles.summaryText}>{summary}</Text>
          ) : (
            <Text style={styles.summaryEmpty}>요약을 불러오지 못했어요.</Text>
          )}
        </View>

        {/* 메타 정보 */}
        <View style={styles.meta}>
          <View style={[styles.categoryTag, { backgroundColor: catStyle.bg }]}>
            <Text style={[styles.categoryText, { color: catStyle.text }]}>{notice.category}</Text>
          </View>
          <Text style={styles.noticeTitle}>{notice.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{notice.source}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{formatDate(notice.created_at)}</Text>
          </View>
          <View style={styles.divider} />
        </View>

        {/* 본문 */}
        <Text style={styles.content}>{notice.content}</Text>

        {notice.source_url ? (
          <TouchableOpacity
            style={styles.sourceUrlButton}
            onPress={() => Linking.openURL(notice.source_url!)}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={16} color={colors.primary} />
            <Text style={styles.sourceUrlText}>원문 보기</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.bookmarkBtn]}
          onPress={toggleBookmark}
          activeOpacity={0.8}
        >
          <Ionicons
            name={notice.is_bookmarked ? 'heart' : 'heart-outline'}
            size={18}
            color={notice.is_bookmarked ? colors.danger : colors.text}
          />
          <Text style={[styles.bottomBtnText, notice.is_bookmarked && { color: colors.danger }]}>
            {notice.is_bookmarked ? '북마크됨' : '북마크'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomBtn, styles.activityBtn, activityLoading && styles.btnDisabled]}
          onPress={handleAddActivity}
          disabled={activityLoading}
          activeOpacity={0.85}
        >
          {activityLoading
            ? <ActivityIndicator size="small" color={colors.white} />
            : (
              <>
                <Ionicons name="add-circle-outline" size={18} color={colors.white} />
                <Text style={[styles.bottomBtnText, { color: colors.white }]}>관심활동 추가</Text>
              </>
            )
          }
        </TouchableOpacity>
      </View>

      {/* Toast */}
      <Toast />
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

  // 네비
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.md,
  },

  // 스크롤
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },

  // AI 요약
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...cardShadow,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: fontSize.sm,
    color: colors.white,
    lineHeight: 22,
  },
  summaryEmpty: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  skeletonWrapper: { gap: 8 },
  skeletonLine: {
    height: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.sm,
  },

  // 메타
  meta: { marginBottom: spacing.md, gap: spacing.sm },
  categoryTag: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: { fontSize: 12, fontWeight: '700' },
  noticeTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 28,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: fontSize.xs, color: colors.textSecondary },
  metaDot: { fontSize: fontSize.xs, color: colors.border },
  divider: { height: 1, backgroundColor: colors.border, marginTop: spacing.sm },

  // 본문
  content: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 24,
  },

  sourceUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
  },
  sourceUrlText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
  },
  bookmarkBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  activityBtn: {
    flex: 2,
    backgroundColor: colors.primary,
  },
  btnDisabled: { opacity: 0.7 },
  bottomBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(17,24,39,0.85)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toastText: { fontSize: fontSize.sm, color: colors.white, fontWeight: '500' },

  // 에러
  fullCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, backgroundColor: colors.background },
  errorText: { fontSize: fontSize.sm, color: colors.textSecondary },
  backButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  backButtonText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
});
