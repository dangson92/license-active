// One-shot job runner for hosts where the in-process schedulers are unreliable
// (cPanel/Passenger stops idle processes). Run it HOURLY from cron:
//   cd /home/<user>/<app-root> && /home/<user>/nodevenv/<app-root>/<ver>/bin/node server/cron.js
// It runs whichever jobs are due in the current UTC hour, so the cron line does
// not depend on the server's timezone. Force a job manually for testing:
//   node server/cron.js license | weekly-report
import 'dotenv/config'
import { checkExpiringLicenses } from './services/license-scheduler.js'
import { runWeeklyReport } from './services/report-scheduler.js'

const JOBS = {
  // 10:00 UTC+7 daily = 03:00 UTC
  license: { isDue: (now) => now.getUTCHours() === 3, run: checkExpiringLicenses },
  // Monday 08:00 UTC+7 = Monday 01:00 UTC
  'weekly-report': { isDue: (now) => now.getUTCDay() === 1 && now.getUTCHours() === 1, run: runWeeklyReport },
}

const main = async () => {
  const forced = process.argv[2]
  if (forced && !JOBS[forced]) {
    console.error(`❌ Unknown job "${forced}". Available: ${Object.keys(JOBS).join(', ')}`)
    return 1
  }

  const now = new Date()
  const names = forced ? [forced] : Object.keys(JOBS).filter((name) => JOBS[name].isDue(now))
  if (names.length === 0) {
    console.log(`⏭️ ${now.toISOString()} — no job due this hour`)
    return 0
  }

  for (const name of names) {
    console.log(`▶️ ${now.toISOString()} — running ${name}`)
    await JOBS[name].run()
  }
  return 0
}

// Exit explicitly: the MySQL pool keeps the event loop alive otherwise.
main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('❌ Cron runner failed:', err)
    process.exit(1)
  })
