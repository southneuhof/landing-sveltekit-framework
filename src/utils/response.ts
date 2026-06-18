import type { FrameworkErrorLike, FrameworkErrorResponse, FrameworkSuccessResponse } from '../types/index.js';

function getMessage(error: unknown): string {
  const objectMessage = (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) ? (error as { message: string }).message : undefined;

  return error instanceof Error
    ? error.message
    : objectMessage ?? String(error);
}

export function success<TData>(
  data: TData,
  init?: ResponseInit & {
    meta?: Record<string, unknown>;
  },
): Response {
  const body: FrameworkSuccessResponse<TData> = {
    ok: true,
    data,
    ...(init?.meta ? { meta: init.meta } : {}),
  };

  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
}

export function successData<TData>(data: TData, status = 201): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function exception(error: unknown, status?: number): Response {
  if (error instanceof Response) return error;

  const frameworkError = error as FrameworkErrorLike;
  const resolvedStatus = status
    ?? (typeof frameworkError?.status === 'number' ? frameworkError.status : undefined)
    ?? (typeof frameworkError?.statusCode === 'number' ? frameworkError.statusCode : undefined)
    ?? 400;
  const code = typeof frameworkError?.code === 'string' ? frameworkError.code : undefined;
  const details = frameworkError?.details;

  const body: FrameworkErrorResponse = {
    ok: false,
    error: {
      message: getMessage(error),
      ...(code ? { code } : {}),
      ...(details !== undefined ? { details } : {}),
    },
  };

  return new Response(JSON.stringify(body), {
    status: resolvedStatus,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export function exceptionData(error: unknown, status = 500): Response {
  if (error instanceof Response) return error;
  return new Response(JSON.stringify({ message: getMessage(error) }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
