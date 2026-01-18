import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, DollarSign, Upload, Image } from 'lucide-react';

interface ApplicationSettingProps {
    appId?: string;
    appName?: string;
    onBack: () => void;
    onSave?: (data: any) => void;
}

export const ApplicationSetting: React.FC<ApplicationSettingProps> = ({
    appId,
    appName = 'Cloud Suite Pro',
    onBack,
    onSave
}) => {
    const [formData, setFormData] = useState({
        name: appName,
        description: 'Cloud Suite Pro is an enterprise-grade solution designed to streamline workflow orchestration.',
        iconUrl: '',
        price1Month: 29,
        price6Months: 149,
        price1Year: 249,
        isActive: true,
        isPublic: false,
    });
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);

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

    const handleSave = () => {
        onSave?.({ ...formData, iconFile });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h2 className="text-sm font-semibold">Edit Application</h2>
                    <p className="text-xs text-muted-foreground">{formData.name}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <Button variant="outline" onClick={onBack}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
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

                {/* Pricing Tiers */}
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold">Pricing Tiers</h3>
                        <p className="text-sm text-muted-foreground">
                            Define the subscription costs for different duration options.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 1 Month */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="mb-4">
                                    <Label className="font-bold">1 Month</Label>
                                    <p className="text-xs text-muted-foreground">Short-term access tier</p>
                                </div>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={formData.price1Month}
                                        onChange={(e) => handleInputChange('price1Month', parseFloat(e.target.value))}
                                        className="pl-8"
                                        placeholder="0.00"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* 6 Months - Popular */}
                        <Card className="border-primary ring-1 ring-primary relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
                                Most Popular
                            </div>
                            <CardContent className="pt-6">
                                <div className="mb-4">
                                    <Label className="font-bold">6 Months</Label>
                                    <p className="text-xs text-muted-foreground">Standard business cycle</p>
                                </div>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={formData.price6Months}
                                        onChange={(e) => handleInputChange('price6Months', parseFloat(e.target.value))}
                                        className="pl-8"
                                        placeholder="0.00"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* 1 Year */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="mb-4">
                                    <Label className="font-bold">1 Year</Label>
                                    <p className="text-xs text-muted-foreground">Annual commitment rate</p>
                                </div>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={formData.price1Year}
                                        onChange={(e) => handleInputChange('price1Year', parseFloat(e.target.value))}
                                        className="pl-8"
                                        placeholder="0.00"
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
                    <Button onClick={handleSave}>
                        Save Application
                    </Button>
                </div>
            </div>
        </div>
    );
};
