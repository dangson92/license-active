/**
 * iDrive E2 Storage Service — lớp tương thích ngược
 *
 * Toàn bộ logic S3 đã chuyển sang `cloud-storage.js` (đa provider: E2 + R2).
 * File này giữ nguyên API cũ để code hiện hữu không phải sửa.
 * Code mới nên import trực tiếp từ `cloud-storage.js`.
 */

import {
  PROVIDER_E2,
  uploadToCloud,
  deleteFromCloud,
  getPresignedUploadUrl as presignCloud,
  generateStorageKey,
  isConfigured,
} from './cloud-storage.js'

/**
 * Upload file lên iDrive E2
 * @param {Object} options
 * @param {string} options.filePath
 * @param {string} options.key
 * @param {string} [options.contentType]
 * @param {Function} [options.onProgress]
 * @returns {Promise<{url: string, key: string, size: number, provider: string}>}
 */
export function uploadToE2({ filePath, key, contentType, onProgress }) {
  return uploadToCloud({ provider: PROVIDER_E2, filePath, key, contentType, onProgress })
}

/**
 * Xoá file khỏi iDrive E2
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export function deleteFromE2(key) {
  return deleteFromCloud({ provider: PROVIDER_E2, key })
}

/**
 * Sinh object key cho file version
 * @param {string} appCode
 * @param {string} version
 * @param {string} filename
 * @param {string} [platform]
 * @returns {string}
 */
export function generateE2Key(appCode, version, filename, platform) {
  return generateStorageKey(appCode, version, filename, platform)
}

/**
 * iDrive E2 đã cấu hình chưa?
 * @returns {boolean}
 */
export function isE2Configured() {
  return isConfigured(PROVIDER_E2)
}

/**
 * Presigned URL upload trực tiếp lên E2
 * @param {Object} options
 * @param {string} options.key
 * @param {string} [options.contentType]
 * @param {number} [options.expiresIn]
 * @returns {Promise<{uploadUrl: string, publicUrl: string, key: string}>}
 */
export function getPresignedUploadUrl({ key, contentType, expiresIn = 3600 }) {
  return presignCloud({ provider: PROVIDER_E2, key, contentType, expiresIn })
}
