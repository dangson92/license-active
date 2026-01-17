import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Bell, HelpCircle } from 'lucide-react';

interface HeaderProps {
    searchPlaceholder?: string;
    onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
    searchPlaceholder = "Search...",
    onSearch
}) => {
    const [searchQuery, setSearchQuery] = React.useState('');

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        onSearch?.(e.target.value);
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
                <Button variant="outline" size="icon" className="text-muted-foreground">
                    <Bell className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="icon" className="text-muted-foreground">
                    <HelpCircle className="w-5 h-5" />
                </Button>
            </div>
        </header>
    );
};
