import { describe, expect, it, vi } from 'vitest';
import { reorderEntries } from '../reorder.js';
function createMocks() {
    const txDelegate = {
        updateMany: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
    };
    const prisma = {
        section: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn(async (callback) => callback({ section: txDelegate })),
    };
    return { prisma, txDelegate };
}
describe('reorderEntries', () => {
    it('moves down within axis', async () => {
        const { prisma, txDelegate } = createMocks();
        prisma.section.findUnique.mockResolvedValue({ id: 's1', order: 1, section_group_id: 'g1' });
        const result = await reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 1,
            to: 4,
            axis: ['section_group_id'],
        });
        expect(result).toEqual({ message: 'Order updated successfully' });
        expect(txDelegate.updateMany).toHaveBeenCalledWith({
            where: {
                section_group_id: 'g1',
                order: { gt: 1, lte: 4 },
            },
            data: {
                order: { decrement: 1 },
            },
        });
        expect(txDelegate.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { order: 4 },
        });
    });
    it('moves up within axis', async () => {
        const { prisma, txDelegate } = createMocks();
        prisma.section.findUnique.mockResolvedValue({ id: 's1', order: 5, section_group_id: 'g1' });
        await reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 5,
            to: 2,
            axis: ['section_group_id'],
        });
        expect(txDelegate.updateMany).toHaveBeenCalledWith({
            where: {
                section_group_id: 'g1',
                order: { gte: 2, lt: 5 },
            },
            data: {
                order: { increment: 1 },
            },
        });
        expect(txDelegate.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { order: 2 },
        });
    });
    it('supports multiple axis fields', async () => {
        const { prisma, txDelegate } = createMocks();
        prisma.section.findUnique.mockResolvedValue({
            id: 's1',
            order: 3,
            section_group_id: 'g1',
            parent_section_id: 'p1',
        });
        await reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 3,
            to: 1,
            axis: ['section_group_id', 'parent_section_id'],
        });
        expect(txDelegate.updateMany).toHaveBeenCalledWith({
            where: {
                section_group_id: 'g1',
                parent_section_id: 'p1',
                order: { gte: 1, lt: 3 },
            },
            data: {
                order: { increment: 1 },
            },
        });
    });
    it('supports explicit global axis', async () => {
        const { prisma, txDelegate } = createMocks();
        prisma.section.findUnique.mockResolvedValue({ id: 's1', order: 1, section_group_id: 'g1' });
        await reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 1,
            to: 2,
            axis: ['*'],
        });
        expect(txDelegate.updateMany).toHaveBeenCalledWith({
            where: {
                order: { gt: 1, lte: 2 },
            },
            data: {
                order: { decrement: 1 },
            },
        });
    });
    it('no-op does not start transaction', async () => {
        const { prisma, txDelegate } = createMocks();
        prisma.section.findUnique.mockResolvedValue({ id: 's1', order: 3, section_group_id: 'g1' });
        const result = await reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 3,
            to: 3,
            axis: ['section_group_id'],
        });
        expect(result).toEqual({ message: 'No changes in order' });
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(txDelegate.updateMany).not.toHaveBeenCalled();
        expect(txDelegate.update).not.toHaveBeenCalled();
    });
    it('rejects missing model delegate', async () => {
        await expect(reorderEntries({
            prisma: { $transaction: vi.fn() },
            model: 'section',
            id: 's1',
            from: 1,
            to: 2,
            axis: ['section_group_id'],
        })).rejects.toThrowError(new Error('Model "section" not found'));
    });
    it('rejects missing record', async () => {
        const { prisma } = createMocks();
        prisma.section.findUnique.mockResolvedValue(null);
        await expect(reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 1,
            to: 2,
            axis: ['section_group_id'],
        })).rejects.toThrowError(new Error('Record not found'));
    });
    it('rejects missing axis', async () => {
        const { prisma } = createMocks();
        await expect(reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 1,
            to: 2,
            axis: [],
        })).rejects.toThrowError(new Error('Reorder axis must be configured'));
    });
    it('rejects axis field missing on record', async () => {
        const { prisma } = createMocks();
        prisma.section.findUnique.mockResolvedValue({ id: 's1', order: 1 });
        await expect(reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 1,
            to: 2,
            axis: ['section_group_id'],
        })).rejects.toThrowError(new Error('Axis field "section_group_id" not found on record'));
    });
    it('supports custom order field', async () => {
        const { prisma, txDelegate } = createMocks();
        prisma.section.findUnique.mockResolvedValue({ id: 's1', sort_index: 1, section_group_id: 'g1' });
        await reorderEntries({
            prisma,
            model: 'section',
            id: 's1',
            from: 1,
            to: 3,
            axis: ['section_group_id'],
            orderField: 'sort_index',
        });
        expect(txDelegate.updateMany).toHaveBeenCalledWith({
            where: {
                section_group_id: 'g1',
                sort_index: { gt: 1, lte: 3 },
            },
            data: {
                sort_index: { decrement: 1 },
            },
        });
        expect(txDelegate.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { sort_index: 3 },
        });
    });
});
