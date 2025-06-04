import { MirimUser, mirimUserFromJson, mirimUserToJson } from './mirim-user';
import { AuthTokens, authTokensFromJson, authTokensToJson, isTokenExpired } from './auth-tokens';
import { MirimOAuthException } from './mirim-oauth-exception';

const TOKEN_KEY = 'mirim_oauth_tokens';
const USER_KEY = 'mirim_oauth_user';

interface MirimOAuthProps {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  oauthServerUrl?: string;
  scopes: string;
  storage?: Storage;
}

interface AuthenticatedRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, any>;
  additionalHeaders?: Record<string, string>;
}

export class MirimOAuth {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private oauthServerUrl: string;
  private scopes: string;
  private storage: Storage;

  private _currentUser: MirimUser | null = null;
  private _tokens: AuthTokens | null = null;
  private _isLoading: boolean = false;
  private _lastOAuthState: string | null = null;
  private listeners: Array<() => void> = [];

  constructor(props: MirimOAuthProps) {
    this.clientId = props.clientId;
    this.clientSecret = props.clientSecret;
    this.redirectUri = props.redirectUri;
    this.oauthServerUrl = props.oauthServerUrl || 'https://api-auth.mmhs.app';
    this.scopes = props.scopes;
    this.storage = props.storage || localStorage;
  }

  get currentUser(): MirimUser | null {
    return this._currentUser;
  }

