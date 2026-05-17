import { describe, expect, it } from 'vitest';
import { readSectionSchemas } from '../../schema/index.js';
import { buildSectionIncludeFromSchema } from '../schema.js';

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
