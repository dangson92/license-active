/**
 * Request Signature Verification Middleware
 *
 * Verifies that requests are signed by legitimate clients.
 * Prevents request tampering and MITM attacks.
 *
 * Client must send:
 * - X-Request-Signature: HMAC-SHA256(body + timestamp, secret)
 * - X-Request-Timestamp: Unix timestamp in milliseconds
 *
 * Security features:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation (prevents replay attacks)
 * - Request timeout (5 minutes)
 */

import crypto from 'crypto'

// IMPORTANT: This secret MUST match the one in client code
// In production, use environment variable
const REQUEST_SIGNING_SECRET = process.env.REQUEST_SIGNING_SECRET || 'your-super-secret-key-change-this-in-production'

// Request timeout: 5 minutes
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Verify request signature middleware
 */
export const verifySignature = (req, res, next) => {
  try {
    // Get signature and timestamp from headers
    const signature = req.headers['x-request-signature']
    const timestamp = req.headers['x-request-timestamp']

    // Check if headers exist
    if (!signature || !timestamp) {
      console.warn('⚠️ Missing signature or timestamp headers')
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Missing request signature'
      })
    }

    // Validate timestamp
    const requestTime = parseInt(timestamp, 10)
    const now = Date.now()

    // Check if timestamp is valid number
    if (isNaN(requestTime)) {
      console.warn('⚠️ Invalid timestamp format')
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid timestamp'
      })
    }

    // Check if request is too old (replay attack prevention)
    const timeDiff = Math.abs(now - requestTime)
    if (timeDiff > REQUEST_TIMEOUT_MS) {
      console.warn(`⚠️ Request expired. Age: ${Math.floor(timeDiff / 1000)}s`)
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Request expired'
      })
    }

    // Check if timestamp is not from future (clock skew protection)
    if (requestTime > now + 60000) { // Allow 1 minute clock skew
      console.warn('⚠️ Request timestamp is in the future')
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid timestamp'
      })
    }

    // Generate expected signature
    // Signature = HMAC-SHA256(body_json + timestamp, secret)
    const bodyString = JSON.stringify(req.body)
    const dataToSign = bodyString + timestamp
    const expectedSignature = crypto
      .createHmac('sha256', REQUEST_SIGNING_SECRET)
      .update(dataToSign)
      .digest('hex')

    // Compare signatures (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )

    if (!isValid) {
      console.warn('⚠️ Invalid signature')
      console.debug('Expected:', expectedSignature.substring(0, 16) + '...')
      console.debug('Received:', signature.substring(0, 16) + '...')
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid signature'
      })
    }

    // Signature valid, proceed to next middleware
    console.log('✅ Request signature verified')
    next()

  } catch (error) {
    console.error('💥 Signature verification error:', error.message)
    return res.status(500).json({
      error: 'server_error',
      message: 'Signature verification failed'
    })
  }
}

export default verifySignature
