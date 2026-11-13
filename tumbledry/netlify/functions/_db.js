// netlify/functions/_db.js
// Shared Neon database connection + auth helpers for all functions

import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable not set')
  }
  return neon(process.env.DATABASE_URL)
}

// ── Signed tokens (HMAC-SHA256). The secret lives only on the server. ──
function tokenSecret() {
  const s = process.env.AUTH_SECRET || process.env.API_SECRET
  if (!s) throw new Error('AUTH_SECRET environment variable not set')
  return s
}

export function signToken(payload, ttlSeconds) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url')
  const sig = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url')
  if (!safeEqual(sig, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.exp > Math.floor(Date.now() / 1000) ? p : null
  } catch { return null }
}

export function bearer(event) {
  const h = event.headers.authorization || event.headers.Authorization || ''
  return h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null
}

// Staff requests must carry a staff session token issued by /staff-auth
export function checkAuth(event) {
  const p = bearer(event)
  return !!p && p.role === 'staff'
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// Last 10 digits of a phone, tolerating "8825003460.0", "09797101789", "+91 ..."
export function normPhone(v) {
  return String(v || '').replace(/\.0+$/, '').replace(/\D/g, '').slice(-10)
}

export function ok(data, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data)
  }
}

export function err(message, status = 400) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: message })
  }
}

export function cors() {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: ''
  }
}
