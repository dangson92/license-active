import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Search,
    Plus,
    Download,
    Ban,
    History,
    Monitor,
    Trash2,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

// Mock data for tickets
const mockTickets = [
    {
        id: 'TK-1284',
        subject: 'Unable to login to Dashboard',
        description: 'System returns 500 error when clicking the login button.',
        user: 'Sarah Johnson',
        status: 'pending',
    },
    {
        id: 'TK-9921',
        subject: 'Billing inquiry for license renewal',
        description: 'User wants to know if there\'s a discount for annual plans.',
        user: 'Marcus Aurel',
        status: 'resolved',
    },
    {
        id: 'TK-0032',
        subject: 'Integration with Slack failing',
        description: 'Webhooks are not triggering after latest update.',
        user: 'Emily Chen',
        status: 'critical',
    },
];

// Mock data for FAQs
const mockFaqs = [
    { id: 1, question: 'How do I renew my license key?', answer: 'You can renew your license by going to the Licenses section...' },
    { id: 2, question: 'What does "Unbind Device" mean?', answer: 'Each license is bound to a specific hardware ID...' },
    { id: 3, question: 'Can I transfer my license to another user?', answer: 'Currently, licenses are tied to the account that purchased them...' },
];

export const AdminTicketManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState('tickets');
    const [searchQuery, setSearchQuery] = useState('');

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="warning"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Pending</Badge>;
            case 'resolved':
                return <Badge variant="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Resolved</Badge>;
            case 'critical':
                return <Badge variant="destructive"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>Critical</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
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
                    <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        New Support Item
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
                                {mockTickets.map((ticket) => (
                                    <TableRow key={ticket.id} className="group">
                                        <TableCell>
                                            <code className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded">
                                                #{ticket.id}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <p className="text-sm font-semibold">{ticket.subject}</p>
                                                <p className="text-xs text-muted-foreground truncate max-w-xs">
                                                    {ticket.description}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                                    {ticket.user.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <span className="text-sm font-medium">{ticket.user}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(ticket.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Vô hiệu">
                                                    <Ban className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Gia hạn">
                                                    <History className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Gỡ máy">
                                                    <Monitor className="w-4 h-4" />
                                                </Button>
                                                <div className="w-px h-4 bg-border mx-1"></div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Xóa">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Pagination */}
                        <div className="px-6 py-4 flex items-center justify-between bg-muted/30 border-t">
                            <p className="text-xs text-muted-foreground">
                                Showing <span className="font-semibold text-foreground">1-3</span> of <span className="font-semibold text-foreground">24</span> tickets
                            </p>
                            <div className="flex gap-1">
                                <Button variant="outline" size="icon" className="h-8 w-8">
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button size="icon" className="h-8 w-8">1</Button>
                                <Button variant="outline" size="icon" className="h-8 w-8">2</Button>
                                <Button variant="outline" size="icon" className="h-8 w-8">
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    {/* FAQs Tab */}
                    <TabsContent value="faqs" className="m-0">
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
                                {mockFaqs.map((faq) => (
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
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
};
