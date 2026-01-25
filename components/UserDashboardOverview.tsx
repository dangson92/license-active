import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getCurrentUser } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Key,
    Monitor,
    CalendarCheck,
    ShoppingCart,
    Download,
    HeadphonesIcon,
    BookOpen,
    Code2,
    Sparkles,
    ArrowUpRight,
    ArrowRight,
    CheckCircle
} from 'lucide-react';

interface UserStats {
    activeLicenses: number;
    licensesChange: number;
    totalDevices: number;
    maxDevices: number;
    nextRenewal: string | null;
}

interface Announcement {
    id: number;
    title: string;
    content: string;
    type: 'new' | 'notice' | 'promo';
    date: string;
}

export const UserDashboardOverview: React.FC = () => {
    const navigate = useNavigate();
    const user = getCurrentUser();
    const [stats, setStats] = useState<UserStats>({
        activeLicenses: 0,
        licensesChange: 0,
        totalDevices: 0,
        maxDevices: 20,
        nextRenewal: null,
    });
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch licenses
            const licensesRes = await api.user.getLicenses().catch(() => ({ items: [] }));
            const licenses = licensesRes.items || [];

            // Calculate stats
            const activeLicenses = licenses.filter((l: any) => l.status === 'active').length;
            const totalDevices = licenses.reduce((sum: number, l: any) => sum + (l.active_devices || 0), 0);
            const maxDevices = licenses.reduce((sum: number, l: any) => sum + (l.max_devices || 0), 0);

            // Find next renewal date
            const activeLicensesList = licenses.filter((l: any) => l.status === 'active' && l.expires_at);
            let nextRenewal = null;
            if (activeLicensesList.length > 0) {
                const dates = activeLicensesList.map((l: any) => new Date(l.expires_at));
                const nearest = new Date(Math.min(...dates.map(d => d.getTime())));
                nextRenewal = nearest.toLocaleDateString('vi-VN');
            }

            setStats({
                activeLicenses,
                licensesChange: 1, // New license this month
                totalDevices,
                maxDevices: maxDevices || 20,
                nextRenewal,
            });

            // Fetch announcements
            const announcementsRes = await api.announcements.getAll().catch(() => ({ items: [] }));
            const announcementItems = (announcementsRes.items || []).slice(0, 3).map((a: any) => ({
                id: a.id,
                title: a.title,
                content: a.content?.substring(0, 150) + '...' || '',
                type: a.is_pinned ? 'new' : 'notice',
                date: new Date(a.published_at || a.created_at).toLocaleDateString('vi-VN'),
            }));

            setAnnouncements(announcementItems.length > 0 ? announcementItems : [
                {
                    id: 1,
                    title: 'Cập nhật phiên bản SD Engine v4.2.0',
                    content: 'Chúng tôi vừa phát hành bản cập nhật lớn tập trung vào hiệu suất xử lý dữ liệu và tích hợp API mới...',
                    type: 'new',
                    date: '15/10/2023',
                },
                {
                    id: 2,
                    title: 'Bảo trì hệ thống định kỳ',
                    content: 'Hệ thống sẽ tạm ngưng để bảo trì vào rạng sáng Chủ Nhật tuần này để nâng cấp hạ tầng server...',
                    type: 'notice',
                    date: '12/10/2023',
                },
                {
                    id: 3,
                    title: 'Ưu đãi gia hạn năm 2024',
                    content: 'Nhận ngay ưu đãi 20% khi thực hiện gia hạn bản quyền trước ngày 31/12/2023...',
                    type: 'promo',
                    date: '10/10/2023',
                },
            ]);

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getAnnouncementBadge = (type: string) => {
        switch (type) {
            case 'new':
                return <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">Mới</Badge>;
            case 'promo':
                return <Badge className="bg-emerald-100 text-emerald-600 hover:bg-emerald-200 border-0">Khuyến mãi</Badge>;
            default:
                return <Badge variant="outline" className="text-muted-foreground">Thông báo</Badge>;
        }
    };

    // Get user name from email or default
    const userEmail = user?.email || '';
    const userName = userEmail.split('@')[0] || 'User';
    const firstName = userName;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-[1200px] mx-auto">
            {/* Welcome Section */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Chào mừng trở lại, {firstName}!</h1>
                <p className="text-muted-foreground mt-1">Hôm nay là một ngày tuyệt vời để tối ưu hóa quy trình của bạn.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Active Licenses */}
                <Card className="bg-white shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">My Active Licenses</p>
                            <CheckCircle className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-4xl font-extrabold">{stats.activeLicenses}</p>
                        {stats.licensesChange > 0 && (
                            <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold mt-2">
                                <ArrowUpRight className="w-4 h-4" />
                                <span>+{stats.licensesChange} trong tháng này</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Total Devices */}
                <Card className="bg-white shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">Total Devices Linked</p>
                            <Monitor className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-4xl font-extrabold">{stats.totalDevices}</p>
                        <p className="text-muted-foreground text-xs font-medium mt-2">
                            Giới hạn tối đa: {stats.maxDevices} thiết bị
                        </p>
                    </CardContent>
                </Card>

                {/* Subscription Status */}
                <Card className="bg-white shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">Subscription Status</p>
                            <CalendarCheck className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-xl font-bold">Gia hạn kế tiếp</p>
                        <p className="text-2xl font-extrabold text-primary mt-1">
                            {stats.nextRenewal || 'N/A'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Announcements */}
                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Recent Announcements</h2>
                        <button
                            onClick={() => navigate('/user/announcements')}
                            className="text-primary text-sm font-bold hover:underline"
                        >
                            Xem tất cả
                        </button>
                    </div>
                    <div className="space-y-4">
                        {announcements.map((announcement) => (
                            <Card
                                key={announcement.id}
                                className="bg-white shadow-sm hover:border-primary/50 transition-all cursor-pointer group"
                                onClick={() => navigate(`/user/announcements/${announcement.id}`)}
                            >
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold group-hover:text-primary transition-colors">
                                            {announcement.title}
                                        </h3>
                                        {getAnnouncementBadge(announcement.type)}
                                    </div>
                                    <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                                        {announcement.content}
                                    </p>
                                    <p className="text-muted-foreground text-xs font-medium">
                                        Đăng ngày: {announcement.date}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div>
                    <h2 className="text-xl font-bold mb-4">My Quick Actions</h2>
                    <Card className="bg-white shadow-sm">
                        <CardContent className="p-6 space-y-4">
                            <Button
                                className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                onClick={() => navigate('/user/store')}
                            >
                                <ShoppingCart className="w-5 h-5 mr-2" />
                                Buy New License
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full border-2 border-primary/20 hover:border-primary/40 text-primary"
                                onClick={() => window.open('/downloads', '_blank')}
                            >
                                <Download className="w-5 h-5 mr-2" />
                                Download Software
                            </Button>

                            <Button
                                variant="ghost"
                                className="w-full bg-slate-50 hover:bg-slate-100 text-muted-foreground"
                                onClick={() => navigate('/user/support')}
                            >
                                <HeadphonesIcon className="w-5 h-5 mr-2" />
                                Get Support
                            </Button>

                            <hr className="my-4 border-border" />

                            <div className="space-y-3">
                                <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest text-center">
                                    Tài liệu nhanh
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <a
                                        href="#"
                                        className="flex flex-col items-center p-3 rounded-lg border border-border hover:bg-slate-50 transition-colors"
                                    >
                                        <BookOpen className="w-5 h-5 text-primary mb-1" />
                                        <span className="text-[10px] font-bold">User Guide</span>
                                    </a>
                                    <a
                                        href="#"
                                        className="flex flex-col items-center p-3 rounded-lg border border-border hover:bg-slate-50 transition-colors"
                                    >
                                        <Code2 className="w-5 h-5 text-primary mb-1" />
                                        <span className="text-[10px] font-bold">API Docs</span>
                                    </a>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tips Widget */}
                    <Card className="mt-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-primary/20 rounded-full">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                </div>
                                <p className="text-sm font-bold">SD Automation Tip</p>
                            </div>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                Sử dụng tính năng 'Auto-Connect' trong cài đặt để tự động hóa việc đồng bộ hóa thiết bị mới.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
