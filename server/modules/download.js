/**
 * Download Module - Virtual Download Links
 * 
 * Cung cấp link download ảo dạng /download/{app_code}.zip
 * Luôn redirect đến version mới nhất của ứng dụng đó
 * 
 * Ví dụ:
 * - https://upload.dangthanhson.com/content-auto-sondang.zip -> redirect đến version mới nhất
 */

import express from 'express'
import { query } from '../db.js'

const router = express.Router()

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

    // Parse app code từ URL (loại bỏ .zip extension)
    // Ví dụ: "content-auto-sondang.zip" -> "content-auto-sondang"
    let appCode = appCodeWithExt
    if (appCode.toLowerCase().endsWith('.zip')) {
      appCode = appCode.slice(0, -4)
    } else if (appCode.toLowerCase().endsWith('.exe')) {
      appCode = appCode.slice(0, -4)
    }

    // Tìm app theo code (accept is_active = 1 or NULL)
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

    // Lấy version mới nhất (dựa theo created_at DESC)
    const versionResult = await query(
      `SELECT id, version, download_url, file_name, file_size, platform, file_type
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

    // Log download attempt
    console.log(`📥 Download redirect: ${app.code} v${version.version} -> ${version.download_url}`)

    // Redirect đến actual download URL
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
 * Dùng cho frontend để hiển thị info trước khi download
 */
router.get('/:appCode/info', async (req, res) => {
  try {
    const { appCode } = req.params

    // Tìm app theo code (accept is_active = 1 or NULL)
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

    // Lấy version mới nhất
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
      download_url: `/download/${app.code}.zip`
    })

  } catch (e) {
    console.error('Error getting download info:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

export default router
