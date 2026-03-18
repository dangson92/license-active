import express from 'express'
import { query } from '../db.js'

const router = express.Router()

/**
 * GET /version
 * Lấy thông tin phiên bản mới nhất của app từ database
 * Query params:
 *   - appCode: Mã app (vd: 'content-auto-sondang')
 *   - platform: Nền tảng (vd: 'Windows', 'macOS', 'Linux') — optional, default 'Windows'
 */
router.get('/', async (req, res) => {
  try {
    const { appCode, platform } = req.query

    if (!appCode) {
      return res.status(400).json({
        ok: false,
        error: 'Missing appCode parameter'
      })
    }

    // Normalize platform: trim + match DB values (Windows/macOS/Linux/All)
    const requestedPlatform = (platform || 'Windows').trim()

    // Get latest version for the requested platform
    // Try exact platform match first, then fallback to 'All' platform
    const result = await query(
      `SELECT
        av.version,
        av.release_date as releaseDate,
        av.release_notes as releaseNotes,
        av.mandatory,
        av.download_url as downloadUrl,
        av.platform,
        av.file_type as fileType
      FROM app_versions av
      JOIN apps a ON av.app_id = a.id
      WHERE a.code = ?
        AND (av.platform = ? OR av.platform = 'All')
      ORDER BY
        CASE WHEN av.platform = ? THEN 0 ELSE 1 END,
        av.created_at DESC
      LIMIT 1`,
      [appCode, requestedPlatform, requestedPlatform]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'App not found or no version available'
      })
    }

    const versionData = result.rows[0]

    res.json({
      ok: true,
      data: {
        version: versionData.version,
        releaseDate: versionData.releaseDate,
        releaseNotes: versionData.releaseNotes,
        mandatory: Boolean(versionData.mandatory),
        downloadUrl: versionData.downloadUrl,
        platform: versionData.platform,
        fileType: versionData.fileType
      }
    })
  } catch (error) {
    console.error('Version check error:', error)
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    })
  }
})

export default router
