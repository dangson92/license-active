import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { generateVerificationToken, sendVerificationEmail, getSettings } from '../services/email.js'

const router = express.Router()

const signUserToken = (user) => {
  const payload = { id: user.id, role: user.role, email: user.email }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body
    if (!email || !password || !fullName) return res.status(400).json({ error: 'invalid_input' })

    const existing = await query('SELECT id FROM users WHERE email=?', [email])
    if (existing.rows.length) return res.status(409).json({ error: 'email_exists' })

    const passwordHash = await bcrypt.hash(password, 10)

    // Generate verification token
    const verificationToken = generateVerificationToken()
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user with verification token
    await query(
      `INSERT INTO users(email, password_hash, full_name, role, email_verified, verification_token, verification_expires, created_at) 
       VALUES(?, ?, ?, ?, ?, ?, ?, NOW())`,
      [email, passwordHash, fullName, 'user', false, verificationToken, verificationExpires]
    )

    // Check if email verification is required and SMTP is configured
    const settings = await getSettings()
    const emailVerifyRequired = settings.email_verify_required === 'true'
    const smtpConfigured = settings.smtp_host && settings.smtp_user && settings.smtp_pass

    if (emailVerifyRequired && smtpConfigured) {
      // Send verification email
      try {
        await sendVerificationEmail(email, fullName, verificationToken)
        res.json({
          success: true,
          requiresVerification: true,
          message: 'Vui lòng kiểm tra email để xác thực tài khoản.'
        })
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        // Still return success but note email failed
        res.json({
          success: true,
          requiresVerification: true,
          message: 'Tài khoản đã được tạo. Không thể gửi email xác thực.',
          emailError: true
        })
      }
    } else if (!emailVerifyRequired) {
      // Email verification not required, auto-verify and return token
      await query('UPDATE users SET email_verified = TRUE WHERE email = ?', [email])
      const created = await query('SELECT id, email, role FROM users WHERE email=?', [email])
      const token = signUserToken(created.rows[0])
      res.json({ token })
    } else {
      // SMTP not configured, auto-verify
      await query('UPDATE users SET email_verified = TRUE WHERE email = ?', [email])
      const created = await query('SELECT id, email, role FROM users WHERE email=?', [email])
      const token = signUserToken(created.rows[0])
      res.json({ token })
    }
  } catch (e) {
    console.error('Register error:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'invalid_input' })

    const result = await query('SELECT id, email, password_hash, role, email_verified FROM users WHERE email=?', [email])
    if (!result.rows.length) return res.status(401).json({ error: 'invalid_credentials' })

    const user = result.rows[0]
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })

    // Check if email verification is required
    const settings = await getSettings()
    const emailVerifyRequired = settings.email_verify_required === 'true'

    if (emailVerifyRequired && !user.email_verified) {
      return res.status(403).json({ error: 'email_not_verified' })
    }

    await query('UPDATE users SET last_login_at=NOW() WHERE id=?', [user.id])
    const token = signUserToken(user)
    res.json({ token })
  } catch (e) {
    console.error('Login error:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

// Verify email endpoint
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Token required' })

    const result = await query(
      'SELECT id, email, verification_expires FROM users WHERE verification_token = ?',
      [token]
    )

    if (!result.rows.length) {
      return res.status(400).json({ error: 'invalid_token' })
    }

    const user = result.rows[0]

    // Check if token expired
    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'token_expired' })
    }

    // Mark email as verified
    await query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [user.id]
    )

    res.json({ success: true, message: 'Email đã được xác thực thành công!' })
  } catch (e) {
    console.error('Verify email error:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    const result = await query(
      'SELECT id, full_name, email_verified FROM users WHERE email = ?',
      [email]
    )

    if (!result.rows.length) {
      return res.status(404).json({ error: 'user_not_found' })
    }

    const user = result.rows[0]

    if (user.email_verified) {
      return res.status(400).json({ error: 'already_verified' })
    }

    // Generate new token
    const verificationToken = generateVerificationToken()
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await query(
      'UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?',
      [verificationToken, verificationExpires, user.id]
    )

    // Send email
    await sendVerificationEmail(email, user.full_name, verificationToken)

    res.json({ success: true, message: 'Email xác thực đã được gửi lại.' })
  } catch (e) {
    console.error('Resend verification error:', e)
    res.status(500).json({ error: e.message || 'server_error' })
  }
})

export const requireUser = (req, res, next) => {
  try {
    const h = req.headers.authorization || ''
    const parts = h.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'unauthorized' })
    const data = jwt.verify(parts[1], process.env.JWT_SECRET)
    req.user = { id: data.id, role: data.role, email: data.email }
    next()
  } catch (e) {
    res.status(401).json({ error: 'unauthorized' })
  }
}

export const requireAdmin = (req, res, next) => {
  requireUser(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' })
    next()
  })
}

export default router
