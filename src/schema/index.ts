import type { SectionSchema, SectionSchemaRegistry } from '../types/index.js';
export type { SectionSchema, SectionSchemaRegistry } from '../types/index.js';

type EagerSchemaGlobModule = Record<string, SectionSchema | undefined>;

function isSectionSchema(value: unknown): value is SectionSchema {
  if (!value || typeof value !== 'object') return false;
  const schema = value as SectionSchema;
  return typeof schema.code === 'string' && !!schema.code && !!schema.data && typeof schema.data === 'object';
}

export function readSectionSchemas(globModules: EagerSchemaGlobModule): SectionSchemaRegistry {
  const schemas: SectionSchemaRegistry = {};

  for (const [path, candidate] of Object.entries(globModules)) {
    if (!isSectionSchema(candidate)) {
      throw new Error(`Invalid section schema module at "${path}". Expected a default export with a non-empty "code".`);
    }

    const code = candidate.code.trim();
    if (!code) {
      throw new Error(`Invalid section schema module at "${path}". Section schema "code" must be a non-empty string.`);
    }

    if (schemas[code]) {
      throw new Error(`Duplicate section schema code "${code}" detected at "${path}".`);
    }

    schemas[code] = candidate;
  }

  return schemas;
}

export function createSectionSchemaManager(sectionSchemas: SectionSchemaRegistry) {
  return {
    get(code?: string | null) {
      if (!code) return undefined;
      return sectionSchemas[code];
    },
    has(code?: string | null) {
      if (!code) return false;
      return !!sectionSchemas[code];
    },
    list() {
      return Object.values(sectionSchemas);
    },
    entries() {
      return Object.entries(sectionSchemas);
    },
  };
}
