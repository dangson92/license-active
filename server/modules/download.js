/**
 * Download Module - Virtual Download Links + Verified Downloads
 * 
 * Public endpoints:
 * - /download/{app_code}.zip - Redirect to latest version (public)
 * - /download/{app_code}/info - Get version info (public)
 * 
 * Protected endpoints (require auth + active license):
 * - /download/{app_code}/verify - Verify license and get download URLs
 * - /download/{app_code}/file - Download main file (redirect)
 * - /download/{app_code}/attachment/:id - Download attachment (redirect)
 */

import express from 'express'
import fs from 'fs'
import path from 'path'
import { query } from '../db.js'
import { requireAuth } from './auth.js'

const router = express.Router()

/**
 * Helper: Check if user has ACTIVE license for an app
 */
async function checkActiveLicense(userId, appId) {
  const result = await query(
    `SELECT id, license_key, expires_at, status 
     FROM licenses 
     WHERE user_id = ? AND app_id = ? AND status = 'active'
     ORDER BY expires_at DESC
     LIMIT 1`,
    [userId, appId]
  )

  if (result.rows.length === 0) {
    return { valid: false, reason: 'no_license' }
  }

  const license = result.rows[0]

  // Check if expired
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { valid: false, reason: 'license_expired' }
  }

  return { valid: true, license }
}

/**
 * GET /download/:appCode/verify
 * 
 * Verify user has active license and return download info
 * Requires authentication
 */
