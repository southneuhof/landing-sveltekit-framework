import type { AnyRecord, LandingSection, SectionSchema, SectionSchemaRegistry } from '../types/index.js';
export { readSectionSchemas, createSectionSchemaManager } from '../schema/index.js';
type PrismaInclude = Record<string, unknown>;
export declare function buildSectionIncludeFromSchema(schema: SectionSchema, sectionSchemas?: SectionSchemaRegistry): PrismaInclude;
export declare function hydrateSectionsFromSchemas(sections: LandingSection[], prisma: any, sectionSchemas: SectionSchemaRegistry): Promise<(AnyRecord & {
    id: string;
    visible?: boolean;
    section_type_code?: string | null;
    data?: unknown;
})[]>;
//# sourceMappingURL=schema.d.ts.map