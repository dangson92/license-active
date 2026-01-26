import express from 'express'
import { query } from '../db.js'
import { requireAdmin } from './auth.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()

// Upload config for app icons
const iconStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/icons'
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `app_${req.params.id}_${Date.now()}${ext}`)
  }
})
const uploadIcon = multer({ storage: iconStorage, limits: { fileSize: 500 * 1024 } })

// Generate GUID-style license key
const genKey = () => {
  // Generate a UUID v4 style GUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10))
    const search = req.query.search || ''
    const role = req.query.role || ''
    const offset = (page - 1) * limit

    const cond = []
    const params = []

    if (search) {
      params.push(`%${search}%`, `%${search}%`)
      cond.push(`(u.full_name LIKE ? OR u.email LIKE ?)`)
    }
    if (role && role !== 'all') {
      params.push(role)
      cond.push(`u.role = ?`)
    }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users u ${where}`,
      params
    )
    const total = countResult.rows[0].total

    // Get paginated data - use parseInt to ensure integers for LIMIT/OFFSET
    const limitInt = parseInt(limit, 10)
    const offsetInt = parseInt(offset, 10)
    const r = await query(`
      SELECT u.id, u.email, u.full_name, u.role, u.email_verified, u.created_at, u.last_login_at,
        (SELECT COUNT(*) FROM licenses l WHERE l.user_id = u.id) as licenses_count
      FROM users u
      ${where}
      ORDER BY u.id DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `, params)

    res.json({
      items: r.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (e) {
    console.error('Error getting users:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// Update user
router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const fields = ['full_name', 'role', 'email_verified']
    const updates = []
    const params = []
    fields.forEach((f) => {
      if (f in req.body) {
        params.push(req.body[f])
        updates.push(`${f}=?`)
      }
    })
    if (!updates.length) return res.status(400).json({ error: 'no_updates' })
    params.push(id)
    await query(`UPDATE users SET ${updates.join(',')} WHERE id=?`, params)
    res.json({ id })
  } catch (e) {
    console.error('Error updating user:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

// Delete user
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    // Prevent deleting self
    if (id === req.user.id) {
      return res.status(400).json({ error: 'cannot_delete_self' })
    }
    await query('DELETE FROM users WHERE id=?', [id])
    res.json({ id, deleted: true })
  } catch (e) {
    console.error('Error deleting user:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.get('/apps', requireAdmin, async (req, res) => {
  try {
    const r = await query(`
      SELECT a.id, a.code, a.name, a.description, a.icon_url, a.is_active, a.created_at,
        (SELECT COUNT(*) FROM app_versions av WHERE av.app_id = a.id) as version_count,
        (SELECT COUNT(*) FROM licenses l WHERE l.app_id = a.id) as license_count
      FROM apps a 
      ORDER BY id DESC
    `)
    res.json({ items: r.rows })
  } catch (e) {
    console.error('Error getting apps:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.get('/apps/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r = await query('SELECT id,code,name,description,icon_url,is_active,created_at FROM apps WHERE id=?', [id])
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
    res.json(r.rows[0])
  } catch (e) {
    console.error('Error getting app:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.post('/apps', requireAdmin, async (req, res) => {
  try {
    const { code, name, description } = req.body
    console.log('Create app request:', { code, name })
    if (!code || !name) return res.status(400).json({ error: 'invalid_input' })
    await query('INSERT INTO apps(code,name,description,is_active,created_at) VALUES(?,?,?,TRUE,NOW())', [code, name, description || null])
    const r = await query('SELECT id FROM apps WHERE code=?', [code])
    console.log('App created successfully:', r.rows[0].id)
    res.json({ id: r.rows[0].id })
  } catch (e) {
    console.error('Error creating app:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.patch('/apps/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, description, is_active } = req.body
    const updates = []
    const params = []

    if (name !== undefined) { params.push(name); updates.push('name=?') }
    if (description !== undefined) { params.push(description); updates.push('description=?') }
    if (is_active !== undefined) { params.push(is_active); updates.push('is_active=?') }

    if (!updates.length) return res.status(400).json({ error: 'no_updates' })
    params.push(id)
    await query(`UPDATE apps SET ${updates.join(',')} WHERE id=?`, params)
    res.json({ id, updated: true })
  } catch (e) {
    console.error('Error updating app:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.post('/apps/:id/icon', requireAdmin, uploadIcon.single('icon'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!req.file) return res.status(400).json({ error: 'no_file' })

    const iconUrl = `/uploads/icons/${req.file.filename}`
    await query('UPDATE apps SET icon_url=? WHERE id=?', [iconUrl, id])
    res.json({ id, icon_url: iconUrl })
  } catch (e) {
    console.error('Error uploading icon:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.delete('/apps/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    await query('DELETE FROM apps WHERE id=?', [id])
    res.json({ id, deleted: true })
  } catch (e) {
    console.error('Error deleting app:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.get('/licenses', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10))
    const search = req.query.search || ''
    const offset = (page - 1) * limit

    const { user_id, app_id, status } = req.query
    const cond = []
    const params = []

    if (user_id) { params.push(Number(user_id)); cond.push(`l.user_id=?`) }
    if (app_id) {
      params.push(Number(app_id))
      cond.push(`l.app_id=?`)
    }
    if (status && status !== 'all') {
      params.push(String(status))
      cond.push(`l.status=?`)
    }
    if (search) {
      params.push(`%${search}%`, `%${search}%`)
      cond.push(`(l.license_key LIKE ? OR u.email LIKE ?)`)
    }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM licenses l
       JOIN users u ON u.id=l.user_id
       JOIN apps a ON a.id=l.app_id
       ${where}`,
      params
    )
    const total = countResult.rows[0].total

    // Get paginated data - use parseInt to ensure integers for LIMIT/OFFSET
    const limitInt = parseInt(limit, 10)
    const offsetInt = parseInt(offset, 10)
    const r = await query(
      `SELECT l.id, l.license_key, l.expires_at, l.status, l.max_devices, l.created_at,
              u.email, a.code AS app_code, a.name AS app_name,
              (SELECT COUNT(*) FROM activations act WHERE act.license_id = l.id AND act.status = 'active') AS active_devices
       FROM licenses l
       JOIN users u ON u.id=l.user_id
       JOIN apps a ON a.id=l.app_id
       ${where}
       ORDER BY l.id DESC
       LIMIT ${limitInt} OFFSET ${offsetInt}`,
      params
    )

    res.json({
      items: r.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (e) {
    console.error('Error getting licenses:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.post('/licenses', requireAdmin, async (req, res) => {
  try {
    const { user_id, app_id, max_devices, expires_at, status } = req.body
    console.log('Create license request:', { user_id, app_id, max_devices, expires_at, status })

    if (!user_id || !app_id || !max_devices) {
      console.error('Missing required fields')
      return res.status(400).json({ error: 'invalid_input' })
    }

    const license_key = genKey()
    console.log('Generated license key:', license_key)

    // Convert expires_at to MySQL datetime format if provided
    let expiresAtFormatted = null
    if (expires_at) {
      const date = new Date(expires_at)
      expiresAtFormatted = date.toISOString().slice(0, 19).replace('T', ' ')
    }

    console.log('Inserting license with expires_at:', expiresAtFormatted)

    await query(
      `INSERT INTO licenses(user_id,app_id,license_key,max_devices,expires_at,status,created_at)
       VALUES(?,?,?,?,?,?,NOW())`,
      [Number(user_id), Number(app_id), license_key, Number(max_devices), expiresAtFormatted, status || 'active']
    )
    const r = await query('SELECT id FROM licenses WHERE license_key=?', [license_key])
    console.log('License created successfully:', r.rows[0].id)
    res.json({ id: r.rows[0].id, license_key })
  } catch (e) {
    console.error('Error creating license:', e)
    res.status(500).json({ error: 'server_error', message: e.message })
  }
})

router.get('/licenses/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r = await query(
      `SELECT l.id,l.license_key,l.expires_at,l.status,l.max_devices,l.meta,u.email,a.code AS app_code,a.name AS app_name
       FROM licenses l JOIN users u ON u.id=l.user_id JOIN apps a ON a.id=l.app_id WHERE l.id=?`,
      [id]
    )
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
    const acts = await query(
      `SELECT id,device_id,first_activated_at,last_checkin_at,status FROM activations WHERE license_id=? ORDER BY id DESC`,
      [id]
    )
    res.json({ license: r.rows[0], activations: acts.rows })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.patch('/licenses/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const fields = ['expires_at', 'status', 'max_devices', 'meta']
    const updates = []
    const params = []
    fields.forEach((f) => {
      if (f in req.body) {
        params.push(req.body[f])
        updates.push(`${f}=?`)
      }
    })
    if (!updates.length) return res.status(400).json({ error: 'no_updates' })
    params.push(id)
    await query(`UPDATE licenses SET ${updates.join(',')} WHERE id=?`, params)
    res.json({ id })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/renew-requests', requireAdmin, async (req, res) => {
  try {
    const { status, user_id, license_id } = req.query
    const cond = []
    const params = []
    if (status) { params.push(String(status)); cond.push(`rr.status=?`) }
    if (user_id) { params.push(Number(user_id)); cond.push(`rr.user_id=?`) }
    if (license_id) { params.push(Number(license_id)); cond.push(`rr.license_id=?`) }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''
    const r = await query(
      `SELECT rr.id,rr.status,rr.created_at,rr.processed_at,rr.message,rr.license_id,rr.user_id,l.license_key,a.code AS app_code
       FROM renew_requests rr JOIN licenses l ON l.id=rr.license_id JOIN apps a ON a.id=l.app_id ${where} ORDER BY rr.id DESC`,
      params
    )
    res.json({ items: r.rows })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.patch('/renew-requests/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'invalid_status' })
    const r = await query('SELECT license_id FROM renew_requests WHERE id=?', [id])
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
    const licId = r.rows[0].license_id
    if (status === 'approved') {
      await query('UPDATE licenses SET expires_at=COALESCE(expires_at,NOW()) + INTERVAL 30 DAY WHERE id=?', [licId])
    }
    await query(
      `UPDATE renew_requests SET status=?, processed_at=NOW(), processed_by_admin_id=? WHERE id=?`,
      [status, req.user.id, id]
    )
    res.json({ id, status })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// Delete license
router.delete('/licenses/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    await query('DELETE FROM licenses WHERE id=?', [id])
    res.json({ id, deleted: true })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// Extend license
router.post('/licenses/:id/extend', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { additionalMonths } = req.body
    if (!additionalMonths || additionalMonths < 1) {
      return res.status(400).json({ error: 'invalid_months' })
    }
    await query(
      `UPDATE licenses SET expires_at=COALESCE(expires_at,NOW()) + INTERVAL ? MONTH WHERE id=?`,
      [Number(additionalMonths), id]
    )
    const r = await query('SELECT expires_at FROM licenses WHERE id=?', [id])
    res.json({ id, expires_at: r.rows[0]?.expires_at })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// Remove device from license
router.delete('/licenses/:licenseId/devices/:deviceId', requireAdmin, async (req, res) => {
  try {
    const licenseId = Number(req.params.licenseId)
    const deviceId = String(req.params.deviceId)
    await query('DELETE FROM activations WHERE license_id=? AND device_id=?', [licenseId, deviceId])
    res.json({ licenseId, deviceId, removed: true })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
