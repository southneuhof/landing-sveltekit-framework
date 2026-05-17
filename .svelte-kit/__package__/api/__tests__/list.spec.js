import { describe, expect, it, vi } from 'vitest';
import { createModelListHandler } from '../index.js';
async function callListHandler({ url = 'http://localhost/api/article/list?page=2&limit=5', params = { model: 'article' }, prisma, modelConfig, locals = {
    user: {
        role: {
            permissions: [{ code: 'view-article' }],
        },
    },
}, }) {
    const handler = createModelListHandler({
        prisma,
        modelConfigs: {
            './article.ts': modelConfig,
        },
    });
    return handler({
        url: new URL(url),
        params,
        locals,
    });
}
async function responseJson(response) {
    return response.json();
}
describe('createModelListHandler', () => {
    it('default prisma list counts records', async () => {
        const findMany = vi.fn(async () => [{ id: 'a1', title: 'A' }]);
        const count = vi.fn(async () => 12);
        const response = await callListHandler({
            prisma: {
                article: {
                    findMany,
                    count,
                    fields: { id: true, title: true },
                },
            },
            modelConfig: {
                allow: true,
                list: {
                    allow: true,
                    orderBy: { created_at: 'desc' },
                    fields: ['id', 'title'],
                },
            },
        });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
        expect(count).toHaveBeenCalledTimes(1);
        expect(count).toHaveBeenCalledWith({ where: {} });
        expect(await responseJson(response)).toEqual({
            ok: true,
            data: [{ id: 'a1', title: 'A' }],
            meta: {
                totalRecords: 12,
                totalPages: 3,
                currentPage: 2,
                limit: 5,
            },
        });
    });
    it('does not support perPage', async () => {
        const findMany = vi.fn(async () => [{ id: 'a1' }]);
        const count = vi.fn(async () => 50);
        const response = await callListHandler({
            url: 'http://localhost/api/article/list?page=2&perPage=5',
            prisma: {
                article: { findMany, count, fields: { id: true } },
            },
            modelConfig: {
                allow: true,
                list: {
                    allow: true,
                },
            },
        });
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
        const body = await responseJson(response);
        expect(body.meta.limit).toBe(10);
        expect(body.meta).not.toHaveProperty('perPage');
    });
    it('rejects non-numeric page', async () => {
        const response = await callListHandler({
            url: 'http://localhost/api/article/list?page=abc&limit=5',
            prisma: {
                article: { findMany: vi.fn(), count: vi.fn(), fields: { id: true } },
            },
            modelConfig: {
                allow: true,
                list: { allow: true },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toMatch(/Query parameter "page" must be a number/);
    });
    it('rejects non-numeric limit', async () => {
        const response = await callListHandler({
            url: 'http://localhost/api/article/list?page=1&limit=abc',
            prisma: {
                article: { findMany: vi.fn(), count: vi.fn(), fields: { id: true } },
            },
            modelConfig: {
                allow: true,
                list: { allow: true },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toMatch(/Query parameter "limit" must be a number/);
    });
    it('applies filterable and searchable where to count', async () => {
        const findMany = vi.fn(async () => []);
        const count = vi.fn(async () => 0);
        await callListHandler({
            url: 'http://localhost/api/article/list?status=PUBLISHED&search=home',
            prisma: {
                article: { findMany, count, fields: { status: true, title: true, excerpt: true } },
            },
            modelConfig: {
                allow: true,
                list: {
                    allow: true,
                    filterableBy: ['status'],
                    searchableBy: ['title', 'excerpt'],
                },
            },
        });
        const expectedWhere = {
            status: 'PUBLISHED',
            OR: [
                { title: { contains: 'home', mode: 'insensitive' } },
                { excerpt: { contains: 'home', mode: 'insensitive' } },
            ],
        };
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
        expect(count).toHaveBeenCalledWith({ where: expectedWhere });
    });
    it('lifecycle main must return { data, total }', async () => {
        const main = vi.fn(async () => ({ data: [{ id: 'custom' }], total: 30 }));
        const findMany = vi.fn(async () => []);
        const count = vi.fn(async () => 0);
        const response = await callListHandler({
            url: 'http://localhost/api/article/list?page=3&limit=10',
            prisma: {
                article: { findMany, count, fields: { id: true } },
            },
            modelConfig: {
                allow: true,
                list: {
                    allow: true,
                    lifecycle: { main },
                },
            },
        });
        expect(findMany).not.toHaveBeenCalled();
        expect(count).not.toHaveBeenCalled();
        const body = await responseJson(response);
        expect(body.meta.totalRecords).toBe(30);
        expect(body.meta.totalPages).toBe(3);
        expect(body.meta.currentPage).toBe(3);
        expect(body.meta.limit).toBe(10);
    });
    it('lifecycle main returning array throws', async () => {
        const response = await callListHandler({
            prisma: {
                article: {
                    fields: { id: true },
                },
            },
            modelConfig: {
                allow: true,
                list: {
                    allow: true,
                    lifecycle: {
                        main: async () => [{ id: 'legacy' }],
                    },
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('List lifecycle main must return { data, total }');
    });
    it('lifecycle post applies to data only', async () => {
        const response = await callListHandler({
            prisma: {
                article: {
                    fields: { id: true },
                },
            },
            modelConfig: {
                allow: true,
                list: {
                    allow: true,
                    lifecycle: {
                        main: async () => ({ data: [{ id: 'a' }], total: 1 }),
                        post: async (data) => data.map((item) => ({ ...item, postProcessed: true })),
                    },
                },
            },
        });
        const body = await responseJson(response);
        expect(body.data).toEqual([{ id: 'a', postProcessed: true }]);
        expect(body.meta.totalRecords).toBe(1);
    });
    it('lifecycle post returning non-array throws', async () => {
        const response = await callListHandler({
            prisma: {
                article: {
                    fields: { id: true },
                },
            },
            modelConfig: {
                allow: true,
                list: {
                    allow: true,
                    lifecycle: {
                        main: async () => ({ data: [{ id: 'a' }], total: 1 }),
                        post: async () => ({ id: 'not-array' }),
                    },
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('List lifecycle post must return an array');
    });
    it('custom fields apply after post', async () => {
        const response = await callListHandler({
            prisma: {
                article: {
                    fields: { id: true },
                },
            },
            modelConfig: {
                allow: true,
                view: {
                    customFields: [
                        {
                            name: 'label',
                            generator: (data) => `Article ${data.id}`,
                        },
                    ],
                },
                list: {
                    allow: true,
                    lifecycle: {
                        main: async () => ({ data: [{ id: 'a' }], total: 1 }),
                        post: async (data) => data.map((item) => ({ ...item, postProcessed: true })),
                    },
                },
            },
        });
        const body = await responseJson(response);
        expect(body.data).toEqual([
            {
                id: 'a',
                postProcessed: true,
                label: 'Article a',
            },
        ]);
    });
});
