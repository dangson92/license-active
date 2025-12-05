import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';
import { Auth } from './components/Auth';
import { LicenseKey, KeyStatus, UserRole, User } from './types';

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
  const [users, setUsers] = useState<User[]>([]);
  const [keys, setKeys] = useState<LicenseKey[]>([]);

  // --- Effects ---
  useEffect(() => {
    // Load initial mock data
    const savedKeys = localStorage.getItem('license_keys');
    if (savedKeys) {
      setKeys(JSON.parse(savedKeys));
    } else {
        const dummy: LicenseKey[] = [
            { id: '1', key: 'TEST-KEY1-ABCD-1234', status: KeyStatus.VALID, plan: 'Standard', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 31536000000).toISOString() },
            { id: '2', key: 'PROX-KEY2-EFGH-5678', status: KeyStatus.ACTIVE, plan: 'Pro', createdAt: new Date(Date.now() - 86400000).toISOString(), activatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 31449600000).toISOString() }
        ];
        setKeys(dummy);
        localStorage.setItem('license_keys', JSON.stringify(dummy));
    }

    const savedUsers = localStorage.getItem('app_users');
    if (savedUsers) {
        setUsers(JSON.parse(savedUsers));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('license_keys', JSON.stringify(keys));
  }, [keys]);

  useEffect(() => {
    localStorage.setItem('app_users', JSON.stringify(users));
  }, [users]);

  // --- Auth Handlers ---
  const handleLogin = (username: string, role: UserRole) => {
    // Simple mock login: verify if username exists, otherwise create a temporary session
    // For this demo, we can assume validation is light. 
    // Ideally we check if user exists.
    let user = users.find(u => u.username === username);
    
    // For demo purposes, if user doesn't exist, we reject or just create one? 
    // Let's create one on the fly if not found to make testing easier, or enforce registration.
    // Let's enforce registration for better logic.
    if (!user) {
        alert("User not found. Please register.");
        return;
    }
    
    // Check role match (just for this demo UI toggle)
    if (user.role !== role) {
        // In reality, we'd ignore the passed role and use user.role, but the UI has a toggle.
        // We'll just login with the stored role.
    }

    setCurrentUser(user);
  };

  const handleRegister = (username: string, role: UserRole) => {
    if (users.find(u => u.username === username)) {
        alert("Username already taken.");
        return;
    }
    const newUser: User = {
        id: Date.now().toString(),
        username,
        password: 'password', // dummy
        role
    };
    setUsers([...users, newUser]);
    setCurrentUser(newUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
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

  if (!currentUser) {
      return <Auth onLogin={handleLogin} onRegister={handleRegister} />;
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
