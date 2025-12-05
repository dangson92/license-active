import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';
import { Auth } from './components/Auth';
import { LicenseKey, KeyStatus, UserRole, User } from './types';
import api, { getCurrentUser } from './services/api';

// Helper to generate random keys
const generateRandomKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 4;
  const segmentLength = 4;

  const parts = [];
  for (let i = 0; i < segments; i++) {
    let part = '';
    for (let j = 0; j < segmentLength; j++) {
      part += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(part);
  }
  return parts.join('-');
};

const App: React.FC = () => {
  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Effects ---
  useEffect(() => {
    // Check if user is already logged in (has valid token)
    const user = getCurrentUser();
    if (user) {
      setCurrentUser({
        id: user.id,
        username: user.email, // Use email as username for compatibility
        password: '', // Not needed
        role: user.role === 'admin' ? UserRole.ADMIN : UserRole.USER,
      });
    }
    setLoading(false);
  }, []);

  // --- Auth Handlers ---
  const handleAuthSuccess = () => {
    // After successful login/register, get user from token
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
    setKeys([]);
  };

  // --- Key Handlers ---

  const handleGenerateKey = (plan: 'Standard' | 'Pro' | 'Enterprise') => {
    const newKey: LicenseKey = {
      id: Date.now().toString(),
      key: generateRandomKey(),
      status: KeyStatus.VALID,
      plan,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 31536000000).toISOString() // Default 1 year expiry
    };
    setKeys(prev => [newKey, ...prev]);
  };

  const handleRevokeKey = (id: string) => {
    setKeys(prev => prev.map(k => {
        if (k.id === id) {
            return { ...k, status: KeyStatus.REVOKED };
        }
        return k;
    }));
  };

  const handleActivateKey = async (keyString: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'Not logged in.' };

    const targetKey = keys.find(k => k.key === keyString);

    if (!targetKey) {
        return { success: false, message: 'Invalid license key.' };
    }

    if (targetKey.status === KeyStatus.REVOKED) {
        return { success: false, message: 'This key has been revoked.' };
    }

    if (targetKey.status === KeyStatus.ACTIVE) {
        return { success: false, message: 'This key is already in use.' };
    }

    if (targetKey.status === KeyStatus.EXPIRED) {
        return { success: false, message: 'This key has expired.' };
    }

    // Success case
    const updatedKey: LicenseKey = { 
        ...targetKey, 
        status: KeyStatus.ACTIVE, 
        activatedAt: new Date().toISOString(),
        owner: currentUser.id
    };

    setKeys(prev => prev.map(k => k.id === targetKey.id ? updatedKey : k));
    return { success: true, message: 'License activated successfully!' };
  };

  // --- Views ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  if (currentUser.role === UserRole.ADMIN) {
    return (
      <AdminDashboard
        user={currentUser}
        keys={keys}
        onGenerateKey={handleGenerateKey}
        onRevokeKey={handleRevokeKey}
        onLogout={handleLogout}
      />
    );
  }

  if (currentUser.role === UserRole.USER) {
    const myKeys = keys.filter(k => k.owner === currentUser.id);
    return (
      <UserDashboard
        user={currentUser}
        userKeys={myKeys}
        onActivate={handleActivateKey}
        onLogout={handleLogout}
      />
    );
  }

  return null;
};

export default App;
