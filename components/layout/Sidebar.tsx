import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
    LayoutDashboard,
    Key,
    AppWindow,
    Users,
    Settings,
    LogOut,
    ShieldCheck,
    ShoppingBag,
    HelpCircle,
    Grid3X3,
    Package,
    Megaphone
} from 'lucide-react';

interface NavItem {
    icon: React.ElementType;
    label: string;
    id: string;
    active?: boolean;
}

interface SidebarProps {
    variant: 'admin' | 'user';
    userName: string;
    userEmail?: string;
    onLogout: () => void;
    activeItem?: string;
    onNavClick?: (itemId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    variant,
    userName,
    userEmail,
    onLogout,
    activeItem = 'licenses',
    onNavClick
}) => {
    const adminNavItems: NavItem[] = [
        { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
        { icon: ShoppingBag, label: 'Orders', id: 'orders' },
        { icon: Key, label: 'Licenses', id: 'licenses' },
        { icon: AppWindow, label: 'Applications', id: 'applications' },
        { icon: Users, label: 'Members', id: 'members' },
        { icon: Megaphone, label: 'Announcements', id: 'announcements' },
        { icon: HelpCircle, label: 'Support', id: 'support' },
    ];

    const userNavItems: NavItem[] = [
        { icon: Grid3X3, label: 'Overview', id: 'overview' },
        { icon: Key, label: 'My Licenses', id: 'licenses' },
        { icon: ShoppingBag, label: 'Store', id: 'store' },
        { icon: Package, label: 'My Orders', id: 'orders' },
        { icon: Megaphone, label: 'Announcements', id: 'announcements' },
        { icon: HelpCircle, label: 'Support', id: 'support' },
    ];

    const navItems = variant === 'admin' ? adminNavItems : userNavItems;

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleNavClick = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        onNavClick?.(itemId);
    };

    return (
        <aside className="w-64 border-r border-border bg-white flex flex-col h-screen shrink-0">
            {/* Logo */}
            <div className="p-6 flex items-center gap-3">
                <div className="size-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-sm font-bold tracking-tight text-foreground">
                        {variant === 'admin' ? 'Admin Portal' : 'User Portal'}
                    </h1>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                        {variant === 'admin' ? 'License Manager' : 'Customer Account'}
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => (
                    <a
                        key={item.id}
                        href="#"
                        onClick={(e) => handleNavClick(e, item.id)}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            activeItem === item.id
                                ? "bg-secondary text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </a>
                ))}

                {/* Settings Section */}
                <div className="pt-4 mt-4 border-t border-border">
                    <p className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        {variant === 'admin' ? 'System' : 'Account'}
                    </p>
                    <a
                        href="#"
                        onClick={(e) => handleNavClick(e, 'settings')}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            activeItem === 'settings'
                                ? "bg-secondary text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                    >
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </a>
                </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 px-2 py-2">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                            {getInitials(userName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate text-foreground">{userName}</p>
                        {userEmail && (
                            <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                        )}
                    </div>
                    <button
                        onClick={onLogout}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
};
