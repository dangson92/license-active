import React, { useEffect, useRef, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import api, { getCurrentUser } from '../../services/api';
import { toast } from '../ui/toast';
import { initSocket, joinAdminRoom, getSocket, disconnectSocket } from '../../services/socket';

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

    // Initialize Socket.IO for admin users
    useEffect(() => {
        if (!isAdmin || socketInitialized.current) return;

        const socket = initSocket();
        socketInitialized.current = true;

        // Join admin room when connected
        socket.on('connect', () => {
            joinAdminRoom();
        });

        // If already connected, join immediately
        if (socket.connected) {
            joinAdminRoom();
        }

        // Listen for new notifications
        socket.on('new-notification', (notification: Notification) => {
            console.log('📬 New notification received:', notification);

            // Show toast
            toast.info(notification.title, notification.message);

            // Update unread count
            setUnreadCount(prev => prev + 1);

            // Dispatch custom event for Header to update
            window.dispatchEvent(new CustomEvent('notification-received', {
                detail: notification
            }));
        });

        // Cleanup on unmount
        return () => {
            socket.off('new-notification');
        };
    }, [isAdmin]);

    // Fetch initial unread count
    useEffect(() => {
        if (!isAdmin) return;

        const fetchUnreadCount = async () => {
            try {
                const response = await api.notifications.getUnreadCount();
                setUnreadCount(response.count || 0);
            } catch (error) {
                console.error('Failed to fetch unread count:', error);
            }
        };

        fetchUnreadCount();
    }, [isAdmin]);

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
