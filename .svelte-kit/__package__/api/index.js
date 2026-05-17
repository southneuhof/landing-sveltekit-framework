import { authorizeOperation as defaultAuthorizeOperation } from '../auth/index.js';
import { buildWhereClause, omitIfEmptyObject, parseSearchParams, transformFieldsForeign, validateFields } from '../utils/common.js';
import { withPagination } from '../utils/pagination.js';
import { reorderEntries } from '../utils/reorder.js';
import { exception, success } from '../utils/response.js';
export function createModelApi(dependencies) {
    return createCrudHandlers({
        prisma: dependencies.data.prisma,
        modelConfigs: dependencies.data.models,
        authorizeOperation: dependencies.auth?.authorizeOperation,
        files: dependencies.files,
    });
}
export function createCrudHandlers(config) {
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
export function createModelListHandler(config) {
    return async function GET(event) {
        try {
            const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
            assertModel(config.prisma, event.params.model);
            const mergedConfig = mergeListConfigs(modelConfig, modelConfig.list);
            if (!mergedConfig.allow)
                throw new Error('Operation forbidden');
            let urlSearchParams = parseSearchParams(event.url.searchParams);
            await authorize(config, event, event.params.model, 'list', mergedConfig, urlSearchParams);
            if (modelConfig.list?.lifecycle?.pre) {
                urlSearchParams = await modelConfig.list.lifecycle.pre(urlSearchParams, event.locals);
            }
            const customWhereObject = mergedConfig.where ? await mergedConfig.where(event) : undefined;
            const whereClause = {
                ...(modelConfig.list?.filterableBy
                    ? Object.fromEntries(modelConfig.list.filterableBy.map((field) => urlSearchParams[field] ? [field, urlSearchParams[field]] : undefined).filter(Boolean))
                    : undefined),
                ...(modelConfig.list?.searchableBy?.length && urlSearchParams.search
                    ? { OR: modelConfig.list.searchableBy.map((field) => ({ [field]: { contains: urlSearchParams.search, mode: 'insensitive' } })) }
                    : undefined),
                ...(customWhereObject ? buildWhereClause(customWhereObject) : undefined),
            };
            const paginationOptions = getPaginationOptions(urlSearchParams);
            const paginatedData = await withPagination(async (skip, take) => {
                let result;
                if (modelConfig.list?.lifecycle?.main) {
                    result = await modelConfig.list.lifecycle.main(whereClause, skip, take, event.locals);
                    assertListResult(result, 'List lifecycle main must return { data, total }');
                }
                else {
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
        }
        catch (err) {
            return exception(err);
        }
    };
}
export function createModelDetailHandler(config) {
    return async function GET(event) {
        try {
            const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
            assertModel(config.prisma, event.params.model);
            const mergedConfig = mergeDetailConfigs(modelConfig, modelConfig.detail);
            if (!mergedConfig.allow)
                throw new Error('Operation forbidden');
            const urlSearchParams = parseSearchParams(event.url.searchParams);
            await authorize(config, event, event.params.model, 'detail', mergedConfig, urlSearchParams);
            const customWhereObject = mergedConfig.where ? await mergedConfig.where(event) : undefined;
            const whereClause = {
                ...Object.fromEntries((mergedConfig.by ?? []).map((field) => urlSearchParams[field] ? [field, urlSearchParams[field]] : undefined).filter(Boolean)),
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
        }
        catch (err) {
            return exception(err);
        }
    };
}
export function createModelCreateHandler(config) {
    return async function POST(event) {
        try {
            const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
            assertModel(config.prisma, event.params.model);
            const mergedConfig = mergeCreateConfigs(modelConfig, modelConfig.create);
            if (!mergedConfig.allow)
                throw new Error('Operation forbidden');
            let body = await event.request.json();
            await authorize(config, event, event.params.model, 'create', mergedConfig, body);
            if (mergedConfig.validation)
                await validateFields(body, mergedConfig.validation);
            if (config.files)
                body = await config.files.processPayloadFiles(body);
            if (modelConfig.types) {
                for (const field of Object.keys(modelConfig.types)) {
                    if (modelConfig.types[field]?.type === 'multi' && Array.isArray(body[field]) && body[field].length) {
                        const by = modelConfig.types[field].params.by;
                        body[field] = { connect: body[field].map((item) => ({ [by]: item[by] })) };
                    }
                }
            }
            if (mergedConfig.lifecycle?.pre)
                body = await mergedConfig.lifecycle.pre(body, event.locals);
            let data = mergedConfig.lifecycle?.main
                ? await mergedConfig.lifecycle.main(body, event.locals)
                : await config.prisma[event.params.model].create({ data: body });
            if (mergedConfig.lifecycle?.post)
                data = await mergedConfig.lifecycle.post(body, data, event.locals);
            return success(data, { status: 201 });
        }
        catch (err) {
            return exception(err);
        }
    };
}
export function createModelUpdateHandler(config) {
    return async function PUT(event) {
        try {
            const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
            assertModel(config.prisma, event.params.model);
            const mergedConfig = mergeUpdateConfigs(modelConfig, modelConfig.create, modelConfig.update);
            if (!mergedConfig.allow)
                throw new Error('Operation forbidden');
            let body = await event.request.json();
            await authorize(config, event, event.params.model, 'update', mergedConfig, body);
            if (mergedConfig.validation)
                await validateFields(body, mergedConfig.validation);
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
            if (mergedConfig.lifecycle?.pre)
                body = await mergedConfig.lifecycle.pre(body, event.locals);
            let data = mergedConfig.lifecycle?.main
                ? await mergedConfig.lifecycle.main(body, event.locals)
                : await config.prisma[event.params.model].update({ where: whereClause, data: body });
            if (mergedConfig.lifecycle?.post)
                data = await mergedConfig.lifecycle.post(body, data, event.locals);
            return success(data, { status: 200 });
        }
        catch (err) {
            return exception(err);
        }
    };
}
export function createModelDeleteHandler(config) {
    return async function DELETE(event) {
        try {
            const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
            assertModel(config.prisma, event.params.model);
            const mergedConfig = mergeDeleteConfigs(modelConfig, modelConfig.delete);
            if (!mergedConfig.allow)
                throw new Error('Operation forbidden');
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
            if (mergedConfig.lifecycle?.pre)
                body = await mergedConfig.lifecycle.pre(body, event.locals);
            let data = mergedConfig.lifecycle?.main
                ? await mergedConfig.lifecycle.main(body, event.locals)
                : await config.prisma[event.params.model].delete({ where: whereClause });
            if (mergedConfig.lifecycle?.post)
                data = await mergedConfig.lifecycle.post(body, data, event.locals);
            if (config.files) {
                const urls = config.files.collectFileUrls(previousData ?? data);
                await Promise.all(urls.map(async (url) => {
                    try {
                        await config.files?.deleteFile(url);
                    }
                    catch (cleanupError) {
                        console.error('[CRUD] Failed to delete referenced file:', cleanupError);
                    }
                }));
            }
            return success(data, { status: 200 });
        }
        catch (err) {
            return exception(err);
        }
    };
}
export function createModelReorderHandler(config) {
    return async function PUT(event) {
        try {
            const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
            assertModel(config.prisma, event.params.model);
            const mergedConfig = mergeReorderConfigs(modelConfig, modelConfig.reorder);
            if (!mergedConfig.allow)
                throw new Error('Operation forbidden');
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
            if (mergedConfig.lifecycle?.post)
                data = await mergedConfig.lifecycle.post(body, data, event.locals);
            return success(data, { status: 200 });
        }
        catch (err) {
            return exception(err);
        }
    };
}
export function createModelVerifyHandler(config) {
    return async function POST(event) {
        try {
            const modelConfig = await resolveModelConfig(config.modelConfigs, event.params.model);
            assertModel(config.prisma, event.params.model);
            const mergedConfig = mergeVerifyConfigs(modelConfig, modelConfig.verify);
            if (!mergedConfig.allow)
                throw new Error('Operation forbidden');
            let body = await event.request.json();
            await authorize(config, event, event.params.model, 'verify', mergedConfig, body);
            const by = mergedConfig.by;
            const transition = mergedConfig.transitions?.[body.action];
            if (!by)
                throw new Error(`"by" is not configured for model "${event.params.model}"`);
            if (!transition)
                throw new Error(`Action "${body.action}" is not allowed.`);
            if (mergedConfig.lifecycle?.pre)
                body = await mergedConfig.lifecycle.pre(body, event.locals);
            let data;
            if (mergedConfig.lifecycle?.main) {
                data = await mergedConfig.lifecycle.main(body, event.locals, { [by]: body[by] });
            }
            else {
                const record = await config.prisma[event.params.model].findUnique({ where: { [by]: body[by] } });
                if (!record)
                    throw new Error('Record not found.');
                const allowedFromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
                if (!allowedFromStates.includes(record[mergedConfig.stateField]))
                    throw new Error('Action is not allowed from current state.');
                data = await config.prisma[event.params.model].update({
                    where: { [by]: body[by] },
                    data: { [mergedConfig.stateField]: transition.to },
                });
            }
            if (mergedConfig.lifecycle?.post)
                data = await mergedConfig.lifecycle.post(body, data, event.locals);
            return success(data, { status: 200 });
        }
        catch (err) {
            return exception(err);
        }
    };
}
async function resolveModelConfig(registry, model) {
    const key = `./${model}.ts`;
    const entry = registry[key] ?? registry[model];
    if (!entry)
        throw new Error('Model config not found');
    if (typeof entry === 'function')
        return (await entry()).default;
    return entry;
}
function assertModel(prisma, model) {
    if (!prisma[model])
        throw new Error('Model not found');
}
function createSelect(delegate, config) {
    return omitIfEmptyObject({
        ...Object.fromEntries((config.fields ?? Object.keys(delegate.fields ?? {})).map((field) => [field, true])),
        ...(config.fieldsForeign ? transformFieldsForeign(config.fieldsForeign) : undefined),
    });
}
function applyCustomFields(data, customFields) {
    if (!customFields)
        return data;
    const apply = (item) => {
        for (const customField of customFields)
            item[customField.name] = customField.generator(item);
        return item;
    };
    return Array.isArray(data) ? data.map(apply) : data ? apply(data) : data;
}
function getPaginationOptions(searchParams) {
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
function assertListResult(value, message) {
    if (!value || typeof value !== 'object') {
        throw new TypeError(message);
    }
    const candidate = value;
    if (!Array.isArray(candidate.data) || typeof candidate.total !== 'number' || !Number.isFinite(candidate.total)) {
        throw new TypeError(message);
    }
}
function assertArray(value, message) {
    if (!Array.isArray(value))
        throw new TypeError(message);
}
function assertReorderPayload(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('Reorder payload "id" is required');
    }
    const payload = value;
    if (!Object.prototype.hasOwnProperty.call(payload, 'id') ||
        !(typeof payload.id === 'string' || typeof payload.id === 'number') ||
        payload.id === '') {
        throw new TypeError('Reorder payload "id" is required');
    }
    if (typeof payload.from !== 'number' || !Number.isFinite(payload.from)) {
        throw new TypeError('Reorder payload "from" must be a number');
    }
    if (typeof payload.to !== 'number' || !Number.isFinite(payload.to)) {
        throw new TypeError('Reorder payload "to" must be a number');
    }
}
function assertReorderAxis(axis) {
    if (!Array.isArray(axis) ||
        axis.length === 0 ||
        axis.some((field) => typeof field !== 'string' || field.trim() === '')) {
        throw new TypeError('Reorder axis must be configured');
    }
    if (axis.includes('*') && (axis.length !== 1 || axis[0] !== '*')) {
        throw new TypeError('Global reorder axis "*" cannot be combined with other fields');
    }
}
function mergeListConfigs(base, operation) {
    return { ...base, ...operation, fieldsForeign: operation?.fieldsForeign ?? base.view?.fieldsForeign ?? base.fieldsForeign, customFields: operation?.customFields ?? base.view?.customFields };
}
function mergeDetailConfigs(base, operation) {
    return { ...base, ...operation, fieldsForeign: operation?.fieldsForeign ?? base.view?.fieldsForeign ?? base.fieldsForeign, customFields: operation?.customFields ?? base.view?.customFields };
}
function mergeCreateConfigs(base, operation) {
    return { ...base, ...operation };
}
function mergeUpdateConfigs(base, create, update) {
    return { ...base, ...create, ...update };
}
function mergeDeleteConfigs(base, operation) {
    return { ...base, ...operation };
}
function mergeReorderConfigs(base, operation) {
    return { ...base, ...operation, by: operation?.by ?? base.by ?? ['id'] };
}
function mergeVerifyConfigs(base, operation) {
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
    };
}
async function authorize(config, event, model, operation, operationConfig, input) {
    const authorizeOperation = config.authorizeOperation ?? defaultAuthorizeOperation;
    await authorizeOperation(event, model, operation, {
        permission: operationConfig.permission,
        authorize: operationConfig.authorize,
        input,
    });
}
export const createModelAPI = createModelApi;
