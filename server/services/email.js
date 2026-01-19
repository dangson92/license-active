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
    const frontendUrl = process.env.FRONTEND_URL || 'https://license.dangthanhson.com'
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`

    const html = loadTemplate('verification-email', {
        APP_NAME: settings.app_name || 'License System',
        USER_NAME: userName,
        VERIFY_URL: verifyUrl
    })

    const transporter = await createTransporter()
    const config = await getSmtpConfig()

    await transporter.sendMail({
        from: config.from,
        to: to,
        subject: `[${settings.app_name || 'License System'}] Xác thực địa chỉ email`,
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
        subject: `[${settings.app_name || 'License System'}] Test Email`,
        html: `
      <h2>Test Email</h2>
      <p>Cấu hình SMTP hoạt động tốt!</p>
      <p>Email này được gửi từ hệ thống ${settings.app_name || 'License System'}.</p>
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
            subject: `[${settings.app_name || 'License System'}] Đơn hàng mới #${order.order_code}`,
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
                    <p style="color: #6b7280; font-size: 12px;">Email được gửi tự động từ hệ thống ${settings.app_name || 'License System'}</p>
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

        await transporter.sendMail({
            from: config.from,
            to: order.user_email,
            subject: `[${settings.app_name || 'License System'}] ${statusInfo.title} - #${order.order_code}`,
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
                        <tr style="background: #f3f4f6;">
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Tổng tiền</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; color: #2563eb; font-weight: bold;">${formatCurrency(order.total_price)}</td>
                        </tr>
                    </table>
                    
                    ${newStatus === 'approved' ? '<p style="color: #10b981;">Bạn có thể đăng nhập vào hệ thống để quản lý license của mình.</p>' : ''}
                    
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">Email được gửi tự động từ hệ thống ${settings.app_name || 'License System'}</p>
                </div>
            `
        })

        return true
    } catch (e) {
        console.error('Failed to send order status email:', e)
        return false
    }
}
