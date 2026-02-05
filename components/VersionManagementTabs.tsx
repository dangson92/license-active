/**
 * VersionManagementTabs - Tabs wrapper cho Version Management
 * 
 * Tab 1: Phần mềm - VersionManagement (existing)
 * Tab 2: File Attachment - AttachmentManagement (new)
 */

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader } from '@/components/ui/card'
import { Package, FileArchive, ChevronDown } from 'lucide-react'
import { VersionManagement } from './VersionManagement'
import { AttachmentManagement } from './AttachmentManagement'
import { App } from '../types'

interface VersionManagementTabsProps {
    apps: App[]
}

export function VersionManagementTabs({ apps }: VersionManagementTabsProps) {
    const [activeTab, setActiveTab] = useState('software')
    const [selectedAppId, setSelectedAppId] = useState<number>(0)

    // Auto-select first app
    useEffect(() => {
        if (apps.length > 0 && selectedAppId === 0) {
            setSelectedAppId(apps[0].id)
        }
    }, [apps, selectedAppId])

    const selectedApp = apps.find(a => a.id === selectedAppId)

    return (
        <div className="space-y-4">
            {/* App Selector for Attachments Tab */}
            {activeTab === 'attachments' && (
                <Card className="mb-4">
                    <CardHeader className="py-3">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-muted-foreground">Chọn ứng dụng:</span>
                            <Select
                                value={selectedAppId.toString()}
                                onValueChange={(v) => setSelectedAppId(parseInt(v))}
                            >
                                <SelectTrigger className="w-[300px]">
                                    <SelectValue placeholder="Chọn ứng dụng" />
                                </SelectTrigger>
                                <SelectContent>
                                    {apps.map(app => (
                                        <SelectItem key={app.id} value={app.id.toString()}>
                                            {app.name} ({app.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

                <TabsContent value="software" className="mt-4">
                    {/* Keep original VersionManagement - it has its own app selector */}
                    <VersionManagement apps={apps} />
                </TabsContent>

                <TabsContent value="attachments" className="mt-4">
                    {selectedApp ? (
                        <AttachmentManagement
                            appId={selectedApp.id}
                            appName={selectedApp.name}
                            appCode={selectedApp.code}
                        />
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Vui lòng chọn ứng dụng để quản lý file attachments
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
