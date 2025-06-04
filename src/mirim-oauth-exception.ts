export class MirimOAuthException extends Error {
  errorCode?: number;
  data?: any;

  constructor(message: string, errorCode?: number, data?: any) {
    super(message);
    this.name = 'MirimOAuthException';
    this.errorCode = errorCode;
    this.data = data;
  }

  toString(): string {
    return `MirimOAuthException: ${this.message}`;
  }
}
