import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { UserRoutes } from './components/UserRoutes';
import { Auth } from './components/Auth';
import { UserRole, User } from './types';
import api, { getCurrentUser } from './services/api';

// Admin Pages
import { AppLayout } from './components/layout/AppLayout';
import { MemberManagement } from './components/MemberManagement';
import { CreateLicense } from './components/CreateLicense';
import { ApplicationManagement } from './components/ApplicationManagement';
import { LicenseManagement } from './components/LicenseManagement';
import { AddAppVersion } from './components/AddAppVersion';
import { AppVersionHistory } from './components/AppVersionHistory';
import { Settings } from './components/Settings';
import { VerifyEmail } from './components/VerifyEmail';
import { AdminTicketManagement } from './components/AdminTicketManagement';
import { ApplicationSetting } from './components/ApplicationSetting';

// ⚠️ DEV MODE: Set to true to bypass login and test Admin/User Dashboard directly
// Set to 'admin' or 'user' to test that role, or false to use normal auth
const DEV_MODE: 'admin' | 'user' | false = false;

const MOCK_ADMIN_USER: User = {
  id: '1',
  username: 'Admin Test',
  password: '',
  role: UserRole.ADMIN,
};

const MOCK_USER: User = {
  id: '2',
  username: 'User Test',
  password: '',
  role: UserRole.USER,
};

// Admin Router Component
const AdminRoutes: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [apps, setApps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Load data for create license page
  useEffect(() => {
    const loadData = async () => {
      try {
        const [appsRes, usersRes] = await Promise.all([
          api.admin.getApps(),
          api.admin.getUsers()
        ]);
        setApps(appsRes.items || []);
        setUsers(usersRes.items || []);
      } catch (error) {
        // Mock data for dev
        setApps([{ id: 1, code: 'APP001', name: 'CloudSuite Pro' }]);
        setUsers([{ id: 1, email: 'user@test.com', full_name: 'Test User' }]);
      }
    };
    loadData();
  }, []);

  // Get active section from URL
  const getActiveSection = () => {
    const path = location.pathname;
    if (path.includes('/admin/members')) return 'members';
    if (path.includes('/admin/applications')) return 'applications';
    if (path.includes('/admin/create-license')) return 'licenses';
    if (path.includes('/admin/settings')) return 'settings';
    if (path.includes('/admin/dashboard')) return 'dashboard';
    if (path.includes('/admin/support')) return 'support';
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
      case 'support':
        navigate('/admin/support');
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
        <Route path="licenses" element={
          <LicenseManagement
            user={user}
            onCreateLicense={() => navigate('/admin/create-license')}
          />
        } />
        <Route path="members" element={<MemberManagement />} />
        <Route path="applications" element={
          <ApplicationManagement
            onManageVersions={(appId, appName) => navigate(`/admin/applications/${appId}/versions`, { state: { appName } })}
            onAddVersion={(appId, appName) => navigate(`/admin/applications/${appId}/add-version`, { state: { appName } })}
            onEditApp={(appId, appName) => navigate(`/admin/applications/${appId}/settings`, { state: { appName } })}
            onAddApp={() => navigate('/admin/applications/new')}
          />
        } />
        <Route path="applications/:appId/versions" element={
          <AppVersionHistoryWrapper />
        } />
        <Route path="applications/:appId/add-version" element={
          <AddAppVersionWrapper />
        } />
        <Route path="create-license" element={
          <CreateLicense
            apps={apps}
            users={users}
            onBack={() => navigate('/admin/licenses')}
            onSuccess={() => navigate('/admin/licenses')}
          />
        } />
        <Route path="dashboard" element={<DashboardPlaceholder />} />
        <Route path="settings" element={<Settings />} />
        <Route path="support" element={<AdminTicketManagement />} />
        <Route path="applications/:appId/settings" element={<ApplicationSettingWrapper />} />
        <Route path="applications/new" element={<NewApplicationWrapper />} />
        <Route path="*" element={<Navigate to="/admin/licenses" replace />} />
      </Routes>
    </AppLayout>
  );
};

// Placeholder pages
const DashboardPlaceholder: React.FC = () => (
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



// Wrapper components for route params
import { useParams } from 'react-router-dom';

const AppVersionHistoryWrapper: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const appName = (location.state as any)?.appName || 'Application';

  return (
    <AppVersionHistory
      appId={appId || '0'}
      appName={appName}
      onBack={() => navigate('/admin/applications')}
      onAddVersion={() => navigate(`/admin/applications/${appId}/add-version`, { state: { appName } })}
    />
  );
};

