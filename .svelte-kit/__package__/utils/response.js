function getMessage(error) {
    const objectMessage = (error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string') ? error.message : undefined;
    return error instanceof Error
        ? error.message
        : objectMessage ?? String(error);
}
export function success(data, init) {
    const body = {
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
export function successData(data, status = 201) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}
export function exception(error, status) {
    if (error instanceof Response)
        return error;
    const frameworkError = error;
    const resolvedStatus = status
        ?? (typeof frameworkError?.status === 'number' ? frameworkError.status : undefined)
        ?? (typeof frameworkError?.statusCode === 'number' ? frameworkError.statusCode : undefined)
        ?? 400;
    const code = typeof frameworkError?.code === 'string' ? frameworkError.code : undefined;
    const details = frameworkError?.details;
    const body = {
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
export function exceptionData(error, status = 500) {
    if (error instanceof Response)
        return error;
    return new Response(JSON.stringify({ message: getMessage(error) }), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}
