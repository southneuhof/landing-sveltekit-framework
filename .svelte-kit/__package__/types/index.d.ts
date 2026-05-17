import type { Component } from 'svelte';
export type AnyRecord = Record<string, any>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
    ref?: U | null;
};
export type LandingSection = AnyRecord & {
    id: string;
    visible?: boolean;
    section_type_code?: string | null;
    data?: unknown;
};
export type SectionSchemaSlotType = 'content' | 'gallery' | 'section' | 'sectionGroup';
export type SectionSchemaSlot = {
    type: SectionSchemaSlotType;
    order: number;
    many?: boolean;
};
export type SectionSchema = {
    code: string;
    info?: {
        name?: string;
        description?: string;
    };
    data: Record<string, SectionSchemaSlot>;
};
export type SectionSchemaRegistry = Record<string, SectionSchema>;
export type SectionDataLoader<TSection extends LandingSection = LandingSection> = (section: TSection, context?: AnyRecord) => Promise<unknown>;
export type SectionLoaderRegistry<TSection extends LandingSection = LandingSection> = Record<string, SectionDataLoader<TSection>>;
export type SectionComponentModule = {
    default: Component<any>;
};
export type SectionComponentRegistry = Record<string, () => Promise<SectionComponentModule>>;
export type CrudOperation = 'list' | 'detail' | 'create' | 'update' | 'delete' | 'reorder' | 'verify';
export type PaginationOptions = {
    page?: number;
    limit?: number;
};
export type PaginationLoaderResult<T> = {
    data: T[];
    total: number;
};
export type ReorderEntriesOptions = {
    prisma: any;
    model: string;
    id: string | number;
    from: number;
    to: number;
    axis: string[];
    orderField?: string;
};
export type ReorderPayload = {
    id: string | number;
    from: number;
    to: number;
};
export type PaginatedResponse<T> = {
    data: T[];
    meta: {
        totalRecords: number;
        totalPages: number;
        currentPage: number;
        limit: number;
    };
};
export type FrameworkSuccessResponse<TData = unknown, TMeta = Record<string, unknown>> = {
    ok: true;
    data: TData;
    meta?: TMeta;
};
export type FrameworkErrorResponse = {
    ok: false;
    error: {
        message: string;
        code?: string;
        details?: unknown;
    };
};
export type FrameworkErrorLike = Error & {
    status?: number;
    statusCode?: number;
    code?: string;
    details?: unknown;
};
export type OperationLifecycle = {
    pre?: (...args: any[]) => any | Promise<any>;
    main?: (...args: any[]) => any | Promise<any>;
    post?: (...args: any[]) => any | Promise<any>;
};
export type FieldValidator = (value: any, body: AnyRecord) => boolean | string | Promise<boolean | string>;
export type FieldValidationRule = {
    validator: FieldValidator;
    message?: string;
};
export type FieldValidationConfig = Record<string, FieldValidationRule[]>;
export type RelationSelectConfig = {
    fields?: string[];
    fieldsForeign?: FieldsForeignConfig;
};
export type FieldsForeignConfig = Record<string, RelationSelectConfig>;
export type BaseOperationConfig<T = AnyRecord> = {
    allow?: boolean;
    permission?: string;
    authorize?: (event: any, input: AnyRecord) => void | Promise<void>;
    fields?: string[];
    fieldsForeign?: FieldsForeignConfig;
    by?: string[];
    where?: (event: any) => AnyRecord | Promise<AnyRecord> | undefined;
    validation?: FieldValidationConfig;
    lifecycle?: OperationLifecycle;
};
export type ModelConfig<T = AnyRecord> = BaseOperationConfig<T> & {
    types?: AnyRecord;
    view?: {
        fieldsForeign?: FieldsForeignConfig;
        customFields?: Array<{
            name: string;
            generator: (data: AnyRecord) => unknown;
        }>;
    };
    transaction?: {
        lifecycle?: OperationLifecycle;
    };
    list?: BaseOperationConfig<T> & {
        filterableBy?: string[];
        searchableBy?: string[];
        orderBy?: AnyRecord;
        customFields?: Array<{
            name: string;
            generator: (data: AnyRecord) => unknown;
        }>;
    };
    detail?: BaseOperationConfig<T> & {
        customFields?: Array<{
            name: string;
            generator: (data: AnyRecord) => unknown;
        }>;
    };
    create?: BaseOperationConfig<T>;
    update?: BaseOperationConfig<T>;
    delete?: BaseOperationConfig<T>;
    reorder?: BaseOperationConfig<T> & {
        axis: string[];
    };
    verify?: Omit<BaseOperationConfig<T>, 'by'> & {
        by?: string;
        stateField?: string;
        initialState?: string;
        states?: string[];
        transitions?: Record<string, {
            from: string | string[];
            to: string;
        }>;
    };
};
export type ModelConfigRegistry = Record<string, ModelConfig | (() => Promise<any>)>;
export type LandingFrameworkConfig = {
    prisma: any;
    getLocale: () => string;
    modelConfigs?: ModelConfigRegistry;
    sectionSchemas?: SectionSchemaRegistry;
    auth?: {
        hydrateRequestAuth?: (event: any) => Promise<void>;
        requireAuthenticatedUser?: (locals: any) => unknown;
        isProtectedRoute?: (pathname: string) => boolean;
    };
    storage?: {
        root: string;
        publicBaseUrl?: string;
    };
};
//# sourceMappingURL=index.d.ts.map