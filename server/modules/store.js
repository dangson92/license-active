import express from 'express'
import { query } from '../db.js'
import { requireAuth, requireAdmin } from './auth.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { sendNewOrderNotification, sendOrderStatusEmail } from '../services/email.js'

const router = express.Router()

// Upload config for receipts
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/receipts'
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        cb(null, dir)
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        cb(null, `receipt_${Date.now()}${ext}`)
    }
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

// =====================
// Store (Public - with auth for purchase)
// =====================

// Get all available apps with pricing
router.get('/apps', async (req, res) => {
    try {
        const r = await query(`
      SELECT a.id, a.code, a.name, a.description, a.icon_url, a.is_active,
             p.price_1_month, p.price_6_months, p.price_1_year,
             p.is_featured, p.badge, p.icon_class
      FROM apps a
      LEFT JOIN app_pricing p ON p.app_id = a.id
      WHERE a.is_active = TRUE
      ORDER BY p.is_featured DESC, a.name ASC
    `)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting store apps:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Get single app details
router.get('/apps/:id', async (req, res) => {
    try {
        const id = Number(req.params.id)
        const r = await query(`
      SELECT a.id, a.code, a.name, 
             p.description, p.price_1_month, p.price_1_month_enabled,
             p.price_6_months, p.price_6_months_enabled,
             p.price_1_year, p.price_1_year_enabled,
             p.is_featured, p.badge, p.icon_class
      FROM apps a
      LEFT JOIN app_pricing p ON p.app_id = a.id
      WHERE a.id = ?
    `, [id])

        if (r.rows.length === 0) {
            return res.status(404).json({ error: 'not_found' })
        }

        res.json(r.rows[0])
    } catch (e) {
        console.error('Error getting app:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Purchase Orders (User)
// =====================

// Generate order code
function generateOrderCode() {
    return 'SDA_' + Math.random().toString(36).substring(2, 8).toUpperCase() + '_' + Date.now().toString(36).toUpperCase()
}
// Get my orders (user)
router.get('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id
        const r = await query(`
            SELECT po.id, po.order_code, po.quantity, po.duration_months, 
                   po.unit_price, po.total_price, po.status, po.created_at, 
                   a.name as app_name
            FROM purchase_orders po
            LEFT JOIN apps a ON po.app_id = a.id
            WHERE po.user_id = ?
            ORDER BY po.created_at DESC
        `, [userId])
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting orders:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Create purchase order
router.post('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id
        const { app_id, quantity, duration_months, unit_price } = req.body

        if (!app_id || !duration_months || !unit_price) {
            return res.status(400).json({ error: 'validation_error', message: 'Missing required fields' })
        }

        const orderCode = generateOrderCode()
        const totalPrice = unit_price * (quantity || 1)

        await query(
            `INSERT INTO purchase_orders (user_id, app_id, order_code, quantity, duration_months, unit_price, total_price, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [userId, app_id, orderCode, quantity || 1, duration_months, unit_price, totalPrice]
        )
        const r = await query('SELECT LAST_INSERT_ID() as id')
        const orderId = r.rows[0].id

        // Send email notification to admin (non-blocking)
        const orderInfo = await query(`
            SELECT po.*, a.name as app_name, u.email as user_email, u.full_name as user_name
            FROM purchase_orders po
            LEFT JOIN apps a ON po.app_id = a.id
            LEFT JOIN users u ON po.user_id = u.id
            WHERE po.id = ?
        `, [orderId])

        if (orderInfo.rows.length > 0) {
            sendNewOrderNotification(orderInfo.rows[0]).catch(e => console.error('Email error:', e))
        }

        res.json({
            id: orderId,
            order_code: orderCode,
            total_price: totalPrice,
            message: 'Order created successfully'
        })
    } catch (e) {
        console.error('Error creating order:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Upload receipt
router.post('/orders/:id/receipt', requireAuth, upload.single('receipt'), async (req, res) => {
    try {
        const orderId = Number(req.params.id)
        const userId = req.user.id

        // Check if order belongs to user
        const check = await query('SELECT id FROM purchase_orders WHERE id = ? AND user_id = ?', [orderId, userId])
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'not_found' })
        }

        if (!req.file) {
            return res.status(400).json({ error: 'no_file', message: 'No file uploaded' })
        }

        const receiptUrl = `/uploads/receipts/${req.file.filename}`
        await query('UPDATE purchase_orders SET receipt_url = ? WHERE id = ?', [receiptUrl, orderId])

        res.json({ order_id: orderId, receipt_url: receiptUrl, message: 'Receipt uploaded' })
    } catch (e) {
        console.error('Error uploading receipt:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Get my orders
router.get('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id
        const r = await query(`
      SELECT o.id, o.order_code, o.quantity, o.duration_months, o.unit_price, o.total_price, 
             o.status, o.created_at, o.paid_at, o.receipt_url,
             a.id as app_id, a.code as app_code, a.name as app_name
      FROM purchase_orders o
      JOIN apps a ON a.id = o.app_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [userId])
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting orders:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Admin: Manage Orders
// =====================
router.get('/admin/orders', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query
        let sql = `
      SELECT o.*, 
             a.code as app_code, a.name as app_name,
             u.email as user_email, u.full_name as user_name
      FROM purchase_orders o
      JOIN apps a ON a.id = o.app_id
      JOIN users u ON u.id = o.user_id
    `
        const params = []

        if (status) {
            sql += ' WHERE o.status = ?'
            params.push(status)
        }

        sql += ' ORDER BY o.created_at DESC'

        const r = await query(sql, params)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting admin orders:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Approve order and create license
router.post('/admin/orders/:id/approve', requireAdmin, async (req, res) => {
    try {
        const orderId = Number(req.params.id)
        const adminId = req.user.id

        // Get order details
        const orderRes = await query('SELECT * FROM purchase_orders WHERE id = ?', [orderId])
        if (orderRes.rows.length === 0) {
            return res.status(404).json({ error: 'not_found' })
        }

        const order = orderRes.rows[0]
        if (order.status !== 'pending') {
            return res.status(400).json({ error: 'invalid_status', message: 'Order is not pending' })
        }

        // Generate license key
        const genKey = () => {
            const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase()
            return `${seg()}-${seg()}-${seg()}-${seg()}`
        }

        // Calculate expires_at - format for MySQL
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + order.duration_months)
        const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ')

        // Create license(s) and collect license keys
        const createdLicenses = []
        for (let i = 0; i < order.quantity; i++) {
            const licenseKey = genKey()
            await query(
                `INSERT INTO licenses (user_id, app_id, license_key, max_devices, expires_at, status, created_at)
         VALUES (?, ?, ?, 1, ?, 'active', NOW())`,
                [order.user_id, order.app_id, licenseKey, expiresAtStr]
            )
            createdLicenses.push(licenseKey)
        }

        // Update order status
        await query(
            `UPDATE purchase_orders SET status = 'paid', paid_at = NOW(), processed_by_admin_id = ? WHERE id = ?`,
            [adminId, orderId]
        )

        // Send email notification to user (non-blocking, separate try-catch)
        try {
            const orderInfo = await query(`
                SELECT po.order_code, po.quantity, po.duration_months,
                       a.name as app_name, u.email as user_email, u.full_name as user_name
                FROM purchase_orders po
                LEFT JOIN apps a ON po.app_id = a.id
                LEFT JOIN users u ON po.user_id = u.id
                WHERE po.id = ?
            `, [orderId])

            if (orderInfo.rows.length > 0) {
                const emailData = {
                    ...orderInfo.rows[0],
                    license_keys: createdLicenses,
                    expires_at: expiresAtStr
                }
                sendOrderStatusEmail(emailData, 'approved').catch(e => console.error('Email error:', e))
            }
        } catch (emailErr) {
            console.error('Failed to send email notification:', emailErr)
        }

        res.json({ order_id: orderId, approved: true, licenses_created: order.quantity })
    } catch (e) {
        console.error('Error approving order:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Reject order
router.post('/admin/orders/:id/reject', requireAdmin, async (req, res) => {
    try {
        const orderId = Number(req.params.id)
        const adminId = req.user.id
        const { notes } = req.body

        await query(
            `UPDATE purchase_orders SET status = 'cancelled', processed_by_admin_id = ?, notes = ? WHERE id = ?`,
            [adminId, notes || null, orderId]
        )

        // Send email notification to user (non-blocking, separate try-catch)
        try {
            const orderInfo = await query(`
                SELECT po.order_code, po.quantity, po.duration_months, po.total_price,
                       a.name as app_name, u.email as user_email, u.full_name as user_name
                FROM purchase_orders po
                LEFT JOIN apps a ON po.app_id = a.id
                LEFT JOIN users u ON po.user_id = u.id
                WHERE po.id = ?
            `, [orderId])

            if (orderInfo.rows.length > 0) {
                const orderWithNote = { ...orderInfo.rows[0], admin_note: notes }
                sendOrderStatusEmail(orderWithNote, 'rejected').catch(e => console.error('Email error:', e))
            }
        } catch (emailErr) {
            console.error('Failed to send email notification:', emailErr)
        }

        res.json({ order_id: orderId, rejected: true })
    } catch (e) {
        console.error('Error rejecting order:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// Delete order (and receipt file if exists)
router.delete('/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
        const orderId = Number(req.params.id)

        // Get order to check receipt_url
        const orderRes = await query('SELECT id, receipt_url FROM purchase_orders WHERE id = ?', [orderId])
        if (orderRes.rows.length === 0) {
            return res.status(404).json({ error: 'not_found', message: 'Order not found' })
        }

        const order = orderRes.rows[0]

        // Delete receipt file if exists
        if (order.receipt_url) {
            const filePath = path.join(process.cwd(), order.receipt_url)
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
                console.log(`🗑️ Deleted receipt file: ${filePath}`)
            }
        }

        // Delete order from database
        await query('DELETE FROM purchase_orders WHERE id = ?', [orderId])

        console.log(`🗑️ Deleted order #${orderId}`)
        res.json({ order_id: orderId, deleted: true })
    } catch (e) {
        console.error('Error deleting order:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Admin: Manage App Pricing
// =====================
router.get('/admin/pricing', requireAdmin, async (req, res) => {
    try {
        const r = await query(`
      SELECT a.id as app_id, a.code, a.name, a.is_active,
             p.id, p.description, p.price_1_month, p.price_6_months, p.price_1_year,
             p.is_featured, p.badge, p.icon_class
      FROM apps a
      LEFT JOIN app_pricing p ON p.app_id = a.id
      ORDER BY a.name ASC
    `)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting pricing:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

router.post('/admin/pricing', requireAdmin, async (req, res) => {
    try {
        const {
            app_id, description,
            price_1_month, price_1_month_enabled,
            price_6_months, price_6_months_enabled,
            price_1_year, price_1_year_enabled,
            is_featured, badge, icon_class
        } = req.body

        // Convert undefined to null/defaults
        const desc = description ?? null
        const p1m = price_1_month ?? null
        const p1mEnabled = price_1_month_enabled !== false
        const p6m = price_6_months ?? null
        const p6mEnabled = price_6_months_enabled !== false
        const p1y = price_1_year ?? null
        const p1yEnabled = price_1_year_enabled !== false
        const featured = is_featured ?? false
        const badgeVal = badge ?? null
        const iconVal = icon_class ?? null

        // Check if pricing already exists
        const existing = await query('SELECT id FROM app_pricing WHERE app_id = ?', [app_id])

        if (existing.rows.length > 0) {
            // Update existing
            await query(
                `UPDATE app_pricing SET description = ?, 
                 price_1_month = ?, price_1_month_enabled = ?,
                 price_6_months = ?, price_6_months_enabled = ?,
                 price_1_year = ?, price_1_year_enabled = ?,
                 is_featured = ?, badge = ?, icon_class = ?, updated_at = NOW()
                 WHERE app_id = ?`,
                [desc, p1m, p1mEnabled, p6m, p6mEnabled, p1y, p1yEnabled, featured, badgeVal, iconVal, app_id]
            )
            res.json({ app_id, updated: true })
        } else {
            // Insert new
            await query(
                `INSERT INTO app_pricing (app_id, description, price_1_month, price_1_month_enabled, price_6_months, price_6_months_enabled, price_1_year, price_1_year_enabled, is_featured, badge, icon_class, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [app_id, desc, p1m, p1mEnabled, p6m, p6mEnabled, p1y, p1yEnabled, featured, badgeVal, iconVal]
            )
            const r = await query('SELECT LAST_INSERT_ID() as id')
            res.json({ id: r.rows[0].id, app_id, created: true })
        }
    } catch (e) {
        console.error('Error saving pricing:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

export default router
