import type { FileObject, FileStorageDriver } from './types.js';
export type LocalFileStorageConfig = {
    root: string;
};
export declare function createLocalFileStorageDriver(config: LocalFileStorageConfig): FileStorageDriver;
export declare function createLocalFileReadStream(root: string, file: FileObject): import("fs").ReadStream;
export declare function resolveLocalStoragePath(root: string, relativePath: string): string;
//# sourceMappingURL=local.d.ts.map