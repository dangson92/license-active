import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import api from '../services/api';

interface FAQ {
    id: number;
    question: string;
    answer: string;
    category?: string;
}

export const UserSupport: React.FC = () => {
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        subject: '',
        category: 'technical',
        message: ''
    });

    useEffect(() => {
        loadFaqs();
    }, []);

    const loadFaqs = async () => {
        try {
            const response = await api.support.getFaqs();
            setFaqs(response.items || []);
            if (response.items?.length > 0) {
                setExpandedFaq(response.items[0].id);
            }
        } catch (error) {
            console.error('Failed to load FAQs:', error);
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
        } catch (error) {
            console.error('Failed to submit ticket:', error);
            alert('Có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleFaq = (id: number) => {
        setExpandedFaq(expandedFaq === id ? null : id);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">User Support & FAQs</h1>
                <p className="text-muted-foreground text-sm">
                    Cần hỗ trợ? Gửi ticket hoặc xem các câu hỏi thường gặp.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Submit Ticket Form */}
                <div className="lg:col-span-5">
                    <Card>
                        <CardHeader className="bg-muted/30 border-b">
                            <CardTitle className="text-base">Submit a Ticket</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Đội ngũ hỗ trợ thường phản hồi trong vòng 24 giờ.
                            </p>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input
                                        id="subject"
                                        placeholder="Nhập tóm tắt vấn đề"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn loại vấn đề" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="technical">Technical Issue</SelectItem>
                                            <SelectItem value="billing">Billing & Subscription</SelectItem>
                                            <SelectItem value="account">Account Access</SelectItem>
                                            <SelectItem value="feature">Feature Request</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="message">Message</Label>
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
                                        {submitting ? 'Đang gửi...' : 'Send Ticket'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* FAQs */}
                <div className="lg:col-span-7">
                    <Card>
                        <CardHeader className="bg-muted/30 border-b flex-row items-center justify-between">
                            <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 uppercase tracking-wide">
                                Help Center
                            </span>
                        </CardHeader>
                        <CardContent className="p-0 divide-y">
                            {loading ? (
                                <div className="p-12 text-center text-muted-foreground">Đang tải...</div>
                            ) : faqs.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">Chưa có FAQ nào.</div>
                            ) : (
                                faqs.map((faq) => (
                                    <div key={faq.id} className="group">
                                        <button
                                            onClick={() => toggleFaq(faq.id)}
                                            className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-muted/30 transition-colors"
                                        >
                                            <span className="text-sm font-medium">{faq.question}</span>
                                            {expandedFaq === faq.id ? (
                                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            )}
                                        </button>
                                        {expandedFaq === faq.id && (
                                            <div className="px-6 pb-4">
                                                <p className="text-sm text-muted-foreground leading-relaxed">
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
        </div>
    );
};
