import { basename, dirname, join } from 'node:path';
import type { FileLocationStrategy, FileObject } from './types.js';

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
      const parsed = new URL(url, config.publicBaseUrl ?? 'http://localhost');
      if (!parsed.pathname.startsWith(`${basePath}/`)) return null;

      const key = decodeURIComponent(parsed.pathname.slice(basePath.length + 1));
      if (!key) return null;
      const segments = key.split('/');
      const visibility = segments[0] === 'temp' ? segments[1] : segments[0];
      const publicBaseUrl = config.publicBaseUrl ?? (isAbsoluteUrl(url) ? parsed.origin : undefined);

      return {
        key,
        url: toStorageUrl(key, basePath, publicBaseUrl),
        filename: basename(key),
        visibility,
        metadata: publicBaseUrl ? { publicBaseUrl } : undefined,
      };
    },
    isTemp(file) {
      return file.key.startsWith('temp/public/') || file.key.startsWith('temp/private/');
    },
    toTemp(input) {
      const visibility = input.visibility || defaultVisibility;
      const filename = safeFilename(input.filename);
      const key = join('temp', visibility, `${Date.now()}-${filename}`);
      return {
        key,
        url: toStorageUrl(key, basePath, config.publicBaseUrl ?? input.requestUrl.origin),
        filename: basename(key),
        contentType: input.contentType,
        visibility,
        metadata: { publicBaseUrl: config.publicBaseUrl ?? input.requestUrl.origin },
      };
    },
    toPermanent(tempFile) {
      const key = tempFile.key.replace(/^temp\//, '');
      const publicBaseUrl = typeof tempFile.metadata?.publicBaseUrl === 'string'
        ? tempFile.metadata.publicBaseUrl
        : config.publicBaseUrl;
      return {
        ...tempFile,
        key,
        url: toStorageUrl(key, basePath, publicBaseUrl),
        filename: basename(key),
      };
    },
    derivativeFor(source, filename) {
      const key = join(dirname(source.key), filename);
      const publicBaseUrl = typeof source.metadata?.publicBaseUrl === 'string'
        ? source.metadata.publicBaseUrl
        : config.publicBaseUrl;
      return {
        ...source,
        key,
        url: toStorageUrl(key, basePath, publicBaseUrl),
        filename,
      };
    },
  };
}

export function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function toStorageUrl(key: string, basePath: string, publicBaseUrl?: string): string {
  const path = `${basePath}/${encodeKey(key)}`;
  return publicBaseUrl ? new URL(path, publicBaseUrl).toString() : path;
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
