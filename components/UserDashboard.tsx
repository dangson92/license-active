import React, { useState } from 'react';
import { ShieldCheckIcon, AlertCircleIcon, CheckCircleIcon, LogOutIcon, KeyIcon } from './Icons';
import { LicenseKey, KeyStatus, User } from '../types';

interface UserDashboardProps {
  user: User;
  userKeys: LicenseKey[];
  onActivate: (key: string) => Promise<{ success: boolean; message: string }>;
  onLogout: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, userKeys, onActivate, onLogout }) => {
  const [inputKey, setInputKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setStatus('loading');
    
    // Simulate network delay for effect
    setTimeout(async () => {
        const result = await onActivate(inputKey);
        if (result.success) {
            setStatus('success');
            setMessage(result.message);
            setInputKey('');
        } else {
            setStatus('error');
            setMessage(result.message);
        }
        
        // Reset status after a few seconds
        setTimeout(() => setStatus('idle'), 3000);
    }, 800);
  };

  const getStatusColor = (status: KeyStatus) => {
    switch (status) {
      case KeyStatus.VALID: return 'bg-blue-100 text-blue-700 border-blue-200';
      case KeyStatus.ACTIVE: return 'bg-green-100 text-green-700 border-green-200';
      case KeyStatus.EXPIRED: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case KeyStatus.REVOKED: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
       {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <ShieldCheckIcon className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-gray-800">User Portal</span>
        </div>
        <div className="flex items-center space-x-4">
             <span className="text-sm text-gray-500">Welcome, {user.username}</span>
            <button onClick={onLogout} className="flex items-center text-sm text-gray-600 hover:text-red-600 transition-colors">
                <LogOutIcon className="w-4 h-4 mr-2" />
                Logout
            </button>
        </div>
      </nav>

      <div className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8">
        
        {/* Activation Section */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <KeyIcon className="w-5 h-5 mr-2 text-indigo-600" />
                Activate New License
            </h2>
            <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1 w-full relative">
                    <input
                        type="text"
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        className={`w-full px-5 py-3 text-lg font-mono tracking-widest rounded-xl border outline-none transition-all
                            ${status === 'error' ? 'border-red-300 bg-red-50 text-red-900' : 
                            status === 'success' ? 'border-green-300 bg-green-50 text-green-900' :
                            'border-gray-200 bg-gray-50 text-gray-900 focus:border-indigo-500 focus:bg-white'}
                        `}
                    />
                    {status === 'error' && (
                        <p className="absolute -bottom-6 left-1 text-xs text-red-500 flex items-center">
                            <AlertCircleIcon className="w-3 h-3 mr-1" /> {message}
                        </p>
                    )}
                     {status === 'success' && (
                        <p className="absolute -bottom-6 left-1 text-xs text-green-600 flex items-center">
                            <CheckCircleIcon className="w-3 h-3 mr-1" /> {message}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={status === 'loading' || !inputKey}
                    className="w-full md:w-auto px-8 py-3.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-md disabled:opacity-50 whitespace-nowrap"
                >
                    {status === 'loading' ? 'Verifying...' : 'Activate Key'}
                </button>
            </div>
        </div>

        {/* My Licenses Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">My Licenses</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 uppercase font-medium text-xs">
                        <tr>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">License Key</th>
                            <th className="px-6 py-3">Software / Plan</th>
                            <th className="px-6 py-3">Expires At</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {userKeys.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center py-10 text-gray-400">
                                    You don't have any active licenses. Activate one above.
                                </td>
                            </tr>
                        )}
                        {userKeys.map((key) => (
                            <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                     <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(key.status)}`}>
                                        {key.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-gray-800 font-medium">
                                    {key.key}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-semibold text-gray-700">{key.plan} Edition</span>
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                    {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Lifetime'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};
