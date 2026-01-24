import React, { useState, useEffect } from 'react';
import api from '../services/api';

// UI Components
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Icons
import { Megaphone, Calendar } from 'lucide-react';

interface Announcement {
    id: number;
    title: string;
    content: string;
    category: 'system_update' | 'maintenance' | 'news' | 'general';
    author_name?: string;
    published_at?: string;
    created_at: string;
}

export const UserAnnouncements: React.FC = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

    useEffect(() => {
        loadAnnouncements();
    }, [activeCategory]);

    const loadAnnouncements = async () => {
        try {
            setLoading(true);
            const category = activeCategory === 'all' ? undefined : activeCategory;
            const response = await api.announcements.getAll(category);
            setAnnouncements(response.items || []);
        } catch (error) {
            console.error('Failed to load announcements:', error);
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    };

    const getCategoryBadge = (category: string) => {
        const styles: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
            system_update: { variant: 'default', label: 'SYSTEM UPDATE' },
            maintenance: { variant: 'destructive', label: 'MAINTENANCE' },
            news: { variant: 'secondary', label: 'PRODUCT NEWS' },
            general: { variant: 'outline', label: 'GENERAL' },
        };
        const style = styles[category] || styles.general;
        return <Badge variant={style.variant}>{style.label}</Badge>;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const categories = [
        { id: 'all', label: 'All Announcements' },
        { id: 'system_update', label: 'System Updates' },
        { id: 'news', label: 'News' },
        { id: 'maintenance', label: 'Maintenance' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider flex items-center gap-1 mb-2">
                    <Megaphone className="w-4 h-4" />
                    OFFICIAL UPDATES
                </p>
                <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
                <p className="text-muted-foreground text-sm">
                    Stay up to date with the latest news, system updates, and official notices.
                </p>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-6 border-b border-border">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeCategory === cat.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Announcements List */}
            <div className="space-y-4">
                {announcements.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                <Megaphone className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground">No announcements found.</p>
                        </CardContent>
                    </Card>
                ) : (
                    announcements.map((item) => (
                        <Card
                            key={item.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedAnnouncement(selectedAnnouncement?.id === item.id ? null : item)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            {getCategoryBadge(item.category)}
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Published {formatDate(item.published_at || item.created_at)}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {item.content.substring(0, 200)}...
                                        </p>

                                        {/* Expanded content */}
                                        {selectedAnnouncement?.id === item.id && (
                                            <div className="mt-4 pt-4 border-t">
                                                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                                                    {item.content}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
