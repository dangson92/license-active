import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Upload, Image, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface ApplicationSettingProps {
    appId?: string;
    appName?: string;
    isNew?: boolean;
    onBack: () => void;
    onSave?: (data: any) => void;
}

export const ApplicationSetting: React.FC<ApplicationSettingProps> = ({
    appId,
    appName = 'Application',
    isNew = false,
    onBack,
    onSave
}) => {
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        iconUrl: '',
        price1Month: 0,
        price1MonthEnabled: true,
        price6Months: 0,
        price6MonthsEnabled: true,
        price1Year: 0,
        price1YearEnabled: true,
        isActive: true,
        isPublic: false,
    });
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!isNew && appId) {
            loadAppData();
        }
    }, [appId, isNew]);

    // Auto-hide message after 5 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const loadAppData = async () => {
        if (!appId) {
            setLoading(false);
            return;
        }
        try {
            const app = await api.admin.getApp(parseInt(appId));

            let pricing: any = {
                price_1_month: 0, price_1_month_enabled: true,
                price_6_months: 0, price_6_months_enabled: true,
                price_1_year: 0, price_1_year_enabled: true
            };
            try {
                const pricingRes = await api.store.getApp(parseInt(appId));
                if (pricingRes) {
                    pricing = pricingRes;
                }
            } catch (e) {
                // No pricing yet
            }

            setFormData({
                code: app.code || '',
                name: app.name || '',
                description: app.description || '',
                iconUrl: app.icon_url || '',
                price1Month: pricing.price_1_month || 0,
                price1MonthEnabled: pricing.price_1_month_enabled !== 0 && pricing.price_1_month_enabled !== false,
                price6Months: pricing.price_6_months || 0,
                price6MonthsEnabled: pricing.price_6_months_enabled !== 0 && pricing.price_6_months_enabled !== false,
                price1Year: pricing.price_1_year || 0,
                price1YearEnabled: pricing.price_1_year_enabled !== 0 && pricing.price_1_year_enabled !== false,
                isActive: app.is_active ?? true,
                isPublic: false,
            });
            if (app.icon_url) {
                setIconPreview(app.icon_url);
            }
        } catch (error) {
            console.error('Failed to load app:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIconFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setIconPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        // Validation
        if (isNew && (!formData.code || !formData.name)) {
            setMessage({ type: 'error', text: 'Vui lòng nhập mã và tên ứng dụng!' });
            return;
        }
        if (!isNew && !formData.name) {
            setMessage({ type: 'error', text: 'Vui lòng nhập tên ứng dụng!' });
            return;
        }

        setSaving(true);
        try {
            let targetAppId = appId ? parseInt(appId) : 0;

            if (isNew) {
                // Create new app
                const result = await api.admin.createApp({
                    code: formData.code,
                    name: formData.name,
                    description: formData.description,
                });
                targetAppId = result.id;
            } else {
                // Update existing app
                await api.admin.updateApp(targetAppId, {
                    name: formData.name,
                    description: formData.description,
                    is_active: formData.isActive
                });
            }

            // Upload icon if changed
            if (iconFile && targetAppId) {
                await api.admin.uploadAppIcon(targetAppId, iconFile);
            }

            // Save pricing
            if (targetAppId) {
                await api.store.savePricing({
                    app_id: targetAppId,
                    description: formData.description || '',
                    price_1_month: formData.price1Month || 0,
                    price_1_month_enabled: formData.price1MonthEnabled,
                    price_6_months: formData.price6Months || 0,
                    price_6_months_enabled: formData.price6MonthsEnabled,
                    price_1_year: formData.price1Year || 0,
                    price_1_year_enabled: formData.price1YearEnabled,
                });
            }

            onSave?.(formData);
            console.log('Save successful, setting message...');
            setMessage({ type: 'success', text: '✓ Đã lưu ứng dụng thành công!' });
            console.log('Message set!');
        } catch (error) {
            console.error('Failed to save app:', error);
            setMessage({ type: 'error', text: '✕ Có lỗi khi lưu. Vui lòng thử lại.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h2 className="text-sm font-semibold">{isNew ? 'Create Application' : 'Edit Application'}</h2>
                    <p className="text-xs text-muted-foreground">{formData.name || appName || 'New Application'}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <Button variant="outline" onClick={onBack}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isNew ? 'Create Application' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`flex items-center gap-2 p-4 rounded-lg transition-all ${message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="h-5 w-5" />
                    ) : (
                        <AlertCircle className="h-5 w-5" />
                    )}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            <div className="max-w-4xl space-y-8">
                {/* Application Details */}
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold">Application Details</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure the primary information and description of your application.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* App Code - only for new apps */}
                        {isNew && (
                            <div className="space-y-2">
                                <Label htmlFor="code">Application Code</Label>
                                <Input
                                    id="code"
                                    value={formData.code}
                                    onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                                    placeholder="APP001"
                                />
                                <p className="text-xs text-muted-foreground">Mã định danh (không thể thay đổi sau khi tạo)</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="name">Application Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Cloud Suite Pro"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Application Icon</Label>
                            <div className="flex items-center gap-4">
                                <div className="size-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                                    {iconPreview || formData.iconUrl ? (
                                        <img src={iconPreview || formData.iconUrl} alt="Icon" className="w-full h-full object-cover" />
                                    ) : (
                                        <Image className="w-8 h-8 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="relative flex-1">
                                    <input
                                        type="file"
                                        id="icon-upload"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={handleIconChange}
                                    />
                                    <Button variant="outline" className="w-full" asChild>
                                        <label htmlFor="icon-upload" className="cursor-pointer">
                                            <Upload className="w-4 h-4 mr-2" />
                                            {iconFile ? iconFile.name : 'Upload Icon'}
                                        </label>
                                    </Button>
                                    <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG max 500KB</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="description">Application Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                placeholder="Provide a detailed description..."
                                className="min-h-[120px] resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border w-full"></div>

                {/* Pricing Tiers */}
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold">Pricing Tiers</h3>
                        <p className="text-sm text-muted-foreground">
                            Define the subscription costs for different duration options.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 1 Tháng */}
                        <Card className={!formData.price1MonthEnabled ? 'opacity-50' : ''}>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <Label className="font-bold">1 Tháng</Label>
                                        <p className="text-xs text-muted-foreground">Gói ngắn hạn</p>
                                    </div>
                                    <Switch
                                        checked={formData.price1MonthEnabled}
                                        onCheckedChange={(checked) => handleInputChange('price1MonthEnabled', checked)}
                                    />
                                </div>
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₫</span>
                                    <Input
                                        type="text"
                                        value={formData.price1Month ? formData.price1Month.toLocaleString('vi-VN') : ''}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/[^0-9]/g, '');
                                            handleInputChange('price1Month', parseInt(value) || 0);
                                        }}
                                        className="pr-8"
                                        placeholder="0"
                                        disabled={!formData.price1MonthEnabled}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* 6 Tháng - Phổ biến */}
                        <Card className={`border-primary ring-1 ring-primary relative ${!formData.price6MonthsEnabled ? 'opacity-50' : ''}`}>
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
                                Phổ biến nhất
                            </div>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <Label className="font-bold">6 Tháng</Label>
                                        <p className="text-xs text-muted-foreground">Gói tiêu chuẩn</p>
                                    </div>
                                    <Switch
                                        checked={formData.price6MonthsEnabled}
                                        onCheckedChange={(checked) => handleInputChange('price6MonthsEnabled', checked)}
                                    />
                                </div>
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₫</span>
                                    <Input
                                        type="text"
                                        value={formData.price6Months ? formData.price6Months.toLocaleString('vi-VN') : ''}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/[^0-9]/g, '');
                                            handleInputChange('price6Months', parseInt(value) || 0);
                                        }}
                                        className="pr-8"
                                        placeholder="0"
                                        disabled={!formData.price6MonthsEnabled}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* 1 Năm */}
                        <Card className={!formData.price1YearEnabled ? 'opacity-50' : ''}>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <Label className="font-bold">1 Năm</Label>
                                        <p className="text-xs text-muted-foreground">Gói dài hạn</p>
                                    </div>
                                    <Switch
                                        checked={formData.price1YearEnabled}
                                        onCheckedChange={(checked) => handleInputChange('price1YearEnabled', checked)}
                                    />
                                </div>
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₫</span>
                                    <Input
                                        type="text"
                                        value={formData.price1Year ? formData.price1Year.toLocaleString('vi-VN') : ''}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/[^0-9]/g, '');
                                            handleInputChange('price1Year', parseInt(value) || 0);
                                        }}
                                        className="pr-8"
                                        placeholder="0"
                                        disabled={!formData.price1YearEnabled}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border w-full"></div>

                {/* Advanced Settings */}
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold">Advanced Settings</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure technical parameters and visibility.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Active Status</Label>
                                <p className="text-xs text-muted-foreground">
                                    Make this application visible for new licenses.
                                </p>
                            </div>
                            <Switch
                                checked={formData.isActive}
                                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Public Access</Label>
                                <p className="text-xs text-muted-foreground">
                                    Allow users to view details without logging in.
                                </p>
                            </div>
                            <Switch
                                checked={formData.isPublic}
                                onCheckedChange={(checked) => handleInputChange('isPublic', checked)}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-6 flex justify-end gap-3">
                    <Button variant="outline" onClick={onBack}>
                        Discard Changes
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isNew ? 'Create Application' : 'Save Application'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
