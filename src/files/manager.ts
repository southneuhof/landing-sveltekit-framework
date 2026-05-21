import { json, type RequestHandler } from '@sveltejs/kit';
import { lookup } from 'mime-types';
import {
  isStorageAsset,
  normalizeFileUploadValue,
  toPublicAssetUrl,
  toStoredAssetPath,
} from './assetPath.js';
import type {
  FileManager,
  FileManagerConfig,
  FileManagerContext,
  FileMetadataRecord,
  FileObject,
} from './types.js';

export function createFileManager(config: FileManagerConfig): FileManager {
  const processors = config.processors ?? [];
  const managerContext: FileManagerContext = {
    storage: config.storage,
    locations: config.locations,
    metadataStore: config.metadataStore,
  };

  async function promoteTempFile(url: string): Promise<string> {
    const normalizedInput = toStoredAssetPath(url);
    const source = config.locations.fromUrl(normalizedInput);
    if (!source || !config.locations.isTemp(source)) return normalizedInput;

    const bytes = await config.storage.read(source);
    const sourceWithContentType = {
      ...source,
      contentType: source.contentType || lookup(source.filename) || undefined,
    };
    const permanent = config.locations.toPermanent(sourceWithContentType);
    const matchingProcessor = await findProcessor(permanent, bytes);

    if (!matchingProcessor) {
      if (config.storage.move) {
        const moved = await config.storage.move(source, permanent);
        return toStoredAssetPath(moved.url);
      }
      await config.storage.write(permanent, bytes);
      await config.storage.delete(source);
      return toStoredAssetPath(permanent.url);
    }

    try {
      const result = await matchingProcessor.process({ file: permanent, bytes, manager: managerContext });
      const primary = result.primary ?? { file: permanent, bytes };
      const writtenPrimary = await config.storage.write(primary.file, primary.bytes);
      const derivatives: FileObject[] = [];

      for (const derivative of result.derivatives ?? []) {
        const writtenDerivative = await config.storage.write(derivative.file, derivative.bytes);
        derivatives.push(writtenDerivative);
      }

      if (config.metadataStore && result.metadata) {
        await config.metadataStore.upsert({
          fileKey: writtenPrimary.key,
          fileUrl: toStoredAssetPath(writtenPrimary.url),
          processor: matchingProcessor.name,
          data: result.metadata,
          derivatives,
        });
      }

      await config.storage.delete(source);
      return toStoredAssetPath(writtenPrimary.url);
    } catch (err) {
      console.error(`[FileManager] Processor "${matchingProcessor.name}" failed, storing original file:`, err);
      await config.storage.write(permanent, bytes);
      await config.storage.delete(source);
      return toStoredAssetPath(permanent.url);
    }
  }

  async function deleteFile(url: string): Promise<void> {
    const normalizedInput = toStoredAssetPath(url);
    const file = config.locations.fromUrl(normalizedInput);
    if (!file) return;

    for (const processor of processors) {
      const metadata = await config.metadataStore?.get(file.key, processor.name);
      if (!metadata) continue;

      if (processor.cleanup) {
        await processor.cleanup({ file, metadata: metadata.data, manager: managerContext });
      } else {
        await deleteDerivatives(metadata);
      }

      await config.metadataStore?.delete(file.key, processor.name);
    }

    await config.storage.delete(file);
  }

  async function processPayloadFiles<T>(
    input: T,
    options: {
      previousData?: unknown;
      deleteReplacedFiles?: boolean;
    } = {},
  ): Promise<T> {
    const output = await processValue(input, options.previousData, options.deleteReplacedFiles ?? false);
    return output as T;
  }

  async function processValue(value: unknown, previousValue: unknown, deleteReplacedFiles: boolean): Promise<unknown> {
    if (Array.isArray(value)) {
      const previousArray = Array.isArray(previousValue) ? previousValue : [];
      return Promise.all(value.map((item, index) => processValue(item, previousArray[index], deleteReplacedFiles)));
    }

    const normalizedUploadValue = normalizeFileUploadValue(value);
    if (typeof normalizedUploadValue === 'string') {
      return processStorageString(normalizedUploadValue, previousValue, deleteReplacedFiles);
    }

    if (value && typeof value === 'object') {
      const previousObject = previousValue && typeof previousValue === 'object' ? previousValue as Record<string, unknown> : {};
      const output: Record<string, unknown> = {};
      for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
        output[key] = await processValue(childValue, previousObject[key], deleteReplacedFiles);
      }
      return output;
    }

    if (typeof value === 'string') {
      return processStorageString(value, previousValue, deleteReplacedFiles);
    }

    if ((value === null || value === '') && deleteReplacedFiles && typeof previousValue === 'string') {
      await deleteBestEffort(previousValue);
    }

    return value;
  }

  async function processStorageString(value: string, previousValue: unknown, deleteReplacedFiles: boolean): Promise<string> {
    const storedValue = toStoredAssetPath(value);
    const file = config.locations.fromUrl(storedValue);

    if (file && config.locations.isTemp(file)) {
      const promoted = await promoteTempFile(storedValue);
      if (deleteReplacedFiles && typeof previousValue === 'string') {
        const previousStored = toStoredAssetPath(previousValue);
        if (previousStored !== promoted && !isPublicReusableAsset(previousStored)) {
          await deleteBestEffort(previousStored);
        }
      }
      return promoted;
    }

    if (deleteReplacedFiles && (storedValue === '' || storedValue === null) && typeof previousValue === 'string') {
      const previousStored = toStoredAssetPath(previousValue);
      if (!isPublicReusableAsset(previousStored)) {
        await deleteBestEffort(previousStored);
      }
    }

    return storedValue;
  }

  function collectFileUrls(input: unknown): string[] {
    const urls = new Set<string>();

    function visit(value: unknown) {
      if (!value) return;

      const normalized = normalizeFileUploadValue(value);
      if (typeof normalized === 'string') {
        if (config.locations.fromUrl(normalized)) urls.add(normalized);
        return;
      }

      if (typeof value === 'string') {
        const storedValue = toStoredAssetPath(value);
        if (config.locations.fromUrl(storedValue)) urls.add(storedValue);
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      if (typeof value === 'object') {
        Object.values(value as Record<string, unknown>).forEach(visit);
      }
    }

    visit(input);
    return [...urls];
  }

  function createUploadHandler(): RequestHandler {
    return async function POST({ request, params, url }) {
      const contentType = request.headers.get('content-type');
      if (!contentType?.includes('multipart/form-data')) {
        return json({ error: 'Invalid content type' }, { status: 400 });
      }

      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return json({ error: 'No file uploaded' }, { status: 400 });

      const visibility = String((params as any).destination ?? config.upload?.defaultVisibility ?? 'private');
      if (config.upload?.allowedVisibilities && !config.upload.allowedVisibilities.includes(visibility)) {
        return json({ error: 'Invalid upload destination' }, { status: 400 });
      }
      if (config.upload?.maxFileSizeBytes && file.size > config.upload.maxFileSizeBytes) {
        return json({ error: 'File too large' }, { status: 413 });
      }

      const target = config.locations.toTemp({
        filename: file.name,
        contentType: file.type,
        visibility,
        requestUrl: url,
      });
      const bytes = Buffer.from(await file.arrayBuffer());
      const written = await config.storage.write({ ...target, size: bytes.length }, bytes);
      const path = toStoredAssetPath(written.url);

      return json({
        success: true,
        path,
        url: toPublicAssetUrl(path, config.upload?.publicBaseUrl),
        data: path,
      });
    };
  }

  function createServeHandler(): RequestHandler {
    return async function GET(event) {
      const file = fileFromServeEvent(event);
      if (!file) return new Response('Not found', { status: 404 });

      try {
        const bytes = await config.storage.read(file);
        return new Response(new Uint8Array(bytes), {
          headers: {
            'content-type': file.contentType || lookup(file.filename) || 'application/octet-stream',
            'cache-control': 'public, max-age=31536000, immutable',
          },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    };
  }

  function createDownloadHandler(): RequestHandler {
    return async function POST({ request }) {
      const body = await request.json();
      const normalizedUrl = typeof body?.url === 'string' ? toStoredAssetPath(body.url) : '';
      const file = normalizedUrl ? config.locations.fromUrl(normalizedUrl) : null;
      if (!file) return new Response('File not found', { status: 404 });

      try {
        const bytes = await config.storage.read(file);
        return new Response(new Uint8Array(bytes), {
          headers: {
            'content-type': file.contentType || lookup(file.filename) || 'application/octet-stream',
            'content-disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
            'content-length': bytes.length.toString(),
          },
        });
      } catch {
        return new Response('File not found', { status: 404 });
      }
    };
  }

  async function findProcessor(file: FileObject, bytes: Buffer) {
    for (const processor of processors) {
      if (await processor.supports({ file, bytes })) return processor;
    }
    return null;
  }

  async function deleteDerivatives(metadata: FileMetadataRecord) {
    for (const derivative of metadata.derivatives ?? []) {
      await config.storage.delete(derivative);
    }
  }

  async function deleteBestEffort(url: string) {
    try {
      await deleteFile(url);
    } catch (err) {
      console.error('[FileManager] Failed to delete replaced file:', err);
    }
  }

  function fileFromServeEvent(event: any): FileObject | null {
    const params = event.params ?? {};
    const path = [params.storagePath, params.filename].filter(Boolean).join('/');
    if (path) return config.locations.fromUrl(`/storage/${path}`);

    const pathname = event.url?.pathname;
    return pathname ? config.locations.fromUrl(pathname) : null;
  }

  function isPublicReusableAsset(value: string): boolean {
    return isStorageAsset(value) && value.startsWith('/storage/public/');
  }

  return {
    createUploadHandler,
    createServeHandler,
    createDownloadHandler,
    promoteTempFile,
    deleteFile,
    processPayloadFiles,
    collectFileUrls,
  };
}
