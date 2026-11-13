// netlify/functions/leads.js

import { getDb, checkAuth, ok, err, cors } from './_db.js'
import Pusher from 'pusher'

function getPusher() {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) return null
  return new Pusher({ appId: PUSHER_APP_ID, key: PUSHER_KEY, secret: PUSHER_SECRET, cluster: PUSHER_CLUSTER, useTLS: true })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()

  let sql
  try {
    sql = getDb()
  } catch (e) {
    return err(`DB config error: ${e.message}`, 500)
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id               TEXT PRIMARY KEY,
        customer_name    TEXT NOT NULL,
        customer_number  TEXT NOT NULL,
        customer_address TEXT DEFAULT '',
        customer_city    TEXT DEFAULT '',
        service_type     TEXT DEFAULT 'Dry Clean',
        garment_count    INTEGER DEFAULT 1,
        notes            TEXT DEFAULT '',
        pickup_date      TEXT DEFAULT '',
        status           TEXT DEFAULT 'new',
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        converted_order_id TEXT DEFAULT NULL
      )
    `
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS pickup_date TEXT DEFAULT ''`
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS landmark TEXT DEFAULT ''`
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION`
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION`
  } catch (e) {
    return err(`DB init error: ${e.message}`, 500)
  }

  // ── GET: fetch all leads (auth required) ─────────────────────
  if (event.httpMethod === 'GET') {
    if (!checkAuth(event)) return err('Unauthorized', 401)
    try {
      const leads = await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`
      return ok({ leads })
    } catch (e) {
      return err(`DB query error: ${e.message}`, 500)
    }
  }

  // ── POST ─────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return err('Invalid JSON body', 400)
    }

    // Update lead status — auth required
    if (body.action === 'UPDATE_STATUS') {
      if (!checkAuth(event)) return err('Unauthorized', 401)
      try {
        await sql`
          UPDATE leads
          SET status = ${body.status},
              converted_order_id = ${body.convertedOrderId || null}
          WHERE id = ${body.id}
        `
        return ok({ success: true })
      } catch (e) {
        return err(`DB update error: ${e.message}`, 500)
      }
    }

    // Link the saved order to a converted lead — auth required
    if (body.action === 'LINK_ORDER') {
      if (!checkAuth(event)) return err('Unauthorized', 401)
      await sql`UPDATE leads SET status = 'converted', converted_order_id = ${body.orderId} WHERE id = ${body.id}`
      return ok({ success: true })
    }

    // Clothes reached the store without a rider (walk-in) — auth required
    if (body.action === 'MARK_COLLECTED') {
      if (!checkAuth(event)) return err('Unauthorized', 401)
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ`
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS picked_up_by TEXT DEFAULT ''`
      await sql`UPDATE leads SET picked_up_at = COALESCE(picked_up_at, NOW()), picked_up_by = CASE WHEN picked_up_by = '' OR picked_up_by IS NULL THEN 'Store' ELSE picked_up_by END WHERE id = ${body.id}`
      return ok({ success: true })
    }

    // Delete a lead (e.g. converted by mistake or a duplicate) — auth required
    if (body.action === 'DELETE') {
      if (!checkAuth(event)) return err('Unauthorized', 401)
      const res = await sql`DELETE FROM leads WHERE id = ${body.id} RETURNING id`
      return res.length ? ok({ success: true }) : err('Request not found', 404)
    }

    // Create new lead — PUBLIC, no auth
    const { customerName, customerNumber, customerAddress, customerCity, serviceType, garmentCount, notes, pickupDate, landmark } = body
    const lat = Number(body.lat), lng = Number(body.lng)
    const hasLoc = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)
    if (!customerName?.trim()) return err('Name is required')
    if (!customerNumber?.trim()) return err('Phone number is required')

    try {
      const id = `LEAD${Date.now()}`
      await sql`
        INSERT INTO leads (id, customer_name, customer_number, customer_address, customer_city, service_type, garment_count, notes, pickup_date, landmark, location_lat, location_lng, status, created_at)
        VALUES (
          ${id},
          ${customerName.trim()},
          ${customerNumber.trim()},
          ${customerAddress?.trim() || ''},
          ${customerCity?.trim() || ''},
          ${serviceType || 'Dry Clean'},
          ${parseInt(garmentCount) || 1},
          ${notes?.trim() || ''},
          ${pickupDate?.trim() || ''},
          ${String(landmark || '').trim().slice(0, 200)},
          ${hasLoc ? lat : null},
          ${hasLoc ? lng : null},
          'new',
          NOW()
        )
      `

      // Push real-time notification to admin (non-blocking, best-effort)
      const pusher = getPusher()
      if (pusher) {
        await pusher.trigger('tumbledry-leads', 'new-lead', {
          id,
          customerName: customerName.trim(),
          serviceType: serviceType || 'Dry Clean',
        }).catch(() => {})
      }

      return ok({ success: true, id })
    } catch (e) {
      return err(`DB insert error: ${e.message}`, 500)
    }
  }

  return err('Method not allowed', 405)
}
