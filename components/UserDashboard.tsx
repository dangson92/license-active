import React, { useState, useEffect } from 'react';
import { LicenseKey, KeyStatus, User } from '../types';
import api from '../services/api';
import { AppLayout } from './layout/AppLayout';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Icons
import { Copy, Check, Plus, Key, AppWindow } from 'lucide-react';

interface UserDashboardProps {
  user: User;
  onLogout: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, onLogout }) => {
  const [userKeys, setUserKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadUserLicenses();
  }, []);

  const loadUserLicenses = async () => {
    try {
      setLoading(true);
      const response = await api.user.getLicenses();

      const licenses: LicenseKey[] = response.items.map((item: any) => ({
        id: item.id.toString(),
        key: item.license_key,
        status: mapStatus(item.status),
        createdAt: new Date().toISOString(),
        expiresAt: item.expires_at,
        appCode: item.app_code,
        appName: item.app_name,
        maxDevices: item.max_devices,
        activeDevices: item.active_devices || 0,
      }));

      setUserKeys(licenses);
    } catch (error) {
      console.error('Failed to load licenses:', error);
      setUserKeys([]);
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
    if (!dateStr) return 'Lifetime';
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

  const getDeviceUsageColor = (active: number, max: number) => {
    const percentage = (active / max) * 100;
    if (percentage >= 100) return 'bg-amber-500';
    if (percentage >= 80) return 'bg-amber-400';
    return 'bg-primary';
  };

  const getAppIcon = (appName: string) => {
    // Map app names to colors
    const colors: Record<string, string> = {
      default: 'bg-blue-50 text-blue-600 border-blue-100',
      pro: 'bg-purple-50 text-purple-600 border-purple-100',
      vpn: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    };

    const colorKey = Object.keys(colors).find(k => appName.toLowerCase().includes(k)) || 'default';
    return colors[colorKey];
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
        variant="user"
        userName={user.username}
        onLogout={onLogout}
        activeItem="licenses"
        searchPlaceholder="Tìm kiếm license..."
      >
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Licenses</h1>
            <p className="text-muted-foreground text-sm">
              Tổng quan về các license phần mềm và giới hạn thiết bị của bạn.
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Mua License Mới
          </Button>
        </div>

        {/* License Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                License Keys của tôi
              </CardTitle>
              <span className="text-sm text-muted-foreground">{userKeys.length} licenses</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Ứng dụng</TableHead>
                  <TableHead className="font-semibold">License Key</TableHead>
                  <TableHead className="font-semibold">Thời hạn</TableHead>
                  <TableHead className="font-semibold">Sử dụng Device</TableHead>
                  <TableHead className="font-semibold">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Key className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">Bạn chưa có license key nào.</p>
                        <Button variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Mua License đầu tiên
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  userKeys.map((key) => {
                    const activeDevices = key.activeDevices || 0;
                    const usagePercent = (activeDevices / key.maxDevices) * 100;

                    return (
                      <TableRow key={key.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-md flex items-center justify-center border ${getAppIcon(key.appName || '')}`}>
                              <AppWindow className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{key.appName}</p>
                              <p className="text-[11px] text-muted-foreground">{key.appCode}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono bg-muted border px-2.5 py-1 rounded text-muted-foreground">
                              XXXX-XXXX-••••-{key.key.slice(-4)}
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
                          <p className={`text-sm ${key.status === KeyStatus.EXPIRED ? 'text-muted-foreground' :
                              key.status === KeyStatus.ACTIVE ? 'text-foreground' : 'text-muted-foreground'
                            }`}>
                            {formatDate(key.expiresAt)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5 w-32">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-muted-foreground">
                                {activeDevices}/{key.maxDevices} Devices
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getDeviceUsageColor(activeDevices, key.maxDevices)}`}
                                style={{ width: `${Math.min(usagePercent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(key.status)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
          {userKeys.length > 0 && (
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Total: {userKeys.length} Licenses
              </span>
            </div>
          )}
        </Card>
      </AppLayout>
    </TooltipProvider>
  );
};
