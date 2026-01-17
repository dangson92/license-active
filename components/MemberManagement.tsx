import React, { useState, useEffect } from 'react';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Icons
import {
    Users,
    CheckCircle,
    Download,
    UserPlus,
    MoreHorizontal,
    Edit,
    Ban,
    Trash2
} from 'lucide-react';

interface Member {
    id: number;
    email: string;
    full_name: string;
    role: string;
    status?: string;
    created_at?: string;
    licenses_count?: number;
}

export const MemberManagement: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

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

    const getStatusBadge = (status?: string) => {
        if (status === 'active') {
            return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Active</Badge>;
        }
        return <Badge variant="outline"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Inactive</Badge>;
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
                                                {getStatusBadge(member.status)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Chỉnh sửa</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <Ban className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Vô hiệu hóa</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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
        </TooltipProvider>
    );
};
