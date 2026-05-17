import type { LandingFrameworkConfig, LandingSection, SectionLoaderRegistry } from '../types/index.js';
export { reorderEntries } from '../utils/reorder.js';
export type { ReorderEntriesOptions } from '../utils/reorder.js';
export type LandingPageLoadConfig = Pick<LandingFrameworkConfig, 'prisma' | 'getLocale'> & {
    sectionLoaders?: SectionLoaderRegistry;
};
export declare function createLandingPageLoad(config: LandingPageLoadConfig): ({ url }: {
    url: URL;
}) => Promise<{
    sections: (LandingSection | {
        data: any;
        id: string;
        visible?: boolean;
        section_type_code?: string | null;
    })[];
}>;
export declare function createRootLayoutLoad(config: Pick<LandingFrameworkConfig, 'prisma' | 'getLocale'>): () => Promise<{
    menu: any;
}>;
export declare function buildNestedSlugWhere(slugs: string[]): any;
//# sourceMappingURL=index.d.ts.map