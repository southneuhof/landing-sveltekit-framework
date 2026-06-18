import { exception, successData } from '../utils/response.js';

export type FormSubmissionField = {
  id: string;
  code: string;
  label: string;
  type: string;
  order: number;
  required: boolean;
  validation_type_code: string | null;
};

export function validateFieldByType(value: unknown, type: string): boolean {
  if (!value) return true;
  const asString = String(value);

  const patterns: Record<string, RegExp | ((val: string) => boolean)> = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\d\s\-+()]+$/,
    number: /^\d+$/,
    url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
    date: (val: string) => !Number.isNaN(Date.parse(val)),
  };

  const validator = patterns[type];
  if (!validator) return true;
  return typeof validator === 'function' ? validator(asString) : validator.test(asString);
}

export function createFormTemplateHandler(config: {
  findFields: (formTypeId: string) => Promise<Array<Record<string, unknown>>>;
}) {
  return async function template(searchParams: URLSearchParams) {
    const formTypeId = searchParams.get('form_type_id');
    if (!formTypeId) return exception('form_type_id is required');

    const fields = await config.findFields(formTypeId);
    return successData({
      form_type_id: formTypeId,
      data: fields.map((item) => ({ ...item, form_type_id: undefined, value: null })),
    }, 201);
  };
}

export function createFormSubmissionHandler(config: {
  findFormTypeWithFields: (formTypeId: string) => Promise<{ fields: FormSubmissionField[] } | null>;
  saveSubmission: (payload: { form_type_id: string; data: Record<string, unknown> }) => Promise<unknown>;
  requiredMessage: (field: FormSubmissionField) => string;
  invalidFormatMessage: (field: FormSubmissionField) => string;
  validateField?: (value: unknown, validationTypeCode: string) => boolean;
}) {
  const validateField = config.validateField ?? validateFieldByType;

  return async function submit(body: any) {
    const formType = await config.findFormTypeWithFields(body.form_type_id);
    if (!formType) return exception('Form type not found');

    if (body.data.length !== formType.fields.length) {
      return exception('Invalid form structure: field count mismatch');
    }

    const submissionData: Record<string, unknown> = {};
    const validationErrors: Record<string, string> = {};

    for (let i = 0; i < formType.fields.length; i++) {
      const expectedField = formType.fields[i];
      const submittedField = body.data[i];

      if (
        expectedField.id !== submittedField.id ||
        expectedField.type !== submittedField.type ||
        expectedField.order !== submittedField.order
      ) {
        return exception(`Invalid form structure: field mismatch at position ${i + 1}`);
      }

      if (expectedField.required && !submittedField.value) {
        validationErrors[expectedField.code] = config.requiredMessage(expectedField);
      }

      if (expectedField.validation_type_code && submittedField.value) {
        const isValid = validateField(submittedField.value, expectedField.validation_type_code);
        if (!isValid) {
          validationErrors[expectedField.code] = config.invalidFormatMessage(expectedField);
        }
      }

      submissionData[expectedField.id] = submittedField.value;
    }

    if (Object.keys(validationErrors).length > 0) {
      return new Response(JSON.stringify({ message: 'Validation failed', error: validationErrors }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const submission = await config.saveSubmission({
      form_type_id: body.form_type_id,
      data: submissionData,
    });

    return successData({ data: submission }, 201);
  };
}
