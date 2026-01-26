import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import authRouter from './modules/auth.js'
import userRouter from './modules/user.js'
import adminRouter from './modules/admin.js'
import activateRouter from './modules/activate.js'
import checkInRouter from './modules/check-in.js'
import versionRouter from './modules/version.js'
import appVersionsRouter from './modules/app-versions.js'
import settingsRouter from './modules/settings.js'
import supportRouter from './modules/support.js'
import storeRouter from './modules/store.js'
import notificationsRouter from './modules/notifications.js'
import announcementsRouter from './modules/announcements.js'
import downloadRouter from './modules/download.js'
import { initSocket } from './socket.js'
import { initLicenseScheduler } from './services/license-scheduler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Trust proxy - Required when behind Nginx reverse proxy
// Use '1' to trust only the first proxy (Nginx), not arbitrary proxies
// This is secure and prevents IP spoofing attacks
app.set('trust proxy', 1)

// CORS must be FIRST - before any other middleware
// CORS configuration for frontend domain and Electron apps
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from frontend URL, localhost, and Electron apps (no origin)
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://license.dangthanhson.com',
      'https://license.dangthanhson.com',
      'https://upload.dangthanhson.com',
      'https://api.dangthanhson.com',
      'http://localhost:3000',
      'http://localhost:5173'
    ]
    // Electron apps don't send Origin header, so origin will be undefined
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn('⚠️ Blocked CORS request from:', origin)
      callback(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Signature', 'X-Request-Timestamp'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400 // 24 hours
}
app.use(cors(corsOptions))

// Handle preflight requests explicitly
app.options('*', cors(corsOptions))

// Body size limits - 10MB for regular requests
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true, parameterLimit: 50000 }))
app.use(helmet({
  crossOriginResourcePolicy: false, // Don't block cross-origin requests
}))
app.use(morgan('combined'))

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
})
// Apply rate limiter to both paths (with and without /api prefix)
app.use('/activate', activateLimiter)
app.use('/api/activate', activateLimiter)

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'license-server' })
})

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

// Routes with /api/ prefix (for frontend via nginx proxy)
app.use('/api/auth', authRouter)
app.use('/api/user', userRouter)
app.use('/api/admin', adminRouter)
app.use('/api/admin/settings', settingsRouter)
app.use('/api/activate', activateRouter)
app.use('/api/check-in', checkInRouter)
app.use('/api/version', versionRouter)
app.use('/api/admin/app-versions', appVersionsRouter)
app.use('/api/support', supportRouter)
app.use('/api/store', storeRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/announcements', announcementsRouter)

// Routes WITHOUT /api/ prefix (for client apps calling api.dangthanhson.com directly)
app.use('/activate', activateRouter)
app.use('/check-in', checkInRouter)
app.use('/version', versionRouter)

// Download routes - Virtual download links
// Hỗ trợ: upload.dangthanhson.com/app-code.zip hoặc /download/app-code.zip
app.use('/download', downloadRouter)
app.use('/d', downloadRouter)

// Direct download route for cleaner URLs like upload.dangthanhson.com/app-code.zip
// Only match requests ending with .zip or .exe (to avoid conflicts with other routes)
app.get('/:filename', async (req, res, next) => {
  const { filename } = req.params
  // Only handle if filename ends with download extensions
  if (filename && (filename.endsWith('.zip') || filename.endsWith('.exe'))) {
    try {
      // Import query function
      const { query } = await import('./db.js')

      // Parse app code from filename
      let appCode = filename
      if (appCode.toLowerCase().endsWith('.zip')) {
        appCode = appCode.slice(0, -4)
      } else if (appCode.toLowerCase().endsWith('.exe')) {
        appCode = appCode.slice(0, -4)
      }

      // Find app
      const appResult = await query(
        'SELECT id, code, name FROM apps WHERE code = ? AND is_active = 1',
        [appCode]
      )

      if (appResult.rows.length === 0) {
        return res.status(404).json({
          error: 'app_not_found',
          message: `Application "${appCode}" not found`
        })
      }

      const app = appResult.rows[0]

      // Get latest version
      const versionResult = await query(
        `SELECT download_url, version FROM app_versions 
         WHERE app_id = ? ORDER BY created_at DESC LIMIT 1`,
        [app.id]
      )

      if (versionResult.rows.length === 0) {
        return res.status(404).json({
          error: 'no_version',
          message: `No version available for "${app.name}"`
        })
      }

      const version = versionResult.rows[0]
      console.log(`📥 Direct download redirect: ${app.code} v${version.version} -> ${version.download_url}`)

      return res.redirect(302, version.download_url)
    } catch (e) {
      console.error('Error handling direct download:', e)
      return res.status(500).json({ error: 'server_error', message: e.message })
    }
  }
  // Otherwise, pass to next handler
  next()
})

// Serve static files từ uploads folder
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')))

const port = process.env.PORT ? Number(process.env.PORT) : 3000
const server = app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`)
})

// Initialize Socket.IO
initSocket(server)

// Initialize License Expiring Scheduler (10:00 AM UTC+7 daily)
initLicenseScheduler()

// Increase timeout for large file uploads (30 minutes)
server.timeout = 30 * 60 * 1000
server.keepAliveTimeout = 30 * 60 * 1000
server.headersTimeout = 30 * 60 * 1000