router.get('/:appCode/verify', requireAuth, async (req, res) => {
  try {
    const { appCode } = req.params
    const userId = req.user.id

    // Find app
    const appResult = await query(
      'SELECT id, code, name, icon_url FROM apps WHERE code = ? AND (is_active = 1 OR is_active IS NULL)',
      [appCode]
    )

    if (appResult.rows.length === 0) {
      return res.status(404).json({
        error: 'app_not_found',
        message: `Application "${appCode}" not found`
      })
    }

    const app = appResult.rows[0]

    // Check license
    const licenseCheck = await checkActiveLicense(userId, app.id)
    if (!licenseCheck.valid) {
      return res.status(403).json({
        authorized: false,
        error: licenseCheck.reason,
        message: licenseCheck.reason === 'license_expired'
          ? 'License đã hết hạn. Vui lòng gia hạn để tiếp tục tải.'
          : 'Bạn chưa có license cho ứng dụng này.'
      })
    }

    // Get latest version
    const versionResult = await query(
      `SELECT id, version, release_date, release_notes, download_url, file_name, file_size, platform, file_type
       FROM app_versions 
       WHERE app_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [app.id]
    )

    if (versionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'no_version',
        message: `No version available for "${app.name}"`
      })
    }

    const version = versionResult.rows[0]

    // Get attachments for this version
    const attachmentsResult = await query(
      `SELECT aa.id, aa.file_name, aa.original_name, aa.file_size, aa.description, aa.download_url
       FROM app_attachments aa
       JOIN version_attachment_links val ON aa.id = val.attachment_id
       WHERE val.version_id = ?`,
      [version.id]
    )

    // Build full URLs for download endpoints using upload domain
    const uploadUrl = process.env.UPLOAD_URL || process.env.FRONTEND_URL || 'https://upload.dangthanhson.com'
    const baseDownloadUrl = `${uploadUrl}/api/download/${app.code}`

    res.json({
      authorized: true,
      app: {
        id: app.id,
        code: app.code,
        name: app.name,
        icon_url: app.icon_url
      },
      version: {
        id: version.id,
        version: version.version,
        release_date: version.release_date,
        release_notes: version.release_notes,
        platform: version.platform,
        file_type: version.file_type
      },
      license: {
        expires_at: licenseCheck.license.expires_at,
        status: licenseCheck.license.status
      },
      mainFile: {
        filename: version.file_name,
        size: version.file_size,
        downloadUrl: `${baseDownloadUrl}/file`
      },
      attachments: attachmentsResult.rows.map(att => ({
        id: att.id,
        description: att.description || att.original_name,
        filename: att.file_name,
        size: att.file_size,
        downloadUrl: `${baseDownloadUrl}/attachment/${att.id}`
      }))
    })

  } catch (e) {
    console.error('Error verifying download:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * GET /download/:appCode/file
 * 
 * Download main file (requires auth + active license)
 * Redirects to actual file URL
 */
router.get('/:appCode/file', requireAuth, async (req, res) => {
  try {
    const { appCode } = req.params
    const userId = req.user.id

    // Find app
    const appResult = await query(
      'SELECT id, code, name FROM apps WHERE code = ? AND (is_active = 1 OR is_active IS NULL)',
      [appCode]
    )

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'app_not_found' })
    }

    const app = appResult.rows[0]

    // Check license
    const licenseCheck = await checkActiveLicense(userId, app.id)
    if (!licenseCheck.valid) {
      return res.status(403).json({
        error: licenseCheck.reason,
        message: 'Bạn không có quyền tải file này.'
      })
    }

    // Get latest version
    const versionResult = await query(
      `SELECT download_url, version FROM app_versions 
       WHERE app_id = ? ORDER BY created_at DESC LIMIT 1`,
      [app.id]
    )

    if (versionResult.rows.length === 0) {
      return res.status(404).json({ error: 'no_version' })
    }

    const version = versionResult.rows[0]

    console.log(`📥 Verified download: User ${userId} → ${app.code} v${version.version}`)

    // Check if download_url is external (iDrive E2) or local VPS path
    const downloadUrl = version.download_url
    const isExternalUrl = downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')

    if (isExternalUrl) {
      // External URL (iDrive E2) - redirect
      return res.redirect(302, downloadUrl)
    } else {
      // VPS file - stream directly
      const filePath = path.join(process.cwd(), downloadUrl)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`)
        return res.status(404).json({ error: 'file_not_found', message: 'File không tồn tại trên server' })
      }

      // Get file stats
      const stats = fs.statSync(filePath)
      const filename = path.basename(filePath)

      console.log(`📤 Streaming VPS file: ${filename} (${stats.size} bytes)`)

      // Set headers for download
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Length', stats.size)

      // Stream file
      const fileStream = fs.createReadStream(filePath)

      fileStream.on('error', (error) => {
        console.error('Stream error:', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'stream_error', message: error.message })
        }
      })

      fileStream.pipe(res)
    }

  } catch (e) {
    console.error('Error downloading file:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * GET /download/:appCode/attachment/:attachmentId
 * 
 * Download attachment file (requires auth + active license)
 * Redirects to actual file URL
 */
router.get('/:appCode/attachment/:attachmentId', requireAuth, async (req, res) => {
  try {
    const { appCode, attachmentId } = req.params
    const userId = req.user.id

    // Find app
    const appResult = await query(
      'SELECT id, code, name FROM apps WHERE code = ? AND (is_active = 1 OR is_active IS NULL)',
      [appCode]
    )

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'app_not_found' })
    }

    const app = appResult.rows[0]

    // Check license
    const licenseCheck = await checkActiveLicense(userId, app.id)
    if (!licenseCheck.valid) {
      return res.status(403).json({
        error: licenseCheck.reason,
        message: 'Bạn không có quyền tải file này.'
      })
    }

    // Get attachment (verify it belongs to this app)
    const attachmentResult = await query(
      `SELECT aa.download_url, aa.description 
       FROM app_attachments aa
       WHERE aa.id = ? AND aa.app_id = ?`,
      [attachmentId, app.id]
    )

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'attachment_not_found' })
    }

    const attachment = attachmentResult.rows[0]

    console.log(`📥 Verified attachment download: User ${userId} → ${app.code} / ${attachment.description}`)

    // Check if download_url is external (iDrive E2) or local VPS path
    const downloadUrl = attachment.download_url
    const isExternalUrl = downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')

    if (isExternalUrl) {
      // External URL (iDrive E2) - redirect
      return res.redirect(302, downloadUrl)
    } else {
      // VPS file - stream directly
      const filePath = path.join(process.cwd(), downloadUrl)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`)
        return res.status(404).json({ error: 'file_not_found', message: 'File không tồn tại trên server' })
      }

      // Get file stats
      const stats = fs.statSync(filePath)
      const filename = path.basename(filePath)

      console.log(`📤 Streaming VPS attachment: ${filename} (${stats.size} bytes)`)

      // Set headers for download
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Length', stats.size)

      // Stream file
      const fileStream = fs.createReadStream(filePath)

      fileStream.on('error', (error) => {
        console.error('Stream error:', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'stream_error', message: error.message })
        }
      })

      fileStream.pipe(res)
    }

  } catch (e) {
    console.error('Error downloading attachment:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// ==========================================
// PUBLIC ENDPOINTS (backward compatibility)
// ==========================================

/**
 * GET /download/:appCode.zip
 * GET /d/:appCode.zip (short URL)
 * 
 * Redirect đến file download mới nhất của app
 * Không cần authentication - Chỉ cần biết app code
 * 
 * Response: 302 Redirect to actual download URL
 */
router.get('/:appCodeWithExt', async (req, res) => {
  try {
    const { appCodeWithExt } = req.params

    // Skip if it looks like a sub-route (contains no extension)
    if (!appCodeWithExt.includes('.')) {
      return res.status(404).json({ error: 'not_found' })
    }

    // Parse app code từ URL (loại bỏ .zip extension)
    let appCode = appCodeWithExt
    if (appCode.toLowerCase().endsWith('.zip')) {
      appCode = appCode.slice(0, -4)
    } else if (appCode.toLowerCase().endsWith('.exe')) {
      appCode = appCode.slice(0, -4)
    }

    // Tìm app theo code
    const appResult = await query(
      'SELECT id, code, name FROM apps WHERE code = ? AND (is_active = 1 OR is_active IS NULL)',
      [appCode]
    )

    if (appResult.rows.length === 0) {
      return res.status(404).json({
        error: 'app_not_found',
        message: `Application "${appCode}" not found`
      })
    }

    const app = appResult.rows[0]

    // Lấy version mới nhất
    const versionResult = await query(
      `SELECT id, version, download_url FROM app_versions 
       WHERE app_id = ? ORDER BY created_at DESC LIMIT 1`,
      [app.id]
    )

    if (versionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'no_version',
        message: `No version available for "${app.name}"`
      })
    }

    const version = versionResult.rows[0]

    console.log(`📥 Public download redirect: ${app.code} v${version.version}`)

    return res.redirect(302, version.download_url)

  } catch (e) {
    console.error('Error handling download redirect:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * GET /download/:appCode/info
 * 
 * Lấy thông tin version mới nhất mà không redirect
 * Public endpoint
 */
router.get('/:appCode/info', async (req, res) => {
  try {
    const { appCode } = req.params

    const appResult = await query(
      'SELECT id, code, name, icon_url FROM apps WHERE code = ? AND (is_active = 1 OR is_active IS NULL)',
      [appCode]
    )

    if (appResult.rows.length === 0) {
      return res.status(404).json({
        error: 'app_not_found',
        message: `Application "${appCode}" not found`
      })
    }

    const app = appResult.rows[0]

    const versionResult = await query(
      `SELECT id, version, release_date, release_notes, file_name, file_size, platform, file_type, created_at
       FROM app_versions 
       WHERE app_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [app.id]
    )

    if (versionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'no_version',
        message: `No version available for "${app.name}"`
      })
    }

    const version = versionResult.rows[0]

    // Get attachments count
    const attachmentsResult = await query(
      `SELECT COUNT(*) as count
       FROM version_attachment_links
       WHERE version_id = ?`,
      [version.id]
    )

    res.json({
      app: {
        code: app.code,
        name: app.name,
        icon_url: app.icon_url
      },
      version: {
        version: version.version,
        release_date: version.release_date,
        release_notes: version.release_notes,
        file_name: version.file_name,
        file_size: version.file_size,
        platform: version.platform,
        file_type: version.file_type,
        released_at: version.created_at
      },
      attachments_count: attachmentsResult.rows[0].count,
      download_url: `/download/${app.code}.zip`
    })

  } catch (e) {
    console.error('Error getting download info:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

export default router

