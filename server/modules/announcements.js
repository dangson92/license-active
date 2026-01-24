import express from 'express'
import { query } from '../db.js'
import { requireAuth, requireAdmin } from './auth.js'

const router = express.Router()

// =====================
// PUBLIC ROUTES (for users)
// =====================

// Get published announcements (public)
router.get('/', requireAuth, async (req, res) => {
    try {
        const { category } = req.query

        let sql = `
            SELECT a.*, u.full_name as author_name
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            WHERE a.is_published = TRUE AND a.is_archived = FALSE
        `
        const params = []

        if (category && category !== 'all') {
            sql += ' AND a.category = ?'
            params.push(category)
        }

        sql += ' ORDER BY a.published_at DESC, a.created_at DESC LIMIT 50'

        const r = await query(sql, params)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting announcements:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Get single announcement (public)
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id)
        const isAdmin = req.user.role === 'admin'

        let sql = `
            SELECT a.*, u.full_name as author_name
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            WHERE a.id = ?
        `

        // Non-admin can only see published announcements
        if (!isAdmin) {
            sql += ' AND a.is_published = TRUE AND a.is_archived = FALSE'
        }

        const r = await query(sql, [id])
        if (r.rows.length === 0) {
            return res.status(404).json({ error: 'not_found' })
        }

        res.json(r.rows[0])
    } catch (e) {
        console.error('Error getting announcement:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// ADMIN ROUTES
// =====================

// Get all announcements with stats (admin only)
router.get('/admin/list', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query

        let sql = `
            SELECT a.*, u.full_name as author_name
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            WHERE 1=1
        `
        const params = []

        if (status === 'published') {
            sql += ' AND a.is_published = TRUE AND a.is_archived = FALSE'
        } else if (status === 'drafts') {
            sql += ' AND a.is_published = FALSE AND a.is_archived = FALSE'
        } else if (status === 'archived') {
            sql += ' AND a.is_archived = TRUE'
        }

        sql += ' ORDER BY a.created_at DESC'

        const r = await query(sql, params)

        // Get stats
        const statsR = await query(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_published = TRUE AND is_archived = FALSE THEN 1 ELSE 0 END) as published,
                SUM(CASE WHEN is_published = FALSE AND is_archived = FALSE THEN 1 ELSE 0 END) as drafts,
                SUM(CASE WHEN is_archived = TRUE THEN 1 ELSE 0 END) as archived
            FROM announcements
        `)

        res.json({
            items: r.rows,
            stats: statsR.rows[0]
        })
    } catch (e) {
        console.error('Error getting admin announcements:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Create announcement (admin only)
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { title, content, category = 'general', is_published = false } = req.body

        if (!title || !content) {
            return res.status(400).json({ error: 'missing_fields', message: 'Title and content are required' })
        }

        const publishedAt = is_published ? new Date() : null

        const result = await query(
            `INSERT INTO announcements (title, content, category, is_published, created_by, published_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title, content, category, is_published, req.user.id, publishedAt]
        )

        res.json({ id: result.insertId, message: 'Announcement created successfully' })
    } catch (e) {
        console.error('Error creating announcement:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Update announcement (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        const { title, content, category } = req.body

        const updates = []
        const params = []

        if (title !== undefined) {
            updates.push('title = ?')
            params.push(title)
        }
        if (content !== undefined) {
            updates.push('content = ?')
            params.push(content)
        }
        if (category !== undefined) {
            updates.push('category = ?')
            params.push(category)
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'no_changes' })
        }

        params.push(id)
        await query(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`, params)

        res.json({ id, updated: true })
    } catch (e) {
        console.error('Error updating announcement:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Toggle publish status (admin only)
router.patch('/:id/publish', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)

        // Get current status
        const current = await query('SELECT is_published FROM announcements WHERE id = ?', [id])
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'not_found' })
        }

        const newStatus = !current.rows[0].is_published
        const publishedAt = newStatus ? new Date() : null

        await query(
            'UPDATE announcements SET is_published = ?, published_at = ? WHERE id = ?',
            [newStatus, publishedAt, id]
        )

        res.json({ id, is_published: newStatus })
    } catch (e) {
        console.error('Error toggling publish status:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Archive announcement (admin only)
router.patch('/:id/archive', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)

        await query('UPDATE announcements SET is_archived = TRUE, is_published = FALSE WHERE id = ?', [id])

        res.json({ id, archived: true })
    } catch (e) {
        console.error('Error archiving announcement:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Delete announcement (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)

        await query('DELETE FROM announcements WHERE id = ?', [id])

        res.json({ id, deleted: true })
    } catch (e) {
        console.error('Error deleting announcement:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

export default router
