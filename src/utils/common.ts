import type {
  AnyRecord,
  FieldValidationConfig,
  FieldsForeignConfig,
  RelationSelectConfig,
} from '../types/index.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function assertOnlyKeys(
  object: Record<string, unknown>,
  allowedKeys: string[],
  message: string,
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw new TypeError(message);
    }
  }
}

function castSearchParamValue(rawValue: string): unknown {
  const value = rawValue.trim();

  if (value === '') return '';

  if (!Number.isNaN(Number(value))) {
    return Number(value);
  }

  const booleanValue = value.toLowerCase();
  if (booleanValue === 'true') return true;
  if (booleanValue === 'false') return false;

  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) || isPlainObject(parsed)) {
        return parsed;
      }
    } catch {
      return value;
    }
  }

  return value;
}

export function parseSearchParams(searchParams: URLSearchParams): AnyRecord {
  if (!(searchParams instanceof URLSearchParams)) {
    throw new TypeError('parseSearchParams expects URLSearchParams');
  }

  const parsed: AnyRecord = {};

  for (const [key, value] of searchParams.entries()) {
    if (!key) continue;
    const casted = castSearchParamValue(value);

    if (parsed[key] === undefined) {
      parsed[key] = casted;
      continue;
    }

    parsed[key] = Array.isArray(parsed[key]) ? [...parsed[key], casted] : [parsed[key], casted];
  }

  return parsed;
}

export function parseSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function omitIfEmptyObject<T extends AnyRecord>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

export function buildWhereClause(input: AnyRecord = {}): AnyRecord {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function toSelect(config: RelationSelectConfig, relation: string): AnyRecord {
  if (!isPlainObject(config)) {
    throw new TypeError(`Invalid fieldsForeign config for "${relation}"`);
  }

  assertOnlyKeys(config, ['fields', 'fieldsForeign'], `Invalid fieldsForeign config for "${relation}"`);

  const hasFields = Object.prototype.hasOwnProperty.call(config, 'fields');
  const hasFieldsForeign = Object.prototype.hasOwnProperty.call(config, 'fieldsForeign');

  if (!hasFields && !hasFieldsForeign) {
    throw new TypeError(`Invalid fieldsForeign config for "${relation}"`);
  }

  const select: AnyRecord = {};

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
    Object.assign(select, transformFieldsForeign(config.fieldsForeign as FieldsForeignConfig));
  }

  return { select };
}

export function transformFieldsForeign(fieldsForeign: FieldsForeignConfig = {}): AnyRecord {
  if (!isPlainObject(fieldsForeign)) {
    throw new TypeError('fieldsForeign must be a plain object');
  }

  const transformed: AnyRecord = {};
  for (const [relation, config] of Object.entries(fieldsForeign)) {
    transformed[relation] = toSelect(config, relation);
  }
  return transformed;
}

export async function validateFields(body: AnyRecord, validation: FieldValidationConfig = {}): Promise<void> {
  for (const [field, rules] of Object.entries(validation)) {
    if (!Array.isArray(rules)) {
      throw new TypeError(`Validation rules for "${field}" must be an array`);
    }

    for (const rule of rules) {
      if (!isPlainObject(rule) || typeof rule.validator !== 'function') {
        throw new TypeError(`Validation rule for "${field}" must define a validator`);
      }

      const result = await rule.validator(body[field], body);
      if (result === true) continue;

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

export async function collectFileUrls(input: unknown): Promise<string[]> {
  const urls = new Set<string>();

  function visit(value: unknown) {
    if (!value) return;
    if (typeof value === 'string' && value.includes('/storage/')) {
      urls.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value as AnyRecord).forEach(visit);
    }
  }

  visit(input);
  return [...urls];
}

export async function processFileUrls(
  input: unknown,
  handlers: {
    onTempFile?: (url: string) => string | Promise<string>;
    onClearFile?: (url: string) => void | Promise<void>;
    onFile?: (url: string) => void | Promise<void>;
  },
): Promise<any> {
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
    const output: AnyRecord = {};
    for (const [key, value] of Object.entries(input as AnyRecord)) {
      output[key] = await processFileUrls(value, handlers);
    }
    return output;
  }

  return input;
}
