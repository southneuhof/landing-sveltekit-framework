import type {
  LandingSection,
  SectionDataLoader,
  SectionLoaderContext,
  SectionLoaderRegistry,
} from '../types/index.js';

function mergeSectionData(
  currentData: LandingSection['data'],
  loadedData: Awaited<ReturnType<SectionDataLoader>> | null | undefined,
) {
  if (!loadedData || typeof loadedData !== 'object') return currentData;
  const normalizedCurrentData = (currentData && typeof currentData === 'object') ? currentData : {};
  return {
    ...normalizedCurrentData,
    ...loadedData,
  };
}

export async function loadSectionData(
  sections: LandingSection[],
  sectionLoaders: SectionLoaderRegistry = {},
  context: SectionLoaderContext,
) {
  return Promise.all(
    sections.map(async (section) => {
      const loader = sectionLoaders[section.section_type_code ?? ''];
      if (!loader) return section;
      const loadedData = await loader(section, context);
      return {
        ...section,
        data: mergeSectionData(section.data, loadedData as Record<string, unknown>),
      };
    }),
  );
}
