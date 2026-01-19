import React, { useState, useEffect } from 'react';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

// Icons
import { Settings as SettingsIcon, Mail, Save, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface SettingsData {
    smtp_host: string;
    smtp_port: string;
    smtp_user: string;
    smtp_pass: string;
    smtp_from: string;
    smtp_secure: string;
    app_name: string;
    email_verify_required: string;
    // Payment settings
    bank_name: string;
    bank_code: string;
    bank_account: string;
    bank_holder: string;
    // Order notification
    order_notification_email: string;
}

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<SettingsData>({
        smtp_host: '',
        smtp_port: '587',
        smtp_user: '',
        smtp_pass: '',
        smtp_from: '',
        smtp_secure: 'false',
        app_name: 'License System',
        email_verify_required: 'true',
        bank_name: '',
        bank_code: '',
        bank_account: '',
        bank_holder: '',
        order_notification_email: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [sendingTest, setSendingTest] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await api.settings.get();
            setSettings(prev => ({ ...prev, ...data }));
        } catch (error) {
            console.error('Failed to load settings:', error);
            setMessage({ type: 'error', text: 'Không thể tải cài đặt' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage(null);
            await api.settings.update(settings);
            setMessage({ type: 'success', text: 'Đã lưu cài đặt thành công!' });
        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage({ type: 'error', text: 'Không thể lưu cài đặt' });
        } finally {
            setSaving(false);
        }
    };

    const handleTestEmail = async () => {
        if (!testEmail) {
            setMessage({ type: 'error', text: 'Vui lòng nhập email để test' });
            return;
        }

        try {
            setSendingTest(true);
            setMessage(null);
            await api.settings.testEmail(testEmail);
            setMessage({ type: 'success', text: 'Email test đã được gửi thành công!' });
        } catch (error: any) {
            console.error('Failed to send test email:', error);
            setMessage({ type: 'error', text: error.message || 'Không thể gửi email test' });
        } finally {
            setSendingTest(false);
        }
    };

    const updateSetting = (key: keyof SettingsData, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <SettingsIcon className="h-6 w-6" />
                    Cài đặt hệ thống
                </h1>
                <p className="text-muted-foreground text-sm">
                    Cấu hình SMTP và các tùy chọn email.
                </p>
            </div>

            {/* Message */}
            {message && (
                <div className={`flex items-center gap-2 p-4 rounded-lg ${message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="h-5 w-5" />
                    ) : (
                        <AlertCircle className="h-5 w-5" />
                    )}
                    {message.text}
                </div>
            )}

            {/* SMTP Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Cấu hình SMTP
                    </CardTitle>
                    <CardDescription>
                        Cấu hình máy chủ SMTP để gửi email xác thực và thông báo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtp_host">SMTP Host</Label>
                            <Input
                                id="smtp_host"
                                placeholder="smtp.gmail.com"
                                value={settings.smtp_host}
                                onChange={(e) => updateSetting('smtp_host', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtp_port">SMTP Port</Label>
                            <Input
                                id="smtp_port"
                                type="number"
                                placeholder="587"
                                value={settings.smtp_port}
                                onChange={(e) => updateSetting('smtp_port', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtp_user">SMTP Username</Label>
                            <Input
                                id="smtp_user"
                                type="email"
                                placeholder="your-email@gmail.com"
                                value={settings.smtp_user}
                                onChange={(e) => updateSetting('smtp_user', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtp_pass">SMTP Password</Label>
                            <Input
                                id="smtp_pass"
                                type="password"
                                placeholder="App Password"
                                value={settings.smtp_pass}
                                onChange={(e) => updateSetting('smtp_pass', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="smtp_from">From Email</Label>
                        <Input
                            id="smtp_from"
                            placeholder="License System <noreply@example.com>"
                            value={settings.smtp_from}
                            onChange={(e) => updateSetting('smtp_from', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Email hiển thị khi gửi, ví dụ: "Tên App" &lt;email@domain.com&gt;
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Sử dụng SSL/TLS</Label>
                            <p className="text-xs text-muted-foreground">
                                Bật nếu sử dụng port 465 (SSL)
                            </p>
                        </div>
                        <Switch
                            checked={settings.smtp_secure === 'true'}
                            onCheckedChange={(checked) => updateSetting('smtp_secure', checked ? 'true' : 'false')}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Email Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Cài đặt Email</CardTitle>
                    <CardDescription>
                        Tùy chỉnh nội dung và hành vi email.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="app_name">Tên ứng dụng</Label>
                        <Input
                            id="app_name"
                            placeholder="License System"
                            value={settings.app_name}
                            onChange={(e) => updateSetting('app_name', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Tên hiển thị trong email và tiêu đề
                        </p>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Yêu cầu xác thực email</Label>
                            <p className="text-xs text-muted-foreground">
                                Người dùng phải xác thực email trước khi đăng nhập
                            </p>
                        </div>
                        <Switch
                            checked={settings.email_verify_required === 'true'}
                            onCheckedChange={(checked) => updateSetting('email_verify_required', checked ? 'true' : 'false')}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Payment Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Cài đặt thanh toán</CardTitle>
                    <CardDescription>
                        Cấu hình tài khoản ngân hàng để hiển thị trong trang thanh toán.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bank_name">Tên ngân hàng</Label>
                            <Input
                                id="bank_name"
                                placeholder="Techcombank"
                                value={settings.bank_name}
                                onChange={(e) => updateSetting('bank_name', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bank_code">Mã ngân hàng (VietQR)</Label>
                            <Input
                                id="bank_code"
                                placeholder="TCB"
                                value={settings.bank_code}
                                onChange={(e) => updateSetting('bank_code', e.target.value.toUpperCase())}
                            />
                            <p className="text-xs text-muted-foreground">
                                Mã ngân hàng cho VietQR (TCB, VCB, ACB, MB, ...)
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bank_account">Số tài khoản</Label>
                            <Input
                                id="bank_account"
                                placeholder="19034567890123"
                                value={settings.bank_account}
                                onChange={(e) => updateSetting('bank_account', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bank_holder">Chủ tài khoản</Label>
                            <Input
                                id="bank_holder"
                                placeholder="NGUYEN VAN A"
                                value={settings.bank_holder}
                                onChange={(e) => updateSetting('bank_holder', e.target.value.toUpperCase())}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Order Notification Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Thông báo đơn hàng</CardTitle>
                    <CardDescription>
                        Cấu hình email nhận thông báo khi có đơn hàng mới.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="order_notification_email">Email nhận thông báo đơn hàng</Label>
                        <Input
                            id="order_notification_email"
                            type="email"
                            placeholder="admin@example.com"
                            value={settings.order_notification_email}
                            onChange={(e) => updateSetting('order_notification_email', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Mỗi khi có đơn hàng mới, hệ thống sẽ gửi thông báo đến email này.
                            Khi đơn hàng được duyệt/từ chối, hệ thống sẽ gửi email đến khách hàng.
                        </p>
                    </div>
                </CardContent>
            </Card>
            {/* Test Email */}
            <Card>
                <CardHeader>
                    <CardTitle>Test Email</CardTitle>
                    <CardDescription>
                        Gửi email thử nghiệm để kiểm tra cấu hình SMTP.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <Input
                            type="email"
                            placeholder="test@example.com"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            className="flex-1"
                        />
                        <Button onClick={handleTestEmail} disabled={sendingTest}>
                            {sendingTest ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            Gửi Test
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} size="lg">
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Save className="h-4 w-4 mr-2" />
                    )}
                    Lưu cài đặt
                </Button>
            </div>
        </div>
    );
};

export default Settings;
