import { describe, expect, it, vi } from 'vitest';
import { parseSearchParams, parseSlug, transformFieldsForeign, validateFields } from '../common.js';
describe('parseSearchParams', () => {
    it('throws for non-URLSearchParams inputs', () => {
        expect(() => parseSearchParams('page=1')).toThrowError(new TypeError('parseSearchParams expects URLSearchParams'));
        expect(() => parseSearchParams(null)).toThrowError(new TypeError('parseSearchParams expects URLSearchParams'));
        expect(() => parseSearchParams(undefined)).toThrowError(new TypeError('parseSearchParams expects URLSearchParams'));
    });
    it('returns empty object for empty URLSearchParams', () => {
        expect(parseSearchParams(new URLSearchParams())).toEqual({});
    });
    it('parses and casts normal values', () => {
        expect(parseSearchParams(new URLSearchParams('page=2&search=hello'))).toEqual({
            page: 2,
            search: 'hello',
        });
    });
    it('casts booleans case-insensitively', () => {
        expect(parseSearchParams(new URLSearchParams('active=true&archived=FALSE'))).toEqual({
            active: true,
            archived: false,
        });
    });
    it('casts JSON object and array', () => {
        expect(parseSearchParams(new URLSearchParams('filter={"a":1}&ids=[1,2]'))).toEqual({
            filter: { a: 1 },
            ids: [1, 2],
        });
    });
    it('keeps JSON primitives as strings', () => {
        expect(parseSearchParams(new URLSearchParams('value="hello"&countJson=1'))).toEqual({
            value: '"hello"',
            countJson: 1,
        });
    });
    it('repeated keys become arrays', () => {
        expect(parseSearchParams(new URLSearchParams('category=a&category=b&category=3'))).toEqual({
            category: ['a', 'b', 3],
        });
    });
    it('keeps empty values as empty strings', () => {
        expect(parseSearchParams(new URLSearchParams('search='))).toEqual({
            search: '',
        });
    });
});
describe('validateFields', () => {
    it('passes with canonical validator array', async () => {
        await expect(validateFields({ name: 'Ada' }, {
            name: [{ validator: (value) => typeof value === 'string' && value.length > 0 }],
        })).resolves.toBeUndefined();
    });
    it('fails with custom message when validator returns false', async () => {
        await expect(validateFields({ name: '' }, {
            name: [{ validator: () => false, message: 'Name is required' }],
        })).rejects.toThrowError(new Error('Name is required'));
    });
    it('fails with returned string when validator returns string', async () => {
        await expect(validateFields({ age: 10 }, {
            age: [{ validator: () => 'Age must be at least 18', message: 'ignored' }],
        })).rejects.toThrowError(new Error('Age must be at least 18'));
    });
    it('awaits async validators', async () => {
        await expect(validateFields({ email: 'x@example.com' }, {
            email: [{ validator: async () => true }],
        })).resolves.toBeUndefined();
    });
    it('passes full body as second argument', async () => {
        const validator = vi.fn((value, body) => {
            return value === 'admin' && body.active === true;
        });
        await expect(validateFields({ role: 'admin', active: true }, {
            role: [{ validator }],
        })).resolves.toBeUndefined();
        expect(validator).toHaveBeenCalledWith('admin', { role: 'admin', active: true });
    });
    it('stops at first failing validator', async () => {
        const second = vi.fn(() => true);
        await expect(validateFields({ name: '' }, {
            name: [
                { validator: () => false, message: 'First failure' },
                { validator: second },
            ],
        })).rejects.toThrowError(new Error('First failure'));
        expect(second).not.toHaveBeenCalled();
    });
    it('throws TypeError for legacy required shorthand', async () => {
        await expect(validateFields({ name: '' }, { name: { required: true } })).rejects.toThrowError(new TypeError('Validation rules for "name" must be an array'));
    });
    it('throws TypeError for bare function validator', async () => {
        await expect(validateFields({ name: 'Ada' }, { name: (() => true) })).rejects.toThrowError(new TypeError('Validation rules for "name" must be an array'));
    });
    it('throws TypeError for rule object without validator', async () => {
        await expect(validateFields({ name: '' }, { name: [{ message: 'Name is required' }] })).rejects.toThrowError(new TypeError('Validation rule for "name" must define a validator'));
    });
});
describe('transformFieldsForeign', () => {
    it('converts canonical simple relation config', () => {
        expect(transformFieldsForeign({ role: { fields: ['id', 'name'] } })).toEqual({
            role: {
                select: {
                    id: true,
                    name: true,
                },
            },
        });
    });
    it('converts canonical nested relation config', () => {
        expect(transformFieldsForeign({
            categories: {
                fields: ['id'],
                fieldsForeign: {
                    translations: {
                        fields: ['name', 'language'],
                    },
                },
            },
        })).toEqual({
            categories: {
                select: {
                    id: true,
                    translations: {
                        select: {
                            name: true,
                            language: true,
                        },
                    },
                },
            },
        });
    });
    it('converts two-level nested relation config', () => {
        expect(transformFieldsForeign({
            author: {
                fields: ['id'],
                fieldsForeign: {
                    profile: {
                        fields: ['bio'],
                        fieldsForeign: {
                            avatar: {
                                fields: ['url'],
                            },
                        },
                    },
                },
            },
        })).toEqual({
            author: {
                select: {
                    id: true,
                    profile: {
                        select: {
                            bio: true,
                            avatar: {
                                select: {
                                    url: true,
                                },
                            },
                        },
                    },
                },
            },
        });
    });
    it('throws for array shorthand', () => {
        expect(() => transformFieldsForeign({ role: ['id', 'name'] })).toThrowError(new TypeError('Invalid fieldsForeign config for "role"'));
    });
    it('throws for raw Prisma passthrough', () => {
        expect(() => transformFieldsForeign({ role: { select: { id: true } } })).toThrowError(new TypeError('Invalid fieldsForeign config for "role"'));
    });
    it('throws for empty relation config', () => {
        expect(() => transformFieldsForeign({ role: {} })).toThrowError(new TypeError('Invalid fieldsForeign config for "role"'));
    });
    it('throws for non-array fields', () => {
        expect(() => transformFieldsForeign({ role: { fields: 'id' } })).toThrowError(new TypeError('Invalid fieldsForeign config for "role"'));
    });
    it('throws for unknown keys', () => {
        expect(() => transformFieldsForeign({ role: { fields: ['id'], include: {} } })).toThrowError(new TypeError('Invalid fieldsForeign config for "role"'));
    });
});
describe('parseSlug', () => {
    it('normalizes text as slug', () => {
        expect(parseSlug('  Héllo, World!  ')).toBe('hello-world');
    });
});
