import { describe, expect, it } from 'vitest';
import { getDefaultPermissionCode, hasPermission } from '../index.js';
describe('authorization helpers', () => {
    it('resolves default permission codes', () => {
        expect(getDefaultPermissionCode('page', 'list')).toBe('view-page');
        expect(getDefaultPermissionCode('page', 'create')).toBe('create-page');
        expect(getDefaultPermissionCode('page', 'reorder')).toBe('update-page');
    });
    it('allows privileged users', () => {
        expect(hasPermission({ isPrivilegedRole: true }, 'delete-page')).toBe(true);
    });
});
