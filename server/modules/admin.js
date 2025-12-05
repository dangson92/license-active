import express from 'express'
import { query } from '../db.js'
import { requireAdmin } from './auth.js'

const router = express.Router()

const genKey = () => {
  const s = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const part = () => Array.from({ length: 4 }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `${part()}-${part()}-${part()}`
}

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const r = await query('SELECT id,email,full_name,role,created_at,last_login_at FROM users ORDER BY id DESC')
    res.json({ items: r.rows })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/apps', requireAdmin, async (req, res) => {
  try {
    const r = await query('SELECT id,code,name,created_at FROM apps ORDER BY id DESC')
    res.json({ items: r.rows })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/apps', requireAdmin, async (req, res) => {
  try {
    const { code, name } = req.body
    if (!code || !name) return res.status(400).json({ error: 'invalid_input' })
    await query('INSERT INTO apps(code,name,created_at) VALUES(?,?,NOW())', [code, name])
    const r = await query('SELECT id FROM apps WHERE code=?', [code])
    res.json({ id: r.rows[0].id })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/licenses', requireAdmin, async (req, res) => {
  try {
    const { user_id, app_id, status } = req.query
    const cond = []
    const params = []
    if (user_id) { params.push(Number(user_id)); cond.push(`l.user_id=?`) }
    if (app_id) {
      params.push(Number(app_id))
      cond.push(`l.app_id=?`)
    }
    if (status) {
      params.push(String(status))
      cond.push(`l.status=?`)
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''
    const r = await query(
      `SELECT l.id,l.license_key,l.expires_at,l.status,l.max_devices,l.created_at,u.email,a.code AS app_code,a.name AS app_name
       FROM licenses l JOIN users u ON u.id=l.user_id JOIN apps a ON a.id=l.app_id ${where} ORDER BY l.id DESC`,
      params
    )
    res.json({ items: r.rows })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/licenses', requireAdmin, async (req, res) => {
  try {
    const { user_id, app_id, max_devices, expires_at, status } = req.body
    if (!user_id || !app_id || !max_devices) return res.status(400).json({ error: 'invalid_input' })
    const license_key = genKey()
    await query(
      `INSERT INTO licenses(user_id,app_id,license_key,max_devices,expires_at,status,created_at)
       VALUES(?,?,?,?,?,?,NOW())`,
      [Number(user_id), Number(app_id), license_key, Number(max_devices), expires_at || null, status || 'active']
    )
    const r = await query('SELECT id FROM licenses WHERE license_key=?', [license_key])
    res.json({ id: r.rows[0].id, license_key })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
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
      `SELECT id,device_hash,first_activated_at,last_checkin_at,status FROM activations WHERE license_id=? ORDER BY id DESC`,
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

export default router
