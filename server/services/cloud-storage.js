/**
 * Cloud Storage Service (S3-compatible, multi-provider)
 *
 * Hỗ trợ song song nhiều provider dùng chung S3 API:
 *   - 'idrive-e2' : iDrive E2 (provider cũ)
 *   - 'r2'        : Cloudflare R2 (provider mới)
 *
 * Cả hai chỉ khác nhau ở config (endpoint / region / checksum) nên dùng chung
 * một implementation. Thêm provider mới = thêm một entry vào PROVIDERS.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import fs from 'fs'
import path from 'path'

export const PROVIDER_E2 = 'idrive-e2'
export const PROVIDER_R2 = 'r2'

const PROVIDERS = {
  [PROVIDER_E2]: {
    label: 'iDrive E2',
    region: 'e2',
    forcePathStyle: true,
    disableChecksums: false,
    env: {
      endpoint: 'IDRIVE_E2_ENDPOINT',
      accessKey: 'IDRIVE_E2_ACCESS_KEY',
      secretKey: 'IDRIVE_E2_SECRET_KEY',
      bucket: 'IDRIVE_E2_BUCKET',
      publicUrl: 'IDRIVE_E2_PUBLIC_URL',
    },
  },
  [PROVIDER_R2]: {
    label: 'Cloudflare R2',
    // R2 chỉ chấp nhận region 'auto'
    region: 'auto',
    forcePathStyle: true,
    // AWS SDK >= 3.729 tự thêm header x-amz-checksum-* / x-amz-sdk-checksum-algorithm.
    // R2 không hỗ trợ, và với presigned URL thì browser không gửi lại các header đã ký
    // => chữ ký sai (403 SignatureDoesNotMatch). Phải tắt.
    disableChecksums: true,
    env: {
      endpoint: 'R2_ENDPOINT',
      accountId: 'R2_ACCOUNT_ID',
      accessKey: 'R2_ACCESS_KEY_ID',
      secretKey: 'R2_SECRET_ACCESS_KEY',
      bucket: 'R2_BUCKET',
      publicUrl: 'R2_PUBLIC_URL',
    },
  },
}

// Cache S3Client theo provider để không tạo lại mỗi request
const clientCache = new Map()

/**
 * Chuẩn hoá tên provider client gửi lên về đúng key nội bộ.
 * @param {string} [value]
 * @returns {string|null} 'idrive-e2' | 'r2' | null (= VPS / không phải cloud)
 */
export function normalizeProvider(value) {
  if (!value) return null
  const v = String(value).trim().toLowerCase()
  if (v === 'vps' || v === 'local') return null
  if (v === 'r2' || v === 'cloudflare-r2' || v === 'cloudflare') return PROVIDER_R2
  if (v === 'e2' || v === 'idrive' || v === 'idrive-e2') return PROVIDER_E2
  return null
}

/**
 * Đọc config của provider từ biến môi trường.
 * @param {string} provider
 */
export function resolveConfig(provider) {
  const spec = PROVIDERS[provider]
  if (!spec) {
    throw new Error(`unknown_storage_provider: ${provider}`)
  }

  const env = spec.env
  let endpoint = process.env[env.endpoint]

  // R2: cho phép chỉ khai báo account id, endpoint tự suy ra
  if (!endpoint && env.accountId && process.env[env.accountId]) {
    endpoint = `https://${process.env[env.accountId]}.r2.cloudflarestorage.com`
  }

  // Tự thêm https:// nếu thiếu
  if (endpoint && !/^https?:\/\//i.test(endpoint)) {
    endpoint = `https://${endpoint}`
  }

  return {
    provider,
    label: spec.label,
    region: spec.region,
    forcePathStyle: spec.forcePathStyle,
    disableChecksums: spec.disableChecksums,
    endpoint: endpoint ? endpoint.replace(/\/+$/, '') : undefined,
    accessKey: process.env[env.accessKey],
    secretKey: process.env[env.secretKey],
    bucket: process.env[env.bucket],
    publicUrl: (process.env[env.publicUrl] || '').replace(/\/+$/, ''),
  }
}

/**
 * Provider đã cấu hình đủ credentials + bucket chưa?
 * @param {string} provider
 * @returns {boolean}
 */
