import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFileManager,
  createImageManifestHandler,
  createLocalFileStorageDriver,
  createStorageUrlLocationStrategy,
  imageProcessor,
  resolveLocalStoragePath,
  type FileMetadataRecord,
  type FileMetadataStore,
} from '../index.js';

let tempRoot: string | null = null;

afterEach(async () => {
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  tempRoot = null;
});

async function createTempRoot() {
  tempRoot = await mkdtemp(join(tmpdir(), 'landing-files-'));
  return tempRoot;
}

function createMemoryMetadataStore(): FileMetadataStore & { records: Map<string, FileMetadataRecord> } {
  const records = new Map<string, FileMetadataRecord>();
  return {
    records,
    async get(fileKey, processor) {
      const record = records.get(`${processor ?? 'image'}:${fileKey}`);
      return record ?? null;
    },
    async upsert(record) {
      records.set(`${record.processor}:${record.fileKey}`, record);
    },
    async delete(fileKey, processor) {
      records.delete(`${processor ?? 'image'}:${fileKey}`);
    },
  };
}

describe('file manager', () => {
  it('rejects local storage path traversal', async () => {
    const root = await createTempRoot();
    expect(() => resolveLocalStoragePath(root, '../secret.txt')).toThrow('Invalid storage path');
  });

  it('upload handler returns path/url/data object and relative path', async () => {
    const root = await createTempRoot();
    const manager = createFileManager({
      storage: createLocalFileStorageDriver({ root }),
      locations: createStorageUrlLocationStrategy(),
      upload: { publicBaseUrl: 'https://landing.example.com' },
    });
    const handler = manager.createUploadHandler();
    const formData = new FormData();
    formData.set('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));

    const response = await handler({
      request: new Request('http://localhost/api/upload/private', {
        method: 'POST',
        body: formData,
      }),
      params: { destination: 'private' },
      url: new URL('http://localhost/api/upload/private'),
    } as any);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.path).toMatch(/^\/storage\/temp\/private\/\d+-hello\.txt$/);
    expect(payload.data).toBe(payload.path);
    expect(payload.url).toBe(`https://landing.example.com${payload.path}`);
  });

  it('promotes nested temp URLs and deletes replaced files', async () => {
    const root = await createTempRoot();
    const storage = createLocalFileStorageDriver({ root });
    const manager = createFileManager({
      storage,
      locations: createStorageUrlLocationStrategy(),
    });

    await mkdir(join(root, 'temp/private'), { recursive: true });
    await mkdir(join(root, 'private'), { recursive: true });
    await writeFile(join(root, 'temp/private/new.txt'), 'new');
    await writeFile(join(root, 'private/old.txt'), 'old');
    const deleteSpy = vi.spyOn(storage, 'delete');

    const result = await manager.processPayloadFiles(
      { media: { path: '/storage/temp/private/new.txt', url: 'https://old-host.com/storage/temp/private/new.txt' } },
      {
        previousData: { media: '/storage/private/old.txt' },
        deleteReplacedFiles: true,
      },
    );

    expect(result).toEqual({ media: '/storage/private/new.txt' });
    await expect(readFile(join(root, 'private/new.txt'), 'utf8')).resolves.toBe('new');
    expect(deleteSpy).toHaveBeenCalledWith(expect.objectContaining({ key: 'private/old.txt' }));
  });

  it('promotes absolute old temp URL to relative permanent path', async () => {
    const root = await createTempRoot();
    const manager = createFileManager({
      storage: createLocalFileStorageDriver({ root }),
      locations: createStorageUrlLocationStrategy(),
    });

    await mkdir(join(root, 'temp/public'), { recursive: true });
    await writeFile(join(root, 'temp/public/tmp.txt'), 'x');

    const promoted = await manager.promoteTempFile('https://old-host.com/storage/temp/public/tmp.txt');
    expect(promoted).toBe('/storage/public/tmp.txt');
  });

  it('delete and collect accept absolute and relative storage URLs', async () => {
    const root = await createTempRoot();
    const storage = createLocalFileStorageDriver({ root });
    const manager = createFileManager({
      storage,
      locations: createStorageUrlLocationStrategy(),
    });

    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public/a.txt'), 'a');
    await manager.deleteFile('https://old-host.com/storage/public/a.txt');

    const urls = manager.collectFileUrls({
      one: '/storage/public/a.txt',
      two: 'https://old-host.com/storage/public/b.txt',
      three: 'https://youtube.com/watch?v=x',
    });
    expect(urls).toContain('/storage/public/a.txt');
    expect(urls).toContain('/storage/public/b.txt');
    expect(urls).not.toContain('https://youtube.com/watch?v=x');
  });

  it('processes images, stores metadata, and exposes a manifest', async () => {
    const root = await createTempRoot();
    const metadataStore = createMemoryMetadataStore();
    const manager = createFileManager({
      storage: createLocalFileStorageDriver({ root }),
      locations: createStorageUrlLocationStrategy(),
      metadataStore,
      processors: [imageProcessor()],
    });

    const imageBytes = await sharp({
      create: {
        width: 64,
        height: 32,
        channels: 3,
        background: '#ff0000',
      },
    }).jpeg().toBuffer();
    await mkdir(join(root, 'temp/private'), { recursive: true });
    await writeFile(join(root, 'temp/private/photo.jpg'), imageBytes);

    const result = await manager.promoteTempFile('/storage/temp/private/photo.jpg');
    expect(result).toBe('/storage/private/photo.jpg');

    const record = await metadataStore.get('private/photo.jpg', 'image');
    expect(record?.data.width).toBe(64);
    expect((record?.data.variants as any[]).length).toBeGreaterThan(0);

    const manifestHandler = createImageManifestHandler({
      metadataStore,
      keyFromRequest: () => 'private/photo.jpg',
    });
    const response = await manifestHandler({ params: {}, url: new URL('http://localhost') } as any);
    expect(response.status).toBe(200);
    const manifest = await response.json();
    expect(manifest.placeholder).toMatch(/^data:image\/webp;base64,/);
    expect(manifest.variants[0].url).toContain('/storage/private/photo__w');
  });
});
