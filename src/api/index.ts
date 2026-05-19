import { authorizeOperation as defaultAuthorizeOperation } from '../auth/index.js';
import type {
  AnyRecord,
  BaseOperationConfig,
  CrudOperation,
  ModelConfig,
  ModelConfigRegistry,
  PaginationOptions,
  ReorderPayload,
} from '../types/index.js';
import { buildWhereClause, omitIfEmptyObject, parseSearchParams, transformFieldsForeign, validateFields } from '../utils/common.js';
import { withPagination } from '../utils/pagination.js';
import { reorderEntries } from '../utils/reorder.js';
import { exception, success } from '../utils/response.js';
import type { FileManager } from '../files/index.js';

export type HandlerConfig = {
  prisma: any;
  modelConfigs: ModelConfigRegistry;
  authorizeOperation?: typeof defaultAuthorizeOperation;
  files?: FileManager;
};

export type ModelApiDependencies = {
  data: {
    prisma: any;
    models: ModelConfigRegistry;
  };
  auth?: {
    authorizeOperation?: typeof defaultAuthorizeOperation;
  };
  files?: FileManager;
};

export function createModelApi(dependencies: ModelApiDependencies) {
  return createCrudHandlers({
    prisma: dependencies.data.prisma,
    modelConfigs: dependencies.data.models,
    authorizeOperation: dependencies.auth?.authorizeOperation,
    files: dependencies.files,
  });
}

export function createCrudHandlers(config: HandlerConfig) {
  return {
    list: createModelListHandler(config),
    detail: createModelDetailHandler(config),
    create: createModelCreateHandler(config),
    update: createModelUpdateHandler(config),
    delete: createModelDeleteHandler(config),
    reorder: createModelReorderHandler(config),
    verify: createModelVerifyHandler(config),
  };
}

export function createModelListHandler(config: HandlerConfig) {
  return async function GET(event: any) {
    try {
      const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
      assertModel(config.prisma, event.params.model);
      const mergedConfig = mergeListConfigs(modelConfig, modelConfig.list);
      if (!mergedConfig.allow) throw new Error('Operation forbidden');

      let urlSearchParams = parseSearchParams(event.url.searchParams);
      await authorize(config, event, event.params.model, 'list', mergedConfig, urlSearchParams);

      if (modelConfig.list?.lifecycle?.pre) {
        urlSearchParams = await modelConfig.list.lifecycle.pre(urlSearchParams, event.locals);
      }

      const customWhereObject = mergedConfig.where ? await mergedConfig.where(event) : undefined;
      const whereClause = {
        ...(modelConfig.list?.filterableBy
          ? Object.fromEntries(modelConfig.list.filterableBy.map((field) => urlSearchParams[field] ? [field, urlSearchParams[field]] : undefined).filter(Boolean) as any)
          : undefined),
        ...(modelConfig.list?.searchableBy?.length && urlSearchParams.search
          ? { OR: modelConfig.list.searchableBy.map((field) => ({ [field]: { contains: urlSearchParams.search, mode: 'insensitive' } })) }
          : undefined),
        ...(customWhereObject ? buildWhereClause(customWhereObject) : undefined),
      };

      const paginationOptions = getPaginationOptions(urlSearchParams);
      const paginatedData = await withPagination(async (skip, take) => {
        let result: unknown;

        if (modelConfig.list?.lifecycle?.main) {
          result = await modelConfig.list.lifecycle.main(whereClause, skip, take, event.locals);
          assertListResult(result, 'List lifecycle main must return { data, total }');
        } else {
          const delegate = config.prisma[event.params.model];
          const [data, total] = await Promise.all([
            delegate.findMany({
              orderBy: modelConfig.list?.orderBy,
              where: whereClause,
              select: createSelect(delegate, mergedConfig),
              skip,
              take,
            }),
            delegate.count({
              where: whereClause,
            }),
          ]);
          result = { data, total };
          assertListResult(result, 'Pagination loader must return { data, total }');
        }

        let finalData = result.data;
        if (modelConfig.list?.lifecycle?.post) {
          const postProcessedData = await modelConfig.list.lifecycle.post(finalData, event.locals);
          assertArray(postProcessedData, 'List lifecycle post must return an array');
          finalData = postProcessedData;
        }

        return {
          data: applyCustomFields(finalData, mergedConfig.customFields),
          total: result.total,
        };
      }, paginationOptions);

      return success(paginatedData.data, {
        status: 200,
        meta: paginatedData.meta,
      });
    } catch (err) {
      return exception(err);
    }
  };
}