const AddAppVersionWrapper: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const appName = (location.state as any)?.appName || 'Application';

  return (
    <AddAppVersion
      appId={appId}
      appName={appName}
      onBack={() => navigate(`/admin/applications/${appId}/versions`, { state: { appName } })}
      onSuccess={() => navigate(`/admin/applications/${appId}/versions`, { state: { appName } })}
    />
  );
};

const ApplicationSettingWrapper: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const appName = (location.state as any)?.appName || 'Application';

  return (
    <ApplicationSetting
      appId={appId}
      appName={appName}
      onBack={() => navigate('/admin/applications')}
      onSave={(data) => {
        console.log('Saving app settings:', data);
        navigate('/admin/applications');
      }}
    />
  );
};

const NewApplicationWrapper: React.FC = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({ code: '', name: '', description: '' });

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      alert('Vui lòng nhập mã và tên ứng dụng!');
      return;
    }
    setSaving(true);
    try {
      const result = await api.admin.createApp(formData);
      navigate(`/admin/applications/${result.id}/settings`);
    } catch (error) {
      console.error('Failed to create app:', error);
      alert('Không thể tạo ứng dụng. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/applications')}
          className="p-2 rounded-md border hover:bg-muted"
        >
          ←
        </button>
        <div>
          <h2 className="text-lg font-semibold">Create New Application</h2>
          <p className="text-sm text-muted-foreground">Thêm ứng dụng mới vào hệ thống</p>
        </div>
      </div>

      <div className="max-w-xl space-y-4 p-6 border rounded-lg bg-card">
        <div className="space-y-2">
          <label className="text-sm font-medium">Mã ứng dụng (Code)</label>
          <input
            type="text"
            placeholder="VD: APP001"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Tên ứng dụng</label>
          <input
            type="text"
            placeholder="VD: CloudSuite Pro"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Mô tả (tùy chọn)</label>
          <textarea
            placeholder="Mô tả ngắn về ứng dụng..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-md min-h-[100px]"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => navigate('/admin/applications')}
            className="px-4 py-2 border rounded-md hover:bg-muted"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Đang tạo...' : 'Tạo ứng dụng'}
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Effects ---
  useEffect(() => {
    // DEV MODE: Bypass login for testing
    if (DEV_MODE) {
      setCurrentUser(DEV_MODE === 'admin' ? MOCK_ADMIN_USER : MOCK_USER);
      setLoading(false);
      return;
    }

    // Check if user is already logged in (has valid token)
    const user = getCurrentUser();
    if (user) {
      setCurrentUser({
        id: user.id,
        username: user.email,
        password: '',
        role: user.role === 'admin' ? UserRole.ADMIN : UserRole.USER,
      });
    }
    setLoading(false);
  }, []);

  // --- Auth Handlers ---
  const handleAuthSuccess = () => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser({
        id: user.id,
        username: user.email,
        password: '',
        role: user.role === 'admin' ? UserRole.ADMIN : UserRole.USER,
      });
    }
  };

  const handleLogout = () => {
    api.auth.logout();
    setCurrentUser(null);
  };

  // --- Views ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={
          currentUser ? <Navigate to={currentUser.role === UserRole.ADMIN ? '/admin/licenses' : '/user/licenses'} /> : <Auth onAuthSuccess={handleAuthSuccess} />
        } />

        {/* Email Verification Route */}
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Admin Routes */}
        <Route path="/admin/*" element={
          currentUser?.role === UserRole.ADMIN
            ? <AdminRoutes user={currentUser} onLogout={handleLogout} />
            : <Navigate to="/login" />
        } />

        {/* User Routes */}
        <Route path="/user/*" element={
          currentUser?.role === UserRole.USER
            ? <UserRoutes user={currentUser} onLogout={handleLogout} />
            : <Navigate to="/login" />
        } />

        {/* Default Redirect */}
        <Route path="*" element={
          currentUser
            ? <Navigate to={currentUser.role === UserRole.ADMIN ? '/admin/licenses' : '/user/licenses'} />
            : <Navigate to="/login" />
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
