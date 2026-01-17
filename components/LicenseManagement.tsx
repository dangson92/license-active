import React, { useState, useEffect } from 'react';
import { LicenseKey, KeyStatus, User, App } from '../types';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

// Icons
import {
    Plus,
    Download,
    Ban,
    Clock,
    Link2Off,
    Trash2,
    Copy,
    Check,
    CheckCircle,
    AlertTriangle,
    UserX,
    Key
} from 'lucide-react';

interface LicenseManagementProps {
    user: User;
    onCreateLicense: () => void;
}

interface DevicePopup {
    licenseId: string;
    devices: any[];
    selectedDevices: string[];
}

export const LicenseManagement: React.FC<LicenseManagementProps> = ({ user, onCreateLicense }) => {
    const [keys, setKeys] = useState<LicenseKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [devicePopup, setDevicePopup] = useState<DevicePopup | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await api.admin.getLicenses();

            const licenses: LicenseKey[] = response.items.map((item: any) => ({
                id: item.id.toString(),
                key: item.license_key,
                status: mapStatus(item.status),
                createdAt: item.created_at || new Date().toISOString(),
                expiresAt: item.expires_at,
                owner: item.user_email,
                appCode: item.app_code,
                appName: item.app_name,
                maxDevices: item.max_devices,
                activeDevices: item.active_devices || 0,
            }));

            setKeys(licenses);
        } catch (error) {
            console.error('Failed to load licenses:', error);
            setKeys([]);
        } finally {
            setLoading(false);
        }
    };

    const mapStatus = (dbStatus: string): KeyStatus => {
        switch (dbStatus) {
            case 'active': return KeyStatus.ACTIVE;
            case 'revoked': return KeyStatus.REVOKED;
            case 'expired': return KeyStatus.EXPIRED;
            default: return KeyStatus.ACTIVE;
        }
    };

    const getStatusBadge = (status: KeyStatus) => {
        switch (status) {
            case KeyStatus.ACTIVE:
                return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Active</Badge>;
            case KeyStatus.EXPIRED:
                return <Badge variant="warning"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Expired</Badge>;
            case KeyStatus.REVOKED:
                return <Badge variant="destructive"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>Revoked</Badge>;
            default:
                return <Badge variant="info"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>Valid</Badge>;
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const copyToClipboard = async (text: string, keyId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(keyId);
            setTimeout(() => setCopiedKey(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleRevoke = async (licenseId: string) => {
        if (!confirm('Bạn có chắc chắn muốn thu hồi license key này?')) return;
        try {
            await api.admin.revokeLicense(parseInt(licenseId));
            loadData();
        } catch (error) {
            alert('Không thể thu hồi license key!');
        }
    };

    const handleDelete = async (licenseId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa license key này?')) return;
        try {
            await api.admin.deleteLicense(parseInt(licenseId));
            loadData();
        } catch (error) {
            alert('Không thể xóa license key!');
        }
    };

    const handleExtendLicense = async (licenseId: string) => {
        const months = prompt('Nhập số tháng muốn gia hạn:', '1');
        if (!months) return;

        const additionalMonths = parseInt(months);
        if (isNaN(additionalMonths) || additionalMonths <= 0) {
            alert('Số tháng không hợp lệ!');
            return;
        }

        try {
            await api.admin.extendLicense(parseInt(licenseId), additionalMonths);
            alert(`Đã gia hạn thêm ${additionalMonths} tháng thành công!`);
            loadData();
        } catch (error: any) {
            alert(`Không thể gia hạn: ${error.message}`);
        }
    };

    const handleRemoveDevice = async (licenseId: string) => {
        try {
            const details = await api.admin.getLicenseDetails(parseInt(licenseId));
            if (!details.activations || details.activations.length === 0) {
                alert('License này chưa có device nào được kích hoạt!');
                return;
            }

            setDevicePopup({
                licenseId,
                devices: details.activations,
                selectedDevices: [],
            });
        } catch (error: any) {
            alert(`Không thể tải danh sách devices: ${error.message}`);
        }
    };

    const handleConfirmRemoveDevices = async () => {
        if (!devicePopup || devicePopup.selectedDevices.length === 0) {
            alert('Vui lòng chọn ít nhất 1 device để gỡ!');
            return;
        }

        try {
            for (const deviceId of devicePopup.selectedDevices) {
                await api.admin.removeDevice(parseInt(devicePopup.licenseId), deviceId);
            }

            alert(`Đã gỡ ${devicePopup.selectedDevices.length} device thành công!`);
            setDevicePopup(null);
            loadData();
        } catch (error: any) {
            alert(`Không thể gỡ device: ${error.message}`);
        }
    };

    const toggleDeviceSelection = (deviceId: string) => {
        if (!devicePopup) return;

        const isSelected = devicePopup.selectedDevices.includes(deviceId);
        setDevicePopup({
            ...devicePopup,
            selectedDevices: isSelected
                ? devicePopup.selectedDevices.filter(id => id !== deviceId)
                : [...devicePopup.selectedDevices, deviceId],
        });
    };

    // Filter and search
    const getFilteredKeys = () => {
        let filtered = [...keys];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(key =>
                key.key.toLowerCase().includes(query) ||
                (key.owner && key.owner.toLowerCase().includes(query))
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(key => key.status.toLowerCase() === statusFilter.toLowerCase());
        }

        return filtered;
    };

    const filteredKeys = getFilteredKeys();

    // Stats
    const stats = {
        totalActive: keys.filter(k => k.status === KeyStatus.ACTIVE).length,
        expiringSoon: keys.filter(k => {
            if (!k.expiresAt) return false;
            const days = Math.ceil((new Date(k.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return days > 0 && days <= 30 && k.status === KeyStatus.ACTIVE;
        }).length,
        revoked: keys.filter(k => k.status === KeyStatus.REVOKED).length,
        total: keys.length,
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
                        <h1 className="text-2xl font-bold tracking-tight">License Management</h1>
                        <p className="text-muted-foreground text-sm">Quản lý và theo dõi license trong hệ thống.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export Data
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={onCreateLicense}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Issue License
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Total Active</p>
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">{stats.totalActive}</span>
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12.5%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">from last month</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                            </div>
                            <span className="text-3xl font-bold">{stats.expiringSoon}</span>
                            <p className="text-xs text-muted-foreground mt-2">Within 30 days</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Revoked</p>
                                <UserX className="w-5 h-5 text-destructive" />
                            </div>
                            <span className="text-3xl font-bold">{stats.revoked}</span>
                            <p className="text-xs text-muted-foreground mt-2">Total revoked</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Total Licenses</p>
                                <Key className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-3xl font-bold">{stats.total}</span>
                            <p className="text-xs text-muted-foreground mt-2">All time</p>
                        </CardContent>
                    </Card>
                </div>

                {/* License Table */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Key className="w-5 h-5 text-primary" />
                                Danh sách License Keys
                            </CardTitle>
                            <div className="flex items-center gap-3">
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Tất cả trạng thái" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tất cả trạng thái</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="expired">Expired</SelectItem>
                                        <SelectItem value="revoked">Revoked</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                            <Input
                                placeholder="Tìm kiếm license key, email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="max-w-md"
                            />
                            <span className="text-sm text-muted-foreground">
                                Hiển thị {filteredKeys.length} / {keys.length} license keys
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">License Key</TableHead>
                                    <TableHead className="font-semibold">Ứng dụng</TableHead>
                                    <TableHead className="font-semibold">Owner</TableHead>
                                    <TableHead className="font-semibold">Thời hạn</TableHead>
                                    <TableHead className="font-semibold">Devices</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredKeys.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                                    <Key className="w-6 h-6 text-muted-foreground" />
                                                </div>
                                                <p className="text-muted-foreground">Chưa có license key nào.</p>
                                                <Button variant="outline" size="sm" onClick={onCreateLicense}>
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Tạo License Key đầu tiên
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredKeys.map((key) => (
                                        <TableRow key={key.id} className="group">
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs font-mono bg-muted border px-2 py-1 rounded text-muted-foreground">
                                                        {key.key.slice(0, 8)}...{key.key.slice(-4)}
                                                    </code>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => copyToClipboard(key.key, key.id)}
                                                            >
                                                                {copiedKey === key.id ? (
                                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                                ) : (
                                                                    <Copy className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {copiedKey === key.id ? 'Đã copy!' : 'Copy license key'}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-medium">{key.appName || key.appCode || '-'}</span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {key.owner || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {formatDate(key.expiresAt)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">
                                                    {key.activeDevices}/{key.maxDevices}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(key.status)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    {key.status === KeyStatus.ACTIVE && (
                                                        <>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleExtendLicense(key.id)}
                                                                    >
                                                                        <Clock className="w-4 h-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Gia hạn</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleRevoke(key.id)}
                                                                    >
                                                                        <Ban className="w-4 h-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Thu hồi</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleRemoveDevice(key.id)}
                                                                    >
                                                                        <Link2Off className="w-4 h-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Gỡ device</TooltipContent>
                                                            </Tooltip>
                                                        </>
                                                    )}
                                                    <Separator orientation="vertical" className="h-4 mx-1" />
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDelete(key.id)}
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

                {/* Device Management Dialog */}
                <Dialog open={Boolean(devicePopup)} onOpenChange={() => setDevicePopup(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Quản lý Devices</DialogTitle>
                            <DialogDescription>
                                Chọn các devices bạn muốn gỡ khỏi license này.
                            </DialogDescription>
                        </DialogHeader>

                        {devicePopup && (
                            <div className="space-y-4">
                                <div className="border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="w-12"></TableHead>
                                                <TableHead className="font-semibold">Device ID</TableHead>
                                                <TableHead className="font-semibold">Activated At</TableHead>
                                                <TableHead className="font-semibold">Last Used</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {devicePopup.devices.map((device: any) => (
                                                <TableRow key={device.device_id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={devicePopup.selectedDevices.includes(device.device_id)}
                                                            onCheckedChange={() => toggleDeviceSelection(device.device_id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                                            {device.device_id}
                                                        </code>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {new Date(device.activated_at).toLocaleString('vi-VN')}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {device.last_used_at
                                                            ? new Date(device.last_used_at).toLocaleString('vi-VN')
                                                            : '-'
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <p className="text-sm text-muted-foreground">
                                    Đã chọn: <span className="font-bold">{devicePopup.selectedDevices.length}</span> / {devicePopup.devices.length} devices
                                </p>
                            </div>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDevicePopup(null)}>
                                Hủy
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleConfirmRemoveDevices}
                                disabled={!devicePopup || devicePopup.selectedDevices.length === 0}
                            >
                                Gỡ {devicePopup?.selectedDevices.length || 0} device
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
};
