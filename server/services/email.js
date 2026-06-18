import nodemailer from 'nodemailer'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_WEEKLY_REPORT_EMAIL = 'dangson.1011@gmail.com'

/**
 * Get all settings from database as key-value object
 */
export async function getSettings() {
    const result = await query('SELECT setting_key, setting_value FROM settings')
    const settings = {}
    for (const row of result.rows) {
        settings[row.setting_key] = row.setting_value
    }
    return settings
}

/**
 * Get SMTP configuration from database
 */
export async function getSmtpConfig() {
    const settings = await getSettings()
    return {
        host: settings.smtp_host || '',
        port: parseInt(settings.smtp_port) || 587,
        secure: settings.smtp_secure === 'true',
        auth: {
            user: settings.smtp_user || '',
            pass: settings.smtp_pass || ''
        },
        from: settings.smtp_from || settings.smtp_user || ''
    }
}

/**
 * Create nodemailer transporter from database settings
 */
async function createTransporter() {
    const config = await getSmtpConfig()

    if (!config.host || !config.auth.user || !config.auth.pass) {
        throw new Error('SMTP not configured. Please configure SMTP settings.')
    }

    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth
    })
}

/**
 * Generate a random verification token
 */
export function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex')
}

/**
 * Load and process email template
 */
function loadTemplate(templateName, variables) {
    const templatePath = path.join(__dirname, '../templates', `${templateName}.html`)

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
        // Return simple fallback template
        return `
      <h2>Xác thực email</h2>
      <p>Xin chào ${variables.USER_NAME || ''},</p>
      <p>Vui lòng click vào link sau để xác thực email:</p>
      <p><a href="${variables.VERIFY_URL}">${variables.VERIFY_URL}</a></p>
      <p>Link sẽ hết hạn sau 24 giờ.</p>
    `
    }

    let template = fs.readFileSync(templatePath, 'utf-8')

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
        template = template.replace(new RegExp(`{{${key}}}`, 'g'), value || '')
    }

    return template
}

/**
 * Send verification email to user
 */