export function createModelDetailHandler(config: HandlerConfig) {
  return async function GET(event: any) {
    try {
      const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
      assertModel(config.prisma, event.params.model);
      const mergedConfig = mergeDetailConfigs(modelConfig, modelConfig.detail);
      if (!mergedConfig.allow) throw new Error('Operation forbidden');

      const urlSearchParams = parseSearchParams(event.url.searchParams);
      await authorize(config, event, event.params.model, 'detail', mergedConfig, urlSearchParams);
      const customWhereObject = mergedConfig.where ? await mergedConfig.where(event) : undefined;
      const whereClause = {
        ...Object.fromEntries((mergedConfig.by ?? []).map((field) => urlSearchParams[field] ? [field, urlSearchParams[field]] : undefined).filter(Boolean) as any),
        ...(customWhereObject ? buildWhereClause(customWhereObject) : undefined),
      };

      let data = mergedConfig.lifecycle?.main
        ? await mergedConfig.lifecycle.main(whereClause, undefined, undefined, event.locals)
        : await config.prisma[event.params.model].findFirst({
            where: whereClause,
            select: createSelect(config.prisma[event.params.model], mergedConfig),
          });

      if (mergedConfig.lifecycle?.post) {
        data = await mergedConfig.lifecycle.post(data, undefined, event.locals);
      }

      data = applyCustomFields(data, mergedConfig.customFields);
      return success(data, { status: 200 });
    } catch (err) {
      return exception(err);
    }
  };
}

export function createModelCreateHandler(config: HandlerConfig) {
  return async function POST(event: any) {
    try {
      const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
      assertModel(config.prisma, event.params.model);
      const mergedConfig = mergeCreateConfigs(modelConfig, modelConfig.create);
      if (!mergedConfig.allow) throw new Error('Operation forbidden');

      let body = await event.request.json();
      await authorize(config, event, event.params.model, 'create', mergedConfig, body);
      if (mergedConfig.validation) await validateFields(body, mergedConfig.validation);

      if (config.files) body = await config.files.processPayloadFiles(body);

      if (modelConfig.types) {
        for (const field of Object.keys(modelConfig.types)) {
          if (modelConfig.types[field]?.type === 'multi' && Array.isArray(body[field]) && body[field].length) {
            const by = modelConfig.types[field].params.by;
            body[field] = { connect: body[field].map((item: AnyRecord) => ({ [by]: item[by] })) };
          }
        }
      }

      if (mergedConfig.lifecycle?.pre) body = await mergedConfig.lifecycle.pre(body, event.locals);
      let data = mergedConfig.lifecycle?.main
        ? await mergedConfig.lifecycle.main(body, event.locals)
        : await config.prisma[event.params.model].create({
            data: filterWritePayloadByFields(mergedConfig.fields, body),
          });
      if (mergedConfig.lifecycle?.post) data = await mergedConfig.lifecycle.post(body, data, event.locals);

      return success(data, { status: 201 });
    } catch (err) {
      return exception(err);
    }
  };
}

