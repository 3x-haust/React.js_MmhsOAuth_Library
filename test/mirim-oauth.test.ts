import { MirimOAuth } from '../src/mirim-oauth';
import { MirimUser } from '../src/mirim-user';
import { AuthTokens } from '../src/auth-tokens';
import { MirimOAuthException } from '../src/mirim-oauth-exception';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    length: 0,
    key: (index: number): string | null => {
      return Object.keys(store)[index] || null;
    },
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

let mockPopup: { closed: boolean; close: jest.Mock } | null = null;
let messageHandler: ((event: MessageEvent) => void) | null = null;

global.window.open = jest.fn().mockImplementation(() => {
  mockPopup = {
    closed: false,
    close: jest.fn(() => {
      if (mockPopup) mockPopup.closed = true;
    }),
  };
  return mockPopup;
});

global.window.addEventListener = jest.fn().mockImplementation((type, listener) => {
  if (type === 'message') {
    messageHandler = listener as any;
  }
});
global.window.removeEventListener = jest.fn();


global.fetch = jest.fn();

const mockCrypto = {
  getRandomValues: jest.fn().mockImplementation((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  subtle: {
    digest: jest.fn().mockImplementation(async (algorithm, data) => {
      const hash = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        hash[i] = (data[i % data.length] || 0) ^ i;
      }
      return hash.buffer;
    }),
  },
};
Object.defineProperty(global, 'crypto', { value: mockCrypto });


const mockOAuthConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['openid', 'profile', 'email'],
  storage: localStorageMock,
};

const mockUser: MirimUser = { id: 'user1', email: 'user@example.com', nickname: 'TestUser' };
const mockTokens: AuthTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  issuedAt: new Date(),
};

const mockExpiredTokens: AuthTokens = {
  accessToken: 'mock-expired-access-token',
  refreshToken: 'mock-expired-refresh-token',
  expiresIn: 3600,
  issuedAt: new Date(Date.now() - 2 * 3600 * 1000),
};


