import { describe, expect, it, vi } from 'vitest';
import { readSectionSchemas } from '../../schema/index.js';
import { buildSectionIncludeFromSchema, createSectionFromSchema } from '../schema.js';
describe('readSectionSchemas', () => {
    it('reads eager glob default exports into a code registry', () => {
        const schemas = readSectionSchemas({
            '/sections/hero.ts': {
                code: 'hero',
                data: {
                    banner: { type: 'gallery', order: 1, many: true },
                },
            },
        });
        expect(schemas.hero.code).toBe('hero');
    });
    it('throws on duplicate section codes', () => {
        expect(() => readSectionSchemas({
            '/sections/a.ts': { code: 'hero', data: {} },
            '/sections/b.ts': { code: 'hero', data: {} },
        })).toThrow(/Duplicate section schema code "hero"/);
    });
    it('throws on missing schema code', () => {
        expect(() => readSectionSchemas({
            '/sections/a.ts': { code: '', data: {} },
        })).toThrow(/Expected a default export with a non-empty "code"/);
    });
});
describe('buildSectionIncludeFromSchema', () => {
    it('builds include entries for content, gallery, section and sectionGroup slots', () => {
        const include = buildSectionIncludeFromSchema({
            code: 'complex',
            data: {
                content: { type: 'content', order: 1 },
                gallery: { type: 'gallery', order: 2, many: true },
                childSection: { type: 'section', order: 3, many: true },
                nestedGroup: { type: 'sectionGroup', order: 4, many: true },
            },
        });
        expect(include).toHaveProperty('contents');
        expect(include).toHaveProperty('galleries');
        expect(include).toHaveProperty('childSections');
        expect(include).toHaveProperty('childSectionGroups');
    });
});
describe('createSectionFromSchema', () => {
    it('creates a parent section with next order when max order exists', async () => {
        const prisma = {
            section: {
                findFirst: vi.fn(async () => ({ order: 9 })),
                create: vi.fn(async ({ data }) => ({ id: 's1', ...data })),
            },
            content: { create: vi.fn(async () => ({})) },
            gallery: { create: vi.fn(async () => ({})) },
            sectionGroup: { create: vi.fn(async () => ({})) },
        };
        const result = await createSectionFromSchema({
            prisma,
            sectionSchemas: {
                hero: { code: 'hero', info: { name: 'Hero' }, data: { content: { type: 'content', order: 1 } } },
            },
            sectionGroupId: 'sg1',
            sectionTypeCode: 'hero',
        });
        expect(result.section.order).toBe(10);
        expect(prisma.section.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                section_group_id: 'sg1',
                section_type_code: 'hero',
                name: 'Hero',
            }),
        }));
    });
    it('uses order 1 when no existing sections exist', async () => {
        const prisma = {
            section: {
                findFirst: vi.fn(async () => null),
                create: vi.fn(async ({ data }) => ({ id: 's1', ...data })),
            },
            content: { create: vi.fn(async () => ({})) },
            gallery: { create: vi.fn(async () => ({})) },
            sectionGroup: { create: vi.fn(async () => ({})) },
        };
        const result = await createSectionFromSchema({
            prisma,
            sectionSchemas: { hero: { code: 'hero', data: {} } },
            sectionGroupId: 'sg1',
            sectionTypeCode: 'hero',
        });
        expect(result.section.order).toBe(1);
    });
    it('uses input.name when provided', async () => {
        const prisma = {
            section: {
                findFirst: vi.fn(async () => null),
                create: vi.fn(async ({ data }) => ({ id: 's1', ...data })),
            },
            content: { create: vi.fn(async () => ({})) },
            gallery: { create: vi.fn(async () => ({})) },
            sectionGroup: { create: vi.fn(async () => ({})) },
        };
        const result = await createSectionFromSchema({
            prisma,
            sectionSchemas: { hero: { code: 'hero', info: { name: 'Schema Name' }, data: {} } },
            sectionGroupId: 'sg1',
            sectionTypeCode: 'hero',
            name: 'Input Name',
        });
        expect(result.section.name).toBe('Input Name');
    });
    it('persists schema meta defaultValues when input meta is not provided', async () => {
        const prisma = {
            section: {
                findFirst: vi.fn(async () => null),
                create: vi.fn(async ({ data }) => ({ id: 's1', ...data })),
            },
            content: { create: vi.fn(async () => ({})) },
            gallery: { create: vi.fn(async () => ({})) },
            sectionGroup: { create: vi.fn(async () => ({})) },
        };
        const result = await createSectionFromSchema({
            prisma,
            sectionSchemas: {
                content: {
                    code: 'content',
                    meta: {
                        fields: ['width_preset'],
                        inputConfig: {
                            width_preset: { type: 'select' },
                        },
                        defaultValues: {
                            width_preset: 'md',
                        },
                    },
                    data: {},
                },
            },
            sectionGroupId: 'sg1',
            sectionTypeCode: 'content',
        });
        expect(result.section.meta).toEqual({ width_preset: 'md' });
        expect(prisma.section.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                meta: { width_preset: 'md' },
            }),
        }));
    });
    it('prefers input meta over schema meta defaultValues', async () => {
        const prisma = {
            section: {
                findFirst: vi.fn(async () => null),
                create: vi.fn(async ({ data }) => ({ id: 's1', ...data })),
            },
            content: { create: vi.fn(async () => ({})) },
            gallery: { create: vi.fn(async () => ({})) },
            sectionGroup: { create: vi.fn(async () => ({})) },
        };
        const result = await createSectionFromSchema({
            prisma,
            sectionSchemas: {
                content: {
                    code: 'content',
                    meta: {
                        defaultValues: {
                            width_preset: 'md',
                        },
                    },
                    data: {},
                },
            },
            sectionGroupId: 'sg1',
            sectionTypeCode: 'content',
            meta: { width_preset: 'xl' },
        });
        expect(result.section.meta).toEqual({ width_preset: 'xl' });
    });
    it('falls back to schema info name and then section type code', async () => {
        const basePrisma = {
            section: {
                findFirst: vi.fn(async () => null),
                create: vi.fn(async ({ data }) => ({ id: 's1', ...data })),
            },
            content: { create: vi.fn(async () => ({})) },
            gallery: { create: vi.fn(async () => ({})) },
            sectionGroup: { create: vi.fn(async () => ({})) },
        };
        const withSchemaName = await createSectionFromSchema({
            prisma: basePrisma,
            sectionSchemas: { hero: { code: 'hero', info: { name: 'Schema Name' }, data: {} } },
            sectionGroupId: 'sg1',
            sectionTypeCode: 'hero',
        });
        expect(withSchemaName.section.name).toBe('Schema Name');
        const withoutSchemaName = await createSectionFromSchema({
            prisma: basePrisma,
            sectionSchemas: { hero: { code: 'hero', data: {} } },
            sectionGroupId: 'sg1',
            sectionTypeCode: 'hero',
        });
        expect(withoutSchemaName.section.name).toBe('hero');
    });
    it('throws clear errors for missing inputs and unknown schema code', async () => {
        const prisma = {
            section: {
                findFirst: vi.fn(async () => null),
                create: vi.fn(async ({ data }) => ({ id: 's1', ...data })),
            },
            content: { create: vi.fn(async () => ({})) },
            gallery: { create: vi.fn(async () => ({})) },
            sectionGroup: { create: vi.fn(async () => ({})) },
        };
        await expect(createSectionFromSchema({
            prisma,
            sectionSchemas: {},
            sectionGroupId: '',
            sectionTypeCode: 'hero',
        })).rejects.toThrow(/sectionGroupId is required/);
        await expect(createSectionFromSchema({
            prisma,
            sectionSchemas: {},
            sectionGroupId: 'sg1',
            sectionTypeCode: '',
        })).rejects.toThrow(/sectionTypeCode is required/);
        await expect(createSectionFromSchema({
            prisma,
            sectionSchemas: {},
            sectionGroupId: 'sg1',
            sectionTypeCode: 'unknown',
        })).rejects.toThrow(/Unknown section schema code "unknown"/);
    });
    it('materializes slots by type in ascending order and does not duplicate placeholders for many=true', async () => {
        const calls = [];
        const prisma = {
            section: {
                findFirst: vi.fn(async () => null),
                create: vi
                    .fn()
                    .mockImplementationOnce(async ({ data }) => ({ id: 'parent1', ...data }))
                    .mockImplementation(async ({ data }) => {
                    calls.push(`section:${data.order}`);
                    return { id: `section-${data.order}`, ...data };
                }),
            },
            content: {
                create: vi.fn(async ({ data }) => {
                    calls.push(`content:${data.order}`);
                    return {};
                }),
            },
            gallery: {
                create: vi.fn(async ({ data }) => {
                    calls.push(`gallery:${data.order}`);
                    return {};
                }),
            },
            sectionGroup: {
                create: vi.fn(async ({ data }) => {
                    calls.push(`sectionGroup:${data.order}`);
                    return {};
                }),
            },
        };
        await createSectionFromSchema({
            prisma,
            sectionSchemas: {
                complex: {
                    code: 'complex',
                    data: {
                        c: { type: 'content', order: 2, many: true },
                        g: { type: 'gallery', order: 1, many: true },
                        s: { type: 'section', order: 4 },
                        sg: { type: 'sectionGroup', order: 3 },
                    },
                },
            },
            sectionGroupId: 'sg1',
            sectionTypeCode: 'complex',
        });
        expect(calls).toEqual(['gallery:1', 'content:2', 'sectionGroup:3', 'section:4']);
        expect(prisma.content.create).toHaveBeenCalledTimes(1);
        expect(prisma.gallery.create).toHaveBeenCalledTimes(1);
        expect(prisma.sectionGroup.create).toHaveBeenCalledTimes(1);
        expect(prisma.content.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ section_id: 'parent1', order: 2 }),
        }));
        expect(prisma.gallery.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ section_id: 'parent1', order: 1 }),
        }));
        expect(prisma.sectionGroup.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ parent_section_id: 'parent1', order: 3 }),
        }));
        expect(prisma.section.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                parent_section_id: 'parent1',
                order: 4,
                name: expect.stringContaining('Child of'),
            }),
        }));
    });
});
