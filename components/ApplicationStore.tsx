import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Sparkles,
    Shield,
    BarChart3,
    Database,
    ShoppingBag,
    Loader2,
    Package,
    Boxes,
    Gift,
    CheckCircle,
    ArrowRight,
    Eye,
    Tag,
    Percent,
} from 'lucide-react';
import api, { getAssetUrl } from '../services/api';

// ─── Types ───────────────────────────────────────────────────────

interface StoreApp {
    id: number;
    code: string;
    name: string;
    description?: string;
    icon_url?: string;
    price_1_month?: number;
    price_1_month_enabled?: boolean;
    price_6_months?: number;
    price_6_months_enabled?: boolean;
    price_1_year?: number;
    price_1_year_enabled?: boolean;
    is_featured?: boolean;
    badge?: string;
    icon_class?: string;
    trial_enabled?: boolean;
    type: 'app';
}

interface SoftwarePackage {
    id: number;
    code: string;
    name: string;
    description?: string;
    icon_url?: string;
    price_1_month?: number;
    price_1_month_enabled?: boolean;
    price_6_months?: number;
    price_6_months_enabled?: boolean;
    price_1_year?: number;
    price_1_year_enabled?: boolean;
    is_featured?: boolean;
    badge?: string;
    discount_percent?: number;       // legacy, no longer used
    // Auto-calculated from individual app prices:
    sum_price_1_month?: number;
    sum_price_6_months?: number;
    sum_price_1_year?: number;
    included_apps?: string;
    included_app_icons?: string;
    app_count?: number;
    type: 'package';
}

type StoreItem = StoreApp | SoftwarePackage;

// ─── Icon / Color Helpers ─────────────────────────────────────────

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
    hot: 'bg-orange-50 text-orange-700 border-orange-100',
    'best value': 'bg-amber-50 text-amber-700 border-amber-100',
};

const getAppIcon = (code: string = '') => {
    const c = code.toLowerCase();
    for (const key of Object.keys(iconMap)) {
        if (c.includes(key)) return { Icon: iconMap[key], color: colorMap[key] };
    }
    return { Icon: iconMap.default, color: colorMap.default };
};

