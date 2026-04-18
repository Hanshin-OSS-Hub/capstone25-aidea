# UniMate — Frontend 개발 규칙

> Expo (React Native) + TypeScript | Expo Router | 이 파일의 규칙을 항상 따를 것

---

## 디렉토리 구조

```
mobile/
├── app/
│   ├── _layout.tsx              # SafeAreaProvider + Stack 네비게이터
│   ├── index.tsx                # 스플래시 → SecureStore 체크 → 리다이렉트
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup/
│   │       ├── index.tsx
│   │       ├── verify.tsx
│   │       └── complete.tsx
│   └── (main)/
│       ├── _layout.tsx          # 탭 네비게이터
│       ├── home.tsx
│       ├── chat.tsx             # AI 채팅 (SSE fetch)
│       ├── notices.tsx          # 공지 목록 (무한스크롤 + skeleton)
│       ├── notices/[id].tsx     # 공지 상세 (원문 보기 링크)
│       ├── schedule.tsx
│       ├── schedule/add.tsx
│       ├── assignments.tsx      # 과제 CRUD
│       ├── profile.tsx
│       └── profile/notification.tsx
├── api/
│   └── client.ts                # axios 인스턴스 + 인터셉터
├── hooks/
│   └── useAuth.ts               # tokenStorage (SecureStore 래퍼)
├── store/
│   └── authStore.ts             # Zustand
└── constants/
    ├── theme.ts
    └── api.ts                   # API_BASE_URL
```

---

## SafeArea 규칙

모든 화면에서 `react-native-safe-area-context`의 `SafeAreaView`를 사용. React Native 내장 `SafeAreaView`는 사용 금지.

```tsx
// app/_layout.tsx
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

// 각 화면
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      {/* 화면 내용 */}
    </SafeAreaView>
  );
}
```

---

## 상태 관리

### Zustand (전역 상태 — authStore만 사용)

```tsx
export interface User {
  id: string;       // UUID (백엔드와 동일)
  name: string;
  email?: string;
  department: string;
  grade: number;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isLoggedIn: boolean;
  setTokens: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearUser: () => void;
}
```

> `User.id`는 반드시 `string` (UUID). `number` 사용 금지.

---

## 토큰 관리

```tsx
// Access Token: Zustand 메모리 (절대 SecureStore 저장 금지)
// Refresh Token: expo-secure-store 저장

import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'unimate_refresh_token';

export const tokenStorage = {
  save: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  get: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  delete: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};
```

---

## API 클라이언트

```tsx
// api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { tokenStorage } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/constants/api';
import { router as expoRouter } from 'expo-router';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터: Access Token 자동 첨부
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터: 401 시 refresh 시도 → 실패 시 로그인 이동
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = await tokenStorage.get();
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/api/v1/auth/refresh`,
            { refresh_token: refreshToken },
          );
          const newAccessToken = data.data.access_token;
          const newRefreshToken = data.data.refresh_token;
          useAuthStore.getState().setTokens(newAccessToken);
          await tokenStorage.save(newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        } catch {
          await tokenStorage.delete();
        }
      }
      useAuthStore.getState().clearUser();
      expoRouter.replace('/(auth)/login');
    }
    return Promise.reject(error);
  },
);
```

---

## API 응답 데이터 추출 패턴

백엔드 응답이 `{ success, data, error }` 래퍼를 사용하므로, axios 응답에서 실제 데이터는 `res.data.data`로 접근.

```tsx
// ✅ 올바른 방법
const res = await apiClient.get('/api/v1/notices');
const items = res.data.data?.items ?? [];
const hasNext = res.data.data?.has_next ?? false;

// ❌ 잘못된 방법 (래퍼 무시)
const items = res.data.items;  // undefined
```

---

## SSE 스트리밍 (AI 채팅)

`fetch` + `response.text()` 방식 사용. React Native에서 `ReadableStream`이 불안정하므로 전체 응답을 받은 후 파싱.

```tsx
const token = useAuthStore.getState().accessToken
  ?? await SecureStore.getItemAsync('access_token');

const response = await fetch(`${API_BASE_URL}/api/v1/chat/message`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ session_id: sessionId, message: text }),
});

const responseText = await response.text();
const lines = responseText.split('\n');

for (const line of lines) {
  if (!line.startsWith('data: ')) continue;
  const parsed = JSON.parse(line.slice(6).trim());

  if (parsed.type === 'session_id') setSessionId(parsed.content);
  if (parsed.type === 'token')      /* 메시지에 content 누적 */;
  if (parsed.type === 'done')       break;
}
```

---

## 무한스크롤 패턴

```tsx
const [page, setPage] = useState(1);
const [hasNext, setHasNext] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);

const loadMore = async () => {
  if (isLoadingMore || !hasNext) return;
  setIsLoadingMore(true);
  const res = await apiClient.get(`/api/v1/notices?page=${page + 1}&limit=20`);
  const newItems = res.data.data?.items ?? [];
  setNotices((prev) => {
    const existingIds = new Set(prev.map((n) => n.id));
    const unique = newItems.filter((n: any) => !existingIds.has(n.id));
    return [...prev, ...unique];
  });
  setHasNext(res.data.data?.has_next ?? false);
  setPage((prev) => prev + 1);
  setIsLoadingMore(false);
};
```

> `keyExtractor`에 `index`를 혼합하지 않고 `item.id`만 사용. 중복은 클라이언트에서 필터링.

---

## 개발 환경

- `mobile/.env`에 `EXPO_PUBLIC_API_URL` 설정
- 실기기/에뮬레이터에서는 `localhost` 대신 호스트 머신 IP 사용 (예: `http://192.168.219.118:8000`)

---

## 금지 사항

- `any` 타입 사용 금지 → 명확한 타입 정의
- `console.log` 커밋 금지
- Access Token을 SecureStore에 저장 금지 (메모리에만)
- React Native 내장 `SafeAreaView` 사용 금지 → `react-native-safe-area-context` 사용
- `StyleSheet` 없이 inline style 객체 금지
- `_layout.tsx`에 redirect 로직 작성 금지 → `index.tsx`에서만 처리
