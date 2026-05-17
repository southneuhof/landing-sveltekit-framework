import { describe, expect, it } from 'vitest';

import { withPagination } from '../pagination.js';

describe('withPagination', () => {
  it('uses defaults', async () => {
    const result = await withPagination(async (skip, take) => {
      expect(skip).toBe(0);
      expect(take).toBe(10);
      return { data: ['a', 'b'], total: 2 };
    });

    expect(result).toEqual({
      data: ['a', 'b'],
      meta: {
        totalRecords: 2,
        totalPages: 1,
        currentPage: 1,
        limit: 10,
      },
    });
  });

  it('supports page and limit', async () => {
    const result = await withPagination(async (skip, take) => {
      expect(skip).toBe(20);
      expect(take).toBe(10);
      return { data: ['x'], total: 42 };
    }, { page: 3, limit: 10 });

    expect(result.meta).toEqual({
      totalRecords: 42,
      totalPages: 5,
      currentPage: 3,
      limit: 10,
    });
  });

  it('clamps values below one', async () => {
    const result = await withPagination(async () => ({ data: [], total: 0 }), { page: 0, limit: -5 });

    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.limit).toBe(1);
  });

  it('floors decimals', async () => {
    const result = await withPagination(async (skip, take) => {
      expect(skip).toBe(5);
      expect(take).toBe(5);
      return { data: [], total: 0 };
    }, { page: 2.9, limit: 5.8 });

    expect(result.meta.currentPage).toBe(2);
    expect(result.meta.limit).toBe(5);
  });

  it('returns zero pages for zero records', async () => {
    const result = await withPagination(async () => ({ data: [], total: 0 }));

    expect(result.meta.totalPages).toBe(0);
  });

  it('rejects numeric strings', async () => {
    await expect(withPagination(async () => ({ data: [], total: 0 }), { page: '2' as any, limit: '10' as any }))
      .rejects.toThrowError(new TypeError('Pagination option "page" must be a number'));
  });

  it('ignores perPage and keeps default limit', async () => {
    const result = await withPagination(async (_skip, take) => ({ data: [], total: 0 }), { page: 1, perPage: 1 } as any);

    expect(result.meta.limit).toBe(10);
  });

  it('rejects array loader results', async () => {
    await expect(withPagination(async () => ['a', 'b'] as any)).rejects.toThrowError(
      new TypeError('Pagination loader must return { data, total }'),
    );
  });

  it('rejects invalid loader objects', async () => {
    await expect(withPagination(async () => ({ data: ['a'] } as any))).rejects.toThrowError(
      new TypeError('Pagination loader must return { data, total }'),
    );

    await expect(withPagination(async () => ({ data: 'not-array', total: 1 } as any))).rejects.toThrowError(
      new TypeError('Pagination loader must return { data, total }'),
    );

    await expect(withPagination(async () => ({ data: [], total: Number.NaN } as any))).rejects.toThrowError(
      new TypeError('Pagination loader must return { data, total }'),
    );
  });
});
