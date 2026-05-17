import { type Handle } from '@sveltejs/kit';
import type { AnyRecord, CrudOperation, ModelConfig } from '../types/index.js';
export declare const corsHeaders: {
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
};
export declare function addCorsHeaders(response: Response, request: Request, isTrustedOrigin?: (origin: string | null) => boolean): Response;
export declare function handleCorsPreflightRequest(request: Request, isTrustedOrigin?: (origin: string | null) => boolean): Response;
export { parseTrustedOrigins, createTrustedOriginChecker } from "../utils/trusted-origins.js";
export declare function isProtectedRoute(pathname: string): boolean;
export declare function requireAuthenticatedUser(locals: AnyRecord): unknown;
export declare function hasPermission(locals: AnyRecord, permission?: string): boolean;
export declare function requirePermission(locals: AnyRecord, permission?: string): void;
export declare function getDefaultPermissionCode(model: string, operation: CrudOperation): string;
export declare function resolvePermissionCode(model: string, operation: CrudOperation, explicitPermission?: string): string | undefined;
export declare function authorizeOperation<T>(event: any, model: string, operation: CrudOperation, config?: Pick<ModelConfig<T>, 'permission' | 'authorize'>, input?: AnyRecord): Promise<void>;
export declare function createFrameworkHandle(config: {
    hydrateRequestAuth?: (event: any) => Promise<void>;
    isProtectedRoute?: (pathname: string) => boolean;
    isTrustedOrigin?: (origin: string | null) => boolean;
}): Handle;
//# sourceMappingURL=index.d.ts.map