export async function sendVerificationEmail(to, userName, token) {
    const settings = await getSettings()
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.phanmemauto.com'
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`

    const html = loadTemplate('verification-email', {
        APP_NAME: settings.app_name || 'Phanmemauto.com',
        USER_NAME: userName,
        VERIFY_URL: verifyUrl
    })

    const transporter = await createTransporter()
    const config = await getSmtpConfig()

    await transporter.sendMail({
        from: config.from,
        to: to,
        subject: `[${settings.app_name || 'Phanmemauto.com'}] Xác thực địa chỉ email`,
        html: html
    })

    return true
}

/**
 * Send test email to verify SMTP configuration
 */
export async function sendTestEmail(to) {
    const settings = await getSettings()
    const transporter = await createTransporter()
    const config = await getSmtpConfig()

    await transporter.sendMail({
        from: config.from,
        to: to,
        subject: `[${settings.app_name || 'Phanmemauto.com'}] Test Email`,
        html: `
      <h2>Test Email</h2>
      <p>Cấu hình SMTP hoạt động tốt!</p>
      <p>Email này được gửi từ hệ thống ${settings.app_name || 'Phanmemauto.com'}.</p>
      <hr>
      <p><small>SMTP Host: ${config.host}:${config.port}</small></p>
    `
    })

    return true
}

export default {
    getSettings,
    getSmtpConfig,
    generateVerificationToken,
    sendVerificationEmail,
    sendTestEmail,
    sendNewOrderNotification,
    sendOrderStatusEmail,
    getWeeklyReportData,
    sendWeeklyReport
}

/**
 * Format currency in Vietnamese format
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}

/**
 * Send notification to admin when new order is created
 */
export async function sendNewOrderNotification(order) {
    const settings = await getSettings()
    const adminEmail = settings.order_notification_email

    if (!adminEmail) {
        console.log('No order notification email configured, skipping email')
        return false
    }

    try {
        const transporter = await createTransporter()
        const config = await getSmtpConfig()

        await transporter.sendMail({
            from: config.from,
            to: adminEmail,
            subject: `[${settings.app_name || 'Phanmemauto.com'}] Đơn hàng mới #${order.order_code}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">🛒 Đơn hàng mới</h2>
                    <p>Có đơn hàng mới cần xử lý:</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background: #f3f4f6;">
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Mã đơn hàng</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.order_code}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Khách hàng</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.user_email} (${order.user_name})</td>
                        </tr>
                        <tr style="background: #f3f4f6;">
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Ứng dụng</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.app_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Số lượng thiết bị</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.quantity}</td>
                        </tr>
                        <tr style="background: #f3f4f6;">
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Thời hạn</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.duration_months} tháng</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Tổng tiền</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; color: #2563eb; font-weight: bold;">${formatCurrency(order.total_price)}</td>
                        </tr>
                    </table>
                    
                    <p>Vui lòng đăng nhập vào hệ thống để duyệt đơn hàng.</p>
                    
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">Email được gửi tự động từ hệ thống ${settings.app_name || 'Phanmemauto.com'}</p>
                </div>
            `
        })

        return true
    } catch (e) {
        console.error('Failed to send order notification email:', e)
        return false
    }
}

/**
 * Send email to user when order status changes
 */
export async function sendOrderStatusEmail(order, newStatus) {
    const settings = await getSettings()

    if (!order.user_email) {
        console.log('No user email found, skipping status email')
        return false
    }

    try {
        const transporter = await createTransporter()
        const config = await getSmtpConfig()

        const statusMessages = {
            approved: {
                title: '✅ Đơn hàng đã được duyệt',
                message: 'Đơn hàng của bạn đã được duyệt thành công! License đã được kích hoạt.',
                color: '#10b981'
            },
            rejected: {
                title: '❌ Đơn hàng bị từ chối',
                message: order.admin_note ? `Đơn hàng của bạn đã bị từ chối. Lý do: ${order.admin_note}` : 'Đơn hàng của bạn đã bị từ chối. Vui lòng liên hệ admin để biết thêm chi tiết.',
                color: '#ef4444'
            }
        }

        const statusInfo = statusMessages[newStatus]
        if (!statusInfo) {
            console.log('Unknown status, skipping email')
            return false
        }

        const frontendUrl = process.env.FRONTEND_URL || 'https://app.phanmemauto.com'

        // Format expires date for display
        const formatDate = (dateStr) => {
            if (!dateStr) return ''
            const d = new Date(dateStr)
            return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        }

        // Build license keys HTML — each entry can be {key, app_name} or a plain string (legacy)
        const licenseKeysHtml = order.license_keys && order.license_keys.length > 0
            ? order.license_keys.map((entry, i) => {
                const licKey = typeof entry === 'object' ? entry.key : entry
                const appLabel = typeof entry === 'object' && entry.app_name ? entry.app_name : `License ${i + 1}`
                return `
                <tr style="background: ${i % 2 === 0 ? '#f0fdf4' : '#ffffff'};">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">${appLabel}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-family: monospace; font-weight: bold; color: #059669;">${licKey}</td>
                </tr>
            `}).join('')
            : ''

        await transporter.sendMail({
            from: config.from,
            to: order.user_email,
            subject: `[${settings.app_name || 'Phanmemauto.com'}] ${statusInfo.title} - #${order.order_code}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${statusInfo.color};">${statusInfo.title}</h2>
                    <p>Xin chào ${order.user_name || 'bạn'},</p>
                    <p>${statusInfo.message}</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background: #f3f4f6;">
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Mã đơn hàng</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.order_code}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Ứng dụng</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.app_name}</td>
                        </tr>
                        <tr style="background: #f3f4f6;">
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Số lượng thiết bị</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.quantity}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Thời hạn</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.duration_months} tháng</td>
                        </tr>
                        ${newStatus === 'approved' && order.expires_at ? `
                        <tr style="background: #f3f4f6;">
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Ngày hết hạn</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">${formatDate(order.expires_at)}</td>
                        </tr>
                        ` : ''}
                        ${licenseKeysHtml}
                    </table>
                    
                    ${newStatus === 'approved' ? `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <p style="color: #166534; margin: 0 0 10px 0; font-weight: bold;">🎉 License đã được kích hoạt!</p>
                        <p style="color: #166534; margin: 0;">Đăng nhập ngay để quản lý và sử dụng license của bạn.</p>
                        <a href="${frontendUrl}" style="display: inline-block; margin-top: 12px; padding: 10px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Đăng nhập ngay</a>
                    </div>
                    ` : ''}
                    
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">Email được gửi tự động từ hệ thống ${settings.app_name || 'Phanmemauto.com'}</p>
                </div>
            `
        })

        return true
    } catch (e) {
        console.error('Failed to send order status email:', e)
        return false
    }
}

/**
 * Gather weekly system report metrics over the last 7 days.
 * Each section is wrapped in its own try/catch so one failing query
 * defaults that section to zeros/empty and logs, rather than aborting
 * the whole report. mysql2 returns SUM()/COUNT()/DECIMAL columns as
 * strings, so every numeric field is coerced with Number(...).
 */
export async function getWeeklyReportData() {
    const to = new Date()
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)

    let accounts = { total: 0, newThisWeek: 0, activeThisWeek: 0, admins: 0 }
    try {
        const result = await query(`
            SELECT
                COUNT(*) AS total,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_this_week,
                SUM(last_login_at IS NOT NULL AND last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS active_this_week,
                SUM(role = 'admin') AS admins
            FROM users
        `)
        const row = result.rows[0] || {}
        accounts = {
            total: Number(row.total) || 0,
            newThisWeek: Number(row.new_this_week) || 0,
            activeThisWeek: Number(row.active_this_week) || 0,
            admins: Number(row.admins) || 0
        }
    } catch (e) {
        console.error('Weekly report accounts query error:', e)
    }

    let software = { appsTotal: 0, appsActive: 0, versions: 0, packages: 0 }
    try {
        const result = await query(`
            SELECT
                (SELECT COUNT(*) FROM apps) AS apps_total,
                (SELECT COUNT(*) FROM apps WHERE is_active = TRUE) AS apps_active,
                (SELECT COUNT(*) FROM app_versions) AS versions,
                (SELECT COUNT(*) FROM packages) AS packages
        `)
        const row = result.rows[0] || {}
        software = {
            appsTotal: Number(row.apps_total) || 0,
            appsActive: Number(row.apps_active) || 0,
            versions: Number(row.versions) || 0,
            packages: Number(row.packages) || 0
        }
    } catch (e) {
        console.error('Weekly report software query error:', e)
    }

    let licenses = { activeLicenses: 0, activeTrials: 0, newThisWeek: 0, newTrialsThisWeek: 0, expiringSoon: 0 }
    try {
        const result = await query(`
            SELECT
                SUM(status = 'active') AS active_licenses,
                SUM(is_trial = TRUE AND status = 'active') AS active_trials,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_this_week,
                SUM(is_trial = TRUE AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_trials_this_week,
                SUM(status = 'active' AND expires_at IS NOT NULL
                    AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)) AS expiring_soon
            FROM licenses
        `)
        const row = result.rows[0] || {}
        licenses = {
            activeLicenses: Number(row.active_licenses) || 0,
            activeTrials: Number(row.active_trials) || 0,
            newThisWeek: Number(row.new_this_week) || 0,
            newTrialsThisWeek: Number(row.new_trials_this_week) || 0,
            expiringSoon: Number(row.expiring_soon) || 0
        }
    } catch (e) {
        console.error('Weekly report licenses query error:', e)
    }

    let revenue = {
        weeklyPaidTotal: 0,
        weeklyPaidCount: 0,
        allTimePaidTotal: 0,
        newOrdersThisWeek: 0,
        pendingOrders: 0,
        topApps: []
    }
    try {
        const result = await query(`
            SELECT
                COALESCE(SUM(CASE WHEN status = 'paid' AND paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN total_price ELSE 0 END), 0) AS weekly_paid_total,
                SUM(status = 'paid' AND paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS weekly_paid_count,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN total_price ELSE 0 END), 0) AS all_time_paid_total,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_orders_this_week,
                SUM(status = 'pending') AS pending_orders
            FROM purchase_orders
        `)
        const row = result.rows[0] || {}
        revenue.weeklyPaidTotal = Number(row.weekly_paid_total) || 0
        revenue.weeklyPaidCount = Number(row.weekly_paid_count) || 0
        revenue.allTimePaidTotal = Number(row.all_time_paid_total) || 0
        revenue.newOrdersThisWeek = Number(row.new_orders_this_week) || 0
        revenue.pendingOrders = Number(row.pending_orders) || 0
    } catch (e) {
        console.error('Weekly report revenue query error:', e)
    }

    try {
        const result = await query(`
            SELECT COALESCE(a.name, pk.name, '(Khác)') AS name,
                   COALESCE(SUM(po.total_price), 0) AS revenue
            FROM purchase_orders po
            LEFT JOIN apps a ON a.id = po.app_id
            LEFT JOIN packages pk ON pk.id = po.package_id
            WHERE po.status = 'paid' AND po.paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY name
            ORDER BY revenue DESC
            LIMIT 5
        `)
        revenue.topApps = (result.rows || []).map(row => ({
            name: row.name,
            revenue: Number(row.revenue) || 0
        }))
    } catch (e) {
        console.error('Weekly report top apps query error:', e)
        revenue.topApps = []
    }

    let support = { openTickets: 0, newThisWeek: 0 }
    try {
        const result = await query(`
            SELECT
                SUM(status IN ('pending','in_progress')) AS open_tickets,
                SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_this_week
            FROM support_tickets
        `)
        const row = result.rows[0] || {}
        support = {
            openTickets: Number(row.open_tickets) || 0,
            newThisWeek: Number(row.new_this_week) || 0
        }
    } catch (e) {
        console.error('Weekly report support query error:', e)
    }

    return {
        period: { from, to },
        accounts,
        software,
        licenses,
        revenue,
        support
    }
}

/**
 * Build and send the weekly system report email.
 * Recipient resolves: to arg -> WEEKLY_REPORT_EMAIL env -> weekly_report_email
 * setting -> default constant. createTransporter() is allowed to throw if SMTP
 * is unconfigured (callers wrap this — REPORT-05). Returns { success, to, data }.
 */
export async function sendWeeklyReport(to = null) {
    const data = await getWeeklyReportData()
    const settings = await getSettings()

    const recipient = to || process.env.WEEKLY_REPORT_EMAIL || settings.weekly_report_email || DEFAULT_WEEKLY_REPORT_EMAIL

    const transporter = await createTransporter()
    const config = await getSmtpConfig()

    const formatDate = (date) => {
        const d = new Date(date)
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    const period = `${formatDate(data.period.from)} - ${formatDate(data.period.to)}`

    const row = (label, value, alt) => `
                        <tr${alt ? ' style="background: #f3f4f6;"' : ''}>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">${label}</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${value}</td>
                        </tr>
    `

    const topAppsRows = data.revenue.topApps.length > 0
        ? data.revenue.topApps.map((app, i) => `
                        <tr${i % 2 === 0 ? ' style="background: #f3f4f6;"' : ''}>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${app.name}</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; color: #2563eb; font-weight: bold;">${formatCurrency(app.revenue)}</td>
                        </tr>
        `).join('')
        : `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;" colspan="2">Không có doanh thu trong tuần</td>
                        </tr>
        `

    const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">📊 Báo cáo hệ thống tuần</h2>
                    <p>Kỳ báo cáo: <strong>${period}</strong></p>

                    <h3 style="color: #111827; margin-top: 24px;">👥 Tài khoản</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
                        ${row('Tổng tài khoản', data.accounts.total, true)}
                        ${row('Tài khoản mới (7 ngày)', data.accounts.newThisWeek)}
                        ${row('Hoạt động (7 ngày)', data.accounts.activeThisWeek, true)}
                        ${row('Quản trị viên', data.accounts.admins)}
                    </table>

                    <h3 style="color: #111827; margin-top: 24px;">💻 Phần mềm</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
                        ${row('Tổng ứng dụng', data.software.appsTotal, true)}
                        ${row('Ứng dụng đang bật', data.software.appsActive)}
                        ${row('Phiên bản', data.software.versions, true)}
                        ${row('Gói (packages)', data.software.packages)}
                    </table>

                    <h3 style="color: #111827; margin-top: 24px;">🔑 License & dùng thử</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
                        ${row('License đang hoạt động', data.licenses.activeLicenses, true)}
                        ${row('Dùng thử đang hoạt động', data.licenses.activeTrials)}
                        ${row('License mới (7 ngày)', data.licenses.newThisWeek, true)}
                        ${row('Dùng thử mới (7 ngày)', data.licenses.newTrialsThisWeek)}
                        ${row('Sắp hết hạn (7 ngày)', data.licenses.expiringSoon, true)}
                    </table>

                    <h3 style="color: #111827; margin-top: 24px;">💰 Doanh thu (7 ngày)</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
                        ${row('Doanh thu tuần', formatCurrency(data.revenue.weeklyPaidTotal), true)}
                        ${row('Đơn đã thanh toán (tuần)', data.revenue.weeklyPaidCount)}
                        ${row('Doanh thu toàn thời gian', formatCurrency(data.revenue.allTimePaidTotal), true)}
                        ${row('Đơn hàng mới (tuần)', data.revenue.newOrdersThisWeek)}
                        ${row('Đơn chờ xử lý', data.revenue.pendingOrders, true)}
                    </table>

                    <h4 style="color: #111827; margin-top: 16px;">🏆 Top sản phẩm theo doanh thu tuần</h4>
                    <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
                        <tr style="background: #e5e7eb;">
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Sản phẩm</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Doanh thu</td>
                        </tr>
                        ${topAppsRows}
                    </table>

                    <h3 style="color: #111827; margin-top: 24px;">🎧 Hỗ trợ</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
                        ${row('Ticket đang mở', data.support.openTickets, true)}
                        ${row('Ticket mới (7 ngày)', data.support.newThisWeek)}
                    </table>

                    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">Email được gửi tự động từ hệ thống ${settings.app_name || 'Phanmemauto.com'}</p>
                </div>
    `

    await transporter.sendMail({
        from: config.from,
        to: recipient,
        subject: `[${settings.app_name || 'Phanmemauto.com'}] Báo cáo hệ thống tuần (${period})`,
        html: html
    })

    return { success: true, to: recipient, data }
}
