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
