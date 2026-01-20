import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Bell, HelpCircle, ShoppingCart, Clock, X, ExternalLink, MessageSquare } from 'lucide-react';
import api, { getCurrentUser } from '../../services/api';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

interface HeaderProps {
    searchPlaceholder?: string;
    onSearch?: (query: string) => void;
    unreadCount?: number;
    onUnreadCountChange?: (count: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
    searchPlaceholder = "Search...",
    onSearch,
    unreadCount: propUnreadCount,
    onUnreadCountChange
}) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [localUnreadCount, setLocalUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const user = getCurrentUser();
    const isAdmin = user?.role === 'admin';

    // Use prop unread count if provided, otherwise use local state
    const unreadCount = propUnreadCount ?? localUnreadCount;

    // Fetch initial unread count if not controlled
    useEffect(() => {
        if (!user || propUnreadCount !== undefined) return;

        const fetchUnreadCount = async () => {
            try {
                const response = await api.notifications.getUnreadCount();
                setLocalUnreadCount(response.count || 0);
            } catch (error) {
                console.error('Failed to fetch unread count:', error);
            }
        };

        fetchUnreadCount();
    }, [user, propUnreadCount]);

    // Listen for new notifications from Socket.IO via custom event
    useEffect(() => {
        if (!user) return;

        const handleNewNotification = (e: CustomEvent<Notification>) => {
            // Update unread count
            if (onUnreadCountChange) {
                onUnreadCountChange((propUnreadCount ?? 0) + 1);
            } else {
                setLocalUnreadCount(prev => prev + 1);
            }
            // Add to notifications list if dropdown is open
            if (showDropdown) {
                setNotifications(prev => [e.detail, ...prev]);
            }
        };

        window.addEventListener('notification-received', handleNewNotification as EventListener);
        return () => {
            window.removeEventListener('notification-received', handleNewNotification as EventListener);
        };
    }, [user, showDropdown, propUnreadCount, onUnreadCountChange]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        onSearch?.(e.target.value);
    };

    const handleBellClick = async () => {
        setShowDropdown(!showDropdown);

        if (!showDropdown) {
            // Fetch notifications when opening
            setLoading(true);
            try {
                const response = await api.notifications.getAll();
                setNotifications(response.items || []);

                // Mark all as read
                if (unreadCount > 0) {
                    await api.notifications.markAllRead();
                    if (onUnreadCountChange) {
                        onUnreadCountChange(0);
                    } else {
                        setLocalUnreadCount(0);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch notifications:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (notification.link) {
            navigate(notification.link);
            setShowDropdown(false);
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
                return <ShoppingCart className="w-4 h-4 text-emerald-500" />;
            case 'new_ticket':
                return <MessageSquare className="w-4 h-4 text-orange-500" />;
            default:
                return <Bell className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-white/80 backdrop-blur-sm shrink-0">
            {/* Search */}
            <div className="flex-1 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={handleSearch}
                        className="pl-10 bg-secondary/50 border-border"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
                {/* Notification Bell - for all users */}
                {user && (
                    <div className="relative" ref={dropdownRef}>
                        <Button
                            variant="outline"
                            size="icon"
                            className="text-muted-foreground relative"
                            onClick={handleBellClick}
                        >
                            <Bell className="w-5 h-5" />
                            {/* Badge */}
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </Button>

                        {/* Dropdown */}
                        {showDropdown && (
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                                    <h3 className="font-semibold text-gray-900">Thông báo</h3>
                                    <button
                                        onClick={() => setShowDropdown(false)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Notifications List */}
                                <ScrollArea className="max-h-96">
                                    {loading ? (
                                        <div className="p-8 text-center text-gray-500">
                                            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                                            Đang tải...
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            Không có thông báo
                                        </div>
                                    ) : (
                                        <div className="divide-y">
                                            {notifications.map((notification) => (
                                                <div
                                                    key={notification.id}
                                                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.is_read ? 'bg-blue-50/50' : ''
                                                        }`}
                                                    onClick={() => handleNotificationClick(notification)}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                                            {getNotificationIcon(notification.type)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm text-gray-900 truncate">
                                                                {notification.title}
                                                            </p>
                                                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                                                {notification.message}
                                                            </p>
                                                            <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                                                                <Clock className="w-3 h-3" />
                                                                {formatTimeAgo(notification.created_at)}
                                                            </div>
                                                        </div>
                                                        {notification.link && (
                                                            <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>

                                {/* Footer */}
                                {notifications.length > 0 && (
                                    <div className="px-4 py-3 border-t bg-gray-50 text-center">
                                        <button
                                            className="text-sm text-primary hover:underline font-medium"
                                            onClick={() => {
                                                navigate(isAdmin ? '/admin/notifications' : '/notifications');
                                                setShowDropdown(false);
                                            }}
                                        >
                                            Xem tất cả thông báo
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <Button variant="outline" size="icon" className="text-muted-foreground">
                    <HelpCircle className="w-5 h-5" />
                </Button>
            </div>
        </header>
    );
};
