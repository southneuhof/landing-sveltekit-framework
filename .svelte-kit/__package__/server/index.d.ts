import type { LandingFrameworkConfig } from '../types/index.js';
export { readSectionSchemas, createSectionSchemaManager, createSectionFromSchema, } from './schema.js';
export type { CreateSectionFromSchemaInput, CreateSectionFromSchemaResult, } from './schema.js';
export { reorderEntries } from '../utils/reorder.js';
export type { ReorderEntriesOptions } from '../utils/reorder.js';
export type LandingPageLoadConfig = Pick<LandingFrameworkConfig, 'prisma' | 'getLocale'> & {
    sectionSchemas?: LandingFrameworkConfig['sectionSchemas'];
};
export declare function createLandingPageLoad(config: LandingPageLoadConfig): ({ url }: {
    url: URL;
}) => Promise<{
    sections: (import("../index.js").AnyRecord & {
        id: string;
        visible?: boolean;
        section_type_code?: string | null;
        data?: unknown;
    })[];
}>;
export declare function createRootLayoutLoad(config: Pick<LandingFrameworkConfig, 'prisma' | 'getLocale'>): () => Promise<{
    menu: any;
}>;
export declare function buildNestedSlugWhere(slugs: string[]): any;
//# sourceMappingURL=index.d.ts.map