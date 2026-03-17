import React, { useState, useEffect } from 'react';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Components
import { AttachmentList } from './AttachmentList';

// Icons
import {
    ArrowLeft,
    Plus,
    Edit,
    Download,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Package,
    FileArchive,
    Monitor
} from 'lucide-react';

interface AppVersion {
    id: number;
    version: string;
    build_hash?: string;
    release_date: string;
    status: 'latest' | 'stable' | 'beta' | 'deprecated';
    changelog?: string;
    platform?: string;
    download_url?: string;
    release_notes?: string;
    mandatory?: boolean;
    file_type?: string;
}

interface GroupedVersion {
    versionNumber: string;
    releaseDate: string;
    builds: AppVersion[];
}

interface AppVersionHistoryProps {
    appId: string;
    appName: string;
    appCode?: string;
    onBack: () => void;
    onAddVersion: () => void;
    onEditVersion?: (version: AppVersion) => void;
    onAddAttachment?: () => void;
    onEditAttachment?: (attachment: any) => void;
}

export const AppVersionHistory: React.FC<AppVersionHistoryProps> = ({
    appId,
    appName,
    appCode,
    onBack,
    onAddVersion,
    onEditVersion,
    onAddAttachment,
    onEditAttachment
}) => {
    const [versions, setVersions] = useState<AppVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalVersions, setTotalVersions] = useState(0);
    const [activeTab, setActiveTab] = useState('software');
    const itemsPerPage = 10;

    useEffect(() => {
        loadVersions();
    }, [appId, currentPage]);

    const loadVersions = async () => {
        try {
            setLoading(true);
            const response = await api.admin.getAppVersions(parseInt(appId));
            setVersions(response.items || []);
            setTotalVersions(response.total || response.items?.length || 0);
        } catch (error) {
            console.error('Failed to load versions:', error);
            setVersions([]);
            setTotalVersions(0);
        } finally {
            setLoading(false);
        }
    };

    // Group versions by version number
    const groupedVersions = versions.reduce<GroupedVersion[]>((acc, v) => {
        const existing = acc.find(g => g.versionNumber === v.version);
        if (existing) {
            existing.builds.push(v);
        } else {
            acc.push({
                versionNumber: v.version,
                releaseDate: v.release_date,
                builds: [v],
            });
        }
        return acc;
    }, []);

    const getPlatformBadge = (platform: string) => {
        const map: Record<string, { label: string; className: string }> = {
            'Windows': { label: '🪟 Windows', className: 'bg-blue-100 text-blue-700 border-blue-200' },
            'macOS':   { label: '🍎 macOS',   className: 'bg-zinc-100 text-zinc-700 border-zinc-300' },
            'Linux':   { label: '🐧 Linux',   className: 'bg-orange-100 text-orange-700 border-orange-200' },
            'Web':     { label: '🌐 Web',     className: 'bg-green-100 text-green-700 border-green-200' },
            'All':     { label: '📦 All',     className: 'bg-purple-100 text-purple-700 border-purple-200' },
        };
        const config = map[platform] || { label: platform, className: 'bg-gray-100 text-gray-700' };
        return <Badge className={config.className}>{config.label}</Badge>;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric'
        });
    };

    const handleDelete = async (versionId: number) => {
        if (!confirm('Bạn có chắc chắn muốn xóa version này?')) return;
        try {
            await api.admin.deleteAppVersion(versionId);
            loadVersions();
        } catch (error) {
            alert('Không thể xóa version!');
        }
    };

    const handleEdit = (version: AppVersion) => {
        if (onEditVersion) {
            onEditVersion(version);
        }
    };

    const handleDownload = (version: AppVersion) => {
        if (version.download_url) {
            window.open(version.download_url, '_blank');
        } else {
            alert('Không tìm thấy link download cho version này!');
        }
    };

    const totalPages = Math.ceil(totalVersions / itemsPerPage);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <>
            <TooltipProvider>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <button
                                onClick={onBack}
                                className="flex items-center gap-1 text-sm font-bold text-primary hover:bg-primary/10 px-2 py-1 -ml-2 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Apps
                            </button>
                            <h1 className="text-2xl font-bold tracking-tight">{appName}</h1>
                            <p className="text-muted-foreground text-sm">Quản lý phiên bản và file đính kèm</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex items-center justify-between mb-4">
                            <TabsList className="grid w-full max-w-md grid-cols-2">
                                <TabsTrigger value="software" className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Phần mềm
                                </TabsTrigger>
                                <TabsTrigger value="attachments" className="flex items-center gap-2">
                                    <FileArchive className="h-4 w-4" />
                                    File Attachment
                                </TabsTrigger>
                            </TabsList>
                            {activeTab === 'software' && (
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={onAddVersion}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add New Version
                                </Button>
                            )}
                        </div>

                        <TabsContent value="software" className="mt-0">

                            {/* Version Table */}
                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="font-bold text-xs uppercase tracking-wider">Version</TableHead>
                                                <TableHead className="font-bold text-xs uppercase tracking-wider">Release Date</TableHead>
                                                <TableHead className="font-bold text-xs uppercase tracking-wider">Platforms</TableHead>
                                                <TableHead className="font-bold text-xs uppercase tracking-wider hidden lg:table-cell">Changelog</TableHead>
                                                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {groupedVersions.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-12">
                                                        <p className="text-muted-foreground">Chưa có version nào.</p>
                                                        <Button variant="outline" size="sm" className="mt-4" onClick={onAddVersion}>
                                                            <Plus className="w-4 h-4 mr-2" />
                                                            Tạo version đầu tiên
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                groupedVersions.map((group) => (
                                                    <TableRow key={group.versionNumber} className="group hover:bg-muted/30 align-top">
                                                        {/* Version number */}
                                                        <TableCell>
                                                            <span className="font-mono font-bold">{group.versionNumber}</span>
                                                        </TableCell>

                                                        {/* Release Date */}
                                                        <TableCell className="text-muted-foreground">
                                                            {formatDate(group.releaseDate)}
                                                        </TableCell>

                                                        {/* Platforms — each build as a badge row */}
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1.5">
                                                                {group.builds.map(build => (
                                                                    <div key={build.id} className="flex items-center gap-2">
                                                                        {getPlatformBadge(build.platform || 'Windows')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </TableCell>

                                                        {/* Changelog (first build) */}
                                                        <TableCell className="text-muted-foreground max-w-xs truncate hidden lg:table-cell">
                                                            {group.builds[0]?.changelog || '-'}
                                                        </TableCell>

                                                        {/* Actions per build */}
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1.5 items-end">
                                                                {group.builds.map(build => (
                                                                    <div key={build.id} className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7"
                                                                                    onClick={() => handleEdit(build)}
                                                                                >
                                                                                    <Edit className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Sửa {build.platform}</TooltipContent>
                                                                        </Tooltip>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7"
                                                                                    onClick={() => handleDownload(build)}
                                                                                >
                                                                                    <Download className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Download {build.platform}</TooltipContent>
                                                                        </Tooltip>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                    onClick={() => handleDelete(build.id)}
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Xóa {build.platform}</TooltipContent>
                                                                        </Tooltip>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>

                                    {/* Pagination */}
                                    {groupedVersions.length > 0 && (
                                        <div className="px-6 py-4 flex items-center justify-between border-t bg-muted/30">
                                            <p className="text-xs text-muted-foreground">
                                                Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                                                <span className="font-bold">{Math.min(currentPage * itemsPerPage, totalVersions)}</span> of{' '}
                                                <span className="font-bold">{totalVersions}</span> versions
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(currentPage - 1)}
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Button>
                                                <div className="flex gap-1">
                                                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => (
                                                        <Button
                                                            key={i + 1}
                                                            variant={currentPage === i + 1 ? 'default' : 'ghost'}
                                                            size="icon"
                                                            className={`h-8 w-8 text-xs font-bold ${currentPage === i + 1 ? 'bg-primary' : ''}`}
                                                            onClick={() => setCurrentPage(i + 1)}
                                                        >
                                                            {i + 1}
                                                        </Button>
                                                    ))}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(currentPage + 1)}
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="attachments" className="mt-0">
                            {appCode && onAddAttachment && onEditAttachment ? (
                                <AttachmentList
                                    appId={appId}
                                    appName={appName}
                                    appCode={appCode}
                                    onAddAttachment={onAddAttachment}
                                    onEditAttachment={onEditAttachment}
                                />
                            ) : (
                                <Card>
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        Không có thông tin app code
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </TooltipProvider>
        </>
    );
};
