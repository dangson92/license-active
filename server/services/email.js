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
    sendTestEmail
}
