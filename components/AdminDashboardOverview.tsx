import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Users,
    Key,
    DollarSign,
    Ticket,
    TrendingUp,
    TrendingDown,
    Minus,
    ExternalLink,
    Activity
} from 'lucide-react';

interface DashboardStats {
    totalMembers: number;
    totalMembersChange: number;
    activeLicenses: number;
    activeLicensesChange: number;
    totalRevenue: number;
    totalRevenueChange: number;
    pendingTickets: number;
    pendingTicketsChange: number;
}

interface RecentSale {
    id: number;
    userName: string;
    email: string;
    tier: string;
    amount: number;
    time: string;
}

interface LicenseDistribution {
    name: string;
    count: number;
    percentage: number;
    color: string;
}

interface MonthlyRevenue {
    month: string;
    amount: number;
}

export const AdminDashboardOverview: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats>({
        totalMembers: 0,
        totalMembersChange: 0,
        activeLicenses: 0,
        activeLicensesChange: 0,
        totalRevenue: 0,
        totalRevenueChange: 0,
        pendingTickets: 0,
        pendingTicketsChange: 0,
    });

    const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
    const [licenseDistribution, setLicenseDistribution] = useState<LicenseDistribution[]>([]);
    const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'6months' | '1year'>('6months');

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch real data from API
            const [usersRes, licensesRes, ordersRes, ticketsRes] = await Promise.all([
                api.admin.getUsers().catch(() => ({ items: [] })),
                api.admin.getLicenses().catch(() => ({ items: [] })),
                api.store.getAdminOrders().catch(() => ({ items: [] })),
                api.support.getAdminTickets().catch(() => ({ items: [] })),
            ]);

            const users = usersRes.items || [];
            const licenses = licensesRes.items || [];
            const orders = ordersRes.items || [];
            const tickets = ticketsRes.items || [];

            // Calculate stats
            const activeLicenses = licenses.filter((l: any) => l.status === 'active').length;
            const pendingTickets = tickets.filter((t: any) => t.status === 'open' || t.status === 'pending').length;

            // Filter paid orders for revenue calculation (status = 'paid' after approval)
            const approvedOrders = orders.filter((o: any) => o.status === 'paid');
            const totalRevenue = approvedOrders.reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);

            setStats({
                totalMembers: users.length,
                totalMembersChange: 0,
                activeLicenses,
                activeLicensesChange: 0,
                totalRevenue,
                totalRevenueChange: 0,
                pendingTickets,
                pendingTicketsChange: 0,
            });

            // Map recent approved orders to sales (real data only, no demo)
            const recentOrders = approvedOrders
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5)
                .map((o: any, index: number) => ({
                    id: o.id || index,
                    userName: o.user_full_name || o.user_email?.split('@')[0] || 'Unknown',
                    email: o.user_email || '',
                    tier: o.app_name || 'Standard',
                    amount: o.total_price || 0,
                    time: getTimeAgo(o.created_at),
                }));

            setRecentSales(recentOrders);

            // Calculate monthly revenue from orders (real data)
            const monthlyData = calculateMonthlyRevenue(approvedOrders, timeRange === '6months' ? 6 : 12);
            setMonthlyRevenue(monthlyData);

            // Calculate license distribution by app
            const appCounts: Record<string, number> = {};
            licenses.forEach((l: any) => {
                const appName = l.app_name || 'Unknown';
                appCounts[appName] = (appCounts[appName] || 0) + 1;
            });

            const colors = ['#2b8cee', '#7dd3fc', '#1e3a5f', '#60a5fa', '#3b82f6'];
            const total = licenses.length || 1;
            const distribution = Object.entries(appCounts).map(([name, count], index) => ({
                name,
                count,
                percentage: Math.round((count / total) * 100),
                color: colors[index % colors.length],
            }));

            setLicenseDistribution(distribution);

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Recalculate monthly revenue when time range changes
    useEffect(() => {
        if (!loading) {
            // Re-fetch to recalculate with new time range
            loadDashboardData();
        }
    }, [timeRange]);

    const calculateMonthlyRevenue = (orders: any[], monthsCount: number): MonthlyRevenue[] => {
        const now = new Date();
        const months: MonthlyRevenue[] = [];

        // Create array of last N months
        for (let i = monthsCount - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('vi-VN', { month: 'short' });
            months.push({ month: monthName, amount: 0 });
        }

        // Sum revenue per month
        orders.forEach((order: any) => {
            const orderDate = new Date(order.created_at);
            const monthsDiff = (now.getFullYear() - orderDate.getFullYear()) * 12 + (now.getMonth() - orderDate.getMonth());

            if (monthsDiff >= 0 && monthsDiff < monthsCount) {
                const index = monthsCount - 1 - monthsDiff;
                if (months[index]) {
                    months[index].amount += order.total_price || 0;
                }
            }
        });

        return months;
    };

    const getTimeAgo = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatNumber = (num: number) => {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toLocaleString();
    };

    const getTrendIcon = (change: number) => {
        if (change > 0) return <TrendingUp className="w-3 h-3" />;
        if (change < 0) return <TrendingDown className="w-3 h-3" />;
        return <Minus className="w-3 h-3" />;
    };

    const getTrendClass = (change: number) => {
        if (change > 0) return 'text-emerald-600 bg-emerald-50';
        if (change < 0) return 'text-rose-600 bg-rose-50';
        return 'text-slate-500 bg-slate-100';
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Generate SVG path from monthly revenue data
    const generateChartPath = () => {
        if (monthlyRevenue.length === 0) return { linePath: '', areaPath: '', points: [] };

        const maxAmount = Math.max(...monthlyRevenue.map(m => m.amount), 1);
        const width = 500;
        const height = 130;
        const padding = 20;

        const points: { x: number; y: number; amount: number }[] = monthlyRevenue.map((data, index) => {
            const x = padding + (index / (monthlyRevenue.length - 1 || 1)) * (width - padding * 2);
            const y = height - (data.amount / maxAmount) * (height - padding * 2) - padding;
            return { x, y: isNaN(y) ? height - padding : y, amount: data.amount };
        });

        if (points.length < 2) {
            return { linePath: '', areaPath: '', points: [] };
        }

        // Create smooth curve using quadratic bezier
        let linePath = `M${points[0].x},${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpX = (prev.x + curr.x) / 2;
            linePath += ` Q${cpX},${prev.y} ${cpX},${(prev.y + curr.y) / 2} T${curr.x},${curr.y}`;
        }

        // Create area path
        const areaPath = linePath + ` L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

        return { linePath, areaPath, points };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const totalLicenses = licenseDistribution.reduce((sum, item) => sum + item.count, 0);
    const { linePath, areaPath, points } = generateChartPath();

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
                <p className="text-muted-foreground text-sm">Theo dõi hiệu suất và thống kê hệ thống.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Members */}
                <Card className="bg-white shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-muted-foreground text-sm font-medium mb-2">Total Members</p>
                        <div className="flex items-end justify-between">
                            <h3 className="text-3xl font-bold">{formatNumber(stats.totalMembers)}</h3>
                            <span className={`flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded ${getTrendClass(stats.totalMembersChange)}`}>
                                {getTrendIcon(stats.totalMembersChange)}
                                {Math.abs(stats.totalMembersChange)}%
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Active Licenses */}
                <Card className="bg-white shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-muted-foreground text-sm font-medium mb-2">Active Licenses</p>
                        <div className="flex items-end justify-between">
                            <h3 className="text-3xl font-bold">{formatNumber(stats.activeLicenses)}</h3>
                            <span className={`flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded ${getTrendClass(stats.activeLicensesChange)}`}>
                                {getTrendIcon(stats.activeLicensesChange)}
                                {Math.abs(stats.activeLicensesChange)}%
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Revenue */}
                <Card className="bg-white shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-muted-foreground text-sm font-medium mb-2">Total Revenue</p>
                        <div className="flex items-end justify-between">
                            <h3 className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</h3>
                            <span className={`flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded ${getTrendClass(stats.totalRevenueChange)}`}>
                                {getTrendIcon(stats.totalRevenueChange)}
                                {Math.abs(stats.totalRevenueChange)}%
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Tickets */}
                <Card className="bg-white shadow-sm">
                    <CardContent className="p-6">
                        <p className="text-muted-foreground text-sm font-medium mb-2">Pending Tickets</p>
                        <div className="flex items-end justify-between">
                            <h3 className="text-3xl font-bold">{stats.pendingTickets}</h3>
                            <span className={`flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded ${getTrendClass(stats.pendingTicketsChange)}`}>
                                {getTrendIcon(stats.pendingTicketsChange)}
                                {Math.abs(stats.pendingTicketsChange)}%
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Middle Section: Chart & Recent Sales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Analytics Chart */}
                <Card className="lg:col-span-2 bg-white shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Revenue Analytics</CardTitle>
                                <p className="text-sm text-muted-foreground">Monthly growth and performance</p>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setTimeRange('6months')}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeRange === '6months' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    6 Months
                                </button>
                                <button
                                    onClick={() => setTimeRange('1year')}
                                    className={`px-3 py-1 text-xs font-medium transition-colors ${timeRange === '1year' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    1 Year
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="relative h-[240px] w-full">
                            {monthlyRevenue.length > 0 && monthlyRevenue.some(m => m.amount > 0) ? (
                                <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#2b8cee" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#2b8cee" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d={areaPath}
                                        fill="url(#chartGradient)"
                                    />
                                    <path
                                        d={linePath}
                                        fill="none"
                                        stroke="#2b8cee"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                    />
                                    {points.map((point, index) => (
                                        <g key={index}>
                                            <circle cx={point.x} cy={point.y} r="4" fill="white" stroke="#2b8cee" strokeWidth="2" />
                                            <title>{formatCurrency(point.amount)}</title>
                                        </g>
                                    ))}
                                </svg>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <p>Chưa có dữ liệu doanh thu</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between mt-4 px-2">
                            {monthlyRevenue.map((data, index) => (
                                <span key={index} className="text-xs font-bold text-slate-400">{data.month}</span>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Sales */}
                <Card className="bg-white shadow-sm">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Recent Sales</CardTitle>
                            <a href="#" className="text-primary text-sm font-semibold hover:underline">View All</a>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {recentSales.length > 0 ? (
                            <div className="space-y-5">
                                {recentSales.map((sale) => (
                                    <div key={sale.id} className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-bold">
                                                {getInitials(sale.userName)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate">{sale.userName}</p>
                                            <p className="text-xs text-muted-foreground">{sale.tier}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-primary">{formatCurrency(sale.amount)}</p>
                                            <p className="text-[10px] text-muted-foreground">{sale.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">Chưa có đơn hàng nào được duyệt</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Section - License Distribution only */}
            <div className="grid grid-cols-1 gap-6">
                {/* License Distribution */}
                <Card className="bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">License Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {licenseDistribution.length > 0 ? (
                            <div className="flex items-center gap-12">
                                {/* Pie Chart */}
                                <div className="relative w-40 h-40">
                                    <svg className="w-full h-full" viewBox="0 0 36 36">
                                        <circle
                                            className="stroke-slate-100"
                                            cx="18"
                                            cy="18"
                                            r="16"
                                            fill="none"
                                            strokeWidth="4"
                                        />
                                        {licenseDistribution.map((item, index) => {
                                            const offset = licenseDistribution
                                                .slice(0, index)
                                                .reduce((sum, i) => sum + i.percentage, 0);
                                            return (
                                                <circle
                                                    key={item.name}
                                                    style={{ stroke: item.color }}
                                                    cx="18"
                                                    cy="18"
                                                    r="16"
                                                    fill="none"
                                                    strokeWidth="4"
                                                    strokeDasharray={`${item.percentage} 100`}
                                                    strokeDashoffset={-offset}
                                                    transform="rotate(-90 18 18)"
                                                />
                                            );
                                        })}
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <p className="text-xs text-muted-foreground font-medium">Total</p>
                                        <p className="text-lg font-bold">{formatNumber(totalLicenses)}</p>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="flex-1 space-y-4">
                                    {licenseDistribution.map((item) => (
                                        <div key={item.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: item.color }}
                                                />
                                                <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                                            </div>
                                            <p className="text-sm font-bold">{formatNumber(item.count)} ({item.percentage}%)</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">Chưa có license nào</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
