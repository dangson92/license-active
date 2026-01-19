import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Package, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Order {
    id: number;
    order_code: string;
    app_name: string;
    quantity: number;
    duration_months: number;
    total_price: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    processed_at?: string;
    admin_note?: string;
}

export const UserOrders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const response = await api.store.getMyOrders();
            setOrders(response.items || []);
        } catch (error) {
            console.error('Failed to load orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
            case 'approved':
                return (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Đã duyệt
                    </Badge>
                );
            case 'cancelled':
            case 'rejected':
                return (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Từ chối
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" />
                        Chờ duyệt
                    </Badge>
                );
        }
    };

    const getDurationText = (months: number) => {
        if (months === 1) return '1 Tháng';
        if (months === 6) return '6 Tháng';
        if (months === 12) return '1 Năm';
        return `${months} Tháng`;
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
            <div>
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <ShoppingCart className="w-6 h-6 text-primary" />
                    Đơn hàng của tôi
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                    Theo dõi trạng thái các đơn hàng đã đặt
                </p>
            </div>

            <Card>
                <CardContent className="p-0">
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground font-medium">Bạn chưa có đơn hàng nào</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Hãy mua license để bắt đầu sử dụng ứng dụng
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">Mã đơn</TableHead>
                                    <TableHead className="font-semibold">Ứng dụng</TableHead>
                                    <TableHead className="font-semibold">Gói</TableHead>
                                    <TableHead className="font-semibold">Số lượng</TableHead>
                                    <TableHead className="font-semibold">Tổng tiền</TableHead>
                                    <TableHead className="font-semibold">Trạng thái</TableHead>
                                    <TableHead className="font-semibold">Ngày đặt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                                {order.order_code}
                                            </code>
                                        </TableCell>
                                        <TableCell className="font-medium">{order.app_name}</TableCell>
                                        <TableCell>{getDurationText(order.duration_months)}</TableCell>
                                        <TableCell>{order.quantity} thiết bị</TableCell>
                                        <TableCell className="font-bold text-primary">
                                            {formatCurrency(order.total_price)}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatDate(order.created_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Status Legend */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span>Chờ duyệt: Đang chờ admin xác nhận thanh toán</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span>Đã duyệt: License đã được kích hoạt</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span>Từ chối: Đơn hàng không hợp lệ</span>
                </div>
            </div>
        </div>
    );
};