export function isConfigured(provider) {
  const key = normalizeProvider(provider) || provider
  if (!PROVIDERS[key]) return false
  const cfg = resolveConfig(key)
  return !!(cfg.endpoint && cfg.accessKey && cfg.secretKey && cfg.bucket)
}

/**
 * Danh sách provider kèm trạng thái cấu hình (dùng cho UI / health check).
 * @returns {Array<{provider: string, label: string, configured: boolean, bucket: string|null, publicUrl: string|null}>}
 */
export function listProviders() {
  return Object.keys(PROVIDERS).map((provider) => {
    const cfg = resolveConfig(provider)
    return {
      provider,
      label: cfg.label,
      configured: !!(cfg.endpoint && cfg.accessKey && cfg.secretKey && cfg.bucket),
      bucket: cfg.bucket || null,
      publicUrl: cfg.publicUrl || null,
    }
  })
}

/**
 * Provider mặc định khi request không chỉ định.
 * Ưu tiên STORAGE_PROVIDER, sau đó R2, cuối cùng E2.
 * @returns {string|null}
 */
export function getDefaultProvider() {
  const preferred = normalizeProvider(process.env.STORAGE_PROVIDER)
  if (preferred && isConfigured(preferred)) return preferred
  if (isConfigured(PROVIDER_R2)) return PROVIDER_R2
  if (isConfigured(PROVIDER_E2)) return PROVIDER_E2
  return null
}

/**
 * Lấy S3Client cho provider (có cache).
 * @param {string} provider
 * @returns {S3Client}
 */
export function getClient(provider) {
  const key = normalizeProvider(provider) || provider
  if (clientCache.has(key)) return clientCache.get(key)

  const cfg = resolveConfig(key)
  if (!cfg.endpoint || !cfg.accessKey || !cfg.secretKey) {
    throw new Error(`${cfg.label} credentials not configured. Kiểm tra biến môi trường của ${key}.`)
  }

  const options = {
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
    forcePathStyle: cfg.forcePathStyle,
  }

  if (cfg.disableChecksums) {
    options.requestChecksumCalculation = 'WHEN_REQUIRED'
    options.responseChecksumValidation = 'WHEN_REQUIRED'
  }

  console.log(`🔗 Storage client [${cfg.label}] -> ${cfg.endpoint}`)

  const client = new S3Client(options)
  clientCache.set(key, client)
  return client
}

/**
 * Bucket name của provider, ném lỗi nếu chưa cấu hình.
 * @param {Object} cfg - kết quả resolveConfig
 * @returns {string}
 */
function requireBucket(cfg) {
  if (!cfg.bucket) {
    throw new Error(`${cfg.label} bucket chưa được cấu hình (${PROVIDERS[cfg.provider].env.bucket}).`)
  }
  return cfg.bucket
}

/**
 * Dựng public URL để tải file sau khi upload.
 * @param {Object} cfg - kết quả resolveConfig
 * @param {string} key
 * @returns {string}
 */
export function buildPublicUrl(cfg, key) {
  if (cfg.publicUrl) return `${cfg.publicUrl}/${key}`
  // R2: endpoint S3 KHÔNG public — bắt buộc phải có R2_PUBLIC_URL
  // (custom domain hoặc r2.dev). Fallback dưới đây chỉ để không crash.
  if (cfg.provider === PROVIDER_R2) {
    console.warn('⚠️ R2_PUBLIC_URL chưa cấu hình — URL trả về sẽ không tải công khai được.')
  }
  return `${cfg.endpoint}/${cfg.bucket}/${key}`
}

/**
 * Upload file từ đĩa VPS lên cloud (multipart, hỗ trợ file lớn).
 * @param {Object} options
 * @param {string} options.provider - 'idrive-e2' | 'r2'
 * @param {string} options.filePath - Đường dẫn file local
 * @param {string} options.key - Object key trong bucket
 * @param {string} [options.contentType] - MIME type
 * @param {Function} [options.onProgress] - Callback nhận % (0-100)
 * @returns {Promise<{url: string, key: string, size: number, provider: string}>}
 */
