import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface NotificationSettings {
  all: boolean;
  notice: boolean;
  assignment: boolean;
  assignment_days: number[];   // 마감 D-N: [3, 1]
  academic: boolean;
  briefing: boolean;
  briefing_time: string;       // HH:MM
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

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

export default function NotificationScreen() {
  const router = useRouter();
  const { show, Toast } = useToast();

  const [settings, setSettings] = useState<NotificationSettings>({
    all: true,
    notice: true,
    assignment: true,
    assignment_days: [1],
    academic: true,
    briefing: false,
    briefing_time: '09:00',
  });
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── 초기 설정 불러오기 ────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/api/v1/users/me/notification-settings');
        if (res.data.data) setSettings(res.data.data);
      } catch {
        // 기본값 유지
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  // ── 상태 업데이트 헬퍼 ───────────────────────────────────────────────────

  const update = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAll = (val: boolean) => {
    setSettings((prev) => ({ ...prev, all: val }));
  };

  const toggleAssignmentDay = (day: number) => {
    setSettings((prev) => {
      const days = prev.assignment_days.includes(day)
        ? prev.assignment_days.filter((d) => d !== day)
        : [...prev.assignment_days, day];
      return { ...prev, assignment_days: days };
    });
  };

  // ── 저장 ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/v1/users/me/notification-settings', {
        notice: settings.notice,
        assignment: settings.assignment,
        assignment_days: settings.assignment_days,
        academic: settings.academic,
        briefing: settings.briefing,
        briefing_time: settings.briefing_time,
      });
      show('저장됐습니다.');
    } catch {
      show('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const disabled = !settings.all;

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen}>
      {/* 네비 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>알림 설정</Text>
        <View style={{ width: 24 }} />
      </View>

      {fetching ? (
        <ActivityIndicator style={styles.fullLoader} color={colors.primary} size="large" />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            {/* 전체 알림 토글 */}
            <View style={[styles.card, styles.allToggleCard]}>
              <View>
                <Text style={styles.allToggleTitle}>전체 알림</Text>
                <Text style={styles.allToggleSub}>
                  {settings.all ? '모든 알림이 활성화되어 있습니다.' : '모든 알림이 꺼져 있습니다.'}
                </Text>
              </View>
              <Switch
                value={settings.all}
                onValueChange={toggleAll}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={settings.all ? colors.primary : colors.white}
              />
            </View>

            {/* 개별 알림 */}
            <View style={[styles.card, disabled && styles.cardDisabled]}>
              {/* 공지 알림 */}
              <SettingRow
                icon="megaphone-outline"
                label="공지 알림"
                sub="새로운 공지사항 등록 시 알림"
                value={settings.notice}
                onChange={(v) => update('notice', v)}
                disabled={disabled}
                isLast={false}
              />

              {/* 과제 마감 알림 */}
              <SettingRow
                icon="document-text-outline"
                label="과제 마감 알림"
                sub="과제 마감일 전 알림"
                value={settings.assignment}
                onChange={(v) => update('assignment', v)}
                disabled={disabled}
                isLast={false}
              />
              {settings.assignment && !disabled && (
                <View style={styles.subOption}>
                  <Text style={styles.subOptionLabel}>알림 시점</Text>
                  <View style={styles.checkRow}>
                    {[3, 1].map((day) => {
                      const active = settings.assignment_days.includes(day);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={styles.checkItem}
                          onPress={() => toggleAssignmentDay(day)}
                        >
                          <Ionicons
                            name={active ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={active ? colors.primary : colors.border}
                          />
                          <Text style={styles.checkLabel}>D-{day}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 학사일정 알림 */}
              <SettingRow
                icon="calendar-outline"
                label="학사일정 알림"
                sub="시험, 수강신청 등 학사 일정 알림"
                value={settings.academic}
                onChange={(v) => update('academic', v)}
                disabled={disabled}
                isLast={false}
              />

              {/* AI 브리핑 */}
              <SettingRow
                icon="sparkles-outline"
                label="AI 일일 브리핑"
                sub="매일 아침 AI가 요약한 오늘의 정보"
                value={settings.briefing}
                onChange={(v) => update('briefing', v)}
                disabled={disabled}
                isLast
              />
              {settings.briefing && !disabled && (
                <View style={styles.subOption}>
                  <Text style={styles.subOptionLabel}>수신 시간</Text>
                  <View style={styles.timeInputWrapper}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <TextInput
                      style={styles.timeInput}
                      value={settings.briefing_time}
                      onChangeText={(v) => {
                        const digits = v.replace(/\D/g, '').slice(0, 4);
                        const formatted =
                          digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
                        update('briefing_time', formatted);
                      }}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* 저장 버튼 */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.saveButtonText}>저장</Text>
              }
            </TouchableOpacity>
          </View>
        </>
      )}

      <Toast />
    </SafeAreaView>
  );
}

// ─── SettingRow ────────────────────────────────────────────────────────────────

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  isLast: boolean;
}

function SettingRow({ icon, label, sub, value, onChange, disabled, isLast }: SettingRowProps) {
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowBorder]}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={18} color={disabled ? colors.border : colors.primary} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, disabled && styles.textDisabled]}>{label}</Text>
        <Text style={[styles.settingSub, disabled && styles.textDisabled]}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primaryLight }}
        thumbColor={value && !disabled ? colors.primary : colors.white}
      />
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fullLoader: { flex: 1 },

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
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardDisabled: { opacity: 0.4 },

  allToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  allToggleTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  allToggleSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  settingSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  textDisabled: { color: colors.border },

  subOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  subOptionLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },

  checkRow: { flexDirection: 'row', gap: spacing.lg },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkLabel: { fontSize: fontSize.sm, color: colors.text },

  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    minWidth: 110,
  },
  timeInput: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
    letterSpacing: 1,
    minWidth: 50,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },

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
});
