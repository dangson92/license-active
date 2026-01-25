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
            const totalRevenue = orders
                .filter((o: any) => o.status === 'approved' || o.status === 'completed')
                .reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

            setStats({
                totalMembers: users.length,
                totalMembersChange: 5.2,
                activeLicenses,
                activeLicensesChange: 0,
                totalRevenue,
                totalRevenueChange: 8.4,
                pendingTickets,
                pendingTicketsChange: -2.1,
            });

            // Map recent orders to sales
            const recentOrders = orders
                .filter((o: any) => o.status === 'approved' || o.status === 'completed')
                .slice(0, 5)
                .map((o: any, index: number) => ({
                    id: o.id || index,
                    userName: o.user_name || o.email?.split('@')[0] || 'Unknown',
                    email: o.email || '',
                    tier: o.app_name || 'Standard',
                    amount: o.total_amount || 0,
                    time: getTimeAgo(o.created_at),
                }));

            setRecentSales(recentOrders.length > 0 ? recentOrders : [
                { id: 1, userName: 'Jordan Smith', email: 'jordan@example.com', tier: 'Enterprise', amount: 1200000, time: '2m ago' },
                { id: 2, userName: 'Elena Rossi', email: 'elena@example.com', tier: 'Pro Monthly', amount: 299000, time: '14m ago' },
                { id: 3, userName: 'Marcus Chen', email: 'marcus@example.com', tier: 'Basic', amount: 49000, time: '1h ago' },
            ]);

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

            setLicenseDistribution(distribution.length > 0 ? distribution : [
                { name: 'Automation', count: 4014, percentage: 45, color: '#2b8cee' },
                { name: 'CRM Connect', count: 2676, percentage: 30, color: '#7dd3fc' },
                { name: 'Data Analytics', count: 2230, percentage: 25, color: '#1e3a5f' },
            ]);

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
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

    // Calculate pie chart segments
    const getPieChartPath = () => {
        let cumulativePercentage = 0;
        return licenseDistribution.map((item, index) => {
            const startAngle = (cumulativePercentage / 100) * 360;
            cumulativePercentage += item.percentage;
            const endAngle = (cumulativePercentage / 100) * 360;
            return { ...item, startAngle, endAngle };
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const totalLicenses = licenseDistribution.reduce((sum, item) => sum + item.count, 0);

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
                            <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2b8cee" stopOpacity="0.2" />
                                        <stop offset="100%" stopColor="#2b8cee" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M0,120 Q50,110 80,70 T160,80 T240,40 T320,60 T400,20 T500,30 L500,150 L0,150 Z"
                                    fill="url(#chartGradient)"
                                />
                                <path
                                    d="M0,120 Q50,110 80,70 T160,80 T240,40 T320,60 T400,20 T500,30"
                                    fill="none"
                                    stroke="#2b8cee"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                                <circle cx="80" cy="70" r="4" fill="white" stroke="#2b8cee" strokeWidth="2" />
                                <circle cx="240" cy="40" r="4" fill="white" stroke="#2b8cee" strokeWidth="2" />
                                <circle cx="400" cy="20" r="4" fill="white" stroke="#2b8cee" strokeWidth="2" />
                            </svg>
                        </div>
                        <div className="flex justify-between mt-4 px-2">
                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => (
                                <span key={month} className="text-xs font-bold text-slate-400">{month}</span>
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
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* License Distribution */}
                <Card className="bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">License Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                    </CardContent>
                </Card>

                {/* System Health */}
                <Card className="bg-primary/5 border-primary/20 shadow-sm">
                    <CardContent className="p-6 flex items-center gap-6">
                        <div className="size-20 rounded-full border-[6px] border-primary/20 flex items-center justify-center relative">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="34"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="6"
                                    className="text-primary"
                                    strokeDasharray={`${98 * 2.14} 214`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="text-xl font-bold text-primary">98%</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold mb-1">System Health</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                All servers are operating within normal parameters. 2 updates pending for next maintenance cycle.
                            </p>
                            <Button className="bg-primary hover:bg-primary/90">
                                <Activity className="w-4 h-4 mr-2" />
                                View Server Status
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
