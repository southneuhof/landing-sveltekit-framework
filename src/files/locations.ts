import { basename, dirname, join } from 'node:path';
import { toPublicAssetUrl } from './assetPath.js';
import type { FileLocationStrategy } from './types.js';

export type StorageUrlLocationStrategyConfig = {
  publicBaseUrl?: string;
  basePath?: string;
  defaultVisibility?: string;
};

export function createStorageUrlLocationStrategy(config: StorageUrlLocationStrategyConfig = {}): FileLocationStrategy {
  const basePath = config.basePath ?? '/storage';
  const defaultVisibility = config.defaultVisibility ?? 'private';

  return {
    fromUrl(url) {
      const parsed = new URL(url, 'http://localhost');
      if (!parsed.pathname.startsWith(`${basePath}/`)) return null;

      const key = decodeURIComponent(parsed.pathname.slice(basePath.length + 1));
      if (!key) return null;
      const segments = key.split('/');
      const visibility = segments[0] === 'temp' ? segments[1] : segments[0];
      const canonicalUrl = toStorageUrl(key, basePath);
      const metadata: Record<string, unknown> = {};

      if (config.publicBaseUrl) {
        metadata.publicUrl = toPublicAssetUrl(canonicalUrl, config.publicBaseUrl);
      } else if (isAbsoluteUrl(url)) {
        metadata.publicUrl = toPublicAssetUrl(canonicalUrl, parsed.origin);
      }

      return {
        key,
        url: canonicalUrl,
        filename: basename(key),
        visibility,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    },
    isTemp(file) {
      return file.key.startsWith('temp/public/') || file.key.startsWith('temp/private/');
    },
    toTemp(input) {
      const visibility = input.visibility || defaultVisibility;
      const filename = safeFilename(input.filename);
      const key = join('temp', visibility, `${Date.now()}-${filename}`);
      const url = toStorageUrl(key, basePath);
      return {
        key,
        url,
        filename: basename(key),
        contentType: input.contentType,
        visibility,
        metadata: {
          publicUrl: toPublicAssetUrl(url, config.publicBaseUrl ?? input.requestUrl.origin),
        },
      };
    },
    toPermanent(tempFile) {
      const key = tempFile.key.replace(/^temp\//, '');
      const url = toStorageUrl(key, basePath);
      const baseForPublicUrl = typeof tempFile.metadata?.publicBaseUrl === 'string'
        ? tempFile.metadata.publicBaseUrl
        : config.publicBaseUrl;
      return {
        ...tempFile,
        key,
        url,
        filename: basename(key),
        metadata: {
          ...tempFile.metadata,
          ...(baseForPublicUrl ? { publicUrl: toPublicAssetUrl(url, baseForPublicUrl) } : {}),
        },
      };
    },
    derivativeFor(source, filename) {
      const key = join(dirname(source.key), filename);
      const url = toStorageUrl(key, basePath);
      const baseForPublicUrl = typeof source.metadata?.publicBaseUrl === 'string'
        ? source.metadata.publicBaseUrl
        : config.publicBaseUrl;
      return {
        ...source,
        key,
        url,
        filename,
        metadata: {
          ...source.metadata,
          ...(baseForPublicUrl ? { publicUrl: toPublicAssetUrl(url, baseForPublicUrl) } : {}),
        },
      };
    },
  };
}

export function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function toStorageUrl(key: string, basePath: string): string {
  return `${basePath}/${encodeKey(key)}`;
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
