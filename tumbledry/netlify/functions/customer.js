// netlify/functions/customer.js — customer accounts (phone + PIN) and "My orders"
//
// POST { action: 'SETUP', phone, tag, pin }   first-time PIN, proven with a tag number from a receipt
// POST { action: 'LOGIN', phone, pin }
// GET  (Authorization: Bearer <customer token>) -> the customer's orders and bookings
// POST { action: 'RESET_PIN', phone }          staff only: lets a customer set a new PIN

import crypto from 'crypto'
import { getDb, signToken, bearer, checkAuth, normPhone, ok, err, cors } from './_db.js'
import { ensureFeedbackTable } from './_feedback.js'

const SESSION_DAYS = 30
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

// Phone match in SQL mirrors normPhone(): strip trailing .0, keep digits, last 10

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex')
  return `${salt}:${hash}`
}
function pinMatches(pin, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(String(pin), salt, 32)
  const real = Buffer.from(hash, 'hex')
  return test.length === real.length && crypto.timingSafeEqual(test, real)
}
const validPin = pin => /^\d{4,6}$/.test(String(pin || ''))

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS customer_accounts (
      phone           TEXT PRIMARY KEY,
      pin_hash        TEXT NOT NULL,
      name            TEXT DEFAULT '',
      failed_attempts INTEGER DEFAULT 0,
      locked_until    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      last_login      TIMESTAMPTZ
    )
  `
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS landmark TEXT DEFAULT ''`
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS area TEXT DEFAULT ''`
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION`
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION`
}

async function latestName(sql, phone) {
  const rows = await sql`SELECT customer_name FROM orders WHERE right(regexp_replace(regexp_replace(customer_number, '[.]0+$', ''), '[^0-9]', '', 'g'), 10) = ${phone} AND deleted = false ORDER BY order_date DESC LIMIT 1`
  return rows[0]?.customer_name || ''
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()

  let sql
  try { sql = getDb(); await ensureTable(sql); await ensureFeedbackTable(sql) }
  catch (e) { return err(`Database unavailable: ${e.message}`, 500) }

  try {
    // ── GET: my orders ──────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const me = bearer(event)
      if (!me || me.role !== 'customer') return err('Please sign in again', 401)

      const orders = await sql`
        SELECT id, tag_number, service_type, status, payment_status, payment_method,
               grand_total::float AS grand_total, total_garments, discount_amount::float AS discount_amount,
               cart, order_date, delivery_date
        FROM orders
        WHERE right(regexp_replace(regexp_replace(customer_number, '[.]0+$', ''), '[^0-9]', '', 'g'), 10) = ${me.phone} AND deleted = false
        ORDER BY order_date DESC
        LIMIT 200
      `
      let bookings = []
      try {
        bookings = await sql`
          SELECT id, service_type, garment_count, pickup_date, status, created_at
          FROM leads WHERE right(regexp_replace(regexp_replace(customer_number, '[.]0+$', ''), '[^0-9]', '', 'g'), 10) = ${me.phone}
          ORDER BY created_at DESC LIMIT 20
        `
      } catch { /* leads table may not exist yet */ }

      const fb = await sql`SELECT order_id, rating, comment FROM order_feedback WHERE customer_phone = ${me.phone}`
      const fbByOrder = Object.fromEntries(fb.map(f => [f.order_id, { rating: f.rating, comment: f.comment }]))

      const acct = (await sql`SELECT address, landmark, area, location_lat, location_lng FROM customer_accounts WHERE phone = ${me.phone}`)[0] || {}

      return ok({
        name: me.name || '',
        phone: me.phone,
        address: { address: acct.address || '', landmark: acct.landmark || '', area: acct.area || '', lat: acct.location_lat, lng: acct.location_lng },
        orders: orders.map(o => ({
          id: o.id, tagNumber: o.tag_number, serviceType: o.service_type, status: o.status,
          paymentStatus: o.payment_status, paymentMethod: o.payment_method,
          grandTotal: o.grand_total, totalGarments: o.total_garments, discountAmount: o.discount_amount,
          items: (o.cart || []).map(i => ({ name: i.name, qty: i.qty || 1, net: Math.round(i.net || 0) })),
          orderDate: o.order_date, deliveryDate: o.delivery_date,
          feedback: fbByOrder[o.id] || null,
        })),
        bookings,
      })
    }

    if (event.httpMethod !== 'POST') return err('Method not allowed', 405)
    let body
    try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid request') }
    const phone = normPhone(body.phone)

    // ── Staff: reset a customer's PIN ───────────────────────────
    if (body.action === 'RESET_PIN') {
      if (!checkAuth(event)) return err('Unauthorized', 401)
      if (phone.length !== 10) return err('Enter a 10-digit phone number')
      const res = await sql`DELETE FROM customer_accounts WHERE phone = ${phone} RETURNING phone`
      return ok({ success: true, hadAccount: res.length > 0 })
    }

    // ── Signed-in customer: rate an order (once, when Ready or Delivered) ──
    if (body.action === 'FEEDBACK') {
      const me = bearer(event)
      if (!me || me.role !== 'customer') return err('Please log in again', 401)
      const rating = parseInt(body.rating)
      if (!(rating >= 1 && rating <= 5)) return err('Choose between 1 and 5 stars')
      const comment = String(body.comment || '').trim().slice(0, 1000)
      const rows = await sql`
        SELECT id, tag_number, status, customer_name FROM orders
        WHERE id = ${String(body.orderId || '')} AND deleted = false
          AND right(regexp_replace(regexp_replace(customer_number, '[.]0+$', ''), '[^0-9]', '', 'g'), 10) = ${me.phone}`
      const order = rows[0]
      if (!order) return err('Order not found', 404)
      if (order.status !== 'completed' && order.status !== 'delivered') return err('You can rate an order once it’s ready')
      const inserted = await sql`
        INSERT INTO order_feedback (id, order_id, tag_number, customer_phone, customer_name, rating, comment)
        VALUES (${'FB' + Date.now()}, ${order.id}, ${order.tag_number}, ${me.phone}, ${order.customer_name || me.name || ''}, ${rating}, ${comment})
        ON CONFLICT (order_id) DO NOTHING RETURNING id`
      if (!inserted.length) return err('You’ve already rated this order', 409)
      return ok({ success: true })
    }

    // ── Signed-in customer: save pickup address + GPS location ──
    if (body.action === 'SAVE_ADDRESS') {
      const me = bearer(event)
      if (!me || me.role !== 'customer') return err('Please log in again', 401)
      const clip = (v, n) => String(v || '').trim().slice(0, n)
      const lat = Number(body.lat), lng = Number(body.lng)
      const hasLoc = body.lat !== null && body.lat !== undefined && body.lat !== '' &&
        Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      if (!clip(body.address, 300)) return err('Add your house or street address')
      await sql`
        UPDATE customer_accounts
        SET address = ${clip(body.address, 300)}, landmark = ${clip(body.landmark, 200)}, area = ${clip(body.area, 100)},
            location_lat = ${hasLoc ? lat : null}, location_lng = ${hasLoc ? lng : null}
        WHERE phone = ${me.phone}`
      return ok({ success: true })
    }

    // ── Signed-in customer: change PIN ──────────────────────────
    if (body.action === 'CHANGE_PIN') {
      const me = bearer(event)
      if (!me || me.role !== 'customer') return err('Please log in again', 401)
      if (!validPin(body.newPin)) return err('Your new PIN must be 4 to 6 digits')
      const rows = await sql`SELECT pin_hash FROM customer_accounts WHERE phone = ${me.phone}`
      if (!rows.length) return err('Please log in again', 401)
      if (!pinMatches(body.currentPin, rows[0].pin_hash)) return err('Your current PIN is wrong', 403)
      await sql`UPDATE customer_accounts SET pin_hash = ${hashPin(body.newPin)}, failed_attempts = 0, locked_until = NULL WHERE phone = ${me.phone}`
      return ok({ success: true })
    }

    if (phone.length !== 10) return err('Enter your 10-digit mobile number')
    if (!validPin(body.pin)) return err('Your PIN must be 4 to 6 digits')

    // ── First-time PIN setup ────────────────────────────────────
    if (body.action === 'SETUP') {
      const tag = String(body.tag || '').trim()
      if (!tag) return err('Enter a tag number from one of your receipts')

      const existing = await sql`SELECT phone FROM customer_accounts WHERE phone = ${phone}`
      if (existing.length) return err('This number already has a PIN. Sign in, or ask the store to reset it.', 409)

      const match = await sql`
        SELECT 1 FROM orders
        WHERE right(regexp_replace(regexp_replace(customer_number, '[.]0+$', ''), '[^0-9]', '', 'g'), 10) = ${phone} AND deleted = false AND upper(trim(tag_number)) = upper(${tag})
        LIMIT 1
      `
      // Same delay whether or not it matched, to slow down guessing
      await new Promise(r => setTimeout(r, 500))
      if (!match.length) return err('That tag number doesn’t match an order for this phone. Check your receipt and try again.', 404)

      const name = await latestName(sql, phone)
      await sql`INSERT INTO customer_accounts (phone, pin_hash, name, last_login) VALUES (${phone}, ${hashPin(body.pin)}, ${name}, NOW())`
      return ok({ token: signToken({ role: 'customer', phone, name }, SESSION_DAYS * 86400), name })
    }

    // ── Sign in ─────────────────────────────────────────────────
    if (body.action === 'LOGIN') {
      const rows = await sql`SELECT * FROM customer_accounts WHERE phone = ${phone}`
      const acct = rows[0]
      if (!acct) {
        await new Promise(r => setTimeout(r, 400))
        return err('No PIN set for this number yet. Choose “First time here?” to create one.', 404)
      }
      if (acct.locked_until && new Date(acct.locked_until) > new Date()) {
        const mins = Math.ceil((new Date(acct.locked_until) - new Date()) / 60000)
        return err(`Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 429)
      }
      if (!pinMatches(body.pin, acct.pin_hash)) {
        const attempts = (acct.failed_attempts || 0) + 1
        if (attempts >= MAX_ATTEMPTS) {
          await sql`UPDATE customer_accounts SET failed_attempts = 0, locked_until = NOW() + make_interval(mins => ${LOCK_MINUTES}) WHERE phone = ${phone}`
          return err(`Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.`, 429)
        }
        await sql`UPDATE customer_accounts SET failed_attempts = ${attempts} WHERE phone = ${phone}`
        return err(`Wrong PIN. ${MAX_ATTEMPTS - attempts} ${MAX_ATTEMPTS - attempts === 1 ? 'try' : 'tries'} left.`, 401)
      }
      const name = (await latestName(sql, phone)) || acct.name
      await sql`UPDATE customer_accounts SET failed_attempts = 0, locked_until = NULL, last_login = NOW(), name = ${name} WHERE phone = ${phone}`
      return ok({ token: signToken({ role: 'customer', phone, name }, SESSION_DAYS * 86400), name })
    }

    return err('Unknown action')
  } catch (e) {
    return err(`Something went wrong: ${e.message}`, 500)
  }
}
