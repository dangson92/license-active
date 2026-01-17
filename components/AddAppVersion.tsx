import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Icons
import {
    ArrowLeft,
    Upload,
    Calendar,
    Package,
    FileCode,
    Monitor,
    CloudUpload,
    Info
} from 'lucide-react';

interface AddAppVersionProps {
    appId?: string;
    appName?: string;
    onBack: () => void;
    onSuccess: () => void;
}

export const AddAppVersion: React.FC<AddAppVersionProps> = ({
    appId,
    appName = 'Application',
    onBack,
    onSuccess
}) => {
    const [versionNumber, setVersionNumber] = useState('');
    const [releaseDate, setReleaseDate] = useState('');
    const [platform, setPlatform] = useState('');
    const [fileType, setFileType] = useState('');
    const [changelog, setChangelog] = useState('');
    const [downloadUrl, setDownloadUrl] = useState('');
    const [creating, setCreating] = useState(false);

    // Set default release date (today)
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setReleaseDate(today);
    }, []);

    const handleSubmit = async () => {
        if (!versionNumber.trim()) {
            alert('Vui lòng nhập Version Number!');
            return;
        }

        try {
            setCreating(true);

            // Call API to create version
            await api.admin.createAppVersion({
                app_id: parseInt(appId || '0'),
                version: versionNumber,
                platform: platform || 'Windows',
                file_type: fileType || '.exe',
                release_notes: changelog,
                download_url: downloadUrl || '',
                release_date: releaseDate,
            });

            alert(`Version ${versionNumber} đã được tạo thành công!`);
            onSuccess();
        } catch (error: any) {
            alert(`Không thể tạo version!\n\nLỗi: ${error.message}`);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <button onClick={onBack} className="hover:text-primary transition-colors">
                    Applications
                </button>
                <span>›</span>
                <span className="text-foreground font-medium">{appName}</span>
                <span>›</span>
                <span className="text-foreground font-medium">Add Version</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Add New App Version</h1>
                    <p className="text-muted-foreground text-sm">Tạo phiên bản mới cho ứng dụng và thông báo cho người dùng.</p>
                </div>
            </div>

            {/* Main Form Card */}
            <Card>
                <CardContent className="p-8 space-y-8">
                    {/* Version & Date Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-semibold">Version Number</Label>
                            <Input
                                placeholder="e.g., 2.4.1"
                                value={versionNumber}
                                onChange={(e) => setVersionNumber(e.target.value)}
                                className="h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-semibold">Release Date</Label>
                            <div className="relative">
                                <Input
                                    type="date"
                                    value={releaseDate}
                                    onChange={(e) => setReleaseDate(e.target.value)}
                                    className="h-12"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Platform & File Type Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-semibold flex items-center gap-2">
                                <Monitor className="w-4 h-4" />
                                Platform
                            </Label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder="Select Platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Windows">Windows</SelectItem>
                                    <SelectItem value="macOS">macOS</SelectItem>
                                    <SelectItem value="Linux">Linux</SelectItem>
                                    <SelectItem value="Web">Web</SelectItem>
                                    <SelectItem value="All">All Platforms</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-semibold flex items-center gap-2">
                                <FileCode className="w-4 h-4" />
                                File Type
                            </Label>
                            <Select value={fileType} onValueChange={setFileType}>
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder="Select File Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value=".exe">.exe</SelectItem>
                                    <SelectItem value=".msi">.msi</SelectItem>
                                    <SelectItem value=".zip">.zip</SelectItem>
                                    <SelectItem value=".dmg">.dmg</SelectItem>
                                    <SelectItem value=".app">.app</SelectItem>
                                    <SelectItem value=".deb">.deb</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Changelog */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="font-semibold">Changelog</Label>
                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                                Supports Markdown
                            </span>
                        </div>
                        <textarea
                            className="w-full min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            placeholder="Mô tả các thay đổi trong phiên bản này...

- Fixed critical bug in authentication flow
- Improved performance
- Added new features..."
                            value={changelog}
                            onChange={(e) => setChangelog(e.target.value)}
                        />
                    </div>

                    {/* Upload Area */}
                    <div className="space-y-2">
                        <Label className="font-semibold">Upload Binary / Package</Label>
                        <div className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group">
                            <div className="bg-primary/10 text-primary p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                <CloudUpload className="w-8 h-8" />
                            </div>
                            <p className="text-sm font-semibold">Click to upload or drag and drop</p>
                            <p className="text-xs text-muted-foreground mt-1">.zip, .dmg, .exe or .msi (Max 2GB)</p>
                        </div>

                        {/* Download URL - shown after upload */}
                        {downloadUrl && (
                            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                                <Label className="text-xs text-muted-foreground">Download URL</Label>
                                <p className="font-mono text-sm break-all">{downloadUrl}</p>
                            </div>
                        )}
                    </div>
                </CardContent>

                {/* Footer */}
                <div className="px-8 py-6 bg-muted/30 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Info className="w-4 h-4" />
                        <span className="text-xs">Version will be visible to all users immediately.</span>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onBack}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleSubmit}
                            disabled={creating || !versionNumber.trim()}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            {creating ? 'Đang tạo...' : 'Publish Version'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Status Indicators */}
            <div className="flex items-center justify-center gap-6 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    Artifact Repository Online
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    Build Nodes Ready
                </div>
            </div>
        </div>
    );
};
