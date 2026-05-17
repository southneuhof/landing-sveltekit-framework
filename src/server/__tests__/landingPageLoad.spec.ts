import { describe, expect, it, vi } from 'vitest';
import { createLandingPageLoad, buildNestedSlugWhere } from '../index.js';
import type { SectionSchemaRegistry } from '../../types/index.js';

describe('createLandingPageLoad', () => {
  it('builds nested slug where clauses', () => {
    expect(buildNestedSlugWhere(['company', 'about'])).toEqual({
      slug: 'about',
      parent: {
        slug: 'company',
        parent_id: null,
      },
    });
  });

  it('hydrates sections through schemas', async () => {
    const schemas: SectionSchemaRegistry = {
      hero: {
        code: 'hero',
        data: {
          content: { type: 'content', order: 1 },
          gallery: { type: 'gallery', order: 1, many: true },
        },
      },
    };

    const findUnique = vi.fn(async () => ({
      id: 's1',
      section_type_code: 'hero',
      contents: [{ id: 'c1', order: 1, title: 'Headline' }],
      galleries: [{ id: 'g1', order: 1, contents: [{ id: 'gc1', order: 1, title: 'Card' }] }],
    }));

    const load = createLandingPageLoad({
      getLocale: () => 'en',
      sectionSchemas: schemas,
      prisma: {
        menuItem: {
          findFirst: async () => ({
            page: [{ translations: [{ sectionGroups: [{ id: 'sg1' }] }] }],
          }),
        },
        sectionGroup: {
          findUnique: async () => ({
            sections: [{ id: 's1', visible: true, section_type_code: 'hero' }],
          }),
        },
        section: {
          findUnique,
        },
      },
    });

    const result = await load({ url: new URL('https://example.com/home') });
    expect(findUnique).toHaveBeenCalled();
    expect(result.sections[0].data).toEqual({
      content: { id: 'c1', order: 1, title: 'Headline' },
      gallery: [{ id: 'gc1', order: 1, title: 'Card' }],
    });
  });

  it('returns null data when section record is missing', async () => {
    const load = createLandingPageLoad({
      getLocale: () => 'en',
      sectionSchemas: {
        hero: { code: 'hero', data: { content: { type: 'content', order: 1 } } },
      },
      prisma: {
        menuItem: {
          findFirst: async () => ({
            page: [{ translations: [{ sectionGroups: [{ id: 'sg1' }] }] }],
          }),
        },
        sectionGroup: {
          findUnique: async () => ({
            sections: [{ id: 's1', visible: true, section_type_code: 'hero' }],
          }),
        },
        section: {
          findUnique: async () => null,
        },
      },
    });

    const result = await load({ url: new URL('https://example.com/home') });
    expect(result.sections[0].data).toBeNull();
  });
});
