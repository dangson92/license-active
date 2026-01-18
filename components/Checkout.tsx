import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Zap,
    Copy,
    Upload,
    ArrowRight,
    Info,
    Shield,
    QrCode,
    Loader2,
    Check
} from 'lucide-react';
import api from '../services/api';

interface CheckoutProps {
    appId?: string;
    appName?: string;
    duration?: string;
    price?: number;
    onSuccess?: () => void;
    onBack?: () => void;
}

export const Checkout: React.FC<CheckoutProps> = ({
    appId,
    appName = 'Application',
    duration = '12 Tháng',
    price = 0,
    onSuccess,
    onBack
}) => {
    const [quantity, setQuantity] = useState<number | ''>(1);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [appDetails, setAppDetails] = useState<any>(null);
    const [paymentSettings, setPaymentSettings] = useState({
        bank_name: 'Techcombank',
        bank_code: 'TCB',
        bank_account: '19034567890123',
        bank_holder: 'SD AUTOMATION CO',
    });
    const [loading, setLoading] = useState(true);
    const [creatingOrder, setCreatingOrder] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [orderInfo, setOrderInfo] = useState<{ id: number; orderCode: string } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [appId]);

    const loadData = async () => {
        try {
            // Load payment settings from public endpoint
            const settings = await api.settings.getPaymentSettings();
            // Merge settings regardless of specific fields to ensure we get partial updates
            setPaymentSettings(prev => ({
                bank_name: settings.bank_name || prev.bank_name,
                bank_code: settings.bank_code || prev.bank_code,
                bank_account: settings.bank_account || prev.bank_account,
                bank_holder: settings.bank_holder || prev.bank_holder,
            }));

            // Load app details
            if (appId) {
                const response = await api.store.getApp(parseInt(appId));
                setAppDetails(response);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDurationMonths = (): number => {
        if (duration.includes('1 Tháng') || duration.includes('1m')) return 1;
        if (duration.includes('6 Tháng') || duration.includes('6m')) return 6;
        if (duration.includes('12 Tháng') || duration.includes('1 Năm') || duration.includes('1y')) return 12;
        return parseInt(duration) || 1;
    };

    const getQuantityValue = () => {
        if (quantity === '') return 0;
        return quantity;
    }

    const totalPrice = price * getQuantityValue();
    // Use order code if available, otherwise fallback (though flow ensures order code for payment)
    const transferContent = orderInfo ? orderInfo.orderCode : `SDA_${appId}_${getQuantityValue()}D`;

    // Generate VietQR URL
    const getVietQRUrl = () => {
        const { bank_code, bank_account, bank_holder } = paymentSettings;
        const amount = totalPrice;
        const addInfo = encodeURIComponent(transferContent);
        const accountName = encodeURIComponent(bank_holder);
        return `https://img.vietqr.io/image/${bank_code}-${bank_account}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setReceiptFile(e.target.files[0]);
        }
    };

    const handleCreateOrder = async () => {
        if (!appId || getQuantityValue() < 1) return;

        setCreatingOrder(true);
        try {
            const orderResponse = await api.store.createOrder({
                app_id: parseInt(appId),
                quantity: getQuantityValue(),
                duration_months: getDurationMonths(),
                unit_price: price
            });

            setOrderInfo({
                id: orderResponse.id,
                orderCode: orderResponse.order_code
            });

        } catch (error) {
            console.error('Failed to create order:', error);
            alert('Không thể tạo đơn hàng. Vui lòng thử lại.');
        } finally {
            setCreatingOrder(false);
        }
    };

    const handleConfirmPayment = async () => {
        if (!orderInfo || !receiptFile) return;

        setSubmitting(true);
        try {
            // Upload receipt
            await api.store.uploadReceipt(orderInfo.id, receiptFile);

            // Navigate to success
            onSuccess?.();
        } catch (error) {
            console.error('Failed to submit receipt:', error);
            alert('Có lỗi xảy ra khi gửi xác nhận. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    };

    const displayAppName = appDetails?.name || appName;

    return (
        <div className="min-h-screen bg-muted/30">
            {/* Header */}
            <header className="h-16 border-b bg-background flex items-center justify-between px-8">
                <div className="flex items-center gap-2.5">
                    <div className="size-8 bg-primary rounded flex items-center justify-center text-white">
                        <Zap className="w-4 h-4" />
                    </div>
                    <h1 className="text-sm font-bold tracking-tight uppercase">SD Automation</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="size-6 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">3</span>
                    <span className="text-sm font-medium text-muted-foreground">Hoàn tất đăng ký</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex justify-center p-8">
                <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Steps */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Step 1: Select Quantity */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">1</span>
                                    <h2 className="text-lg font-bold">Chọn số lượng thiết bị</h2>
                                </div>
                                <div className="max-w-xs">
                                    <Label htmlFor="quantity">Số lượng thiết bị cần kích hoạt</Label>
                                    <div className="relative mt-2">
                                        <Input
                                            id="quantity"
                                            type="number"
                                            min={1}
                                            value={quantity}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '') {
                                                    setQuantity('');
                                                } else {
                                                    const num = parseInt(val);
                                                    setQuantity(isNaN(num) ? '' : num);
                                                }
                                            }}
                                            className="pr-16"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="text-muted-foreground text-xs">Thiết bị</span>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Mỗi thiết bị là một máy tính/điện thoại được phép sử dụng license.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order Created Notification */}
                        {orderInfo && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-800">
                                <Check className="w-5 h-5" />
                                <div>
                                    <p className="font-semibold text-sm">Đơn hàng đã được tạo thành công!</p>
                                    <p className="text-xs">Mã đơn hàng: <span className="font-bold">{orderInfo.orderCode}</span>. Vui lòng thực hiện thanh toán bên dưới.</p>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Bank Transfer Info */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">2</span>
                                    <h2 className="text-lg font-bold">Thông tin chuyển khoản</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Bank Info */}
                                    <div className="space-y-4">
                                        <div className="bg-muted/50 border rounded-lg p-5 space-y-4">
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Ngân hàng</p>
                                                    <p className="font-semibold">{paymentSettings.bank_name} ({paymentSettings.bank_code})</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Chủ tài khoản</p>
                                                    <p className="font-semibold uppercase">{paymentSettings.bank_holder}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Số tài khoản</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-lg tracking-tight">{paymentSettings.bank_account}</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => copyToClipboard(paymentSettings.bank_account, 'account')}
                                                        >
                                                            {copied === 'account' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Nội dung chuyển khoản</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-primary">{transferContent}</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => copyToClipboard(transferContent, 'content')}
                                                        >
                                                            {copied === 'content' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Số tiền</p>
                                                    <p className="font-bold text-lg text-primary">{formatCurrency(totalPrice)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-100">
                                            <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                            <p>Vui lòng nhập chính xác nội dung chuyển khoản để đơn hàng được xử lý nhanh chóng.</p>
                                        </div>
                                    </div>

                                    {/* QR Code */}
                                    <div className="flex flex-col items-center justify-center border rounded-lg p-4 bg-background shadow-sm">
                                        <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-widest">Quét mã VietQR</p>
                                        <div className="bg-background p-2 border rounded-lg shadow-inner">
                                            <img
                                                src={getVietQRUrl()}
                                                alt="VietQR Code"
                                                className="w-72 h-72 object-contain"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                            <div className="hidden w-72 h-72 flex items-center justify-center">
                                                <QrCode className="w-16 h-16 text-muted-foreground" />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-3 text-center">
                                            Sử dụng ứng dụng Ngân hàng hoặc Ví điện tử để quét
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Step 3: Upload Receipt */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">3</span>
                                    <h2 className="text-lg font-bold">Xác nhận thanh toán</h2>
                                </div>
                                <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group relative">
                                    <input
                                        type="file"
                                        id="receipt-upload"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    <div className="size-14 rounded-full bg-background flex items-center justify-center text-muted-foreground group-hover:text-primary shadow-sm transition-colors mb-4">
                                        <Upload className="w-6 h-6" />
                                    </div>
                                    {receiptFile ? (
                                        <>
                                            <p className="text-sm font-semibold text-primary">{receiptFile.name}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Click để chọn file khác</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-semibold">Tải lên biên lai chuyển khoản</p>
                                            <p className="text-xs text-muted-foreground mt-1">Kéo thả hoặc click để chọn ảnh (PNG, JPG tối đa 5MB)</p>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                    </div>

                    {/* Right Column - Order Summary */}
                    <div className="lg:col-span-4">
                        <Card className="sticky top-8">
                            <CardContent className="pt-6">
                                <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Tóm tắt đơn hàng</h3>

                                {/* Product Info */}
                                <div className="flex items-start gap-3 pb-4 border-b">
                                    <div className="size-12 rounded bg-foreground flex items-center justify-center shrink-0">
                                        <Zap className="w-5 h-5 text-background" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate">{displayAppName}</p>
                                        <p className="text-xs text-muted-foreground">Bản quyền {duration}</p>
                                    </div>
                                </div>

                                {/* Price Details */}
                                <div className="space-y-3 py-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground font-medium">Đơn giá</span>
                                        <span className="font-semibold">{formatCurrency(price)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground font-medium">Số thiết bị</span>
                                        <span className="font-bold text-primary">x {getQuantityValue() || 1}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground font-medium">Thời hạn</span>
                                        <span className="font-semibold">{duration}</span>
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="pt-4 border-t">
                                    <div className="flex justify-between items-baseline mb-6">
                                        <span className="text-sm font-bold">Tổng cộng</span>
                                        <div className="text-right">
                                            <span className="text-2xl font-black text-primary tracking-tight">
                                                {formatCurrency(totalPrice)}
                                            </span>
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">
                                                Đã bao gồm VAT
                                            </p>
                                        </div>
                                    </div>

                                    {!orderInfo ? (
                                        <Button
                                            className="w-full shadow-lg shadow-primary/20 group"
                                            size="lg"
                                            onClick={handleCreateOrder}
                                            disabled={getQuantityValue() < 1 || creatingOrder || !appId}
                                        >
                                            {creatingOrder ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <span>Tạo đơn hàng</span>
                                            )}
                                            {!creatingOrder && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full shadow-lg shadow-primary/20 group"
                                            size="lg"
                                            onClick={handleConfirmPayment}
                                            disabled={!receiptFile || submitting}
                                        >
                                            {submitting ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <span>Xác nhận thanh toán</span>
                                            )}
                                            {!submitting && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
                                        </Button>
                                    )}

                                    <div className="mt-6 space-y-3">
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <Shield className="w-4 h-4 text-emerald-500" />
                                            <span>Giao dịch bảo mật SSL 256-bit</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Bằng cách nhấn nút xác nhận, bạn đồng ý với{' '}
                                            <a href="#" className="underline hover:text-foreground">Điều khoản dịch vụ</a> của chúng tôi.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="p-8 border-t bg-background mt-auto">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-muted-foreground">© 2024 SD Automation Solutions. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="text-xs text-muted-foreground hover:text-foreground font-medium">Hỗ trợ</a>
                        <a href="#" className="text-xs text-muted-foreground hover:text-foreground font-medium">Hướng dẫn sử dụng</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
