import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MessageSquare, Send, Loader2, Clock, User, Shield } from 'lucide-react';
import api from '../services/api';

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

export const TicketDetail: React.FC = () => {
    const { ticketId } = useParams<{ ticketId: string }>();
    const navigate = useNavigate();

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [replies, setReplies] = useState<TicketReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingReplies, setLoadingReplies] = useState(false);
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    useEffect(() => {
        if (ticketId) {
            loadTicketData();
        }
    }, [ticketId]);

    const loadTicketData = async () => {
        setLoading(true);
        try {
            // Load ticket info
            const ticketsResponse = await api.support.getMyTickets();
            const foundTicket = ticketsResponse.items?.find((t: Ticket) => t.id === parseInt(ticketId || '0'));
            setTicket(foundTicket || null);

            // Load replies
            if (foundTicket) {
                await loadTicketReplies(foundTicket.id);
            }
        } catch (error) {
            console.error('Failed to load ticket:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTicketReplies = async (id: number) => {
        setLoadingReplies(true);
        try {
            const response = await api.support.getTicketReplies(id);
            setReplies(response.items || []);
        } catch (error) {
            console.error('Failed to load replies:', error);
            setReplies([]);
        } finally {
            setLoadingReplies(false);
        }
    };

    const handleSendReply = async () => {
        if (!ticket || !replyMessage.trim()) return;

        setSendingReply(true);
        try {
            await api.support.userReplyTicket(ticket.id, replyMessage.trim());
            setReplyMessage('');
            await loadTicketReplies(ticket.id);
        } catch (error) {
            console.error('Failed to send reply:', error);
            alert('Có lỗi xảy ra khi gửi phản hồi');
        } finally {
            setSendingReply(false);
        }
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

    const getCategoryLabel = (category: string) => {
        const categories: Record<string, string> = {
            'technical': 'Vấn đề kỹ thuật',
            'billing': 'Thanh toán & Đăng ký',
            'account': 'Tài khoản',
            'feature': 'Yêu cầu tính năng',
            'other': 'Khác'
        };
        return categories[category] || category;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => navigate('/user/support')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>
                <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Không tìm thấy ticket này.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/user/support')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>
            </div>

            {/* Ticket Info Card */}
            <Card className="border-2">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <code className="text-sm font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                                    #TK-{ticket.id}
                                </code>
                                {getStatusBadge(ticket.status)}
                            </div>
                            <CardTitle className="text-xl">{ticket.subject}</CardTitle>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>{new Date(ticket.created_at).toLocaleDateString('vi-VN')}</span>
                            </div>
                            <Badge variant="outline" className="font-normal">
                                {getCategoryLabel(ticket.category)}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>

                {ticket.message && (
                    <CardContent className="pt-4 pb-4 bg-muted/20">
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Nội dung ban đầu:</p>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Conversation */}
            <Card>
                <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        Cuộc trò chuyện
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Replies List */}
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                        {loadingReplies ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                Đang tải...
                            </div>
                        ) : replies.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                    <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    Chưa có phản hồi nào. Vui lòng chờ phản hồi từ đội ngũ hỗ trợ.
                                </p>
                            </div>
                        ) : (
                            replies.map((reply) => (
                                <div
                                    key={reply.id}
                                    className={`p-4 ${reply.admin_id ? 'bg-blue-50/40' : 'bg-white'}`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${reply.admin_id
                                            ? 'bg-blue-100 text-blue-600'
                                            : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {reply.admin_id ? (
                                                <Shield className="w-4 h-4" />
                                            ) : (
                                                <User className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className={`text-sm font-medium ${reply.admin_id ? 'text-blue-700' : 'text-gray-700'
                                                    }`}>
                                                    {reply.admin_id
                                                        ? `Admin: ${reply.admin_name || reply.admin_email}`
                                                        : 'Bạn'
                                                    }
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(reply.created_at).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                {reply.message}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Reply Form */}
                    {ticket.status !== 'closed' && ticket.status !== 'resolved' ? (
                        <div className="p-4 border-t bg-muted/10">
                            <Textarea
                                placeholder="Nhập phản hồi của bạn..."
                                className="min-h-[100px] mb-3 bg-white"
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSendReply}
                                    disabled={sendingReply || !replyMessage.trim()}
                                    className="min-w-[140px]"
                                >
                                    {sendingReply ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Đang gửi...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Gửi Phản Hồi
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 border-t bg-muted/10 text-center">
                            <p className="text-sm text-muted-foreground">
                                {ticket.status === 'resolved'
                                    ? 'Ticket này đã được giải quyết. Nếu bạn vẫn cần hỗ trợ, vui lòng tạo ticket mới.'
                                    : 'Ticket này đã được đóng và không thể phản hồi thêm.'
                                }
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
