import React, { useState, useEffect } from 'react';
import { App } from '../types';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Icons
import {
    Key,
    RefreshCw,
    Copy,
    Check,
    ArrowLeft,
    Calendar,
    Monitor,
    AppWindow
} from 'lucide-react';

interface CreateLicenseProps {
    apps: App[];
    users: any[];
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateLicense: React.FC<CreateLicenseProps> = ({
    apps,
    users,
    onBack,
    onSuccess
}) => {
    const [selectedApp, setSelectedApp] = useState<string>('');
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [expirationDate, setExpirationDate] = useState<string>('');
    const [maxDevices, setMaxDevices] = useState<number>(1);
    const [generatedKey, setGeneratedKey] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [creating, setCreating] = useState(false);

    // Set default expiration date (1 month from now)
    useEffect(() => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        setExpirationDate(date.toISOString().split('T')[0]);
    }, []);

    const generateGUID = () => {
        // Generate a proper GUID/UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const hex = '0123456789abcdef';
        let guid = '';

        for (let i = 0; i < 36; i++) {
            if (i === 8 || i === 13 || i === 18 || i === 23) {
                guid += '-';
            } else if (i === 14) {
                guid += '4'; // Version 4
            } else if (i === 19) {
                guid += hex.charAt((Math.random() * 4) | 8); // Variant bits
            } else {
                guid += hex.charAt(Math.floor(Math.random() * 16));
            }
        }

        setGeneratedKey(guid);
        return guid;
    };

    const handleCopyKey = async () => {
        if (!generatedKey) return;
        try {
            await navigator.clipboard.writeText(generatedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleSubmit = async () => {
        if (!selectedApp || !selectedUser) {
            alert('Vui lòng chọn ứng dụng và user!');
            return;
        }

        if (!expirationDate) {
            alert('Vui lòng chọn ngày hết hạn!');
            return;
        }

        try {
            setCreating(true);
            const expiresAt = new Date(expirationDate);

            const result = await api.admin.createLicense({
                user_id: parseInt(selectedUser),
                app_id: parseInt(selectedApp),
                max_devices: maxDevices,
                expires_at: expiresAt.toISOString(),
                status: 'active',
            });

            setGeneratedKey(result.license_key);
            alert(`License key đã được tạo thành công!\n\nKey: ${result.license_key}`);
            onSuccess();
        } catch (error: any) {
            alert(`Không thể tạo license key!\n\nLỗi: ${error.message}`);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Back button and Title */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create New License</h1>
                    <p className="text-muted-foreground text-sm">Cấu hình thông số cho license mới.</p>
                </div>
            </div>

            {/* Main Form Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Key className="w-5 h-5 text-blue-600" />
                        License Configuration
                    </CardTitle>
                    <CardDescription>
                        Điền đầy đủ thông tin để tạo license key mới.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Select Application */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <AppWindow className="w-4 h-4" />
                                Chọn ứng dụng
                            </Label>
                            <Select value={selectedApp} onValueChange={setSelectedApp}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn ứng dụng..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {apps.map(app => (
                                        <SelectItem key={app.id} value={app.id.toString()}>
                                            {app.name} ({app.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Select User */}
                        <div className="space-y-2">
                            <Label>Gán cho User</Label>
                            <Select value={selectedUser} onValueChange={setSelectedUser}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn user..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.id.toString()}>
                                            {u.full_name} ({u.email})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Expiration Date */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Ngày hết hạn
                            </Label>
                            <Input
                                type="date"
                                value={expirationDate}
                                onChange={(e) => setExpirationDate(e.target.value)}
                            />
                        </div>

                        {/* Max Devices */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Monitor className="w-4 h-4" />
                                Số device tối đa
                            </Label>
                            <Input
                                type="number"
                                min="1"
                                max="100"
                                value={maxDevices}
                                onChange={(e) => setMaxDevices(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    {/* Generated License Key */}
                    <div className="space-y-2 pt-4 border-t">
                        <Label className="flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            License Key
                        </Label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Input
                                    type="text"
                                    value={generatedKey}
                                    placeholder="Click 'Generate' to create a key..."
                                    readOnly
                                    className="font-mono bg-muted pr-10"
                                />
                                {generatedKey && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                        onClick={handleCopyKey}
                                    >
                                        {copied ? (
                                            <Check className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </Button>
                                )}
                            </div>
                            <Button variant="outline" onClick={generateGUID}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Generate
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Key sẽ được tự động generate khi bạn save license.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={onBack}>
                    Cancel
                </Button>
                <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleSubmit}
                    disabled={creating || !selectedApp || !selectedUser}
                >
                    {creating ? 'Đang tạo...' : 'Save License'}
                </Button>
            </div>
        </div>
    );
};
