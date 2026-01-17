import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Mail, Lock, User } from 'lucide-react';
import api from '../services/api';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (!isLogin) {
      if (!fullName) {
        setError('Vui lòng nhập họ tên');
        return;
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await api.auth.login(email, password);
      } else {
        await api.auth.register(email, password, fullName);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error('Auth error:', err);

      if (err.message === 'invalid_credentials') {
        setError('Email hoặc mật khẩu không đúng');
      } else if (err.message === 'email_exists') {
        setError('Email đã được đăng ký');
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b border-border bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-blue-600 rounded-md flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Quản lý SD Automation</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Product
          </a>
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </a>
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            About
          </a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 min-h-[calc(100vh-73px)]">
        <Card className="w-full max-w-[480px] shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {isLogin ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
            </CardTitle>
            <CardDescription className="text-base">
              {isLogin
                ? 'Chào mừng trở lại! Vui lòng nhập thông tin để truy cập.'
                : 'Bắt đầu quản lý phần mềm của bạn một cách hiệu quả.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name - only for register */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Họ và tên</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="pl-11"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="pl-11"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Confirm Password - only for register */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-11"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Remember me & Forgot password - only for login */}
              {isLogin && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                      Ghi nhớ đăng nhập
                    </Label>
                  </div>
                  <a href="#" className="text-sm font-semibold text-primary hover:underline">
                    Quên mật khẩu?
                  </a>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Tạo tài khoản')}
              </Button>
            </form>

            {/* Switch mode */}
            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-muted-foreground text-sm">
                {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-primary font-bold hover:underline ml-1 cursor-pointer"
                >
                  {isLogin ? 'Đăng ký' : 'Đăng nhập'}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