export function createModelUpdateHandler(config: HandlerConfig) {
  return async function PUT(event: any) {
    try {
      const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
      assertModel(config.prisma, event.params.model);
      const mergedConfig = mergeUpdateConfigs(modelConfig, modelConfig.create, modelConfig.update);
      if (!mergedConfig.allow) throw new Error('Operation forbidden');

      let body = await event.request.json();
      await authorize(config, event, event.params.model, 'update', mergedConfig, body);
      if (mergedConfig.validation) await validateFields(body, mergedConfig.validation);

      const customWhereObject = mergedConfig.where ? await mergedConfig.where(event) : undefined;
      const whereClause = {
        ...Object.fromEntries((mergedConfig.by ?? []).map((key) => [key, body[key]])),
        ...(customWhereObject ? buildWhereClause(customWhereObject) : undefined),
      };

      const previousData = config.files
        ? await config.prisma[event.params.model].findFirst({
            where: whereClause,
            select: createSelect(config.prisma[event.params.model], mergedConfig),
          })
        : undefined;

      if (config.files) {
        body = await config.files.processPayloadFiles(body, {
          previousData,
          deleteReplacedFiles: true,
        });
      }

      if (mergedConfig.lifecycle?.pre) body = await mergedConfig.lifecycle.pre(body, event.locals);
      let data = mergedConfig.lifecycle?.main
        ? await mergedConfig.lifecycle.main(body, event.locals)
        : await config.prisma[event.params.model].update({
            where: whereClause,
            data: filterWritePayloadByFields(mergedConfig.fields, body),
          });
      if (mergedConfig.lifecycle?.post) data = await mergedConfig.lifecycle.post(body, data, event.locals);

      return success(data, { status: 200 });
    } catch (err) {
      return exception(err);
    }
  };
}

export function createModelDeleteHandler(config: HandlerConfig) {
  return async function DELETE(event: any) {
    try {
      const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
      assertModel(config.prisma, event.params.model);
      const mergedConfig = mergeDeleteConfigs(modelConfig, modelConfig.delete);
      if (!mergedConfig.allow) throw new Error('Operation forbidden');

      let body = await event.request.json();
      await authorize(config, event, event.params.model, 'delete', mergedConfig, body);
      const customWhereObject = mergedConfig.where ? await mergedConfig.where(event) : undefined;
      const whereClause = {
        ...Object.fromEntries((mergedConfig.by ?? []).map((key) => [key, body[key]])),
        ...(customWhereObject ? buildWhereClause(customWhereObject) : undefined),
      };

      const previousData = config.files
        ? await config.prisma[event.params.model].findFirst({
            where: whereClause,
            select: createSelect(config.prisma[event.params.model], mergedConfig),
          })
        : undefined;

      if (mergedConfig.lifecycle?.pre) body = await mergedConfig.lifecycle.pre(body, event.locals);
      let data = mergedConfig.lifecycle?.main
        ? await mergedConfig.lifecycle.main(body, event.locals)
        : await config.prisma[event.params.model].delete({ where: whereClause });
      if (mergedConfig.lifecycle?.post) data = await mergedConfig.lifecycle.post(body, data, event.locals);

      if (config.files) {
        const urls = config.files.collectFileUrls(previousData ?? data);
        await Promise.all(urls.map(async (url) => {
          try {
            await config.files?.deleteFile(url);
          } catch (cleanupError) {
            console.error('[CRUD] Failed to delete referenced file:', cleanupError);
          }
        }));
      }

      return success(data, { status: 200 });
    } catch (err) {
      return exception(err);
    }
  };
}

export function createModelReorderHandler(config: HandlerConfig) {
  return async function PUT(event: any) {
    try {
      const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
      assertModel(config.prisma, event.params.model);
      const mergedConfig = mergeReorderConfigs(modelConfig, modelConfig.reorder);
      if (!mergedConfig.allow) throw new Error('Operation forbidden');

      let body = await event.request.json();
      assertReorderPayload(body);
      await authorize(config, event, event.params.model, 'reorder', mergedConfig, body);
      assertReorderAxis(mergedConfig.axis);
      if (mergedConfig.lifecycle?.pre) {
        body = await mergedConfig.lifecycle.pre(body, event.locals);
        assertReorderPayload(body);
      }
      let data = mergedConfig.lifecycle?.main
        ? await mergedConfig.lifecycle.main(body, event.locals)
        : await reorderEntries({
            prisma: config.prisma,
            model: event.params.model,
            id: body.id,
            from: body.from,
            to: body.to,
            axis: mergedConfig.axis,
          });
      if (mergedConfig.lifecycle?.post) data = await mergedConfig.lifecycle.post(body, data, event.locals);

      return success(data, { status: 200 });
    } catch (err) {
      return exception(err);
    }
  };
}

