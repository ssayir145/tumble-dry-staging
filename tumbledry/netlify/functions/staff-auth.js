// netlify/functions/staff-auth.js — staff sign-in, checked on the server
// Requires env vars STAFF_STORE_ID and STAFF_PASSWORD.

import { signToken, safeEqual, ok, err, cors } from './_db.js'

const SESSION_HOURS = 12

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  const { STAFF_STORE_ID, STAFF_PASSWORD } = process.env
  if (!STAFF_STORE_ID || !STAFF_PASSWORD) return err('Staff sign-in is not configured on the server', 500)

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid request') }

  // Small fixed delay slows down password guessing
  await new Promise(r => setTimeout(r, 400))

  const idOk = safeEqual(String(body.storeId || '').trim().toLowerCase(), STAFF_STORE_ID.trim().toLowerCase())
  const pwOk = safeEqual(String(body.password || ''), STAFF_PASSWORD)
  if (!idOk || !pwOk) return err('Store ID or password is incorrect', 401)

  return ok({ token: signToken({ role: 'staff' }, SESSION_HOURS * 3600), expiresInHours: SESSION_HOURS })
}
