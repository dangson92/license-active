import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { UserRole, User } from './types';

// Layout
import { AppLayout } from './components/layout/AppLayout';

// Admin Pages
import { MemberManagement } from './components/MemberManagement';
import { CreateLicense } from './components/CreateLicense';
import { ApplicationManagement } from './components/ApplicationManagement';
import { Settings } from './components/Settings';

// Components that need to be extracted from AdminDashboard
// For now, we'll create wrapper components

interface AdminRouterProps {
    user: User;
    onLogout: () => void;
}

// License Management Content (extracted from AdminDashboard)
const LicenseManagementContent = React.lazy(() =>
    import('./components/AdminDashboard').then(module => ({
        default: () => {
            // This is a workaround - ideally we'd refactor AdminDashboard into smaller components
            const AdminDashboardWrapper = (props: any) => {
                const AdminDashboard = module.AdminDashboard;
                return <AdminDashboard {...props} />;
            };
            return null;
        }
    }))
);

export const AdminRouter: React.FC<AdminRouterProps> = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Get active section from URL
    const getActiveSection = () => {
        const path = location.pathname;
        if (path.includes('/admin/members')) return 'members';
        if (path.includes('/admin/applications')) return 'applications';
        if (path.includes('/admin/create-license')) return 'create-license';
        if (path.includes('/admin/settings')) return 'settings';
        if (path.includes('/admin/dashboard')) return 'dashboard';
        return 'licenses';
    };

    const handleNavClick = (itemId: string) => {
        switch (itemId) {
            case 'licenses':
                navigate('/admin/licenses');
                break;
            case 'members':
                navigate('/admin/members');
                break;
            case 'applications':
                navigate('/admin/applications');
                break;
            case 'dashboard':
                navigate('/admin/dashboard');
                break;
            case 'settings':
                navigate('/admin/settings');
                break;
            case 'create-license':
                navigate('/admin/create-license');
                break;
            default:
                navigate('/admin/licenses');
        }
    };

    return (
        <AppLayout
            variant="admin"
            userName={user.username}
            onLogout={onLogout}
            activeItem={getActiveSection()}
            searchPlaceholder="Tìm kiếm..."
            onNavClick={handleNavClick}
        >
            <Routes>
                <Route path="licenses" element={<LicensesPage user={user} onLogout={onLogout} onNavigate={handleNavClick} />} />
                <Route path="members" element={<MemberManagement />} />
                <Route path="applications" element={<ApplicationManagement />} />
                <Route path="create-license" element={
                    <CreateLicensePage onBack={() => navigate('/admin/licenses')} onSuccess={() => navigate('/admin/licenses')} />
                } />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/admin/licenses" replace />} />
            </Routes>
        </AppLayout>
    );
};

// Placeholder pages
const DashboardPage: React.FC = () => (
    <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Tổng quan hệ thống.</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-12 text-center text-muted-foreground">
            Dashboard content sẽ được thêm sau...
        </div>
    </div>
);

const SettingsPage: React.FC = () => <Settings />;

// Wrapper for CreateLicense to get apps and users
const CreateLicensePage: React.FC<{ onBack: () => void; onSuccess: () => void }> = ({ onBack, onSuccess }) => {
    const [apps, setApps] = React.useState<any[]>([]);
    const [users, setUsers] = React.useState<any[]>([]);

    React.useEffect(() => {
        const loadData = async () => {
            try {
                const { default: api } = await import('./services/api');
                const [appsRes, usersRes] = await Promise.all([
                    api.admin.getApps(),
                    api.admin.getUsers()
                ]);
                setApps(appsRes.items || []);
                setUsers(usersRes.items || []);
            } catch (error) {
                // Mock data
                setApps([{ id: 1, code: 'APP001', name: 'App 1' }]);
                setUsers([{ id: 1, email: 'user@test.com', full_name: 'Test User' }]);
            }
        };
        loadData();
    }, []);

    return <CreateLicense apps={apps} users={users} onBack={onBack} onSuccess={onSuccess} />;
};

// Import AdminDashboard content for Licenses page
import { AdminDashboard } from './components/AdminDashboard';

interface LicensesPageProps {
    user: User;
    onLogout: () => void;
    onNavigate: (itemId: string) => void;
}

// For licenses, we need to show the content without the AppLayout wrapper since AppLayout is already provided
const LicensesPage: React.FC<LicensesPageProps> = ({ user, onLogout, onNavigate }) => {
    // We need a standalone License content component
    // For now, render a placeholder that will be replaced
    return <LicenseContent user={user} onNavigate={onNavigate} />;
};

// Temporary License Content - will be a full component later
const LicenseContent: React.FC<{ user: User; onNavigate: (itemId: string) => void }> = ({ user, onNavigate }) => {
    const [keys, setKeys] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const loadData = async () => {
            try {
                const { default: api } = await import('./services/api');
                const response = await api.admin.getLicenses();
                setKeys(response.items || []);
            } catch (error) {
                setKeys([]);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Import UI components
    const Button = React.lazy(() => import('@/components/ui/button').then(m => ({ default: m.Button })));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">License Management</h1>
                    <p className="text-muted-foreground text-sm">Quản lý và theo dõi license trong hệ thống.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                        Export Data
                    </button>
                    <button
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
                        onClick={() => onNavigate('create-license')}
                    >
                        + Issue License
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {['Total Active', 'Expiring Soon', 'Revoked', 'Total Licenses'].map((title, i) => (
                    <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <span className="text-3xl font-bold">{keys.length > 0 ? Math.floor(keys.length / (i + 1)) : 0}</span>
                    </div>
                ))}
            </div>

            {/* License Table */}
            <div className="rounded-lg border bg-card shadow-sm">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold">Danh sách License Keys</h3>
                </div>
                <div className="p-6">
                    {keys.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Chưa có license key nào.
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 font-semibold">License Key</th>
                                    <th className="text-left py-3 px-4 font-semibold">Owner</th>
                                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                                    <th className="text-left py-3 px-4 font-semibold">Expires</th>
                                </tr>
                            </thead>
                            <tbody>
                                {keys.map((key: any) => (
                                    <tr key={key.id} className="border-b hover:bg-muted/50">
                                        <td className="py-3 px-4 font-mono text-sm">{key.license_key || key.key}</td>
                                        <td className="py-3 px-4">{key.owner || key.user_email || '-'}</td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${key.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                {key.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-muted-foreground">
                                            {key.expires_at ? new Date(key.expires_at).toLocaleDateString('vi-VN') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
