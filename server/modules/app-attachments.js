/**
 * App Attachments Module
 * 
 * Quản lý file đính kèm (plugins) cho apps.
 * Attachments được quản lý độc lập và có thể link với nhiều versions.
 */

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
  deleteFromCloud,
  getPresignedUploadUrl,
  generateAttachmentKey,
  detectProviderFromUrl,
  extractKeyFromUrl,
} from '../services/cloud-storage.js'

const appsRouter = express.Router()    // mounted at /api/admin/apps
const attachmentsRouter = express.Router() // mounted at /api/admin/attachments

// ===================
// Multer Configuration (reused from app-versions.js)
// ===================
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'attachments')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const appCode = req.body.appCode || 'unknown'
    const ext = path.extname(file.originalname)
    const baseName = path.basename(file.originalname, ext)
    const timestamp = Date.now()
    const fileName = `${appCode}-${baseName}-${timestamp}${ext}`
    cb(null, fileName)
  }
})

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    // Only accept .zip files
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext !== '.zip') {
      return cb(new Error('Chỉ chấp nhận file .zip'))
    }
    cb(null, true)
  }
})

// ===================
// Cloud storage helper (R2 / iDrive E2 — xem services/cloud-storage.js)
// ===================
/**
 * Chọn provider cloud cho một request attachment.
 * @param {string} [requested] - 'r2' | 'idrive-e2' | 'vps'
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

// ===================
// GET /admin/apps/:appId/attachments
// List all attachments for an app
// ===================
appsRouter.get('/:appId/attachments', requireAdmin, async (req, res) => {
  try {
    const { appId } = req.params

    const result = await query(
      `SELECT id, file_name, original_name, file_size, description, 
              download_url, storage_type, created_at, updated_at
       FROM app_attachments 
       WHERE app_id = ?
       ORDER BY created_at DESC`,
      [appId]
    )

    res.json({
      items: result.rows,
      total: result.rows.length
    })
  } catch (e) {
    console.error('Error getting attachments:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// ===================
// POST /admin/apps/:appId/attachments
// Create new attachment (metadata only, file uploaded separately)
// ===================
appsRouter.post('/:appId/attachments', requireAdmin, async (req, res) => {
  try {
    const { appId } = req.params
    const { description, file_name, original_name, file_size, download_url, storage_type, storage_key } = req.body

    if (!download_url) {
      return res.status(400).json({ error: 'invalid_input', message: 'download_url is required' })
    }

    const result = await query(
      `INSERT INTO app_attachments 
       (app_id, file_name, original_name, file_size, description, download_url, storage_type, storage_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [appId, file_name, original_name, file_size, description || null, download_url, storage_type || 'vps', storage_key || null]
    )

    // Get inserted ID
    const idResult = await query('SELECT LAST_INSERT_ID() as id')
    const insertedId = idResult.rows[0].id

    res.json({
      success: true,
      id: insertedId,
      message: 'Attachment created successfully'
    })
  } catch (e) {
    console.error('Error creating attachment:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// ===================
// POST /admin/apps/:appId/attachments/upload
// Upload attachment file to VPS
// ===================
appsRouter.post('/:appId/attachments/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'no_file', message: 'No file uploaded' })
    }

    const file = req.file
    const filePath = `/uploads/attachments/${file.filename}`

    res.json({
      success: true,
      file: {
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        path: filePath,
        storage: 'vps'
      }
    })
  } catch (e) {
    console.error('Error uploading attachment:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// ===================
// POST /admin/apps/:appId/attachments/get-presigned-url
// Presigned URL để browser upload thẳng lên cloud (R2 / iDrive E2)
// Body: { appCode, filename, fileSize?, storage? }
// ===================
appsRouter.post('/:appId/attachments/get-presigned-url', requireAdmin, async (req, res) => {
  try {
    const { appCode, filename, storage } = req.body

    if (!filename) {
      return res.status(400).json({ error: 'invalid_input', message: 'filename is required' })
    }

    const { provider, error } = pickProvider(storage)
    if (!provider) {
      return res.status(500).json({ error: 'storage_not_configured', message: error })
    }

    const key = generateAttachmentKey(appCode, filename)

    const result = await getPresignedUploadUrl({
      provider,
      key,
      contentType: 'application/zip',
      expiresIn: 3600, // 1 hour
    })

    res.json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      key: result.key,
      storage: provider,
      contentType: result.contentType
    })
  } catch (e) {
    console.error('Error getting presigned URL:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// ===================
// PUT /admin/attachments/:id
// Update attachment info
// ===================
attachmentsRouter.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { description } = req.body

    await query(
      `UPDATE app_attachments SET description = ? WHERE id = ?`,
      [description, id]
    )

    res.json({ success: true })
  } catch (e) {
    console.error('Error updating attachment:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// ===================
// DELETE /admin/attachments/:id
// Delete attachment and its file
// ===================
attachmentsRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    // Get attachment info first
    const attachmentResult = await query(
      'SELECT file_name, download_url, storage_type, storage_key FROM app_attachments WHERE id = ?',
      [id]
    )

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Attachment not found' })
    }

    const attachment = attachmentResult.rows[0]

    // Xoá file theo nơi lưu trữ (R2 / iDrive E2 / VPS)
    const cloudProvider = normalizeProvider(attachment.storage_type)
      || detectProviderFromUrl(attachment.download_url)

    if (cloudProvider) {
      const key = attachment.storage_key || extractKeyFromUrl(attachment.download_url, cloudProvider)

      if (key) {
        try {
          await deleteFromCloud({ provider: cloudProvider, key })
          console.log(`✅ Đã xoá attachment trên ${cloudProvider}: ${key}`)
        } catch (cloudError) {
          console.error('Error deleting cloud file:', cloudError)
          // Vẫn xoá bản ghi DB kể cả khi xoá file cloud thất bại
        }
      }
    } else {
      // Delete from VPS local storage
      const filePath = path.join(process.cwd(), 'uploads', 'attachments', attachment.file_name)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`✅ Deleted VPS attachment: ${filePath}`)
      }
    }

    // Delete from database (this will also delete from version_attachment_links due to CASCADE)
    await query('DELETE FROM app_attachments WHERE id = ?', [id])

    res.json({ success: true })
  } catch (e) {
    console.error('Error deleting attachment:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

export { appsRouter, attachmentsRouter }
