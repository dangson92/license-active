import nodemailer from 'nodemailer'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    sendOrderStatusEmail
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