export function createModelVerifyHandler(config: HandlerConfig) {
  return async function POST(event: any) {
    try {
      const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
      assertModel(config.prisma, event.params.model);
      const mergedConfig = mergeVerifyConfigs(modelConfig, modelConfig.verify);
      if (!mergedConfig.allow) throw new Error('Operation forbidden');

      let body = await event.request.json();
      await authorize(config, event, event.params.model, 'verify', mergedConfig, body);

      const by = mergedConfig.by as string;
      const transition = mergedConfig.transitions?.[body.action];
      if (!by) throw new Error(`"by" is not configured for model "${event.params.model}"`);
      if (!transition) throw new Error(`Action "${body.action}" is not allowed.`);

      if (mergedConfig.lifecycle?.pre) body = await mergedConfig.lifecycle.pre(body, event.locals);
      let data;
      if (mergedConfig.lifecycle?.main) {
        data = await mergedConfig.lifecycle.main(body, event.locals, { [by]: body[by] });
      } else {
        const record = await config.prisma[event.params.model].findUnique({ where: { [by]: body[by] } });
        if (!record) throw new Error('Record not found.');
        const allowedFromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
        if (!allowedFromStates.includes(record[mergedConfig.stateField as string])) throw new Error('Action is not allowed from current state.');
        data = await config.prisma[event.params.model].update({
          where: { [by]: body[by] },
          data: { [mergedConfig.stateField as string]: transition.to },
        });
      }
      if (mergedConfig.lifecycle?.post) data = await mergedConfig.lifecycle.post(body, data, event.locals);

      return success(data, { status: 200 });
    } catch (err) {
      return exception(err);
    }
  };
}

async function resolveModelConfig(registry: ModelConfigRegistry, model: string): Promise<ModelConfig> {
  const key = `./${model}.ts`;
  const entry = (registry as any)[key] ?? (registry as any)[model];
  if (!entry) throw new Error('Model config not found');
  if (typeof entry === 'function') return (await entry()).default;
  return entry;
}

function assertModel(prisma: any, model: string) {
  if (!prisma[model]) throw new Error('Model not found');
}

function createSelect(delegate: any, config: ModelConfig) {
  return omitIfEmptyObject({
    ...Object.fromEntries((config.fields ?? Object.keys(delegate.fields ?? {})).map((field) => [field, true])),
    ...(config.fieldsForeign ? transformFieldsForeign(config.fieldsForeign) : undefined),
  });
}

function filterWritePayloadByFields(fields: string[] | undefined, body: AnyRecord): AnyRecord {
  if (!fields) return body;
  return Object.fromEntries(fields.map((key) => [key, body[key]]));
}

function applyCustomFields(data: any, customFields?: Array<{ name: string; generator: (data: AnyRecord) => unknown }>) {
  if (!customFields) return data;
  const apply = (item: AnyRecord) => {
    for (const customField of customFields) item[customField.name] = customField.generator(item);
    return item;
  };
  return Array.isArray(data) ? data.map(apply) : data ? apply(data) : data;
}

function getPaginationOptions(searchParams: AnyRecord): PaginationOptions {
  if (searchParams.page !== undefined && typeof searchParams.page !== 'number') {
    throw new Error('Query parameter "page" must be a number');
  }

  if (searchParams.limit !== undefined && typeof searchParams.limit !== 'number') {
    throw new Error('Query parameter "limit" must be a number');
  }

  return {
    page: typeof searchParams.page === 'number' ? searchParams.page : undefined,
    limit: typeof searchParams.limit === 'number' ? searchParams.limit : undefined,
  };
}

function assertListResult(value: unknown, message: string): asserts value is { data: any[]; total: number } {
  if (!value || typeof value !== 'object') {
    throw new TypeError(message);
  }

  const candidate = value as { data?: unknown; total?: unknown };
  if (!Array.isArray(candidate.data) || typeof candidate.total !== 'number' || !Number.isFinite(candidate.total)) {
    throw new TypeError(message);
  }
}