describe('MirimOAuth', () => {
  let oauth: MirimOAuth;

  beforeEach(() => {
    localStorageMock.clear();
    (fetch as jest.Mock).mockClear();
    (window.open as jest.Mock).mockClear();
    (window.addEventListener as jest.Mock).mockClear();
    (window.removeEventListener as jest.Mock).mockClear();
    if (mockPopup) mockPopup.close.mockClear();
    messageHandler = null;
    mockPopup = null;

    oauth = new MirimOAuth(mockOAuthConfig);
  });

  describe('Constructor and initial state', () => {
    it('should initialize with default values', () => {
      expect(oauth.currentUser).toBeNull();
      expect(oauth.isLoggedIn).toBe(false);
      expect(oauth.isLoading).toBe(false);
      expect(oauth.accessToken).toBeUndefined();
      expect(oauth.refreshToken).toBeUndefined();
    });
  });

  describe('logIn', () => {
    it('should successfully log in and store user and tokens', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            json: async () => ({
              status: 200,
              data: {
                access_token: mockTokens.accessToken,
                refresh_token: mockTokens.refreshToken,
                expires_in: mockTokens.expiresIn,
              },
            }),
          })
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            json: async () => ({ status: 200, data: mockUser }),
          })
        );

      const loginPromise = oauth.logIn();

      expect(window.open).toHaveBeenCalled();
      if (messageHandler) {
        messageHandler(new MessageEvent('message', {
          data: { code: 'auth-code', state: 'code' },
          origin: new URL(mockOAuthConfig.redirectUri).origin,
        }));
      }

      const user = await loginPromise;

      expect(user).toEqual(mockUser);
      expect(oauth.currentUser).toEqual(mockUser);
      expect(oauth.isLoggedIn).toBe(true);
      expect(oauth.accessToken).toBe(mockTokens.accessToken);
      expect(localStorageMock.getItem('mirim_oauth_user')).toBe(JSON.stringify(mockUser));
      expect(localStorageMock.getItem('mirim_oauth_tokens')).toBeDefined();
    });

    it('should throw MirimOAuthException if authentication popup fails to open', async () => {
      (window.open as jest.Mock).mockReturnValueOnce(null);
      await expect(oauth.logIn()).rejects.toThrow(new MirimOAuthException('Failed to open authentication popup'));
    });

    it('should throw MirimOAuthException if OAuth callback returns an error', async () => {
      const loginPromise = oauth.logIn();
      if (messageHandler) {
        messageHandler(new MessageEvent('message', {
          data: { error: 'access_denied' },
          origin: new URL(mockOAuthConfig.redirectUri).origin,
        }));
      }
      await expect(loginPromise).rejects.toThrow(new MirimOAuthException('Authentication failed: access_denied'));
    });

    it('should throw MirimOAuthException if token exchange fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(Promise.resolve({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      }));

      const loginPromise = oauth.logIn();
      if (messageHandler) {
        messageHandler(new MessageEvent('message', {
          data: { code: 'auth-code', state: 'code' },
          origin: new URL(mockOAuthConfig.redirectUri).origin,
        }));
      }
      await expect(loginPromise).rejects.toThrow(MirimOAuthException);
    });

    it('should throw MirimOAuthException if fetch user info fails', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            json: async () => ({
              status: 200,
              data: {
                access_token: mockTokens.accessToken,
                refresh_token: mockTokens.refreshToken,
                expires_in: mockTokens.expiresIn,
              },
            }),
          })
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Server Error',
          })
        );

        const loginPromise = oauth.logIn();
        if (messageHandler) {
          messageHandler(new MessageEvent('message', {
            data: { code: 'auth-code', state: 'code' },
            origin: new URL(mockOAuthConfig.redirectUri).origin,
          }));
        }
        await expect(loginPromise).rejects.toThrow(MirimOAuthException);
    });
  });

  describe('logOut', () => {
    it('should clear user and tokens from state and storage', async () => {
      localStorageMock.setItem('mirim_oauth_user', JSON.stringify(mockUser));
      localStorageMock.setItem('mirim_oauth_tokens', JSON.stringify(mockTokens));
      (oauth as any)._currentUser = mockUser;
      (oauth as any)._tokens = mockTokens;


      await oauth.logOut();

      expect(oauth.currentUser).toBeNull();
      expect(oauth.isLoggedIn).toBe(false);
      expect(oauth.accessToken).toBeUndefined();
      expect(localStorageMock.getItem('mirim_oauth_user')).toBeNull();
      expect(localStorageMock.getItem('mirim_oauth_tokens')).toBeNull();
    });
  });

  describe('checkIsLoggedIn', () => {
    it('should return true if already logged in and token is valid', async () => {
      (oauth as any)._currentUser = mockUser;
      (oauth as any)._tokens = mockTokens;
      expect(await oauth.checkIsLoggedIn()).toBe(true);
    });

    it('should return false if no token in storage', async () => {
      expect(await oauth.checkIsLoggedIn()).toBe(false);
    });

    it('should load user and token from storage if valid', async () => {
      localStorageMock.setItem('mirim_oauth_user', JSON.stringify(mockUser));
      localStorageMock.setItem('mirim_oauth_tokens', JSON.stringify({ ...mockTokens, issued_at: new Date().toISOString() }));

      expect(await oauth.checkIsLoggedIn()).toBe(true);
      expect(oauth.currentUser).toEqual(mockUser);
      expect(oauth.accessToken).toBe(mockTokens.accessToken);
    });

    it('should attempt to refresh token if stored token is expired', async () => {
      localStorageMock.setItem('mirim_oauth_user', JSON.stringify(mockUser));
      localStorageMock.setItem('mirim_oauth_tokens', JSON.stringify({ ...mockExpiredTokens, issued_at: mockExpiredTokens.issuedAt.toISOString() }));

      (fetch as jest.Mock).mockResolvedValueOnce( 
        Promise.resolve({
          ok: true,
          json: async () => ({
            status: 200,
            data: { accessToken: 'new-access-token', expiresIn: 3600 },
          }),
        })
      );

      expect(await oauth.checkIsLoggedIn()).toBe(true);
      expect(oauth.accessToken).toBe('new-access-token');
      expect(oauth.currentUser).toEqual(mockUser);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), expect.anything());
    });

    it('should log out if token refresh fails during checkIsLoggedIn', async () => {
      localStorageMock.setItem('mirim_oauth_user', JSON.stringify(mockUser));
      localStorageMock.setItem('mirim_oauth_tokens', JSON.stringify({ ...mockExpiredTokens, issued_at: mockExpiredTokens.issuedAt.toISOString() }));

      (fetch as jest.Mock).mockResolvedValueOnce(
        Promise.resolve({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
        })
      );

      expect(await oauth.checkIsLoggedIn()).toBe(false);
      expect(oauth.currentUser).toBeNull();
      expect(localStorageMock.getItem('mirim_oauth_tokens')).toBeNull();
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      (oauth as any)._tokens = mockTokens;
      (fetch as jest.Mock).mockResolvedValueOnce(
        Promise.resolve({
          ok: true,
          json: async () => ({
            status: 200,
            data: { accessToken: 'new-refreshed-token', expiresIn: 1800 },
          }),
        })
      );

      const newTokens = await oauth.refreshTokens();
      expect(newTokens.accessToken).toBe('new-refreshed-token');
      expect(oauth.accessToken).toBe('new-refreshed-token');
      expect(localStorageMock.getItem('mirim_oauth_tokens')).toContain('new-refreshed-token');
    });

    it('should throw if not logged in (no refresh token)', async () => {
      await expect(oauth.refreshTokens()).rejects.toThrow(new MirimOAuthException('Not logged in'));
    });

    it('should throw if refresh API call fails', async () => {
      (oauth as any)._tokens = mockTokens;
      (fetch as jest.Mock).mockResolvedValueOnce(
        Promise.resolve({
          ok: false,
          status: 400,
          text: async () => 'Invalid refresh token',
        })
      );
      await expect(oauth.refreshTokens()).rejects.toThrow(MirimOAuthException);
    });
  });

  describe('makeAuthenticatedRequest', () => {
    beforeEach(() => {
      (oauth as any)._currentUser = mockUser;
      (oauth as any)._tokens = { ...mockTokens, issuedAt: new Date() };
      localStorageMock.setItem('mirim_oauth_tokens', JSON.stringify({ ...mockTokens, issued_at: new Date().toISOString() }));
      localStorageMock.setItem('mirim_oauth_user', JSON.stringify(mockUser));
    });

    it('should make a GET request with Authorization header', async () => {
      const responseData = { data: 'test' };
      (fetch as jest.Mock).mockResolvedValueOnce(
        Promise.resolve({
          ok: true,
          json: async () => responseData,
        })
      );

      const result = await oauth.makeAuthenticatedRequest('/api/data');
      expect(result).toEqual(responseData);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/data'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockTokens.accessToken}`,
          }),
        })
      );
    });

    it('should make a POST request with body and Authorization header', async () => {
      const requestBody = { key: 'value' };
      const responseData = { success: true };
      (fetch as jest.Mock).mockResolvedValueOnce(
        Promise.resolve({
          ok: true,
          json: async () => responseData,
        })
      );

      const result = await oauth.makeAuthenticatedRequest('/api/submit', {
        method: 'POST',
        body: requestBody,
      });

      expect(result).toEqual(responseData);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/submit'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockTokens.accessToken}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestBody),
        })
      );
    });

    it('should refresh token if current token is expired and then make request', async () => {
      (oauth as any)._tokens = { ...mockExpiredTokens, issuedAt: mockExpiredTokens.issuedAt };
      localStorageMock.setItem('mirim_oauth_tokens', JSON.stringify({ ...mockExpiredTokens, issued_at: mockExpiredTokens.issuedAt.toISOString() }));


      const newAccessToken = 'new-access-token-after-refresh';
      const responseData = { data: 'refreshed_data' };

      (fetch as jest.Mock)
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            json: async () => ({
              status: 200,
              data: { accessToken: newAccessToken, expiresIn: 3600 },
            }),
          })
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            ok: true,
            json: async () => responseData,
          })
        );

      const result = await oauth.makeAuthenticatedRequest('/api/secure-data');
      expect(result).toEqual(responseData);
      expect(oauth.accessToken).toBe(newAccessToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: mockExpiredTokens.refreshToken }),
        })
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/secure-data'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${newAccessToken}`,
          }),
        })
      );
    });

    it('should throw MirimOAuthException if request fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce(
        Promise.resolve({
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        })
      );
      await expect(oauth.makeAuthenticatedRequest('/api/nonexistent')).rejects.toThrow(MirimOAuthException);
    });

     it('should throw MirimOAuthException if not logged in and cannot refresh', async () => {
      await oauth.logOut();
      localStorageMock.clear();

      await expect(oauth.makeAuthenticatedRequest('/api/data')).rejects.toThrow(new MirimOAuthException('Not logged in'));
    });
  });

  describe('Subscription', () => {
    it('should notify listeners when state changes', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = oauth.subscribe(listener1);
      oauth.subscribe(listener2);

      (oauth as any).setLoading(true);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      (oauth as any).setLoading(false);
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(2);

      unsubscribe1();
      (oauth as any).setLoading(true);
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(3);
    });
  });
});
