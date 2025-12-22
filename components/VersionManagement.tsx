import React, { useState, useEffect } from 'react';
import { App } from '../types';
import api from '../services/api';
import { config } from '../config';

interface AppVersion {
  id: number;
  app_id: number;
  version: string;
  release_date: string;
  release_notes: string | null;
  download_url: string;
  file_name: string | null;
  file_size: number | null;
  mandatory: boolean;
  platform: string;
  file_type: string;
  created_at: string;
  updated_at: string;
}

interface VersionManagementProps {
  apps: App[];
}

export const VersionManagement: React.FC<VersionManagementProps> = ({ apps }) => {
  const [selectedAppId, setSelectedAppId] = useState<number>(0);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVersion, setEditingVersion] = useState<AppVersion | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    version: '',
    release_date: new Date().toISOString().split('T')[0],
    release_notes: '',
    download_url: '',
    file_name: '',
    file_size: 0,
    mandatory: false,
    platform: 'windows',
    file_type: 'zip'
  });

  // Upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (apps.length > 0 && selectedAppId === 0) {
      setSelectedAppId(apps[0].id);
    }
  }, [apps]);

  useEffect(() => {
    if (selectedAppId > 0) {
      loadVersions();
    }
  }, [selectedAppId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await api.admin.getAppVersions(selectedAppId);
      setVersions(response.items || []);
    } catch (error) {
      console.error('Failed to load versions:', error);
      alert('Không thể tải danh sách versions!');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      alert('Chỉ chấp nhận file .zip!');
      return;
    }

    // Validation: cần có version và appCode
    if (!formData.version) {
      alert('Vui lòng nhập Version trước khi upload file!');
      e.target.value = ''; // Reset input
      return;
    }

    if (selectedAppId === 0) {
      alert('Vui lòng chọn App trước khi upload file!');
      e.target.value = ''; // Reset input
      return;
    }

    try {
      setUploadingFile(true);
      setUploadProgress(0);

      // Lấy appCode từ selected app
      const selectedApp = apps.find(app => app.id === selectedAppId);
      if (!selectedApp) {
        throw new Error('App not found');
      }

      // Upload với progress tracking
      const response = await uploadFileWithProgress(file, selectedApp.code, formData.version);

      // Update form với thông tin file
      // Use upload subdomain for download URL (no CloudFlare limit)
      setFormData(prev => ({
        ...prev,
        download_url: `${config.uploadApiUrl}${response.file.path}`,
        file_name: response.file.filename,
        file_size: response.file.size
      }));

      alert('Upload file thành công!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload file thất bại: ' + (error as Error).message);
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  };

  // Upload file với XMLHttpRequest để track progress
  const uploadFileWithProgress = (file: File, appCode: string, version: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      // IMPORTANT: Append text fields BEFORE file so multer can access them in filename function
      formData.append('appCode', appCode);
      formData.append('version', version);
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Set timeout to 30 minutes for large file uploads
      xhr.timeout = 30 * 60 * 1000; // 30 minutes

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: HTTP ${xhr.status}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error occurred'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout - file quá lớn hoặc mạng chậm'));
      });

      // Get auth token
      const token = localStorage.getItem('auth_token');

      // Open and send request
      // Use upload subdomain to bypass CloudFlare 100MB limit
      xhr.open('POST', `${config.uploadApiUrl}/admin/app-versions/upload`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.version) {
      alert('Vui lòng nhập Version!');
      return;
    }

    if (!formData.download_url || !formData.file_name) {
      alert('Vui lòng upload file trước khi lưu!');
      return;
    }

    try {
      if (editingVersion) {
        // Update
        await api.admin.updateAppVersion(editingVersion.id, formData);
        alert('Cập nhật version thành công!');
      } else {
        // Create
        await api.admin.createAppVersion({
          ...formData,
          app_id: selectedAppId
        });
        alert('Tạo version mới thành công!');
      }

      // Reset form
      setFormData({
        version: '',
        release_date: new Date().toISOString().split('T')[0],
        release_notes: '',
        download_url: '',
        file_name: '',
        file_size: 0,
        mandatory: false,
        platform: 'windows',
        file_type: 'zip'
      });

      setShowCreateForm(false);
      setEditingVersion(null);
      loadVersions();
    } catch (error: any) {
      console.error('Failed to save version:', error);
      alert(error.message || 'Lưu version thất bại!');
    }
  };

  const handleEdit = (version: AppVersion) => {
    setEditingVersion(version);
    setFormData({
      version: version.version,
      release_date: version.release_date.split('T')[0],
      release_notes: version.release_notes || '',
      download_url: version.download_url,
      file_name: version.file_name || '',
      file_size: version.file_size || 0,
      mandatory: version.mandatory,
      platform: version.platform,
      file_type: version.file_type
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa version này?')) {
      return;
    }

    try {
      await api.admin.deleteAppVersion(id);
      alert('Xóa version thành công!');
      loadVersions();
    } catch (error) {
      console.error('Failed to delete version:', error);
      alert('Xóa version thất bại!');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('vi-VN');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quản lý Versions</h2>
          <p className="text-gray-600 mt-1">Quản lý các phiên bản cập nhật cho apps</p>
        </div>

        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setEditingVersion(null);
            setFormData({
              version: '',
              release_date: new Date().toISOString().split('T')[0],
              release_notes: '',
              download_url: '',
              file_name: '',
              file_size: 0,
              mandatory: false,
              platform: 'windows',
              file_type: 'zip'
            });
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {showCreateForm ? 'Đóng' : '+ Thêm Version Mới'}
        </button>
      </div>

      {/* App Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chọn App
        </label>
        <select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(Number(e.target.value))}
          className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {apps.map(app => (
            <option key={app.id} value={app.id}>
              {app.name} ({app.code})
            </option>
          ))}
        </select>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingVersion ? 'Chỉnh sửa Version' : 'Tạo Version Mới'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="1.0.0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Release Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày phát hành <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.release_date}
                  onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Platform */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Platform
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="windows">Windows</option>
                  <option value="mac">macOS</option>
                  <option value="linux">Linux</option>
                </select>
              </div>

              {/* File Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Type
                </label>
                <select
                  value={formData.file_type}
                  onChange={(e) => setFormData({ ...formData, file_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="zip">ZIP</option>
                  <option value="exe">EXE</option>
                  <option value="dmg">DMG</option>
                  <option value="AppImage">AppImage</option>
                </select>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload File .zip <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                ⚠️ Lưu ý: Phải nhập <strong>Version</strong> trước khi upload. File sẽ được rename thành <code className="bg-gray-100 px-1 rounded">appCode-version.zip</code>
              </p>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileUpload}
                disabled={uploadingFile || !formData.version}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />

              {/* Upload Progress */}
              {uploadingFile && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Đang upload...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Upload Success */}
              {formData.file_name && !uploadingFile && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-medium mb-1">
                    ✓ Upload thành công
                  </p>
                  <p className="text-xs text-green-700">
                    File: <span className="font-mono">{formData.file_name}</span>
                  </p>
                  <p className="text-xs text-green-700">
                    Kích thước: {formatFileSize(formData.file_size)}
                  </p>
                  <p className="text-xs text-green-700 break-all">
                    URL: <a href={formData.download_url} target="_blank" rel="noopener noreferrer" className="underline">{formData.download_url}</a>
                  </p>
                </div>
              )}
            </div>

            {/* Release Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Release Notes
              </label>
              <textarea
                value={formData.release_notes}
                onChange={(e) => setFormData({ ...formData, release_notes: e.target.value })}
                placeholder="Mô tả các tính năng mới, bug fixes..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Mandatory */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="mandatory"
                checked={formData.mandatory}
                onChange={(e) => setFormData({ ...formData, mandatory: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="mandatory" className="ml-2 text-sm text-gray-700">
                Bắt buộc cập nhật (Mandatory)
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                {editingVersion ? 'Cập nhật' : 'Tạo Version'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingVersion(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Versions List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Đang tải...
          </div>
        ) : versions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Chưa có version nào. Tạo version mới để bắt đầu!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Release Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mandatory</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {versions.map(version => (
                  <tr key={version.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{version.version}</div>
                        {version.release_notes && (
                          <div className="text-sm text-gray-500 truncate max-w-xs" title={version.release_notes}>
                            {version.release_notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(version.release_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {version.platform} / {version.file_type}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        {version.file_name && (
                          <div className="text-xs text-gray-600">{version.file_name}</div>
                        )}
                        <div className="text-xs text-gray-500">{formatFileSize(version.file_size)}</div>
                        <a
                          href={version.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {version.mandatory ? (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                          Bắt buộc
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                          Tùy chọn
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => handleEdit(version)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(version.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
