# UniMate — Frontend 개발 규칙

> **Mobile**: Expo (React Native) + TypeScript | Expo Router
> **Web**: Vite + React + TypeScript + Tailwind CSS | React Router v6

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
│   │       ├── index.tsx        # Step 1: 기본 정보 입력
│   │       ├── verify.tsx       # Step 2: 이메일 인증번호 확인
│   │       └── complete.tsx     # Step 3: 관심사 태그 선택
│   └── (main)/
│       ├── _layout.tsx          # 탭 네비게이터 (홈/공지/일정/채팅/프로필)
│       ├── home.tsx             # 대시보드 (추천공지 + 요약카드 + AI브리핑 + 최신공지)
│       ├── chat.tsx             # AI 채팅 (SSE fetch)
│       ├── notices.tsx          # 공지 목록 (무한스크롤 + 카테고리 필터 + skeleton)
│       ├── notices/
│       │   ├── [id].tsx         # 공지 상세 (AI 요약 + 북마크 + 원문 링크)
│       │   └── bookmarks.tsx    # 내 북마크 목록
│       ├── schedule.tsx         # 캘린더 뷰 (react-native-calendars)
│       ├── schedule/
│       │   └── add.tsx          # 일정 생성/수정
│       ├── assignments.tsx      # 과제 CRUD
│       ├── profile.tsx          # 내 정보 + 로그아웃
│       └── profile/
│           ├── notification.tsx # 알림 설정
│           └── password.tsx     # 비밀번호 변경
├── components/
│   └── RecommendedNoticesDashboard.tsx  # 추천 공지 대시보드 위젯
├── api/
│   └── client.ts                # axios 인스턴스 + 인터셉터 (토큰 자동첨부 + 401 refresh)
├── hooks/
│   └── useAuth.ts               # tokenStorage (SecureStore 래퍼)
├── store/
│   └── authStore.ts             # Zustand (accessToken, user, isLoggedIn)
└── constants/
    ├── theme.ts                 # colors, borderRadius, spacing, fontSize
    ├── api.ts                   # API_BASE_URL
    └── departments.ts           # 학과 목록
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

## 컴포넌트 데이터 패칭 패턴 (refreshKey)

독립 컴포넌트가 상위 화면의 pull-to-refresh와 연동할 때는 `refreshKey` prop을 사용한다.

```tsx
// 상위 화면 (home.tsx)
const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

const onRefresh = useCallback(async () => {
  setRefreshing(true);
  setDashboardRefreshKey((k: number) => k + 1);  // 컴포넌트 재조회 트리거
  await fetchAll();
  setRefreshing(false);
}, [fetchAll]);

<RecommendedNoticesDashboard refreshKey={dashboardRefreshKey} />

// 컴포넌트 내부
useEffect(() => {
  fetchAll();
}, [refreshKey]);  // refreshKey 변경 시 재조회
```

---

## API 미연동 시 목업 폴백 패턴

백엔드 미구현 엔드포인트에 대비해 에러 시 목업 데이터로 폴백한다.

```tsx
const MOCK_DATA = [...];

const fetchData = async () => {
  try {
    const res = await apiClient.get('/api/v1/some-endpoint');
    setData(res.data.data ?? MOCK_DATA);
  } catch {
    setData(MOCK_DATA);  // API 실패 시 목업으로 폴백 → UI 즉시 확인 가능
  }
};
```

---

## SSE 스트리밍 (AI 채팅)

`fetch` + `response.text()` 방식 사용. React Native에서 `ReadableStream`이 불안정하므로 전체 응답을 받은 후 파싱.

```tsx
const token = useAuthStore.getState().accessToken;

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
    const unique = newItems.filter((n: Notice) => !existingIds.has(n.id));
    return [...prev, ...unique];
  });
  setHasNext(res.data.data?.has_next ?? false);
  setPage((prev) => prev + 1);
  setIsLoadingMore(false);
};
```

> `keyExtractor`에 `index`를 혼합하지 않고 `item.id`만 사용. 중복은 클라이언트에서 필터링.

---

## 반응형 레이아웃 (Expo Web 대응)

