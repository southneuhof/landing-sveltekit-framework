import { authorizeOperation as defaultAuthorizeOperation } from '../auth/index.js';
import type { ModelConfigRegistry } from '../types/index.js';
import type { FileManager } from '../files/index.js';
export type HandlerConfig = {
    prisma: any;
    modelConfigs: ModelConfigRegistry;
    authorizeOperation?: typeof defaultAuthorizeOperation;
    files?: FileManager;
};
export type ModelApiDependencies = {
    data: {
        prisma: any;
        models: ModelConfigRegistry;
    };
    auth?: {
        authorizeOperation?: typeof defaultAuthorizeOperation;
    };
    files?: FileManager;
};
export declare function createModelApi(dependencies: ModelApiDependencies): {
    list: (event: any) => Promise<Response>;
    detail: (event: any) => Promise<Response>;
    create: (event: any) => Promise<Response>;
    update: (event: any) => Promise<Response>;
    delete: (event: any) => Promise<Response>;
    reorder: (event: any) => Promise<Response>;
    verify: (event: any) => Promise<Response>;
};
export declare function createCrudHandlers(config: HandlerConfig): {
    list: (event: any) => Promise<Response>;
    detail: (event: any) => Promise<Response>;
    create: (event: any) => Promise<Response>;
    update: (event: any) => Promise<Response>;
    delete: (event: any) => Promise<Response>;
    reorder: (event: any) => Promise<Response>;
    verify: (event: any) => Promise<Response>;
};
export declare function createModelListHandler(config: HandlerConfig): (event: any) => Promise<Response>;
export declare function createModelDetailHandler(config: HandlerConfig): (event: any) => Promise<Response>;
export declare function createModelCreateHandler(config: HandlerConfig): (event: any) => Promise<Response>;
export declare function createModelUpdateHandler(config: HandlerConfig): (event: any) => Promise<Response>;
export declare function createModelDeleteHandler(config: HandlerConfig): (event: any) => Promise<Response>;
export declare function createModelReorderHandler(config: HandlerConfig): (event: any) => Promise<Response>;
export declare function createModelVerifyHandler(config: HandlerConfig): (event: any) => Promise<Response>;
export declare const createModelAPI: typeof createModelApi;
//# sourceMappingURL=index.d.ts.map