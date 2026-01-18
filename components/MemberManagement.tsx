import React, { useState, useEffect } from 'react';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';

// Icons
import {
    Users,
    CheckCircle,
    Download,
    UserPlus,
    Edit,
    Ban,
    Trash2
} from 'lucide-react';

interface Member {
    id: number;
    email: string;
    full_name: string;
    role: string;
    email_verified?: boolean;
    created_at?: string;
    licenses_count?: number;
}

export const MemberManagement: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', role: '', email_verified: false });
    const [editLoading, setEditLoading] = useState(false);

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingMember, setDeletingMember] = useState<Member | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        try {
            setLoading(true);
            const response = await api.admin.getUsers();
            setMembers(response.items || []);
        } catch (error) {
            console.error('Failed to load members:', error);
            // Mock data for development
            setMembers([
                { id: 1, email: 'admin@example.com', full_name: 'Admin User', role: 'admin', status: 'active', licenses_count: 5 },
                { id: 2, email: 'user1@example.com', full_name: 'John Doe', role: 'user', status: 'active', licenses_count: 2 },
                { id: 3, email: 'user2@example.com', full_name: 'Jane Smith', role: 'user', status: 'active', licenses_count: 3 },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getRoleBadge = (role: string) => {
        if (role === 'admin') {
            return <Badge variant="default" className="bg-blue-600">Admin</Badge>;
        }
        return <Badge variant="secondary">User</Badge>;
    };

    const getStatusBadge = (emailVerified?: boolean) => {
        if (emailVerified) {
            return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Active</Badge>;
        }
        return <Badge variant="outline"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Inactive</Badge>;
    };

    // Handlers
    const handleEdit = (member: Member) => {
        setEditingMember(member);
        setEditForm({
            full_name: member.full_name,
            role: member.role,
            email_verified: member.email_verified || false
        });
        setEditDialogOpen(true);
    };

    const handleEditSave = async () => {
        if (!editingMember) return;
        setEditLoading(true);
        try {
            await api.admin.updateUser(editingMember.id, editForm);
            await loadMembers();
            setEditDialogOpen(false);
        } catch (error) {
            console.error('Failed to update member:', error);
        } finally {
            setEditLoading(false);
        }
    };

    const handleToggleStatus = async (member: Member) => {
        try {
            await api.admin.updateUser(member.id, { email_verified: !member.email_verified });
            await loadMembers();
        } catch (error) {
            console.error('Failed to toggle status:', error);
        }
    };

    const handleDelete = (member: Member) => {
        setDeletingMember(member);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingMember) return;
        setDeleteLoading(true);
        try {
            await api.admin.deleteUser(deletingMember.id);
            await loadMembers();
            setDeleteDialogOpen(false);
        } catch (error) {
            console.error('Failed to delete member:', error);
        } finally {
            setDeleteLoading(false);
        }
    };

    const filteredMembers = members.filter(member => {
        const matchesRole = roleFilter === 'all' || member.role === roleFilter;
        const matchesSearch = !searchQuery ||
            member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesRole && matchesSearch;
    });

    const stats = {
        totalMembers: members.length,
        activeLicenses: members.reduce((sum, m) => sum + (m.licenses_count || 0), 0),
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Member Management</h1>
                        <p className="text-muted-foreground text-sm">Quản lý thành viên và phân quyền truy cập.</p>
                    </div>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Member
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                                <Users className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">{stats.totalMembers}</span>
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12.5%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Monthly growth</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Active Licenses</p>
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">{stats.activeLicenses}</span>
                                <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">82% Cap</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Licenses assigned to members</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Members Table */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <CardTitle className="text-lg">Danh sách thành viên</CardTitle>
                            <div className="flex items-center gap-3">
                                <Select value={roleFilter} onValueChange={setRoleFilter}>
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="All Roles" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Roles</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="user">User</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" size="sm">
                                    <Download className="w-4 h-4 mr-2" />
                                    Export
                                </Button>
                            </div>
                        </div>
                        <div className="mt-4">
                            <Input
                                placeholder="Tìm kiếm theo tên hoặc email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="max-w-md"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">Member</TableHead>
                                    <TableHead className="font-semibold">Email</TableHead>
                                    <TableHead className="font-semibold">Role</TableHead>
                                    <TableHead className="font-semibold">Licenses</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMembers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Không tìm thấy thành viên nào.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMembers.map((member) => (
                                        <TableRow key={member.id} className="group">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-semibold">
                                                            {getInitials(member.full_name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{member.full_name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {member.email}
                                            </TableCell>
                                            <TableCell>
                                                {getRoleBadge(member.role)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-medium">{member.licenses_count || 0}</span>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(member.email_verified)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(member)}>
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Chỉnh sửa</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(member)}>
                                                                <Ban className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{member.email_verified ? 'Vô hiệu hóa' : 'Kích hoạt'}</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDelete(member)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Xóa</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Chỉnh sửa thành viên</DialogTitle>
                        <DialogDescription>
                            Cập nhật thông tin cho {editingMember?.email}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Họ và tên</Label>
                            <Input
                                id="edit-name"
                                value={editForm.full_name}
                                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-role">Vai trò</Label>
                            <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label htmlFor="edit-verified">Email đã xác thực</Label>
                            <Switch
                                id="edit-verified"
                                checked={editForm.email_verified}
                                onCheckedChange={(v) => setEditForm({ ...editForm, email_verified: v })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Hủy</Button>
                        <Button onClick={handleEditSave} disabled={editLoading}>
                            {editLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn có chắc chắn muốn xóa thành viên <strong>{deletingMember?.full_name}</strong> ({deletingMember?.email})?
                            Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={deleteLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteLoading ? 'Đang xóa...' : 'Xóa'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TooltipProvider>
    );
};