export async function uploadToCloud({ provider, filePath, key, contentType, onProgress }) {
  const providerKey = normalizeProvider(provider) || provider
  const cfg = resolveConfig(providerKey)
  const bucket = requireBucket(cfg)
  const client = getClient(providerKey)

  const fileStats = fs.statSync(filePath)
  const fileStream = fs.createReadStream(filePath)

  console.log(`📂 [${cfg.label}] Upload bucket=${bucket} key=${key} size=${(fileStats.size / 1024 / 1024).toFixed(2)}MB`)

  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: fileStream,
        ContentType: contentType || 'application/octet-stream',
        // Không set ACL: cả E2 lẫn R2 đều không hỗ trợ.
        // Public access cấu hình ở mức bucket / custom domain.
      },
      queueSize: 4,
      // R2 yêu cầu mọi part (trừ part cuối) phải bằng nhau và >= 5MB.
      // lib-storage đảm bảo điều đó với partSize cố định.
      partSize: 10 * 1024 * 1024,
      leavePartsOnError: false,
    })

    upload.on('httpUploadProgress', (progress) => {
      if (onProgress && progress.total) {
        onProgress(Math.round((progress.loaded / progress.total) * 100))
      }
    })

    await upload.done()
    console.log(`✅ [${cfg.label}] Upload xong: ${key}`)

    return {
      url: buildPublicUrl(cfg, key),
      key,
      size: fileStats.size,
      provider: providerKey,
    }
  } catch (error) {
    console.error(`❌ [${cfg.label}] Upload error:`, {
      name: error.name,
      message: error.message,
      code: error.Code || error.code,
      statusCode: error.$metadata?.httpStatusCode,
    })
    throw error
  } finally {
    fileStream.destroy()
  }
}

/**
 * Xoá object khỏi cloud.
 * @param {Object} options
 * @param {string} options.provider
 * @param {string} options.key
 * @returns {Promise<boolean>}
 */
export async function deleteFromCloud({ provider, key }) {
  const providerKey = normalizeProvider(provider) || provider

  try {
    const cfg = resolveConfig(providerKey)
    const bucket = requireBucket(cfg)
    await getClient(providerKey).send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    console.log(`🗑️ [${cfg.label}] Đã xoá: ${key}`)
    return true
  } catch (error) {
    console.error(`❌ [${providerKey}] Delete error:`, error.message)
    return false
  }
}

/**
 * Tạo presigned URL để browser PUT thẳng lên cloud (không qua VPS).
 * @param {Object} options
 * @param {string} options.provider
 * @param {string} options.key
 * @param {string} [options.contentType]
 * @param {number} [options.expiresIn] - giây, mặc định 3600
 * @returns {Promise<{uploadUrl: string, publicUrl: string, key: string, provider: string, contentType: string, expiresIn: number}>}
 */
export async function getPresignedUploadUrl({ provider, key, contentType, expiresIn = 3600 }) {
  const providerKey = normalizeProvider(provider) || provider
  const cfg = resolveConfig(providerKey)
  const bucket = requireBucket(cfg)
  const type = contentType || 'application/octet-stream'

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: type,
  })

  const uploadUrl = await getSignedUrl(getClient(providerKey), command, { expiresIn })
  console.log(`🔑 [${cfg.label}] Presigned URL cho ${key} (hết hạn sau ${expiresIn}s)`)

  return {
    uploadUrl,
    publicUrl: buildPublicUrl(cfg, key),
    key,
    provider: providerKey,
    contentType: type,
    expiresIn,
  }
}

/**
 * Kiểm tra kết nối tới bucket (dùng cho nút "Test connection").
 * @param {string} provider
 * @returns {Promise<{ok: boolean, provider: string, label: string, bucket: string|null, error?: string}>}
 */
export async function testConnection(provider) {
  const providerKey = normalizeProvider(provider) || provider

  try {
    const cfg = resolveConfig(providerKey)
    const bucket = requireBucket(cfg)
    await getClient(providerKey).send(new HeadBucketCommand({ Bucket: bucket }))
    return { ok: true, provider: providerKey, label: cfg.label, bucket }
  } catch (error) {
    return {
      ok: false,
      provider: providerKey,
      label: PROVIDERS[providerKey]?.label || providerKey,
      bucket: process.env[PROVIDERS[providerKey]?.env?.bucket] || null,
      error: error.message,
    }
  }
}

/**
 * Làm sạch một đoạn tên để dùng an toàn trong object key / URL.
 * Bỏ dấu tiếng Việt, thay khoảng trắng và ký tự lạ bằng '-'.
 * @param {string} value
 * @returns {string}
 */
