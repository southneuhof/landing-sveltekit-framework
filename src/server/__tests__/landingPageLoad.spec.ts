import { describe, expect, it, vi } from 'vitest';
import { createLandingPageLoad, buildNestedSlugWhere } from '../index.js';

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

  it('hydrates sections through app-owned loaders', async () => {
    const loader = vi.fn(async () => ({ loaded: true }));
    const load = createLandingPageLoad({
      getLocale: () => 'en',
      sectionLoaders: {
        hero: loader,
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
      },
    });

    const result = await load({ url: new URL('https://example.com/home') });
    expect(loader).toHaveBeenCalledWith({ id: 's1', visible: true, section_type_code: 'hero' });
    expect(result.sections[0].data).toEqual({ loaded: true });
  });

  it('returns null data when a section loader fails', async () => {
    const load = createLandingPageLoad({
      getLocale: () => 'en',
      sectionLoaders: {
        hero: async () => {
          throw new Error('failed');
        },
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
      },
    });

    const result = await load({ url: new URL('https://example.com/home') });
    expect(result.sections[0].data).toBeNull();
  });
});
