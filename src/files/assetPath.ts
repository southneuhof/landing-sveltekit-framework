const DEFAULT_BASE_PATH = '/storage';

function normalizeBasePath(basePath?: string): string {
  const value = (basePath ?? DEFAULT_BASE_PATH).trim();
  if (!value) return DEFAULT_BASE_PATH;
  return value.startsWith('/') ? value : `/${value}`;
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isStorageAsset(value: string, basePath?: string): boolean {
  const normalizedBasePath = normalizeBasePath(basePath);
  return value.startsWith(`${normalizedBasePath}/`);
}

export function isAbsoluteStorageAsset(value: string, basePath?: string): boolean {
  const parsed = tryParseUrl(value);
  if (!parsed) return false;

  return isStorageAsset(parsed.pathname, basePath);
}

export function toStoredAssetPath(value: string, options?: { basePath?: string }): string {
  const normalizedBasePath = normalizeBasePath(options?.basePath);
  const input = value.trim();
  if (!input) return input;

  if (isStorageAsset(input, normalizedBasePath)) {
    return input;
  }

  const parsed = tryParseUrl(input);
  if (!parsed) return input;

  if (!isStorageAsset(parsed.pathname, normalizedBasePath)) {
    return input;
  }

  return parsed.pathname;
}

export function toPublicAssetUrl(path: string, baseUrl?: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) return trimmedPath;
  if (!baseUrl) return trimmedPath;

  try {
    return new URL(trimmedPath, baseUrl).toString();
  } catch {
    return trimmedPath;
  }
}

export function normalizeFileUploadValue(value: unknown): string | null | undefined {
  if (value == null) return value as null | undefined;

  if (typeof value === 'string') {
    return toStoredAssetPath(value);
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const path = record.path;

  if (typeof path === 'string') {
    return toStoredAssetPath(path);
  }

  const data = record.data;
  if (data && typeof data === 'object') {
    const nestedPath = (data as Record<string, unknown>).path;
    if (typeof nestedPath === 'string') {
      return toStoredAssetPath(nestedPath);
    }
  }

  if (typeof data === 'string') {
    return toStoredAssetPath(data);
  }

  const url = record.url;
  if (typeof url === 'string') {
    return toStoredAssetPath(url);
  }

  return undefined;
}
