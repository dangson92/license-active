import React, { useState, useEffect } from 'react';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Icons
import {
    ArrowLeft,
    Plus,
    Edit,
    Download,
    Trash2,
    ChevronLeft,
    ChevronRight
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
}

interface AppVersionHistoryProps {
    appId: string;
    appName: string;
    onBack: () => void;
    onAddVersion: () => void;
}

export const AppVersionHistory: React.FC<AppVersionHistoryProps> = ({
    appId,
    appName,
    onBack,
    onAddVersion
}) => {
    const [versions, setVersions] = useState<AppVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalVersions, setTotalVersions] = useState(0);
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
            // Mock data for development
            setVersions([
                {
                    id: 1,
                    version: 'v2.4.0',
                    build_hash: '#8a2f4c1',
                    release_date: '2023-10-24',
                    status: 'latest',
                    changelog: 'Fixed critical bug in authentication flow and improved session timeout handling for enterprise users...',
                    platform: 'Windows'
                },
                {
                    id: 2,
                    version: 'v2.3.5',
                    build_hash: '#7c1a9d0',
                    release_date: '2023-10-10',
                    status: 'stable',
                    changelog: 'Updated API documentation and minor UI fixes for mobile dashboard views.',
                    platform: 'Windows'
                },
                {
                    id: 3,
                    version: 'v2.5.0-rc.1',
                    build_hash: '#1e5b2a4',
                    release_date: '2023-11-01',
                    status: 'beta',
                    changelog: 'Experimental UI enhancements including dark mode preview.',
                    platform: 'All'
                },
                {
                    id: 4,
                    version: 'v2.3.4',
                    build_hash: '#4d9c3e2',
                    release_date: '2023-09-28',
                    status: 'stable',
                    changelog: 'Security patches for database connection pooling.',
                    platform: 'Windows'
                },
            ]);
            setTotalVersions(28);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'latest':
                return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Latest</Badge>;
            case 'stable':
                return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Stable</Badge>;
            case 'beta':
                return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Beta</Badge>;
            case 'deprecated':
                return <Badge variant="secondary">Deprecated</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
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

    const totalPages = Math.ceil(totalVersions / itemsPerPage);

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
                        <p className="text-muted-foreground text-sm">Application Version History and Changelogs</p>
                    </div>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={onAddVersion}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Version
                    </Button>
                </div>

                {/* Version Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-bold text-xs uppercase tracking-wider">Version Number</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider">Release Date</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider hidden lg:table-cell">Changelog</TableHead>
                                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {versions.length === 0 ? (
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
                                    versions.map((version) => (
                                        <TableRow key={version.id} className="group hover:bg-muted/30">
                                            <TableCell>
                                                <span className="font-mono font-bold">{version.version}</span>
                                                {version.build_hash && (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        Build hash: {version.build_hash}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDate(version.release_date)}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(version.status)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground max-w-xs truncate hidden lg:table-cell">
                                                {version.changelog || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Chỉnh sửa</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <Download className="w-4 h-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Download</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDelete(version.id)}
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

                        {/* Pagination */}
                        {versions.length > 0 && (
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
            </div>
        </TooltipProvider>
    );
};
