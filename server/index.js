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
      'http://localhost:3000',
      'http://localhost:5173'
    ]
    // Electron apps don't send Origin header, so origin will be undefined
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all for API endpoints (activate, check-in)
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

// Increase body size limits for file uploads
app.use(express.json({ limit: '1gb' }))
app.use(express.urlencoded({ limit: '1gb', extended: true, parameterLimit: 50000 }))
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
app.use('/activate', activateLimiter)

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'license-server' })
})

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/auth', authRouter)
app.use('/user', userRouter)
app.use('/admin', adminRouter)
app.use('/activate', activateRouter)
app.use('/check-in', checkInRouter)
app.use('/version', versionRouter)
app.use('/admin/app-versions', appVersionsRouter)

// Serve static files từ uploads folder
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

const port = process.env.PORT ? Number(process.env.PORT) : 3000
const server = app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`)
})

// Increase timeout for large file uploads (30 minutes)
server.timeout = 30 * 60 * 1000
server.keepAliveTimeout = 30 * 60 * 1000
server.headersTimeout = 30 * 60 * 1000
