export declare function success<TData>(data: TData, init?: ResponseInit & {
    meta?: Record<string, unknown>;
}): Response;
export declare function successData<TData>(data: TData, status?: number): Response;
export declare function exception(error: unknown, status?: number): Response;
export declare function exceptionData(error: unknown, status?: number): Response;
//# sourceMappingURL=response.d.ts.map