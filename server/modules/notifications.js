import express from 'express'
import { query } from '../db.js'
import { requireAuth, requireAdmin } from './auth.js'
import { emitToAdmins, emitToUser } from '../socket.js'

const router = express.Router()

// =====================
// Get notifications (for both admin and user)
// Admin: sees system notifications (user_id IS NULL) + their own notifications
// User: sees only their own notifications (user_id = their id)
// =====================
router.get('/', requireAuth, async (req, res) => {
    try {
        const { unread_only } = req.query
        const isAdmin = req.user.role === 'admin'

        let sql, params
        if (isAdmin) {
            // Admin sees system notifications (user_id IS NULL) and their specific ones
            sql = 'SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ?'
            params = [req.user.id]
        } else {
            // Regular user only sees their own notifications
            sql = 'SELECT * FROM notifications WHERE user_id = ?'
            params = [req.user.id]
        }

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
// Get unread count (for both admin and user)
// =====================
router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin'

        let sql, params
        if (isAdmin) {
            sql = 'SELECT COUNT(*) as count FROM notifications WHERE (user_id IS NULL OR user_id = ?) AND is_read = FALSE'
            params = [req.user.id]
        } else {
            sql = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE'
            params = [req.user.id]
        }

        const r = await query(sql, params)
        res.json({ count: r.rows[0].count })
    } catch (e) {
        console.error('Error getting unread count:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Mark all as read (for both admin and user)
// =====================
router.post('/mark-all-read', requireAuth, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin'

        let sql, params
        if (isAdmin) {
            sql = 'UPDATE notifications SET is_read = TRUE WHERE (user_id IS NULL OR user_id = ?) AND is_read = FALSE'
            params = [req.user.id]
        } else {
            sql = 'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE'
            params = [req.user.id]
        }

        await query(sql, params)
        res.json({ success: true })
    } catch (e) {
        console.error('Error marking notifications as read:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Mark one as read (verify ownership)
// =====================
router.patch('/:id/read', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id)
        const isAdmin = req.user.role === 'admin'

        // Verify ownership or admin access
        let checkSql, checkParams
        if (isAdmin) {
            checkSql = 'SELECT id FROM notifications WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
            checkParams = [id, req.user.id]
        } else {
            checkSql = 'SELECT id FROM notifications WHERE id = ? AND user_id = ?'
            checkParams = [id, req.user.id]
        }

        const check = await query(checkSql, checkParams)
        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'forbidden' })
        }

        await query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id])
        res.json({ id, updated: true })
    } catch (e) {
        console.error('Error marking notification as read:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Delete notification (verify ownership)
// =====================
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id)
        const isAdmin = req.user.role === 'admin'

        // Verify ownership or admin access
        let checkSql, checkParams
        if (isAdmin) {
            checkSql = 'SELECT id FROM notifications WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
            checkParams = [id, req.user.id]
        } else {
            checkSql = 'SELECT id FROM notifications WHERE id = ? AND user_id = ?'
            checkParams = [id, req.user.id]
        }

        const check = await query(checkSql, checkParams)
        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'forbidden' })
        }

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
        const result = await query(
            `INSERT INTO notifications (user_id, type, title, message, link, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [userId, type, title, message, link]
        )

        const notificationData = {
            id: result.insertId,
            type,
            title,
            message,
            link,
            is_read: false,
            created_at: new Date().toISOString()
        }

        // Emit real-time notification via Socket.IO
        if (userId) {
            // Send to specific user
            emitToUser(userId, 'new-notification', notificationData)
        } else {
            // Send to all admins (system notifications)
            emitToAdmins('new-notification', notificationData)
        }

        // Trigger cleanup check
        maybeCleanup()

        return result.insertId
    } catch (e) {
        console.error('Error creating notification:', e)
        return null
    }
}

export default router
