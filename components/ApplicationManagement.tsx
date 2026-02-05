import React, { useState, useEffect } from 'react';
import { App as AppType } from '../types';
import api, { getAssetUrl } from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Icons
import {
    Plus,
    AppWindow,
    Edit,
    Trash2,
    Package,
    Settings,
    MoreVertical
} from 'lucide-react';

interface ApplicationManagementProps {
    onManageVersions?: (appId: number, appName: string, appCode: string) => void;
    onAddVersion?: (appId: number, appName: string, appCode: string) => void;
    onEditApp?: (appId: number, appName: string) => void;
    onAddApp?: () => void;
}

export const ApplicationManagement: React.FC<ApplicationManagementProps> = ({
    onManageVersions,
    onAddVersion,
    onEditApp,
    onAddApp
}) => {
    const [apps, setApps] = useState<AppType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newAppName, setNewAppName] = useState('');
    const [newAppCode, setNewAppCode] = useState('');

    useEffect(() => {
        loadApps();
    }, []);

    const loadApps = async () => {
        try {
            setLoading(true);
            const response = await api.admin.getApps();
            setApps(response.items || []);
        } catch (error) {
            console.error('Failed to load apps:', error);
            // Mock data for development
            setApps([
                { id: 1, code: 'APP001', name: 'CloudSuite Pro', created_at: '2024-01-15' },
                { id: 2, code: 'VPN001', name: 'DataGuard VPN', created_at: '2024-02-20' },
                { id: 3, code: 'AUTO01', name: 'LogicFlow Automator', created_at: '2024-03-10' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateApp = async () => {
        if (!newAppName.trim() || !newAppCode.trim()) {
            alert('Vui lòng nhập đầy đủ thông tin!');
            return;
        }

        try {
            await api.admin.createApp({ code: newAppCode, name: newAppName });
            loadApps();
            setShowCreateDialog(false);
            setNewAppName('');
            setNewAppCode('');
        } catch (error) {
            alert('Không thể tạo application!');
        }
    };

    const handleDeleteApp = async (appId: number) => {
        if (!confirm('Bạn có chắc chắn muốn xóa application này?')) return;

        try {
            await api.admin.deleteApp(appId);
            loadApps();
        } catch (error) {
            alert('Không thể xóa application!');
        }
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
                        <h1 className="text-2xl font-bold tracking-tight">Application Management</h1>
                        <p className="text-muted-foreground text-sm">Quản lý các ứng dụng và phiên bản.</p>
                    </div>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => onAddApp ? onAddApp() : setShowCreateDialog(true)}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Application
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Total Apps</p>
                                <AppWindow className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-3xl font-bold">{apps.length}</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Total Versions</p>
                                <Package className="w-5 h-5 text-emerald-500" />
                            </div>
                            <span className="text-3xl font-bold">
                                {apps.reduce((sum, app: any) => sum + (app.version_count || 0), 0)}
                            </span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Active Licenses</p>
                                <Settings className="w-5 h-5 text-amber-500" />
                            </div>
                            <span className="text-3xl font-bold">
                                {apps.reduce((sum, app: any) => sum + (app.license_count || 0), 0)}
                            </span>
                        </CardContent>
                    </Card>
                </div>

                {/* Apps Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AppWindow className="w-5 h-5 text-blue-600" />
                            Danh sách Applications
                        </CardTitle>
                        <CardDescription>
                            Quản lý ứng dụng và versions. Click vào app để quản lý phiên bản.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">Application</TableHead>
                                    <TableHead className="font-semibold">Code</TableHead>
                                    <TableHead className="font-semibold">Versions</TableHead>
                                    <TableHead className="font-semibold">Licenses</TableHead>
                                    <TableHead className="font-semibold">Created</TableHead>
                                    <TableHead className="font-semibold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {apps.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Chưa có application nào.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    apps.map((app) => (
                                        <TableRow key={app.id} className="group hover:bg-muted/50">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden">
                                                        {(app as any).icon_url ? (
                                                            <img src={getAssetUrl((app as any).icon_url) || ''} alt={app.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <AppWindow className="w-5 h-5 text-blue-600" />
                                                        )}
                                                    </div>
                                                    <span className="font-medium">{app.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <code className="text-xs bg-muted px-2 py-1 rounded">{app.code}</code>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{(app as any).version_count || 0} versions</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-medium">{(app as any).license_count || 0}</span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {app.created_at ? new Date(app.created_at).toLocaleDateString('vi-VN') : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => onManageVersions?.(app.id, app.name, app.code)}
                                                            >
                                                                <Package className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Quản lý Versions</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => onEditApp?.(app.id, app.name)}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Chỉnh sửa</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDeleteApp(app.id)}
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

                {/* Create App Dialog */}
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Tạo Application Mới</DialogTitle>
                            <DialogDescription>
                                Thêm một ứng dụng mới vào hệ thống.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Tên Application</Label>
                                <Input
                                    placeholder="VD: CloudSuite Pro"
                                    value={newAppName}
                                    onChange={(e) => setNewAppName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Mã (Code)</Label>
                                <Input
                                    placeholder="VD: APP001"
                                    value={newAppCode}
                                    onChange={(e) => setNewAppCode(e.target.value.toUpperCase())}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                                Hủy
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateApp}>
                                Tạo Application
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
};
