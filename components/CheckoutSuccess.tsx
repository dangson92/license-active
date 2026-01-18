import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    CheckCircle2,
    ArrowRight,
    Package,
    Mail,
    Clock,
    ShoppingBag
} from 'lucide-react';

interface CheckoutSuccessProps {
    orderCode?: string;
    appName?: string;
    quantity?: number;
    onGoToStore?: () => void;
    onGoToLicenses?: () => void;
}

export const CheckoutSuccess: React.FC<CheckoutSuccessProps> = ({
    orderCode = 'SDA_LICENSE_8829',
    appName = 'SD Automation Pro',
    quantity = 1,
    onGoToStore,
    onGoToLicenses
}) => {
    return (
        <div className="min-h-[80vh] flex items-center justify-center p-8">
            <Card className="max-w-lg w-full">
                <CardContent className="pt-12 pb-8 text-center">
                    {/* Success Icon */}
                    <div className="mb-6">
                        <div className="size-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold mb-2">Đăng ký thành công!</h1>
                    <p className="text-muted-foreground mb-8">
                        Cảm ơn bạn đã đăng ký license. Chúng tôi đang xử lý đơn hàng của bạn.
                    </p>

                    {/* Order Info */}
                    <div className="bg-muted/50 rounded-lg p-6 mb-8 text-left space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Sản phẩm</p>
                                <p className="font-semibold">{appName} x{quantity}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Mail className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Mã đơn hàng</p>
                                <p className="font-mono font-semibold text-primary">{orderCode}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Trạng thái</p>
                                <p className="font-semibold text-amber-600">Đang chờ xác nhận thanh toán</p>
                            </div>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 text-left">
                        <p className="text-sm text-blue-800">
                            <strong>Lưu ý:</strong> Sau khi xác nhận thanh toán, license sẽ được kích hoạt và gửi đến email của bạn trong vòng 24 giờ.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={onGoToStore}
                        >
                            <ShoppingBag className="w-4 h-4 mr-2" />
                            Tiếp tục mua sắm
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={onGoToLicenses}
                        >
                            Xem Licenses của tôi
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
