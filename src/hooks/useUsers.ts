/**
 * useUsers Hook
 * API hook for user management within organization
 * 
 * Part of: GAP-09 User Management
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'DISABLED';

export interface OrgUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    avatarUrl?: string;
    invitedAt?: string;
    joinedAt?: string;
    lastActiveAt?: string;
}

export interface InviteUserDto {
    email: string;
    role: UserRole;
    name?: string;
}

interface UseUsersReturn {
    users: OrgUser[];
    isLoading: boolean;
    error: Error | null;
    getUsers: () => Promise<void>;
    inviteUser: (dto: InviteUserDto) => Promise<OrgUser>;
    updateRole: (userId: string, role: UserRole) => Promise<OrgUser>;
    removeUser: (userId: string) => Promise<void>;
    resendInvite: (userId: string) => Promise<void>;
    disableUser: (userId: string) => Promise<void>;
    enableUser: (userId: string) => Promise<void>;
}

const API_BASE = '/api/v1/users';

// ============================================================
// ROLE LABELS
// ============================================================

export const ROLE_LABELS: Record<UserRole, string> = {
    OWNER: 'المالك',
    ADMIN: 'مسؤول',
    MANAGER: 'مدير',
    STAFF: 'موظف',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    OWNER: 'صلاحيات كاملة، لا يمكن تغييره',
    ADMIN: 'إدارة المستخدمين والإعدادات',
    MANAGER: 'إدارة المخزون والطلبات',
    STAFF: 'عرض فقط',
};

// ============================================================
// HOOK
// ============================================================

export function useUsers(): UseUsersReturn {
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const getUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(API_BASE);
            if (!response.ok) throw new Error('فشل تحميل المستخدمين');
            const data = await response.json();
            setUsers(data.data || data);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const inviteUser = useCallback(async (dto: InviteUserDto): Promise<OrgUser> => {
        const response = await fetch(`${API_BASE}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إرسال الدعوة');
        }

        const user = await response.json();
        setUsers(prev => [...prev, user]);
        return user;
    }, []);

    const updateRole = useCallback(async (userId: string, role: UserRole): Promise<OrgUser> => {
        const response = await fetch(`${API_BASE}/${userId}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        });

        if (!response.ok) throw new Error('فشل تحديث الدور');

        const user = await response.json();
        setUsers(prev => prev.map(u => u.id === userId ? user : u));
        return user;
    }, []);

    const removeUser = useCallback(async (userId: string) => {
        const response = await fetch(`${API_BASE}/${userId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('فشل إزالة المستخدم');
        setUsers(prev => prev.filter(u => u.id !== userId));
    }, []);

    const resendInvite = useCallback(async (userId: string) => {
        const response = await fetch(`${API_BASE}/${userId}/resend-invite`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل إعادة إرسال الدعوة');
    }, []);

    const disableUser = useCallback(async (userId: string) => {
        const response = await fetch(`${API_BASE}/${userId}/disable`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل تعطيل المستخدم');
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'DISABLED' as UserStatus } : u));
    }, []);

    const enableUser = useCallback(async (userId: string) => {
        const response = await fetch(`${API_BASE}/${userId}/enable`, { method: 'POST' });
        if (!response.ok) throw new Error('فشل تفعيل المستخدم');
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'ACTIVE' as UserStatus } : u));
    }, []);

    return {
        users,
        isLoading,
        error,
        getUsers,
        inviteUser,
        updateRole,
        removeUser,
        resendInvite,
        disableUser,
        enableUser,
    };
}