function slugifySegment(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Object key cho file cài đặt của một version.
 * Format: releases/{appCode}/{platform}/{appCode}-{version}.{ext}
 * @param {string} appCode
 * @param {string} version
 * @param {string} filename
 * @param {string} [platform]
 * @returns {string}
 */
export function generateStorageKey(appCode, version, filename, platform) {
  const ext = path.extname(filename)
  const platformFolder = platform ? slugifySegment(platform).toLowerCase() : 'windows'
  const code = slugifySegment(appCode) || 'app'
  return `releases/${code}/${platformFolder}/${code}-${slugifySegment(version)}${ext}`
}

/**
 * Object key cho file đính kèm (plugin).
 * Format: attachments/{appCode}/{basename}-{timestamp}.{ext}
 * @param {string} appCode
 * @param {string} filename
 * @returns {string}
 */
export function generateAttachmentKey(appCode, filename) {
  const ext = path.extname(filename)
  const baseName = slugifySegment(path.basename(filename, ext)) || 'file'
  return `attachments/${slugifySegment(appCode) || 'app'}/${baseName}-${Date.now()}${ext}`
}

/**
 * Đoán provider từ download_url (cho bản ghi cũ không lưu storage_type).
 * @param {string} url
 * @returns {string|null}
 */
export function detectProviderFromUrl(url) {
  if (!url) return null
  const lower = String(url).toLowerCase()

  // Ưu tiên so khớp với public URL / endpoint đã cấu hình
  for (const provider of Object.keys(PROVIDERS)) {
    const cfg = resolveConfig(provider)
    if (cfg.publicUrl && lower.startsWith(cfg.publicUrl.toLowerCase())) return provider
    if (cfg.endpoint && lower.startsWith(cfg.endpoint.toLowerCase())) return provider
  }

  if (lower.includes('r2.cloudflarestorage.com') || lower.includes('.r2.dev')) return PROVIDER_R2
  if (lower.includes('idrive') || lower.includes('.e2.') || lower.includes('e2-')) return PROVIDER_E2
  return null
}

/**
 * Suy ra object key từ public URL (fallback khi DB không lưu storage_key).
 * @param {string} url
 * @param {string} [provider]
 * @returns {string|null}
 */
export function extractKeyFromUrl(url, provider) {
  if (!url) return null
  const providerKey = normalizeProvider(provider) || detectProviderFromUrl(url)
  const clean = url.split('?')[0]

  if (providerKey) {
    const cfg = resolveConfig(providerKey)
    const lower = clean.toLowerCase()

    if (cfg.publicUrl && lower.startsWith(cfg.publicUrl.toLowerCase())) {
      return clean.slice(cfg.publicUrl.length).replace(/^\/+/, '') || null
    }

    if (cfg.endpoint && lower.startsWith(cfg.endpoint.toLowerCase())) {
      let rest = clean.slice(cfg.endpoint.length).replace(/^\/+/, '')
      // path-style: {bucket}/{key}
      if (cfg.bucket && rest.startsWith(`${cfg.bucket}/`)) {
        rest = rest.slice(cfg.bucket.length + 1)
      }
      return rest || null
    }
  }

  // Fallback: bỏ scheme + host, lấy toàn bộ path làm key.
  // Nếu segment đầu trùng tên bucket (path-style URL) thì bỏ luôn segment đó.
  try {
    let rest = new URL(clean).pathname.replace(/^\/+/, '')
    if (providerKey) {
      const bucket = resolveConfig(providerKey).bucket
      if (bucket && rest.startsWith(`${bucket}/`)) {
        rest = rest.slice(bucket.length + 1)
      }
    }
    return decodeURIComponent(rest) || null
  } catch (e) {
    return null
  }
}

/**
 * MIME type theo phần mở rộng file.
 * @param {string} filename
 * @returns {string}
 */
export function contentTypeFor(filename) {
  const map = {
    '.zip': 'application/zip',
    '.exe': 'application/x-msdownload',
    '.msi': 'application/x-msi',
    '.dmg': 'application/x-apple-diskimage',
    '.deb': 'application/x-debian-package',
    '.app': 'application/octet-stream',
  }
  return map[path.extname(filename || '').toLowerCase()] || 'application/octet-stream'
}
