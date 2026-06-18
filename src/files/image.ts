import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import path from 'node:path';
import sharp from 'sharp';
import type {
  FileManagerContext,
  FileMetadataStore,
  FileObject,
  FileProcessor,
  ImageMetadata,
  ImageVariantMetadata,
} from './types.js';

export type ImageProcessorConfig = {
  maxDimension?: number;
  quality?: number;
  variantWidths?: number[];
  placeholderWidth?: number;
  outputFormat?: 'webp';
};

const DEFAULT_CONFIG: Required<ImageProcessorConfig> = {
  maxDimension: 2048,
  quality: 80,
  variantWidths: [32, 512],
  placeholderWidth: 32,
  outputFormat: 'webp',
};

const PROCESSABLE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
]);

const PASSTHROUGH_MIME_TYPES = new Set([
  'image/svg+xml',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export function isProcessableImage(mimeType: string): boolean {
  return PROCESSABLE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isPassthroughFile(mimeType: string): boolean {
  return PASSTHROUGH_MIME_TYPES.has(mimeType.toLowerCase());
}

export function imageProcessor(config: ImageProcessorConfig = {}): FileProcessor {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return {
    name: 'image',
    supports({ file }) {
      return !!file.contentType && isProcessableImage(file.contentType);
    },
    async process({ file, bytes, manager }) {
      const processed = await processImage(bytes, file, manager, finalConfig);

      return {
        primary: {
          file: processed.primary.file,
          bytes: processed.primary.bytes,
        },
        derivatives: processed.derivatives.map((derivative) => ({
          file: derivative.file,
          bytes: derivative.bytes,
          role: 'variant',
          metadata: {
            width: derivative.width,
            format: derivative.format,
            size: derivative.bytes.length,
          },
        })),
        metadata: processed.metadata,
      };
    },
    async cleanup({ metadata, manager }) {
      const imageMetadata = metadata as ImageMetadata | undefined;
      for (const variant of imageMetadata?.variants ?? []) {
        await manager.storage.delete({
          key: variant.key,
          url: variant.url,
          filename: path.basename(variant.key),
        });
      }
    },
  };
}

async function processImage(
  bytes: Buffer,
  file: FileObject,
  manager: FileManagerContext,
  config: Required<ImageProcessorConfig>,
) {
  const initial = sharp(bytes);
  const metadata = await initial.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  let processedBytes = bytes;
  let width = metadata.width;
  let height = metadata.height;

  if (width > config.maxDimension || height > config.maxDimension) {
    processedBytes = await sharp(bytes)
      .resize(config.maxDimension, config.maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    const resized = await sharp(processedBytes).metadata();
    width = resized.width ?? width;
    height = resized.height ?? height;
  }

  const compressed = await encodeOriginal(processedBytes, file, config.quality);
  const primaryBytes = compressed && compressed.length < processedBytes.length ? compressed : processedBytes;
  const primaryMetadata = await sharp(primaryBytes).metadata();
  width = primaryMetadata.width ?? width;
  height = primaryMetadata.height ?? height;

  const placeholder = await generatePlaceholder(primaryBytes, config);
  const variants = await generateVariants(primaryBytes, file, manager, width, config);
  const imageMetadata: ImageMetadata = {
    width,
    height,
    aspectRatio: width / height,
    format: normalizeFormat((primaryMetadata.format ?? metadata.format ?? path.extname(file.filename).slice(1)) || 'jpeg'),
    size: primaryBytes.length,
    placeholder,
    variants: variants.map((variant) => ({
      width: variant.width,
      format: variant.format,
      key: variant.file.key,
      url: variant.file.url,
      size: variant.bytes.length,
    })),
  };

  return {
    primary: {
      file: { ...file, size: primaryBytes.length },
      bytes: primaryBytes,
    },
    derivatives: variants,
    metadata: imageMetadata,
  };
}

async function encodeOriginal(bytes: Buffer, file: FileObject, quality: number): Promise<Buffer | null> {
  const format = formatFromFilename(file.filename);
  if (!format || format === 'tiff') return null;

  const pipeline = sharp(bytes);
  switch (format) {
    case 'jpeg':
      return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    case 'png':
      return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    case 'webp':
      return pipeline.webp({ quality }).toBuffer();
    case 'avif':
      return pipeline.avif({ quality: Math.max(quality - 10, 50) }).toBuffer();
    default:
      return null;
  }
}

async function generatePlaceholder(bytes: Buffer, config: Required<ImageProcessorConfig>): Promise<string> {
  const placeholder = await sharp(bytes)
    .resize(config.placeholderWidth, null, { fit: 'inside' })
    .blur(2)
    .webp({ quality: 20 })
    .toBuffer();

  return `data:image/webp;base64,${placeholder.toString('base64')}`;
}

async function generateVariants(
  bytes: Buffer,
  file: FileObject,
  manager: FileManagerContext,
  originalWidth: number,
  config: Required<ImageProcessorConfig>,
): Promise<Array<{ file: FileObject; bytes: Buffer; width: number; format: string }>> {
  const variants: Array<{ file: FileObject; bytes: Buffer; width: number; format: string }> = [];
  const widths = config.variantWidths.filter((width) => width < originalWidth);

  if (originalWidth > config.variantWidths[0]) {
    widths.push(Math.min(originalWidth, config.maxDimension));
  }

  for (const width of [...new Set(widths)].sort((a, b) => a - b)) {
    const variantFilename = `${path.parse(file.filename).name}__w${width}.${config.outputFormat}`;
    const variantFile = manager.locations.derivativeFor
      ? manager.locations.derivativeFor(file, variantFilename)
      : { ...file, filename: variantFilename, key: variantFilename, url: variantFilename };
    const variantBytes = await sharp(bytes)
      .resize(width, null, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: config.quality })
      .toBuffer();

    variants.push({
      file: {
        ...variantFile,
        contentType: 'image/webp',
        size: variantBytes.length,
      },
      bytes: variantBytes,
      width,
      format: config.outputFormat,
    });
  }

  return variants;
}

export function createImageManifestHandler(config: {
  metadataStore: FileMetadataStore;
  keyFromRequest: (event: RequestEvent) => string;
  cacheControl?: string;
}): RequestHandler {
  return async function GET(event) {
    try {
      const key = config.keyFromRequest(event);
      const record = await config.metadataStore.get(key, 'image');
      if (!record) return json({ error: 'Manifest not found' }, { status: 404 });

      return json(record.data, {
        headers: {
          'cache-control': config.cacheControl ?? 'public, max-age=86400',
        },
      });
    } catch (err) {
      console.error('[ImageManifest] Error fetching manifest:', err);
      return json({ error: 'Failed to fetch manifest' }, { status: 500 });
    }
  };
}

function formatFromFilename(filename: string): keyof sharp.FormatEnum | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
  if (ext === '.png') return 'png';
  if (ext === '.webp') return 'webp';
  if (ext === '.avif') return 'avif';
  if (ext === '.tif' || ext === '.tiff') return 'tiff';
  return null;
}

function normalizeFormat(format: string): string {
  return format === 'jpg' ? 'jpeg' : format;
}
