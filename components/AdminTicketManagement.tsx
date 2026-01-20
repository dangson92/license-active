import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Plus,
    Download,
    Ban,
    History,
    Monitor,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Check,
    X,
    AlertTriangle,
    Edit,
    Filter,
    Save,
    MessageSquare,
    Send,
    Eye
} from 'lucide-react';
import api from '../services/api';

interface Ticket {
    id: number;
    subject: string;
    message: string;
    category: string;
    status: string;
    priority: string;
    created_at: string;
    user_id: number;
    user_email: string;
    user_name: string;
}

interface FAQ {
    id: number;
    question: string;
    answer: string;
    category?: string;
    display_order: number;
    is_active: boolean;
}

interface TicketReply {
    id: number;
    message: string;
    created_at: string;
    admin_id?: number;
    user_id?: number;
    admin_name?: string;
    admin_email?: string;
    user_name?: string;
    user_email?: string;
}

interface FaqFormData {
    question: string;
    answer: string;
    category: string;
    display_order: number;
    is_active: boolean;
}

const initialFaqForm: FaqFormData = {
    question: '',
    answer: '',
    category: '',
    display_order: 0,
    is_active: true
};

export const AdminTicketManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState('tickets');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);

    // FAQ category filter
    const [faqCategories, setFaqCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('__all__');

    // FAQ Dialog state
    const [faqDialogOpen, setFaqDialogOpen] = useState(false);
    const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
    const [faqForm, setFaqForm] = useState<FaqFormData>(initialFaqForm);
    const [savingFaq, setSavingFaq] = useState(false);

    // Ticket detail dialog state
    const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [ticketReplies, setTicketReplies] = useState<TicketReply[]>([]);
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [loadingReplies, setLoadingReplies] = useState(false);

    useEffect(() => {
        loadData();
        if (activeTab === 'faqs') {
            loadFaqCategories();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'faqs') {
            loadData();
        }
    }, [selectedCategory]);

    const loadFaqCategories = async () => {
        try {
            const response = await api.support.getFaqCategories();
            setFaqCategories(response.items || []);
        } catch (error) {
            console.error('Failed to load FAQ categories:', error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'tickets') {
                const response = await api.support.getAdminTickets();
                setTickets(response.items || []);
            } else {
                const categoryFilter = selectedCategory === '__all__' ? undefined : selectedCategory;
                const response = await api.support.getAdminFaqs(categoryFilter);
                setFaqs(response.items || []);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTicketStatus = async (id: number, status: string) => {
        try {
            await api.support.updateTicket(id, { status });
            loadData();
        } catch (error) {
            console.error('Failed to update ticket:', error);
        }
    };

    const handleDeleteTicket = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa ticket này?')) return;
        try {
            await api.support.deleteTicket(id);
            loadData();
        } catch (error) {
            console.error('Failed to delete ticket:', error);
        }
    };

    // Open ticket detail dialog
    const openTicketDialog = async (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setTicketDialogOpen(true);
        setReplyMessage('');
        await loadTicketReplies(ticket.id);
    };

    // Load ticket replies
    const loadTicketReplies = async (ticketId: number) => {
        setLoadingReplies(true);
        try {
            const response = await api.support.getTicketReplies(ticketId);
            setTicketReplies(response.items || []);
        } catch (error) {
            console.error('Failed to load replies:', error);
            setTicketReplies([]);
        } finally {
            setLoadingReplies(false);
        }
    };

    // Send reply
    const handleSendReply = async () => {
        if (!selectedTicket || !replyMessage.trim()) return;

        setSendingReply(true);
        try {
            await api.support.replyTicket(selectedTicket.id, replyMessage.trim());
            setReplyMessage('');
            await loadTicketReplies(selectedTicket.id);
            loadData(); // Refresh ticket list to update status
        } catch (error) {
            console.error('Failed to send reply:', error);
            alert('Có lỗi xảy ra khi gửi phản hồi');
        } finally {
            setSendingReply(false);
        }
    };

    const handleDeleteFaq = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa FAQ này?')) return;
        try {
            await api.support.deleteFaq(id);
            loadData();
        } catch (error) {
            console.error('Failed to delete FAQ:', error);
        }
    };

    // FAQ CRUD handlers
    const openFaqDialog = (faq?: FAQ) => {
        if (faq) {
            setEditingFaq(faq);
            setFaqForm({
                question: faq.question,
                answer: faq.answer,
                category: faq.category || '',
                display_order: faq.display_order,
                is_active: faq.is_active
            });
        } else {
            setEditingFaq(null);
            setFaqForm(initialFaqForm);
        }
        setFaqDialogOpen(true);
    };

    const closeFaqDialog = () => {
        setFaqDialogOpen(false);
        setEditingFaq(null);
        setFaqForm(initialFaqForm);
    };

    const handleSaveFaq = async () => {
        if (!faqForm.question.trim() || !faqForm.answer.trim()) {
            alert('Vui lòng nhập câu hỏi và câu trả lời');
            return;
        }

        setSavingFaq(true);
        try {
            if (editingFaq) {
                // Update existing FAQ
                await api.support.updateFaq(editingFaq.id, {
                    question: faqForm.question,
                    answer: faqForm.answer,
                    category: faqForm.category || undefined,
                    display_order: faqForm.display_order,
                    is_active: faqForm.is_active
                });
            } else {
                // Create new FAQ
                await api.support.createFaq({
                    question: faqForm.question,
                    answer: faqForm.answer,
                    category: faqForm.category || undefined,
                    display_order: faqForm.display_order
                });
            }
            closeFaqDialog();
            loadData();
            loadFaqCategories(); // Reload categories in case a new one was added
        } catch (error) {
            console.error('Failed to save FAQ:', error);
            alert('Có lỗi xảy ra khi lưu FAQ');
        } finally {
            setSavingFaq(false);
        }
    };

    const handleToggleFaqActive = async (faq: FAQ) => {
        try {
            await api.support.updateFaq(faq.id, { is_active: !faq.is_active });
            loadData();
        } catch (error) {
            console.error('Failed to toggle FAQ active:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="warning"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Pending</Badge>;
            case 'in_progress':
                return <Badge variant="info"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>In Progress</Badge>;
            case 'resolved':
                return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Resolved</Badge>;
            case 'closed':
                return <Badge variant="secondary"><span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5"></span>Closed</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'critical':
                return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Critical</Badge>;
            case 'high':
                return <Badge variant="warning">High</Badge>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Support Management Admin</h1>
                    <p className="text-muted-foreground text-sm">
                        Quản lý ticket hỗ trợ và câu hỏi thường gặp.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'faqs' && faqCategories.length > 0 && (
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Lọc theo danh mục" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Tất cả danh mục</SelectItem>
                                {faqCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button variant="outline" onClick={loadData}>
                        <History className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    {activeTab === 'faqs' && (
                        <Button onClick={() => openFaqDialog()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Thêm FAQ
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Card with Tabs */}
            <Card>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="px-6 border-b">
                        <TabsList className="h-auto p-0 bg-transparent">
                            <TabsTrigger
                                value="tickets"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-4"
                            >
                                Manage Tickets
                            </TabsTrigger>
                            <TabsTrigger
                                value="faqs"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-4"
                            >
                                Manage FAQs
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tickets Tab */}
                    <TabsContent value="tickets" className="m-0">
                        {loading ? (
                            <div className="p-12 text-center text-muted-foreground">Đang tải...</div>
                        ) : tickets.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">Không có ticket nào.</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-semibold">Ticket ID</TableHead>
                                        <TableHead className="font-semibold">Subject</TableHead>
                                        <TableHead className="font-semibold">User</TableHead>
                                        <TableHead className="font-semibold">Status</TableHead>
                                        <TableHead className="font-semibold text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tickets.map((ticket) => (
                                        <TableRow key={ticket.id} className="group">
                                            <TableCell>
                                                <code className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded">
                                                    #TK-{ticket.id}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold">{ticket.subject}</p>
                                                        {getPriorityBadge(ticket.priority)}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                                                        {ticket.message}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                                        {ticket.user_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-medium block">{ticket.user_name || 'Unknown'}</span>
                                                        <span className="text-xs text-muted-foreground">{ticket.user_email}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(ticket.status)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-600"
                                                        title="Xem chi tiết & Trả lời"
                                                        onClick={() => openTicketDialog(ticket)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    {ticket.status === 'pending' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-emerald-600"
                                                            title="Đánh dấu đã giải quyết"
                                                            onClick={() => handleUpdateTicketStatus(ticket.id, 'resolved')}
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    {ticket.status !== 'closed' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            title="Đóng ticket"
                                                            onClick={() => handleUpdateTicketStatus(ticket.id, 'closed')}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <div className="w-px h-4 bg-border mx-1"></div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        title="Xóa"
                                                        onClick={() => handleDeleteTicket(ticket.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}

                        {/* Pagination */}
                        {tickets.length > 0 && (
                            <div className="px-6 py-4 flex items-center justify-between bg-muted/30 border-t">
                                <p className="text-xs text-muted-foreground">
                                    Showing <span className="font-semibold text-foreground">{tickets.length}</span> tickets
                                </p>
                            </div>
                        )}
                    </TabsContent>

                    {/* FAQs Tab */}
                    <TabsContent value="faqs" className="m-0">
                        {loading ? (
                            <div className="p-12 text-center text-muted-foreground">Đang tải...</div>
                        ) : faqs.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-muted-foreground mb-4">Chưa có FAQ nào.</div>
                                <Button onClick={() => openFaqDialog()}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Thêm FAQ đầu tiên
                                </Button>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-semibold w-20">Thứ tự</TableHead>
                                        <TableHead className="font-semibold">Câu hỏi</TableHead>
                                        <TableHead className="font-semibold">Danh mục</TableHead>
                                        <TableHead className="font-semibold">Trạng thái</TableHead>
                                        <TableHead className="font-semibold text-right">Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {faqs.map((faq) => (
                                        <TableRow key={faq.id} className={!faq.is_active ? 'opacity-50' : ''}>
                                            <TableCell>
                                                <code className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded">
                                                    #{faq.display_order}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <p className="font-medium text-sm">{faq.question}</p>
                                                    <p className="text-xs text-muted-foreground truncate max-w-md mt-1">
                                                        {faq.answer}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {faq.category ? (
                                                    <Badge variant="outline" className="text-xs">{faq.category}</Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={faq.is_active}
                                                        onCheckedChange={() => handleToggleFaqActive(faq)}
                                                    />
                                                    <span className="text-xs text-muted-foreground">
                                                        {faq.is_active ? 'Hiển thị' : 'Ẩn'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        title="Sửa"
                                                        onClick={() => openFaqDialog(faq)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        title="Xóa"
                                                        onClick={() => handleDeleteFaq(faq.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}

                        {/* Pagination for FAQs */}
                        {faqs.length > 0 && (
                            <div className="px-6 py-4 flex items-center justify-between bg-muted/30 border-t">
                                <p className="text-xs text-muted-foreground">
                                    Tổng: <span className="font-semibold text-foreground">{faqs.length}</span> FAQ
                                </p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </Card>

            {/* FAQ Create/Edit Dialog */}
            <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">
                            {editingFaq ? 'Sửa FAQ' : 'Thêm FAQ mới'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingFaq
                                ? 'Cập nhật thông tin câu hỏi thường gặp.'
                                : 'Thêm câu hỏi thường gặp mới cho người dùng.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="question">Câu hỏi <span className="text-destructive">*</span></Label>
                            <Input
                                id="question"
                                placeholder="Ví dụ: Làm thế nào để gia hạn license?"
                                value={faqForm.question}
                                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="answer">Câu trả lời <span className="text-destructive">*</span></Label>
                            <Textarea
                                id="answer"
                                placeholder="Nhập câu trả lời chi tiết..."
                                className="min-h-[120px]"
                                value={faqForm.answer}
                                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="category">Danh mục</Label>
                                <Input
                                    id="category"
                                    placeholder="Ví dụ: licenses, account, general"
                                    value={faqForm.category}
                                    onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="order">Thứ tự hiển thị</Label>
                                <Input
                                    id="order"
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={faqForm.display_order}
                                    onChange={(e) => setFaqForm({ ...faqForm, display_order: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        {editingFaq && (
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="is_active">Hiển thị FAQ</Label>
                                    <p className="text-xs text-muted-foreground">
                                        FAQ sẽ được hiển thị cho người dùng khi bật
                                    </p>
                                </div>
                                <Switch
                                    id="is_active"
                                    checked={faqForm.is_active}
                                    onCheckedChange={(checked) => setFaqForm({ ...faqForm, is_active: checked })}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeFaqDialog}>
                            Hủy
                        </Button>
                        <Button onClick={handleSaveFaq} disabled={savingFaq}>
                            {savingFaq ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    Đang lưu...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    {editingFaq ? 'Cập nhật' : 'Thêm FAQ'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Ticket Detail Dialog */}
            <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            Ticket #{selectedTicket?.id} - {selectedTicket?.subject}
                        </DialogTitle>
                        <DialogDescription>
                            Từ: {selectedTicket?.user_name || selectedTicket?.user_email}
                            {selectedTicket && (
                                <span className="ml-2">
                                    {getStatusBadge(selectedTicket.status)}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 py-4">
                        {/* Original message */}
                        <div className="rounded-lg border p-4 bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Tin nhắn gốc</span>
                                <span className="text-xs text-muted-foreground">
                                    {selectedTicket?.created_at && new Date(selectedTicket.created_at).toLocaleString('vi-VN')}
                                </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{selectedTicket?.message}</p>
                        </div>

                        {/* Replies */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-muted-foreground">
                                Lịch sử phản hồi ({ticketReplies.length})
                            </h4>

                            {loadingReplies ? (
                                <div className="text-center text-muted-foreground py-4">Đang tải...</div>
                            ) : ticketReplies.length === 0 ? (
                                <div className="text-center text-muted-foreground py-4 text-sm">
                                    Chưa có phản hồi nào
                                </div>
                            ) : (
                                ticketReplies.map((reply) => (
                                    <div
                                        key={reply.id}
                                        className={`rounded-lg border p-3 ${reply.admin_id
                                            ? 'bg-blue-50/50 border-blue-200'
                                            : 'bg-amber-50/50 border-amber-200'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-xs font-medium ${reply.admin_id ? 'text-blue-700' : 'text-amber-700'}`}>
                                                {reply.admin_id
                                                    ? `🛡️ Admin: ${reply.admin_name || reply.admin_email}`
                                                    : `👤 User: ${reply.user_name || reply.user_email}`
                                                }
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(reply.created_at).toLocaleString('vi-VN')}
                                            </span>
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Reply form */}
                    {selectedTicket?.status !== 'closed' && (
                        <div className="border-t pt-4">
                            <div className="flex gap-2">
                                <Textarea
                                    placeholder="Nhập phản hồi..."
                                    className="flex-1 min-h-[80px]"
                                    value={replyMessage}
                                    onChange={(e) => setReplyMessage(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>
                                    Đóng
                                </Button>
                                <Button
                                    onClick={handleSendReply}
                                    disabled={sendingReply || !replyMessage.trim()}
                                >
                                    {sendingReply ? (
                                        <>
                                            <span className="animate-spin mr-2">⏳</span>
                                            Đang gửi...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Gửi phản hồi
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {selectedTicket?.status === 'closed' && (
                        <DialogFooter>
                            <p className="text-sm text-muted-foreground mr-auto">Ticket đã đóng, không thể phản hồi.</p>
                            <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>
                                Đóng
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
