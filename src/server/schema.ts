import type { AnyRecord, LandingSection, SectionSchema, SectionSchemaRegistry, SectionSchemaSlot } from '../types/index.js';
export { readSectionSchemas, createSectionSchemaManager } from '../schema/index.js';

type PrismaOrderBy = { order: 'asc' };
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

async function materializeSectionSchemaData({
  prisma,
  parentSection,
  schemaData,
}: {
  prisma: any;
  parentSection: LandingSection;
  schemaData: Record<string, SectionSchemaSlot>;
}): Promise<void> {
  const slots = Object.values(schemaData).sort((a, b) => a.order - b.order);

  for (const slot of slots) {
    if (slot.type === 'content') {
      await prisma.content.create({
        data: {
          order: slot.order,
          section_id: parentSection.id,
        },
      });
      continue;
    }

    if (slot.type === 'gallery') {
      await prisma.gallery.create({
        data: {
          order: slot.order,
          section_id: parentSection.id,
        },
      });
      continue;
    }

    if (slot.type === 'section') {
      const childSection = await prisma.section.create({
        data: {
          name: `Child of ${parentSection.name}`,
          order: slot.order,
          parent_section_id: parentSection.id,
        },
      });
      if (slot.data) {
        await materializeSectionSchemaData({
          prisma,
          parentSection: childSection,
          schemaData: slot.data,
        });
      }
      continue;
    }

    await prisma.sectionGroup.create({
      data: {
        order: slot.order,
        parent_section_id: parentSection.id,
      },
    });
  }
}

export async function createSectionFromSchema(
  input: CreateSectionFromSchemaInput,
): Promise<CreateSectionFromSchemaResult> {
  const { prisma, sectionSchemas, sectionGroupId, sectionTypeCode } = input;

  if (!sectionGroupId) {
    throw new Error('sectionGroupId is required');
  }

  if (!sectionTypeCode) {
    throw new Error('sectionTypeCode is required');
  }

  const schema = sectionSchemas[sectionTypeCode];
  if (!schema) {
    throw new Error(`Unknown section schema code "${sectionTypeCode}"`);
  }

  const maxOrderSection = await prisma.section.findFirst({
    where: { section_group_id: sectionGroupId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const section = await prisma.section.create({
    data: {
      name: input.name ?? schema.info?.name ?? sectionTypeCode,
      description: input.description ?? schema.info?.description ?? null,
      order: (maxOrderSection?.order ?? 0) + 1,
      section_group_id: sectionGroupId,
      section_type_code: sectionTypeCode,
      meta: input.meta ?? schema.meta?.defaultValues ?? {},
    },
  });

  await materializeSectionSchemaData({
    prisma,
    parentSection: section,
    schemaData: schema.data,
  });

  return { section };
}

export async function createNestedSectionFromSchemaData(
  input: CreateNestedSectionFromSchemaDataInput,
): Promise<CreateNestedSectionFromSchemaDataResult> {
  const { prisma, sectionSchemas, sectionGroupId } = input;

  if (!sectionGroupId) {
    throw new Error('sectionGroupId is required');
  }

  const sectionGroup = await prisma.sectionGroup.findUnique({
    where: { id: sectionGroupId },
    include: {
      parentSection: true,
    },
  });

  if (!sectionGroup) {
    throw new Error('Section group not found');
  }

  if (!sectionGroup.parentSection) {
    throw new Error('section_type_code is required for non-nested section groups');
  }

  const parentCode = sectionGroup.parentSection.section_type_code ?? '';
  const parentSchema = sectionSchemas[parentCode];

  if (!parentSchema) {
    throw new Error('Parent section schema not found for nested section group');
  }

  const groupSlot = Object.values(parentSchema.data).find(
    (slot) => slot.type === 'sectionGroup' && slot.order === sectionGroup.order,
  );

  if (!groupSlot) {
    throw new Error('No sectionGroup slot found for nested section group');
  }

  if (!groupSlot.data) {
    throw new Error('section_type_code is required for section groups without nested schema data');
  }

  const maxOrderSection = await prisma.section.findFirst({
    where: { section_group_id: sectionGroupId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const nextOrder = (maxOrderSection?.order ?? 0) + 1;
  const section = await prisma.section.create({
    data: {
      name: input.name ?? `Item ${nextOrder}`,
      description: input.description ?? null,
      order: nextOrder,
      section_group_id: sectionGroupId,
      section_type_code: null,
      meta: {},
    },
  });

  await materializeSectionSchemaData({
    prisma,
    parentSection: section,
    schemaData: groupSlot.data,
  });

  return { section };
}
