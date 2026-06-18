import { describe, expect, it, vi } from 'vitest';
import { createLandingPageLoad, buildNestedSlugWhere } from '../index.js';
import { loadSectionData } from '../section-data.js';
import { loadSectionResources } from '../section-resources.js';
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

  it('runs injected section loaders and merges data with hydrated schema slots', async () => {
    const load = createLandingPageLoad({
      getLocale: () => 'en',
      sectionSchemas: {
        'article-highlights': { code: 'article-highlights', data: { content: { type: 'content', order: 1 } } },
      },
      sectionLoaders: {
        'article-highlights': vi.fn(async () => ({
          article: [{ id: 'a1', title: 'News' }],
        })),
      },
      prisma: {
        menuItem: {
          findFirst: async () => ({
            page: [{ translations: [{ sectionGroups: [{ id: 'sg1' }] }] }],
          }),
        },
        sectionGroup: {
          findUnique: async () => ({
            sections: [{ id: 's1', visible: true, section_type_code: 'article-highlights' }],
          }),
        },
        section: {
          findUnique: async () => ({
            id: 's1',
            section_type_code: 'article-highlights',
            contents: [{ id: 'c1', order: 1, title: 'Header' }],
          }),
        },
      },
    });

    const result = await load({ url: new URL('https://example.com/home') });
    expect(result.sections[0].data).toEqual({
      content: { id: 'c1', order: 1, title: 'Header' },
      article: [{ id: 'a1', title: 'News' }],
    });
  });

  it('runs resource resolvers before section loaders', async () => {
    const load = createLandingPageLoad({
      getLocale: () => 'en',
      sectionSchemas: {
        'article-highlights': {
          code: 'article-highlights',
          data: {
            content: { type: 'content', order: 1 },
            articles: { type: 'resource', source: 'article', order: 2, many: true },
          },
        },
      },
      sectionResourceResolvers: {
        article: vi.fn(async () => [{ id: 'a1' }]),
      },
      sectionLoaders: {
        'article-highlights': vi.fn(async (section) => ({
          count: Array.isArray((section.data as any)?.articles) ? (section.data as any).articles.length : 0,
        })),
      },
      prisma: {
        menuItem: {
          findFirst: async () => ({
            page: [{ translations: [{ sectionGroups: [{ id: 'sg1' }] }] }],
          }),
        },
        sectionGroup: {
          findUnique: async () => ({
            sections: [{ id: 's1', visible: true, section_type_code: 'article-highlights' }],
          }),
        },
        section: {
          findUnique: async () => ({
            id: 's1',
            section_type_code: 'article-highlights',
            contents: [{ id: 'c1', order: 1, title: 'Header' }],
          }),
        },
      },
    });

    const result = await load({ url: new URL('https://example.com/home') });
    expect(result.sections[0].data).toEqual({
      content: { id: 'c1', order: 1, title: 'Header' },
      articles: [{ id: 'a1' }],
      count: 1,
    });
  });
});

describe('loadSectionData', () => {
  it('keeps sections unchanged when no loader exists', async () => {
    const sections = [
      {
        id: 's1',
        section_type_code: 'hero',
        data: { content: { id: 'c1' } },
      },
    ];
    const result = await loadSectionData(sections, {}, {
      prisma: {},
      getLocale: () => 'en',
      url: new URL('https://example.com'),
    });

    expect(result).toEqual(sections);
  });
});

describe('loadSectionResources', () => {
  it('resolves resource slots by source and writes to declared slot key', async () => {
    const sections = [
      {
        id: 's1',
        section_type_code: 'article-highlights',
        data: {
          content: { id: 'c1' },
          articles: [],
        },
      },
    ];
    const schemas: SectionSchemaRegistry = {
      'article-highlights': {
        code: 'article-highlights',
        data: {
          content: { type: 'content', order: 1 },
          articles: { type: 'resource', source: 'article', order: 2, many: true },
        },
      },
    };
    const result = await loadSectionResources(
      sections,
      schemas,
      {
        article: vi.fn(async () => [{ id: 'a1', title: 'A' }]),
      },
      {
        prisma: {},
        getLocale: () => 'en',
        url: new URL('https://example.com'),
      },
    );

    expect(result[0].data).toEqual({
      content: { id: 'c1' },
      articles: [{ id: 'a1', title: 'A' }],
    });
  });
});
