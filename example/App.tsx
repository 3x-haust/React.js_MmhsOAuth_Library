import React from 'react';
import { MirimOAuthProvider, useMirimOAuth } from '../src/index';

// 예제 컴포넌트
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

  const handleRefreshUser = async () => {
    try {
      await refreshUserInfo();
      console.log('사용자 정보 새로고침 성공!');
    } catch (error) {
      console.error('사용자 정보 새로고침 실패:', error);
    }
  };

  const handleApiCall = async () => {
    try {
      const result = await makeAuthenticatedRequest('/api/v1/some-endpoint');
      console.log('API 호출 결과:', result);
    } catch (error) {
      console.error('API 호출 실패:', error);
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
          <p>졸업 여부: {currentUser.isGraduated ? '졸업' : '재학'}</p>
        </div>
        <button onClick={handleLogout}>로그아웃</button>
        <button onClick={handleRefreshUser}>사용자 정보 새로고침</button>
        <button onClick={handleApiCall}>API 호출 테스트</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Mirim OAuth 로그인</h2>
      <button onClick={handleLogin}>로그인</button>
    </div>
  );
};

// 메인 앱 컴포넌트
const App: React.FC = () => {
  return (
    <MirimOAuthProvider
      clientId="your-client-id"
      clientSecret="your-client-secret"
      redirectUri="http://localhost:3000/callback"
      scopes={['user:read', 'user:profile']}
      oauthServerUrl="https://api-auth.mmhs.app" // 기본값이므로 생략 가능
    >
      <div style={{ padding: '20px' }}>
        <h1>Mirim OAuth React 예제</h1>
        <LoginComponent />
      </div>
    </MirimOAuthProvider>
  );
};

export default App;
