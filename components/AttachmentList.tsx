/**
 * AttachmentList - Danh sách File Attachments
 * 
 * Hiển thị bảng attachments với actions (Edit, Delete)
 * Tương tự AppVersionHistory nhưng cho attachments
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// Icons
import {
    Plus,
    Edit,
    Trash2,
    FileArchive,
    Cloud,
    Server,
    Loader2
} from 'lucide-react';

interface Attachment {
    id: number;
    file_name: string;
    original_name: string;
    file_size: number | null;
    description: string | null;
    download_url: string;
    storage_type: 'vps' | 'idrive-e2';
    created_at: string;
}

interface AttachmentListProps {
    appId: string;
    appName: string;
    appCode: string;
    onAddAttachment: () => void;
    onEditAttachment: (attachment: Attachment) => void;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
    appId,
    appName,
    appCode,
    onAddAttachment,
    onEditAttachment
}) => {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadAttachments();
    }, [appId]);

    const loadAttachments = async () => {
        try {
            setLoading(true);
            const response = await api.admin.getAttachments(parseInt(appId));
            setAttachments(response.items || []);
        } catch (error) {
            console.error('Failed to load attachments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        setDeleting(true);
        try {
            await api.admin.deleteAttachment(id);
            loadAttachments();
            setDeleteConfirm(null);
        } catch (error: any) {
            alert(error.message || 'Xóa thất bại');
        } finally {
            setDeleting(false);
        }
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return 'N/A';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <TooltipProvider>
            <Card>
                <CardContent className="p-0">
                    {/* Header with Add button */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <div className="flex items-center gap-2">
                            <FileArchive className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold">File Attachments</span>
                            <Badge variant="secondary">{attachments.length}</Badge>
                        </div>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={onAddAttachment}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Thêm Attachment
                        </Button>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="font-bold text-xs uppercase tracking-wider">Mô tả</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider">File</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider">Kích thước</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider">Storage</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider">Ngày tạo</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attachments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <FileArchive className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                        <p className="text-muted-foreground">Chưa có file attachment nào</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-4"
                                            onClick={onAddAttachment}
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Thêm Attachment đầu tiên
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                attachments.map((att) => (
                                    <TableRow key={att.id} className="group hover:bg-muted/30">
                                        <TableCell className="font-medium">
                                            {att.description || att.original_name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm font-mono">
                                            {att.original_name}
                                        </TableCell>
                                        <TableCell>
                                            {formatFileSize(att.file_size)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                                {att.storage_type === 'idrive-e2' ? (
                                                    <>
                                                        <Cloud className="w-3 h-3" />
                                                        iDrive E2
                                                    </>
                                                ) : (
                                                    <>
                                                        <Server className="w-3 h-3" />
                                                        VPS
                                                    </>
                                                )}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatDate(att.created_at)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => onEditAttachment(att)}
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Chỉnh sửa</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => setDeleteConfirm(att.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Xóa</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Xác nhận xóa</DialogTitle>
                    </DialogHeader>
                    <p>Bạn có chắc muốn xóa attachment này? File sẽ bị xóa vĩnh viễn.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                            Hủy
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Đang xóa...
                                </>
                            ) : (
                                'Xóa'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
};
