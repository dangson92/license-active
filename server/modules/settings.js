import express from 'express'
import { query } from '../db.js'
import { requireAdmin } from './auth.js'
import { sendTestEmail } from '../services/email.js'

const router = express.Router()

// Get all settings
router.get('/', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT setting_key, setting_value FROM settings')
        const settings = {}
        for (const row of result.rows) {
            // Mask password
            if (row.setting_key === 'smtp_pass' && row.setting_value) {
                settings[row.setting_key] = '********'
            } else {
                settings[row.setting_key] = row.setting_value
            }
        }
        res.json(settings)
    } catch (e) {
        console.error('Get settings error:', e)
        res.status(500).json({ error: 'server_error' })
    }
})

// Update settings
router.put('/', requireAdmin, async (req, res) => {
    try {
        const updates = req.body

        for (const [key, value] of Object.entries(updates)) {
            // Skip if trying to update with masked password
            if (key === 'smtp_pass' && value === '********') {
                continue
            }

            await query(
                `INSERT INTO settings (setting_key, setting_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                [key, value]
            )
        }

        res.json({ success: true })
    } catch (e) {
        console.error('Update settings error:', e)
        res.status(500).json({ error: 'server_error' })
    }
})

// Send test email
router.post('/test-email', requireAdmin, async (req, res) => {
    try {
        const { to } = req.body

        if (!to) {
            return res.status(400).json({ error: 'Email address required' })
        }

        await sendTestEmail(to)
        res.json({ success: true, message: 'Test email sent successfully' })
    } catch (e) {
        console.error('Test email error:', e)
        res.status(500).json({ error: e.message || 'Failed to send test email' })
    }
})

export default router
