import { describe, expect, it, vi } from 'vitest';
import { createModelReorderHandler } from '../index.js';
async function callReorderHandler({ body, modelConfig, prisma, locals = {
    user: {
        role: {
            permissions: [{ code: 'update-section' }],
        },
    },
}, }) {
    const handler = createModelReorderHandler({
        prisma,
        modelConfigs: {
            './section.ts': modelConfig,
        },
    });
    return handler({
        request: new Request('http://localhost/api/section/reorder', {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
        params: { model: 'section' },
        locals,
    });
}
async function responseJson(response) {
    return response.json();
}
function createPrisma() {
    const txDelegate = {
        updateMany: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
    };
    const prisma = {
        section: {
            findUnique: vi.fn(async () => ({ id: 's1', order: 1, section_group_id: 'g1' })),
        },
        $transaction: vi.fn(async (callback) => callback({ section: txDelegate })),
    };
    return { prisma, txDelegate };
}
describe('createModelReorderHandler', () => {
    it('calls reorder with canonical payload', async () => {
        const { prisma, txDelegate } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1', from: 1, to: 3 },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: ['section_group_id'],
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(true);
        expect(txDelegate.updateMany).toHaveBeenCalledWith({
            where: {
                section_group_id: 'g1',
                order: { gt: 1, lte: 3 },
            },
            data: {
                order: { decrement: 1 },
            },
        });
    });
    it('rejects payload missing canonical keys', async () => {
        const { prisma } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1' },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: ['section_group_id'],
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('Reorder payload "from" must be a number');
    });
    it('rejects missing axis config', async () => {
        const { prisma } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1', from: 1, to: 3 },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('Reorder axis must be configured');
    });
    it('rejects empty axis config', async () => {
        const { prisma } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1', from: 1, to: 3 },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: [],
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('Reorder axis must be configured');
    });
    it('rejects mixed global axis', async () => {
        const { prisma } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1', from: 1, to: 3 },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: ['*', 'section_group_id'],
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('Global reorder axis "*" cannot be combined with other fields');
    });
    it('rejects non-numeric from', async () => {
        const { prisma } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1', from: '1', to: 3 },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: ['section_group_id'],
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('Reorder payload "from" must be a number');
    });
    it('rejects non-numeric to', async () => {
        const { prisma } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1', from: 1, to: '3' },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: ['section_group_id'],
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('Reorder payload "to" must be a number');
    });
    it('pre lifecycle must return canonical payload', async () => {
        const { prisma } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1', from: 1, to: 3 },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: ['section_group_id'],
                    lifecycle: {
                        pre: async () => ({ id: 's1' }),
                    },
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(false);
        expect(body.error.message).toBe('Reorder payload "from" must be a number');
    });
    it('main lifecycle overrides framework reorder', async () => {
        const { prisma, txDelegate } = createPrisma();
        const main = vi.fn(async () => ({ custom: true }));
        const locals = {
            user: {
                role: {
                    permissions: [{ code: 'update-section' }],
                },
            },
            marker: 'locals-value',
        };
        const response = await callReorderHandler({
            body: { id: 's1', from: 1, to: 3 },
            prisma,
            locals,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: ['section_group_id'],
                    lifecycle: {
                        main,
                    },
                },
            },
        });
        const body = await responseJson(response);
        expect(main).toHaveBeenCalledWith({ id: 's1', from: 1, to: 3 }, locals);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(txDelegate.updateMany).not.toHaveBeenCalled();
        expect(body.ok).toBe(true);
        expect(body.data).toEqual({ custom: true });
    });
    it('post lifecycle runs after framework reorder', async () => {
        const { prisma } = createPrisma();
        const response = await callReorderHandler({
            body: { id: 's1', from: 1, to: 3 },
            prisma,
            modelConfig: {
                allow: true,
                reorder: {
                    allow: true,
                    axis: ['section_group_id'],
                    lifecycle: {
                        post: async (_body, data) => ({ ...data, postProcessed: true }),
                    },
                },
            },
        });
        const body = await responseJson(response);
        expect(body.ok).toBe(true);
        expect(body.data).toEqual({ message: 'Order updated successfully', postProcessed: true });
    });
});
