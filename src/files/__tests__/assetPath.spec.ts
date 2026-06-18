import { describe, expect, it } from 'vitest';
import {
  normalizeFileUploadValue,
  toPublicAssetUrl,
  toStoredAssetPath,
} from '../assetPath.js';

describe('asset path utilities', () => {
  it('converts absolute storage URL to relative path', () => {
    expect(toStoredAssetPath('https://hkr.test/storage/public/a.jpg')).toBe('/storage/public/a.jpg');
  });

  it('keeps relative storage path unchanged', () => {
    expect(toStoredAssetPath('/storage/public/a.jpg')).toBe('/storage/public/a.jpg');
  });

  it('keeps external URL unchanged', () => {
    expect(toStoredAssetPath('https://youtube.com/watch?v=x')).toBe('https://youtube.com/watch?v=x');
  });

  it('prefers path over url when normalizing file object', () => {
    expect(normalizeFileUploadValue({
      path: '/storage/public/path.jpg',
      url: 'https://hkr.test/storage/public/url.jpg',
    })).toBe('/storage/public/path.jpg');
  });

  it('supports nested data.path', () => {
    expect(normalizeFileUploadValue({
      data: {
        path: '/storage/private/nested.pdf',
      },
      url: 'https://hkr.test/storage/private/fallback.pdf',
    })).toBe('/storage/private/nested.pdf');
  });

  it('normalizes empty and null safely', () => {
    expect(normalizeFileUploadValue(null)).toBeNull();
    expect(normalizeFileUploadValue(undefined)).toBeUndefined();
    expect(normalizeFileUploadValue('')).toBe('');
  });

  it('does not collapse non-file objects that happen to have url fields', () => {
    expect(
      normalizeFileUploadValue({
        id: 'content-1',
        title: 'Example',
        url: 'https://google.com',
        cta: 'https://google.com',
      }),
    ).toBeUndefined();
  });

  it('expands public URL when base URL exists', () => {
    expect(toPublicAssetUrl('/storage/public/a.jpg', 'https://hkr.test')).toBe('https://hkr.test/storage/public/a.jpg');
  });
});
