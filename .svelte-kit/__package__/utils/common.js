function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}
function assertOnlyKeys(object, allowedKeys, message) {
    const allowed = new Set(allowedKeys);
    for (const key of Object.keys(object)) {
        if (!allowed.has(key)) {
            throw new TypeError(message);
        }
    }
}
function castSearchParamValue(rawValue) {
    const value = rawValue.trim();
    if (value === '')
        return '';
    if (!Number.isNaN(Number(value))) {
        return Number(value);
    }
    const booleanValue = value.toLowerCase();
    if (booleanValue === 'true')
        return true;
    if (booleanValue === 'false')
        return false;
    if (value.startsWith('{') || value.startsWith('[')) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) || isPlainObject(parsed)) {
                return parsed;
            }
        }
        catch {
            return value;
        }
    }
    return value;
}
export function parseSearchParams(searchParams) {
    if (!(searchParams instanceof URLSearchParams)) {
        throw new TypeError('parseSearchParams expects URLSearchParams');
    }
    const parsed = {};
    for (const [key, value] of searchParams.entries()) {
        if (!key)
            continue;
        const casted = castSearchParamValue(value);
        if (parsed[key] === undefined) {
            parsed[key] = casted;
            continue;
        }
        parsed[key] = Array.isArray(parsed[key]) ? [...parsed[key], casted] : [parsed[key], casted];
    }
    return parsed;
}
export function parseSlug(text) {
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
export function omitIfEmptyObject(value) {
    return Object.keys(value).length > 0 ? value : undefined;
}
export function buildWhereClause(input = {}) {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}
function toSelect(config, relation) {
    if (!isPlainObject(config)) {
        throw new TypeError(`Invalid fieldsForeign config for "${relation}"`);
    }
    assertOnlyKeys(config, ['fields', 'fieldsForeign'], `Invalid fieldsForeign config for "${relation}"`);
    const hasFields = Object.prototype.hasOwnProperty.call(config, 'fields');
    const hasFieldsForeign = Object.prototype.hasOwnProperty.call(config, 'fieldsForeign');
    if (!hasFields && !hasFieldsForeign) {
        throw new TypeError(`Invalid fieldsForeign config for "${relation}"`);
    }
    const select = {};
    if (hasFields) {
        if (!Array.isArray(config.fields) || !config.fields.every((field) => typeof field === 'string')) {
            throw new TypeError(`Invalid fieldsForeign config for "${relation}"`);
        }
        for (const field of config.fields) {
            select[field] = true;
        }
    }
    if (hasFieldsForeign) {
        if (!isPlainObject(config.fieldsForeign)) {
            throw new TypeError(`Invalid fieldsForeign config for "${relation}"`);
        }
        Object.assign(select, transformFieldsForeign(config.fieldsForeign));
    }
    return { select };
}
export function transformFieldsForeign(fieldsForeign = {}) {
    if (!isPlainObject(fieldsForeign)) {
        throw new TypeError('fieldsForeign must be a plain object');
    }
    const transformed = {};
    for (const [relation, config] of Object.entries(fieldsForeign)) {
        transformed[relation] = toSelect(config, relation);
    }
    return transformed;
}
export async function validateFields(body, validation = {}) {
    for (const [field, rules] of Object.entries(validation)) {
        if (!Array.isArray(rules)) {
            throw new TypeError(`Validation rules for "${field}" must be an array`);
        }
        for (const rule of rules) {
            if (!isPlainObject(rule) || typeof rule.validator !== 'function') {
                throw new TypeError(`Validation rule for "${field}" must define a validator`);
            }
            const result = await rule.validator(body[field], body);
            if (result === true)
                continue;
            if (result === false) {
                throw new Error(rule.message ?? `${field} is invalid`);
            }
            if (typeof result === 'string' && result.length > 0) {
                throw new Error(result);
            }
            throw new Error(rule.message ?? `${field} is invalid`);
        }
    }
}
export async function collectFileUrls(input) {
    const urls = new Set();
    function visit(value) {
        if (!value)
            return;
        if (typeof value === 'string' && value.includes('/storage/')) {
            urls.add(value);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (typeof value === 'object') {
            Object.values(value).forEach(visit);
        }
    }
    visit(input);
    return [...urls];
}
export async function processFileUrls(input, handlers) {
    if (typeof input === 'string') {
        if (input.includes('/storage/temp/') && handlers.onTempFile) {
            return handlers.onTempFile(input);
        }
        if (input.includes('/storage/') && handlers.onFile) {
            await handlers.onFile(input);
        }
        return input;
    }
    if (Array.isArray(input)) {
        return Promise.all(input.map((item) => processFileUrls(item, handlers)));
    }
    if (input && typeof input === 'object') {
        const output = {};
        for (const [key, value] of Object.entries(input)) {
            output[key] = await processFileUrls(value, handlers);
        }
        return output;
    }
    return input;
}
