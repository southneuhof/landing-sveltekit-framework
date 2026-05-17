import type { SectionSchema, SectionSchemaRegistry } from '../types/index.js';
export type { SectionSchema, SectionSchemaRegistry } from '../types/index.js';
type EagerSchemaGlobModule = Record<string, SectionSchema | undefined>;
export declare function readSectionSchemas(globModules: EagerSchemaGlobModule): SectionSchemaRegistry;
export declare function createSectionSchemaManager(sectionSchemas: SectionSchemaRegistry): {
    get(code?: string | null): SectionSchema;
    has(code?: string | null): boolean;
    list(): SectionSchema[];
    entries(): [string, SectionSchema][];
};
//# sourceMappingURL=index.d.ts.map