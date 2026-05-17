function isSectionSchema(value) {
    if (!value || typeof value !== 'object')
        return false;
    const schema = value;
    return typeof schema.code === 'string' && !!schema.code && !!schema.data && typeof schema.data === 'object';
}
export function readSectionSchemas(globModules) {
    const schemas = {};
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
export function createSectionSchemaManager(sectionSchemas) {
    return {
        get(code) {
            if (!code)
                return undefined;
            return sectionSchemas[code];
        },
        has(code) {
            if (!code)
                return false;
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
