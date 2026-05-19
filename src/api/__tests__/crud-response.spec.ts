import { describe, expect, it, vi } from 'vitest';

import {
  createModelCreateHandler,
  createModelDeleteHandler,
  createModelDetailHandler,
  createModelListHandler,
  createModelReorderHandler,
  createModelUpdateHandler,
  createModelVerifyHandler,
} from '../index.js';

const model = 'article';

const baseModelConfig = {
  allow: true,
  fields: ['id', 'title'],
  list: { allow: true },
  detail: { allow: true, by: ['id'] },
  create: { allow: true },
  update: { allow: true, by: ['id'] },
  delete: { allow: true, by: ['id'] },
  reorder: { allow: true, axis: ['*'] },
  verify: {
    allow: true,
    by: 'id',
    stateField: 'status_code',
    transitions: {
      APPROVE: { from: 'REVIEW', to: 'PUBLISHED' },
    },
  },
};

function createConfig(prisma: any, modelConfig: any = baseModelConfig) {
  return {
    prisma,
    modelConfigs: {
      './article.ts': modelConfig,
    },
  };
}

function createLocals() {
  return {
    isPrivilegedRole: true,
    user: { id: 1 },
  };
}

describe('crud canonical response contract', () => {
  it('list response shape', async () => {
    const response = await createModelListHandler(createConfig({
      article: {
        fields: { id: true, title: true },
        findMany: vi.fn(async () => [{ id: 'a', title: 'A' }]),
        count: vi.fn(async () => 1),
      },
    }))({
      url: new URL('http://localhost/api/article/list?page=1&limit=10'),
      params: { model },
      locals: createLocals(),
    } as any);

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: [{ id: 'a', title: 'A' }],
      meta: {
        totalRecords: 1,
        totalPages: 1,
        currentPage: 1,
        limit: 10,
      },
    });
    expect(body).not.toHaveProperty('success');
    expect(body.data?.data).toBeUndefined();
  });

  it('detail response shape', async () => {
    const response = await createModelDetailHandler(createConfig({
      article: {
        fields: { id: true, title: true },
        findFirst: vi.fn(async () => ({ id: 'a', title: 'A' })),
      },
    }))({
      request: new Request('http://localhost/api/article/detail?id=a'),
      url: new URL('http://localhost/api/article/detail?id=a'),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { id: 'a', title: 'A' },
    });
  });

  it('create response shape and status', async () => {
    const response = await createModelCreateHandler(createConfig({
      article: {
        create: vi.fn(async () => ({ id: 'a', title: 'A' })),
      },
    }))({
      request: new Request('http://localhost/api/article/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'A' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { id: 'a', title: 'A' },
    });
  });

  it('update response shape', async () => {
    const response = await createModelUpdateHandler(createConfig({
      article: {
        update: vi.fn(async () => ({ id: 'a', title: 'A2' })),
      },
    }))({
      request: new Request('http://localhost/api/article/update', {
        method: 'PUT',
        body: JSON.stringify({ id: 'a', title: 'A2' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { id: 'a', title: 'A2' },
    });
  });

  it('update writes only whitelisted fields in default prisma path', async () => {
    const prismaUpdate = vi.fn(async () => ({ id: 'a', title: 'A2' }));
    const response = await createModelUpdateHandler(createConfig(
      { article: { update: prismaUpdate } },
      {
        ...baseModelConfig,
        update: { allow: true, by: ['id'], fields: ['title'] },
      },
    ))({
      request: new Request('http://localhost/api/article/update', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'a',
          title: 'A2',
          section_group_id: 'group-id',
          structure: [{ id: 'x' }],
          updated_at: '2026-05-17T17:15:15.563Z',
        }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    expect(prismaUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { title: 'A2' },
    });
  });

  it('create writes only whitelisted fields in default prisma path', async () => {
    const prismaCreate = vi.fn(async () => ({ id: 'a', title: 'A' }));
    const response = await createModelCreateHandler(createConfig(
      { article: { create: prismaCreate } },
      {
        ...baseModelConfig,
        create: { allow: true, fields: ['title'] },
      },
    ))({
      request: new Request('http://localhost/api/article/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'A',
          section_group_id: 'group-id',
          structure: [{ id: 'x' }],
          updated_at: '2026-05-17T17:15:15.563Z',
        }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(201);
    expect(prismaCreate).toHaveBeenCalledWith({
      data: { title: 'A' },
    });
  });

  it('passes request input to model authorize hooks', async () => {
    const authorize = vi.fn();
    const response = await createModelCreateHandler(createConfig(
      {
        article: {
          create: vi.fn(async () => ({ id: 'a', title: 'A' })),
        },
      },
      {
        ...baseModelConfig,
        create: { allow: true, authorize },
      },
    ))({
      request: new Request('http://localhost/api/article/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'A' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(201);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), { title: 'A' });
  });

  it('create and update pass full body when fields are not configured', async () => {
    const prismaCreate = vi.fn(async () => ({ id: 'a', title: 'A' }));
    const prismaUpdate = vi.fn(async () => ({ id: 'a', title: 'A2' }));
    const fullBody = {
      id: 'a',
      title: 'A2',
      section_group_id: 'group-id',
      structure: [{ id: 'x' }],
      updated_at: '2026-05-17T17:15:15.563Z',
    };

    const modelConfigWithoutFields = {
      ...baseModelConfig,
      fields: undefined,
    };

    const createResponse = await createModelCreateHandler(createConfig(
      { article: { create: prismaCreate } },
      {
        ...modelConfigWithoutFields,
        create: { allow: true },
      },
    ))({
      request: new Request('http://localhost/api/article/create', {
        method: 'POST',
        body: JSON.stringify(fullBody),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    const updateResponse = await createModelUpdateHandler(createConfig(
      { article: { update: prismaUpdate } },
      {
        ...modelConfigWithoutFields,
        update: { allow: true, by: ['id'] },
      },
    ))({
      request: new Request('http://localhost/api/article/update', {
        method: 'PUT',
        body: JSON.stringify(fullBody),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(prismaCreate).toHaveBeenCalledWith({ data: fullBody });
    expect(prismaUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: fullBody,
    });
  });

  it('update lifecycle.main receives full body and bypasses default prisma update', async () => {
    const prismaUpdate = vi.fn(async () => ({ id: 'a', title: 'A2' }));
    const lifecycleMain = vi.fn(async (body) => ({ ok: true, body }));
    const payload = {
      id: 'a',
      title: 'A2',
      section_group_id: 'group-id',
      structure: [{ id: 'x' }],
      updated_at: '2026-05-17T17:15:15.563Z',
    };

    const response = await createModelUpdateHandler(createConfig(
      { article: { update: prismaUpdate } },
      {
        ...baseModelConfig,
        update: {
          allow: true,
          by: ['id'],
          fields: ['title'],
          lifecycle: { main: lifecycleMain },
        },
      },
    ))({
      request: new Request('http://localhost/api/article/update', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    expect(lifecycleMain).toHaveBeenCalledWith(payload, expect.anything());
    expect(prismaUpdate).not.toHaveBeenCalled();
  });

  it('delete response shape', async () => {
    const response = await createModelDeleteHandler(createConfig({
      article: {
        delete: vi.fn(async () => ({ id: 'a', title: 'A' })),
      },
    }))({
      request: new Request('http://localhost/api/article/delete', {
        method: 'DELETE',
        body: JSON.stringify({ id: 'a' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { id: 'a', title: 'A' },
    });
  });

  it('reorder response shape', async () => {
    const response = await createModelReorderHandler(createConfig({
      article: {
        findUnique: vi.fn(async () => ({ id: 'a', order: 1 })),
      },
      $transaction: vi.fn(async (cb: any) => cb({
        article: {
          updateMany: vi.fn(async () => ({})),
          update: vi.fn(async () => ({ id: 'a', order: 3 })),
        },
      })),
    }))({
      request: new Request('http://localhost/api/article/reorder', {
        method: 'PUT',
        body: JSON.stringify({ id: 'a', from: 1, to: 3 }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { message: 'Order updated successfully' },
    });
  });

  it('verify response shape', async () => {
    const response = await createModelVerifyHandler(createConfig({
      article: {
        findUnique: vi.fn(async () => ({ id: 'a', status_code: 'REVIEW' })),
        update: vi.fn(async () => ({ id: 'a', status_code: 'PUBLISHED' })),
      },
    }))({
      request: new Request('http://localhost/api/article/verify', {
        method: 'POST',
        body: JSON.stringify({ id: 'a', action: 'APPROVE' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { id: 'a', status_code: 'PUBLISHED' },
    });
  });

  it('error response shape', async () => {
    const response = await createModelListHandler({
      prisma: {},
      modelConfigs: {},
    })({
      url: new URL('http://localhost/api/article/list'),
      params: { model },
      locals: createLocals(),
    } as any);

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        message: expect.any(String),
      },
    });
    expect(body).not.toHaveProperty('success');
    expect(body).not.toHaveProperty('message');
  });
});
