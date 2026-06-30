export async function loadSectionResources(sections, sectionSchemas, resourceResolvers = {}, context) {
    async function resolveWithCache(key, resolve) {
        if (!context.resourceCache)
            return resolve();
        if (!context.resourceCache.has(key)) {
            context.resourceCache.set(key, resolve());
        }
        return await context.resourceCache.get(key);
    }
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
            nextData[slotKey] = await resolveWithCache(`${slot.source}:${context.getLocale()}`, () => resolver({
                section,
                slotKey,
                slot: slot,
                context,
            }));
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
