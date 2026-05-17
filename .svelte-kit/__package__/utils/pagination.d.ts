import type { PaginatedResponse, PaginationLoaderResult, PaginationOptions } from '../types/index.js';
export declare function withPagination<T>(loader: (skip: number, take: number) => Promise<PaginationLoaderResult<T>>, options?: PaginationOptions): Promise<PaginatedResponse<T>>;
//# sourceMappingURL=pagination.d.ts.map