const formatPrice = (price?: number) => {
    if (!price) return 'Liên hệ';
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

// ─── Savings Calculator ──────────────────────────────────────────
// Returns savings % (e.g. 16.7) or null if package isn't cheaper
const calcSavingsPct = (pkgPrice?: number, sumPrice?: number): number | null => {
    if (!pkgPrice || !sumPrice || sumPrice <= 0 || pkgPrice >= sumPrice) return null;
    return Math.round((1 - pkgPrice / sumPrice) * 1000) / 10;
};

// ─── Props ────────────────────────────────────────────────────────


interface ApplicationStoreProps {
    onCheckout?: (
        itemId: number,
        itemType: 'app' | 'package',
        duration: string,
        price: number,
        itemName: string
    ) => void;
}

// ─── Component ───────────────────────────────────────────────────

export const ApplicationStore: React.FC<ApplicationStoreProps> = ({ onCheckout }) => {
    const navigate = useNavigate();

    const [apps, setApps] = useState<StoreApp[]>([]);
    const [packages, setPackages] = useState<SoftwarePackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'app' | 'package'>('all');
    const [selectedPricing, setSelectedPricing] = useState<Record<string, string>>({});

    // Trial state (apps only)
    const [trialLoading, setTrialLoading] = useState<number | null>(null);
    const [trialSuccess, setTrialSuccess] = useState<Record<number, boolean>>({});
    const [trialConfirmApp, setTrialConfirmApp] = useState<StoreApp | null>(null);
    const [trialSuccessApp, setTrialSuccessApp] = useState<StoreApp | null>(null);

    // Detail modal
    const [descriptionItem, setDescriptionItem] = useState<StoreItem | null>(null);

    useEffect(() => { loadStore(); }, []);

    const loadStore = async () => {
        try {
            const [appsRes, packagesRes, licensesRes] = await Promise.all([
                api.store.getApps(),
                api.store.getPackages(),
                api.user.getLicenses().catch(() => ({ items: [] })),
            ]);

            const rawApps: StoreApp[] = (appsRes.items || []).map((a: any) => ({ ...a, type: 'app' as const }));
            const rawPkgs: SoftwarePackage[] = (packagesRes.items || []).map((p: any) => ({ ...p, type: 'package' as const }));

            setApps(rawApps);
            setPackages(rawPkgs);

            // Pre-populate trialSuccess
            const existingTrials: Record<number, boolean> = {};
            for (const lic of licensesRes.items || []) {
                if (lic.is_trial && lic.app_id) existingTrials[lic.app_id] = true;
            }
            if (Object.keys(existingTrials).length > 0) setTrialSuccess(existingTrials);
        } catch (error) {
            console.error('Failed to load store:', error);
        } finally {
            setLoading(false);
        }
    };

    // Unified list with filter support
    const allItems: StoreItem[] = [
        ...(filter !== 'package' ? apps : []),
        ...(filter !== 'app' ? packages : []),
    ].sort((a, b) => {
        const fa = a.is_featured ? 1 : 0;
        const fb = b.is_featured ? 1 : 0;
        return fb - fa || a.name.localeCompare(b.name);
    });

    // Key: "app-1" or "pkg-1" to avoid id collision
    const itemKey = (item: StoreItem) => `${item.type}-${item.id}`;

    const getSelectedDuration = (item: StoreItem) => selectedPricing[itemKey(item)] || '1m';

    const handlePricingChange = (item: StoreItem, duration: string) =>
        setSelectedPricing(prev => ({ ...prev, [itemKey(item)]: duration }));

    const getPrice = (item: StoreItem, duration: string): number => {
        switch (duration) {
            case '1m': return item.price_1_month || 0;
            case '6m': return item.price_6_months || 0;
            case '1y': return item.price_1_year || 0;
            default: return 0;
        }
    };

    const getDurationLabel = (d: string) => ({ '1m': '1 Tháng', '6m': '6 Tháng', '1y': '1 Năm' }[d] ?? '');

    const handleRegister = (item: StoreItem) => {
        const duration = getSelectedDuration(item);
        const price = getPrice(item, duration);
        if (price > 0) {
            onCheckout?.(item.id, item.type, getDurationLabel(duration), price, item.name);
        }
    };

    const handleTrial = async (app: StoreApp) => {
        if (trialLoading) return;
        setTrialLoading(app.id);
        try {
            await api.store.createTrial(app.id);
            setTrialSuccess(prev => ({ ...prev, [app.id]: true }));
            setTrialConfirmApp(null);
            setTrialSuccessApp(app);
        } catch (error: any) {
            const msg = error.message || '';
            setTrialConfirmApp(null);
            if (msg.includes('trial_already_used')) {
                alert('Bạn đã sử dụng trial cho ứng dụng này rồi.');
            } else {
                alert('Không thể tạo trial: ' + msg);
            }
        } finally {
            setTrialLoading(null);
        }
    };

    // ─── Render helpers ────────────────────────────────────────────

    const renderPricingOptions = (item: StoreItem) => {
        const hasPricing = item.price_1_month || item.price_6_months || item.price_1_year;
        if (!hasPricing) return null;
        const selectedDuration = getSelectedDuration(item);
        // For packages: map duration key to the sum_price field from API
        const sumPrices: Record<string, number | undefined> = item.type === 'package' ? {
            '1m': (item as SoftwarePackage).sum_price_1_month,
            '6m': (item as SoftwarePackage).sum_price_6_months,
            '1y': (item as SoftwarePackage).sum_price_1_year,
        } : {};

        const opts = [
            { key: '1m', label: '1 Tháng', price: item.price_1_month, enabled: item.price_1_month_enabled !== false },
            { key: '6m', label: '6 Tháng', price: item.price_6_months, enabled: item.price_6_months_enabled !== false },
            { key: '1y', label: '1 Năm', price: item.price_1_year, enabled: item.price_1_year_enabled !== false },
        ].filter(o => o.price && o.enabled);

        return (
            <div className="space-y-2 mb-6 flex-1">
                {opts.map(option => {
                    const savings = calcSavingsPct(option.price, sumPrices[option.key]);
                    return (
                        <label
                            key={option.key}
                            className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${selectedDuration === option.key
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-muted hover:bg-muted/50'
                                }`}
                        >
                            <input
                                type="radio"
                                name={`pricing-${itemKey(item)}`}
                                value={option.key}
                                checked={selectedDuration === option.key}
                                onChange={() => handlePricingChange(item, option.key)}
                                className="hidden"
                            />
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${selectedDuration === option.key ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {option.label}
                                </span>
                                {savings !== null && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                        -{savings}%
                                    </span>
                                )}
                            </div>
                            <span className={`text-sm font-bold ${selectedDuration === option.key ? 'text-primary' : ''}`}>
                                {formatPrice(option.price)}
                            </span>
                        </label>
                    );
                })}
            </div>
        );
    };

    // Package card — extra UI showing included apps + discount badge
    const renderPackageCard = (pkg: SoftwarePackage) => {
        const hasPricing = pkg.price_1_month || pkg.price_6_months || pkg.price_1_year;
        return (
            <Card key={itemKey(pkg)} className="hover:shadow-xl transition-all duration-300 flex flex-col group border-amber-200/60 relative overflow-hidden">
                {/* Package glow accent */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400" />

                <CardContent className="pt-6 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        {/* App logos — horizontal row */}
                        {(() => {
                            const appIcons = pkg.included_app_icons?.split(',').filter(Boolean) ?? [];
                            const icons = appIcons.slice(0, 4);
                            return (
                                <div className="flex items-center gap-1.5">
                                    {icons.length > 0 ? icons.map((iconUrl, i) => (
                                        <div key={i} className="w-10 h-10 rounded-lg border border-amber-100 overflow-hidden bg-white shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform duration-300" style={{ transitionDelay: `${i * 30}ms` }}>
                                            <img src={getAssetUrl(iconUrl) || ''} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    )) : pkg.icon_url ? (
                                        <div className="w-10 h-10 rounded-lg border border-amber-100 overflow-hidden bg-white shadow-sm flex-shrink-0">
                                            <img src={getAssetUrl(pkg.icon_url) || ''} alt={pkg.name} className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-center">
                                            <Boxes className="w-5 h-5 text-amber-600" />
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        <div className="flex flex-col items-end gap-1.5">
                            {/* PACKAGE badge */}
                            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full border bg-gradient-to-r from-amber-400 to-orange-400 text-white border-transparent">
                                GÓI PHẦN MỀM
                            </span>
                            {pkg.badge && (
                                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${badgeColors[pkg.badge.toLowerCase()] || badgeColors.popular}`}>
                                    {pkg.badge.toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Name */}
                    <h3 className="text-lg font-bold mb-1">{pkg.name}</h3>

                    {/* Auto-calculated savings badge for currently selected duration */}
                    {(() => {
                        const dur = getSelectedDuration(pkg);
                        const sumMap: Record<string, number | undefined> = {
                            '1m': pkg.sum_price_1_month,
                            '6m': pkg.sum_price_6_months,
                            '1y': pkg.sum_price_1_year,
                        };
                        const pkgPriceMap: Record<string, number | undefined> = {
                            '1m': pkg.price_1_month,
                            '6m': pkg.price_6_months,
                            '1y': pkg.price_1_year,
                        };
                        const savings = calcSavingsPct(pkgPriceMap[dur], sumMap[dur]);
                        if (!savings) return null;
                        return (
                            <div className="flex items-center gap-1 mb-2">
                                <Percent className="w-3 h-3 text-emerald-600" />
                                <span className="text-xs font-bold text-emerald-600">Tiết kiệm {savings}% so với mua lẻ</span>
                            </div>
                        );
                    })()}

                    {/* Included apps */}
                    {pkg.included_apps && (
                        <div className="mb-4 bg-amber-50/60 border border-amber-100 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5 flex items-center gap-1">
                                <Tag className="w-3 h-3" /> Bao gồm {pkg.app_count || ''} phần mềm
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{pkg.included_apps}</p>
                        </div>
                    )}

                    {/* Description */}
                    {pkg.description && (
                        <div className="mb-4">
                            <div
                                className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none line-clamp-3"
                                dangerouslySetInnerHTML={{ __html: pkg.description }}
                            />
                            <button
                                onClick={() => setDescriptionItem(pkg)}
                                className="text-xs text-primary font-semibold hover:underline mt-1.5 inline-flex items-center gap-1"
                            >
                                <Eye className="w-3 h-3" /> Xem thêm
                            </button>
                        </div>
                    )}

                    {/* Pricing */}
                    {renderPricingOptions(pkg)}

                    {/* Actions */}
                    <Button
                        className="w-full shadow-lg shadow-amber-500/20 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                        onClick={() => handleRegister(pkg)}
                        disabled={!hasPricing}
                    >
                        {hasPricing ? 'Đăng ký ngay' : 'Liên hệ'}
                        <ShoppingBag className="w-4 h-4 ml-2" />
                    </Button>
                </CardContent>
            </Card>
        );
    };

    // App card — original design
    const renderAppCard = (app: StoreApp) => {
        const { Icon, color } = getAppIcon(app.code);
        const selectedDuration = getSelectedDuration(app);
        const hasPricing = app.price_1_month || app.price_6_months || app.price_1_year;

        return (
            <Card key={itemKey(app)} className="hover:shadow-xl transition-all duration-300 flex flex-col group">
                <CardContent className="pt-6 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div className={`size-14 rounded-xl flex items-center justify-center border overflow-hidden ${app.icon_url ? 'bg-white' : color} group-hover:scale-110 transition-transform duration-300`}>
                            {app.icon_url ? (
                                <img src={getAssetUrl(app.icon_url) || ''} alt={app.name} className="w-full h-full object-cover" />
                            ) : (
                                <Icon className="w-8 h-8" />
                            )}
                        </div>
                        {app.badge && (
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${badgeColors[app.badge.toLowerCase()] || badgeColors.popular}`}>
                                {app.badge.toUpperCase()}
                            </span>
                        )}
                    </div>

                    {/* Info */}
                    <h3 className="text-lg font-bold mb-2">{app.name}</h3>
                    <div className="mb-6">
                        {app.description ? (
                            <>
                                <div
                                    className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none line-clamp-5 [&>p]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>a]:text-primary [&>a]:underline"
                                    dangerouslySetInnerHTML={{ __html: app.description }}
                                />
                                <button
                                    onClick={() => setDescriptionItem(app)}
                                    className="text-xs text-primary font-semibold hover:underline mt-1.5 inline-flex items-center gap-1"
                                >
                                    <Eye className="w-3 h-3" /> Xem thêm
                                </button>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground leading-relaxed">License cho {app.name}</p>
                        )}
                    </div>

                    {/* Pricing */}
                    {renderPricingOptions(app)}

                    {/* Actions */}
                    <div className="space-y-2">
                        <Button
                            className="w-full shadow-lg shadow-primary/20"
                            onClick={() => handleRegister(app)}
                            disabled={!hasPricing}
                        >
                            {hasPricing ? 'Đăng ký ngay' : 'Liên hệ'}
                            <ShoppingBag className="w-4 h-4 ml-2" />
                        </Button>

                        {!!app.trial_enabled && (
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                                onClick={() => setTrialConfirmApp(app)}
                                disabled={trialLoading === app.id || trialSuccess[app.id]}
                            >
                                {trialLoading === app.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : trialSuccess[app.id] ? (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                ) : (
                                    <Gift className="w-4 h-4 mr-2" />
                                )}
                                {trialSuccess[app.id] ? 'Đã kích hoạt trial' : 'Dùng thử 7 ngày'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    // ─── Loading ──────────────────────────────────────────────────

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

    // ─── Render ───────────────────────────────────────────────────

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight">Application Store</h1>
                    <p className="text-muted-foreground mt-3 text-lg max-w-2xl">
                        Nâng cấp hệ thống với các phần mềm và gói phần mềm được tuyển chọn.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filter</span>
                        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                            <SelectTrigger className="border-none bg-transparent p-0 pr-6 h-auto focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                <SelectItem value="app">Phần mềm đơn lẻ</SelectItem>
                                <SelectItem value="package">Gói Phần Mềm</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Grid */}
            {allItems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Không có sản phẩm nào trong cửa hàng.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {allItems.map(item =>
                        item.type === 'package'
                            ? renderPackageCard(item)
                            : renderAppCard(item)
                    )}
                </div>
            )}

            {/* ── Trial Confirm Dialog ── */}
            <Dialog open={!!trialConfirmApp} onOpenChange={(open) => { if (!open && !trialLoading) setTrialConfirmApp(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gift className="w-5 h-5 text-emerald-600" />
                            Dùng thử miễn phí
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-relaxed">
                            Bạn muốn dùng thử <span className="font-semibold text-foreground">{trialConfirmApp?.name}</span> miễn phí trong 7 ngày?
                            <br /><br />
                            Mỗi tài khoản chỉ được dùng thử 1 lần cho mỗi ứng dụng.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTrialConfirmApp(null)} disabled={!!trialLoading}>Huỷ</Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={!!trialLoading}
                            onClick={() => trialConfirmApp && handleTrial(trialConfirmApp)}
                        >
                            {trialLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
                            Xác nhận dùng thử
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Trial Success Dialog ── */}
            <Dialog open={!!trialSuccessApp} onOpenChange={(open) => { if (!open) setTrialSuccessApp(null); }}>
                <DialogContent className="sm:max-w-md">
                    <div className="flex flex-col items-center text-center py-4 space-y-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="text-lg font-bold">Đăng ký trial thành công!</h3>
                            <p className="text-sm text-muted-foreground">
                                Bạn đã kích hoạt trial 7 ngày cho <span className="font-semibold text-foreground">{trialSuccessApp?.name}</span>.
                            </p>
                        </div>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 w-full"
                            onClick={() => { setTrialSuccessApp(null); navigate('/user/licenses'); }}
                        >
                            Xem tại My Licenses
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Description Detail Modal ── */}
            <Dialog open={!!descriptionItem} onOpenChange={(open) => { if (!open) setDescriptionItem(null); }}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {descriptionItem?.type === 'package' ? (
                                <Boxes className="w-5 h-5 text-amber-500" />
                            ) : descriptionItem?.icon_url ? (
                                <img src={getAssetUrl(descriptionItem.icon_url) || ''} alt={descriptionItem.name} className="w-6 h-6 rounded object-cover" />
                            ) : null}
                            {descriptionItem?.name}
                        </DialogTitle>
                    </DialogHeader>
                    {descriptionItem?.description && (
                        <div
                            className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>a]:text-primary [&>a]:underline"
                            dangerouslySetInnerHTML={{ __html: descriptionItem.description }}
                        />
                    )}
                    {descriptionItem?.type === 'package' && (descriptionItem as SoftwarePackage).included_apps && (
                        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Phần mềm bao gồm</p>
                            <p className="text-sm text-muted-foreground">{(descriptionItem as SoftwarePackage).included_apps}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDescriptionItem(null)}>Đóng</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
