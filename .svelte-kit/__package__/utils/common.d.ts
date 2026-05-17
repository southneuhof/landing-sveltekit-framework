import type { AnyRecord, FieldValidationConfig, FieldsForeignConfig } from '../types/index.js';
export declare function parseSearchParams(searchParams: URLSearchParams): AnyRecord;
export declare function parseSlug(text: string): string;
export declare function omitIfEmptyObject<T extends AnyRecord>(value: T): T | undefined;
export declare function buildWhereClause(input?: AnyRecord): AnyRecord;
export declare function transformFieldsForeign(fieldsForeign?: FieldsForeignConfig): AnyRecord;
export declare function validateFields(body: AnyRecord, validation?: FieldValidationConfig): Promise<void>;
export declare function collectFileUrls(input: unknown): Promise<string[]>;
export declare function processFileUrls(input: unknown, handlers: {
    onTempFile?: (url: string) => string | Promise<string>;
    onClearFile?: (url: string) => void | Promise<void>;
    onFile?: (url: string) => void | Promise<void>;
}): Promise<any>;
//# sourceMappingURL=common.d.ts.map