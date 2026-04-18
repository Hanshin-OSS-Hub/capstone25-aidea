import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

import { apiClient } from '@/api/client';
import { DEPARTMENTS } from '@/constants/departments';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface FormField<T = string> {
  value: T;
  error: string;
}

// ─── 유효성 검사 헬퍼 ─────────────────────────────────────────────────────────

const validators = {
  username: (v: string) => {
    if (!v) return '아이디를 입력해주세요.';
    if (!/^[a-z0-9]{4,20}$/.test(v)) return '영문 소문자와 숫자 조합 4~20자로 입력해주세요.';
    return '';
  },
  password: (v: string) => {
    if (!v) return '비밀번호를 입력해주세요.';
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(v)) return '영문+숫자 조합 8자 이상으로 입력해주세요.';
    return '';
  },
  passwordConfirm: (v: string, pw: string) => {
    if (!v) return '비밀번호 확인을 입력해주세요.';
    if (v !== pw) return '비밀번호가 일치하지 않습니다.';
    return '';
  },
  name: (v: string) => (!v.trim() ? '이름을 입력해주세요.' : ''),
  birthdate: (v: string) => {
    if (!v) return '생년월일을 입력해주세요.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'YYYY-MM-DD 형식으로 입력해주세요.';
    return '';
  },
  phone: (v: string) => {
    if (!v) return '전화번호를 입력해주세요.';
    if (!/^010-\d{4}-\d{4}$/.test(v)) return '010-XXXX-XXXX 형식으로 입력해주세요.';
    return '';
  },
  department: (v: string) => (!v ? '학과를 선택해주세요.' : ''),
  studentId: (v: string) => {
    if (!v) return '학번을 입력해주세요.';
    if (!/^\d{9}$/.test(v)) return '학번은 9자리 숫자입니다.';
    return '';
  },
  grade: (v: string) => (!v ? '학년을 선택해주세요.' : ''),
};

// ─── 전화번호 포맷 ─────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

// ─── 생년월일 포맷 ─────────────────────────────────────────────────────────────

