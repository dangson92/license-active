import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Sparkles,
    Shield,
    BarChart3,
    Database,
    ShoppingBag,
    Loader2,
    Package
} from 'lucide-react';
import api from '../services/api';

interface StoreApp {
    id: number;
    code: string;
    name: string;
    description?: string;
    price_1_month?: number;
    price_1_month_enabled?: boolean;
    price_6_months?: number;
    price_6_months_enabled?: boolean;
    price_1_year?: number;
    price_1_year_enabled?: boolean;
    is_featured?: boolean;
    badge?: string;
    icon_class?: string;
}

// Icon mapping based on app code or name
const iconMap: Record<string, React.ElementType> = {
    default: Package,
    workflow: Sparkles,
    security: Shield,
    analytics: BarChart3,
    data: Database,
};

const colorMap: Record<string, string> = {
    default: 'bg-blue-50 text-blue-600 border-blue-100',
    workflow: 'bg-sky-50 text-sky-600 border-sky-100',
    security: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    analytics: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    data: 'bg-orange-50 text-orange-600 border-orange-100',
};

const badgeColors: Record<string, string> = {
    popular: 'bg-primary/10 text-primary border-primary/20',
    new: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    sale: 'bg-red-50 text-red-700 border-red-100',
};

interface ApplicationStoreProps {
    onCheckout?: (appId: number, duration: string, price: number, appName: string) => void;
}

export const ApplicationStore: React.FC<ApplicationStoreProps> = ({ onCheckout }) => {
    const [apps, setApps] = useState<StoreApp[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedPricing, setSelectedPricing] = useState<Record<number, string>>({});

    useEffect(() => {
        loadApps();
    }, []);

    const loadApps = async () => {
        try {
            const response = await api.store.getApps();
            setApps(response.items || []);
        } catch (error) {
            console.error('Failed to load apps:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePricingChange = (appId: number, duration: string) => {
        setSelectedPricing(prev => ({ ...prev, [appId]: duration }));
    };

    const getSelectedDuration = (appId: number) => {
        return selectedPricing[appId] || '1m';
    };

    const getAppIcon = (app: StoreApp) => {
        const code = app.code?.toLowerCase() || '';
        for (const key of Object.keys(iconMap)) {
            if (code.includes(key)) {
                return { Icon: iconMap[key], color: colorMap[key] };
            }
        }
        return { Icon: iconMap.default, color: colorMap.default };
    };

    const getPrice = (app: StoreApp, duration: string): number => {
        switch (duration) {
            case '1m': return app.price_1_month || 0;
            case '6m': return app.price_6_months || 0;
            case '1y': return app.price_1_year || 0;
            default: return 0;
        }
    };

    const getDurationMonths = (duration: string): number => {
        switch (duration) {
            case '1m': return 1;
            case '6m': return 6;
            case '1y': return 12;
            default: return 1;
        }
    };

    const handleRegister = (app: StoreApp) => {
        const duration = getSelectedDuration(app.id);
        const price = getPrice(app, duration);
        if (price > 0) {
            onCheckout?.(app.id, `${getDurationMonths(duration)} Tháng`, price, app.name);
        }
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'Liên hệ';
        return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Đang tải cửa hàng...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight">Application Store</h1>
                    <p className="text-muted-foreground mt-3 text-lg max-w-2xl">
                        Nâng cấp hệ thống với các phần mềm được tuyển chọn.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filter</span>
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="border-none bg-transparent p-0 pr-6 h-auto focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Solutions</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Application Grid */}
            {apps.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Chưa có ứng dụng nào trong cửa hàng.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {apps.map((app) => {
                        const { Icon, color } = getAppIcon(app);
                        const selectedDuration = getSelectedDuration(app.id);
                        const hasPricing = app.price_1_month || app.price_6_months || app.price_1_year;

                        return (
                            <Card key={app.id} className="hover:shadow-xl transition-all duration-300 flex flex-col group">
                                <CardContent className="pt-6 flex-1 flex flex-col">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`size-14 rounded-xl flex items-center justify-center border ${color} group-hover:scale-110 transition-transform duration-300`}>
                                            <Icon className="w-8 h-8" />
                                        </div>
                                        {app.badge && (
                                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${badgeColors[app.badge.toLowerCase()] || badgeColors.popular}`}>
                                                {app.badge.toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <h3 className="text-lg font-bold mb-2">{app.name}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                                        {app.description || `License cho ${app.name}`}
                                    </p>

                                    {/* Pricing Options */}
                                    {hasPricing && (
                                        <div className="space-y-2 mb-6 flex-1">
                                            {[
                                                { key: '1m', label: '1 Tháng', price: app.price_1_month, enabled: app.price_1_month_enabled !== false },
                                                { key: '6m', label: '6 Tháng', price: app.price_6_months, enabled: app.price_6_months_enabled !== false },
                                                { key: '1y', label: '1 Năm', price: app.price_1_year, enabled: app.price_1_year_enabled !== false }
                                            ].filter(opt => opt.price && opt.enabled).map((option) => (
                                                <label
                                                    key={option.key}
                                                    className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${selectedDuration === option.key
                                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                        : 'border-muted hover:bg-muted/50'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`pricing-${app.id}`}
                                                        value={option.key}
                                                        checked={selectedDuration === option.key}
                                                        onChange={() => handlePricingChange(app.id, option.key)}
                                                        className="hidden"
                                                    />
                                                    <span className={`text-xs font-semibold ${selectedDuration === option.key ? 'text-primary' : 'text-muted-foreground'}`}>
                                                        {option.label}
                                                    </span>
                                                    <span className={`text-sm font-bold ${selectedDuration === option.key ? 'text-primary' : ''}`}>
                                                        {formatPrice(option.price)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <Button
                                        className="w-full shadow-lg shadow-primary/20"
                                        onClick={() => handleRegister(app)}
                                        disabled={!hasPricing}
                                    >
                                        {hasPricing ? 'Đăng ký ngay' : 'Liên hệ'}
                                        <ShoppingBag className="w-4 h-4 ml-2" />
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Footer */}
            <footer className="mt-16 pt-12 border-t">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-[13px] text-muted-foreground">
                    <p>© 2024 SD Automation Inc. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-foreground">Privacy Policy</a>
                        <a href="#" className="hover:text-foreground">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
