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
  it('does not auto-delete public assets during CRUD delete cleanup', async () => {
    const deleteFile = vi.fn(async () => undefined)

    const response = await createModelDeleteHandler({
      prisma: {
        article: {
          fields: { id: true, media: true },
          findFirst: vi.fn(async () => ({ id: 'a', media: '/storage/public/asset.jpg' })),
          delete: vi.fn(async () => ({ id: 'a', media: '/storage/public/asset.jpg' })),
        },
      },
      modelConfigs: {
        './article.ts': baseModelConfig,
      },
      files: {
        collectFileUrls: vi.fn(() => ['/storage/public/asset.jpg']),
        deleteFile,
      } as any,
    })({
      request: new Request('http://localhost/api/article/delete', {
        method: 'DELETE',
        body: JSON.stringify({ id: 'a' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any)

    expect(response.status).toBe(200)
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('converts storage asset strings to { path, data, url } objects when PUBLIC_APP_URL is set', async () => {
    const previous = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = 'https://landing.example.com';

    const response = await createModelDetailHandler(createConfig({
      article: {
        fields: { id: true, media: true, attachment: true, meta: true, icon: true },
        findFirst: vi.fn(async () => ({
          id: 'a',
          media: '/storage/public/a.jpg',
          attachment: 'https://old-host.com/storage/private/doc.pdf',
          icon: 'ri-home-line',
          meta: {
            nested: [
              { path: '/storage/public/nested.png' },
              { url: '/storage/private/inner.pdf' },
            ],
          },
        })),
      },
    }))({
      request: new Request('http://localhost/api/article/a/show'),
      url: new URL('http://localhost/api/article/a/show'),
      params: { model, identity: 'a' },
      locals: createLocals(),
    } as any);

    process.env.PUBLIC_APP_URL = previous;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        id: 'a',
        media: {
          path: '/storage/public/a.jpg',
          data: '/storage/public/a.jpg',
          url: 'https://landing.example.com/storage/public/a.jpg',
        },
        attachment: {
          path: '/storage/private/doc.pdf',
          data: '/storage/private/doc.pdf',
          url: 'https://landing.example.com/storage/private/doc.pdf',
        },
        icon: 'ri-home-line',
        meta: {
          nested: [
            {
              path: {
                path: '/storage/public/nested.png',
                data: '/storage/public/nested.png',
                url: 'https://landing.example.com/storage/public/nested.png',
              },
            },
            {
              url: {
                path: '/storage/private/inner.pdf',
                data: '/storage/private/inner.pdf',
                url: 'https://landing.example.com/storage/private/inner.pdf',
              },
            },
          ],
        },
      },
    });
  });

  it('keeps external URLs and uses canonical path for url field when PUBLIC_APP_URL is missing', async () => {
    const previous = process.env.PUBLIC_APP_URL;
    delete process.env.PUBLIC_APP_URL;

    const response = await createModelDetailHandler(createConfig({
      article: {
        fields: { id: true, media: true, source: true, meta: true },
        findFirst: vi.fn(async () => ({
          id: 'a',
          media: 'https://old-host.com/storage/public/a.jpg',
          source: 'https://youtube.com/watch?v=x',
          meta: {
            data: '/storage/private/file.pdf',
            contact: 'mailto:test@example.com',
          },
        })),
      },
    }))({
      request: new Request('http://localhost/api/article/a/show'),
      url: new URL('http://localhost/api/article/a/show'),
      params: { model, identity: 'a' },
      locals: createLocals(),
    } as any);

    process.env.PUBLIC_APP_URL = previous;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        id: 'a',
        media: {
          path: '/storage/public/a.jpg',
          data: '/storage/public/a.jpg',
          url: '/storage/public/a.jpg',
        },
        source: 'https://youtube.com/watch?v=x',
        meta: {
          data: {
            path: '/storage/private/file.pdf',
            data: '/storage/private/file.pdf',
            url: '/storage/private/file.pdf',
          },
          contact: 'mailto:test@example.com',
        },
      },
    });
  });

  it('preserves non-plain response objects while converting nested storage values', async () => {
    const previous = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = 'https://landing.example.com';
    const updatedAt = new Date('2026-05-17T17:15:15.563Z');

    const response = await createModelDetailHandler(createConfig({
      article: {
        fields: { id: true, updated_at: true, meta: true },
        findFirst: vi.fn(async () => ({
          id: 'a',
          updated_at: updatedAt,
          meta: {
            asset: { path: '/storage/public/a.jpg' },
            dates: [updatedAt],
          },
        })),
      },
    }))({
      request: new Request('http://localhost/api/article/a/show'),
      url: new URL('http://localhost/api/article/a/show'),
      params: { model, identity: 'a' },
      locals: createLocals(),
    } as any);

    process.env.PUBLIC_APP_URL = previous;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        id: 'a',
        updated_at: '2026-05-17T17:15:15.563Z',
        meta: {
          asset: {
            path: {
              path: '/storage/public/a.jpg',
              data: '/storage/public/a.jpg',
              url: 'https://landing.example.com/storage/public/a.jpg',
            },
          },
          dates: ['2026-05-17T17:15:15.563Z'],
        },
      },
    });
  });

  it('applies object conversion across create/update/delete/reorder/verify responses', async () => {
    const previous = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = 'https://landing.example.com';

    const createResponse = await createModelCreateHandler(createConfig({
      article: {
        create: vi.fn(async () => ({ id: 'a', media: '/storage/public/a.jpg' })),
      },
    }))({
      request: new Request('http://localhost/api/article/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'A' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    const updateResponse = await createModelUpdateHandler(createConfig({
      article: {
        update: vi.fn(async () => ({ id: 'a', media: '/storage/private/b.jpg' })),
      },
    }))({
      request: new Request('http://localhost/api/article/update', {
        method: 'PUT',
        body: JSON.stringify({ id: 'a' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    const deleteResponse = await createModelDeleteHandler(createConfig({
      article: {
        delete: vi.fn(async () => ({ id: 'a', media: '/storage/public/c.jpg' })),
      },
    }))({
      request: new Request('http://localhost/api/article/delete', {
        method: 'DELETE',
        body: JSON.stringify({ id: 'a' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    const reorderResponse = await createModelReorderHandler(createConfig(
      {
        article: {
          findUnique: vi.fn(async () => ({ id: 'a', order: 1 })),
        },
        $transaction: vi.fn(async (cb: any) => cb({
          article: {
            updateMany: vi.fn(async () => ({})),
            update: vi.fn(async () => ({ id: 'a', media: '/storage/public/d.jpg', order: 3 })),
          },
        })),
      },
      {
        ...baseModelConfig,
        reorder: {
          allow: true,
          axis: ['*'],
          lifecycle: {
            main: async () => ({ media: '/storage/public/d.jpg' }),
          },
        },
      },
    ))({
      request: new Request('http://localhost/api/article/reorder', {
        method: 'PUT',
        body: JSON.stringify({ id: 'a', from: 1, to: 3 }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    const verifyResponse = await createModelVerifyHandler(createConfig({
      article: {
        findUnique: vi.fn(async () => ({ id: 'a', status_code: 'REVIEW' })),
        update: vi.fn(async () => ({ id: 'a', status_code: 'PUBLISHED', media: '/storage/public/e.jpg' })),
      },
    }))({
      request: new Request('http://localhost/api/article/verify', {
        method: 'POST',
        body: JSON.stringify({ id: 'a', action: 'APPROVE' }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    process.env.PUBLIC_APP_URL = previous;

    for (const response of [createResponse, updateResponse, deleteResponse, reorderResponse, verifyResponse]) {
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.media).toEqual({
        path: expect.stringMatching(/^\/storage\//),
        data: expect.stringMatching(/^\/storage\//),
        url: expect.stringMatching(/^https:\/\/landing\.example\.com\/storage\//),
      });
    }
  });

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
    const findFirst = vi.fn(async () => ({ id: 'a', title: 'A' }));
    const response = await createModelDetailHandler(createConfig({
      article: {
        fields: { id: true, title: true },
        findFirst,
      },
    }))({
      request: new Request('http://localhost/api/article/a/show'),
      url: new URL('http://localhost/api/article/a/show'),
      params: { model, identity: 'a' },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { id: 'a', title: 'A' },
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'a' },
    }));
  });

  it('detail maps composite identity segments by detail.by order', async () => {
    const findFirst = vi.fn(async () => ({ article_id: '123', language: 'id' }));
    const response = await createModelDetailHandler(createConfig(
      {
        article: {
          fields: { article_id: true, language: true },
          findFirst,
        },
      },
      {
        ...baseModelConfig,
        detail: { allow: true, by: ['article_id', 'language'] },
      },
    ))({
      request: new Request('http://localhost/api/article/123/id/show'),
      url: new URL('http://localhost/api/article/123/id/show'),
      params: { model, identity: '123/id' },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { article_id: '123', language: 'id' },
    }));
  });

  it('detail rejects missing identity segments', async () => {
    const response = await createModelDetailHandler(createConfig({
      article: {
        fields: { id: true, title: true },
        findFirst: vi.fn(async () => ({ id: 'a', title: 'A' })),
      },
    }))({
      request: new Request('http://localhost/api/article/show'),
      url: new URL('http://localhost/api/article/show'),
      params: { model, identity: '' },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        message: 'Invalid identity segment count: expected 1, received 0',
      },
    });
  });

  it('detail rejects extra identity segments', async () => {
    const response = await createModelDetailHandler(createConfig({
      article: {
        fields: { id: true, title: true },
        findFirst: vi.fn(async () => ({ id: 'a', title: 'A' })),
      },
    }))({
      request: new Request('http://localhost/api/article/123/extra/show'),
      url: new URL('http://localhost/api/article/123/extra/show'),
      params: { model, identity: '123/extra' },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        message: 'Invalid identity segment count: expected 1, received 2',
      },
    });
  });

  it('detail does not use query params for identity resolution', async () => {
    const findFirst = vi.fn(async () => ({ id: 'a', title: 'A' }));
    const response = await createModelDetailHandler(createConfig({
      article: {
        fields: { id: true, title: true },
        findFirst,
      },
    }))({
      request: new Request('http://localhost/api/article/show?id=123'),
      url: new URL('http://localhost/api/article/show?id=123'),
      params: { model, identity: '' },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(400);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('detail authorize receives identity object from path segments', async () => {
    const authorize = vi.fn();
    const response = await createModelDetailHandler(createConfig(
      {
        article: {
          fields: { article_id: true, language: true },
          findFirst: vi.fn(async () => ({ article_id: '123', language: 'id' })),
        },
      },
      {
        ...baseModelConfig,
        detail: { allow: true, by: ['article_id', 'language'], authorize },
      },
    ))({
      request: new Request('http://localhost/api/article/123/id/show'),
      url: new URL('http://localhost/api/article/123/id/show'),
      params: { model, identity: '123/id' },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(200);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), { article_id: '123', language: 'id' });
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

  it('coerces DateTime write fields from date inputs before calling prisma', async () => {
    const prismaCreate = vi.fn(async () => ({
      id: 'a',
      created_at: new Date('2026-05-19T00:00:00.000Z'),
    }));
    const response = await createModelCreateHandler(createConfig(
      {
        _runtimeDataModel: {
          models: {
            article: {
              fields: [
                { name: 'id', type: 'String' },
                { name: 'created_at', type: 'DateTime' },
                { name: 'categories', type: 'ArticleCategory' },
              ],
            },
          },
        },
        article: { create: prismaCreate },
      },
      {
        ...baseModelConfig,
        types: {
          categories: {
            type: 'multi',
            params: { by: 'id' },
          },
        },
        create: { allow: true, fields: ['categories', 'created_at'] },
      },
    ))({
      request: new Request('http://localhost/api/article/create', {
        method: 'POST',
        body: JSON.stringify({
          categories: [
            { id: 'cmpc7o07y0009s685v5g3fuxt', name: 'Promosi' },
            { id: 'cmpc7nzvf0003s685zwz1uhdr', name: 'Publikasi' },
          ],
          created_at: '2026-05-19',
        }),
      }),
      params: { model },
      locals: createLocals(),
    } as any);

    expect(response.status).toBe(201);
    expect(prismaCreate).toHaveBeenCalledWith({
      data: {
        categories: {
          connect: [
            { id: 'cmpc7o07y0009s685v5g3fuxt' },
            { id: 'cmpc7nzvf0003s685zwz1uhdr' },
          ],
        },
        created_at: '2026-05-19T00:00:00.000Z',
      },
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
