import React, { useState, useEffect } from 'react';
import { LicenseKey, KeyStatus, User, App } from '../types';
import { generateKeyInsights } from '../services/geminiService';
import { KeyIcon, RefreshCwIcon, SparklesIcon, LogOutIcon } from './Icons';
import api from '../services/api';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Form state
  const [selectedApp, setSelectedApp] = useState<number>(0);
  const [selectedUser, setSelectedUser] = useState<number>(0);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [maxDevices, setMaxDevices] = useState<number>(1);

  // Data
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appsRes, usersRes, licensesRes] = await Promise.all([
        api.admin.getApps(),
        api.admin.getUsers(),
        api.admin.getLicenses(),
      ]);

      setApps(appsRes.items || []);
      setUsers(usersRes.items || []);

      // Transform licenses data
      const transformedKeys = (licensesRes.items || []).map((lic: any) => ({
        id: lic.id.toString(),
        key: lic.license_key,
        status: lic.status === 'active' ? KeyStatus.ACTIVE :
                lic.status === 'revoked' ? KeyStatus.REVOKED :
                lic.status === 'expired' ? KeyStatus.EXPIRED : KeyStatus.VALID,
        createdAt: lic.created_at,
        expiresAt: lic.expires_at,
        owner: lic.email,
        appCode: lic.app_code,
        appName: lic.app_name,
        maxDevices: lic.max_devices,
      }));

      setKeys(transformedKeys);

      // Set default selections
      if (appsRes.items?.length > 0) setSelectedApp(appsRes.items[0].id);
      if (usersRes.items?.length > 0) setSelectedUser(usersRes.items[0].id);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!selectedApp || !selectedUser) {
      alert('Vui lòng chọn ứng dụng và user!');
      return;
    }

    try {
      setCreating(true);

      // Calculate expires_at
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + selectedDuration);

      const result = await api.admin.createLicense({
        user_id: selectedUser,
        app_id: selectedApp,
        max_devices: maxDevices,
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });

      alert(`License key đã được tạo thành công!\n\nKey: ${result.license_key}`);

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Failed to create license:', error);
      alert(`Không thể tạo license key: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa license key này?')) return;

    try {
      await api.admin.deleteLicense(Number(id));
      alert('Đã xóa license key thành công!');
      await loadData();
    } catch (error: any) {
      alert(`Không thể xóa: ${error.message}`);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn vô hiệu hóa license key này?')) return;

    try {
      await api.admin.revokeLicense(Number(id));
      alert('Đã vô hiệu hóa license key thành công!');
      await loadData();
    } catch (error: any) {
      alert(`Không thể vô hiệu hóa: ${error.message}`);
    }
  };

  const handleExtendKey = async (id: string) => {
    const months = prompt('Nhập số tháng muốn gia hạn (1-12):');
    if (!months) return;

    const additionalMonths = parseInt(months);
    if (isNaN(additionalMonths) || additionalMonths < 1 || additionalMonths > 12) {
      alert('Số tháng không hợp lệ!');
      return;
    }

    try {
      await api.admin.extendLicense(Number(id), additionalMonths);
      alert(`Đã gia hạn thêm ${additionalMonths} tháng thành công!`);
      await loadData();
    } catch (error: any) {
      alert(`Không thể gia hạn: ${error.message}`);
    }
  };

  const handleTransferKey = async (id: string) => {
    const newUserId = prompt('Nhập User ID mới:');
    if (!newUserId) return;

    try {
      await api.admin.transferLicense(Number(id), Number(newUserId));
      alert('Đã chuyển license key sang user mới thành công!');
      await loadData();
    } catch (error: any) {
      alert(`Không thể chuyển: ${error.message}`);
    }
  };

  const handleRemoveDevice = async (licenseId: string) => {
    // Get license details to show devices
    try {
      const details = await api.admin.getLicenseDetails(Number(licenseId));
      if (!details.activations || details.activations.length === 0) {
        alert('License này chưa có device nào được kích hoạt!');
        return;
      }

      const deviceList = details.activations.map((a: any, i: number) =>
        `${i + 1}. Device Hash: ${a.device_hash} (Status: ${a.status})`
      ).join('\n');

      const deviceHash = prompt(`Danh sách devices:\n\n${deviceList}\n\nNhập device hash muốn gỡ:`);
      if (!deviceHash) return;

      await api.admin.removeDevice(Number(licenseId), deviceHash);
      alert('Đã gỡ device khỏi license thành công!');
      await loadData();
    } catch (error: any) {
      alert(`Không thể gỡ device: ${error.message}`);
    }
  };

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

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
                <h3 className="text-lg font-semibold text-gray-800">Tạo License Key Mới</h3>

                <div className="flex flex-col space-y-2">
                    <label className="text-sm text-gray-500 font-medium">Ứng dụng</label>
                    <select
                        value={selectedApp}
                        onChange={(e) => setSelectedApp(Number(e.target.value))}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    >
                        {apps.map(app => (
                            <option key={app.id} value={app.id}>{app.name} ({app.code})</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col space-y-2">
                    <label className="text-sm text-gray-500 font-medium">User</label>
                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(Number(e.target.value))}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    >
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.email} - {u.full_name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col space-y-2">
                    <label className="text-sm text-gray-500 font-medium">Thời hạn sử dụng</label>
                    <select
                        value={selectedDuration}
                        onChange={(e) => setSelectedDuration(Number(e.target.value))}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value={1}>1 tháng</option>
                        <option value={3}>3 tháng</option>
                        <option value={6}>6 tháng</option>
                        <option value={12}>1 năm</option>
                    </select>
                </div>

                <div className="flex flex-col space-y-2">
                    <label className="text-sm text-gray-500 font-medium">Số device tối đa</label>
                    <input
                        type="number"
                        min="1"
                        value={maxDevices}
                        onChange={(e) => setMaxDevices(Number(e.target.value))}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                </div>

                <button
                    onClick={handleGenerateKey}
                    disabled={creating}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCwIcon className="w-4 h-4 mr-2" />
                    {creating ? 'Đang tạo...' : 'Tạo License Key'}
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
                <h3 className="font-bold text-gray-800">Danh sách License Keys</h3>
                <span className="text-sm text-gray-500">{keys.length} license keys</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 uppercase font-medium text-xs">
                        <tr>
                            <th className="px-6 py-3">License Key</th>
                            <th className="px-6 py-3">Ứng dụng</th>
                            <th className="px-6 py-3">Owner (Email)</th>
                            <th className="px-6 py-3">Thời hạn</th>
                            <th className="px-6 py-3">HWID</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Ngày tạo</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {keys.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-gray-400">Chưa có license key nào.</td>
                            </tr>
                        )}
                        {keys.map((key) => (
                            <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-3 font-mono text-xs text-gray-800">{key.key}</td>
                                <td className="px-6 py-3">
                                    <div className="text-sm">
                                        <div className="font-medium text-gray-800">{key.appName}</div>
                                        <div className="text-xs text-gray-500">{key.appCode}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-gray-500">{key.owner || '-'}</td>
                                <td className="px-6 py-3 text-gray-500">{formatDate(key.expiresAt)}</td>
                                <td className="px-6 py-3 text-gray-500 text-xs">{key.hwid || '-'}</td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(key.status)}`}>
                                        {key.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-gray-500">{formatDate(key.createdAt)}</td>
                                <td className="px-6 py-3">
                                    <div className="flex justify-end space-x-2">
                                        {key.status !== KeyStatus.REVOKED && (
                                            <>
                                                <button
                                                    onClick={() => handleRevokeKey(key.id)}
                                                    className="text-orange-500 hover:text-orange-700 text-xs font-medium"
                                                    title="Vô hiệu hóa"
                                                >
                                                    Vô hiệu
                                                </button>
                                                <button
                                                    onClick={() => handleExtendKey(key.id)}
                                                    className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                                                    title="Gia hạn"
                                                >
                                                    Gia hạn
                                                </button>
                                                <button
                                                    onClick={() => handleTransferKey(key.id)}
                                                    className="text-purple-500 hover:text-purple-700 text-xs font-medium"
                                                    title="Chuyển user"
                                                >
                                                    Chuyển
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveDevice(key.id)}
                                                    className="text-yellow-600 hover:text-yellow-800 text-xs font-medium"
                                                    title="Gỡ khỏi máy"
                                                >
                                                    Gỡ máy
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleDeleteKey(key.id)}
                                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                                            title="Xóa"
                                        >
                                            Xóa
                                        </button>
                                    </div>
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
