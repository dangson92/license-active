import express from 'express'
import { query } from '../db.js'
import { requireAuth, requireAdmin } from './auth.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { sendNewOrderNotification, sendOrderStatusEmail } from '../services/email.js'
import { createNotification } from './notifications.js'

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
             p.price_1_month, p.price_1_month_enabled,
             p.price_6_months, p.price_6_months_enabled,
             p.price_1_year, p.price_1_year_enabled,
             p.is_featured, p.badge, p.icon_class,
             p.trial_enabled
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
// Trial License (User)
// =====================

// Generate GUID-style license key
const genKey = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

router.post('/trial', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id
        const { app_id } = req.body

        if (!app_id) {
            return res.status(400).json({ error: 'validation_error', message: 'app_id is required' })
        }

        // 1. Check app exists and trial is enabled
        const appCheck = await query(`
            SELECT a.id, a.code, a.name, p.trial_enabled
            FROM apps a
            LEFT JOIN app_pricing p ON p.app_id = a.id
            WHERE a.id = ? AND a.is_active = TRUE
        `, [app_id])

        if (!appCheck.rows.length) {
            return res.status(404).json({ error: 'app_not_found' })
        }

        if (!appCheck.rows[0].trial_enabled) {
            return res.status(400).json({ error: 'trial_not_available', message: 'Trial is not available for this app' })
        }

        // 2. Check user hasn't already used trial for this app (permanent, even if expired)
        const existingTrial = await query(
            'SELECT id, status FROM licenses WHERE user_id = ? AND app_id = ? AND is_trial = TRUE',
            [userId, app_id]
        )

        if (existingTrial.rows.length) {
            return res.status(400).json({ error: 'trial_already_used', message: 'You have already used the trial for this app' })
        }

        // 3. Create trial license (7 days, 1 device, no checkout)
        const licenseKey = genKey()
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)
        const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ')

        await query(
            `INSERT INTO licenses (user_id, app_id, license_key, max_devices, expires_at, status, is_trial, created_at)
             VALUES (?, ?, ?, 1, ?, 'active', TRUE, NOW())`,
            [userId, app_id, licenseKey, expiresAtStr]
        )

        console.log(`🎁 Trial license created for user ${userId}, app ${app_id}: ${licenseKey}`)

        res.json({
            license_key: licenseKey,
            expires_at: expiresAtStr,
            is_trial: true,
            message: 'Trial license created successfully'
        })
    } catch (e) {
        console.error('Error creating trial:', e)
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

// Create purchase order (with receipt - single atomic request)
// Supports both single-app orders (app_id) and package orders (package_id)
router.post('/orders', requireAuth, upload.single('receipt'), async (req, res) => {
    try {
        const userId = req.user.id
        const { app_id, package_id, quantity, duration_months, unit_price } = req.body

        // Validate: must have exactly one of app_id or package_id
        const hasApp = !!app_id
        const hasPkg = !!package_id
        if (!hasApp && !hasPkg) {
            return res.status(400).json({ error: 'validation_error', message: 'Either app_id or package_id is required' })
        }
        if (hasApp && hasPkg) {
            return res.status(400).json({ error: 'validation_error', message: 'Cannot specify both app_id and package_id' })
        }
        if (!duration_months || !unit_price) {
            return res.status(400).json({ error: 'validation_error', message: 'duration_months and unit_price are required' })
        }
        if (!req.file) {
            return res.status(400).json({ error: 'validation_error', message: 'Receipt image is required' })
        }

        // Verify package exists and is active (if package order)
        let itemName = ''
        if (hasPkg) {
            const pkgCheck = await query('SELECT id, name FROM packages WHERE id = ? AND is_active = TRUE', [package_id])
            if (!pkgCheck.rows.length) {
                return res.status(404).json({ error: 'package_not_found', message: 'Package not found or inactive' })
            }
            itemName = pkgCheck.rows[0].name
        }

        const orderCode = generateOrderCode()
        const totalPrice = unit_price * (quantity || 1)
        const receiptUrl = `/uploads/receipts/${req.file.filename}`

        await query(
            `INSERT INTO purchase_orders (user_id, app_id, package_id, order_code, quantity, duration_months, unit_price, total_price, receipt_url, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [userId, app_id || null, package_id || null, orderCode, quantity || 1, duration_months, unit_price, totalPrice, receiptUrl]
        )
        const r = await query('SELECT LAST_INSERT_ID() as id')
        const orderId = r.rows[0].id

        // Send email notification to admin (non-blocking)
        const orderInfo = await query(`
            SELECT po.*,
                   a.name as app_name,
                   pk.name as package_name,
                   u.email as user_email, u.full_name as user_name
            FROM purchase_orders po
            LEFT JOIN apps a ON po.app_id = a.id
            LEFT JOIN packages pk ON po.package_id = pk.id
            LEFT JOIN users u ON po.user_id = u.id
            WHERE po.id = ?
        `, [orderId])

        if (orderInfo.rows.length > 0) {
            const order = orderInfo.rows[0]
            const displayName = order.package_name || order.app_name || itemName
            sendNewOrderNotification({ ...order, app_name: displayName }).catch(e => console.error('Email error:', e))

            createNotification({
                type: 'new_order',
                title: 'Đơn hàng mới',
                message: `${order.user_name || order.user_email} đã đặt mua ${displayName} - ${new Intl.NumberFormat('vi-VN').format(totalPrice)}đ`,
                link: '/admin/orders'
            })
        }

        res.json({
            id: orderId,
            order_code: orderCode,
            total_price: totalPrice,
            receipt_url: receiptUrl,
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
             pk.name as package_name, pk.code as package_code,
             u.email as user_email, u.full_name as user_name
      FROM purchase_orders o
      LEFT JOIN apps a ON a.id = o.app_id
      LEFT JOIN packages pk ON pk.id = o.package_id
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

// Approve order and create license(s)
// For package orders: creates one license per app in the package × quantity
router.post('/admin/orders/:id/approve', requireAdmin, async (req, res) => {
    try {
        const orderId = Number(req.params.id)
        const adminId = req.user.id

        const orderRes = await query('SELECT * FROM purchase_orders WHERE id = ?', [orderId])
        if (orderRes.rows.length === 0) {
            return res.status(404).json({ error: 'not_found' })
        }

        const order = orderRes.rows[0]
        if (order.status !== 'pending') {
            return res.status(400).json({ error: 'invalid_status', message: 'Order is not pending' })
        }

        const genKey = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            })
        }

        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + order.duration_months)
        const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ')

        const createdLicenses = []

        if (order.package_id) {
            // Package order: create one license per app in the package (× quantity)
            const pkgApps = await query('SELECT app_id FROM package_items WHERE package_id = ?', [order.package_id])
            if (!pkgApps.rows.length) {
                return res.status(400).json({ error: 'package_empty', message: 'Package has no apps' })
            }
            for (let i = 0; i < order.quantity; i++) {
                for (const { app_id } of pkgApps.rows) {
                    const licenseKey = genKey()
                    await query(
                        `INSERT INTO licenses (user_id, app_id, license_key, max_devices, expires_at, status, created_at)
                         VALUES (?, ?, ?, 1, ?, 'active', NOW())`,
                        [order.user_id, app_id, licenseKey, expiresAtStr]
                    )
                    createdLicenses.push(licenseKey)
                }
            }
        } else {
            // Single-app order: original logic
            for (let i = 0; i < order.quantity; i++) {
                const licenseKey = genKey()
                await query(
                    `INSERT INTO licenses (user_id, app_id, license_key, max_devices, expires_at, status, created_at)
                     VALUES (?, ?, ?, 1, ?, 'active', NOW())`,
                    [order.user_id, order.app_id, licenseKey, expiresAtStr]
                )
                createdLicenses.push(licenseKey)
            }
        }

        await query(
            `UPDATE purchase_orders SET status = 'paid', paid_at = NOW(), processed_by_admin_id = ? WHERE id = ?`,
            [adminId, orderId]
        )

        // Email notification (non-blocking)
        try {
            const orderInfo = await query(`
                SELECT po.order_code, po.quantity, po.duration_months,
                       a.name as app_name, pk.name as package_name,
                       u.email as user_email, u.full_name as user_name
                FROM purchase_orders po
                LEFT JOIN apps a ON po.app_id = a.id
                LEFT JOIN packages pk ON po.package_id = pk.id
                LEFT JOIN users u ON po.user_id = u.id
                WHERE po.id = ?
            `, [orderId])

            if (orderInfo.rows.length > 0) {
                const row = orderInfo.rows[0]
                const emailData = {
                    ...row,
                    app_name: row.package_name || row.app_name,
                    license_keys: createdLicenses,
                    expires_at: expiresAtStr
                }
                sendOrderStatusEmail(emailData, 'approved').catch(e => console.error('Email error:', e))
            }
        } catch (emailErr) {
            console.error('Failed to send email notification:', emailErr)
        }

        createNotification({
            type: 'order_approved',
            title: 'Đơn hàng đã được duyệt',
            message: `Đơn hàng #${order.order_code} đã được duyệt. License của bạn đã sẵn sàng!`,
            link: '/my-licenses',
            userId: order.user_id
        })

        res.json({ order_id: orderId, approved: true, licenses_created: createdLicenses.length })
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

        // Get order info to get user_id and order_code
        const orderData = await query('SELECT user_id, order_code FROM purchase_orders WHERE id = ?', [orderId])
        if (orderData.rows.length > 0) {
            const order = orderData.rows[0]
            createNotification({
                type: 'order_rejected',
                title: 'Đơn hàng bị từ chối',
                message: `Đơn hàng #${order.order_code} đã bị từ chối.${notes ? ' Lý do: ' + notes : ''}`,
                link: '/my-orders',
                userId: order.user_id
            })
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
             p.is_featured, p.badge, p.icon_class, p.trial_enabled
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
            is_featured, badge, icon_class,
            trial_enabled
        } = req.body

        // Convert undefined to null/defaults - handle boolean correctly
        const desc = description ?? null
        const p1m = price_1_month ?? null
        const p1mEnabled = price_1_month_enabled === true || price_1_month_enabled === 'true' ? 1 : (price_1_month_enabled === false || price_1_month_enabled === 'false' ? 0 : 1)
        const p6m = price_6_months ?? null
        const p6mEnabled = price_6_months_enabled === true || price_6_months_enabled === 'true' ? 1 : (price_6_months_enabled === false || price_6_months_enabled === 'false' ? 0 : 1)
        const p1y = price_1_year ?? null
        const p1yEnabled = price_1_year_enabled === true || price_1_year_enabled === 'true' ? 1 : (price_1_year_enabled === false || price_1_year_enabled === 'false' ? 0 : 1)
        const featured = is_featured ?? false
        const badgeVal = badge ?? null
        const iconVal = icon_class ?? null
        const trialVal = trial_enabled === true || trial_enabled === 'true' ? 1 : 0

        console.log('Saving pricing:', { app_id, p1mEnabled, p6mEnabled, p1yEnabled, trialVal })

        // Check if pricing already exists
        const existing = await query('SELECT id FROM app_pricing WHERE app_id = ?', [app_id])

        if (existing.rows.length > 0) {
            // Update existing
            await query(
                `UPDATE app_pricing SET description = ?, 
                 price_1_month = ?, price_1_month_enabled = ?,
                 price_6_months = ?, price_6_months_enabled = ?,
                 price_1_year = ?, price_1_year_enabled = ?,
                 is_featured = ?, badge = ?, icon_class = ?, trial_enabled = ?, updated_at = NOW()
                 WHERE app_id = ?`,
                [desc, p1m, p1mEnabled, p6m, p6mEnabled, p1y, p1yEnabled, featured, badgeVal, iconVal, trialVal, app_id]
            )
            res.json({ app_id, updated: true })
        } else {
            // Insert new
            await query(
                `INSERT INTO app_pricing (app_id, description, price_1_month, price_1_month_enabled, price_6_months, price_6_months_enabled, price_1_year, price_1_year_enabled, is_featured, badge, icon_class, trial_enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [app_id, desc, p1m, p1mEnabled, p6m, p6mEnabled, p1y, p1yEnabled, featured, badgeVal, iconVal, trialVal]
            )
            const r = await query('SELECT LAST_INSERT_ID() as id')
            res.json({ id: r.rows[0].id, app_id, created: true })
        }
    } catch (e) {
        console.error('Error saving pricing:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Packages — Public API
// =====================

// GET /store/packages — list all active packages with included app names and sum of individual prices
router.get('/packages', async (req, res) => {
    try {
        const r = await query(`
            SELECT p.*,
                   GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') as included_apps,
                   GROUP_CONCAT(a.id ORDER BY a.name SEPARATOR ',') as included_app_ids,
                   GROUP_CONCAT(a.icon_url ORDER BY a.name SEPARATOR ',') as included_app_icons,
                   COUNT(pi.app_id) as app_count,
                   SUM(ap.price_1_month) as sum_price_1_month,
                   SUM(COALESCE(ap.price_6_months, ap.price_1_month * 6)) as sum_price_6_months,
                   SUM(COALESCE(ap.price_1_year, ap.price_1_month * 12)) as sum_price_1_year
            FROM packages p
            LEFT JOIN package_items pi ON pi.package_id = p.id
            LEFT JOIN apps a ON a.id = pi.app_id
            LEFT JOIN app_pricing ap ON ap.app_id = pi.app_id
            WHERE p.is_active = TRUE
            GROUP BY p.id
            ORDER BY p.is_featured DESC, p.name ASC
        `)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting packages:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// GET /store/packages/:id — single package detail with app list
router.get('/packages/:id', async (req, res) => {
    try {
        const id = Number(req.params.id)
        const pkgRes = await query('SELECT * FROM packages WHERE id = ? AND is_active = TRUE', [id])
        if (!pkgRes.rows.length) return res.status(404).json({ error: 'not_found' })

        const appsRes = await query(`
            SELECT a.id, a.code, a.name, a.icon_url
            FROM package_items pi
            JOIN apps a ON a.id = pi.app_id
            WHERE pi.package_id = ?
            ORDER BY a.name ASC
        `, [id])

        res.json({ ...pkgRes.rows[0], apps: appsRes.rows })
    } catch (e) {
        console.error('Error getting package:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// =====================
// Packages — Admin CRUD
// =====================

// GET /store/admin/packages — list all packages (including inactive) with sum prices for savings calc
router.get('/admin/packages', requireAdmin, async (req, res) => {
    try {
        const r = await query(`
            SELECT p.*,
                   GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') as included_apps,
                   GROUP_CONCAT(a.id ORDER BY a.name SEPARATOR ',') as included_app_ids,
                   GROUP_CONCAT(a.icon_url ORDER BY a.name SEPARATOR ',') as included_app_icons,
                   COUNT(pi.app_id) as app_count,
                   SUM(ap.price_1_month) as sum_price_1_month,
                   SUM(COALESCE(ap.price_6_months, ap.price_1_month * 6)) as sum_price_6_months,
                   SUM(COALESCE(ap.price_1_year, ap.price_1_month * 12)) as sum_price_1_year
            FROM packages p
            LEFT JOIN package_items pi ON pi.package_id = p.id
            LEFT JOIN apps a ON a.id = pi.app_id
            LEFT JOIN app_pricing ap ON ap.app_id = pi.app_id
            GROUP BY p.id
            ORDER BY p.is_featured DESC, p.name ASC
        `)
        res.json({ items: r.rows })
    } catch (e) {
        console.error('Error getting admin packages:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// POST /store/admin/packages — create package
router.post('/admin/packages', requireAdmin, async (req, res) => {
    try {
        const {
            code, name, description, icon_url, is_featured, badge, discount_percent,
            price_1_month, price_1_month_enabled,
            price_6_months, price_6_months_enabled,
            price_1_year, price_1_year_enabled,
            app_ids
        } = req.body

        if (!code || !name) {
            return res.status(400).json({ error: 'validation_error', message: 'code and name are required' })
        }

        const toBool = (v) => v === true || v === 'true' || v === 1 ? 1 : 0

        const r = await query(
            `INSERT INTO packages (code, name, description, icon_url, is_featured, badge, discount_percent,
             price_1_month, price_1_month_enabled,
             price_6_months, price_6_months_enabled,
             price_1_year, price_1_year_enabled, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                code, name, description || null, icon_url || null,
                toBool(is_featured), badge || null, discount_percent || null,
                price_1_month || null, toBool(price_1_month_enabled ?? 1),
                price_6_months || null, toBool(price_6_months_enabled ?? 1),
                price_1_year || null, toBool(price_1_year_enabled ?? 1)
            ]
        )
        const pkgId = (await query('SELECT LAST_INSERT_ID() as id')).rows[0].id

        // Insert app associations
        if (Array.isArray(app_ids) && app_ids.length > 0) {
            for (const appId of app_ids) {
                await query('INSERT IGNORE INTO package_items (package_id, app_id) VALUES (?, ?)', [pkgId, appId])
            }
        }

        console.log(`📦 Package created: ${name} (id=${pkgId})`)
        res.json({ id: pkgId, code, name, created: true })
    } catch (e) {
        console.error('Error creating package:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// PUT /store/admin/packages/:id — update package
router.put('/admin/packages/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        const {
            name, description, icon_url, is_active, is_featured, badge, discount_percent,
            price_1_month, price_1_month_enabled,
            price_6_months, price_6_months_enabled,
            price_1_year, price_1_year_enabled,
            app_ids
        } = req.body

        const toBool = (v) => v === true || v === 'true' || v === 1 ? 1 : 0

        await query(
            `UPDATE packages SET
             name = ?, description = ?, icon_url = ?,
             is_active = ?, is_featured = ?, badge = ?, discount_percent = ?,
             price_1_month = ?, price_1_month_enabled = ?,
             price_6_months = ?, price_6_months_enabled = ?,
             price_1_year = ?, price_1_year_enabled = ?,
             updated_at = NOW()
             WHERE id = ?`,
            [
                name, description || null, icon_url || null,
                toBool(is_active ?? 1), toBool(is_featured), badge || null, discount_percent || null,
                price_1_month || null, toBool(price_1_month_enabled ?? 1),
                price_6_months || null, toBool(price_6_months_enabled ?? 1),
                price_1_year || null, toBool(price_1_year_enabled ?? 1),
                id
            ]
        )

        // Replace app_ids if provided
        if (Array.isArray(app_ids)) {
            await query('DELETE FROM package_items WHERE package_id = ?', [id])
            for (const appId of app_ids) {
                await query('INSERT IGNORE INTO package_items (package_id, app_id) VALUES (?, ?)', [id, appId])
            }
        }

        res.json({ id, updated: true })
    } catch (e) {
        console.error('Error updating package:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

// DELETE /store/admin/packages/:id
router.delete('/admin/packages/:id', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id)
        await query('DELETE FROM packages WHERE id = ?', [id])
        res.json({ id, deleted: true })
    } catch (e) {
        console.error('Error deleting package:', e)
        res.status(500).json({ error: 'server_error', message: e.message })
    }
})

export default router
