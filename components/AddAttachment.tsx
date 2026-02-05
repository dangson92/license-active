/**
 * AddAttachment - Thêm/Sửa File Attachment cho App
 * 
 * Giao diện tương tự AddAppVersion - inline form, không dùng popup
 */

import React, { useState, useRef } from 'react';
import { api } from '../services/api';
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
    FileArchive,
    Cloud,
    Server,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';

interface EditAttachmentData {
    id: number;
    description: string;
    file_name: string;
    original_name: string;
    file_size: number | null;
    download_url: string;
    storage_type: 'vps' | 'idrive-e2';
}

interface AddAttachmentProps {
    appId: string;
    appName: string;
    appCode: string;
    editAttachment?: EditAttachmentData | null;
    onBack: () => void;
    onSuccess: () => void;
}

export const AddAttachment: React.FC<AddAttachmentProps> = ({
    appId,
    appName,
    appCode,
    editAttachment,
    onBack,
    onSuccess
}) => {
    const isEditMode = !!editAttachment;

    // Form states
    const [description, setDescription] = useState(editAttachment?.description || '');
    const [storageType, setStorageType] = useState<'vps' | 'idrive-e2'>(editAttachment?.storage_type || 'vps');
    const [saving, setSaving] = useState(false);

    // Upload states
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileName, setFileName] = useState(editAttachment?.original_name || '');
    const [fileSize, setFileSize] = useState(editAttachment?.file_size || 0);
    const [downloadUrl, setDownloadUrl] = useState(editAttachment?.download_url || '');
    const [storageKey, setStorageKey] = useState<string | undefined>(undefined);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Drag and drop
    const [isDragOver, setIsDragOver] = useState(false);

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const handleFileSelect = async (file: File) => {
        if (!file) return;

        // Validate .zip only
        if (!file.name.toLowerCase().endsWith('.zip')) {
            alert('Chỉ chấp nhận file .zip');
            return;
        }

        setFileName(file.name);
        setFileSize(file.size);
        setUploadingFile(true);
        setUploadProgress(0);

        try {
            let uploadResult: { url: string; key?: string };

            if (storageType === 'idrive-e2') {
                // Bước 1: Lấy presigned URL từ server
                setUploadProgress(2); // Show small progress to indicate starting

                const token = localStorage.getItem('auth_token');
                const presignedResponse = await fetch(`${config.uploadApiUrl}/api/admin/apps/${appId}/attachments/get-presigned-url`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        appCode,
                        filename: file.name,
                        fileSize: file.size,
                    }),
                });

                if (!presignedResponse.ok) {
                    const error = await presignedResponse.json();
                    throw new Error(error.message || 'Failed to get presigned URL');
                }

                const presignedData = await presignedResponse.json();
                console.log('📎 Got presigned URL for attachment, uploading to E2...');

                // Bước 2: Upload trực tiếp lên E2 bằng presigned URL
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.timeout = 60 * 60 * 1000; // 1 hour for large files

                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable) {
                            const percentComplete = Math.round((e.loaded / e.total) * 100);
                            setUploadProgress(percentComplete);
                        }
                    });

                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            console.log('✅ Attachment upload to E2 completed!');
                            resolve();
                        } else {
                            console.error('E2 upload failed:', xhr.status, xhr.responseText);
                            reject(new Error(`E2 upload failed: HTTP ${xhr.status}`));
                        }
                    });

                    xhr.addEventListener('error', () => reject(new Error('Network error during E2 upload')));
                    xhr.addEventListener('abort', () => reject(new Error('E2 upload cancelled')));
                    xhr.addEventListener('timeout', () => reject(new Error('E2 upload timeout')));

                    xhr.open('PUT', presignedData.uploadUrl);
                    xhr.setRequestHeader('Content-Type', presignedData.contentType || 'application/zip');
                    xhr.send(file);
                });

                uploadResult = {
                    url: presignedData.publicUrl,
                    key: presignedData.key
                };
            } else {
                // Upload to VPS
                const formData = new FormData();
                formData.append('file', file);
                formData.append('appCode', appCode);

                const token = localStorage.getItem('auth_token');

                uploadResult = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.timeout = 60 * 60 * 1000; // 1 hour for large files
                    xhr.open('POST', `${config.uploadApiUrl}/api/admin/apps/${appId}/attachments/upload`, true);

                    if (token) {
                        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    }

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            setUploadProgress(Math.round((e.loaded / e.total) * 100));
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const response = JSON.parse(xhr.responseText);
                                resolve({ url: response.file.path });
                            } catch (e) {
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
                    };

                    xhr.onerror = () => reject(new Error('Network error occurred'));
                    xhr.ontimeout = () => reject(new Error('Upload timeout'));
                    xhr.send(formData);
                });
            }

            setDownloadUrl(uploadResult.url);
            setStorageKey(uploadResult.key);
            setUploadProgress(100);

        } catch (error: any) {
            console.error('Upload error:', error);
            alert(error.message || 'Upload thất bại');
            setFileName('');
            setFileSize(0);
        } finally {
            setUploadingFile(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleSubmit = async () => {
        if (!description.trim()) {
            alert('Vui lòng nhập mô tả');
            return;
        }

        if (!downloadUrl && !isEditMode) {
            alert('Vui lòng upload file');
            return;
        }

        setSaving(true);

        try {
            if (isEditMode && editAttachment) {
                // Update existing attachment
                await api.admin.updateAttachment(editAttachment.id, {
                    description: description.trim()
                });
            } else {
                // Create new attachment
                await api.admin.createAttachment(parseInt(appId), {
                    description: description.trim(),
                    file_name: fileName.replace('.zip', '') + '_' + Date.now() + '.zip',
                    original_name: fileName,
                    file_size: fileSize,
                    download_url: downloadUrl,
                    storage_type: storageType,
                    storage_key: storageKey
                });
            }

            onSuccess();
        } catch (error: any) {
            console.error('Save error:', error);
            alert(error.message || 'Lưu thất bại');
        } finally {
            setSaving(false);
        }
    };

    const clearFile = () => {
        setFileName('');
        setFileSize(0);
        setDownloadUrl('');
        setStorageKey(undefined);
        setUploadProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1 text-sm font-bold text-primary hover:bg-primary/10 px-2 py-1 -ml-2 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {isEditMode ? 'Sửa File Attachment' : 'Thêm File Attachment'}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {appName} - Upload file đính kèm (plugin, extension, v.v.)
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Description */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileArchive className="w-5 h-5 text-blue-600" />
                                Thông tin Attachment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="description">Mô tả *</Label>
                                <Input
                                    id="description"
                                    placeholder="VD: Plugin ABC, Extension XYZ..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Tên hiển thị cho người dùng khi download
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* File Upload */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Upload className="w-5 h-5 text-emerald-600" />
                                Upload File
                            </CardTitle>
                            <CardDescription>
                                Chỉ chấp nhận file .zip
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Storage Type Selection */}
                            {!isEditMode && (
                                <div className="space-y-2">
                                    <Label>Lưu trữ</Label>
                                    <Select
                                        value={storageType}
                                        onValueChange={(v: 'vps' | 'idrive-e2') => setStorageType(v)}
                                        disabled={!!downloadUrl}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="vps">
                                                <div className="flex items-center gap-2">
                                                    <Server className="w-4 h-4" />
                                                    VPS (Local Server)
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="idrive-e2">
                                                <div className="flex items-center gap-2">
                                                    <Cloud className="w-4 h-4" />
                                                    iDrive E2 (Cloud)
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Upload Zone */}
                            {!isEditMode && (
                                <div
                                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                                        } ${downloadUrl ? 'bg-emerald-50 border-emerald-300' : ''}`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                >
                                    <input
                                        type="file"
                                        accept=".zip"
                                        ref={fileInputRef}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileSelect(file);
                                        }}
                                        className="hidden"
                                    />

                                    {uploadingFile ? (
                                        <div className="space-y-4">
                                            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                                            <p className="text-sm font-medium">Đang upload... {uploadProgress}%</p>
                                            <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                                                <div
                                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    ) : downloadUrl ? (
                                        <div className="space-y-4">
                                            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
                                            <div>
                                                <p className="font-medium text-emerald-700">{fileName}</p>
                                                <p className="text-sm text-emerald-600">{formatFileSize(fileSize)}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={clearFile}>
                                                Chọn file khác
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <FileArchive className="w-12 h-12 mx-auto text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">Kéo thả file .zip vào đây</p>
                                                <p className="text-sm text-muted-foreground">hoặc</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Chọn file
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Edit mode - show current file info */}
                            {isEditMode && editAttachment && (
                                <div className="bg-muted/50 rounded-lg p-4">
                                    <p className="text-sm text-muted-foreground mb-2">File hiện tại:</p>
                                    <div className="flex items-center gap-3">
                                        <FileArchive className="w-8 h-8 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{editAttachment.original_name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatFileSize(editAttachment.file_size || 0)} • {editAttachment.storage_type === 'idrive-e2' ? 'iDrive E2' : 'VPS'}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        * Không thể thay đổi file trong chế độ sửa. Nếu cần file khác, hãy xóa và tạo mới.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Actions Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Hành động</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700"
                                onClick={handleSubmit}
                                disabled={saving || uploadingFile || (!downloadUrl && !isEditMode)}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : isEditMode ? (
                                    'Cập nhật Attachment'
                                ) : (
                                    'Tạo Attachment'
                                )}
                            </Button>
                            <Button variant="outline" className="w-full" onClick={onBack}>
                                Hủy
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Lưu ý
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p>• Chỉ hỗ trợ file .zip</p>
                            <p>• Mô tả sẽ hiển thị cho người dùng khi download</p>
                            <p>• Attachment có thể được gắn với nhiều phiên bản phần mềm</p>
                            <p>• Người dùng có license active mới download được</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
