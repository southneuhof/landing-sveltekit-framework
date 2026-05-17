import { json, type Handle } from '@sveltejs/kit';
import type { AnyRecord, CrudOperation, ModelConfig } from '../types/index.js';
import { exception } from '../utils/response.js';

export const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function addCorsHeaders(response: Response, request: Request, isTrustedOrigin?: (origin: string | null) => boolean): Response {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Max-Age', '86400');

  const requestedHeaders = request.headers.get('access-control-request-headers');
  if (requestedHeaders) response.headers.set('Access-Control-Allow-Headers', requestedHeaders);

  const origin = request.headers.get('origin');
  if (origin && (!isTrustedOrigin || isTrustedOrigin(origin))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

export function handleCorsPreflightRequest(request: Request, isTrustedOrigin?: (origin: string | null) => boolean): Response {
  return addCorsHeaders(new Response(null, { status: 204 }), request, isTrustedOrigin);
}

export { parseTrustedOrigins, createTrustedOriginChecker } from "../utils/trusted-origins.js";

export function isProtectedRoute(pathname: string): boolean {
  const publicPaths = ['/api/public', '/api/auth'];
  return !publicPaths.some((path) => pathname.startsWith(path));
}

export function requireAuthenticatedUser(locals: AnyRecord): unknown {
  if (!locals.user) {
    throw exception('Unauthorized', 401);
  }

  return locals.user;
}

export function hasPermission(locals: AnyRecord, permission?: string): boolean {
  if (!permission) return true;
  if (locals.isPrivilegedRole) return true;
  return Boolean(locals.user?.role?.permissions?.some((item: AnyRecord) => item.code === permission));
}

export function requirePermission(locals: AnyRecord, permission?: string) {
  requireAuthenticatedUser(locals);

  if (!hasPermission(locals, permission)) {
    throw exception('Forbidden', 403);
  }
}

export function getDefaultPermissionCode(model: string, operation: CrudOperation) {
  const operationPrefixMap = {
    list: 'view',
    detail: 'detail',
    create: 'create',
    update: 'update',
    delete: 'delete',
    reorder: 'update',
    verify: 'verify',
  } as const;

  return `${operationPrefixMap[operation]}-${model}`;
}

export function resolvePermissionCode(model: string, operation: CrudOperation, explicitPermission?: string): string | undefined {
  return explicitPermission ?? getDefaultPermissionCode(model, operation);
}

export async function authorizeOperation<T>(
  event: any,
  model: string,
  operation: CrudOperation,
  config?: Pick<ModelConfig<T>, 'permission' | 'authorize'>,
  input: AnyRecord = {},
) {
  requirePermission(event.locals, resolvePermissionCode(model, operation, config?.permission));

  if (config?.authorize) {
    await config.authorize(event, input);
  }
}

export function createFrameworkHandle(config: {
  hydrateRequestAuth?: (event: any) => Promise<void>;
  isProtectedRoute?: (pathname: string) => boolean;
  isTrustedOrigin?: (origin: string | null) => boolean;
}): Handle {
  const protectedRoute = config.isProtectedRoute ?? isProtectedRoute;

  return async ({ event, resolve }) => {
    if (event.url.pathname.startsWith('/api') && event.request.method === 'OPTIONS') {
      return handleCorsPreflightRequest(event.request, config.isTrustedOrigin);
    }

    if (config.hydrateRequestAuth) {
      await config.hydrateRequestAuth(event);
    }

    if (event.url.pathname.startsWith('/api') && protectedRoute(event.url.pathname)) {
      try {
        requireAuthenticatedUser(event.locals);
      } catch {
        return addCorsHeaders(json({ message: 'Forbidden' }, { status: 401 }), event.request, config.isTrustedOrigin);
      }
    }

    return addCorsHeaders(await resolve(event), event.request, config.isTrustedOrigin);
  };
}
