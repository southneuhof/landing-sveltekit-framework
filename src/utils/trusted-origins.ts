const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://localhost:4175',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'http://127.0.0.1:4175',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

export function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function parseTrustedOrigins(config: {
  appUrl?: string | null;
  authUrl?: string | null;
  trustedOrigins?: string | null;
  authTrustedOrigins?: string | null;
  includeDefaultDevOrigins?: boolean;
}): string[] {
  const configured = [
    config.authUrl,
    config.appUrl,
    ...(config.authTrustedOrigins?.split(',') ?? []),
    ...(config.trustedOrigins?.split(',') ?? []),
  ]
    .map((origin) => origin?.trim())
    .filter(Boolean) as string[];

  const base = config.includeDefaultDevOrigins === false ? [] : DEFAULT_DEV_ORIGINS;
  const origins = [...base, ...configured]
    .map(normalizeOrigin)
    .filter(Boolean) as string[];

  return [...new Set(origins)];
}

export function createTrustedOriginChecker(config: {
  trustedOrigins: string[];
  nodeEnv?: string;
}): (origin: string | null) => boolean {
  const trustedSet = new Set(config.trustedOrigins);

  return (origin: string | null) => {
    if (!origin) return false;

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) return false;

    if (trustedSet.has(normalizedOrigin)) return true;

    if (config.nodeEnv !== 'production') {
      try {
        const { hostname, protocol } = new URL(normalizedOrigin);
        if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
          return true;
        }
      } catch {
        return false;
      }
    }

    return false;
  };
}
