import * as React from 'react';
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { MirimOAuth } from './mirim-oauth';
import { MirimUser } from './mirim-user';
import { AuthTokens } from './auth-tokens';

export * from './mirim-oauth';
export * from './mirim-user';
export * from './auth-tokens';
export * from './mirim-oauth-exception';

interface MirimOAuthContextType {
  oauth: MirimOAuth | null;
  currentUser: MirimUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  logIn: () => Promise<MirimUser>;
  logOut: () => Promise<void>;
  refreshUserInfo: () => Promise<MirimUser>;
  refreshTokens: () => Promise<AuthTokens>;
  makeAuthenticatedRequest: (endpoint: string, options?: any) => Promise<any>;
}

const MirimOAuthContext = createContext<MirimOAuthContextType | null>(null);

interface MirimOAuthProviderProps {
  children: React.ReactNode;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  oauthServerUrl?: string;
  scopes: string;
  storage?: Storage;
}

export const MirimOAuthProvider: React.FC<MirimOAuthProviderProps> = ({
  children,
  clientId,
  clientSecret,
  redirectUri,
  oauthServerUrl,
  scopes,
  storage,
}) => {
  const [oauth] = useState(() => new MirimOAuth({
    clientId,
    clientSecret,
    redirectUri,
    oauthServerUrl,
    scopes,
    storage,
  }));

  const [currentUser, setCurrentUser] = useState<MirimUser | null>(oauth.currentUser);
  const [isLoggedIn, setIsLoggedIn] = useState(oauth.isLoggedIn);
  const [isLoading, setIsLoading] = useState(oauth.isLoading);

  const updateState = useCallback(() => {
    setCurrentUser(oauth.currentUser);
    setIsLoggedIn(oauth.isLoggedIn);
    setIsLoading(oauth.isLoading);
  }, [oauth]);

  useEffect(() => {
    const unsubscribe = oauth.subscribe(updateState);
    
    oauth.checkIsLoggedIn().catch(() => {
    });

    return unsubscribe;
  }, [oauth, updateState]);

  const logIn = useCallback(async () => {
    return await oauth.logIn();
  }, [oauth]);

  const logOut = useCallback(async () => {
    await oauth.logOut();
  }, [oauth]);

  const refreshUserInfo = useCallback(async () => {
    return await oauth.refreshUserInfo();
  }, [oauth]);

  const refreshTokens = useCallback(async () => {
    return await oauth.refreshTokens();
  }, [oauth]);

  const makeAuthenticatedRequest = useCallback(async (endpoint: string, options?: any) => {
    return await oauth.makeAuthenticatedRequest(endpoint, options);
  }, [oauth]);

  const contextValue: MirimOAuthContextType = {
    oauth,
    currentUser,
    isLoggedIn,
    isLoading,
    logIn,
    logOut,
    refreshUserInfo,
    refreshTokens,
    makeAuthenticatedRequest,
  };

  return (
    <MirimOAuthContext.Provider value={contextValue}>
      {children}
    </MirimOAuthContext.Provider>
  );
};

export const useMirimOAuth = (): MirimOAuthContextType => {
  const context = useContext(MirimOAuthContext);
  if (!context) {
    throw new Error('useMirimOAuth must be used within a MirimOAuthProvider');
  }
  return context;
};
