import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
}

type FilterTab = 'all' | 'pending' | 'completed';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '미완료' },
  { key: 'completed', label: '완료' },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatFullDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function toApiDate(d: Date): string {
  return d.toISOString();
}

function getDdayText(dateStr: string): { text: string; urgent: boolean } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: '마감됨', urgent: true };
  if (diff === 0) return { text: '오늘 마감', urgent: true };
  if (diff <= 3) return { text: `D-${diff}`, urgent: true };
  return { text: `D-${diff}`, urgent: false };
}

export default function AssignmentsScreen() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showForm, setShowForm] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      const res = await apiClient.get('/api/v1/assignments', { params });
      const data = res.data.data;
      setAssignments(Array.isArray(data) ? data : data?.items ?? []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      fetchAssignments();
    }, [fetchAssignments]),
  );

  const resetForm = () => {
    setFormTitle('');
    setFormSubject('');
    setFormDescription('');
    setFormDueDate(null);
    setFormError('');
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (item: Assignment) => {
    setFormTitle(item.title);
    setFormSubject(item.subject ?? '');
    setFormDescription(item.description ?? '');
    setFormDueDate(item.due_date ? new Date(item.due_date) : null);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      setFormError('제목을 입력해주세요.');
      return;
    }
    setFormLoading(true);
    setFormError('');

    const body = {
      title: formTitle.trim(),
      subject: formSubject.trim() || null,
      description: formDescription.trim() || null,
      due_date: formDueDate ? toApiDate(formDueDate) : null,
    };

    try {
      if (editingId) {
        await apiClient.put(`/api/v1/assignments/${editingId}`, body);
      } else {
        await apiClient.post('/api/v1/assignments', body);
      }
      setShowForm(false);
      resetForm();
      fetchAssignments();
    } catch {
      setFormError('저장에 실패했습니다.');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleComplete = async (item: Assignment) => {
    const next = !item.is_completed;
    setAssignments((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, is_completed: next } : a)),
    );
    try {
      await apiClient.put(`/api/v1/assignments/${item.id}`, { is_completed: next });
    } catch {
      setAssignments((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, is_completed: !next } : a)),
      );
    }
  };

  const handleDelete = (item: Assignment) => {
    Alert.alert('과제 삭제', `"${item.title}"을(를) 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/v1/assignments/${item.id}`);
            setAssignments((prev) => prev.filter((a) => a.id !== item.id));
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const onDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selected) setFormDueDate(selected);
  };

  const renderItem = ({ item }: { item: Assignment }) => {
    const dday = item.due_date ? getDdayText(item.due_date) : null;
    return (
      <View style={styles.assignmentItem}>
        <TouchableOpacity
          style={styles.checkArea}
          onPress={() => toggleComplete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={item.is_completed ? 'checkbox' : 'square-outline'}
            size={22}
            color={item.is_completed ? colors.success : colors.border}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.itemContent} onPress={() => openEditForm(item)} activeOpacity={0.7}>
          <Text style={[styles.itemTitle, item.is_completed && styles.completedText]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.itemMeta}>
            {item.subject && <Text style={styles.subjectTag}>{item.subject}</Text>}
            {dday && (
              <Text style={[styles.ddayText, dday.urgent && !item.is_completed && styles.ddayUrgent]}>
                {item.is_completed ? '완료' : dday.text}
              </Text>
            )}
            {!dday && !item.is_completed && <Text style={styles.ddayText}>기한 없음</Text>}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.border} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>과제 관리</Text>
      </View>

      {/* 필터 탭 */}
      <View style={styles.tabBar}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, filter === tab.key && styles.tabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 목록 */}
      {loading ? (
        <ActivityIndicator style={styles.fullLoader} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={assignments.length === 0 ? styles.emptyContainer : styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="document-text-outline" size={40} color={colors.border} />
              <Text style={styles.emptyText}>
                {filter === 'completed' ? '완료된 과제가 없습니다.' : '등록된 과제가 없습니다.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateForm} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* 생성/수정 모달 */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowForm(false)} activeOpacity={1} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.bottomSheet}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{editingId ? '과제 수정' : '과제 추가'}</Text>

          <TextInput
            style={styles.input}
            placeholder="과제 제목 *"
            placeholderTextColor={colors.textSecondary}
            value={formTitle}
            onChangeText={(v) => { setFormTitle(v); setFormError(''); }}
            maxLength={200}
          />

          <TextInput
            style={styles.input}
            placeholder="과목 (선택)"
            placeholderTextColor={colors.textSecondary}
            value={formSubject}
            onChangeText={setFormSubject}
            maxLength={100}
          />

          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => { if (!formDueDate) setFormDueDate(new Date()); setShowDatePicker(true); }}
          >
            <Ionicons name="calendar-outline" size={18} color={formDueDate ? colors.primary : colors.textSecondary} />
            <Text style={[styles.datePickerText, !formDueDate && { color: colors.textSecondary }]}>
              {formDueDate ? formatFullDate(formDueDate) : '마감일 선택 (선택)'}
            </Text>
            {formDueDate && (
              <TouchableOpacity onPress={() => setFormDueDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.border} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={formDueDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          )}

          <TextInput
            style={[styles.input, styles.memoInput]}
            placeholder="설명 (선택)"
            placeholderTextColor={colors.textSecondary}
            value={formDescription}
            onChangeText={setFormDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={500}
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, formLoading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={formLoading}
            activeOpacity={0.85}
          >
            {formLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>{editingId ? '수정' : '추가'}</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  android: { elevation: 4 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  tab: {
    paddingVertical: 12,
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

  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  checkArea: { flexShrink: 0 },
  itemContent: { flex: 1, gap: 4 },
  itemTitle: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  completedText: { textDecorationLine: 'line-through', color: colors.textSecondary },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subjectTag: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  ddayText: { fontSize: fontSize.xs, color: colors.textSecondary },
  ddayUrgent: { color: colors.danger, fontWeight: '700' },

  fullLoader: { flex: 1, justifyContent: 'center' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.lg,
    gap: spacing.sm,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.sm,
    color: colors.text,
    backgroundColor: colors.background,
  },
  memoInput: { minHeight: 80, paddingTop: 12 },

  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  datePickerText: { flex: 1, fontSize: fontSize.sm, color: colors.text },

  formError: { fontSize: fontSize.xs, color: colors.danger },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
});
