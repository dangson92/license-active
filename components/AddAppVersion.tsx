import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { config } from '../config';

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

interface EditVersionData {
    id: number;
    version: string;
    release_date: string;
    release_notes?: string;
    download_url?: string;
    platform?: string;
    file_type?: string;
}

interface AddAppVersionProps {
    appId?: string;
    appName?: string;
    editVersion?: EditVersionData | null; // If provided, component is in edit mode
    onBack: () => void;
    onSuccess: () => void;
}

export const AddAppVersion: React.FC<AddAppVersionProps> = ({
    appId,
    appName = 'Application',
    editVersion,
    onBack,
    onSuccess
}) => {
    const isEditMode = !!editVersion;
    const [versionNumber, setVersionNumber] = useState('');
    const [releaseDate, setReleaseDate] = useState('');
    const [platform, setPlatform] = useState('');
    const [fileType, setFileType] = useState('');
    const [changelog, setChangelog] = useState('');
    const [downloadUrl, setDownloadUrl] = useState('');
    const [creating, setCreating] = useState(false);

    // Upload states
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize form with edit data or default values
    useEffect(() => {
        if (editVersion) {
            setVersionNumber(editVersion.version || '');
            setReleaseDate(editVersion.release_date?.split('T')[0] || '');
            setChangelog(editVersion.release_notes || '');
            setDownloadUrl(editVersion.download_url || '');
            setPlatform(editVersion.platform || '');
            setFileType(editVersion.file_type || '');
        } else {
            // Set default release date (today) for new version
            const today = new Date().toISOString().split('T')[0];
            setReleaseDate(today);
        }
    }, [editVersion]);

    // Handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation: cần có version trước khi upload
        if (!versionNumber.trim()) {
            alert('Vui lòng nhập Version Number trước khi upload file!');
            e.target.value = '';
            return;
        }

        if (!appId) {
            alert('Không tìm thấy App ID!');
            e.target.value = '';
            return;
        }

        try {
            setUploadingFile(true);
            setUploadProgress(0);

            // Get app code from API
            const appInfo = await api.admin.getApp(parseInt(appId));
            const appCode = appInfo.code;

            // Upload with progress
            const response = await uploadFileWithProgress(file, appCode, versionNumber);

            // Update form with file info
            setDownloadUrl(`${config.uploadApiUrl}${response.file.path}`);
            setFileName(response.file.filename);
            setFileSize(response.file.size);

            alert('Upload file thành công!');
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload file thất bại: ' + (error as Error).message);
        } finally {
            setUploadingFile(false);
            setUploadProgress(0);
        }
    };

    // Upload file với XMLHttpRequest để track progress
    const uploadFileWithProgress = (file: File, appCode: string, version: string): Promise<any> => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('appCode', appCode);
            formData.append('version', version);
            formData.append('file', file);

            const xhr = new XMLHttpRequest();
            xhr.timeout = 30 * 60 * 1000; // 30 minutes

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    setUploadProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid response from server'));
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.error || `HTTP ${xhr.status}`));
                    } catch {
                        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
                    }
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error occurred')));
            xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
            xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')));

            const token = localStorage.getItem('auth_token');
            xhr.open('POST', `${config.uploadApiUrl}/api/admin/app-versions/upload`);
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.send(formData);
        });
    };

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    // Drag and drop state
    const [isDragging, setIsDragging] = useState(false);

    // Handle drag events
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!uploadingFile && versionNumber.trim()) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (uploadingFile) return;

        if (!versionNumber.trim()) {
            alert('Vui lòng nhập Version Number trước khi upload file!');
            return;
        }

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        const file = files[0];
        const allowedExtensions = ['.zip', '.exe', '.msi', '.dmg', '.deb'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
            alert('Chỉ chấp nhận file: ' + allowedExtensions.join(', '));
            return;
        }

        // Trigger upload
        try {
            setUploadingFile(true);
            setUploadProgress(0);

            const appInfo = await api.admin.getApp(parseInt(appId || '0'));
            const appCode = appInfo.code;

            const response = await uploadFileWithProgress(file, appCode, versionNumber);

            setDownloadUrl(`${config.uploadApiUrl}${response.file.path}`);
            setFileName(response.file.filename);
            setFileSize(response.file.size);

            alert('Upload file thành công!');
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload file thất bại: ' + (error as Error).message);
        } finally {
            setUploadingFile(false);
            setUploadProgress(0);
        }
    };

    const handleSubmit = async () => {
        if (!versionNumber.trim()) {
            alert('Vui lòng nhập Version Number!');
            return;
        }

        try {
            setCreating(true);

            if (isEditMode && editVersion) {
                // Update existing version
                await api.admin.updateAppVersion(editVersion.id, {
                    version: versionNumber,
                    platform: platform || 'Windows',
                    file_type: fileType || '.exe',
                    release_notes: changelog,
                    download_url: downloadUrl || '',
                    release_date: releaseDate,
                });
                alert(`Version ${versionNumber} đã được cập nhật thành công!`);
            } else {
                // Create new version
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
            }

            onSuccess();
        } catch (error: any) {
            alert(`Không thể ${isEditMode ? 'cập nhật' : 'tạo'} version!\n\nLỗi: ${error.message}`);
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
                <span className="text-foreground font-medium">{isEditMode ? 'Edit Version' : 'Add Version'}</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {isEditMode ? 'Edit App Version' : 'Add New App Version'}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {isEditMode
                            ? 'Cập nhật thông tin phiên bản.'
                            : 'Tạo phiên bản mới cho ứng dụng và thông báo cho người dùng.'
                        }
                    </p>
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
                        <p className="text-xs text-muted-foreground">
                            ⚠️ Lưu ý: Phải nhập <strong>Version Number</strong> trước khi upload file.
                        </p>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip,.exe,.msi,.dmg,.deb"
                            onChange={handleFileUpload}
                            disabled={uploadingFile || !versionNumber.trim()}
                            className="hidden"
                        />

                        {/* Clickable and Draggable upload area */}
                        <div
                            onClick={() => {
                                if (!versionNumber.trim()) {
                                    alert('Vui lòng nhập Version Number trước khi upload file!');
                                    return;
                                }
                                if (!uploadingFile) {
                                    fileInputRef.current?.click();
                                }
                            }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer group
                                ${isDragging
                                    ? 'border-primary bg-primary/10 scale-[1.02]'
                                    : uploadingFile
                                        ? 'border-blue-400 bg-blue-50/50 cursor-wait'
                                        : !versionNumber.trim()
                                            ? 'border-gray-300 bg-gray-100/50 cursor-not-allowed opacity-60'
                                            : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50'
                                }`}
                        >
                            {isDragging ? (
                                <>
                                    <div className="bg-primary/20 text-primary p-4 rounded-full mb-4 animate-bounce">
                                        <CloudUpload className="w-8 h-8" />
                                    </div>
                                    <p className="text-sm font-semibold text-primary">Thả file vào đây!</p>
                                    <p className="text-xs text-primary/70 mt-1">.zip, .dmg, .exe or .msi</p>
                                </>
                            ) : uploadingFile ? (
                                <>
                                    <div className="bg-blue-100 text-blue-600 p-4 rounded-full mb-4 animate-pulse">
                                        <CloudUpload className="w-8 h-8" />
                                    </div>
                                    <p className="text-sm font-semibold text-blue-700">Đang upload... {uploadProgress}%</p>
                                    <div className="w-full max-w-xs mt-4 bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </>
                            ) : fileName ? (
                                <>
                                    <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4">
                                        <Package className="w-8 h-8" />
                                    </div>
                                    <p className="text-sm font-semibold text-green-700">✓ Upload thành công!</p>
                                    <p className="text-xs text-green-600 mt-1 font-mono">{fileName}</p>
                                    <p className="text-xs text-green-600">{formatFileSize(fileSize)}</p>
                                    <p className="text-xs text-muted-foreground mt-2">Click hoặc kéo thả để upload file khác</p>
                                </>
                            ) : (
                                <>
                                    <div className="bg-primary/10 text-primary p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                        <CloudUpload className="w-8 h-8" />
                                    </div>
                                    <p className="text-sm font-semibold">Click hoặc kéo thả file vào đây</p>
                                    <p className="text-xs text-muted-foreground mt-1">.zip, .dmg, .exe or .msi (Max 2GB)</p>
                                </>
                            )}
                        </div>

                        {/* Download URL - shown after upload */}
                        {downloadUrl && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <Label className="text-xs text-green-700 font-medium">Download URL</Label>
                                <p className="font-mono text-sm break-all text-green-800">{downloadUrl}</p>
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
                            {creating
                                ? (isEditMode ? 'Đang cập nhật...' : 'Đang tạo...')
                                : (isEditMode ? 'Save Changes' : 'Publish Version')
                            }
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
