/**
 * License Expiring Scheduler
 * Runs daily at 10:00 AM UTC+7 to check for licenses expiring in 15 days
 * Creates notifications for users with expiring licenses
 */

import { query } from '../db.js'
import { createNotification } from '../modules/notifications.js'

// Track last check date to avoid duplicate notifications
let lastCheckDate = null

/**
 * Check for licenses expiring in 15 days and notify users
 */
export const checkExpiringLicenses = async () => {
    try {
        const today = new Date().toISOString().split('T')[0]

        // Avoid running multiple times on the same day
        if (lastCheckDate === today) {
            console.log('📅 License check already ran today, skipping...')
            return
        }

        console.log('🔍 Checking for expiring licenses (15 days)...')

        // Find licenses expiring in 15 days that haven't been notified
        // Using BETWEEN to get licenses expiring in exactly 15 days from now
        const result = await query(`
            SELECT l.id, l.license_key, l.expires_at, l.user_id,
                   a.name as app_name, u.email as user_email, u.full_name as user_name
            FROM licenses l
            JOIN apps a ON a.id = l.app_id
            JOIN users u ON u.id = l.user_id
            WHERE l.status = 'active'
              AND l.expires_at IS NOT NULL
              AND DATE(l.expires_at) = DATE_ADD(CURDATE(), INTERVAL 15 DAY)
              AND l.id NOT IN (
                  SELECT DISTINCT SUBSTRING_INDEX(link, '/', -1) as license_id
                  FROM notifications 
                  WHERE type = 'license_expiring' 
                    AND link LIKE '/my-licenses/%'
                    AND created_at > DATE_SUB(NOW(), INTERVAL 20 DAY)
              )
        `)

        const expiringLicenses = result.rows || []
        console.log(`📋 Found ${expiringLicenses.length} licenses expiring in 15 days`)

        // Create notifications for each expiring license
        for (const license of expiringLicenses) {
            const expiresDate = new Date(license.expires_at).toLocaleDateString('vi-VN')

            await createNotification({
                type: 'license_expiring',
                title: 'License sắp hết hạn',
                message: `License ${license.app_name} của bạn sẽ hết hạn vào ngày ${expiresDate}. Vui lòng gia hạn để tiếp tục sử dụng.`,
                link: `/my-licenses/${license.id}`,
                userId: license.user_id
            })

            console.log(`📤 Sent expiring notification to user ${license.user_id} for license ${license.id}`)
        }

        lastCheckDate = today
        console.log(`✅ License expiring check completed. Notified ${expiringLicenses.length} users.`)

        return expiringLicenses.length
    } catch (e) {
        console.error('❌ Error checking expiring licenses:', e)
        return 0
    }
}

/**
 * Calculate milliseconds until 10:00 AM UTC+7 (3:00 AM UTC)
 */
const getMillisecondsUntilNextRun = () => {
    const now = new Date()

    // Target time: 10:00 AM UTC+7 = 03:00 UTC
    const targetHourUTC = 3
    const targetMinute = 0

    const nextRun = new Date(now)
    nextRun.setUTCHours(targetHourUTC, targetMinute, 0, 0)

    // If we're past today's target time, schedule for tomorrow
    if (now >= nextRun) {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1)
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime()

    console.log(`⏰ Next license check scheduled for: ${nextRun.toISOString()} (in ${Math.round(msUntilNextRun / 1000 / 60)} minutes)`)

    return msUntilNextRun
}

/**
 * Schedule the daily check
 */
const scheduleNextCheck = () => {
    const msUntilNextRun = getMillisecondsUntilNextRun()

    setTimeout(async () => {
        await checkExpiringLicenses()
        // Schedule the next day's check (24 hours from now)
        setInterval(checkExpiringLicenses, 24 * 60 * 60 * 1000)
    }, msUntilNextRun)
}

/**
 * Initialize the scheduler
 */
export const initLicenseScheduler = () => {
    console.log('🗓️ Initializing license expiring scheduler...')
    console.log('   - Check time: 10:00 AM UTC+7 daily')
    console.log('   - Warning period: 15 days before expiry')

    scheduleNextCheck()

    console.log('✅ License expiring scheduler initialized')
}

export default { initLicenseScheduler, checkExpiringLicenses }