function assertArray(value: unknown, message: string): asserts value is any[] {
  if (!Array.isArray(value)) throw new TypeError(message);
}

function assertReorderPayload(value: unknown): asserts value is ReorderPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Reorder payload "id" is required');
  }

  const payload = value as Record<string, unknown>;
  if (
    !Object.prototype.hasOwnProperty.call(payload, 'id') ||
    !(typeof payload.id === 'string' || typeof payload.id === 'number') ||
    payload.id === ''
  ) {
    throw new TypeError('Reorder payload "id" is required');
  }

  if (typeof payload.from !== 'number' || !Number.isFinite(payload.from)) {
    throw new TypeError('Reorder payload "from" must be a number');
  }

  if (typeof payload.to !== 'number' || !Number.isFinite(payload.to)) {
    throw new TypeError('Reorder payload "to" must be a number');
  }
}

function assertReorderAxis(axis: unknown): asserts axis is string[] {
  if (
    !Array.isArray(axis) ||
    axis.length === 0 ||
    axis.some((field) => typeof field !== 'string' || field.trim() === '')
  ) {
    throw new TypeError('Reorder axis must be configured');
  }

  if (axis.includes('*') && (axis.length !== 1 || axis[0] !== '*')) {
    throw new TypeError('Global reorder axis "*" cannot be combined with other fields');
  }
}

function mergeListConfigs(base: ModelConfig, operation?: ModelConfig['list']): ModelConfig['list'] {
  return { ...base, ...operation, fieldsForeign: operation?.fieldsForeign ?? base.view?.fieldsForeign ?? base.fieldsForeign, customFields: operation?.customFields ?? base.view?.customFields };
}

function mergeDetailConfigs(base: ModelConfig, operation?: ModelConfig['detail']): ModelConfig['detail'] {
  return { ...base, ...operation, fieldsForeign: operation?.fieldsForeign ?? base.view?.fieldsForeign ?? base.fieldsForeign, customFields: operation?.customFields ?? base.view?.customFields };
}

function mergeCreateConfigs(base: ModelConfig, operation?: ModelConfig['create']): ModelConfig['create'] {
  return { ...base, ...operation };
}

function mergeUpdateConfigs(base: ModelConfig, create?: ModelConfig['create'], update?: ModelConfig['update']): ModelConfig['update'] {
  return { ...base, ...create, ...update };
}

function mergeDeleteConfigs(base: ModelConfig, operation?: ModelConfig['delete']): ModelConfig['delete'] {
  return { ...base, ...operation };
}

function mergeReorderConfigs(base: ModelConfig, operation?: ModelConfig['reorder']): ModelConfig['reorder'] {
  return { ...base, ...operation, by: operation?.by ?? base.by ?? ['id'] };
}

function mergeVerifyConfigs(base: ModelConfig, operation?: ModelConfig['verify']): ModelConfig['verify'] {
  return {
    ...base,
    ...operation,
    by: operation?.by ?? 'id',
    stateField: operation?.stateField ?? 'status',
    initialState: operation?.initialState ?? 'draft',
    states: operation?.states ?? ['draft', 'published', 'archived'],
    transitions: operation?.transitions ?? {
      publish: { from: 'draft', to: 'published' },
      archive: { from: ['draft', 'published'], to: 'archived' },
      restore: { from: 'archived', to: 'draft' },
    },
  } as ModelConfig['verify'];
}

async function authorize(
  config: HandlerConfig,
  event: any,
  model: string,
  operation: CrudOperation,
  operationConfig: Pick<BaseOperationConfig, 'permission' | 'authorize'>,
  input: AnyRecord,
) {
  const authorizeOperation = config.authorizeOperation ?? defaultAuthorizeOperation;
  await authorizeOperation(event, model, operation, {
    permission: operationConfig.permission,
    authorize: operationConfig.authorize,
  } as any, input);
}

export const createModelAPI = createModelApi;
