import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, normalize, resolve } from 'node:path';
export function createLocalFileStorageDriver(config) {
    return {
        async read(file) {
            return readFile(resolveLocalStoragePath(config.root, file.key));
        },
        async write(file, bytes) {
            const filePath = resolveLocalStoragePath(config.root, file.key);
            await mkdir(dirname(filePath), { recursive: true });
            await writeFile(filePath, bytes);
            return { ...file, size: bytes.length };
        },
        async delete(file) {
            await rm(resolveLocalStoragePath(config.root, file.key), { force: true });
        },
        async exists(file) {
            try {
                const fileStat = await stat(resolveLocalStoragePath(config.root, file.key));
                return fileStat.isFile();
            }
            catch {
                return false;
            }
        },
    };
}
export function createLocalFileReadStream(root, file) {
    return createReadStream(resolveLocalStoragePath(root, file.key));
}
export function resolveLocalStoragePath(root, relativePath) {
    const normalizedRoot = resolve(root);
    const target = resolve(normalizedRoot, normalize(relativePath));
    if (!target.startsWith(normalizedRoot)) {
        throw new Error('Invalid storage path');
    }
    return target;
}
