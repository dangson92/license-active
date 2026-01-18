import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
    Sparkles,
    Shield,
    BarChart3,
    Database,
    ShoppingBag,
    Search
} from 'lucide-react';

// Mock applications data
const applications = [
    {
        id: 1,
        name: 'Workflow Automator',
        description: 'Optimize cross-departmental tasks with AI-driven sequencing.',
        icon: Sparkles,
        iconBg: 'bg-sky-50 text-primary border-sky-100',
        badge: 'POPULAR',
        badgeClass: 'bg-primary/10 text-primary border-primary/20',
        prices: { '1m': 10, '6m': 50, '1y': 90 }
    },
    {
        id: 2,
        name: 'Sentinel Shield',
        description: 'Enterprise-grade security perimeter for your automation workflows.',
        icon: Shield,
        iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        prices: { '1m': 25, '6m': 120, '1y': 200 }
    },
    {
        id: 3,
        name: 'Metrics Engine',
        description: 'Deep-dive analytics dashboard that visualizes ROI in real-time.',
        icon: BarChart3,
        iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        badge: 'NEW',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        prices: { '1m': 15, '6m': 75, '1y': 130 }
    },
    {
        id: 4,
        name: 'Data Synchronizer',
        description: 'Bi-directional data syncing between legacy and cloud systems.',
        icon: Database,
        iconBg: 'bg-orange-50 text-orange-600 border-orange-100',
        prices: { '1m': 20, '6m': 100, '1y': 180 }
    }
];

interface ApplicationStoreProps {
    onCheckout?: (appId: number, duration: string, price: number) => void;
}

export const ApplicationStore: React.FC<ApplicationStoreProps> = ({ onCheckout }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedPricing, setSelectedPricing] = useState<Record<number, string>>({});

    const handlePricingChange = (appId: number, duration: string) => {
        setSelectedPricing(prev => ({ ...prev, [appId]: duration }));
    };

    const getSelectedDuration = (appId: number) => {
        return selectedPricing[appId] || '1m';
    };

    const handleRegister = (app: typeof applications[0]) => {
        const duration = getSelectedDuration(app.id);
        const price = app.prices[duration as keyof typeof app.prices];
        onCheckout?.(app.id, duration, price);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight">Application Store</h1>
                    <p className="text-muted-foreground mt-3 text-lg max-w-2xl">
                        Nâng cấp hệ thống SD Automation với các phần mềm enterprise được tuyển chọn.
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
                                <SelectItem value="workflow">Workflow Engine</SelectItem>
                                <SelectItem value="security">Security Suite</SelectItem>
                                <SelectItem value="analytics">Analytics & Reporting</SelectItem>
                                <SelectItem value="developer">Developer Tools</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Application Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {applications.map((app) => {
                    const Icon = app.icon;
                    const selectedDuration = getSelectedDuration(app.id);

                    return (
                        <Card key={app.id} className="hover:shadow-xl transition-all duration-300 flex flex-col group">
                            <CardContent className="pt-6 flex-1 flex flex-col">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`size-14 rounded-xl flex items-center justify-center border ${app.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                                        <Icon className="w-8 h-8" />
                                    </div>
                                    {app.badge && (
                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${app.badgeClass}`}>
                                            {app.badge}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <h3 className="text-lg font-bold mb-2">{app.name}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{app.description}</p>

                                {/* Pricing Options */}
                                <div className="space-y-2 mb-6 flex-1">
                                    {[
                                        { key: '1m', label: '1 Month' },
                                        { key: '6m', label: '6 Months' },
                                        { key: '1y', label: '1 Year' }
                                    ].map((option) => (
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
                                                ${app.prices[option.key as keyof typeof app.prices]}
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                {/* Action Button */}
                                <Button
                                    className="w-full shadow-lg shadow-primary/20"
                                    onClick={() => handleRegister(app)}
                                >
                                    Đăng ký ngay
                                    <ShoppingBag className="w-4 h-4 ml-2" />
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Footer */}
            <footer className="mt-16 pt-12 border-t">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-[13px] text-muted-foreground">
                    <p>© 2024 SD Automation Inc. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-foreground">Privacy Policy</a>
                        <a href="#" className="hover:text-foreground">Terms of Service</a>
                        <a href="#" className="hover:text-foreground">Cookie Settings</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
