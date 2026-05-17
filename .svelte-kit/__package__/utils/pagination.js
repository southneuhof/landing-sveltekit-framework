function normalizePaginationNumber(value, fallback, optionName) {
    if (value === undefined)
        return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError(`Pagination option "${optionName}" must be a number`);
    }
    return Math.max(Math.floor(value), 1);
}
function assertPaginationLoaderResult(value) {
    if (!value || typeof value !== 'object') {
        throw new TypeError('Pagination loader must return { data, total }');
    }
    const candidate = value;
    if (!Array.isArray(candidate.data) || typeof candidate.total !== 'number' || !Number.isFinite(candidate.total)) {
        throw new TypeError('Pagination loader must return { data, total }');
    }
}
export async function withPagination(loader, options = {}) {
    const page = normalizePaginationNumber(options.page, 1, 'page');
    const limit = normalizePaginationNumber(options.limit, 10, 'limit');
    const skip = (page - 1) * limit;
    const take = limit;
    const loaderResult = await loader(skip, take);
    assertPaginationLoaderResult(loaderResult);
    const totalRecords = Math.max(Math.floor(loaderResult.total), 0);
    const totalPages = totalRecords === 0 ? 0 : Math.ceil(totalRecords / limit);
    return {
        data: loaderResult.data,
        meta: {
            totalRecords,
            totalPages,
            currentPage: page,
            limit,
        },
    };
}
