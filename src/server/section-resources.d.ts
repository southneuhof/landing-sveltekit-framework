import type { LandingSection, SectionLoaderContext, SectionResourceResolverRegistry, SectionSchemaRegistry } from '../types/index.js';
export declare function loadSectionResources(sections: LandingSection[], sectionSchemas: SectionSchemaRegistry, resourceResolvers: SectionResourceResolverRegistry | undefined, context: SectionLoaderContext): Promise<(import("../types/index.js").AnyRecord & {
    id: string;
    visible?: boolean;
    section_type_code?: string | null;
    data?: unknown;
})[]>;
//# sourceMappingURL=section-resources.d.ts.map