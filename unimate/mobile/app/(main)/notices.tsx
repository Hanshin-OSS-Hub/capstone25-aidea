import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

interface Notice {
  id: string;
  title: string;
  category: string;
  source: string;
  created_at: string;
  is_bookmarked: boolean;
}

const CATEGORIES = ['전체', '학사', '장학', '행사'] as const;
type Category = (typeof CATEGORIES)[number];

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
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const LIMIT = 20;

function SkeletonItem() {
  return (
    <View style={styles.skeletonItem}>
      <View style={styles.skeletonTag} />
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonMeta} />
    </View>
  );
}

export default function NoticesScreen() {
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<Category>('전체');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const isFetchingMore = useRef(false);

  const fetchNotices = useCallback(async (category: Category, pageNum: number, reset: boolean) => {
    if (reset) {
      setLoading(true);
      setError(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: Record<string, string | number> = { page: pageNum, limit: LIMIT };
      if (category !== '전체') params.category = category;

      const res = await apiClient.get('/api/v1/notices', { params });
      const data = res.data.data;
      const items: Notice[] = data?.items ?? [];
      const hasNextPage: boolean = data?.has_next ?? false;

      if (reset) {
        setNotices(items);
      } else {
        setNotices((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const unique = items.filter((n) => !existingIds.has(n.id));
          return [...prev, ...unique];
        });
      }
      setHasNext(hasNextPage);
      setPage(pageNum);
    } catch {
      if (reset) setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingMore.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotices(activeCategory, 1, true);
    }, [activeCategory]),
  );

  const handleCategoryChange = (cat: Category) => {
    if (cat === activeCategory) return;
    setActiveCategory(cat);
    setNotices([]);
    setPage(1);
    setHasNext(true);
  };

  const handleEndReached = () => {
    if (!hasNext || loadingMore || loading || isFetchingMore.current) return;
    isFetchingMore.current = true;
    fetchNotices(activeCategory, page + 1, false);
  };

  const toggleBookmark = async (id: string) => {
    setNotices((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_bookmarked: !n.is_bookmarked } : n)),
    );
    try {
      await apiClient.post(`/api/v1/notices/${id}/bookmark`);
    } catch {
      setNotices((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_bookmarked: !n.is_bookmarked } : n)),
      );
    }
  };

  const renderItem = ({ item }: { item: Notice }) => {
    const catStyle = getCategoryStyle(item.category);
    return (
      <TouchableOpacity
        style={styles.noticeItem}
        onPress={() => router.push({ pathname: '/(main)/notices/[id]', params: { id: item.id } })}
        activeOpacity={0.7}
      >
        <View style={styles.noticeContent}>
          <View style={[styles.categoryTag, { backgroundColor: catStyle.bg }]}>
            <Text style={[styles.categoryText, { color: catStyle.text }]}>{item.category}</Text>
          </View>
          <Text style={styles.noticeTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.noticeMeta}>
            <Text style={styles.metaText}>{item.source}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => toggleBookmark(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={item.is_bookmarked ? 'heart' : 'heart-outline'}
            size={22}
            color={item.is_bookmarked ? colors.danger : colors.border}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.tabBar}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.tab, activeCategory === cat && styles.tabActive]}
            onPress={() => handleCategoryChange(cat)}
          >
            <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonItem key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.border} />
          <Text style={styles.emptyText}>공지를 불러오지 못했어요.</Text>
          <TouchableOpacity onPress={() => fetchNotices(activeCategory, 1, true)} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={notices.length === 0 ? styles.emptyContainer : styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="document-text-outline" size={40} color={colors.border} />
              <Text style={styles.emptyText}>공지사항이 없습니다.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  listContent: { paddingVertical: spacing.sm },
  emptyContainer: { flexGrow: 1 },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },

  noticeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  noticeContent: { flex: 1, gap: 6 },
  categoryTag: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  categoryText: { fontSize: 11, fontWeight: '700' },
  noticeTitle: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20, fontWeight: '500' },
  noticeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: fontSize.xs, color: colors.textSecondary },
  metaDot: { fontSize: fontSize.xs, color: colors.border },

  fullLoader: { flex: 1, justifyContent: 'center' },
  footerLoader: { paddingVertical: spacing.lg },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    marginTop: spacing.xs,
  },
  retryText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },

  skeletonList: { padding: spacing.lg, gap: spacing.md },
  skeletonItem: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeletonTag: { width: 48, height: 18, backgroundColor: colors.border, borderRadius: borderRadius.sm },
  skeletonTitle: { width: '80%', height: 16, backgroundColor: colors.border, borderRadius: borderRadius.sm },
  skeletonMeta: { width: '50%', height: 12, backgroundColor: colors.border, borderRadius: borderRadius.sm },
});
