import React, { useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import api, { getCurrentUser } from '../../services/api';
import { toast } from '../ui/toast';

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
    const lastUnreadCountRef = useRef<number>(0);
    const isFirstCheckRef = useRef(true);

    // Poll for new notifications and show toast
    useEffect(() => {
        if (!isAdmin) return;

        const checkForNewNotifications = async () => {
            try {
                const response = await api.notifications.getUnreadCount();
                const currentCount = response.count || 0;

                // Show toast only if count increased (not on first load)
                if (!isFirstCheckRef.current && currentCount > lastUnreadCountRef.current) {
                    const newCount = currentCount - lastUnreadCountRef.current;
                    toast.info(
                        `${newCount} thông báo mới`,
                        'Nhấn vào biểu tượng chuông để xem chi tiết'
                    );
                }

                lastUnreadCountRef.current = currentCount;
                isFirstCheckRef.current = false;
            } catch (error) {
                console.error('Failed to check notifications:', error);
            }
        };

        // Check immediately
        checkForNewNotifications();

        // Then poll every 30 seconds
        const interval = setInterval(checkForNewNotifications, 30000);
        return () => clearInterval(interval);
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
                />
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
};
