import { exception, successData } from '../utils/response.js';
export function validateFieldByType(value, type) {
    if (!value)
        return true;
    const asString = String(value);
    const patterns = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^[\d\s\-+()]+$/,
        number: /^\d+$/,
        url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
        date: (val) => !Number.isNaN(Date.parse(val)),
    };
    const validator = patterns[type];
    if (!validator)
        return true;
    return typeof validator === 'function' ? validator(asString) : validator.test(asString);
}
export function createFormTemplateHandler(config) {
    return async function template(searchParams) {
        const formTypeId = searchParams.get('form_type_id');
        if (!formTypeId)
            return exception('form_type_id is required');
        const fields = await config.findFields(formTypeId);
        return successData({
            form_type_id: formTypeId,
            data: fields.map((item) => ({ ...item, form_type_id: undefined, value: null })),
        }, 201);
    };
}
export function createFormSubmissionHandler(config) {
    const validateField = config.validateField ?? validateFieldByType;
    return async function submit(body) {
        const formType = await config.findFormTypeWithFields(body.form_type_id);
        if (!formType)
            return exception('Form type not found');
        if (body.data.length !== formType.fields.length) {
            return exception('Invalid form structure: field count mismatch');
        }
        const submissionData = {};
        const validationErrors = {};
        for (let i = 0; i < formType.fields.length; i++) {
            const expectedField = formType.fields[i];
            const submittedField = body.data[i];
            if (expectedField.id !== submittedField.id ||
                expectedField.type !== submittedField.type ||
                expectedField.order !== submittedField.order) {
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
