import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Icons
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

type VerifyStatus = 'loading' | 'success' | 'error' | 'expired';

export const VerifyEmail: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<VerifyStatus>('loading');
    const [message, setMessage] = useState('');

    const token = searchParams.get('token');

    useEffect(() => {
        if (token) {
            verifyEmail(token);
        } else {
            setStatus('error');
            setMessage('Link xác thực không hợp lệ.');
        }
    }, [token]);

    const verifyEmail = async (token: string) => {
        try {
            const response = await api.auth.verifyEmail(token);
            setStatus('success');
            setMessage(response.message || 'Email đã được xác thực thành công!');
        } catch (error: any) {
            if (error.message?.includes('expired') || error.error === 'token_expired') {
                setStatus('expired');
                setMessage('Link xác thực đã hết hạn. Vui lòng yêu cầu gửi lại email xác thực.');
            } else {
                setStatus('error');
                setMessage(error.message || 'Không thể xác thực email. Link có thể không hợp lệ.');
            }
        }
    };

    const goToLogin = () => {
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        {status === 'loading' && (
                            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-emerald-600" />
                            </div>
                        )}
                        {(status === 'error' || status === 'expired') && (
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="h-8 w-8 text-red-600" />
                            </div>
                        )}
                    </div>
                    <CardTitle className="text-xl">
                        {status === 'loading' && 'Đang xác thực...'}
                        {status === 'success' && 'Xác thực thành công!'}
                        {status === 'error' && 'Xác thực thất bại'}
                        {status === 'expired' && 'Link đã hết hạn'}
                    </CardTitle>
                    <CardDescription className="mt-2">
                        {message}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status === 'success' && (
                        <Button onClick={goToLogin} className="w-full">
                            <Mail className="h-4 w-4 mr-2" />
                            Đăng nhập ngay
                        </Button>
                    )}
                    {(status === 'error' || status === 'expired') && (
                        <div className="space-y-3">
                            <Button onClick={goToLogin} variant="outline" className="w-full">
                                Quay lại đăng nhập
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                                Nếu bạn cần hỗ trợ, vui lòng liên hệ quản trị viên.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default VerifyEmail;
