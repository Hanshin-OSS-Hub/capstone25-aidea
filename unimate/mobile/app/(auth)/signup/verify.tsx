import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';

import { apiClient } from '@/api/client';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

const TIMER_SECONDS = 5 * 60;

export default function SignupVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    username: string;
    password: string;
    name: string;
    birthdate: string;
    phone: string;
    department: string;
    studentId: string;
    grade: string;
  }>();

  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailError, setEmailError] = useState('');

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const email = `${emailPrefix.trim()}@hs.ac.kr`;

  // ── 타이머 ──────────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(TIMER_SECONDS);
    setTimerActive(true);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── 인증번호 발송 ────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!emailPrefix.trim()) {
      setEmailError('이메일 앞자리를 입력해주세요.');
      return;
    }
    setEmailError('');
    setIsSending(true);
    setIsVerified(false);
    setCode('');
    setCodeError('');

    try {
      await apiClient.post('/api/v1/auth/send-verification', { email });
      setIsSent(true);
      startTimer();
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setEmailError('이미 가입된 이메일입니다.');
      } else {
        setEmailError('발송에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSending(false);
    }
  };

  // ── 인증 확인 ────────────────────────────────────────────────────────────────

  const handleVerify = async () => {
    if (code.length !== 6) {
      setCodeError('6자리 인증번호를 입력해주세요.');
      return;
    }
    setCodeError('');
    setIsVerifying(true);

    try {
      await apiClient.post('/api/v1/auth/verify-email', { email, code });
      setIsVerified(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerActive(false);
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 400) {
        setCodeError('인증번호가 올바르지 않습니다.');
      } else if (axios.isAxiosError(e) && e.response?.status === 410) {
        setCodeError('인증번호가 만료되었습니다. 재발송해주세요.');
      } else {
        setCodeError('인증에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // ── 다음 ─────────────────────────────────────────────────────────────────────

  const handleNext = () => {
    router.push({
      pathname: '/(auth)/signup/complete',
      params: { ...params, email },
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
        <View style={[styles.progressFill, { width: '66%' }]} />
      </View>
      <Text style={styles.progressLabel}>2 / 3 단계</Text>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>이메일 인증</Text>
        <Text style={styles.subtitle}>한신대학교 이메일(@hs.ac.kr)로 인증해주세요.</Text>

        {/* 이메일 입력 */}
        <Text style={styles.label}>학교 이메일</Text>
        <View style={styles.emailRow}>
          <TextInput
            style={[styles.emailInput, emailError ? styles.inputError : undefined]}
            placeholder="이메일 앞자리"
            placeholderTextColor={colors.textSecondary}
            value={emailPrefix}
            onChangeText={(v) => {
              setEmailPrefix(v);
              setEmailError('');
              setIsSent(false);
              setIsVerified(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!isVerified}
          />
          <Text style={styles.emailDomain}>@hs.ac.kr</Text>
          <TouchableOpacity
            style={[styles.sendButton, (isSending || isVerified) && styles.sendButtonDisabled]}
            onPress={isSent && !isVerified && timeLeft > 0 ? undefined : handleSend}
            disabled={isSending || isVerified}
          >
            {isSending
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.sendButtonText}>{isSent && timeLeft > 0 && !isVerified ? '재발송' : '인증번호 발송'}</Text>
            }
          </TouchableOpacity>
        </View>
        {emailError !== '' && <Text style={styles.errorText}>{emailError}</Text>}

        {/* 인증번호 입력 (발송 후 표시) */}
        {isSent && (
          <View style={styles.codeSection}>
            <Text style={styles.label}>인증번호</Text>
            <View style={styles.codeRow}>
              <View style={[styles.codeInputWrapper, codeError ? styles.inputError : undefined, isVerified ? styles.inputSuccess : undefined]}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="6자리 숫자"
                  placeholderTextColor={colors.textSecondary}
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.replace(/\D/g, '').slice(0, 6));
                    setCodeError('');
                  }}
                  keyboardType="numeric"
                  maxLength={6}
                  editable={!isVerified}
                />
                {timerActive && !isVerified && (
                  <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
                )}
                {!timerActive && !isVerified && timeLeft === 0 && (
                  <TouchableOpacity onPress={handleSend}>
                    <Text style={styles.resendLink}>재발송</Text>
                  </TouchableOpacity>
                )}
                {isVerified && (
                  <Text style={styles.verifiedBadge}>인증완료 ✓</Text>
                )}
              </View>
              {!isVerified && (
                <TouchableOpacity
                  style={[styles.verifyButton, (isVerifying || timeLeft === 0) && styles.sendButtonDisabled]}
                  onPress={handleVerify}
                  disabled={isVerifying || timeLeft === 0}
                >
                  {isVerifying
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.sendButtonText}>인증 확인</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
            {codeError !== '' && <Text style={styles.errorText}>{codeError}</Text>}
          </View>
        )}

        {/* 다음 버튼 */}
        <TouchableOpacity
          style={[styles.nextButton, !isVerified && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!isVerified}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>다음</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  progressBar: { height: 4, backgroundColor: colors.border },
  progressFill: { height: 4, backgroundColor: colors.primary },
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
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  emailInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.white,
  },
  emailDomain: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 96,
  },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  inputError: { borderColor: colors.danger },
  inputSuccess: { borderColor: colors.success },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: 4,
  },
  codeSection: { marginTop: spacing.lg },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  codeInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.text,
  },
  timer: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: '600',
  },
  resendLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  verifiedBadge: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  nextButtonDisabled: { backgroundColor: colors.border },
  nextButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
