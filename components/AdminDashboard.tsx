import React, { useState } from 'react';
import { LicenseKey, KeyStatus, User } from '../types';
import { generateKeyInsights } from '../services/geminiService';
import { KeyIcon, RefreshCwIcon, SparklesIcon, LogOutIcon } from './Icons';

interface AdminDashboardProps {
  user: User;
  keys: LicenseKey[];
  onGenerateKey: (plan: 'Standard' | 'Pro' | 'Enterprise') => void;
  onRevokeKey: (id: string) => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, keys, onGenerateKey, onRevokeKey, onLogout }) => {
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'Standard' | 'Pro' | 'Enterprise'>('Standard');

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    const result = await generateKeyInsights(keys);
    setInsight(result);
    setLoadingInsight(false);
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
                <KeyIcon className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-gray-800">KeyMaster Admin</span>
        </div>
        <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">Admin: {user.username}</span>
            <button onClick={onLogout} className="flex items-center text-sm text-gray-600 hover:text-red-600 transition-colors">
                <LogOutIcon className="w-4 h-4 mr-2" />
                Logout
            </button>
        </div>
      </nav>

      <div className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Top Actions & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Generator Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Generate New License</h3>
                <div className="flex flex-col space-y-2">
                    <label className="text-sm text-gray-500 font-medium">Plan Tier</label>
                    <select 
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value as any)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value="Standard">Standard</option>
                        <option value="Pro">Pro</option>
                        <option value="Enterprise">Enterprise</option>
                    </select>
                </div>
                <button 
                    onClick={() => onGenerateKey(selectedPlan)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center"
                >
                    <RefreshCwIcon className="w-4 h-4 mr-2" />
                    Generate Key
                </button>
            </div>

            {/* AI Insights Card */}
            <div className="md:col-span-2 bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-indigo-900 flex items-center">
                        <SparklesIcon className="w-5 h-5 mr-2 text-indigo-500" />
                        AI Analyst
                    </h3>
                    <button 
                        onClick={handleGenerateInsight}
                        disabled={loadingInsight}
                        className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    >
                        {loadingInsight ? 'Analyzing...' : 'Refresh Insights'}
                    </button>
                </div>
                <div className="prose prose-indigo prose-sm text-gray-600">
                    {insight ? (
                         <div className="whitespace-pre-line">{insight}</div>
                    ) : (
                        <p className="text-gray-400 italic">Click "Refresh Insights" to get an AI-powered summary of your license usage.</p>
                    )}
                </div>
            </div>
        </div>

        {/* Keys Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">All Licenses</h3>
                <span className="text-sm text-gray-500">{keys.length} total records</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 uppercase font-medium text-xs">
                        <tr>
                            <th className="px-6 py-3">License Key</th>
                            <th className="px-6 py-3">Plan</th>
                            <th className="px-6 py-3">Owner (User ID)</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Created</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {keys.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-400">No keys generated yet.</td>
                            </tr>
                        )}
                        {keys.map((key) => (
                            <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-3 font-mono text-gray-800">{key.key}</td>
                                <td className="px-6 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold 
                                        ${key.plan === 'Enterprise' ? 'bg-purple-100 text-purple-700' : 
                                          key.plan === 'Pro' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {key.plan}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-gray-500">
                                    {key.owner || '-'}
                                </td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(key.status)}`}>
                                        {key.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-gray-500">{new Date(key.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-3 text-right">
                                    {key.status === KeyStatus.VALID && (
                                        <button 
                                            onClick={() => onRevokeKey(key.id)}
                                            className="text-red-500 hover:text-red-700 font-medium text-xs"
                                        >
                                            Revoke
                                        </button>
                                    )}
                                    {key.status === KeyStatus.ACTIVE && (
                                         <button 
                                            onClick={() => onRevokeKey(key.id)}
                                            className="text-orange-500 hover:text-orange-700 font-medium text-xs"
                                        >
                                            Deactivate
                                        </button>
                                    )}
                                     {key.status === KeyStatus.REVOKED && (
                                         <span className="text-gray-400 text-xs">Revoked</span>
                                    )}
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