  get isLoggedIn(): boolean {
    return !!this._currentUser && !!this._tokens && !isTokenExpired(this._tokens);
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get accessToken(): string | undefined {
    return this._tokens?.accessToken;
  }

  get refreshToken(): string | undefined {
    return this._tokens?.refreshToken;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  private setLoading(loading: boolean): void {
    this._isLoading = loading;
    this.notifyListeners();
  }

  async logIn(): Promise<MirimUser> {
    try {
      this.setLoading(true);
      
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: Error | null = null;

      while (attempts < maxAttempts) {
        try {
          const tokens = await this.authenticate();
          const user = await this.fetchUserInfo(tokens.accessToken);
          
          this._tokens = tokens;
          this._currentUser = user;
          
          this.setLoading(false);
          return user;
        } catch (error) {
          attempts++;
          lastError = error as Error;
          
          if (error instanceof MirimOAuthException && 
              (error.message.includes('cancelled') || 
               error.message.includes('timeout') ||
               error.message.includes('popup'))) {
            break;
          }
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      this.setLoading(false);
      throw lastError || new MirimOAuthException('Login failed after multiple attempts');
    } catch (error) {
      this.setLoading(false);
      throw error;
    }
  }

  async logOut(): Promise<void> {
    try {
      this.setLoading(true);
      
      this.storage.removeItem(TOKEN_KEY);
      this.storage.removeItem(USER_KEY);
      this._currentUser = null;
      this._tokens = null;
      
      this.setLoading(false);
    } catch (error) {
      this.setLoading(false);
      throw error;
    }
  }

  async checkIsLoggedIn(): Promise<boolean> {
    try {
      if (this.isLoggedIn) return true;
      
      const tokenJson = this.storage.getItem(TOKEN_KEY);
      if (!tokenJson) {
        return false;
      }

      const tokens = authTokensFromJson(JSON.parse(tokenJson));
      if (isTokenExpired(tokens)) {
        try {
          this._tokens = await this.performTokenRefresh(tokens.refreshToken);
          this._currentUser = await this.getStoredUser();
          this.notifyListeners();
          return true;
        } catch (error) {
          console.warn('Token refresh failed during check login:', error);
          await this.logOut();
          return false;
        }
      }
      
      this._tokens = tokens;
      this._currentUser = await this.getStoredUser();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.warn('Check login failed:', error);
      try {
        await this.logOut();
      } catch (logoutError) {
        console.warn('Logout during check login failed:', logoutError);
      }
      return false;
    }
  }

  async refreshUserInfo(): Promise<MirimUser> {
    try {
      this.setLoading(true);
      
      const tokens = await this.getValidTokens();
      const user = await this.fetchUserInfo(tokens.accessToken);
      this._currentUser = user;
      
      this.setLoading(false);
      return user;
    } catch (error) {
      this.setLoading(false);
      throw error;
    }
  }

  async refreshTokens(refreshToken?: string): Promise<AuthTokens> {
    const tokenToRefresh = refreshToken || this._tokens?.refreshToken;
    if (!tokenToRefresh) {
      throw new MirimOAuthException('Not logged in');
    }
    
    try {
      this.setLoading(true);
      const tokens = await this.performTokenRefresh(tokenToRefresh);
      this._tokens = tokens;
      this.setLoading(false);
      return tokens;
    } catch (error) {
      this.setLoading(false);
      throw error;
    }
  }

  async makeAuthenticatedRequest(
    endpoint: string, 
    options: AuthenticatedRequestOptions = {}
  ): Promise<any> {
    const { method = 'GET', body, additionalHeaders } = options;
    
    try {
      const tokens = await this.getValidTokens();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken}`,
        ...additionalHeaders,
      };

      const requestInit: RequestInit = {
        method,
        headers,
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        requestInit.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.oauthServerUrl}${endpoint}`, requestInit);

      if (!response.ok) {
        const errorText = await response.text();
        throw new MirimOAuthException(
          `Request failed with status ${response.status}: ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof MirimOAuthException) throw error;
      throw new MirimOAuthException(`Request failed: ${error}`);
    }
  }

  private async getValidTokens(): Promise<AuthTokens> {
    if (!this._tokens || isTokenExpired(this._tokens)) {
      const storedTokenJson = this.storage.getItem(TOKEN_KEY);
      if (!storedTokenJson) {
        throw new MirimOAuthException('Not logged in');
      }
      
      try {
        const storedTokens = authTokensFromJson(JSON.parse(storedTokenJson));
        if (isTokenExpired(storedTokens)) {
          const refreshedTokens = await this.performTokenRefresh(storedTokens.refreshToken);
          this._tokens = refreshedTokens;
          return refreshedTokens;
        }
        this._tokens = storedTokens;
        return storedTokens;
      } catch (error) {
        throw new MirimOAuthException(`Failed to get valid tokens: ${error}`);
      }
    }
    
    return this._tokens;
  }

  private async getStoredUser(): Promise<MirimUser | null> {
    const userJson = this.storage.getItem(USER_KEY);
    if (!userJson) {
      return null;
    }

    try {
      return mirimUserFromJson(JSON.parse(userJson));
    } catch (error) {
      throw new MirimOAuthException(`Failed to get user data: ${error}`);
    }
  }

  private async authenticate(): Promise<AuthTokens> {
    try {
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      const state = this.generateCodeVerifier();
      this._lastOAuthState = state;

      const authUrl = new URL(`${this.oauthServerUrl}/api/v1/oauth/authorize`);
      authUrl.searchParams.set('client_id', this.clientId);
      authUrl.searchParams.set('redirect_uri', this.redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', this.scopes);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      const popup = window.open(
        authUrl.toString(),
        'oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes,location=yes,status=yes,toolbar=no,menubar=no,left=' + 
        (window.screen.width / 2 - 300) + ',top=' + (window.screen.height / 2 - 350)
      );

      if (!popup) {
        throw new MirimOAuthException('Failed to open authentication popup');
      }

      popup.focus();

      return new Promise((resolve, reject) => {
        let isResolved = false;
        let checkClosedInterval: NodeJS.Timeout | null = null;
        let urlCheckInterval: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (checkClosedInterval) {
            clearInterval(checkClosedInterval);
            checkClosedInterval = null;
          }
          if (urlCheckInterval) {
            clearInterval(urlCheckInterval);
            urlCheckInterval = null;
          }
          window.removeEventListener('message', messageListener);
          try {
            if (!popup.closed) {
              popup.close();
            }
          } catch (e) {}
        };

        const processCallback = async (url: string | URL) => {
          try {
            const uri = typeof url === 'string' ? new URL(url) : url;
            const code = uri.searchParams.get('code');
            const receivedState = uri.searchParams.get('state');
            const error = uri.searchParams.get('error');
            const errorDescription = uri.searchParams.get('error_description');

            if (error) {
              const errorMessage = errorDescription ? `${error}: ${errorDescription}` : error;
              reject(new MirimOAuthException(`Authentication failed: ${errorMessage}`));
              return;
            }

            if (!code) {
              reject(new MirimOAuthException('Authorization code not received'));
              return;
            }

            if (receivedState !== this._lastOAuthState) {
              reject(new MirimOAuthException('Invalid state parameter'));
              return;
            }

            const tokens = await this.exchangeCodeForTokens(code, receivedState);
            resolve(tokens);
          } catch (err) {
            reject(err);
          }
        };

        const messageListener = async (event: MessageEvent) => {
          if (event.origin !== new URL(this.redirectUri).origin) {
            return;
          }
          if (isResolved) return;

          try {
            const data = event.data;
            
            if (!data) {
              return;
            }

            let parsedData = data;
            if (typeof data === 'string') {
              try {
                parsedData = JSON.parse(data);
              } catch {
                if (data.includes('code=') || data.includes('error=')) {
                  await processCallback(data);
                  return;
                }
                return;
              }
            }

            if (parsedData.type === 'oauth_callback' || parsedData.code || parsedData.error) {
              isResolved = true;
              cleanup();
              
              if (parsedData.url) {
                await processCallback(parsedData.url);
              } else {
                const { code, state: receivedState, error, error_description } = parsedData;

                if (error) {
                  const errorMessage = error_description ? `${error}: ${error_description}` : error;
                  reject(new MirimOAuthException(`Authentication failed: ${errorMessage}`));
                  return;
                }

                if (!code) {
                  reject(new MirimOAuthException('Authorization code not received'));
                  return;
                }

                if (receivedState !== this._lastOAuthState) {
                  reject(new MirimOAuthException('Invalid state parameter'));
                  return;
                }

                const tokens = await this.exchangeCodeForTokens(code, receivedState);
                resolve(tokens);
              }
            }
          } catch (err) {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              reject(err);
            }
          }
        };

        window.addEventListener('message', messageListener);

        checkClosedInterval = setInterval(() => {
          if (popup.closed && !isResolved) {
            isResolved = true;
            cleanup();
            reject(new MirimOAuthException('Authentication was cancelled by user'));
            return;
          }
        }, 500);

        urlCheckInterval = setInterval(() => {
          try {
            if (popup.closed) return;
            
            let currentUrl: string;
            try {
              currentUrl = popup.location?.href;
            } catch (e) {
              return;
            }
            
            if (currentUrl && (currentUrl.startsWith(this.redirectUri) || 
                             currentUrl.includes('code=') || 
                             currentUrl.includes('error='))) {
              if (!isResolved) {
                isResolved = true;
                cleanup();
                processCallback(currentUrl);
              }
            }
          } catch (e) {}
        }, 200);

        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            reject(new MirimOAuthException('Authentication timeout'));
          }
        }, 120000);
      });
    } catch (error) {
      if (error instanceof MirimOAuthException) throw error;
      throw new MirimOAuthException(`Authentication failed: ${error}`);
    }
  }

  private async exchangeCodeForTokens(code: string, state: string | null): Promise<AuthTokens> {
    try {
      const response = await fetch(`${this.oauthServerUrl}/api/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          state,
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          redirectUri: this.redirectUri,
          scopes: this.scopes,
        }),
      });

      if (!response.ok) {
        throw new MirimOAuthException(
          'Failed to exchange code for tokens',
          response.status,
          await response.text()
        );
      }

      const data = await response.json();
      if (data.status !== 200) {
        throw new MirimOAuthException(
          data.message || 'Token exchange failed',
          data.status,
          data
        );
      }

      const tokenData = data.data;
      const tokens: AuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in || 3600,
        issuedAt: new Date(),
      };

      this.storage.setItem(TOKEN_KEY, JSON.stringify(authTokensToJson(tokens)));
      return tokens;
    } catch (error) {
      if (error instanceof MirimOAuthException) throw error;
      throw new MirimOAuthException(`Failed to exchange code for tokens: ${error}`);
    }
  }

  private async performTokenRefresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const response = await fetch(`${this.oauthServerUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new MirimOAuthException(
          'Token refresh failed',
          response.status,
          await response.text()
        );
      }

      const data = await response.json();
      if (data.status !== 200) {
        throw new MirimOAuthException(
          data.message || 'Token refresh failed',
          data.status,
          data
        );
      }

      const tokenData = data.data;
      const tokens: AuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresIn: tokenData.expires_in || 3600,
        issuedAt: new Date(),
      };

      this.storage.setItem(TOKEN_KEY, JSON.stringify(authTokensToJson(tokens)));
      return tokens;
    } catch (error) {
      if (error instanceof MirimOAuthException) throw error;
      throw new MirimOAuthException(`Failed to refresh tokens: ${error}`);
    }
  }

  private async fetchUserInfo(accessToken: string): Promise<MirimUser> {
    try {
      const response = await fetch(`${this.oauthServerUrl}/api/v1/user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new MirimOAuthException(
          'Failed to fetch user info',
          response.status,
          await response.text()
        );
      }

      const data = await response.json();
      if (data.status !== 200) {
        throw new MirimOAuthException(
          data.message || 'Failed to fetch user info',
          data.status,
          data
        );
      }

      const userData = data.data;
      const user = mirimUserFromJson(userData);

      this.storage.setItem(USER_KEY, JSON.stringify(mirimUserToJson(user)));
      return user;
    } catch (error) {
      if (error instanceof MirimOAuthException) throw error;
      throw new MirimOAuthException(`Failed to fetch user info: ${error}`);
    }
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
