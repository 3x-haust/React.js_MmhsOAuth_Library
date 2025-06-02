export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  issuedAt: Date;
}

export function isTokenExpired(tokens: AuthTokens): boolean {
  const expirationDate = new Date(tokens.issuedAt.getTime() + tokens.expiresIn * 1000);
  return new Date().getTime() > expirationDate.getTime();
}

export function authTokensToJson(tokens: AuthTokens): any {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_in: tokens.expiresIn,
    issued_at: tokens.issuedAt.toISOString(),
  };
}

export function authTokensFromJson(json: any): AuthTokens {
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string,
    expiresIn: json.expires_in as number,
    issuedAt: json.issued_at ? new Date(json.issued_at) : new Date(),
  };
}
