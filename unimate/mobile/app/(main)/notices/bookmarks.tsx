import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Notice {
  id: string;
  title: string;
  category: string;
  published_at: string | null;
  source_type: string;
  is_bookmarked: boolean;
}

const INTEREST_TAGS = [
  '학술', '문화', '체육', '봉사', '창업', '취업', '장학', '교환학생', '기타',
];

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  학사: { bg: '#DBEAFE', text: '#1D4ED8' },
  장학: { bg: '#D1FAE5', text: '#065F46' },
  행사: { bg: '#FEF3C7', text: '#92400E' },
  기타: { bg: colors.primaryLight, text: colors.primary },
};

function getCategoryStyle(cat: string) {
  return CATEGORY_STYLE[cat] ?? CATEGORY_STYLE['기타'];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '날짜 없음';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '날짜 없음';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 탭 ───────────────────────────────────────────────────────────────────────

type Tab = 'bookmarks' | 'tags';

// ─── 관심 공지 탭 ──────────────────────────────────────────────────────────────

function BookmarksTab() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        setError(false);
        try {
          const res = await apiClient.get('/api/v1/notices/bookmarks');
          setNotices(res.data.data?.items ?? []);
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

  const toggleBookmark = async (id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiClient.post(`/api/v1/notices/${id}/bookmark`);
    } catch {
      const res = await apiClient.get('/api/v1/notices/bookmarks');
      setNotices(res.data.data?.items ?? []);
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
            <Text style={styles.metaText}>{item.source_type}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{formatDate(item.published_at)}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => toggleBookmark(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="heart" size={22} color={colors.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />;

  if (error) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.border} />
        <Text style={styles.emptyText}>불러오지 못했어요.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notices}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={notices.length === 0 ? styles.emptyContainer : styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.centerBox}>
          <Ionicons name="heart-outline" size={44} color={colors.border} />
          <Text style={styles.emptyText}>저장한 공지가 없어요.</Text>
          <Text style={styles.emptySubText}>공지사항에서 하트를 눌러 저장해보세요.</Text>
        </View>
      }
    />
  );
}

// ─── 관심 활동 탭 ──────────────────────────────────────────────────────────────

function InterestTagsTab() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        setError(false);
        try {
          const res = await apiClient.get('/api/v1/users/me/interest-tags');
          const tags: string[] = res.data.data?.tags ?? [];
          setSelected(new Set(tags));
          setOriginal(new Set(tags));
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

  const toggleTag = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const hasChanges = () => {
    if (selected.size !== original.size) return true;
    for (const t of selected) if (!original.has(t)) return true;
    return false;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/v1/users/me/interest-tags', { tags: Array.from(selected) });
      setOriginal(new Set(selected));
      Alert.alert('저장 완료', '관심 활동이 저장되었습니다.');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />;

  if (error) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.border} />
        <Text style={styles.emptyText}>불러오지 못했어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tagsContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.tagsHint}>관심 있는 활동 분야를 선택하세요.</Text>
      <View style={styles.tagsGrid}>
        {INTEREST_TAGS.map((tag) => {
          const active = selected.has(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleTag(tag)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[styles.saveBtn, (!hasChanges() || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!hasChanges() || saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color={colors.white} size="small" />
          : <Text style={styles.saveBtnText}>저장</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────

export default function BookmarksScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('bookmarks');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>관심 모아보기</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 탭 바 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookmarks' && styles.tabActive]}
          onPress={() => setActiveTab('bookmarks')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'bookmarks' && styles.tabTextActive]}>관심 공지</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tags' && styles.tabActive]}
          onPress={() => setActiveTab('tags')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'tags' && styles.tabTextActive]}>관심 활동</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'bookmarks' ? <BookmarksTab /> : <InterestTagsTab />}
    </SafeAreaView>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },

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

  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: fontSize.xs, color: colors.border, textAlign: 'center' },

  tagsContainer: { padding: spacing.lg, gap: spacing.lg },
  tagsHint: { fontSize: fontSize.sm, color: colors.textSecondary },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: '700' },
});
