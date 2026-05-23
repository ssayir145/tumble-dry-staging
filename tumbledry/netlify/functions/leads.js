// netlify/functions/leads.js

import { getDb, checkAuth, ok, err, cors } from './_db.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()

  const sql = getDb()

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

  // Add pickup_date column if upgrading an existing table
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS pickup_date TEXT DEFAULT ''`

  // ── GET: fetch all leads (auth required) ─────────────────────
  if (event.httpMethod === 'GET') {
    if (!checkAuth(event)) return err('Unauthorized', 401)
    const leads = await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`
    return ok({ leads })
  }

  // ── POST ─────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}')

    // Update lead status — auth required
    if (body.action === 'UPDATE_STATUS') {
      if (!checkAuth(event)) return err('Unauthorized', 401)
      await sql`
        UPDATE leads
        SET status = ${body.status},
            converted_order_id = ${body.convertedOrderId || null}
        WHERE id = ${body.id}
      `
      return ok({ success: true })
    }

    // Create new lead — PUBLIC, no auth
    const { customerName, customerNumber, customerAddress, customerCity, serviceType, garmentCount, notes, pickupDate } = body
    if (!customerName?.trim()) return err('Name is required')
    if (!customerNumber?.trim()) return err('Phone number is required')

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
  }

  return err('Method not allowed', 405)
}
