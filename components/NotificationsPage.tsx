import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Bell,
    ArrowLeft,
    Loader2,
    Clock,
    Trash2,
    CheckCheck,
    ShoppingCart,
    MessageSquare,
    AlertTriangle,
    ExternalLink
} from 'lucide-react';
import api, { getCurrentUser } from '../services/api';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

export const NotificationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const user = getCurrentUser();
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const response = await api.notifications.getAll();
            setNotifications(response.items || []);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.notifications.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleDelete = async (id: number) => {
        setDeletingId(id);
        try {
            await api.notifications.delete(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Failed to delete notification:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read if not already
        if (!notification.is_read) {
            try {
                await api.notifications.markRead(notification.id);
                setNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
                );
            } catch (error) {
                console.error('Failed to mark as read:', error);
            }
        }

        // Navigate to link if exists
        if (notification.link) {
            navigate(notification.link);
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'new_order':
            case 'order_approved':
            case 'order_rejected':
                return <ShoppingCart className="w-5 h-5 text-emerald-500" />;
            case 'new_ticket':
            case 'ticket_reply':
            case 'ticket_status':
                return <MessageSquare className="w-5 h-5 text-orange-500" />;
            case 'license_expiring':
                return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            default:
                return <Bell className="w-5 h-5 text-blue-500" />;
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'new_order':
                return <Badge variant="success">Đơn hàng mới</Badge>;
            case 'order_approved':
                return <Badge variant="success">Đã duyệt</Badge>;
            case 'order_rejected':
                return <Badge variant="destructive">Từ chối</Badge>;
            case 'new_ticket':
                return <Badge variant="warning">Ticket mới</Badge>;
            case 'ticket_reply':
                return <Badge variant="info">Phản hồi</Badge>;
            case 'ticket_status':
                return <Badge variant="secondary">Trạng thái</Badge>;
            case 'license_expiring':
                return <Badge variant="warning">Sắp hết hạn</Badge>;
            default:
                return <Badge variant="outline">Hệ thống</Badge>;
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(isAdmin ? '/admin/licenses' : '/user/licenses')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Quay lại
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Thông báo</h1>
                        <p className="text-sm text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
                        </p>
                    </div>
                </div>

                {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                        <CheckCheck className="w-4 h-4 mr-2" />
                        Đánh dấu tất cả đã đọc
                    </Button>
                )}
            </div>

            {/* Notifications List */}
            <Card>
                <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" />
                        Tất cả thông báo ({notifications.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                            <p className="text-muted-foreground">Đang tải thông báo...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                <Bell className="w-10 h-10 text-muted-foreground/50" />
                            </div>
                            <h3 className="font-medium text-lg mb-2">Chưa có thông báo</h3>
                            <p className="text-muted-foreground text-sm">
                                Bạn sẽ nhận được thông báo khi có hoạt động mới.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 hover:bg-muted/30 transition-colors ${!notification.is_read ? 'bg-blue-50/50' : ''
                                        }`}
                                >
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div
                                            className="flex-1 min-w-0 cursor-pointer"
                                            onClick={() => handleNotificationClick(notification)}
                                        >
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className={`font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {notification.title}
                                                </span>
                                                {getTypeBadge(notification.type)}
                                                {!notification.is_read && (
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTimeAgo(notification.created_at)}
                                                </span>
                                                {notification.link && (
                                                    <span className="flex items-center gap-1 text-primary">
                                                        <ExternalLink className="w-3 h-3" />
                                                        Xem chi tiết
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDelete(notification.id)}
                                                disabled={deletingId === notification.id}
                                            >
                                                {deletingId === notification.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
