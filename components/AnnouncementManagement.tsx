import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// Icons
import {
    Plus,
    FileText,
    Eye,
    TrendingUp,
    MessageSquare,
    Edit,
    Trash2,
    Archive,
    Calendar,
    Clock
} from 'lucide-react';

interface Announcement {
    id: number;
    title: string;
    content: string;
    category: 'system_update' | 'maintenance' | 'news' | 'general';
    is_published: boolean;
    is_archived: boolean;
    created_by: number;
    author_name?: string;
    created_at: string;
    updated_at: string;
    published_at?: string;
}

interface Stats {
    total: number;
    published: number;
    drafts: number;
    archived: number;
}

interface AnnouncementManagementProps {
    onCreateNew: () => void;
    onEdit: (id: number) => void;
}

export const AnnouncementManagement: React.FC<AnnouncementManagementProps> = ({
    onCreateNew,
    onEdit
}) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, published: 0, drafts: 0, archived: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            const status = activeTab === 'all' ? undefined : activeTab;
            const response = await api.announcements.adminGetAll(status);
            setAnnouncements(response.items || []);
            if (response.stats) {
                setStats(response.stats);
            }
        } catch (error) {
            console.error('Failed to load announcements:', error);
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePublish = async (id: number) => {
        try {
            await api.announcements.togglePublish(id);
            loadData();
        } catch (error: any) {
            alert(`Không thể thay đổi trạng thái: ${error.message}`);
        }
    };

    const handleArchive = async (id: number) => {
        try {
            await api.announcements.archive(id);
            loadData();
        } catch (error: any) {
            alert(`Không thể archive: ${error.message}`);
        }
    };

    const handleDelete = async () => {
        if (!deleteDialog.id) return;
        try {
            await api.announcements.delete(deleteDialog.id);
            setDeleteDialog({ open: false, id: null });
            loadData();
        } catch (error: any) {
            alert(`Không thể xóa: ${error.message}`);
        }
    };

    const getCategoryBadge = (category: string) => {
        const styles: Record<string, { bg: string; text: string; label: string }> = {
            system_update: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'SYSTEM UPDATE' },
            maintenance: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'MAINTENANCE' },
            news: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'PRODUCT NEWS' },
            general: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'GENERAL' },
        };
        const style = styles[category] || styles.general;
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${style.bg} ${style.text} uppercase tracking-tight`}>
                {style.label}
            </span>
        );
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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

    const stripHtmlForPreview = (html: string, maxLength: number = 100) => {
        // Create a temporary element to decode HTML entities
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const text = temp.textContent || temp.innerText || '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    const filteredAnnouncements = announcements.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const tabs = [
        { id: 'all', label: 'All Announcements' },
        { id: 'published', label: 'Published' },
        { id: 'drafts', label: 'Drafts' },
        { id: 'archived', label: 'Archived' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Announcements Dashboard</h1>
                        <p className="text-muted-foreground text-sm">Quản lý thông báo hệ thống và bài viết cho người dùng.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline">
                            Drafts ({stats.drafts})
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={onCreateNew}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Post
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Total Posts</p>
                                <FileText className="w-5 h-5 text-slate-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold">{stats.total}</span>
                                <span className="text-xs text-muted-foreground font-medium">All time content</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Active Now</p>
                                <Eye className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold">{stats.published}</span>
                                <span className="text-xs text-emerald-600 font-medium">Visible to users</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Drafts</p>
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold">{stats.drafts}</span>
                                <span className="text-xs text-blue-600 font-medium">Pending publish</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-muted-foreground">Archived</p>
                                <MessageSquare className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold">{stats.archived}</span>
                                <span className="text-xs text-amber-600 font-medium">Hidden from users</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Announcements Table */}
                <Card>
                    <div className="px-6 border-b border-border">
                        <div className="flex gap-6">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-4 border-b-2 text-sm font-medium transition-colors ${activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">ANNOUNCEMENT DETAILS</TableHead>
                                    <TableHead className="font-semibold">DATE</TableHead>
                                    <TableHead className="font-semibold">STATUS</TableHead>
                                    <TableHead className="font-semibold text-right">ACTIONS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAnnouncements.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                                    <FileText className="w-6 h-6 text-muted-foreground" />
                                                </div>
                                                <p className="text-muted-foreground">Chưa có announcement nào.</p>
                                                <Button variant="outline" size="sm" onClick={onCreateNew}>
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Tạo announcement đầu tiên
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAnnouncements.map((item) => (
                                        <TableRow key={item.id} className={`group hover:bg-muted/50 ${item.is_archived ? 'opacity-60' : ''}`}>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col max-w-lg">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {getCategoryBadge(item.category)}
                                                        {!item.is_published && !item.is_archived && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                                                Draft
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                        {stripHtmlForPreview(item.content)}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <div className="text-sm">{formatDate(item.published_at || item.created_at)}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase">{formatTime(item.published_at || item.created_at)}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Switch
                                                        checked={item.is_published}
                                                        onCheckedChange={() => handleTogglePublish(item.id)}
                                                        disabled={item.is_archived}
                                                    />
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        {item.is_published ? 'Show' : 'Hide'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => onEdit(item.id)}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Edit</TooltipContent>
                                                    </Tooltip>

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => navigate(`/admin/announcements/${item.id}`)}
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Xem chi tiết</TooltipContent>
                                                    </Tooltip>

                                                    <Separator orientation="vertical" className="h-4 mx-1" />

                                                    {!item.is_archived && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() => handleArchive(item.id)}
                                                                >
                                                                    <Archive className="w-4 h-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Archive</TooltipContent>
                                                        </Tooltip>
                                                    )}

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => setDeleteDialog({ open: true, id: item.id })}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Delete</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {filteredAnnouncements.length > 0 && (
                            <div className="px-6 py-4 flex items-center justify-between bg-muted/50 border-t border-border">
                                <p className="text-xs text-muted-foreground">
                                    Showing <span className="text-foreground font-semibold">{filteredAnnouncements.length}</span> of{' '}
                                    <span className="text-foreground font-semibold">{stats.total}</span> announcements
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Delete Confirmation Dialog */}
                <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Xác nhận xóa</DialogTitle>
                            <DialogDescription>
                                Bạn có chắc chắn muốn xóa announcement này? Hành động này không thể hoàn tác.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, id: null })}>
                                Hủy
                            </Button>
                            <Button variant="destructive" onClick={handleDelete}>
                                Xóa
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
};
