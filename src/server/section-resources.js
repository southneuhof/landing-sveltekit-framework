export async function loadSectionResources(sections, sectionSchemas, resourceResolvers = {}, context) {
    return Promise.all(sections.map(async (section) => {
        const sectionCode = section.section_type_code ?? '';
        const schema = sectionSchemas[sectionCode];
        if (!schema)
            return section;
        const nextData = (section.data && typeof section.data === 'object') ? { ...section.data } : {};
        let changed = false;
        for (const [slotKey, slot] of Object.entries(schema.data)) {
            if (slot.type !== 'resource')
                continue;
            if (!slot.source)
                continue;
            const resolver = resourceResolvers[slot.source];
            if (!resolver)
                continue;
            nextData[slotKey] = await resolver({
                section,
                slotKey,
                slot: slot,
                context,
            });
            changed = true;
        }
        if (!changed)
            return section;
        return {
            ...section,
            data: nextData,
        };
    }));
}
//# sourceMappingURL=section-resources.js.map