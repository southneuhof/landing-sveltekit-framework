import { describe, expect, it } from 'vitest';
import { createTrustedOriginChecker, parseTrustedOrigins } from '../trusted-origins.js';

describe('trusted origins', () => {
  it('parses and normalizes origins', () => {
    const origins = parseTrustedOrigins({
      appUrl: 'https://app.example.com/path',
      authUrl: 'https://auth.example.com',
      trustedOrigins: 'https://x.example.com, invalid',
      authTrustedOrigins: 'https://x.example.com',
      includeDefaultDevOrigins: false,
    });

    expect(origins).toEqual([
      'https://auth.example.com',
      'https://app.example.com',
      'https://x.example.com',
    ]);
  });

  it('validates origin with localhost fallback in non-production', () => {
    const isTrustedOrigin = createTrustedOriginChecker({
      trustedOrigins: ['https://app.example.com'],
      nodeEnv: 'development',
    });

    expect(isTrustedOrigin('https://app.example.com')).toBe(true);
    expect(isTrustedOrigin('http://localhost:3000')).toBe(true);
    expect(isTrustedOrigin('https://evil.example.com')).toBe(false);
  });
});
