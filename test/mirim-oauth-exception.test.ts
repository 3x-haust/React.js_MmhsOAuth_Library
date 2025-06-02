import { MirimOAuthException } from '../src/mirim-oauth-exception';

describe('MirimOAuthException', () => {
  it('should create an exception with a message', () => {
    const message = 'Test error message';
    const exception = new MirimOAuthException(message);
    expect(exception.message).toBe(message);
    expect(exception.name).toBe('MirimOAuthException');
    expect(exception.errorCode).toBeUndefined();
    expect(exception.data).toBeUndefined();
  });

  it('should create an exception with a message and error code', () => {
    const message = 'Test error with code';
    const errorCode = 401;
    const exception = new MirimOAuthException(message, errorCode);
    expect(exception.message).toBe(message);
    expect(exception.errorCode).toBe(errorCode);
    expect(exception.data).toBeUndefined();
  });

  it('should create an exception with a message, error code, and data', () => {
    const message = 'Test error with code and data';
    const errorCode = 500;
    const data = { detail: 'Server issue' };
    const exception = new MirimOAuthException(message, errorCode, data);
    expect(exception.message).toBe(message);
    expect(exception.errorCode).toBe(errorCode);
    expect(exception.data).toEqual(data);
  });

  describe('toString', () => {
    it('should return a formatted string with message and code', () => {
      const message = 'Formatted error';
      const errorCode = 403;
      const exception = new MirimOAuthException(message, errorCode);
      expect(exception.toString()).toBe(`MirimOAuthException: ${message}`);
    });

    it('should return a formatted string with message when code is undefined', () => {
      const message = 'Formatted error no code';
      const exception = new MirimOAuthException(message);
      expect(exception.toString()).toBe(`MirimOAuthException: ${message}`);
    });
  });
});
