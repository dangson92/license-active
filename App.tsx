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
import { OrderManagement } from './components/OrderManagement';

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

  // Load data only for create license page
  useEffect(() => {
    const isCreateLicensePage = location.pathname.includes('/admin/create-license');
    if (!isCreateLicensePage) return;

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
  }, [location.pathname]);

  // Get active section from URL
  const getActiveSection = () => {
    const path = location.pathname;
    if (path.includes('/admin/orders')) return 'orders';
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
      case 'orders':
        navigate('/admin/orders');
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
        <Route path="orders" element={<OrderManagement />} />
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

  return (
    <ApplicationSetting
      isNew={true}
      onBack={() => navigate('/admin/applications')}
      onSave={() => {
        navigate('/admin/applications');
      }}
    />
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
