/**
 * User List Component
 * Organization user management UI
 * 
 * Part of: GAP-09 User Management
 */

import { useEffect, useState } from 'react';
import {
    Users,
    Plus,
    MoreHorizontal,
    Mail,
    Trash2,
    Shield,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../UI/card';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { Avatar, AvatarFallback } from '../../UI/avatar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../UI/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '../../UI/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../UI/dialog';
import { Input } from '../../UI/input';
import { Label } from '../../UI/label';
import { useUsers, OrgUser, UserRole, UserStatus, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../../hooks/useUsers';

// ============================================================
// STATUS CONFIG
// ============================================================

const STATUS_CONFIG: Record<UserStatus, { label: string; icon: any; color: string }> = {
    ACTIVE: { label: 'نشط', icon: CheckCircle2, color: 'text-green-600' },
    PENDING: { label: 'قيد الانتظار', icon: Clock, color: 'text-yellow-600' },
    DISABLED: { label: 'معطل', icon: XCircle, color: 'text-gray-600' },
};

// ============================================================
// INVITE MODAL
// ============================================================

function InviteUserModal({
    open,
    onOpenChange,
    onInvite,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInvite: (email: string, role: UserRole) => Promise<void>;
}) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('STAFF');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!email || !email.includes('@')) {
            setError('يرجى إدخال بريد إلكتروني صحيح');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onInvite(email, role);
            setEmail('');
            setRole('STAFF');
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل إرسال الدعوة');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        دعوة مستخدم جديد
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="email">البريد الإلكتروني</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            dir="ltr"
                        />
                    </div>

                    <div>
                        <Label>الدور</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(['ADMIN', 'MANAGER', 'STAFF'] as UserRole[]).map((r) => (
                                    <SelectItem key={r} value={r}>
                                        <div>
                                            <p className="font-medium">{ROLE_LABELS[r]}</p>
                                            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                        إرسال الدعوة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================
// USER LIST
// ============================================================

export function UserList() {
    const {
        users,
        isLoading,
        getUsers,
        inviteUser,
        updateRole,
        removeUser,
        resendInvite,
    } = useUsers();

    const [showInviteModal, setShowInviteModal] = useState(false);

    useEffect(() => {
        getUsers();
    }, [getUsers]);

    const handleInvite = async (email: string, role: UserRole) => {
        await inviteUser({ email, role });
    };

    const handleRoleChange = async (userId: string, role: UserRole) => {
        try {
            await updateRole(userId, role);
        } catch (err) {
            console.error('Failed to update role:', err);
        }
    };

    const handleRemove = async (user: OrgUser) => {
        if (user.role === 'OWNER') return;
        if (confirm(`هل تريد إزالة ${user.name || user.email}؟`)) {
            try {
                await removeUser(user.id);
            } catch (err) {
                console.error('Failed to remove user:', err);
            }
        }
    };

    const handleResendInvite = async (userId: string) => {
        try {
            await resendInvite(userId);
        } catch (err) {
            console.error('Failed to resend invite:', err);
        }
    };

    return (
        <>
            <Card dir="rtl">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            المستخدمين
                        </CardTitle>
                        <Button onClick={() => setShowInviteModal(true)} size="sm" className="gap-1">
                            <Plus className="w-4 h-4" />
                            دعوة مستخدم
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-4" />
                            <p>لا يوجد مستخدمين</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {users.map((user) => {
                                const statusConfig = STATUS_CONFIG[user.status];
                                const StatusIcon = statusConfig.icon;
                                const isOwner = user.role === 'OWNER';

                                return (
                                    <div key={user.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>
                                                    {user.name ? user.name.charAt(0) : user.email.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">
                                                    {user.name || user.email}
                                                    {isOwner && <Badge className="mr-2 text-xs">المالك</Badge>}
                                                </p>
                                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Status Badge */}
                                            <Badge variant="secondary" className={`gap-1 ${statusConfig.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {statusConfig.label}
                                            </Badge>

                                            {/* Role Select */}
                                            {!isOwner && (
                                                <Select
                                                    value={user.role}
                                                    onValueChange={(v) => handleRoleChange(user.id, v as UserRole)}
                                                >
                                                    <SelectTrigger className="w-28">
                                                        <Shield className="w-3 h-3 ml-1" />
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(['ADMIN', 'MANAGER', 'STAFF'] as UserRole[]).map((r) => (
                                                            <SelectItem key={r} value={r}>
                                                                {ROLE_LABELS[r]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}

                                            {/* Actions */}
                                            {!isOwner && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" dir="rtl">
                                                        {user.status === 'PENDING' && (
                                                            <DropdownMenuItem onClick={() => handleResendInvite(user.id)}>
                                                                <Send className="w-4 h-4 ml-2" />
                                                                إعادة إرسال الدعوة
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleRemove(user)}
                                                            className="text-red-600"
                                                        >
                                                            <Trash2 className="w-4 h-4 ml-2" />
                                                            إزالة
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <InviteUserModal
                open={showInviteModal}
                onOpenChange={setShowInviteModal}
                onInvite={handleInvite}
            />
        </>
    );
}