```tsx
import { Dimensions } from 'react-native';

const IS_WIDE = Dimensions.get('window').width >= 768;

// 모바일: 카드 세로 전체 너비, 탭 좌우 꽉 차게
// 웹(wide): 카드 최대 800px 중앙 정렬, 탭 좌측 정렬
const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: borderRadius.md },
  cardWide: { alignSelf: 'center', width: '100%', maxWidth: 800 },
  tabButton: { paddingHorizontal: spacing.md, paddingVertical: 8 },
  tabButtonFlex: { flex: 1, alignItems: 'center' },  // 모바일 전용
});
```

> `Dimensions`는 모듈 로드 시점 기준. 방향 전환 감지가 필요하면 `useWindowDimensions` 훅 사용.

---

## 개발 환경

### Mobile
- `mobile/.env`에 `EXPO_PUBLIC_API_URL` 설정
- 실기기/에뮬레이터에서는 `localhost` 대신 호스트 머신 IP 사용 (예: `http://192.168.219.118:8000`)
- 실행: `npx expo start` (Expo Go 앱으로 QR 스캔)

### Web
- `web/.env`에 `VITE_API_URL` 설정 (예: `http://192.168.219.118:8000`)
- 실행: `cd unimate/web && npm install && npm run dev` (기본 포트 5173)

---

## Web Frontend (Vite + React + TypeScript)

### 디렉토리 구조

```
web/
├── index.html
├── package.json
├── vite.config.ts          # API 프록시 설정
├── tailwind.config.js
├── tsconfig.json
├── .env                    # VITE_API_URL
└── src/
    ├── main.tsx
    ├── App.tsx              # BrowserRouter + 인증 복원 (localStorage 기반)
    ├── index.css            # Tailwind directives + primary 색상 변수
    ├── api/
    │   └── client.ts        # axios 인스턴스 (API_BASE_URL export)
    ├── store/
    │   └── authStore.ts     # Zustand (accessToken, user, isLoggedIn)
    ├── components/
    │   └── Layout.tsx       # 사이드바 네비게이션 (GraduationCap 로고, 유저 카드)
    └── pages/
        ├── auth/
        │   ├── Login.tsx    # 로그인 (username + password)
        │   └── Signup.tsx   # 3단계 회원가입 (기본정보 → 이메일 인증 → 관심사)
        ├── Home.tsx         # 대시보드 (AI 브리핑 + 요약카드 + 추천 공지)
        ├── Notices.tsx      # 공지 목록 (탭 필터 + 검색 + 북마크 토글)
        ├── NoticeDetail.tsx # 공지 상세 (AI 요약 + 북마크 + 원문 링크)
        ├── Chat.tsx         # AI 채팅 (SSE 스트리밍)
        ├── Schedule.tsx     # 캘린더 (날짜 클릭 → 일정 패널 + 추가 모달)
        └── Profile.tsx      # 프로필 (내 정보 / 알림 설정 / 비밀번호 변경)
```

### 토큰 관리 (Web)

- Access Token: Zustand 메모리 저장
- Refresh Token: `localStorage` (`unimate_refresh_token` 키)
- 앱 시작 시 `App.tsx`에서 localStorage → refresh API → `/users/me` 순으로 복원

### 포인트 컬러

- `primary-600` = `#4F46E5` (indigo-600) — 모바일 앱 포인트 컬러와 동일
- `tailwind.config.js`에서 `primary` 팔레트 커스텀 정의

### SSE 스트리밍 (Web)

Web에서는 `fetch` + `response.text()` 방식 사용 (모바일과 동일한 파싱 방식).

---

## 금지 사항

### Mobile
- `any` 타입 사용 금지 → 명확한 타입 정의
- `console.log` 커밋 금지
- Access Token을 SecureStore에 저장 금지 (메모리에만)
- React Native 내장 `SafeAreaView` 사용 금지 → `react-native-safe-area-context` 사용
- `StyleSheet` 없이 inline style 객체 금지
- `_layout.tsx`에 redirect 로직 작성 금지 → `index.tsx`에서만 처리
- 전역 상태에 authStore 외 추가 금지 → 화면별 로컬 `useState` 사용

### Web
- Access Token을 localStorage에 저장 금지 (Zustand 메모리에만)
- Tailwind 클래스 대신 inline style 사용 금지
