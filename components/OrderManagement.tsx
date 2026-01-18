import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Search,
    ShoppingBag,
    CheckCircle,
    XCircle,
    Eye,
    Receipt,
    ListFilter,
    Loader2
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import api from '../services/api';

interface Order {
    id: number;
    order_code: string;
    app_id: number;
    app_name: string;
    app_code: string;
    user_id: number;
    user_name: string;
    user_email: string;
    quantity: number;
    duration_months: number;
    unit_price: number;
    total_price: number;
    status: 'pending' | 'paid' | 'cancelled';
    receipt_url: string | null;
    created_at: string;
    paid_at: string | null;
}

export const OrderManagement: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
    const [processNote, setProcessNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const response = await api.store.getAdminOrders();
            setOrders(response.items || []);
        } catch (error) {
            console.error('Failed to load orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleActionClick = (order: Order, type: 'approve' | 'reject') => {
        setSelectedOrder(order);
        setActionType(type);
        setProcessNote('');
        setIsActionDialogOpen(true);
    };

    const handleProcessOrder = async () => {
        if (!selectedOrder || !actionType) return;

        setIsProcessing(true);
        try {
            if (actionType === 'approve') {
                await api.store.approveOrder(selectedOrder.id);
            } else {
                await api.store.rejectOrder(selectedOrder.id, processNote);
            }
            // Refresh list
            await loadOrders();
            setIsActionDialogOpen(false);
        } catch (error) {
            console.error(`Failed to ${actionType} order:`, error);
            alert(`Không thể ${actionType === 'approve' ? 'duyệt' : 'từ chối'} đơn hàng. Vui lòng thử lại.`);
        } finally {
            setIsProcessing(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge className="bg-emerald-500 hover:bg-emerald-600">Đã thanh toán</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Đã hủy</Badge>;
            default:
                return <Badge variant="secondary" className="bg-amber-500 hover:bg-amber-600 text-white">Chờ xử lý</Badge>;
        }
    };

    const filteredOrders = orders.filter(order => {
        const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            order.order_code.toLowerCase().includes(searchLower) ||
            order.user_email.toLowerCase().includes(searchLower) ||
            order.user_name.toLowerCase().includes(searchLower) ||
            order.app_name.toLowerCase().includes(searchLower);

        return matchesStatus && matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Quản lý đơn hàng</h2>
                    <p className="text-muted-foreground text-sm">Xem và xử lý các đơn hàng mua license.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadOrders}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ListFilter className="h-4 w-4 mr-2" />}
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 md:max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm kiếm mã đơn, email, app..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={filterStatus === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterStatus('all')}
                    >
                        Tất cả
                    </Button>
                    <Button
                        variant={filterStatus === 'pending' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterStatus('pending')}
                        className={filterStatus === 'pending' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                    >
                        Chờ xử lý
                    </Button>
                    <Button
                        variant={filterStatus === 'paid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterStatus('paid')}
                        className={filterStatus === 'paid' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                    >
                        Đã thanh toán
                    </Button>
                    <Button
                        variant={filterStatus === 'cancelled' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterStatus('cancelled')}
                    >
                        Đã hủy
                    </Button>
                </div>
            </div>

            {/* Orders Table */}
            <Card>
                <CardHeader className="p-4 sm:p-6 pb-2">
                    <CardTitle className="text-lg">Danh sách đơn hàng</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mã đơn hàng</TableHead>
                                    <TableHead>Khách hàng</TableHead>
                                    <TableHead>Sản phẩm</TableHead>
                                    <TableHead>Tổng tiền</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            Không tìm thấy đơn hàng nào.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono font-medium text-xs">
                                                {order.order_code}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{order.user_name}</span>
                                                    <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={order.user_email}>
                                                        {order.user_email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{order.app_name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {order.quantity} thiết bị x {order.duration_months} tháng
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-primary">
                                                {formatCurrency(order.total_price)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {formatDate(order.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(order.status)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {order.receipt_url && (
                                                        <a
                                                            href={order.receipt_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center justify-center p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                                            title="Xem bill"
                                                        >
                                                            <Receipt className="h-4 w-4" />
                                                        </a>
                                                    )}

                                                    {order.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                                title="Duyệt"
                                                                onClick={() => handleActionClick(order, 'approve')}
                                                            >
                                                                <CheckCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                title="Từ chối"
                                                                onClick={() => handleActionClick(order, 'reject')}
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Action Dialog */}
            <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === 'approve' ? 'Duyệt đơn hàng' : 'Từ chối đơn hàng'}
                        </DialogTitle>
                        <DialogDescription>
                            {actionType === 'approve'
                                ? 'Hệ thống sẽ tự động tạo license và gửi email cho khách hàng.'
                                : 'Vui lòng nhập lý do từ chối đơn hàng này.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="text-muted-foreground">Mã đơn:</div>
                            <div className="font-mono font-bold text-right">{selectedOrder?.order_code}</div>

                            <div className="text-muted-foreground">Khách hàng:</div>
                            <div className="font-medium text-right">{selectedOrder?.user_name}</div>

                            <div className="text-muted-foreground">Số tiền:</div>
                            <div className="font-bold text-right text-primary">
                                {selectedOrder && formatCurrency(selectedOrder.total_price)}
                            </div>
                        </div>

                        {selectedOrder?.receipt_url && (
                            <div className="mt-2 border rounded-md p-2 bg-muted/20">
                                <p className="text-xs font-semibold mb-2">Biên lai chuyển khoản:</p>
                                <div className="relative aspect-video bg-black/5 rounded overflow-hidden">
                                    <img
                                        src={selectedOrder.receipt_url}
                                        alt="Receipt"
                                        className="object-contain w-full h-full"
                                    />
                                    <a
                                        href={selectedOrder.receipt_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded hover:bg-black/90"
                                    >
                                        Mở rộng
                                    </a>
                                </div>
                            </div>
                        )}

                        {actionType === 'reject' && (
                            <Textarea
                                placeholder="Nhập lý do từ chối..."
                                value={processNote}
                                onChange={(e) => setProcessNote(e.target.value)}
                                rows={3}
                            />
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsActionDialogOpen(false)} disabled={isProcessing}>
                            Hủy bỏ
                        </Button>
                        <Button
                            variant={actionType === 'approve' ? 'default' : 'destructive'}
                            onClick={handleProcessOrder}
                            disabled={isProcessing || (actionType === 'reject' && !processNote.trim())}
                            className={actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {actionType === 'approve' ? 'Xác nhận Duyệt' : 'Xác nhận Từ chối'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
