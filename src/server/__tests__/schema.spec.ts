import { describe, expect, it, vi } from 'vitest';
import { readSectionSchemas } from '../../schema/index.js';
import {
  buildSectionIncludeFromSchema,
  createNestedSectionFromSchemaData,
  createSectionFromSchema,
} from '../schema.js';

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
    expect(() =>
      readSectionSchemas({
        '/sections/a.ts': { code: 'hero', data: {} },
        '/sections/b.ts': { code: 'hero', data: {} },
      }),
    ).toThrow(/Duplicate section schema code "hero"/);
  });

  it('throws on missing schema code', () => {
    expect(() =>
      readSectionSchemas({
        '/sections/a.ts': { code: '', data: {} },
      }),
    ).toThrow(/Expected a default export with a non-empty "code"/);
  });
});

describe('createNestedSectionFromSchemaData', () => {
  it('creates a plain child section and materializes nested group-owned slots', async () => {
    const prisma = {
      sectionGroup: {
        findUnique: vi.fn(async () => ({
          id: 'group1',
          order: 2,
          parentSection: {
            id: 'parent1',
            name: 'Data List',
            section_type_code: 'data-list',
          },
        })),
        create: vi.fn(async () => ({})),
      },
      section: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => ({ id: 'child1', ...data })),
      },
      content: {
        create: vi.fn(async () => ({})),
      },
      gallery: {
        create: vi.fn(async ({ data }) => ({ id: 'gallery1', ...data })),
      },
    };

    const result = await createNestedSectionFromSchemaData({
      prisma,
      sectionSchemas: {
        'data-list': {
          code: 'data-list',
          data: {
            content: { type: 'content', order: 1 },
            childSections: {
              type: 'sectionGroup',
              order: 2,
              schema: {
                info: {
                  name: 'Data Item',
                  description: 'Single data-list item',
                },
                meta: {
                  fields: ['status'],
                  defaultValues: {
                    status: 'draft',
                  },
                },
                data: {
                  gallery: { type: 'gallery', order: 1 },
                },
              },
            },
          },
        },
      },
      sectionGroupId: 'group1',
    });

    expect(result.section.section_group_id).toBe('group1');
    expect(result.section.section_type_code).toBeNull();
    expect(result.section.name).toBe('Data Item');
    expect(result.section.description).toBe('Single data-list item');
    expect(result.section.meta).toEqual({ status: 'draft' });
    expect(prisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          section_group_id: 'group1',
          section_type_code: null,
          order: 1,
          meta: { status: 'draft' },
        }),
      }),
    );
    expect(prisma.gallery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          section_id: 'child1',
          order: 1,
        }),
      }),
    );
    expect(prisma.content.create).not.toHaveBeenCalled();
  });

  it('uses next order and default item name', async () => {
    const prisma = {
      sectionGroup: {
        findUnique: vi.fn(async () => ({
          id: 'group1',
          order: 2,
          parentSection: {
            id: 'parent1',
            name: 'Data List',
            section_type_code: 'data-list',
          },
        })),
        create: vi.fn(async () => ({})),
      },
      section: {
        findFirst: vi.fn(async () => ({ order: 4 })),
        create: vi.fn(async ({ data }) => ({ id: 'child5', ...data })),
      },
      content: {
        create: vi.fn(async () => ({})),
      },
      gallery: {
        create: vi.fn(async () => ({})),
      },
    };

    const result = await createNestedSectionFromSchemaData({
      prisma,
      sectionSchemas: {
        'data-list': {
          code: 'data-list',
          data: {
            childSections: {
              type: 'sectionGroup',
              order: 2,
              schema: {
                data: {
                  gallery: { type: 'gallery', order: 1 },
                },
              },
            },
          },
        },
      },
      sectionGroupId: 'group1',
    });

    expect(result.section.order).toBe(5);
    expect(result.section.name).toBe('Item 5');
  });

  it('materializes nested section slots recursively', async () => {
    const prisma = {
      sectionGroup: {
        findUnique: vi.fn(async () => ({
          id: 'group1',
          order: 2,
          parentSection: {
            id: 'parent1',
            name: 'Data List',
            section_type_code: 'data-list',
          },
        })),
        create: vi.fn(async () => ({})),
      },
      section: {
        findFirst: vi.fn(async () => null),
        create: vi
          .fn()
          .mockImplementationOnce(async ({ data }) => ({ id: 'added1', ...data }))
          .mockImplementationOnce(async ({ data }) => ({ id: 'child-under-added', ...data })),
      },
      content: {
        create: vi.fn(async () => ({})),
      },
      gallery: {
        create: vi.fn(async () => ({})),
      },
    };

    await createNestedSectionFromSchemaData({
      prisma,
      sectionSchemas: {
        'data-list': {
          code: 'data-list',
          data: {
            childSections: {
              type: 'sectionGroup',
              order: 2,
              schema: {
                data: {
                  childSection: {
                    type: 'section',
                    order: 1,
                    schema: {
                      info: {
                        name: 'Nested Child',
                      },
                      meta: {
                        defaultValues: {
                          layout: 'compact',
                        },
                      },
                      data: {
                        gallery: { type: 'gallery', order: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      sectionGroupId: 'group1',
    });

    expect(prisma.section.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          section_group_id: 'group1',
        }),
      }),
    );
    expect(prisma.section.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          parent_section_id: 'added1',
          order: 1,
          name: 'Nested Child',
          meta: { layout: 'compact' },
        }),
      }),
    );
    expect(prisma.gallery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          section_id: 'child-under-added',
          order: 1,
        }),
      }),
    );
  });

  it('does not auto-create sections for nested sectionGroup schema', async () => {
    const prisma = {
      sectionGroup: {
        findUnique: vi.fn(async () => ({
          id: 'group1',
          order: 2,
          parentSection: {
            id: 'parent1',
            name: 'Data List',
            section_type_code: 'data-list',
          },
        })),
        create: vi.fn(async () => ({})),
      },
      section: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => ({ id: 'added1', ...data })),
      },
      content: {
        create: vi.fn(async () => ({})),
      },
      gallery: {
        create: vi.fn(async () => ({})),
      },
    };

    await createNestedSectionFromSchemaData({
      prisma,
      sectionSchemas: {
        'data-list': {
          code: 'data-list',
          data: {
            childSections: {
              type: 'sectionGroup',
              order: 2,
              schema: {
                data: {
                  nestedGroup: {
                    type: 'sectionGroup',
                    order: 1,
                    schema: {
                      data: {
                        gallery: { type: 'gallery', order: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      sectionGroupId: 'group1',
    });

    expect(prisma.sectionGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parent_section_id: 'added1',
          order: 1,
        }),
      }),
    );
    expect(prisma.section.create).toHaveBeenCalledTimes(1);
    expect(prisma.gallery.create).not.toHaveBeenCalled();
  });

  it('throws clear errors for missing inputs and invalid nested context', async () => {
    const prismaWithGroup = {
      sectionGroup: {
        findUnique: vi.fn(async () => ({
          id: 'group1',
          order: 2,
          parentSection: {
            id: 'parent1',
            name: 'Data List',
            section_type_code: 'data-list',
          },
        })),
      },
      section: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => ({ id: 'added1', ...data })),
      },
      content: { create: vi.fn(async () => ({})) },
      gallery: { create: vi.fn(async () => ({})) },
    };

    await expect(
      createNestedSectionFromSchemaData({
        prisma: prismaWithGroup,
        sectionSchemas: {},
        sectionGroupId: '',
      }),
    ).rejects.toThrow(/sectionGroupId is required/);

    const prismaNoGroup = {
      ...prismaWithGroup,
      sectionGroup: { findUnique: vi.fn(async () => null) },
    };
    await expect(
      createNestedSectionFromSchemaData({
        prisma: prismaNoGroup,
        sectionSchemas: {},
        sectionGroupId: 'group1',
      }),
    ).rejects.toThrow(/Section group not found/);

    const prismaNoParent = {
      ...prismaWithGroup,
      sectionGroup: {
        findUnique: vi.fn(async () => ({
          id: 'group1',
          order: 2,
          parentSection: null,
        })),
      },
    };
    await expect(
      createNestedSectionFromSchemaData({
        prisma: prismaNoParent,
        sectionSchemas: {},
        sectionGroupId: 'group1',
      }),
    ).rejects.toThrow(/section_type_code is required for non-nested section groups/);

    await expect(
      createNestedSectionFromSchemaData({
        prisma: prismaWithGroup,
        sectionSchemas: {},
        sectionGroupId: 'group1',
      }),
    ).rejects.toThrow(/Parent section schema not found for nested section group/);

    await expect(
      createNestedSectionFromSchemaData({
        prisma: prismaWithGroup,
        sectionSchemas: {
          'data-list': {
            code: 'data-list',
            data: {
              somethingElse: { type: 'sectionGroup', order: 7 },
            },
          },
        },
        sectionGroupId: 'group1',
      }),
    ).rejects.toThrow(/No sectionGroup slot found for nested section group/);

    await expect(
      createNestedSectionFromSchemaData({
        prisma: prismaWithGroup,
        sectionSchemas: {
          'data-list': {
            code: 'data-list',
            data: {
              childSections: { type: 'sectionGroup', order: 2 },
            },
          },
        },
        sectionGroupId: 'group1',
      }),
    ).rejects.toThrow(/section_type_code is required for section groups without nested schema/);
  });

  it('prefers explicit input name and description over nested schema defaults', async () => {
    const prisma = {
      sectionGroup: {
        findUnique: vi.fn(async () => ({
          id: 'group1',
          order: 2,
          parentSection: {
            id: 'parent1',
            name: 'Data List',
            section_type_code: 'data-list',
          },
        })),
      },
      section: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => ({ id: 'child1', ...data })),
      },
      content: { create: vi.fn(async () => ({})) },
      gallery: { create: vi.fn(async () => ({})) },
    };

    const result = await createNestedSectionFromSchemaData({
      prisma,
      sectionSchemas: {
        'data-list': {
          code: 'data-list',
          data: {
            childSections: {
              type: 'sectionGroup',
              order: 2,
              schema: {
                info: {
                  name: 'Data Item',
                  description: 'Single data-list item',
                },
                meta: {
                  defaultValues: {
                    status: 'draft',
                  },
                },
                data: {
                  gallery: { type: 'gallery', order: 1 },
                },
              },
            },
          },
        },
      },
      sectionGroupId: 'group1',
      name: 'Custom Name',
      description: 'Custom Description',
    });

    expect(result.section.name).toBe('Custom Name');
    expect(result.section.description).toBe('Custom Description');
    expect(result.section.meta).toEqual({ status: 'draft' });
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
    expect(prisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          section_group_id: 'sg1',
          section_type_code: 'hero',
          name: 'Hero',
        }),
      }),
    );
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
    expect(prisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meta: { width_preset: 'md' },
        }),
      }),
    );
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

    await expect(
      createSectionFromSchema({
        prisma,
        sectionSchemas: {},
        sectionGroupId: '',
        sectionTypeCode: 'hero',
      }),
    ).rejects.toThrow(/sectionGroupId is required/);

    await expect(
      createSectionFromSchema({
        prisma,
        sectionSchemas: {},
        sectionGroupId: 'sg1',
        sectionTypeCode: '',
      }),
    ).rejects.toThrow(/sectionTypeCode is required/);

    await expect(
      createSectionFromSchema({
        prisma,
        sectionSchemas: {},
        sectionGroupId: 'sg1',
        sectionTypeCode: 'unknown',
      }),
    ).rejects.toThrow(/Unknown section schema code "unknown"/);
  });

  it('materializes slots by type in ascending order and does not duplicate placeholders for many=true', async () => {
    const calls: string[] = [];
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

    expect(prisma.content.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ section_id: 'parent1', order: 2 }),
      }),
    );
    expect(prisma.gallery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ section_id: 'parent1', order: 1 }),
      }),
    );
    expect(prisma.sectionGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parent_section_id: 'parent1', order: 3 }),
      }),
    );
    expect(prisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parent_section_id: 'parent1',
          order: 4,
          name: expect.stringContaining('Child of'),
        }),
      }),
    );
  });
});
