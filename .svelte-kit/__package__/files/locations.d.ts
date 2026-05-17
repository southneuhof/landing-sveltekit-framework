import type { FileLocationStrategy } from './types.js';
export type StorageUrlLocationStrategyConfig = {
    publicBaseUrl?: string;
    basePath?: string;
    defaultVisibility?: string;
};
export declare function createStorageUrlLocationStrategy(config?: StorageUrlLocationStrategyConfig): FileLocationStrategy;
export declare function safeFilename(filename: string): string;
//# sourceMappingURL=locations.d.ts.map