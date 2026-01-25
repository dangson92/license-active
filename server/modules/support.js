import express from 'express'
import { query } from '../db.js'
import { requireAuth, requireAdmin } from './auth.js'
import { createNotification } from './notifications.js'

const router = express.Router()

// =====================
// FAQs (Public)
// =====================
router.get('/faqs', async (req, res) => {
    try {
        const r = await query(
            'SELECT id, question, answer, category FROM faqs WHERE is_active = TRUE ORDER BY display_order ASC, id ASC'
        )
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting FAQs:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Support Tickets (User)
// =====================

// Get my tickets
router.get('/tickets', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id
        const r = await query(
            `SELECT id, subject, category, status, priority, created_at, resolved_at
       FROM support_tickets
       WHERE user_id = ?
       ORDER BY created_at DESC`,
            [userId]
        )
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting tickets:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Create ticket
router.post('/tickets', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id
        const { subject, category, message } = req.body

        if (!subject || !message) {
            return res.status(400).json({ error: 'validation_error', message: 'Subject and message are required' })
        }

        await query(
            `INSERT INTO support_tickets (user_id, subject, category, message, status, priority, created_at)
       VALUES (?, ?, ?, ?, 'pending', 'normal', NOW())`,
            [userId, subject, category || 'other', message]
        )
        const r = await query('SELECT LAST_INSERT_ID() as id')
        const ticketId = r.rows[0].id

        // Get user info for notification
        const userInfo = await query('SELECT email, full_name FROM users WHERE id = ?', [userId])
        const userName = userInfo.rows[0]?.full_name || userInfo.rows[0]?.email || 'User'

        // Create notification for admin
        createNotification({
            type: 'new_ticket',
            title: 'Ticket hỗ trợ mới',
            message: `${userName} đã gửi ticket: ${subject}`,
            link: `/admin/support/ticket/${ticketId}`
        })

        res.json({ id: ticketId, message: 'Ticket created successfully' })
    } catch (e) {
        console.error('Error creating ticket:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// User reply to ticket
router.post('/tickets/:id/reply', requireAuth, async (req, res) => {
    try {
        const ticketId = Number(req.params.id)
        const userId = req.user.id
        const { message } = req.body

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'validation_error', message: 'Message is required' })
        }

        // Check ownership
        const ticketInfo = await query(
            'SELECT id, subject, status FROM support_tickets WHERE id = ? AND user_id = ?',
            [ticketId, userId]
        )
        if (ticketInfo.rows.length === 0) {
            return res.status(404).json({ error: 'not_found', message: 'Ticket not found' })
        }
        const ticket = ticketInfo.rows[0]

        if (ticket.status === 'closed') {
            return res.status(400).json({ error: 'ticket_closed', message: 'Cannot reply to closed ticket' })
        }

        // Insert reply (user_id instead of admin_id)
        await query(
            `INSERT INTO ticket_replies (ticket_id, user_id, message, created_at)
             VALUES (?, ?, ?, NOW())`,
            [ticketId, userId, message.trim()]
        )
        const replyResult = await query('SELECT LAST_INSERT_ID() as id')
        const replyId = replyResult.rows[0].id

        // Update ticket status to pending (waiting for admin)
        await query(
            `UPDATE support_tickets SET status = 'pending', updated_at = NOW() WHERE id = ?`,
            [ticketId]
        )

        // Get user info for notification
        const userInfo = await query('SELECT email, full_name FROM users WHERE id = ?', [userId])
        const userName = userInfo.rows[0]?.full_name || userInfo.rows[0]?.email || 'User'

        // Notify admin about user reply
        createNotification({
            type: 'ticket_reply',
            title: 'Phản hồi ticket từ user',
            message: `${userName} đã trả lời ticket: "${ticket.subject}"`,
            link: '/admin/support'
        })

        res.json({ id: replyId, ticket_id: ticketId, message: 'Reply sent successfully' })
    } catch (e) {
        console.error('Error replying to ticket:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Admin: Manage Tickets
// =====================
router.get('/admin/tickets', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query
        let sql = `
      SELECT t.id, t.subject, t.category, t.message, t.status, t.priority, t.created_at, t.resolved_at,
             u.id as user_id, u.email as user_email, u.full_name as user_name
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
    `
        const params = []

        if (status) {
            sql += ' WHERE t.status = ?'
            params.push(status)
        }

        sql += ' ORDER BY t.created_at DESC'

        const r = await query(sql, params)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting admin tickets:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Update ticket status
router.patch('/admin/tickets/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        const { status, priority } = req.body
        const adminId = req.user.id

        // Get ticket info first for notification
        const ticketInfo = await query(
            'SELECT user_id, subject FROM support_tickets WHERE id = ?',
            [id]
        )
        if (ticketInfo.rows.length === 0) {
            return res.status(404).json({ error: 'not_found' })
        }
        const ticket = ticketInfo.rows[0]

        const updates = ['updated_at = NOW()']
        const params = []

        if (status) {
            params.push(status)
            updates.push('status = ?')
            if (status === 'resolved' || status === 'closed') {
                updates.push('resolved_at = NOW()')
                params.push(adminId)
                updates.push('resolved_by_admin_id = ?')
            }
        }
        if (priority) {
            params.push(priority)
            updates.push('priority = ?')
        }

        params.push(id)
        await query(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`, params)

        // Notify user about status change
        if (status) {
            const statusLabels = {
                'pending': 'Đang chờ',
                'in_progress': 'Đang xử lý',
                'resolved': 'Đã giải quyết',
                'closed': 'Đã đóng'
            }
            createNotification({
                type: 'ticket_status',
                title: 'Cập nhật ticket hỗ trợ',
                message: `Ticket "${ticket.subject}" đã chuyển sang trạng thái: ${statusLabels[status] || status}`,
                link: `/user/support/ticket/${id}`,
                userId: ticket.user_id
            })
        }

        res.json({ id, updated: true })
    } catch (e) {
        console.error('Error updating ticket:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Admin reply to ticket
router.post('/admin/tickets/:id/reply', requireAdmin, async (req, res) => {
    try {
        const ticketId = Number(req.params.id)
        const adminId = req.user.id
        const { message } = req.body

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'validation_error', message: 'Message is required' })
        }

        // Get ticket info
        const ticketInfo = await query(
            'SELECT user_id, subject FROM support_tickets WHERE id = ?',
            [ticketId]
        )
        if (ticketInfo.rows.length === 0) {
            return res.status(404).json({ error: 'not_found', message: 'Ticket not found' })
        }
        const ticket = ticketInfo.rows[0]

        // Insert reply
        await query(
            `INSERT INTO ticket_replies (ticket_id, admin_id, message, created_at)
             VALUES (?, ?, ?, NOW())`,
            [ticketId, adminId, message.trim()]
        )
        const replyResult = await query('SELECT LAST_INSERT_ID() as id')
        const replyId = replyResult.rows[0].id

        // Update ticket status to in_progress if pending
        await query(
            `UPDATE support_tickets SET status = 'in_progress', updated_at = NOW() WHERE id = ? AND status = 'pending'`,
            [ticketId]
        )

        // Notify user about admin reply
        createNotification({
            type: 'ticket_reply',
            title: 'Phản hồi từ hỗ trợ',
            message: `Admin đã trả lời ticket "${ticket.subject}"`,
            link: '/support',
            userId: ticket.user_id
        })

        res.json({ id: replyId, ticket_id: ticketId, message: 'Reply sent successfully' })
    } catch (e) {
        console.error('Error replying to ticket:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Get ticket replies
router.get('/tickets/:id/replies', requireAuth, async (req, res) => {
    try {
        const ticketId = Number(req.params.id)
        const userId = req.user.id
        const isAdmin = req.user.role === 'admin'

        // Check ownership or admin
        if (!isAdmin) {
            const ownership = await query(
                'SELECT id FROM support_tickets WHERE id = ? AND user_id = ?',
                [ticketId, userId]
            )
            if (ownership.rows.length === 0) {
                return res.status(403).json({ error: 'forbidden' })
            }
        }

        const replies = await query(
            `SELECT tr.id, tr.message, tr.created_at, tr.admin_id, tr.user_id,
                    admin.full_name as admin_name, admin.email as admin_email,
                    user.full_name as user_name, user.email as user_email
             FROM ticket_replies tr
             LEFT JOIN users admin ON tr.admin_id = admin.id
             LEFT JOIN users user ON tr.user_id = user.id
             WHERE tr.ticket_id = ?
             ORDER BY tr.created_at ASC`,
            [ticketId]
        )

        res.json({ items: replies.rows })
    } catch (e) {
        console.error('Error getting ticket replies:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Delete ticket
router.delete('/admin/tickets/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        // Delete replies first
        await query('DELETE FROM ticket_replies WHERE ticket_id = ?', [id])
        await query('DELETE FROM support_tickets WHERE id = ?', [id])
        res.json({ id, deleted: true })
    } catch (e) {
        console.error('Error deleting ticket:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Admin: Manage FAQs
// =====================
router.get('/admin/faqs', requireAdmin, async (req, res) => {
    try {
        const { category } = req.query
        let sql = 'SELECT * FROM faqs'
        const params = []

        if (category) {
            sql += ' WHERE category = ?'
            params.push(category)
        }

        sql += ' ORDER BY display_order ASC, id ASC'

        const r = await query(sql, params)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting FAQs:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Admin: Get FAQ categories (for filter dropdown)
router.get('/admin/faq-categories', requireAdmin, async (req, res) => {
    try {
        const r = await query('SELECT DISTINCT category FROM faqs WHERE category IS NOT NULL AND category != "" ORDER BY category ASC')
        res.json({ items: r.rows.map(row => row.category) })
    } catch (e) {
        console.error('Error getting FAQ categories:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

router.post('/admin/faqs', requireAdmin, async (req, res) => {
    try {
        const { question, answer, category, display_order } = req.body

        // Validate required fields
        if (!question || !question.trim()) {
            return res.status(400).json({ error: 'validation_error', message: 'Question is required' })
        }
        if (!answer || !answer.trim()) {
            return res.status(400).json({ error: 'validation_error', message: 'Answer is required' })
        }

        const result = await query(
            `INSERT INTO faqs (question, answer, category, display_order, is_active, created_at)
       VALUES (?, ?, ?, ?, TRUE, NOW())`,
            [question.trim(), answer.trim(), category?.trim() || null, display_order || 0]
        )
        res.json({ id: result.insertId, message: 'FAQ created successfully' })
    } catch (e) {
        console.error('Error creating FAQ:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

router.patch('/admin/faqs/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        const { question, answer, category, display_order, is_active } = req.body

        const updates = ['updated_at = NOW()']
        const params = []

        if (question !== undefined) { params.push(question); updates.push('question = ?') }
        if (answer !== undefined) { params.push(answer); updates.push('answer = ?') }
        if (category !== undefined) { params.push(category); updates.push('category = ?') }
        if (display_order !== undefined) { params.push(display_order); updates.push('display_order = ?') }
        if (is_active !== undefined) { params.push(is_active); updates.push('is_active = ?') }

        params.push(id)
        await query(`UPDATE faqs SET ${updates.join(', ')} WHERE id = ?`, params)

        res.json({ id, updated: true })
    } catch (e) {
        console.error('Error updating FAQ:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

router.delete('/admin/faqs/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        await query('DELETE FROM faqs WHERE id = ?', [id])
        res.json({ id, deleted: true })
    } catch (e) {
        console.error('Error deleting FAQ:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

export default router
