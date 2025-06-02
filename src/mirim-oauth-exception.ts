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
    if (this.errorCode !== undefined) {
      return `MirimOAuthException: ${this.message} (Code: ${this.errorCode})`;
    }
    return `MirimOAuthException: ${this.message} (Code: undefined)`;
  }
}
