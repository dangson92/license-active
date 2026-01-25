import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { User, LicenseKey, KeyStatus } from '../types';
import api, { getAssetUrl } from '../services/api';
import { AppLayout } from './layout/AppLayout';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Icons
import { Copy, Check, Plus, Key, AppWindow } from 'lucide-react';

// Page Components
import { UserSupport } from './UserSupport';
import { TicketDetail } from './TicketDetail';
import { ApplicationStore } from './ApplicationStore';
import { Checkout } from './Checkout';
import { CheckoutSuccess } from './CheckoutSuccess';
import { UserOrders } from './UserOrders';
import { NotificationsPage } from './NotificationsPage';
import { UserAnnouncements } from './UserAnnouncements';
import { AnnouncementDetailPage } from './AnnouncementDetailPage';
import { UserSettings } from './UserSettings';
import { UserDashboardOverview } from './UserDashboardOverview';

interface UserRoutesProps {
    user: User;
    onLogout: () => void;
}

export const UserRoutes: React.FC<UserRoutesProps> = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Get active section from URL
    const getActiveSection = () => {
        const path = location.pathname;
        if (path.includes('/user/dashboard')) return 'dashboard';
        if (path.includes('/user/store')) return 'store';
        if (path.includes('/user/orders')) return 'orders';
        if (path.includes('/user/support')) return 'support';
        if (path.includes('/user/licenses')) return 'licenses';
        if (path.includes('/user/announcements')) return 'announcements';
        if (path.includes('/user/checkout')) return 'store';
        if (path.includes('/user/settings')) return 'settings';
        return 'dashboard';
    };

    const handleNavClick = (itemId: string) => {
        switch (itemId) {
            case 'dashboard':
                navigate('/user/dashboard');
                break;
            case 'licenses':
                navigate('/user/licenses');
                break;
            case 'store':
                navigate('/user/store');
                break;
            case 'support':
                navigate('/user/support');
                break;
            case 'orders':
                navigate('/user/orders');
                break;
            case 'announcements':
                navigate('/user/announcements');
                break;
            case 'settings':
                navigate('/user/settings');
                break;
            default:
                navigate('/user/dashboard');
        }
    };

    const handleCheckout = (appId: number, duration: string, price: number, appName: string) => {
        navigate(`/user/checkout/${appId}`, { state: { duration, price, appName } });
    };

    return (
        <TooltipProvider>
            <AppLayout
                variant="user"
                userName={user.username}
                onLogout={onLogout}
                activeItem={getActiveSection()}
                searchPlaceholder="Tìm kiếm..."
                onNavClick={handleNavClick}
            >
                <Routes>
                    <Route path="dashboard" element={<UserDashboardOverview />} />
                    <Route path="licenses" element={<LicenseContent />} />
                    <Route path="store" element={
                        <ApplicationStore onCheckout={handleCheckout} />
                    } />
                    <Route path="orders" element={<UserOrders />} />
                    <Route path="support" element={<UserSupport />} />
                    <Route path="support/ticket/:ticketId" element={<TicketDetail />} />
                    <Route path="checkout/:appId" element={
                        <CheckoutWrapper onSuccess={() => navigate('/user/checkout-success')} />
                    } />
                    <Route path="checkout-success" element={
                        <CheckoutSuccess
                            onGoToStore={() => navigate('/user/store')}
                            onGoToLicenses={() => navigate('/user/licenses')}
                        />
                    } />
                    <Route path="settings" element={<UserSettings />} />
                    <Route path="announcements" element={<UserAnnouncements />} />
                    <Route path="announcements/:id" element={<AnnouncementDetailPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
                </Routes>
            </AppLayout>
        </TooltipProvider>
    );
};

// Checkout Wrapper
import { useParams } from 'react-router-dom';

const CheckoutWrapper: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const location = useLocation();
    const { appId } = useParams<{ appId: string }>();
    const state = location.state as { duration?: string; price?: number; appName?: string } | null;

    return (
        <Checkout
            appId={appId}
            appName={state?.appName}
            duration={state?.duration || '12 Tháng'}
            price={state?.price || 1200000}
            onSuccess={onSuccess}
        />
    );
};

// License Content (extracted from UserDashboard)
const LicenseContent: React.FC = () => {
    const navigate = useNavigate();
    const [userKeys, setUserKeys] = useState<(LicenseKey & { appIcon?: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    useEffect(() => {
        loadUserLicenses();
    }, []);

    const loadUserLicenses = async () => {
        try {
            setLoading(true);
            const response = await api.user.getLicenses();
            const licenses: (LicenseKey & { appIcon?: string })[] = response.items.map((item: any) => ({
                id: item.id.toString(),
                key: item.license_key,
                status: mapStatus(item.status),
                createdAt: new Date().toISOString(),
                expiresAt: item.expires_at,
                appCode: item.app_code,
                appName: item.app_name,
                appIcon: item.app_icon,
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
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Licenses</h1>
                    <p className="text-muted-foreground text-sm">
                        Tổng quan về các license phần mềm và giới hạn thiết bị của bạn.
                    </p>
                </div>
                <Button onClick={() => navigate('/user/store')}>
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
                                            <Button variant="outline" size="sm" onClick={() => navigate('/user/store')}>
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
                                                    <div className={`w-10 h-10 rounded-md flex items-center justify-center border overflow-hidden ${key.appIcon ? 'bg-white' : getAppIcon(key.appName || '')}`}>
                                                        {key.appIcon ? (
                                                            <img src={getAssetUrl(key.appIcon) || ''} alt={key.appName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <AppWindow className="w-5 h-5" />
                                                        )}
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
        </>
    );
};
