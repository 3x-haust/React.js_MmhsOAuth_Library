import { AuthTokens, isTokenExpired, authTokensToJson, authTokensFromJson } from '../src/auth-tokens';

describe('AuthTokens', () => {
  const now = new Date();
  const oneHour = 3600;

  const validToken: AuthTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: oneHour,
    issuedAt: now,
  };

  const expiredToken: AuthTokens = {
    accessToken: 'expired-access-token',
    refreshToken: 'expired-refresh-token',
    expiresIn: oneHour,
    issuedAt: new Date(now.getTime() - 2 * oneHour * 1000),
  };

  describe('isTokenExpired', () => {
    it('should return false for a valid token', () => {
      expect(isTokenExpired(validToken)).toBe(false);
    });

    it('should return true for an expired token', () => {
      expect(isTokenExpired(expiredToken)).toBe(true);
    });
  });

  describe('authTokensToJson', () => {
    it('should convert AuthTokens to JSON correctly', () => {
      const json = authTokensToJson(validToken);
      expect(json.access_token).toBe(validToken.accessToken);
      expect(json.refresh_token).toBe(validToken.refreshToken);
      expect(json.expires_in).toBe(validToken.expiresIn);
      expect(json.issued_at).toBe(validToken.issuedAt.toISOString());
    });
  });

  describe('authTokensFromJson', () => {
    it('should convert JSON to AuthTokens correctly', () => {
      const json = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 1800,
        issued_at: now.toISOString(),
      };
      const tokens = authTokensFromJson(json);
      expect(tokens.accessToken).toBe(json.access_token);
      expect(tokens.refreshToken).toBe(json.refresh_token);
      expect(tokens.expiresIn).toBe(json.expires_in);
      expect(tokens.issuedAt.toISOString()).toBe(json.issued_at);
    });

    it('should use current date if issued_at is missing', () => {
      const json = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 1800,
      };
      const tokens = authTokensFromJson(json);
      expect(Math.abs(tokens.issuedAt.getTime() - new Date().getTime())).toBeLessThan(1000);
    });
  });
});
