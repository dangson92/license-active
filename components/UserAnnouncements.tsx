import React, { useState, useEffect } from 'react';
import api from '../services/api';

// UI Components
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

// Icons
import { Megaphone, Calendar, X, ArrowLeft, Clock } from 'lucide-react';

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
    const [dialogOpen, setDialogOpen] = useState(false);

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

    const formatFullDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getReadingTime = (content: string) => {
        const wordsPerMinute = 200;
        const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        return `${minutes} phút đọc`;
    };

    const stripHtmlForPreview = (html: string, maxLength: number = 200) => {
        // Create a temporary element to decode HTML entities
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const text = temp.textContent || temp.innerText || '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    const openDetailDialog = (announcement: Announcement) => {
        setSelectedAnnouncement(announcement);
        setDialogOpen(true);
    };

    const categories = [
        { id: 'all', label: 'Tất cả' },
        { id: 'system_update', label: 'Cập nhật hệ thống' },
        { id: 'news', label: 'Tin tức' },
        { id: 'maintenance', label: 'Bảo trì' },
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
                <h1 className="text-2xl font-bold tracking-tight">Thông báo</h1>
                <p className="text-muted-foreground text-sm">
                    Cập nhật tin tức mới nhất, thông báo hệ thống và các thông tin quan trọng.
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
                            <p className="text-muted-foreground">Không có thông báo nào.</p>
                        </CardContent>
                    </Card>
                ) : (
                    announcements.map((item) => (
                        <Card
                            key={item.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => openDetailDialog(item)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            {getCategoryBadge(item.category)}
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(item.published_at || item.created_at)}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {stripHtmlForPreview(item.content)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col p-0">
                    {selectedAnnouncement && (
                        <>
                            {/* Header */}
                            <div className="p-6 pb-4 border-b bg-muted/30">
                                <div className="flex items-center gap-3 mb-4">
                                    {getCategoryBadge(selectedAnnouncement.category)}
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatFullDate(selectedAnnouncement.published_at || selectedAnnouncement.created_at)}
                                    </span>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {getReadingTime(selectedAnnouncement.content)}
                                    </span>
                                </div>
                                <DialogTitle className="text-2xl font-bold leading-tight">
                                    {selectedAnnouncement.title}
                                </DialogTitle>
                                {selectedAnnouncement.author_name && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Đăng bởi: <span className="font-medium">{selectedAnnouncement.author_name}</span>
                                    </p>
                                )}
                            </div>

                            {/* Content */}
                            <ScrollArea className="flex-1 p-6">
                                <div
                                    className="prose prose-sm max-w-none dark:prose-invert
                                        prose-headings:font-bold prose-headings:text-foreground
                                        prose-p:text-muted-foreground prose-p:leading-relaxed
                                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                                        prose-ul:text-muted-foreground prose-ol:text-muted-foreground
                                        prose-strong:text-foreground
                                        prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                                    "
                                    dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
                                />
                            </ScrollArea>

                            {/* Footer */}
                            <div className="p-4 border-t flex justify-end">
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Đóng
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
