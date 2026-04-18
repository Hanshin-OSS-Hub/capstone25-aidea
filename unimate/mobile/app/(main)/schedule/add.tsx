import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const CATEGORIES = ['과제', '시험', '수업', '개인'] as const;
type Category = (typeof CATEGORIES)[number];

const ALARM_OPTIONS = ['D-3', 'D-1', '당일 09:00'] as const;
type AlarmOption = (typeof ALARM_OPTIONS)[number];

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dateToYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yyyymmddToDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** UTC 변환 없이 로컬 타임존 오프셋을 그대로 포함한 ISO 문자열 반환.
 *  ex) 한국(UTC+9)에서 2026-04-20 09:00 → "2026-04-20T09:00:00+09:00"
 *  toISOString()은 UTC로 변환하여 날짜가 하루 밀리는 문제를 방지함. */
function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset(); // 분 단위, KST = +540
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`
  );
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function ScheduleAddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    editTitle?: string;
    editDate?: string;
    editTime?: string;
    editCategory?: string;
    editMemo?: string;
  }>();

  const isEdit = !!params.editId;
  const todayStr = dateToYYYYMMDD(new Date());

  // ── 폼 상태 ──────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(params.editTitle ?? '');
  const [titleError, setTitleError] = useState('');

  const [dateStr, setDateStr] = useState(params.editDate ?? todayStr);
  const [showCalendar, setShowCalendar] = useState(false);

  const [time, setTime] = useState<Date | null>(() => {
    if (params.editTime) {
      const [h, m] = params.editTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    return null;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [category, setCategory] = useState<Category>(
    (params.editCategory as Category) ?? '개인',
  );

  const [hasAlarm, setHasAlarm] = useState(false);
  const [alarmOptions, setAlarmOptions] = useState<AlarmOption[]>([]);

  const [memo, setMemo] = useState(params.editMemo ?? '');
  const [isLoading, setIsLoading] = useState(false);

  // ── 시간 핸들러 ───────────────────────────────────────────────────────────────

  const onTimeChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selected) setTime(selected);
  };

  // ── 알림 토글 ─────────────────────────────────────────────────────────────────

  const toggleAlarmOption = (opt: AlarmOption) => {
    setAlarmOptions((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt],
    );
  };

  // ── 저장 ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim()) {
      setTitleError('제목을 입력해주세요.');
      return;
    }
    setTitleError('');
    setIsLoading(true);

    try {
      const startAt = yyyymmddToDate(dateStr);
      if (time) {
        startAt.setHours(time.getHours(), time.getMinutes(), 0, 0);
      }

      const body = {
        title: title.trim(),
        start_at: toLocalISOString(startAt),
        end_at: null,
        category,
        description: memo.trim() || null,
        is_allday: !time,
        source: 'user',
      };

      if (isEdit) {
        await apiClient.put(`/api/v1/schedules/${params.editId}`, body);
      } else {
        await apiClient.post('/api/v1/schedules', body);
      }
      router.back();
    } catch {
      Alert.alert(
        isEdit ? '수정 실패' : '저장 실패',
        `일정 ${isEdit ? '수정' : '저장'}에 실패했습니다. 다시 시도해주세요.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen}>
      {/* 네비 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isEdit ? '일정 수정' : '일정 추가'}</Text>
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
          {/* 제목 */}
          <Field label="제목 *">
            <TextInput
              style={[styles.input, titleError ? styles.inputError : undefined]}
              placeholder="일정 제목을 입력해주세요"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={(v) => { setTitle(v); setTitleError(''); }}
              maxLength={50}
            />
            {titleError ? <Text style={styles.errorText}>{titleError}</Text> : null}
          </Field>

          {/* 날짜 */}
          <Field label="날짜 *">
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowCalendar(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.pickerText}>{formatDate(dateStr)}</Text>
              <Ionicons name="chevron-down-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </Field>

          {/* 시간 */}
          <Field label="시간 (선택)">
            <View style={styles.timeRow}>
              <TouchableOpacity
                style={[styles.pickerButton, styles.flex]}
                onPress={() => { setTime(time ?? new Date()); setShowTimePicker(true); }}
              >
                <Ionicons name="time-outline" size={18} color={time ? colors.primary : colors.textSecondary} />
                <Text style={[styles.pickerText, !time && styles.placeholderText]}>
                  {time ? formatTime(time) : '시간 선택'}
                </Text>
              </TouchableOpacity>
              {time && (
                <TouchableOpacity
                  onPress={() => setTime(null)}
                  style={styles.clearButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.border} />
                </TouchableOpacity>
              )}
            </View>
            {showTimePicker && (
              <DateTimePicker
                value={time ?? new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
                is24Hour
              />
            )}
          </Field>

          {/* 카테고리 */}
          <Field label="카테고리">
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryButton, category === cat && styles.categoryButtonActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {/* 알림 */}
          <Field label="알림">
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>알림 설정</Text>
              <Switch
                value={hasAlarm}
                onValueChange={(v) => { setHasAlarm(v); if (!v) setAlarmOptions([]); }}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={hasAlarm ? colors.primary : colors.white}
              />
            </View>
            {hasAlarm && (
              <View style={styles.alarmOptions}>
                {ALARM_OPTIONS.map((opt) => {
                  const active = alarmOptions.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.alarmChip, active && styles.alarmChipActive]}
                      onPress={() => toggleAlarmOption(opt)}
                    >
                      <Ionicons
                        name={active ? 'notifications' : 'notifications-outline'}
                        size={14}
                        color={active ? colors.white : colors.textSecondary}
                      />
                      <Text style={[styles.alarmChipText, active && styles.alarmChipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Field>

          {/* 메모 */}
          <Field label="메모 (선택)">
            <TextInput
              style={[styles.input, styles.memoInput]}
              placeholder="메모를 입력해주세요"
              placeholderTextColor={colors.textSecondary}
              value={memo}
              onChangeText={setMemo}
              multiline
              numberOfLines={4}
              maxLength={200}
              textAlignVertical="top"
            />
          </Field>

          {/* 저장 버튼 */}
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.saveButtonText}>{isEdit ? '수정 완료' : '저장'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 날짜 캘린더 모달 */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <TouchableOpacity
          style={styles.calendarOverlay}
          onPress={() => setShowCalendar(false)}
          activeOpacity={1}
        />
        <View style={styles.calendarSheet}>
          <View style={styles.calendarSheetHandle} />
          <View style={styles.calendarSheetHeader}>
            <Text style={styles.calendarSheetTitle}>날짜 선택</Text>
            <TouchableOpacity onPress={() => setShowCalendar(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Calendar
            current={dateStr}
            markedDates={{
              [dateStr]: { selected: true, selectedColor: colors.primary },
            }}
            onDayPress={(day) => {
              setDateStr(day.dateString);
              setShowCalendar(false);
            }}
            theme={{
              selectedDayBackgroundColor: colors.primary,
              todayTextColor: colors.primary,
              arrowColor: colors.primary,
              textDayFontSize: fontSize.sm,
              textMonthFontSize: fontSize.md,
              textDayHeaderFontSize: fontSize.xs,
              calendarBackground: colors.white,
            }}
          />
          <View style={{ height: 16 }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

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
  navTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },

  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.danger },
  memoInput: { minHeight: 100, paddingTop: 14 },
  errorText: { fontSize: fontSize.xs, color: colors.danger, marginTop: 4 },

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.white,
  },
  pickerText: { flex: 1, fontSize: fontSize.md, color: colors.text },
  placeholderText: { color: colors.textSecondary },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clearButton: { padding: 4 },

  categoryRow: { flexDirection: 'row', gap: spacing.sm },
  categoryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  categoryButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  categoryTextActive: { color: colors.primary, fontWeight: '700' },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  switchLabel: { fontSize: fontSize.md, color: colors.text },
  alarmOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  alarmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  alarmChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  alarmChipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  alarmChipTextActive: { color: colors.white, fontWeight: '700' },

  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },

  // 캘린더 모달
  calendarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  calendarSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  calendarSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  calendarSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  calendarSheetTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
});
