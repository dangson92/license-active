import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { getCurrentUser } from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// Icons
import { ArrowLeft, Calendar, Clock, Edit, Megaphone, User } from 'lucide-react';

interface Announcement {
    id: number;
    title: string;
    content: string;
    category: 'system_update' | 'maintenance' | 'news' | 'general';
    is_published?: boolean;
    is_archived?: boolean;
    author_name?: string;
    published_at?: string;
    created_at: string;
}

export const AnnouncementDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const user = getCurrentUser();
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (id) {
            loadAnnouncement(Number(id));
        }
    }, [id]);

    const loadAnnouncement = async (announcementId: number) => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.announcements.getById(announcementId);
            setAnnouncement(data);
        } catch (err: any) {
            console.error('Failed to load announcement:', err);
            setError(err.message || 'Không thể tải thông báo');
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
        return <Badge variant={style.variant} className="text-xs">{style.label}</Badge>;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };

    const getReadingTime = (content: string) => {
        const wordsPerMinute = 200;
        const temp = document.createElement('div');
        temp.innerHTML = content;
        const text = temp.textContent || temp.innerText || '';
        const wordCount = text.split(/\s+/).length;
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        return `${minutes} phút đọc`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !announcement) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-12">
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <Megaphone className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Không tìm thấy thông báo</h2>
                        <p className="text-muted-foreground mb-6">{error || 'Thông báo này không tồn tại hoặc đã bị xóa.'}</p>
                        <Button onClick={() => navigate(-1)}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Quay lại
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Breadcrumb & Actions */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={() => navigate(-1)}
                            className="text-primary hover:underline flex items-center gap-1"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại
                        </button>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">Thông báo</span>
                    </div>

                    {isAdmin && (
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/admin/announcements/edit/${announcement.id}`)}
                        >
                            <Edit className="w-4 h-4 mr-2" />
                            Chỉnh sửa
                        </Button>
                    )}
                </div>

                {/* Article */}
                <article className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-8 md:p-12 lg:p-16">
                        {/* Header */}
                        <div className="flex flex-col gap-4 mb-8">
                            {/* Category Badges */}
                            <div className="flex flex-wrap gap-2">
                                {getCategoryBadge(announcement.category)}
                                {!announcement.is_published && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        DRAFT
                                    </Badge>
                                )}
                                {announcement.is_archived && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                        ARCHIVED
                                    </Badge>
                                )}
                            </div>

                            {/* Title */}
                            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight">
                                {announcement.title}
                            </h1>

                            {/* Meta */}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formatDate(announcement.published_at || announcement.created_at)}</span>
                                </div>
                                <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    <span>{getReadingTime(announcement.content)}</span>
                                </div>
                                {announcement.author_name && (
                                    <>
                                        <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                                        <div className="flex items-center gap-1.5">
                                            <User className="w-4 h-4" />
                                            <span>{announcement.author_name}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <hr className="border-border my-6" />

                        {/* Content */}
                        <div
                            className="prose prose-lg max-w-none dark:prose-invert
                                prose-headings:font-bold prose-headings:text-foreground
                                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                                prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-6
                                prose-a:text-primary prose-a:font-medium hover:prose-a:underline
                                prose-ul:text-muted-foreground prose-ol:text-muted-foreground
                                prose-li:my-2
                                prose-strong:text-foreground prose-strong:font-semibold
                                prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/30 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:italic
                                prose-img:rounded-xl prose-img:shadow-lg
                            "
                            dangerouslySetInnerHTML={{ __html: announcement.content }}
                        />

                        {/* Footer Navigation */}
                        <div className="mt-12 pt-8 border-t">
                            <div className="flex justify-between">
                                <Link
                                    to={isAdmin ? "/admin/announcements" : "/announcements"}
                                    className="text-sm text-primary hover:underline flex items-center gap-1"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Xem tất cả thông báo
                                </Link>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
};

export default AnnouncementDetailPage;
