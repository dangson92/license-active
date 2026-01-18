import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    AlertTriangle
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

export const AdminTicketManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState('tickets');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'tickets') {
                const response = await api.support.getAdminTickets();
                setTickets(response.items || []);
            } else {
                const response = await api.support.getAdminFaqs();
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

    const handleDeleteFaq = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa FAQ này?')) return;
        try {
            await api.support.deleteFaq(id);
            loadData();
        } catch (error) {
            console.error('Failed to delete FAQ:', error);
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
                    <Button variant="outline" onClick={loadData}>
                        <History className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        {activeTab === 'tickets' ? 'New Ticket' : 'New FAQ'}
                    </Button>
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
                            <div className="p-12 text-center text-muted-foreground">Không có FAQ nào.</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-semibold">ID</TableHead>
                                        <TableHead className="font-semibold">Question</TableHead>
                                        <TableHead className="font-semibold">Answer Preview</TableHead>
                                        <TableHead className="font-semibold text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {faqs.map((faq) => (
                                        <TableRow key={faq.id}>
                                            <TableCell>
                                                <code className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded">
                                                    #{faq.id}
                                                </code>
                                            </TableCell>
                                            <TableCell className="font-medium">{faq.question}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm truncate max-w-xs">
                                                {faq.answer}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="outline" size="sm">Edit</Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
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
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
};
