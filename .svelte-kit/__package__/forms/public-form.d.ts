export type FormSubmissionField = {
    id: string;
    code: string;
    label: string;
    type: string;
    order: number;
    required: boolean;
    validation_type_code: string | null;
};
export declare function validateFieldByType(value: unknown, type: string): boolean;
export declare function createFormTemplateHandler(config: {
    findFields: (formTypeId: string) => Promise<Array<Record<string, unknown>>>;
}): (searchParams: URLSearchParams) => Promise<Response>;
export declare function createFormSubmissionHandler(config: {
    findFormTypeWithFields: (formTypeId: string) => Promise<{
        fields: FormSubmissionField[];
    } | null>;
    saveSubmission: (payload: {
        form_type_id: string;
        data: Record<string, unknown>;
    }) => Promise<unknown>;
    requiredMessage: (field: FormSubmissionField) => string;
    invalidFormatMessage: (field: FormSubmissionField) => string;
    validateField?: (value: unknown, validationTypeCode: string) => boolean;
}): (body: any) => Promise<Response>;
//# sourceMappingURL=public-form.d.ts.map