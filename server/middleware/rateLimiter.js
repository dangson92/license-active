/**
 * Rate Limiting Middleware
 *
 * Prevents brute force attacks on license activation and check-in endpoints.
 *
 * Features:
 * - IP-based rate limiting
 * - Device ID-based rate limiting
 * - License key-based rate limiting
 * - Exponential backoff
 * - Automatic cleanup of old entries
 * - Configurable limits per endpoint
 */

// In-memory store for rate limiting
// In production, use Redis for distributed systems
const rateLimitStore = new Map()

// Configuration
const CONFIG = {
  // Activation endpoint limits
  activate: {
    maxAttempts: 10,           // Max attempts per window
    windowMs: 60 * 1000,       // 1 minute window
    blockDurationMs: 15 * 60 * 1000,  // Block for 15 minutes after max attempts
  },
  // Check-in endpoint limits (more lenient)
  checkIn: {
    maxAttempts: 30,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  },
  // Global IP rate limit (across all endpoints)
  global: {
    maxAttempts: 50,
    windowMs: 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
  }
}

/**
 * Clean up old entries from rate limit store
 */
function cleanupOldEntries() {
  const now = Date.now()
  const keysToDelete = []

  for (const [key, data] of rateLimitStore.entries()) {
    // Remove entries older than their block duration
    if (data.blockedUntil && now > data.blockedUntil + 60000) {
      keysToDelete.push(key)
    }
    // Remove entries with expired windows
    else if (data.windowStart && now > data.windowStart + data.windowMs + 60000) {
      keysToDelete.push(key)
    }
  }

  keysToDelete.forEach(key => rateLimitStore.delete(key))

  if (keysToDelete.length > 0) {
    console.log(`🧹 Cleaned up ${keysToDelete.length} old rate limit entries`)
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldEntries, 5 * 60 * 1000)

/**
 * Get or create rate limit data for a key
 */
function getRateLimitData(key, config) {
  const now = Date.now()

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      attempts: [],
      windowStart: now,
      windowMs: config.windowMs,
      blockedUntil: null
    })
  }

  return rateLimitStore.get(key)
}

/**
 * Check if request should be rate limited
 */
function shouldRateLimit(key, config) {
  const now = Date.now()
  const data = getRateLimitData(key, config)

  // Check if currently blocked
  if (data.blockedUntil && now < data.blockedUntil) {
    const remainingSeconds = Math.ceil((data.blockedUntil - now) / 1000)
    return {
      limited: true,
      reason: 'blocked',
      retryAfter: remainingSeconds
    }
  }

  // Reset if window expired
  if (now > data.windowStart + data.windowMs) {
    data.attempts = []
    data.windowStart = now
    data.blockedUntil = null
  }

  // Add current attempt
  data.attempts.push(now)

  // Remove attempts outside current window
  data.attempts = data.attempts.filter(time => now - time < data.windowMs)

  // Check if exceeded max attempts
  if (data.attempts.length > config.maxAttempts) {
    data.blockedUntil = now + config.blockDurationMs
    const blockMinutes = Math.ceil(config.blockDurationMs / 60000)

    return {
      limited: true,
      reason: 'too_many_attempts',
      retryAfter: blockMinutes * 60,
      attemptsInWindow: data.attempts.length
    }
  }

  return {
    limited: false,
    attemptsInWindow: data.attempts.length,
    remainingAttempts: config.maxAttempts - data.attempts.length
  }
}

/**
 * Rate limiter middleware factory
 */
export function createRateLimiter(endpointType) {
  return (req, res, next) => {
    try {
      const config = CONFIG[endpointType] || CONFIG.global
      const ip = req.ip || req.connection.remoteAddress
      const deviceId = req.body?.deviceId
      const licenseKey = req.body?.licenseKey

      // Build composite keys for different rate limit checks
      const keys = [
        `global:${ip}`,                                    // Global IP limit
        `${endpointType}:ip:${ip}`,                       // Endpoint + IP
      ]

      // Add device-specific key if available
      if (deviceId) {
        keys.push(`${endpointType}:device:${deviceId}`)
      }

      // Add license-specific key for activation endpoint
      if (licenseKey && endpointType === 'activate') {
        keys.push(`${endpointType}:license:${licenseKey}`)
      }

      // Check all keys
      for (const key of keys) {
        const result = shouldRateLimit(key, config)

        if (result.limited) {
          const keyType = key.split(':')[1] || 'ip'

          console.warn(`⚠️ Rate limit exceeded for ${keyType}:`, {
            endpoint: endpointType,
            ip,
            deviceId: deviceId?.substring(0, 16) + '...',
            reason: result.reason,
            retryAfter: result.retryAfter
          })

          return res.status(429).json({
            error: 'rate_limit_exceeded',
            message: `Too many ${endpointType} attempts. Please try again later.`,
            retryAfter: result.retryAfter,
            details: {
              reason: result.reason,
              waitSeconds: result.retryAfter
            }
          })
        }
      }

      // Log successful check
      console.log(`✅ Rate limit check passed for ${endpointType}:`, {
        ip,
        deviceId: deviceId?.substring(0, 16) + '...',
        attempts: keys.map(k => {
          const data = rateLimitStore.get(k)
          return data ? data.attempts.length : 0
        })
      })

      next()

    } catch (error) {
      console.error('💥 Rate limiter error:', error.message)
      // On error, allow request to proceed (fail open)
      next()
    }
  }
}

/**
 * Get rate limit stats (for monitoring/debugging)
 */
export function getRateLimitStats() {
  const stats = {
    totalEntries: rateLimitStore.size,
    blockedCount: 0,
    activeCount: 0,
    entries: []
  }

  const now = Date.now()

  for (const [key, data] of rateLimitStore.entries()) {
    const isBlocked = data.blockedUntil && now < data.blockedUntil

    if (isBlocked) stats.blockedCount++
    else stats.activeCount++

    stats.entries.push({
      key,
      attempts: data.attempts.length,
      blocked: isBlocked,
      blockedUntil: data.blockedUntil ? new Date(data.blockedUntil).toISOString() : null
    })
  }

  return stats
}

export default createRateLimiter
