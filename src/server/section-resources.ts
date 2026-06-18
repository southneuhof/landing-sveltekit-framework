import type {
  LandingSection,
  ResourceSlot,
  SectionLoaderContext,
  SectionResourceResolverRegistry,
  SectionSchemaRegistry,
} from '../types/index.js';

export async function loadSectionResources(
  sections: LandingSection[],
  sectionSchemas: SectionSchemaRegistry,
  resourceResolvers: SectionResourceResolverRegistry = {},
  context: SectionLoaderContext,
) {
  return Promise.all(
    sections.map(async (section) => {
      const sectionCode = section.section_type_code ?? '';
      const schema = sectionSchemas[sectionCode];
      if (!schema) return section;

      const nextData = (section.data && typeof section.data === 'object') ? { ...section.data as Record<string, unknown> } : {};
      let changed = false;

      for (const [slotKey, slot] of Object.entries(schema.data)) {
        if (slot.type !== 'resource') continue;
        if (!slot.source) continue;
        const resolver = resourceResolvers[slot.source];
        if (!resolver) continue;
        nextData[slotKey] = await resolver({
          section,
          slotKey,
          slot: slot as ResourceSlot,
          context,
        });
        changed = true;
      }

      if (!changed) return section;
      return {
        ...section,
        data: nextData,
      };
    }),
  );
}
