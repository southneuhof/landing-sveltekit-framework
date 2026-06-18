export { readSectionSchemas, createSectionSchemaManager } from '../schema/index.js';
function orderByAsc() {
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
function getSectionInclude(schema, sectionSchemas) {
    const include = {};
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
export function buildSectionIncludeFromSchema(schema, sectionSchemas = {}) {
    return getSectionInclude(schema, sectionSchemas);
}
function normalizeSlotData(slot, sectionRecord) {
    if (slot.type === 'resource') {
        return slot.many ? [] : null;
    }
    if (slot.type === 'content') {
        const list = (sectionRecord.contents ?? []);
        if (slot.many)
            return list;
        return list.find((item) => item.order === slot.order) ?? null;
    }
    if (slot.type === 'gallery') {
        const list = (sectionRecord.galleries ?? []);
        const gallery = list.find((item) => item.order === slot.order);
        const contents = (gallery?.contents ?? []);
        if (slot.many)
            return contents;
        return contents[0] ?? null;
    }
    if (slot.type === 'section') {
        const list = (sectionRecord.childSections ?? []);
        if (slot.many)
            return list;
        return list.find((item) => item.order === slot.order) ?? null;
    }
    const groups = (sectionRecord.childSectionGroups ?? []);
    const group = groups.find((item) => item.order === slot.order);
    const sections = (group?.sections ?? []);
    if (slot.many)
        return sections;
    return sections[0] ?? null;
}
function normalizeSectionRecord(section, sectionSchemas) {
    const schema = sectionSchemas[section.section_type_code ?? ''];
    if (!schema) {
        return { ...section, data: section.data ?? null };
    }
    const nextData = {};
    for (const [key, slot] of Object.entries(schema.data)) {
        const value = normalizeSlotData(slot, section);
        nextData[key] = value ?? (slot.many ? [] : null);
    }
    return { ...section, data: nextData };
}
export async function hydrateSectionsFromSchemas(sections, prisma, sectionSchemas) {
    return Promise.all(sections.map(async (section) => {
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
        if (!record)
            return { ...section, data: null };
        return normalizeSectionRecord(record, sectionSchemas);
    }));
}
// Resolves per-slot data defaults declared via `slot.editor.defaultValues`,
// restricted to fields the slot actually loads (`slot.fields`). This seeds
// content rows (e.g. button color/icon) on section creation; editor-only
// defaults that aren't real content columns are ignored.
function resolveSlotDataDefaults(slot) {
    const declaredDefaults = slot.editor?.defaultValues;
    if (!declaredDefaults) return {};
    const allowedFields = slot.fields ? new Set(slot.fields) : null;
    if (!allowedFields) return { ...declaredDefaults };
    return Object.fromEntries(Object.entries(declaredDefaults).filter(([field]) => allowedFields.has(field)));
}
async function materializeSectionSchemaData({ prisma, parentSection, schemaData, }) {
    const slots = Object.values(schemaData).sort((a, b) => a.order - b.order);
    for (const slot of slots) {
        if (slot.type === 'resource') {
            continue;
        }
        if (slot.type === 'content') {
            const contentDefaults = resolveSlotDataDefaults(slot);
            await prisma.content.create({
                data: {
                    order: slot.order,
                    section_id: parentSection.id,
                    ...contentDefaults,
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
            const childSchema = slot.schema;
            const childSection = await prisma.section.create({
                data: {
                    name: childSchema?.info?.name ?? `Child of ${parentSection.name}`,
                    description: childSchema?.info?.description ?? null,
                    order: slot.order,
                    parent_section_id: parentSection.id,
                    section_type_code: null,
                    meta: childSchema?.meta?.defaultValues ?? {},
                },
            });
            if (childSchema) {
                await materializeSectionSchemaData({
                    prisma,
                    parentSection: childSection,
                    schemaData: childSchema.data,
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
export async function createSectionFromSchema(input) {
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
async function resolveSectionSchema({ prisma, sectionSchemas, section, }) {
    const sectionTypeCode = section.section_type_code ?? '';
    if (sectionTypeCode) {
        return sectionSchemas[sectionTypeCode];
    }
    if (section.section_group_id) {
        const sectionGroup = await prisma.sectionGroup.findUnique({
            where: { id: section.section_group_id },
            include: {
                parentSection: true,
            },
        });
        if (sectionGroup?.parentSection) {
            const parentSchema = await resolveSectionSchema({
                prisma,
                sectionSchemas,
                section: sectionGroup.parentSection,
            });
            const groupSlot = parentSchema
                ? Object.values(parentSchema.data).find((slot) => slot.type === 'sectionGroup' && slot.order === sectionGroup.order)
                : undefined;
            return groupSlot?.schema
                ? {
                    code: `${parentSchema?.code ?? 'nested'}:${sectionGroup.order}`,
                    ...groupSlot.schema,
                }
                : undefined;
        }
    }
    if (section.parent_section_id) {
        const parentSection = await prisma.section.findUnique({
            where: { id: section.parent_section_id },
        });
        if (parentSection) {
            const parentSchema = await resolveSectionSchema({
                prisma,
                sectionSchemas,
                section: parentSection,
            });
            const sectionSlot = parentSchema
                ? Object.values(parentSchema.data).find((slot) => slot.type === 'section' && slot.order === section.order)
                : undefined;
            return sectionSlot?.schema
                ? {
                    code: `${parentSchema?.code ?? 'nested'}:${section.order}`,
                    ...sectionSlot.schema,
                }
                : undefined;
        }
    }
    return undefined;
}
export async function createNestedSectionFromSchemaData(input) {
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
    const parentSchema = await resolveSectionSchema({
        prisma,
        sectionSchemas,
        section: sectionGroup.parentSection,
    });
    if (!parentSchema) {
        throw new Error('Parent section schema not found for nested section group');
    }
    const groupSlot = Object.values(parentSchema.data).find((slot) => slot.type === 'sectionGroup' && slot.order === sectionGroup.order);
    if (!groupSlot) {
        throw new Error('No sectionGroup slot found for nested section group');
    }
    const nestedSchema = groupSlot.schema;
    if (!nestedSchema) {
        throw new Error('section_type_code is required for section groups without nested schema');
    }
    const maxOrderSection = await prisma.section.findFirst({
        where: { section_group_id: sectionGroupId },
        orderBy: { order: 'desc' },
        select: { order: true },
    });
    const nextOrder = (maxOrderSection?.order ?? 0) + 1;
    const section = await prisma.section.create({
        data: {
            name: input.name ?? nestedSchema.info?.name ?? `Item ${nextOrder}`,
            description: input.description ?? nestedSchema.info?.description ?? null,
            order: nextOrder,
            section_group_id: sectionGroupId,
            section_type_code: null,
            meta: nestedSchema.meta?.defaultValues ?? {},
        },
    });
    await materializeSectionSchemaData({
        prisma,
        parentSection: section,
        schemaData: nestedSchema.data,
    });
    return { section };
}
//# sourceMappingURL=schema.js.map