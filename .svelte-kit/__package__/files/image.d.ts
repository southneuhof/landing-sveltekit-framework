import { type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import type { FileMetadataStore, FileProcessor } from './types.js';
export type ImageProcessorConfig = {
    maxDimension?: number;
    quality?: number;
    variantWidths?: number[];
    placeholderWidth?: number;
    outputFormat?: 'webp';
};
export declare function isProcessableImage(mimeType: string): boolean;
export declare function isPassthroughFile(mimeType: string): boolean;
export declare function imageProcessor(config?: ImageProcessorConfig): FileProcessor;
export declare function createImageManifestHandler(config: {
    metadataStore: FileMetadataStore;
    keyFromRequest: (event: RequestEvent) => string;
    cacheControl?: string;
}): RequestHandler;
//# sourceMappingURL=image.d.ts.map