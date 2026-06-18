import type { AnyRecord, LandingSection, SectionSchema, SectionSchemaRegistry } from '../types/index.js';
export { readSectionSchemas, createSectionSchemaManager } from '../schema/index.js';
type PrismaInclude = Record<string, unknown>;
export type CreateSectionFromSchemaInput = {
    prisma: any;
    sectionSchemas: SectionSchemaRegistry;
    sectionGroupId: string;
    sectionTypeCode: string;
    name?: string;
    description?: string | null;
    meta?: Record<string, unknown>;
};
export type CreateSectionFromSchemaResult = {
    section: LandingSection;
};
export type CreateNestedSectionFromSchemaDataInput = {
    prisma: any;
    sectionSchemas: SectionSchemaRegistry;
    sectionGroupId: string;
    name?: string;
    description?: string | null;
};
export type CreateNestedSectionFromSchemaDataResult = {
    section: LandingSection;
};
export declare function buildSectionIncludeFromSchema(schema: SectionSchema, sectionSchemas?: SectionSchemaRegistry): PrismaInclude;
export declare function hydrateSectionsFromSchemas(sections: LandingSection[], prisma: any, sectionSchemas: SectionSchemaRegistry): Promise<(AnyRecord & {
    id: string;
    visible?: boolean;
    section_type_code?: string | null;
    data?: unknown;
})[]>;
export declare function createSectionFromSchema(input: CreateSectionFromSchemaInput): Promise<CreateSectionFromSchemaResult>;
export declare function createNestedSectionFromSchemaData(input: CreateNestedSectionFromSchemaDataInput): Promise<CreateNestedSectionFromSchemaDataResult>;
//# sourceMappingURL=schema.d.ts.map