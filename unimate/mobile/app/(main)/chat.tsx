import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/constants/api';
import { colors, borderRadius, fontSize, spacing } from '@/constants/theme';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── UUID 생성 ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - i * 150),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.bubbleAI}>
      <View style={styles.typingRow}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── 메시지 버블 ──────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color={colors.white} />
        </View>
      )}
      <View style={[isUser ? styles.bubbleUser : styles.bubbleAI, !message.content && styles.bubbleEmpty]}>
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAI}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const params = useLocalSearchParams<{ message?: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  const [sessionId, setSessionId] = useState<string>(generateId());
  const listRef = useRef<FlatList<Message>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasSentInitial = useRef(false);

  // ── 초기 메시지 자동 전송 ──────────────────────────────────────────────────

  useEffect(() => {
    if (params.message && !hasSentInitial.current) {
      hasSentInitial.current = true;
      sendMessage(params.message);
    }
  }, []);

  // ── SSE 스트리밍 전송 ─────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { id: generateId(), role: 'user', content: trimmed };
    const aiMsgId = generateId();
    const aiMsg: Message = { id: aiMsgId, role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInputText('');
    setIsStreaming(true);
    setShowTyping(true);

    const accessToken = useAuthStore.getState().accessToken
      ?? await SecureStore.getItemAsync('access_token');
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ session_id: sessionId, message: trimmed }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw) as { type: string; content?: string };

          if (parsed.type === 'session_id' && parsed.content) {
            setSessionId(parsed.content);
          } else if (parsed.type === 'token' && parsed.content) {
            setShowTyping(false);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: m.content + parsed.content } : m,
              ),
            );
          } else if (parsed.type === 'done') {
            break;
          }
        } catch {
          // JSON 파싱 실패 무시
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: '답변을 가져오지 못했어요. 다시 시도해주세요.' }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
      abortRef.current = null;
    }
  }, [isStreaming, sessionId]);

  // ── 스크롤 ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages]);

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  ), []);

  return (
    <SafeAreaView style={styles.screen}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerAvatarWrapper}>
          <Ionicons name="sparkles" size={16} color={colors.white} />
        </View>
        <View>
          <Text style={styles.headerTitle}>AI 도우미</Text>
          <Text style={styles.headerSub}>{isStreaming ? '답변 생성 중...' : '무엇이든 물어보세요'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* 메시지 목록 */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>AI 도우미에게 물어보세요</Text>
            <Text style={styles.emptyDesc}>수업, 공지, 장학금, 일정 등{'\n'}학교 생활에 필요한 모든 것</Text>
            <View style={styles.suggestionRow}>
              {['오늘 공지 알려줘', '이번 주 마감 과제', '장학금 신청 일정'].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.suggestion}
                  onPress={() => sendMessage(q)}
                >
                  <Text style={styles.suggestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={showTyping ? <TypingIndicator /> : null}
          />
        )}

        {/* 입력 영역 */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="메시지를 입력하세요..."
            placeholderTextColor={colors.textSecondary}
            multiline
            onSubmitEditing={() => sendMessage(inputText)}
            editable={!isStreaming}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isStreaming) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isStreaming}
            activeOpacity={0.8}
          >
            <Ionicons
              name="paper-plane"
              size={18}
              color={!inputText.trim() || isStreaming ? colors.textSecondary : colors.white}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerAvatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },

  // 빈 화면
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  emptyDesc: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  suggestionRow: {
    flexDirection: 'column',
    gap: spacing.xs,
    width: '100%',
    marginTop: spacing.md,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  suggestionText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' },

  // 메시지 목록
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },

  // 버블
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.sm },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI: { justifyContent: 'flex-start', gap: 8 },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bubbleUser: {
    maxWidth: '78%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  bubbleAI: {
    maxWidth: '78%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  bubbleEmpty: { minWidth: 48, minHeight: 40 },
  bubbleTextUser: { fontSize: fontSize.sm, color: colors.white, lineHeight: 22 },
  bubbleTextAI: { fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },

  // Typing indicator
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 4 },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },

  // 입력창
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.text,
    backgroundColor: colors.background,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: { backgroundColor: colors.border },
});
