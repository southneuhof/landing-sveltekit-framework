import { describe, expect, it } from 'vitest';

import { exception, success } from '../response.js';

describe('response helpers canonical contract', () => {
  it('success wraps data', async () => {
    const response = success({ id: 'a' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: { id: 'a' },
    });
    expect(body).not.toHaveProperty('success');
    expect(body).not.toHaveProperty('id');
  });

  it('success supports meta', async () => {
    const response = success([{ id: 'a' }], {
      meta: { totalRecords: 1 },
    });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: [{ id: 'a' }],
      meta: { totalRecords: 1 },
    });
  });

  it('success supports custom status', () => {
    const response = success({ id: 'a' }, { status: 201 });
    expect(response.status).toBe(201);
  });

  it('success supports custom headers and keeps json content-type', () => {
    const response = success({ id: 'a' }, {
      headers: { 'x-test': '1' },
    });

    expect(response.headers.get('x-test')).toBe('1');
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('exception wraps error', async () => {
    const response = exception(new Error('Failed'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        message: 'Failed',
      },
    });
  });

  it('exception uses explicit status', () => {
    const response = exception(new Error('Nope'), 422);
    expect(response.status).toBe(422);
  });

  it('exception uses error status and code', async () => {
    const err = Object.assign(new Error('Forbidden'), {
      status: 403,
      code: 'FORBIDDEN',
    });

    const response = exception(err);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        message: 'Forbidden',
        code: 'FORBIDDEN',
      },
    });
  });

  it('exception includes details', async () => {
    const err = {
      message: 'Invalid payload',
      details: { field: 'name' },
    };

    const response = exception(err);

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        message: 'Invalid payload',
        details: { field: 'name' },
      },
    });
  });

  it('exception returns existing response unchanged', () => {
    const original = new Response('custom', { status: 418 });
    const response = exception(original);

    expect(response).toBe(original);
    expect(response.status).toBe(418);
  });
});
