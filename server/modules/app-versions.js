import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query } from '../db.js'
import { requireAdmin } from './auth.js'

const router = express.Router()

// Cấu hình multer để upload files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'releases')

    // Tạo folder nếu chưa tồn tại
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    // Lấy appCode và version từ request body
    const appCode = req.body.appCode || 'app'
    const version = req.body.version || 'unknown'
    const ext = path.extname(file.originalname)

    // Format: {appCode}-{version}.zip
    // Ví dụ: content-auto-sondang-1.0.1.zip
    const fileName = `${appCode}-${version}${ext}`

    cb(null, fileName)
  }
})

const upload = multer({
  storage: storage,
  // No file size limit
  fileFilter: function (req, file, cb) {
    // Chỉ accept .zip files
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      return cb(new Error('Only .zip files are allowed'))
    }
    cb(null, true)
  }
})

/**
 * GET /admin/app-versions/:appId
 * Lấy tất cả versions của một app
 */
router.get('/:appId', requireAdmin, async (req, res) => {
  try {
    const { appId } = req.params

    const r = await query(
      `SELECT
        av.*,
        a.code as app_code,
        a.name as app_name
      FROM app_versions av
      JOIN apps a ON av.app_id = a.id
      WHERE av.app_id = ?
      ORDER BY av.created_at DESC`,
      [appId]
    )

    res.json({ items: r.rows })
  } catch (e) {
    console.error('Error getting versions:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * GET /admin/app-versions/latest/:appId
 * Lấy latest version của một app
 */
router.get('/latest/:appId', requireAdmin, async (req, res) => {
  try {
    const { appId } = req.params

    const r = await query(
      `SELECT * FROM app_versions
      WHERE app_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
      [appId]
    )

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' })
    }

    res.json(r.rows[0])
  } catch (e) {
    console.error('Error getting latest version:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * POST /admin/app-versions
 * Tạo version mới
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      app_id,
      version,
      release_date,
      release_notes,
      download_url,
      file_name,
      file_size,
      mandatory,
      platform,
      file_type
    } = req.body

    // Validation
    if (!app_id || !version || !release_date || !download_url) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'Missing required fields'
      })
    }

    // Check if version already exists for this app
    const existing = await query(
      'SELECT id FROM app_versions WHERE app_id = ? AND version = ?',
      [app_id, version]
    )

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'version_exists',
        message: 'Version already exists for this app'
      })
    }

    // Insert new version
    const result = await query(
      `INSERT INTO app_versions (
        app_id, version, release_date, release_notes, download_url,
        file_name, file_size, mandatory, platform, file_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        app_id,
        version,
        release_date,
        release_notes || null,
        download_url,
        file_name || null,
        file_size || null,
        mandatory || false,
        platform || 'windows',
        file_type || 'zip'
      ]
    )

    res.json({
      success: true,
      id: result.rows.insertId
    })
  } catch (e) {
    console.error('Error creating version:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * PUT /admin/app-versions/:id
 * Cập nhật version
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const {
      version,
      release_date,
      release_notes,
      download_url,
      file_name,
      file_size,
      mandatory,
      platform,
      file_type
    } = req.body

    // Build dynamic update query
    const updates = []
    const values = []

    if (version !== undefined) {
      updates.push('version = ?')
      values.push(version)
    }
    if (release_date !== undefined) {
      updates.push('release_date = ?')
      values.push(release_date)
    }
    if (release_notes !== undefined) {
      updates.push('release_notes = ?')
      values.push(release_notes)
    }
    if (download_url !== undefined) {
      updates.push('download_url = ?')
      values.push(download_url)
    }
    if (file_name !== undefined) {
      updates.push('file_name = ?')
      values.push(file_name)
    }
    if (file_size !== undefined) {
      updates.push('file_size = ?')
      values.push(file_size)
    }
    if (mandatory !== undefined) {
      updates.push('mandatory = ?')
      values.push(mandatory)
    }
    if (platform !== undefined) {
      updates.push('platform = ?')
      values.push(platform)
    }
    if (file_type !== undefined) {
      updates.push('file_type = ?')
      values.push(file_type)
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'No fields to update'
      })
    }

    values.push(id)

    await query(
      `UPDATE app_versions SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    res.json({ success: true })
  } catch (e) {
    console.error('Error updating version:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * DELETE /admin/app-versions/:id
 * Xóa version
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    // Get file info before delete để xóa file
    const versionInfo = await query(
      'SELECT file_name FROM app_versions WHERE id = ?',
      [id]
    )

    if (versionInfo.rows.length > 0 && versionInfo.rows[0].file_name) {
      const filePath = path.join(process.cwd(), 'uploads', 'releases', versionInfo.rows[0].file_name)

      // Xóa file nếu tồn tại
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await query('DELETE FROM app_versions WHERE id = ?', [id])

    res.json({ success: true })
  } catch (e) {
    console.error('Error deleting version:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * POST /admin/app-versions/upload
 * Upload file .zip cho version
 * Security: Chỉ admin mới upload được (requireAdmin middleware)
 */
router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'no_file',
        message: 'No file uploaded'
      })
    }

    // Extra validation: kiểm tra lại file extension
    const ext = path.extname(req.file.filename).toLowerCase()
    if (ext !== '.zip') {
      // Xóa file đã upload
      fs.unlinkSync(req.file.path)
      return res.status(400).json({
        error: 'invalid_file_type',
        message: 'Only .zip files are allowed'
      })
    }

    console.log(`✅ Admin uploaded file: ${req.file.filename} (${req.file.size} bytes)`)

    // Return file info
    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: `/uploads/releases/${req.file.filename}`
      }
    })
  } catch (e) {
    console.error('Error uploading file:', e)

    // Cleanup file nếu có lỗi
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }

    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

export default router
