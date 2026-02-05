/**
 * DownloadModal - Modal tải phần mềm cho người dùng đã có license
 * 
 * Hiển thị sau khi verify license thành công:
 * - Main software download
 * - Attachments (plugins) download
 */

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Download,
    FileArchive,
    Loader2,
    Package,
    AlertCircle,
    CheckCircle,
    Lock,
    ExternalLink
} from 'lucide-react'
import { api } from '@/services/api'
import { config } from '@/config'

interface DownloadInfo {
    authorized: boolean
    app: {
        id: number
        code: string
        name: string
    }
    version: {
        id: number
        version: string
        release_date: string
        release_notes: string | null
        platform: string
        file_type: string
    }
    license: {
        expires_at: string
        status: string
    }
    mainFile: {
        filename: string
        size: number
        downloadUrl: string
    }
    attachments: {
        id: number
        description: string
        filename: string
        size: number
        downloadUrl: string
    }[]
}

interface DownloadModalProps {
    appCode: string
    appName: string
    isOpen: boolean
    onClose: () => void
}

export function DownloadModal({ appCode, appName, isOpen, onClose }: DownloadModalProps) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [downloadInfo, setDownloadInfo] = useState<DownloadInfo | null>(null)
    const [downloadingMain, setDownloadingMain] = useState(false)
    const [downloadingAttachment, setDownloadingAttachment] = useState<number | null>(null)

    useEffect(() => {
        if (isOpen && appCode) {
            verifyAndFetchDownload()
        }
    }, [isOpen, appCode])

    const verifyAndFetchDownload = async () => {
        setLoading(true)
        setError(null)
        setDownloadInfo(null)

        try {
            const response = await api.download.verify(appCode)
            setDownloadInfo(response)
        } catch (err: any) {
            // Parse error message
            if (err.message.includes('Đăng nhập')) {
                setError('auth')
            } else if (err.message.includes('license') || err.message.includes('License')) {
                setError('license')
            } else {
                setError(err.message || 'Không thể xác thực license')
            }
        } finally {
            setLoading(false)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (!bytes) return 'N/A'
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }

    const handleDownloadMain = async () => {
        if (!downloadInfo) return

        setDownloadingMain(true)
        try {
            // Build full URL - backend returns full URL with upload domain
            // If relative path (shouldn't happen now), prepend uploadApiUrl
            const downloadUrl = downloadInfo.mainFile.downloadUrl.startsWith('http')
                ? downloadInfo.mainFile.downloadUrl
                : `${config.uploadApiUrl}${downloadInfo.mainFile.downloadUrl}`

            console.log('Download URL:', downloadUrl)

            // Fetch with authentication header
            const token = localStorage.getItem('token')
            console.log('Token present:', !!token, 'length:', token?.length, 'token start:', token?.substring(0, 20))

            const response = await fetch(downloadUrl, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            console.log('Download response:', {
                status: response.status,
                contentType: response.headers.get('Content-Type'),
                contentDisposition: response.headers.get('Content-Disposition'),
                contentLength: response.headers.get('Content-Length'),
                url: downloadUrl
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('Download failed:', errorText)
                throw new Error('Download failed')
            }

            // Get filename from Content-Disposition or use default
            const contentDisposition = response.headers.get('Content-Disposition')
            let filename = downloadInfo.mainFile.filename
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
                if (filenameMatch) filename = filenameMatch[1]
            }

            console.log('Downloading as:', filename)

            // Create blob and trigger download
            const blob = await response.blob()
            console.log('Blob created:', blob.size, 'bytes, type:', blob.type)

            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error('Download error:', error)
            alert('Không thể tải file. Vui lòng thử lại.')
        } finally {
            setDownloadingMain(false)
        }
    }

    const handleDownloadAttachment = async (attachmentId: number) => {
        const attachment = downloadInfo?.attachments.find(a => a.id === attachmentId)
        if (!attachment) return

        setDownloadingAttachment(attachmentId)
        try {
            // Build full URL - backend returns full URL with upload domain
            const downloadUrl = attachment.downloadUrl.startsWith('http')
                ? attachment.downloadUrl
                : `${config.uploadApiUrl}${attachment.downloadUrl}`

            // Fetch with authentication header
            const token = localStorage.getItem('token')
            const response = await fetch(downloadUrl, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) {
                throw new Error('Download failed')
            }

            // Get filename
            const contentDisposition = response.headers.get('Content-Disposition')
            let filename = attachment.filename
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
                if (filenameMatch) filename = filenameMatch[1]
            }

            // Create blob and trigger download
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error('Download error:', error)
            alert('Không thể tải attachment. Vui lòng thử lại.')
        } finally {
            setDownloadingAttachment(null)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Tải {appName}
                    </DialogTitle>
                    <DialogDescription>
                        Tải phần mềm và các plugin đi kèm
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Đang xác thực license...</p>
                        </div>
                    ) : error === 'auth' ? (
                        <div className="text-center py-8">
                            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                            <h3 className="font-semibold text-lg mb-2">Chưa đăng nhập</h3>
                            <p className="text-muted-foreground mb-4">
                                Vui lòng đăng nhập để tải phần mềm
                            </p>
                            <Button onClick={onClose}>Đăng nhập</Button>
                        </div>
                    ) : error === 'license' ? (
                        <div className="text-center py-8">
                            <Lock className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h3 className="font-semibold text-lg mb-2">Chưa có license</h3>
                            <p className="text-muted-foreground mb-4">
                                Bạn cần mua license để tải phần mềm này
                            </p>
                            <Button onClick={onClose}>Mua license</Button>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h3 className="font-semibold text-lg mb-2">Có lỗi xảy ra</h3>
                            <p className="text-muted-foreground mb-4">{error}</p>
                            <Button variant="outline" onClick={verifyAndFetchDownload}>Thử lại</Button>
                        </div>
                    ) : downloadInfo ? (
                        <div className="space-y-4">
                            {/* License Info */}
                            {downloadInfo.license && (
                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        <span className="text-sm font-medium">License hợp lệ</span>
                                    </div>
                                    <Badge variant="outline" className="text-green-700">
                                        HSD: {formatDate(downloadInfo.license.expires_at)}
                                    </Badge>
                                </div>
                            )}

                            {/* Version Info */}
                            <div className="text-sm text-muted-foreground">
                                Phiên bản: <span className="font-semibold text-foreground">{downloadInfo.version.version}</span>
                                <span className="mx-2">•</span>
                                {downloadInfo.version.platform} {downloadInfo.version.file_type}
                            </div>

                            {/* Main Download */}
                            <Card className="border-2 border-primary/20 bg-primary/5">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <Package className="h-6 w-6 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{appName}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {downloadInfo.mainFile.filename} • {formatFileSize(downloadInfo.mainFile.size)}
                                                </p>
                                            </div>
                                        </div>
                                        <Button onClick={handleDownloadMain} disabled={downloadingMain}>
                                            {downloadingMain ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Tải xuống
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Attachments */}
                            {downloadInfo.attachments.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                        <FileArchive className="h-4 w-4" />
                                        Plugins & Attachments ({downloadInfo.attachments.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {downloadInfo.attachments.map((att) => (
                                            <div
                                                key={att.id}
                                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <FileArchive className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm truncate">{att.description}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {att.filename} • {formatFileSize(att.size)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDownloadAttachment(att.id)}
                                                    disabled={downloadingAttachment === att.id}
                                                >
                                                    {downloadingAttachment === att.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Download className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Release Notes */}
                            {downloadInfo.version.release_notes && (
                                <details className="text-sm">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                        Xem ghi chú phát hành
                                    </summary>
                                    <div className="mt-2 p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">
                                        {downloadInfo.version.release_notes}
                                    </div>
                                </details>
                            )}
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}