function formatBirthdate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function SignupStep1Screen() {
  const router = useRouter();

  const [username, setUsername] = useState<FormField>({ value: '', error: '' });
  const [password, setPassword] = useState<FormField>({ value: '', error: '' });
  const [passwordConfirm, setPasswordConfirm] = useState<FormField>({ value: '', error: '' });
  const [name, setName] = useState<FormField>({ value: '', error: '' });
  const [birthdate, setBirthdate] = useState<FormField>({ value: '', error: '' });
  const [phone, setPhone] = useState<FormField>({ value: '', error: '' });
  const [department, setDepartment] = useState<FormField>({ value: '', error: '' });
  const [studentId, setStudentId] = useState<FormField>({ value: '', error: '' });
  const [grade, setGrade] = useState<FormField>({ value: '', error: '' });

  const [isUsernameChecked, setIsUsernameChecked] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);

  // ── 중복확인 ────────────────────────────────────────────────────────────────

  const handleCheckUsername = async () => {
    const err = validators.username(username.value);
    if (err) {
      setUsername((p) => ({ ...p, error: err }));
      return;
    }
    setIsCheckingUsername(true);
    try {
      await apiClient.get(`/api/v1/auth/check-username?username=${username.value}`);
      setIsUsernameChecked(true);
      setUsername((p) => ({ ...p, error: '' }));
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setUsername((p) => ({ ...p, error: '이미 사용 중인 아이디입니다.' }));
      } else {
        setUsername((p) => ({ ...p, error: '확인에 실패했습니다. 다시 시도해주세요.' }));
      }
      setIsUsernameChecked(false);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // ── 유효성 전체 확인 ─────────────────────────────────────────────────────────

  const isFormValid =
    isUsernameChecked &&
    username.error === '' && username.value !== '' &&
    validators.password(password.value) === '' &&
    validators.passwordConfirm(passwordConfirm.value, password.value) === '' &&
    validators.name(name.value) === '' &&
    validators.birthdate(birthdate.value) === '' &&
    validators.phone(phone.value) === '' &&
    validators.department(department.value) === '' &&
    validators.studentId(studentId.value) === '' &&
    validators.grade(grade.value) === '';

  // ── 다음 버튼 ────────────────────────────────────────────────────────────────

  const handleNext = () => {
    router.push({
      pathname: '/(auth)/signup/verify',
      params: {
        username: username.value,
        password: password.value,
        name: name.value,
        birthdate: birthdate.value,
        phone: phone.value,
        department: department.value,
        studentId: studentId.value,
        grade: grade.value,
      },
    });
  };

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 진행 바 */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '33%' }]} />
      </View>
      <Text style={styles.progressLabel}>1 / 3 단계</Text>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>기본 정보 입력</Text>

        {/* 아이디 */}
        <Field label="아이디">
          <View style={styles.rowInput}>
            <TextInput
              style={[
                styles.input,
                styles.flex,
                username.error ? styles.inputError : undefined,
                isUsernameChecked ? styles.inputSuccess : undefined,
              ]}
              placeholder="영문 소문자+숫자, 4~20자"
              placeholderTextColor={colors.textSecondary}
              value={username.value}
              onChangeText={(v) => {
                setUsername({ value: v, error: '' });
                setIsUsernameChecked(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.checkButton, isCheckingUsername && styles.checkButtonDisabled]}
              onPress={handleCheckUsername}
              disabled={isCheckingUsername}
            >
              {isCheckingUsername
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.checkButtonText}>중복확인</Text>
              }
            </TouchableOpacity>
          </View>
          {isUsernameChecked && username.error === '' && (
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.successText}>사용 가능한 아이디입니다.</Text>
            </View>
          )}
          <ErrorText message={username.error} />
        </Field>

        {/* 비밀번호 */}
        <Field label="비밀번호">
          <TextInput
            style={[styles.input, password.error ? styles.inputError : undefined]}
            placeholder="영문+숫자 조합 8자 이상"
            placeholderTextColor={colors.textSecondary}
            value={password.value}
            onChangeText={(v) => {
              setPassword({ value: v, error: validators.password(v) });
              if (passwordConfirm.value) {
                setPasswordConfirm((p) => ({
                  ...p,
                  error: validators.passwordConfirm(p.value, v),
                }));
              }
            }}
            secureTextEntry
            autoCapitalize="none"
          />
          <ErrorText message={password.error} />
        </Field>

        {/* 비밀번호 확인 */}
        <Field label="비밀번호 확인">
          <TextInput
            style={[styles.input, passwordConfirm.error ? styles.inputError : undefined]}
            placeholder="비밀번호를 다시 입력해주세요"
            placeholderTextColor={colors.textSecondary}
            value={passwordConfirm.value}
            onChangeText={(v) =>
              setPasswordConfirm({ value: v, error: validators.passwordConfirm(v, password.value) })
            }
            secureTextEntry
            autoCapitalize="none"
          />
          <ErrorText message={passwordConfirm.error} />
        </Field>

        {/* 이름 */}
        <Field label="이름">
          <TextInput
            style={[styles.input, name.error ? styles.inputError : undefined]}
            placeholder="실명을 입력해주세요"
            placeholderTextColor={colors.textSecondary}
            value={name.value}
            onChangeText={(v) => setName({ value: v, error: validators.name(v) })}
          />
          <ErrorText message={name.error} />
        </Field>

        {/* 생년월일 */}
        <Field label="생년월일">
          <TextInput
            style={[styles.input, birthdate.error ? styles.inputError : undefined]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            value={birthdate.value}
            onChangeText={(v) => {
              const formatted = formatBirthdate(v);
              setBirthdate({ value: formatted, error: validators.birthdate(formatted) });
            }}
            keyboardType="numeric"
            maxLength={10}
          />
          <ErrorText message={birthdate.error} />
        </Field>

        {/* 전화번호 */}
        <Field label="전화번호">
          <TextInput
            style={[styles.input, phone.error ? styles.inputError : undefined]}
            placeholder="010-XXXX-XXXX"
            placeholderTextColor={colors.textSecondary}
            value={phone.value}
            onChangeText={(v) => {
              const formatted = formatPhone(v);
              setPhone({ value: formatted, error: validators.phone(formatted) });
            }}
            keyboardType="phone-pad"
            maxLength={13}
          />
          <ErrorText message={phone.error} />
        </Field>

        {/* 학과 선택 */}
        <Field label="학과">
          <TouchableOpacity
            style={[styles.input, styles.selector, department.error ? styles.inputError : undefined]}
            onPress={() => setShowDeptModal(true)}
          >
            <Text style={department.value ? styles.selectorText : styles.selectorPlaceholder}>
              {department.value || '학과를 선택해주세요'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <ErrorText message={department.error} />
        </Field>

        {/* 학번 */}
        <Field label="학번">
          <TextInput
            style={[styles.input, studentId.error ? styles.inputError : undefined]}
            placeholder="9자리 숫자"
            placeholderTextColor={colors.textSecondary}
            value={studentId.value}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, 9);
              setStudentId({ value: digits, error: validators.studentId(digits) });
            }}
            keyboardType="numeric"
            maxLength={9}
          />
          <ErrorText message={studentId.error} />
        </Field>

        {/* 학년 선택 */}
        <Field label="학년">
          <View style={styles.gradeRow}>
            {['1', '2', '3', '4'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.gradeButton, grade.value === g && styles.gradeButtonActive]}
                onPress={() => setGrade({ value: g, error: '' })}
              >
                <Text style={[styles.gradeButtonText, grade.value === g && styles.gradeButtonTextActive]}>
                  {g}학년
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ErrorText message={grade.error} />
        </Field>

        {/* 다음 버튼 */}
        <TouchableOpacity
          style={[styles.nextButton, !isFormValid && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!isFormValid}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>다음</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 학과 선택 모달 */}
      <Modal visible={showDeptModal} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowDeptModal(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>학과 선택</Text>
            <TouchableOpacity onPress={() => setShowDeptModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={DEPARTMENTS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.deptItem, department.value === item && styles.deptItemActive]}
                onPress={() => {
                  setDepartment({ value: item, error: '' });
                  setShowDeptModal(false);
                }}
              >
                <Text style={[styles.deptItemText, department.value === item && styles.deptItemTextActive]}>
                  {item}
                </Text>
                {department.value === item && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return <Text style={styles.errorText}>{message}</Text>;
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primary,
  },
  progressLabel: {
    textAlign: 'right',
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 48,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  fieldWrapper: {
    marginBottom: spacing.md,
  },
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
  inputError: {
    borderColor: colors.danger,
  },
  inputSuccess: {
    borderColor: colors.success,
  },
  rowInput: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  checkButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  checkButtonDisabled: {
    opacity: 0.7,
  },
  checkButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  successText: {
    fontSize: fontSize.xs,
    color: colors.success,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: 4,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  selectorPlaceholder: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gradeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  gradeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  gradeButtonText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  gradeButtonTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  nextButtonDisabled: {
    backgroundColor: colors.border,
  },
  nextButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  deptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deptItemActive: {
    backgroundColor: colors.primaryLight,
  },
  deptItemText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  deptItemTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
