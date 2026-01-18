import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, DollarSign, Upload, Image, Loader2 } from 'lucide-react';
import api from '../services/api';

interface ApplicationSettingProps {
    appId?: string;
    appName?: string;
    onBack: () => void;
    onSave?: (data: any) => void;
}

export const ApplicationSetting: React.FC<ApplicationSettingProps> = ({
    appId,
    appName = 'Application',
    onBack,
    onSave
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        iconUrl: '',
        price1Month: 0,
        price6Months: 0,
        price1Year: 0,
        isActive: true,
        isPublic: false,
    });
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);

    useEffect(() => {
        loadAppData();
    }, [appId]);

    const loadAppData = async () => {
        if (!appId) {
            setLoading(false);
            return;
        }
        try {
            const app = await api.admin.getApp(parseInt(appId));
            setFormData({
                name: app.name || '',
                description: app.description || '',
                iconUrl: app.icon_url || '',
                price1Month: 0,
                price6Months: 0,
                price1Year: 0,
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
        if (!appId) return;
        setSaving(true);
        try {
            // Update app basic info
            await api.admin.updateApp(parseInt(appId), {
                name: formData.name,
                description: formData.description,
                is_active: formData.isActive
            });

            // Upload icon if changed
            if (iconFile) {
                await api.admin.uploadAppIcon(parseInt(appId), iconFile);
            }

            onSave?.(formData);
        } catch (error) {
            console.error('Failed to save app:', error);
            alert('Có lỗi khi lưu. Vui lòng thử lại.');
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
                    <h2 className="text-sm font-semibold">Edit Application</h2>
                    <p className="text-xs text-muted-foreground">{formData.name || appName}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <Button variant="outline" onClick={onBack}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </div>

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
                        Save Application
                    </Button>
                </div>
            </div>
        </div>
    );
};
