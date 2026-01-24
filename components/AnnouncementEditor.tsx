import React, { useState, useEffect } from 'react';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

// Icons
import { ArrowLeft, Save, Eye } from 'lucide-react';

interface AnnouncementEditorProps {
    announcementId?: number; // undefined = create new
    onBack: () => void;
    onSuccess: () => void;
}

export const AnnouncementEditor: React.FC<AnnouncementEditorProps> = ({
    announcementId,
    onBack,
    onSuccess
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<string>('general');
    const [isPublished, setIsPublished] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const isEditing = !!announcementId;

    useEffect(() => {
        if (announcementId) {
            loadAnnouncement();
        }
    }, [announcementId]);

    const loadAnnouncement = async () => {
        if (!announcementId) return;
        try {
            setLoading(true);
            const data = await api.announcements.getById(announcementId);
            setTitle(data.title);
            setContent(data.content);
            setCategory(data.category);
            setIsPublished(data.is_published);
        } catch (error) {
            console.error('Failed to load announcement:', error);
            alert('Không thể tải announcement!');
            onBack();
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (publish: boolean) => {
        if (!title.trim()) {
            alert('Vui lòng nhập tiêu đề!');
            return;
        }
        if (!content.trim()) {
            alert('Vui lòng nhập nội dung!');
            return;
        }

        try {
            setSaving(true);
            if (isEditing) {
                await api.announcements.update(announcementId!, { title, content, category });
                if (publish !== isPublished) {
                    await api.announcements.togglePublish(announcementId!);
                }
            } else {
                await api.announcements.create({
                    title,
                    content,
                    category,
                    is_published: publish
                });
            }
            onSuccess();
        } catch (error: any) {
            alert(`Lỗi: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header with breadcrumb */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <p className="text-sm text-muted-foreground">
                            Announcements &gt; {isEditing ? 'Edit' : 'Create New'}
                        </p>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isEditing ? 'Edit Announcement' : 'Create New Announcement'}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                        Discard Draft
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleSave(true)} disabled={saving}>
                        {saving ? 'Đang lưu...' : 'Publish'}
                    </Button>
                </div>
            </div>

            {/* Main Form */}
            <Card>
                <CardHeader>
                    <CardTitle>{isEditing ? 'Edit Announcement' : 'Create New Announcement'}</CardTitle>
                    <CardDescription>
                        {isEditing ? 'Chỉnh sửa thông báo.' : 'Tạo một bài post mới cho hệ thống.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label>Announcement Title</Label>
                        <Input
                            placeholder="e.g. Scheduled System Maintenance"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="w-full md:w-[250px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="system_update">System Update</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="news">Product News</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Visibility Toggle */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <Label className="text-base">Public Visibility</Label>
                            <p className="text-sm text-muted-foreground">
                                Show this announcement to all users immediately after publishing.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                            <span className="text-sm font-medium text-blue-600">
                                {isPublished ? 'SHOW' : 'HIDE'}
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea
                            placeholder="Write your announcement content here... Use Markdown or rich text."
                            className="min-h-[300px] font-mono text-sm"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>MARKDOWN IS SUPPORTED</span>
                            <span>{wordCount} WORDS</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                    {isEditing ? 'Changes will be saved automatically.' : 'Draft will be saved when you click a button.'}
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={onBack}>
                        Cancel
                    </Button>
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Draft
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleSave(true)} disabled={saving}>
                        <Eye className="w-4 h-4 mr-2" />
                        {saving ? 'Publishing...' : 'Publish'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
