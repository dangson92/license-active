import express from 'express'
import { query } from '../db.js'
import { requireAuth, requireAdmin } from './auth.js'

const router = express.Router()

// =====================
// Admin: Get notifications
// =====================
router.get('/', requireAdmin, async (req, res) => {
    try {
        const { unread_only } = req.query
        let sql = 'SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ?'
        const params = [req.user.id]

        if (unread_only === 'true') {
            sql += ' AND is_read = FALSE'
        }

        sql += ' ORDER BY created_at DESC LIMIT 50'

        const r = await query(sql, params)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting notifications:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Admin: Get unread count
// =====================
router.get('/unread-count', requireAdmin, async (req, res) => {
    try {
        const r = await query(
            'SELECT COUNT(*) as count FROM notifications WHERE (user_id IS NULL OR user_id = ?) AND is_read = FALSE',
            [req.user.id]
        )
        res.json({ count: r.rows[0].count })
    } catch (e) {
        console.error('Error getting unread count:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Admin: Mark all as read
// =====================
router.post('/mark-all-read', requireAdmin, async (req, res) => {
    try {
        await query(
            'UPDATE notifications SET is_read = TRUE WHERE (user_id IS NULL OR user_id = ?) AND is_read = FALSE',
            [req.user.id]
        )
        res.json({ success: true })
    } catch (e) {
        console.error('Error marking notifications as read:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Admin: Mark one as read
// =====================
router.patch('/:id/read', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        await query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id])
        res.json({ id, updated: true })
    } catch (e) {
        console.error('Error marking notification as read:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Admin: Delete notification
// =====================
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        await query('DELETE FROM notifications WHERE id = ?', [id])
        res.json({ id, deleted: true })
    } catch (e) {
        console.error('Error deleting notification:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Helper: Cleanup old notifications (older than 30 days)
// =====================
const cleanupOldNotifications = async () => {
    try {
        const result = await query(
            'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
        )
        if (result.affectedRows > 0) {
            console.log(`🧹 Cleaned up ${result.affectedRows} old notifications`)
        }
    } catch (e) {
        console.error('Error cleaning up old notifications:', e)
    }
}

// Run cleanup periodically (every hour)
let lastCleanup = 0
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour in ms

const maybeCleanup = () => {
    const now = Date.now()
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        lastCleanup = now
        cleanupOldNotifications()
    }
}

// =====================
// Helper: Create notification (for internal use)
// =====================
export const createNotification = async ({ type, title, message, link, userId = null }) => {
    try {
        await query(
            `INSERT INTO notifications (user_id, type, title, message, link, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [userId, type, title, message, link]
        )
        // Trigger cleanup check
        maybeCleanup()
    } catch (e) {
        console.error('Error creating notification:', e)
    }
}

export default router
