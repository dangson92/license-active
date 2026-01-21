import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, ChevronDown, ChevronUp, Loader2, MessageSquare, History, Eye, HelpCircle } from 'lucide-react';
import api from '../services/api';

interface FAQ {
    id: number;
    question: string;
    answer: string;
    category?: string;
}

interface Ticket {
    id: number;
    subject: string;
    category: string;
    message?: string;
    status: string;
    priority: string;
    created_at: string;
    resolved_at?: string;
}

export const UserSupport: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('new-ticket');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingFaqs, setLoadingFaqs] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        subject: '',
        category: 'technical',
        message: ''
    });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    // Load FAQs when component mounts (for new-ticket tab)
    useEffect(() => {
        loadFaqs();
    }, []);

    const loadFaqs = async () => {
        setLoadingFaqs(true);
        try {
            const response = await api.support.getFaqs();
            setFaqs(response.items || []);
            if (response.items?.length > 0 && expandedFaq === null) {
                setExpandedFaq(response.items[0].id);
            }
        } catch (error) {
            console.error('Failed to load FAQs:', error);
        } finally {
            setLoadingFaqs(false);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'my-tickets') {
                const response = await api.support.getMyTickets();
                setTickets(response.items || []);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.support.createTicket(formData);
            alert('Ticket đã được gửi thành công! Chúng tôi sẽ phản hồi trong vòng 24 giờ.');
            setFormData({ subject: '', category: 'technical', message: '' });
            setActiveTab('my-tickets');
        } catch (error) {
            console.error('Failed to submit ticket:', error);
            alert('Có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const openTicketDetail = (ticket: Ticket) => {
        navigate(`/user/support/ticket/${ticket.id}`);
    };

    const toggleFaq = (id: number) => {
        setExpandedFaq(expandedFaq === id ? null : id);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="warning"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Đang chờ</Badge>;
            case 'in_progress':
                return <Badge variant="info"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>Đang xử lý</Badge>;
            case 'resolved':
                return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Đã giải quyết</Badge>;
            case 'closed':
                return <Badge variant="secondary"><span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5"></span>Đã đóng</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Support & FAQs</h1>
                <p className="text-muted-foreground text-sm">
                    Cần hỗ trợ? Gửi ticket hoặc xem các câu hỏi thường gặp.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="new-ticket">
                        <Send className="w-4 h-4 mr-2" />
                        Gửi Ticket
                    </TabsTrigger>
                    <TabsTrigger value="my-tickets">
                        <History className="w-4 h-4 mr-2" />
                        Ticket của tôi
                    </TabsTrigger>
                </TabsList>

                {/* New Ticket Tab - with FAQs sidebar */}
                <TabsContent value="new-ticket" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Form Column - 3 cols */}
                        <div className="lg:col-span-3 space-y-4">
                            <Card>
                                <CardHeader className="bg-muted/30 border-b">
                                    <CardTitle className="text-base">Gửi Ticket Hỗ Trợ</CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Đội ngũ hỗ trợ thường phản hồi trong vòng 24 giờ.
                                    </p>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="subject">Tiêu đề</Label>
                                            <Input
                                                id="subject"
                                                placeholder="Nhập tóm tắt vấn đề"
                                                value={formData.subject}
                                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="category">Danh mục</Label>
                                            <Select
                                                value={formData.category}
                                                onValueChange={(value) => setFormData({ ...formData, category: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn loại vấn đề" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="technical">Vấn đề kỹ thuật</SelectItem>
                                                    <SelectItem value="billing">Thanh toán & Đăng ký</SelectItem>
                                                    <SelectItem value="account">Tài khoản</SelectItem>
                                                    <SelectItem value="feature">Yêu cầu tính năng</SelectItem>
                                                    <SelectItem value="other">Khác</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="message">Nội dung</Label>
                                            <Textarea
                                                id="message"
                                                placeholder="Mô tả chi tiết vấn đề của bạn..."
                                                value={formData.message}
                                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                                rows={6}
                                                className="resize-none"
                                                required
                                            />
                                        </div>

                                        <div className="pt-2">
                                            <Button type="submit" className="w-full" disabled={submitting}>
                                                {submitting ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4 mr-2" />
                                                )}
                                                {submitting ? 'Đang gửi...' : 'Gửi Ticket'}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>

                            {/* Tips Card */}
                            <Card className="bg-blue-50/50 border-blue-200">
                                <CardContent className="pt-6">
                                    <h3 className="font-semibold text-blue-800 mb-2">💡 Mẹo gửi ticket hiệu quả</h3>
                                    <ul className="text-sm text-blue-700 space-y-1">
                                        <li>• Mô tả chi tiết vấn đề bạn gặp phải</li>
                                        <li>• Đính kèm screenshot nếu có thể</li>
                                        <li>• Cung cấp thông tin license/app liên quan</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        {/* FAQs Column - 2 cols */}
                        <div className="lg:col-span-2">
                            <Card className="sticky top-4">
                                <CardHeader className="bg-muted/30 border-b">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <HelpCircle className="w-4 h-4 text-primary" />
                                            Câu hỏi thường gặp
                                        </CardTitle>
                                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-wide">
                                            FAQs
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 divide-y max-h-[500px] overflow-y-auto">
                                    {loadingFaqs ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                            Đang tải...
                                        </div>
                                    ) : faqs.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground text-sm">
                                            Chưa có FAQ nào.
                                        </div>
                                    ) : (
                                        faqs.map((faq) => (
                                            <div key={faq.id} className="group">
                                                <button
                                                    onClick={() => toggleFaq(faq.id)}
                                                    className="flex items-start justify-between w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors gap-2"
                                                >
                                                    <span className="text-sm font-medium leading-snug">{faq.question}</span>
                                                    {expandedFaq === faq.id ? (
                                                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                                    )}
                                                </button>
                                                {expandedFaq === faq.id && (
                                                    <div className="px-4 pb-3">
                                                        <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 rounded-md p-3">
                                                            {faq.answer}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* My Tickets Tab */}
                <TabsContent value="my-tickets" className="mt-6">
                    <Card>
                        <CardHeader className="bg-muted/30 border-b flex-row items-center justify-between">
                            <CardTitle className="text-base">Ticket của tôi</CardTitle>
                            <Button variant="outline" size="sm" onClick={loadData}>
                                <History className="w-4 h-4 mr-2" />
                                Làm mới
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Đang tải...
                                </div>
                            ) : tickets.length === 0 ? (
                                <div className="p-12 text-center">
                                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                                    <p className="text-muted-foreground mb-4">Bạn chưa có ticket nào.</p>
                                    <Button onClick={() => setActiveTab('new-ticket')}>
                                        <Send className="w-4 h-4 mr-2" />
                                        Gửi Ticket Đầu Tiên
                                    </Button>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {tickets.map((ticket) => (
                                        <div
                                            key={ticket.id}
                                            className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                            onClick={() => openTicketDetail(ticket)}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                                            #TK-{ticket.id}
                                                        </code>
                                                        {getStatusBadge(ticket.status)}
                                                    </div>
                                                    <p className="font-medium text-sm truncate">{ticket.subject}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {new Date(ticket.created_at).toLocaleDateString('vi-VN')} • {ticket.category}
                                                    </p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="shrink-0">
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};
