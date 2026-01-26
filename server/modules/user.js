import express from 'express'
import { query } from '../db.js'
import { requireUser } from './auth.js'

const router = express.Router()

router.get('/licenses', requireUser, async (req, res) => {
  try {
    // Lấy danh sách licenses của user kèm theo thông tin version mới nhất
    const r = await query(
      `SELECT l.id,l.license_key,l.expires_at,l.status,l.max_devices,
              a.id AS app_id, a.code AS app_code,a.name AS app_name,a.icon_url AS app_icon,
              (SELECT COUNT(*) FROM activations act WHERE act.license_id = l.id AND act.status = 'active') AS active_devices,
              (SELECT av.version FROM app_versions av WHERE av.app_id = a.id ORDER BY av.created_at DESC LIMIT 1) AS latest_version
       FROM licenses l JOIN apps a ON a.id=l.app_id WHERE l.user_id=? ORDER BY l.id DESC`,
      [req.user.id]
    )

    // Thêm download_url cho các app có version
    const items = r.rows.map(license => ({
      ...license,
      // Tạo download URL dạng /download/{app_code}.zip nếu có version
      download_url: license.latest_version ? `/download/${license.app_code}.zip` : null
    }))

    res.json({ items })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/licenses/:id', requireUser, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const r = await query(
      `SELECT l.id,l.license_key,l.expires_at,l.status,l.max_devices,a.code AS app_code,a.name AS app_name
       FROM licenses l JOIN apps a ON a.id=l.app_id WHERE l.id=? AND l.user_id=?`,
      [id, req.user.id]
    )
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
    const lic = r.rows[0]
    const acts = await query(
      `SELECT id,device_id,first_activated_at,last_checkin_at,status FROM activations WHERE license_id=? ORDER BY id DESC`,
      [lic.id]
    )
    res.json({ license: lic, activations: acts.rows })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/licenses/:id/renew-requests', requireUser, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const owns = await query('SELECT id FROM licenses WHERE id=? AND user_id=?', [id, req.user.id])
    if (!owns.rows.length) return res.status(404).json({ error: 'not_found' })
    const message = typeof req.body.message === 'string' ? req.body.message : null
    await query(
      `INSERT INTO renew_requests(user_id,license_id,message,status,created_at)
       VALUES(?,?,?,'pending',NOW())`,
      [req.user.id, id, message]
    )
    const r = await query('SELECT id,status,created_at FROM renew_requests WHERE user_id=? AND license_id=? ORDER BY id DESC LIMIT 1', [req.user.id, id])
    res.json({ request: r.rows[0] })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/renew-requests', requireUser, async (req, res) => {
  try {
    const r = await query(
      `SELECT rr.id,rr.status,rr.created_at,rr.processed_at,rr.message,l.license_key,a.code AS app_code
       FROM renew_requests rr JOIN licenses l ON l.id=rr.license_id JOIN apps a ON a.id=l.app_id
       WHERE rr.user_id=? ORDER BY rr.id DESC`,
      [req.user.id]
    )
    res.json({ items: r.rows })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
