import React, { useState, useEffect } from 'react';
import { LicenseKey, KeyStatus, User, App } from '../types';
import { generateKeyInsights } from '../services/geminiService';
import api from '../services/api';
import { VersionManagement } from './VersionManagement';
import { MemberManagement } from './MemberManagement';
import { CreateLicense } from './CreateLicense';
import { AppLayout } from './layout/AppLayout';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Icons
import {
  Plus,
  RefreshCw,
  Sparkles,
  Ban,
  Clock,
  Link2Off,
  Trash2,
  Copy,
  CheckCircle,
  AlertTriangle,
  UserX,
  DollarSign,
  Download
} from 'lucide-react';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'licenses' | 'versions'>('licenses');
  const [activeSection, setActiveSection] = useState<string>('licenses');
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  // License form state
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>('1');
  const [maxDevices, setMaxDevices] = useState<number>(1);

  // App form state
  const [newAppCode, setNewAppCode] = useState<string>('');
  const [newAppName, setNewAppName] = useState<string>('');
  const [creatingApp, setCreatingApp] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);

  // Data
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Filter, Sort, Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Device removal popup state
  const [devicePopup, setDevicePopup] = useState<{
    licenseId: string;
    devices: any[];
    selectedDevices: string[];
  } | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appsRes, usersRes, licensesRes] = await Promise.all([
        api.admin.getApps(),
        api.admin.getUsers(),
        api.admin.getLicenses(),
      ]);

      setApps(appsRes.items || []);
      setUsers(usersRes.items || []);

      const transformedKeys = (licensesRes.items || []).map((lic: any) => ({
        id: lic.id.toString(),
        key: lic.license_key,
        status: lic.status === 'active' ? KeyStatus.ACTIVE :
          lic.status === 'revoked' ? KeyStatus.REVOKED :
            lic.status === 'expired' ? KeyStatus.EXPIRED : KeyStatus.VALID,
        createdAt: lic.created_at,
        expiresAt: lic.expires_at,
        owner: lic.email,
        appCode: lic.app_code,
        appName: lic.app_name,
        maxDevices: lic.max_devices,
        activeDevices: lic.active_devices || 0,
      }));

      setKeys(transformedKeys);

      if (appsRes.items?.length > 0) setSelectedApp(appsRes.items[0].id.toString());
      if (usersRes.items?.length > 0) setSelectedUser(usersRes.items[0].id.toString());
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApp = async () => {
    if (!newAppCode || !newAppName) {
      alert('Vui lòng nhập đầy đủ App Code và App Name!');
      return;
    }

    try {
      setCreatingApp(true);
      await api.admin.createApp({ code: newAppCode, name: newAppName });
      alert('Ứng dụng đã được tạo thành công!');
      setNewAppCode('');
      setNewAppName('');
      setShowAppForm(false);
      await loadData();
    } catch (error: any) {
      alert(`Không thể tạo ứng dụng: ${error.message}`);
    } finally {
      setCreatingApp(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!selectedApp || !selectedUser) {
      alert('Vui lòng chọn ứng dụng và user!');
      return;
    }

    try {
      setCreating(true);
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + parseInt(selectedDuration));

      const result = await api.admin.createLicense({
        user_id: parseInt(selectedUser),
        app_id: parseInt(selectedApp),
        max_devices: maxDevices,
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });

      alert(`License key đã được tạo thành công!\n\nKey: ${result.license_key}`);
      await loadData();
    } catch (error: any) {
      alert(`Không thể tạo license key!\n\nLỗi: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa license key này?')) return;

    try {
      await api.admin.deleteLicense(Number(id));
      alert('Đã xóa license key thành công!');
      await loadData();
    } catch (error: any) {
      alert(`Không thể xóa: ${error.message}`);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn vô hiệu hóa license key này?')) return;

    try {
      await api.admin.revokeLicense(Number(id));
      alert('Đã vô hiệu hóa license key thành công!');
      await loadData();
    } catch (error: any) {
      alert(`Không thể vô hiệu hóa: ${error.message}`);
    }
  };

  const handleExtendKey = async (id: string) => {
    const months = prompt('Nhập số tháng muốn gia hạn (1-12):');
    if (!months) return;

    const additionalMonths = parseInt(months);
    if (isNaN(additionalMonths) || additionalMonths < 1 || additionalMonths > 12) {
      alert('Số tháng không hợp lệ!');
      return;
    }

    try {
      await api.admin.extendLicense(Number(id), additionalMonths);
      alert(`Đã gia hạn thêm ${additionalMonths} tháng thành công!`);
      await loadData();
    } catch (error: any) {
      alert(`Không thể gia hạn: ${error.message}`);
    }
  };

  const handleRemoveDevice = async (licenseId: string) => {
    try {
      const details = await api.admin.getLicenseDetails(Number(licenseId));
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
        await api.admin.removeDevice(Number(devicePopup.licenseId), deviceId);
      }

      alert(`Đã gỡ ${devicePopup.selectedDevices.length} device thành công!`);
      setDevicePopup(null);
      await loadData();
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
        ? devicePopup.selectedDevices.filter(h => h !== deviceId)
        : [...devicePopup.selectedDevices, deviceId],
    });
  };

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    const result = await generateKeyInsights(keys);
    setInsight(result);
    setLoadingInsight(false);
  };

  const getStatusBadge = (status: KeyStatus) => {
    switch (status) {
      case KeyStatus.ACTIVE:
        return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Active</Badge>;
      case KeyStatus.EXPIRED:
        return <Badge variant="outline" className="text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Expired</Badge>;
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <AppLayout
        variant="admin"
        userName={user.username}
        onLogout={onLogout}
        activeItem={activeSection}
        searchPlaceholder="Tìm kiếm license, email..."
        onSearch={setSearchQuery}
        onNavClick={(itemId) => {
          setActiveSection(itemId);
          // Map sidebar items to tabs
          if (itemId === 'licenses') {
            setActiveTab('licenses');
          } else if (itemId === 'applications') {
            setActiveTab('versions');
          }
          // TODO: Add more sections like 'members', 'dashboard', 'settings'
        }}
      >
        {/* Render content based on activeSection */}
        {activeSection === 'members' ? (
          <MemberManagement />
        ) : activeSection === 'create-license' ? (
          <CreateLicense
            apps={apps}
            users={users}
            onBack={() => setActiveSection('licenses')}
            onSuccess={() => {
              loadData();
              setActiveSection('licenses');
            }}
          />
        ) : (
          <>
            {/* Tab Selector for Licenses/Versions */}
            <div className="flex gap-4 border-b border-border mb-6">
              <button
                onClick={() => setActiveTab('licenses')}
                className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px ${activeTab === 'licenses'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
              >
                License Management
              </button>
              <button
                onClick={() => setActiveTab('versions')}
                className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px ${activeTab === 'versions'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
              >
                Version Management
              </button>
            </div>

            {activeTab === 'licenses' && (
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
                      onClick={() => setActiveSection('create-license')}
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
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold">{stats.totalActive}</span>
                        <span className="text-xs text-emerald-600 font-medium">+12.5% from last month</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold">{stats.expiringSoon}</span>
                        <span className="text-xs text-amber-600 font-medium">Within 30 days</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Revoked</p>
                        <UserX className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold">{stats.revoked}</span>
                        <span className="text-xs text-muted-foreground font-medium">Total revoked</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Total Licenses</p>
                        <DollarSign className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold">{stats.total}</span>
                        <span className="text-xs text-muted-foreground font-medium">All time</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* License Table */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <CardTitle className="text-lg">Danh sách License Keys</CardTitle>
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
                    <p className="text-sm text-muted-foreground mt-2">
                      Hiển thị {filteredKeys.length} / {keys.length} license keys
                    </p>
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
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              {searchQuery || statusFilter !== 'all'
                                ? 'Không tìm thấy license key phù hợp.'
                                : 'Chưa có license key nào.'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredKeys.map((key) => (
                            <TableRow key={key.id} className="group">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                    {key.key.slice(0, 16)}...
                                  </code>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                        onClick={() => navigator.clipboard.writeText(key.key)}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy to clipboard</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{key.appName}</p>
                                  <p className="text-xs text-muted-foreground">{key.appCode}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {key.owner || '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDate(key.expiresAt)}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-medium">
                                  {(key as any).activeDevices || 0} / {key.maxDevices}
                                </span>
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(key.status)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  {key.status !== KeyStatus.REVOKED && (
                                    <>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleRevokeKey(key.id)}
                                          >
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
                                            className="h-8 w-8"
                                            onClick={() => handleExtendKey(key.id)}
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
                                        onClick={() => handleDeleteKey(key.id)}
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
            )}

            {activeTab === 'versions' && (
              <VersionManagement apps={apps} />
            )}

            {/* Create License Dialog */}
            <Dialog open={showAppForm} onOpenChange={setShowAppForm}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Tạo License Key Mới</DialogTitle>
                  <DialogDescription>
                    Cấu hình thông số cho license mới.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Ứng dụng</Label>
                    <Select value={selectedApp} onValueChange={setSelectedApp}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn ứng dụng" />
                      </SelectTrigger>
                      <SelectContent>
                        {apps.map(app => (
                          <SelectItem key={app.id} value={app.id.toString()}>
                            {app.name} ({app.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>User</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.email} - {u.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Thời hạn sử dụng</Label>
                    <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 tháng</SelectItem>
                        <SelectItem value="3">3 tháng</SelectItem>
                        <SelectItem value="6">6 tháng</SelectItem>
                        <SelectItem value="12">1 năm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Số device tối đa</Label>
                    <Input
                      type="number"
                      min="1"
                      value={maxDevices}
                      onChange={(e) => setMaxDevices(Number(e.target.value))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAppForm(false)}>
                    Hủy
                  </Button>
                  <Button onClick={handleGenerateKey} disabled={creating}>
                    {creating ? 'Đang tạo...' : 'Tạo License'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Device Removal Dialog */}
            <Dialog open={!!devicePopup} onOpenChange={() => setDevicePopup(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Chọn thiết bị cần gỡ</DialogTitle>
                  <DialogDescription>
                    Đã chọn: {devicePopup?.selectedDevices.length || 0} / {devicePopup?.devices.length || 0}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2 p-1">
                    {devicePopup?.devices.map((device: any, index: number) => (
                      <div
                        key={device.device_id}
                        className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => toggleDeviceSelection(device.device_id)}
                      >
                        <Checkbox
                          checked={devicePopup.selectedDevices.includes(device.device_id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm">Device #{index + 1}</span>
                            <Badge variant={device.status === 'active' ? 'success' : 'outline'}>
                              {device.status}
                            </Badge>
                          </div>
                          <code className="text-xs bg-muted p-2 rounded block break-all">
                            {device.device_id}
                          </code>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium">Kích hoạt:</span><br />
                              {new Date(device.first_activated_at).toLocaleString('vi-VN')}
                            </div>
                            <div>
                              <span className="font-medium">Checkin cuối:</span><br />
                              {new Date(device.last_checkin_at).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
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
          </>
        )}
      </AppLayout>
    </TooltipProvider>
  );
};
