# Mirim OAuth React

## 설치

```bash
npm install mirim_oauth_react
# 또는
yarn add mirim_oauth_react
```

## 사용법

### 1. Provider 설정

앱의 최상위에서 `MirimOAuthProvider`로 감싸주세요:

```tsx
import React from 'react';
import { MirimOAuthProvider } from 'mirim_oauth_react';
import App from './App';

const Root: React.FC = () => {
  return (
    <MirimOAuthProvider
      clientId="your-client-id"
      clientSecret="your-client-secret"
      redirectUri="http://localhost:3000/callback"
      scopes={['user:read', 'user:profile']}
      oauthServerUrl="https://api-auth.mmhs.app" // 기본값이므로 생략 가능
    >
      <App />
    </MirimOAuthProvider>
  );
};

export default Root;
```

### 2. Hook 사용

컴포넌트에서 `useMirimOAuth` Hook을 사용하여 OAuth 기능에 접근할 수 있습니다:

```tsx
import React from 'react';
import { useMirimOAuth } from 'mirim_oauth_react';

const LoginComponent: React.FC = () => {
  const { 
    currentUser, 
    isLoggedIn, 
    isLoading, 
    logIn, 
    logOut, 
    refreshUserInfo,
    makeAuthenticatedRequest 
  } = useMirimOAuth();

  const handleLogin = async () => {
    try {
      await logIn();
      console.log('로그인 성공!');
    } catch (error) {
      console.error('로그인 실패:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      console.log('로그아웃 성공!');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  if (isLoggedIn && currentUser) {
    return (
      <div>
        <h2>안녕하세요, {currentUser.nickname || currentUser.email}님!</h2>
        <div>
          <p>이메일: {currentUser.email}</p>
          <p>전공: {currentUser.major}</p>
          <p>학번: {currentUser.admission}</p>
          <p>기수: {currentUser.generation}</p>
        </div>
        <button onClick={handleLogout}>로그아웃</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={handleLogin}>로그인</button>
    </div>
  );
};

export default LoginComponent;
```

### 3. 클래스 직접 사용

Hook을 사용하지 않고 클래스를 직접 사용할 수도 있습니다:

```tsx
import { MirimOAuth } from 'mirim_oauth_react';

const oauth = new MirimOAuth({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['user:read', 'user:profile'],
  oauthServerUrl: 'https://api-auth.mmhs.app'
});

// 로그인
const user = await oauth.logIn();

// 로그아웃
await oauth.logOut();

// 사용자 정보 새로고침
const updatedUser = await oauth.refreshUserInfo();

// 인증된 API 요청
const result = await oauth.makeAuthenticatedRequest('/api/v1/some-endpoint', {
  method: 'POST',
  body: { key: 'value' }
});
```

## API Reference

### MirimOAuthProvider Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `clientId` | `string` | ✅ | - | OAuth 클라이언트 ID |
| `clientSecret` | `string` | ✅ | - | OAuth 클라이언트 시크릿 |
| `redirectUri` | `string` | ✅ | - | OAuth 리다이렉트 URI |
| `scopes` | `string[]` | ✅ | - | 요청할 OAuth 스코프 |
| `oauthServerUrl` | `string` | ❌ | `'https://api-auth.mmhs.app'` | OAuth 서버 URL |
| `storage` | `Storage` | ❌ | `localStorage` | 토큰 저장소 |

### useMirimOAuth Hook

Hook이 반환하는 객체:

| Property | Type | Description |
|----------|------|-------------|
| `oauth` | `MirimOAuth \| null` | OAuth 인스턴스 |
| `currentUser` | `MirimUser \| null` | 현재 로그인된 사용자 |
| `isLoggedIn` | `boolean` | 로그인 상태 |
| `isLoading` | `boolean` | 로딩 상태 |
| `logIn` | `() => Promise<MirimUser>` | 로그인 함수 |
| `logOut` | `() => Promise<void>` | 로그아웃 함수 |
| `refreshUserInfo` | `() => Promise<MirimUser>` | 사용자 정보 새로고침 |
| `refreshTokens` | `() => Promise<AuthTokens>` | 토큰 새로고침 |
| `makeAuthenticatedRequest` | `(endpoint: string, options?: RequestOptions) => Promise<any>` | 인증된 API 요청 |

### MirimUser Interface

```typescript
interface MirimUser {
  id: string;
  email: string;
  nickname?: string;
  major?: string;
  isGraduated?: boolean;
  admission?: string;
  role?: string;
  generation?: number;
}
```

### AuthTokens Interface

```typescript
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  issuedAt: Date;
}
```

## 주요 기능

- ✅ **PKCE 지원**: 보안이 강화된 OAuth 2.0 플로우
- ✅ **자동 토큰 갱신**: 만료된 토큰 자동 갱신
- ✅ **React Hook**: 편리한 React Hook 인터페이스
- ✅ **TypeScript**: 완전한 TypeScript 지원
- ✅ **로컬 스토리지**: 토큰과 사용자 정보 자동 저장
- ✅ **에러 처리**: 상세한 에러 정보 제공
- ✅ **팝업 인증**: 웹 환경에서 팝업을 통한 인증

## Flutter 라이브러리와의 차이점

이 React 라이브러리는 Flutter의 `mirim_oauth_flutter`와 동일한 API 구조를 가지고 있지만, 다음과 같은 차이점이 있습니다:

1. **PKCE 구현**: 웹 환경에서 보안을 위해 PKCE (Proof Key for Code Exchange) 사용
2. **팝업 인증**: 모바일 앱 대신 웹 브라우저의 팝업을 통한 인증
3. **React Hook**: React의 Hook 패턴을 활용한 상태 관리
4. **웹 스토리지**: Flutter의 secure storage 대신 브라우저의 localStorage 사용

## 브라우저 지원

- 최신 Chrome, Firefox, Safari, Edge
- Web Crypto API 지원 필요 (PKCE를 위해)

## 개발

```bash
# 의존성 설치
yarn install

# 빌드
yarn build

# 테스트
yarn test
```

## 라이센스

MIT

## 기여

이슈와 PR을 환영합니다!
