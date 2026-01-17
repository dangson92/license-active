import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

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
