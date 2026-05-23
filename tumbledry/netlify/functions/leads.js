// netlify/functions/leads.js

import { getDb, checkAuth, ok, err, cors } from './_db.js'

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

    // Create new lead — PUBLIC, no auth
    const { customerName, customerNumber, customerAddress, customerCity, serviceType, garmentCount, notes, pickupDate } = body
    if (!customerName?.trim()) return err('Name is required')
    if (!customerNumber?.trim()) return err('Phone number is required')

    try {
      const id = `LEAD${Date.now()}`
      await sql`
        INSERT INTO leads (id, customer_name, customer_number, customer_address, customer_city, service_type, garment_count, notes, pickup_date, status, created_at)
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
          'new',
          NOW()
        )
      `
      return ok({ success: true, id })
    } catch (e) {
      return err(`DB insert error: ${e.message}`, 500)
    }
  }

  return err('Method not allowed', 405)
}
