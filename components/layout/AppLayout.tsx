import React, { useEffect, useRef, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import api, { getCurrentUser } from '../../services/api';
import { toast } from '../ui/toast';
import { initSocket, joinAdminRoom, joinUserRoom, getSocket, disconnectSocket } from '../../services/socket';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

interface AppLayoutProps {
    variant: 'admin' | 'user';
    userName: string;
    userEmail?: string;
    onLogout: () => void;
    activeItem?: string;
    searchPlaceholder?: string;
    onSearch?: (query: string) => void;
    onNavClick?: (itemId: string) => void;
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
    variant,
    userName,
    userEmail,
    onLogout,
    activeItem,
    searchPlaceholder,
    onSearch,
    onNavClick,
    children
}) => {
    const user = getCurrentUser();
    const isAdmin = user?.role === 'admin';
    const [unreadCount, setUnreadCount] = useState(0);
    const socketInitialized = useRef(false);

    // Initialize Socket.IO for all users (admin and regular users)
    useEffect(() => {
        if (!user || socketInitialized.current) return;

        const socket = initSocket();
        socketInitialized.current = true;

        // Handler for new notifications - register FIRST
        const handleNotification = (notification: Notification) => {
            console.log('📬 New notification received:', notification);

            // Show toast based on notification type
            if (notification.type === 'order_approved') {
                toast.success(notification.title, notification.message);
            } else if (notification.type === 'order_rejected') {
                toast.error(notification.title, notification.message);
            } else if (notification.type === 'license_expiring') {
                toast.warning(notification.title, notification.message);
            } else {
                toast.info(notification.title, notification.message);
            }

            // Update unread count (for both admin and user)
            setUnreadCount(prev => prev + 1);

            // Dispatch custom event for Header to update
            window.dispatchEvent(new CustomEvent('notification-received', {
                detail: notification
            }));
        };

        // Handler for connection - join appropriate room
        const handleConnect = () => {
            console.log('🔌 Socket connected, joining room...');
            // Small delay to ensure socket is fully ready
            setTimeout(() => {
                if (isAdmin) {
                    joinAdminRoom();
                }
                // All users (including admin) join their personal room
                if (user?.id) {
                    joinUserRoom(Number(user.id));
                }
            }, 100);
        };

        // Listen for new notifications
        socket.on('new-notification', handleNotification);

        // Join room when connected
        socket.on('connect', handleConnect);

        // If already connected, join immediately
        if (socket.connected) {
            handleConnect();
        }

        // Cleanup on unmount
        return () => {
            socket.off('new-notification', handleNotification);
            socket.off('connect', handleConnect);
        };
    }, [user, isAdmin]);

    // Fetch initial unread count (for both admin and user)
    useEffect(() => {
        if (!user) return;

        const fetchUnreadCount = async () => {
            try {
                const response = await api.notifications.getUnreadCount();
                setUnreadCount(response.count || 0);
            } catch (error) {
                console.error('Failed to fetch unread count:', error);
            }
        };

        fetchUnreadCount();
    }, [user]);

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar
                variant={variant}
                userName={userName}
                userEmail={userEmail}
                onLogout={onLogout}
                activeItem={activeItem}
                onNavClick={onNavClick}
            />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    searchPlaceholder={searchPlaceholder}
                    onSearch={onSearch}
                    unreadCount={unreadCount}
                    onUnreadCountChange={setUnreadCount}
                />
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
};
