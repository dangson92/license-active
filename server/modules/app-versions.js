import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query } from '../db.js'
import { requireAdmin } from './auth.js'
import {
  normalizeProvider,
  getDefaultProvider,
  isConfigured,
  listProviders,
  uploadToCloud,
  deleteFromCloud,
  getPresignedUploadUrl,
  generateStorageKey,
  detectProviderFromUrl,
  extractKeyFromUrl,
  contentTypeFor,
  testConnection,
} from '../services/cloud-storage.js'

const router = express.Router()

/**
 * Chọn provider cloud cho một request.
 * @param {string} [requested] - Giá trị client gửi lên ('r2' | 'idrive-e2' | 'vps')
 * @returns {{provider: string|null, error: string|null}}
 */
function pickProvider(requested) {
  const provider = normalizeProvider(requested) || getDefaultProvider()
  if (!provider) {
    return { provider: null, error: 'Chưa cấu hình cloud storage nào (R2 / iDrive E2).' }
  }
  if (!isConfigured(provider)) {
    return { provider: null, error: `Storage "${provider}" chưa được cấu hình đầy đủ trong biến môi trường.` }
  }
  return { provider, error: null }
}

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
    // Accept common app release file types
    const allowedExtensions = ['.zip', '.exe', '.msi', '.dmg', '.deb', '.app']
    const ext = path.extname(file.originalname).toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Only .zip, .exe, .msi, .dmg, .deb files are allowed'))
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

    // Get attachments for each version
    const versions = await Promise.all(r.rows.map(async (version) => {
      const attachmentsResult = await query(
        `SELECT aa.id, aa.file_name, aa.original_name, aa.file_size, aa.description, aa.download_url
         FROM app_attachments aa
         JOIN version_attachment_links val ON aa.id = val.attachment_id
         WHERE val.version_id = ?`,
        [version.id]
      )
      return {
        ...version,
        attachments: attachmentsResult.rows
      }
    }))

    res.json({ items: versions })
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
      attachment_ids
    } = req.body

    // Validation
    if (!app_id || !version || !release_date || !download_url) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'Missing required fields'
      })
    }

    const resolvedPlatform = platform || 'Windows'

    // Check if version already exists for this app + platform combo
    const existing = await query(
      'SELECT id FROM app_versions WHERE app_id = ? AND version = ? AND platform = ?',
      [app_id, version, resolvedPlatform]
    )

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'version_exists',
        message: `Version ${version} already exists for platform ${resolvedPlatform}`
      })
    }

    // Derive file_type from actual uploaded file extension
    const resolvedFileType = file_name
      ? (path.extname(file_name) || '.zip')
      : '.zip'

    // Insert new version
    await query(
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
        resolvedPlatform,
        resolvedFileType
      ]
    )

    // Get inserted version ID
    const idResult = await query('SELECT LAST_INSERT_ID() as id')
    const versionId = idResult.rows[0].id

    // Link attachments if provided
    if (attachment_ids && Array.isArray(attachment_ids) && attachment_ids.length > 0) {
      const linkValues = attachment_ids.map(attachmentId => [versionId, attachmentId])
      for (const [vid, aid] of linkValues) {
        await query(
          'INSERT INTO version_attachment_links (version_id, attachment_id) VALUES (?, ?)',
          [vid, aid]
        )
      }
    }

    res.json({
      success: true,
      id: versionId
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
      attachment_ids
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

    // Update version fields if any
    if (updates.length > 0) {
      values.push(id)
      await query(
        `UPDATE app_versions SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }

    // Update attachment links if provided
    if (attachment_ids !== undefined && Array.isArray(attachment_ids)) {
      // Delete existing links
      await query('DELETE FROM version_attachment_links WHERE version_id = ?', [id])

      // Insert new links
      if (attachment_ids.length > 0) {
        for (const attachmentId of attachment_ids) {
          await query(
            'INSERT INTO version_attachment_links (version_id, attachment_id) VALUES (?, ?)',
            [id, attachmentId]
          )
        }
      }
    }

    res.json({ success: true })
  } catch (e) {
    console.error('Error updating version:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * DELETE /admin/app-versions/cleanup-upload
 * Xóa file đã upload khi user cancel (chưa tạo version)
 * Body: { url: string, storage: 'vps' | 'idrive-e2' | 'r2', key?: string }
 * NOTE: This route MUST be defined BEFORE /:id route to match correctly
 */
router.delete('/cleanup-upload', requireAdmin, async (req, res) => {
  try {
    const { url, storage, key, filename } = req.body

    if (!url && !key && !filename) {
      return res.status(400).json({ error: 'invalid_input', message: 'Missing url, key, or filename' })
    }

    // Cloud (R2 / iDrive E2) — suy ra provider từ storage, fallback đoán theo URL
    const cloudProvider = normalizeProvider(storage) || detectProviderFromUrl(url)

    if (cloudProvider) {
      try {
        const deleteKey = key || extractKeyFromUrl(url, cloudProvider)

        if (deleteKey) {
          console.log(`🗑️ Cleanup: xoá ${cloudProvider} file: ${deleteKey}`)
          await deleteFromCloud({ provider: cloudProvider, key: deleteKey })
        }
      } catch (cloudError) {
        console.error('Error cleaning up cloud file:', cloudError)
        return res.status(500).json({ error: 'cloud_delete_error', message: cloudError.message })
      }
    } else {
      // Delete from VPS local storage
      const deleteFilename = filename || (url ? url.split('/').pop() : null)
      if (deleteFilename) {
        const filePath = path.join(process.cwd(), 'uploads', 'releases', deleteFilename)

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          console.log(`🗑️ Cleanup: VPS file deleted: ${filePath}`)
        }
      }
    }

    res.json({ success: true })
  } catch (e) {
    console.error('Error cleaning up upload:', e)
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
      'SELECT file_name, download_url FROM app_versions WHERE id = ?',
      [id]
    )

    if (versionInfo.rows.length > 0) {
      const { file_name, download_url } = versionInfo.rows[0]

      // Xác định file nằm trên cloud nào (R2 / iDrive E2) dựa trên URL
      const cloudProvider = detectProviderFromUrl(download_url)

      if (cloudProvider) {
        try {
          const key = extractKeyFromUrl(download_url, cloudProvider)

          if (key) {
            console.log(`🗑️ Xoá file ${cloudProvider}: ${key}`)
            await deleteFromCloud({ provider: cloudProvider, key })
          }
        } catch (cloudError) {
          console.error('Error deleting cloud file:', cloudError)
          // Vẫn xoá version trong DB kể cả khi xoá file cloud thất bại
        }
      } else {
        // Delete from VPS local storage
        // Try to get filename from file_name field, or extract from download_url
        let fileToDelete = file_name
        if (!fileToDelete && download_url) {
          // Extract filename from URL like: http://example.com/uploads/releases/app-1.0.0.zip
          const urlFilename = download_url.split('/').pop()
          if (urlFilename && !urlFilename.includes('?')) {
            fileToDelete = urlFilename
          }
        }

        if (fileToDelete) {
          const filePath = path.join(process.cwd(), 'uploads', 'releases', fileToDelete)

          // Xóa file nếu tồn tại
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            console.log(`🗑️ VPS file deleted: ${filePath}`)
          } else {
            console.log(`⚠️ VPS file not found (already deleted?): ${filePath}`)
          }
        } else {
          console.log(`⚠️ No filename to delete for version ${id}`)
        }
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
    const allowedExtensions = ['.zip', '.exe', '.msi', '.dmg', '.deb', '.app']
    const ext = path.extname(req.file.filename).toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      // Xóa file đã upload
      fs.unlinkSync(req.file.path)
      return res.status(400).json({
        error: 'invalid_file_type',
        message: 'Only .zip, .exe, .msi, .dmg, .deb files are allowed'
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

/**
 * POST /admin/app-versions/upload-cloud   (alias cũ: /upload-e2)
 *
 * Upload file lên cloud storage thông qua VPS (server-side upload).
 * Body (multipart): file, appCode, version, platform, storage
 *   storage: 'r2' | 'idrive-e2' — bỏ trống thì dùng provider mặc định.
 * Security: Chỉ admin mới upload được (requireAdmin middleware)
 */
async function handleCloudUpload(req, res) {
  const cleanupTemp = () => {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (unlinkError) {
        console.error('Error removing temp file:', unlinkError.message)
      }
    }
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'no_file', message: 'No file uploaded' })
    }

    const { provider, error } = pickProvider(req.body.storage)
    if (!provider) {
      cleanupTemp()
      return res.status(500).json({ error: 'storage_not_configured', message: error })
    }

    const appCode = req.body.appCode || 'app'
    const version = req.body.version || 'unknown'
    const platform = req.body.platform || 'Windows'

    // Key có platform trong path để bản build khác nền tảng không ghi đè nhau
    const key = generateStorageKey(appCode, version, req.file.originalname, platform)

    console.log(`📤 Bắt đầu upload lên ${provider}: ${key}`)

    const result = await uploadToCloud({
      provider,
      filePath: req.file.path,
      key,
      contentType: contentTypeFor(req.file.originalname),
    })

    // Xoá file tạm sau khi upload thành công
    cleanupTemp()

    res.json({
      success: true,
      file: {
        filename: path.basename(key),
        originalname: req.file.originalname,
        size: result.size,
        path: result.url, // Full public URL
        storage: provider,
        key: result.key,
      }
    })
  } catch (e) {
    console.error('Error uploading to cloud storage:', e)
    cleanupTemp()
    res.status(500).json({ error: 'cloud_upload_error', message: e.message })
  }
}

router.post('/upload-cloud', requireAdmin, upload.single('file'), handleCloudUpload)
// Alias giữ tương thích với client cũ đang gọi /upload-e2
router.post('/upload-e2', requireAdmin, upload.single('file'), handleCloudUpload)

/**
 * POST /admin/app-versions/get-presigned-url
 * Lấy presigned URL để browser upload thẳng lên cloud (không đi qua VPS)
 * Body: { appCode, version, filename, contentType?, platform?, storage? }
 */
router.post('/get-presigned-url', requireAdmin, async (req, res) => {
  try {
    const { appCode, version, filename, contentType, platform, storage } = req.body

    if (!appCode || !version || !filename) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'Missing required fields: appCode, version, filename'
      })
    }

    const { provider, error } = pickProvider(storage)
    if (!provider) {
      return res.status(500).json({ error: 'storage_not_configured', message: error })
    }

    // Key có platform trong path để bản build khác nền tảng không ghi đè nhau
    const key = generateStorageKey(appCode, version, filename, platform)
    const finalContentType = contentType || contentTypeFor(filename)

    console.log(`📤 Tạo presigned URL (${provider}) cho upload trực tiếp: ${key}`)

    const result = await getPresignedUploadUrl({
      provider,
      key,
      contentType: finalContentType,
      expiresIn: 3600,
    })

    res.json({
      success: true,
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      key: result.key,
      storage: provider,
      contentType: result.contentType,
    })
  } catch (e) {
    console.error('Error getting presigned URL:', e)
    res.status(500).json({ error: 'presigned_url_error', message: e.message })
  }
})

/**
 * GET /admin/app-versions/storage/providers
 * Liệt kê provider cloud + trạng thái cấu hình (cho UI chọn nơi upload)
 */
router.get('/storage/providers', requireAdmin, (req, res) => {
  try {
    res.json({
      default: getDefaultProvider(),
      providers: listProviders(),
    })
  } catch (e) {
    console.error('Error listing storage providers:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

/**
 * POST /admin/app-versions/storage/test
 * Kiểm tra kết nối tới bucket của một provider
 * Body: { storage: 'r2' | 'idrive-e2' }
 */
router.post('/storage/test', requireAdmin, async (req, res) => {
  try {
    const provider = normalizeProvider(req.body.storage)
    if (!provider) {
      return res.status(400).json({ error: 'invalid_input', message: 'storage phải là "r2" hoặc "idrive-e2"' })
    }

    res.json(await testConnection(provider))
  } catch (e) {
    console.error('Error testing storage connection:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

export default router
