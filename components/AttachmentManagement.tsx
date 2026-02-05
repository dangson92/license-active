/**
 * AttachmentManagement - Quản lý File Attachments cho App
 * 
 * Tab riêng trong Version Management để upload và quản lý attachments
 * Attachments là các file đính kèm (plugins) có thể link với nhiều versions
 */

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Upload, FileArchive, Loader2, Edit, X } from 'lucide-react'
import { api } from '@/services/api'
import { config } from '@/config'

// Toast notification helper - using simple alert for now
const toast = {
    success: (msg: string) => console.log('✅', msg),
    error: (msg: string) => { console.error('❌', msg); alert(msg) }
}

interface Attachment {
    id: number
    file_name: string
    original_name: string
    file_size: number | null
    description: string | null
    download_url: string
    storage_type: 'vps' | 'idrive-e2'
    created_at: string
}

interface AttachmentManagementProps {
    appId: number
    appName: string
    appCode: string
}

export function AttachmentManagement({ appId, appName, appCode }: AttachmentManagementProps) {
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

    // Form state
    const [description, setDescription] = useState('')
    const [storageType, setStorageType] = useState<'vps' | 'idrive-e2'>('vps')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploading, setUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load attachments
    useEffect(() => {
        loadAttachments()
    }, [appId])

    const loadAttachments = async () => {
        try {
            setLoading(true)
            const response = await api.admin.getAttachments(appId)
            setAttachments(response.items || [])
        } catch (error) {
            console.error('Error loading attachments:', error)
            toast.error('Không thể tải danh sách attachments')
        } finally {
            setLoading(false)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate .zip only
        if (!file.name.toLowerCase().endsWith('.zip')) {
            toast.error('Chỉ chấp nhận file .zip')
            return
        }

        setSelectedFile(file)
    }

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Vui lòng chọn file')
            return
        }

        if (!description.trim()) {
            toast.error('Vui lòng nhập mô tả')
            return
        }

        setUploading(true)
        setUploadProgress(0)

        try {
            let uploadResult: { filename: string; path: string; size: number; key?: string }

            if (storageType === 'idrive-e2') {
                // Get presigned URL and upload directly
                const presignedResponse = await api.admin.getAttachmentPresignedUrl(appId, appCode, selectedFile.name)

                // Upload to E2 using XHR for progress
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest()
                    xhr.open('PUT', presignedResponse.uploadUrl, true)
                    xhr.setRequestHeader('Content-Type', 'application/zip')

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            setUploadProgress(Math.round((e.loaded / e.total) * 100))
                        }
                    }

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve()
                        } else {
                            reject(new Error('Upload failed'))
                        }
                    }

                    xhr.onerror = () => reject(new Error('Upload failed'))
                    xhr.send(selectedFile)
                })

                uploadResult = {
                    filename: presignedResponse.key.split('/').pop() || selectedFile.name,
                    path: presignedResponse.publicUrl,
                    size: selectedFile.size,
                    key: presignedResponse.key
                }
            } else {
                // Upload to VPS using XHR for progress
                const formData = new FormData()
                formData.append('file', selectedFile)
                formData.append('appCode', appCode)

                const token = localStorage.getItem('auth_token')

                uploadResult = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest()
                    xhr.open('POST', `${config.uploadApiUrl}/api/admin/apps/${appId}/attachments/upload`, true)

                    if (token) {
                        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
                    }

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            setUploadProgress(Math.round((e.loaded / e.total) * 100))
                        }
                    }

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const response = JSON.parse(xhr.responseText)
                            resolve(response.file)
                        } else {
                            reject(new Error('Upload failed'))
                        }
                    }

                    xhr.onerror = () => reject(new Error('Upload failed'))
                    xhr.send(formData)
                })
            }

            // Create attachment record
            await api.admin.createAttachment(appId, {
                description: description.trim(),
                file_name: uploadResult.filename,
                original_name: selectedFile.name,
                file_size: uploadResult.size,
                download_url: uploadResult.path,
                storage_type: storageType,
                storage_key: uploadResult.key
            })

            toast.success('Upload attachment thành công!')
            setShowAddDialog(false)
            resetForm()
            loadAttachments()

        } catch (error: any) {
            console.error('Upload error:', error)
            toast.error(error.message || 'Upload thất bại')
        } finally {
            setUploading(false)
        }
    }

    const handleEdit = (attachment: Attachment) => {
        setEditingAttachment(attachment)
        setDescription(attachment.description || '')
        setShowEditDialog(true)
    }

    const handleUpdateDescription = async () => {
        if (!editingAttachment) return

        try {
            await api.admin.updateAttachment(editingAttachment.id, {
                description: description.trim()
            })
            toast.success('Đã cập nhật mô tả')
            setShowEditDialog(false)
            setEditingAttachment(null)
            loadAttachments()
        } catch (error: any) {
            toast.error(error.message || 'Cập nhật thất bại')
        }
    }

    const handleDelete = async (id: number) => {
        try {
            await api.admin.deleteAttachment(id)
            toast.success('Đã xóa attachment')
            setDeleteConfirm(null)
            loadAttachments()
        } catch (error: any) {
            toast.error(error.message || 'Xóa thất bại')
        }
    }

    const resetForm = () => {
        setDescription('')
        setStorageType('vps')
        setSelectedFile(null)
        setUploadProgress(0)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return 'N/A'
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <FileArchive className="h-5 w-5" />
                    File Attachments - {appName}
                </CardTitle>
                <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm Attachment
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : attachments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <FileArchive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Chưa có file attachment nào</p>
                        <p className="text-sm">Bấm "Thêm Attachment" để upload file đính kèm</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mô tả</TableHead>
                                <TableHead>File</TableHead>
                                <TableHead>Kích thước</TableHead>
                                <TableHead>Storage</TableHead>
                                <TableHead>Ngày tạo</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attachments.map((att) => (
                                <TableRow key={att.id}>
                                    <TableCell className="font-medium">{att.description || att.original_name}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{att.original_name}</TableCell>
                                    <TableCell>{formatFileSize(att.file_size)}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${att.storage_type === 'idrive-e2'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                            }`}>
                                            {att.storage_type === 'idrive-e2' ? 'iDrive E2' : 'VPS'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm">{formatDate(att.created_at)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(att)}
                                            className="mr-1"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteConfirm(att.id)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            {/* Add Attachment Dialog */}
            <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); resetForm(); } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Thêm Attachment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Mô tả *</Label>
                            <Input
                                placeholder="Ví dụ: Plugin ABC, Extension XYZ..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Lưu trữ</Label>
                            <Select value={storageType} onValueChange={(v: 'vps' | 'idrive-e2') => setStorageType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vps">VPS (Local)</SelectItem>
                                    <SelectItem value="idrive-e2">iDrive E2 (Cloud)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>File ZIP *</Label>
                            <div className="border-2 border-dashed rounded-lg p-4 text-center">
                                <input
                                    type="file"
                                    accept=".zip"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                {selectedFile ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileArchive className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm">{selectedFile.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                ({formatFileSize(selectedFile.size)})
                                            </span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Chọn file .zip
                                    </Button>
                                )}
                            </div>
                        </div>

                        {uploading && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Đang upload...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }} disabled={uploading}>
                            Hủy
                        </Button>
                        <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Đang upload...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Description Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Sửa mô tả</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Mô tả</Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>Hủy</Button>
                        <Button onClick={handleUpdateDescription}>Lưu</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Xác nhận xóa</DialogTitle>
                    </DialogHeader>
                    <p>Bạn có chắc muốn xóa attachment này? File sẽ bị xóa vĩnh viễn.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Hủy</Button>
                        <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                            Xóa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
