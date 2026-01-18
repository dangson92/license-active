import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

// FAQ data
const faqs = [
    {
        id: 1,
        question: 'How do I renew my license key?',
        answer: 'You can renew your license by going to the "Licenses" section in your dashboard. Click the "Renew" icon next to the license you wish to extend. Follow the payment instructions to complete the process.'
    },
    {
        id: 2,
        question: 'What does "Unbind Device" mean?',
        answer: 'Each license is bound to a specific hardware ID to prevent unauthorized use. If you upgrade your computer or want to use the software on a different machine, you must first "Unbind" the current device to release the slot for a new one.'
    },
    {
        id: 3,
        question: 'Can I transfer my license to another user?',
        answer: 'Currently, licenses are tied to the account that purchased them. However, for enterprise customers, license seats can be re-assigned by the organization administrator through the "Members" management tab.'
    },
    {
        id: 4,
        question: 'What happens if my license expires?',
        answer: 'When a license expires, the application will enter a restricted mode. You will still be able to access your data, but advanced features and automated workflows will be disabled until a valid license is applied.'
    },
    {
        id: 5,
        question: 'Do you offer discounts for educational institutions?',
        answer: 'Yes, we offer a 50% discount for verified educational institutions and non-profit organizations. Please submit a support ticket with your official documentation to apply for the discount.'
    }
];

export const UserSupport: React.FC = () => {
    const [expandedFaq, setExpandedFaq] = useState<number | null>(2);
    const [formData, setFormData] = useState({
        subject: '',
        category: 'technical',
        message: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitting ticket:', formData);
        // TODO: API call to submit ticket
        alert('Ticket đã được gửi thành công!');
        setFormData({ subject: '', category: 'technical', message: '' });
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
                                    <Button type="submit" className="w-full">
                                        <Send className="w-4 h-4 mr-2" />
                                        Send Ticket
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
                            {faqs.map((faq) => (
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
                            ))}
                        </CardContent>
                        <div className="px-6 py-4 bg-muted/30 border-t flex items-center justify-center">
                            <Button variant="ghost" className="text-sm font-medium text-muted-foreground hover:text-primary">
                                View All Help Articles
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
