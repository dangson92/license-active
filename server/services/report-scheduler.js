/**
 * Weekly System Report Scheduler
 * Runs every Monday at 08:00 AM UTC+7 (01:00 UTC) to send the weekly
 * system summary email. Mirrors license-scheduler.js structure.
 */

import { sendWeeklyReport } from './email.js'

// Track last run date to avoid double-sending on a single tick
let lastRunDate = null

/**
 * Send the weekly report. Wrapped in try/catch so an unconfigured SMTP
 * or a send failure logs and returns — never crashes the process or
 * stops the interval (REPORT-05).
 */
export const runWeeklyReport = async () => {
    try {
        const today = new Date().toISOString().split('T')[0]

        // Avoid running multiple times on the same day
        if (lastRunDate === today) {
            console.log('📅 Weekly report already ran today, skipping...')
            return
        }

        console.log('📨 Running weekly system report...')

        const result = await sendWeeklyReport()
        lastRunDate = today

        console.log(`✅ Weekly report sent to ${result.to}`)

        return result
    } catch (e) {
        // REPORT-05: SMTP unconfigured or send failed -> log + return, NEVER throw/crash
        console.error('❌ Error sending weekly report:', e)
        return
    }
}

/**
 * Calculate milliseconds until the next Monday 08:00 AM UTC+7 (01:00 UTC)
 */
const getMillisecondsUntilNextRun = () => {
    const now = new Date()

    // Target time: 08:00 AM UTC+7 = 01:00 UTC
    const targetHourUTC = 1

    const nextRun = new Date(now)
    nextRun.setUTCHours(targetHourUTC, 0, 0, 0)

    // Advance to the next Monday (getUTCDay(): 0=Sun, 1=Mon). If today is
    // Monday but we're already past 01:00 UTC, go to next Monday (+7).
    const day = nextRun.getUTCDay()
    let addDays = (1 - day + 7) % 7
    if (addDays === 0 && now >= nextRun) addDays = 7
    nextRun.setUTCDate(nextRun.getUTCDate() + addDays)

    const msUntilNextRun = nextRun.getTime() - now.getTime()

    console.log(`⏰ Next weekly report scheduled for: ${nextRun.toISOString()} (in ${Math.round(msUntilNextRun / 1000 / 60)} minutes)`)

    return msUntilNextRun
}

/**
 * Schedule the first run, then a weekly interval
 */
const scheduleNextRun = () => {
    const msUntilNextRun = getMillisecondsUntilNextRun()

    setTimeout(async () => {
        await runWeeklyReport()
        // Schedule the next week's report (7 days from now)
        setInterval(runWeeklyReport, 7 * 24 * 60 * 60 * 1000)
    }, msUntilNextRun)
}

/**
 * Initialize the scheduler
 */
export const initReportScheduler = () => {
    console.log('🗓️ Initializing weekly report scheduler...')
    console.log('   - Send time: Monday 08:00 UTC+7 (01:00 UTC)')

    scheduleNextRun()

    console.log('✅ Weekly report scheduler initialized')
}

export default { initReportScheduler, runWeeklyReport }
