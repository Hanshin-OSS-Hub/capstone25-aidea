import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Schedule {
  id: string;
  title: string;
  date: string;         // YYYY-MM-DD
  time: string | null;  // HH:MM
  category: string;
  memo: string | null;
  has_alarm: boolean;
  type: 'system' | 'user';
  is_completed: boolean;
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, { bg: string; text: string }> = {
  학사: { bg: '#FEF3C7', text: '#92400E' },
  system: { bg: '#FEF3C7', text: '#92400E' },
  과제: { bg: '#DBEAFE', text: '#1D4ED8' },
  시험: { bg: '#FCE7F3', text: '#9D174D' },
  수업: { bg: '#D1FAE5', text: '#065F46' },
  개인: { bg: colors.primaryLight, text: colors.primary },
};

function getBadgeStyle(item: Schedule) {
  if (item.type === 'system') return CATEGORY_BADGE['system'];
  return CATEGORY_BADGE[item.category] ?? CATEGORY_BADGE['개인'];
}

function toYYYYMM(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toYYYYMMDD(date: Date): string {
  return `${toYYYYMM(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const router = useRouter();
  const today = toYYYYMMDD(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(toYYYYMM(new Date()));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Schedule | null>(null);

  // ── 데이터 패치 ──────────────────────────────────────────────────────────────

  const fetchSchedules = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/schedules', { params: { month } });
      setSchedules(res.data.data?.items ?? res.data.data ?? []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSchedules(currentMonth);
    }, [currentMonth]),
  );

  // ── 날짜 → dot 마킹 ──────────────────────────────────────────────────────────

  const markedDates = useMemo(() => {
    const marks: Record<string, object> = {};
    for (const s of schedules) {
      const isSystem = s.type === 'system';
      marks[s.date] = {
        dots: [
          ...(marks[s.date] as { dots?: { color: string }[] } | undefined)?.dots ?? [],
          { color: isSystem ? '#F59E0B' : colors.primary },
        ],
        marked: true,
      };
    }
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: colors.primary,
    };
    return marks;
  }, [schedules, selectedDate]);

  // ── 선택 날짜의 일정 ─────────────────────────────────────────────────────────

  const daySchedules = useMemo(
    () => schedules.filter((s) => s.date === selectedDate).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [schedules, selectedDate],
  );

  // ── 완료 토글 ────────────────────────────────────────────────────────────────

  const handleToggleComplete = async (item: Schedule) => {
    const next = !item.is_completed;
    setSchedules((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, is_completed: next } : s)),
    );
    setSelectedItem((prev) => prev ? { ...prev, is_completed: next } : prev);
    try {
      await apiClient.put(`/api/v1/schedules/${item.id}`, { is_completed: next });
    } catch {
      // 실패 시 롤백
      setSchedules((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, is_completed: !next } : s)),
      );
      setSelectedItem((prev) => prev ? { ...prev, is_completed: !next } : prev);
    }
  };

  // ── 삭제 ─────────────────────────────────────────────────────────────────────

  const isDeletingRef = useRef(false);

  const handleDelete = async (id: string) => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    try {
      await apiClient.delete(`/api/v1/schedules/${id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      setSelectedItem(null);
    } catch {
      // 에러 무시
    } finally {
      isDeletingRef.current = false;
    }
  };

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
        {/* 달력 */}
        <View style={styles.calendarWrapper}>
          <Calendar
            markingType="multi-dot"
            markedDates={markedDates}
            onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
            onMonthChange={(month: DateData) => {
              const ym = `${month.year}-${String(month.month).padStart(2, '0')}`;
              setCurrentMonth(ym);
            }}
            theme={{
              selectedDayBackgroundColor: colors.primary,
              todayTextColor: colors.primary,
              arrowColor: colors.primary,
              dotColor: colors.primary,
              textDayFontSize: fontSize.sm,
              textMonthFontSize: fontSize.md,
              textDayHeaderFontSize: fontSize.xs,
              calendarBackground: colors.white,
            }}
            style={styles.calendar}
          />
        </View>

        {/* 일정 목록 */}
        <View style={styles.listSection}>
          <Text style={styles.dateLabel}>
            {selectedDate.replace(/-/g, '.')}
            {selectedDate === today && <Text style={styles.todayBadge}> 오늘</Text>}
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : daySchedules.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={36} color={colors.border} />
              <Text style={styles.emptyText}>일정이 없습니다.</Text>
            </View>
          ) : (
            daySchedules.map((item) => {
              const badge = getBadgeStyle(item);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.scheduleItem, item.is_completed && styles.scheduleItemCompleted]}
                  onPress={() => setSelectedItem(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.timeCol}>
                    <Text style={[styles.timeText, item.is_completed && styles.textCompleted]}>
                      {item.time ?? '종일'}
                    </Text>
                  </View>
                  <View style={[styles.itemDot, item.is_completed && styles.itemDotCompleted]} />
                  <View style={styles.itemContent}>
                    <Text
                      style={[styles.itemTitle, item.is_completed && styles.titleCompleted]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>
                        {item.type === 'system' ? '학사' : item.category}
                      </Text>
                    </View>
                  </View>
                  {item.is_completed && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.success ?? '#10B981'} />
                  )}
                  {!item.is_completed && item.has_alarm && (
                    <Ionicons name="notifications-outline" size={16} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(main)/schedule/add')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* 상세 모달 */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setSelectedItem(null)} activeOpacity={1} />
        {selectedItem && (
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              {(() => {
                const b = getBadgeStyle(selectedItem);
                return (
                  <View style={[styles.badge, { backgroundColor: b.bg }]}>
                    <Text style={[styles.badgeText, { color: b.text }]}>
                      {selectedItem.type === 'system' ? '학사' : selectedItem.category}
                    </Text>
                  </View>
                );
              })()}
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetTitle}>{selectedItem.title}</Text>

            <View style={styles.sheetMeta}>
              <SheetRow icon="calendar-outline" label={selectedItem.date.replace(/-/g, '.')} />
              {selectedItem.time && <SheetRow icon="time-outline" label={selectedItem.time} />}
              {selectedItem.memo && <SheetRow icon="document-text-outline" label={selectedItem.memo} />}
              <SheetRow
                icon="notifications-outline"
                label={selectedItem.has_alarm ? '알림 설정됨' : '알림 없음'}
              />
            </View>

            {selectedItem.type === 'user' && selectedItem.category === '과제' && (
              <TouchableOpacity
                style={[
                  styles.completeButton,
                  selectedItem.is_completed && styles.completeButtonDone,
                ]}
                onPress={() => handleToggleComplete(selectedItem)}
              >
                <Ionicons
                  name={selectedItem.is_completed ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={18}
                  color={selectedItem.is_completed ? colors.white : (colors.success ?? '#10B981')}
                />
                <Text style={[
                  styles.completeText,
                  selectedItem.is_completed && styles.completeTextDone,
                ]}>
                  {selectedItem.is_completed ? '완료됨 (취소하기)' : '완료 표시'}
                </Text>
              </TouchableOpacity>
            )}

            {selectedItem.type === 'user' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setSelectedItem(null);
                    router.push({
                      pathname: '/(main)/schedule/add',
                      params: {
                        editId: selectedItem.id,
                        editTitle: selectedItem.title,
                        editDate: selectedItem.date,
                        editTime: selectedItem.time ?? '',
                        editCategory: selectedItem.category,
                        editMemo: selectedItem.memo ?? '',
                      },
                    });
                  }}
                >
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={styles.editText}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(selectedItem.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={styles.deleteText}>삭제</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function SheetRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.sheetRow}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.sheetRowText}>{label}</Text>
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  android: { elevation: 4 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  calendarWrapper: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  calendar: { paddingBottom: spacing.sm },

  listSection: { padding: spacing.lg, paddingBottom: 100 },
  dateLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  todayBadge: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },

  loader: { paddingVertical: spacing.xl },

  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  timeCol: { width: 44, alignItems: 'center' },
  timeText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500' },
  itemDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
  },
  itemContent: { flex: 1, gap: 4 },
  itemTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  badge: { alignSelf: 'flex-start', borderRadius: borderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  emptyBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary },

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow,
  },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: 36,
    gap: spacing.md,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  sheetMeta: { gap: spacing.sm },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheetRowText: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
  },
  editText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
  },
  deleteText: { fontSize: fontSize.sm, color: colors.danger, fontWeight: '600' },

  // 완료 상태 스타일
  scheduleItemCompleted: { opacity: 0.6 },
  textCompleted: { color: colors.textSecondary },
  itemDotCompleted: { backgroundColor: colors.textSecondary },
  titleCompleted: { textDecorationLine: 'line-through', color: colors.textSecondary },

  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  completeButtonDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  completeText: { fontSize: fontSize.sm, color: '#10B981', fontWeight: '600' },
  completeTextDone: { color: colors.white },
});
