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
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const router = express.Router()

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
// S3 Client for iDrive E2 (reused config)
// ===================
const getS3Client = () => {
  let endpoint = process.env.IDRIVE_E2_ENDPOINT

  // Auto-add https:// if missing
  if (endpoint && !endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`
    console.log(`🔗 Auto-added https:// to endpoint: ${endpoint}`)
  }

  return new S3Client({
    region: 'e2',
    endpoint: endpoint,
    credentials: {
      accessKeyId: process.env.IDRIVE_E2_ACCESS_KEY,
      secretAccessKey: process.env.IDRIVE_E2_SECRET_KEY
    },
    forcePathStyle: true
  })
}

// ===================
// GET /admin/apps/:appId/attachments
// List all attachments for an app
// ===================
router.get('/:appId/attachments', requireAdmin, async (req, res) => {
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
router.post('/:appId/attachments', requireAdmin, async (req, res) => {
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
router.post('/:appId/attachments/upload', requireAdmin, upload.single('file'), async (req, res) => {
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
// Get presigned URL for direct upload to iDrive E2
// ===================
router.post('/:appId/attachments/get-presigned-url', requireAdmin, async (req, res) => {
  try {
    const { appId } = req.params
    const { appCode, filename, fileSize } = req.body

    if (!filename) {
      return res.status(400).json({ error: 'invalid_input', message: 'filename is required' })
    }

    // Generate unique key
    const ext = path.extname(filename)
    const baseName = path.basename(filename, ext)
    const timestamp = Date.now()
    const key = `attachments/${appCode || 'app'}/${baseName}-${timestamp}${ext}`

    // Get presigned URL
    const s3 = getS3Client()
    const bucket = process.env.IDRIVE_E2_BUCKET

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: 'application/zip'
    })

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }) // 1 hour

    // Public URL after upload
    const publicUrl = `${process.env.IDRIVE_E2_PUBLIC_URL}/${key}`

    res.json({
      uploadUrl,
      publicUrl,
      key,
      contentType: 'application/zip'
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
router.put('/:id', requireAdmin, async (req, res) => {
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
router.delete('/:id', requireAdmin, async (req, res) => {
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

    // Delete file based on storage type
    if (attachment.storage_type === 'idrive-e2') {
      // Delete from iDrive E2
      if (attachment.storage_key) {
        try {
          const s3 = getS3Client()
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.IDRIVE_E2_BUCKET,
            Key: attachment.storage_key
          }))
          console.log(`✅ Deleted E2 attachment: ${attachment.storage_key}`)
        } catch (e2Error) {
          console.error('Error deleting E2 file:', e2Error)
          // Continue with DB deletion even if E2 delete fails
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

export default router
