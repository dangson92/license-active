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
    Info,
    Cloud,
    Server,
    AlertCircle
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
    const [mandatory, setMandatory] = useState(false);
    const [creating, setCreating] = useState(false);

    // Upload states
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Upload destination: '' | 'vps' | 'idrive-e2'
    const [uploadDestination, setUploadDestination] = useState<'' | 'vps' | 'idrive-e2'>('');

    // Track uploaded file info for cleanup if cancel
    const [uploadedFileInfo, setUploadedFileInfo] = useState<{
        url: string;
        storage: 'vps' | 'idrive-e2';
        key?: string;
        filename?: string;
    } | null>(null);

    // Initialize form with edit data or default values
    useEffect(() => {
        if (editVersion) {
            setVersionNumber(editVersion.version || '');
            setReleaseDate(editVersion.release_date?.split('T')[0] || '');
            setChangelog(editVersion.release_notes || '');
            setDownloadUrl(editVersion.download_url || '');
            setPlatform(editVersion.platform || '');
            setFileType(editVersion.file_type || '');
            // Fix: Load mandatory state from editVersion
            setMandatory((editVersion as any).mandatory || false);
            // If editing and has download URL, set a default destination
            if (editVersion.download_url) {
                // Guess destination from URL
                if (editVersion.download_url.includes('idrive') || editVersion.download_url.includes('e2')) {
                    setUploadDestination('idrive-e2');
                } else {
                    setUploadDestination('vps');
                }
            }
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

        // Validation: cần chọn nơi lưu trữ trước
        if (!uploadDestination) {
            alert('Vui lòng chọn nơi lưu trữ file trước!');
            e.target.value = '';
            return;
        }

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

            // Upload with progress - use selected destination
            const response = await uploadFileWithProgress(file, appCode, versionNumber, uploadDestination as 'vps' | 'idrive-e2');

            // Update form with file info
            // For E2, path is already full URL; for VPS, prepend base URL
            const fileUrl = response.file.storage === 'idrive-e2'
                ? response.file.path
                : `${config.uploadApiUrl}${response.file.path}`;
            setDownloadUrl(fileUrl);
            setFileName(response.file.filename);
            setFileSize(response.file.size);

            // Save file info for cleanup if cancel
            setUploadedFileInfo({
                url: fileUrl,
                storage: response.file.storage || uploadDestination as 'vps' | 'idrive-e2',
                key: response.file.key,
                filename: response.file.filename,
            });

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
    const uploadFileWithProgress = (file: File, appCode: string, version: string, destination: 'vps' | 'idrive-e2'): Promise<any> => {
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
                        reject(new Error(error.message || error.error || `HTTP ${xhr.status}`));
                    } catch {
                        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
                    }
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error occurred')));
            xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
            xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')));

            // Determine upload endpoint based on destination
            const uploadEndpoint = destination === 'idrive-e2'
                ? `${config.uploadApiUrl}/api/admin/app-versions/upload-e2`
                : `${config.uploadApiUrl}/api/admin/app-versions/upload`;

            const token = localStorage.getItem('auth_token');
            xhr.open('POST', uploadEndpoint);
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

        if (!uploadDestination) {
            alert('Vui lòng chọn nơi lưu trữ file trước!');
            return;
        }

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

            const response = await uploadFileWithProgress(file, appCode, versionNumber, uploadDestination as 'vps' | 'idrive-e2');

            // For E2, path is already full URL; for VPS, prepend base URL
            const fileUrl = response.file.storage === 'idrive-e2'
                ? response.file.path
                : `${config.uploadApiUrl}${response.file.path}`;
            setDownloadUrl(fileUrl);
            setFileName(response.file.filename);
            setFileSize(response.file.size);

            // Save file info for cleanup if cancel
            setUploadedFileInfo({
                url: fileUrl,
                storage: response.file.storage || uploadDestination as 'vps' | 'idrive-e2',
                key: response.file.key,
                filename: response.file.filename,
            });

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
                    mandatory: mandatory,
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
                    mandatory: mandatory,
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

    // Handle cancel - cleanup uploaded file if any
    const handleCancel = async () => {
        // If file was uploaded but version not created, cleanup the orphan file
        if (uploadedFileInfo && !isEditMode) {
            const confirmCancel = confirm(
                'Bạn đã upload file nhưng chưa tạo version.\nFile sẽ bị xóa nếu bạn hủy.\n\nBạn có chắc muốn hủy?'
            );
            if (!confirmCancel) return;

            try {
                // Call cleanup API
                const token = localStorage.getItem('auth_token');
                const response = await fetch(`${config.uploadApiUrl}/api/admin/app-versions/cleanup-upload`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(uploadedFileInfo),
                });

                if (response.ok) {
                    console.log('Cleanup successful');
                } else {
                    console.error('Cleanup failed:', await response.text());
                }
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }

        onBack();
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
                <button onClick={handleCancel} className="hover:text-primary transition-colors">
                    Applications
                </button>
                <span>›</span>
                <span className="text-foreground font-medium">{appName}</span>
                <span>›</span>
                <span className="text-foreground font-medium">{isEditMode ? 'Edit Version' : 'Add Version'}</span>
            </nav>

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleCancel}>
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

                    {/* Mandatory Update Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-lg border border-orange-200 bg-orange-50/50">
                        <div className="space-y-1">
                            <Label className="font-semibold text-orange-800">Bắt buộc cập nhật</Label>
                            <p className="text-xs text-orange-600">
                                Khi bật, người dùng sẽ phải cập nhật lên phiên bản này để tiếp tục sử dụng.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMandatory(!mandatory)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${mandatory ? 'bg-orange-500' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mandatory ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Upload Area */}
                    <div className="space-y-4">
                        <Label className="font-semibold">Upload Binary / Package</Label>

                        {/* Upload Destination Selector */}
                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Chọn nơi lưu trữ file <span className="text-red-500">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setUploadDestination('vps')}
                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${uploadDestination === 'vps'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    <Server className={`w-6 h-6 ${uploadDestination === 'vps' ? 'text-blue-500' : 'text-gray-400'}`} />
                                    <div className="text-left">
                                        <p className="font-semibold">VPS Server</p>
                                        <p className="text-xs opacity-70">Lưu trên máy chủ riêng</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUploadDestination('idrive-e2')}
                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${uploadDestination === 'idrive-e2'
                                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    <Cloud className={`w-6 h-6 ${uploadDestination === 'idrive-e2' ? 'text-purple-500' : 'text-gray-400'}`} />
                                    <div className="text-left">
                                        <p className="font-semibold">iDrive E2</p>
                                        <p className="text-xs opacity-70">Cloud Storage (S3)</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Show upload area only when destination is selected */}
                        {uploadDestination ? (
                            <>
                                <p className="text-xs text-muted-foreground">
                                    ⚠️ Lưu ý: Phải nhập <strong>Version Number</strong> trước khi upload file.
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                                        {uploadDestination === 'vps' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}">
                                        {uploadDestination === 'vps' ? '📁 VPS' : '☁️ iDrive E2'}
                                    </span>
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
                                                    : uploadDestination === 'vps'
                                                        ? 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/50 hover:border-blue-400'
                                                        : 'border-purple-200 bg-purple-50/30 hover:bg-purple-50/50 hover:border-purple-400'
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
                                            <div className={`p-4 rounded-full mb-4 animate-pulse ${uploadDestination === 'vps' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                                }`}>
                                                <CloudUpload className="w-8 h-8" />
                                            </div>
                                            <p className={`text-sm font-semibold ${uploadDestination === 'vps' ? 'text-blue-700' : 'text-purple-700'
                                                }`}>
                                                Đang upload lên {uploadDestination === 'vps' ? 'VPS' : 'iDrive E2'}... {uploadProgress}%
                                            </p>
                                            <div className="w-full max-w-xs mt-4 bg-gray-200 rounded-full h-2.5">
                                                <div
                                                    className={`h-2.5 rounded-full transition-all duration-300 ${uploadDestination === 'vps' ? 'bg-blue-600' : 'bg-purple-600'
                                                        }`}
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
                                            <div className={`p-4 rounded-full mb-4 group-hover:scale-110 transition-transform ${uploadDestination === 'vps' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                                }`}>
                                                {uploadDestination === 'vps' ? <Server className="w-8 h-8" /> : <Cloud className="w-8 h-8" />}
                                            </div>
                                            <p className="text-sm font-semibold">Click hoặc kéo thả file vào đây</p>
                                            <p className="text-xs text-muted-foreground mt-1">.zip, .dmg, .exe or .msi (Max 2GB)</p>
                                        </>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-50/50">
                                <AlertCircle className="w-8 h-8 text-gray-400 mb-4" />
                                <p className="text-sm text-gray-500 font-medium">Vui lòng chọn nơi lưu trữ file</p>
                                <p className="text-xs text-gray-400 mt-1">Chọn VPS hoặc iDrive E2 ở trên để tiếp tục</p>
                            </div>
                        )}

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
                        <Button variant="outline" onClick={handleCancel}>
                            Hủy
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
