import type { LandingSection, SectionLoaderContext, SectionLoaderRegistry } from '../types/index.js';
export declare function loadSectionData(sections: LandingSection[], sectionLoaders: SectionLoaderRegistry | undefined, context: SectionLoaderContext): Promise<(import("../types/index.js").AnyRecord & {
    id: string;
    visible?: boolean;
    section_type_code?: string | null;
    data?: unknown;
})[]>;
//# sourceMappingURL=section-data.d.ts.map