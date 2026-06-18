function mergeSectionData(currentData, loadedData) {
    if (!loadedData || typeof loadedData !== 'object')
        return currentData;
    const normalizedCurrentData = (currentData && typeof currentData === 'object') ? currentData : {};
    return {
        ...normalizedCurrentData,
        ...loadedData,
    };
}
export async function loadSectionData(sections, sectionLoaders = {}, context) {
    return Promise.all(sections.map(async (section) => {
        const loader = sectionLoaders[section.section_type_code ?? ''];
        if (!loader)
            return section;
        const loadedData = await loader(section, context);
        return {
            ...section,
            data: mergeSectionData(section.data, loadedData),
        };
    }));
}
//# sourceMappingURL=section-data.js.map