import type { AnyRecord, LandingSection, SectionSchema, SectionSchemaRegistry, SectionSchemaSlot } from '../types/index.js';
export { readSectionSchemas, createSectionSchemaManager } from '../schema/index.js';

type PrismaOrderBy = { order: 'asc' };
type PrismaInclude = Record<string, unknown>;

function orderByAsc(): PrismaOrderBy {
  return { order: 'asc' };
}

function buildContentInclude() {
  return {
    where: { gallery_id: null },
    orderBy: orderByAsc(),
  };
}

function buildGalleryInclude() {
  return {
    orderBy: orderByAsc(),
    include: {
      contents: {
        orderBy: orderByAsc(),
      },
    },
  };
}

function getSectionInclude(schema: SectionSchema, sectionSchemas: SectionSchemaRegistry): PrismaInclude {
  const include: PrismaInclude = {};
  const slots = Object.values(schema.data);

  if (slots.some((slot) => slot.type === 'content')) {
    include.contents = buildContentInclude();
  }

  if (slots.some((slot) => slot.type === 'gallery')) {
    include.galleries = buildGalleryInclude();
  }

  if (slots.some((slot) => slot.type === 'section')) {
    include.childSections = {
      orderBy: orderByAsc(),
      include: {
        contents: buildContentInclude(),
        galleries: buildGalleryInclude(),
      },
    };
  }

  if (slots.some((slot) => slot.type === 'sectionGroup')) {
    include.childSectionGroups = {
      orderBy: orderByAsc(),
      include: {
        sections: {
          orderBy: orderByAsc(),
          include: {
            contents: buildContentInclude(),
            galleries: buildGalleryInclude(),
            childSections: {
              orderBy: orderByAsc(),
              include: {
                contents: buildContentInclude(),
                galleries: buildGalleryInclude(),
              },
            },
            childSectionGroups: {
              orderBy: orderByAsc(),
              include: {
                sections: {
                  orderBy: orderByAsc(),
                  include: {
                    contents: buildContentInclude(),
                    galleries: buildGalleryInclude(),
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  if (Object.keys(include).length === 0) {
    include.contents = buildContentInclude();
    include.galleries = buildGalleryInclude();
  }

  return include;
}

export function buildSectionIncludeFromSchema(schema: SectionSchema, sectionSchemas: SectionSchemaRegistry = {}) {
  return getSectionInclude(schema, sectionSchemas);
}

function normalizeSlotData(slot: SectionSchemaSlot, sectionRecord: AnyRecord) {
  if (slot.type === 'content') {
    const list = (sectionRecord.contents ?? []) as AnyRecord[];
    if (slot.many) return list;
    return list.find((item) => item.order === slot.order) ?? null;
  }

  if (slot.type === 'gallery') {
    const list = (sectionRecord.galleries ?? []) as AnyRecord[];
    const gallery = list.find((item) => item.order === slot.order);
    const contents = (gallery?.contents ?? []) as AnyRecord[];
    if (slot.many) return contents;
    return contents[0] ?? null;
  }

  if (slot.type === 'section') {
    const list = (sectionRecord.childSections ?? []) as AnyRecord[];
    if (slot.many) return list;
    return list.find((item) => item.order === slot.order) ?? null;
  }

  const groups = (sectionRecord.childSectionGroups ?? []) as AnyRecord[];
  const group = groups.find((item) => item.order === slot.order);
  const sections = (group?.sections ?? []) as AnyRecord[];
  if (slot.many) return sections;
  return sections[0] ?? null;
}

function normalizeSectionRecord(section: AnyRecord, sectionSchemas: SectionSchemaRegistry): LandingSection {
  const schema = sectionSchemas[section.section_type_code ?? ''];
  if (!schema) {
    return { ...(section as LandingSection), data: section.data ?? null };
  }

  const nextData: Record<string, unknown> = {};
  for (const [key, slot] of Object.entries(schema.data)) {
    const value = normalizeSlotData(slot, section);
    nextData[key] = value ?? (slot.many ? [] : null);
  }

  return { ...(section as LandingSection), data: nextData };
}

export async function hydrateSectionsFromSchemas(
  sections: LandingSection[],
  prisma: any,
  sectionSchemas: SectionSchemaRegistry,
) {
  return Promise.all(
    sections.map(async (section) => {
      const code = section.section_type_code ?? '';
      const schema = sectionSchemas[code];

      if (!schema) {
        return { ...section, data: null };
      }

      const include = getSectionInclude(schema, sectionSchemas);
      const record = await prisma.section.findUnique({
        where: { id: section.id },
        include,
      });

      if (!record) return { ...section, data: null };
      return normalizeSectionRecord(record, sectionSchemas);
    }),
  );
}
