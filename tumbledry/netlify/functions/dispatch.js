// netlify/functions/dispatch.js — riders, pickup jobs and delivery jobs
//
// Staff (Bearer staff token):
//   GET                                   riders + jobs (active and last 30 days)
//   POST ADD_RIDER {name, phone, pin}     POST UPDATE_RIDER {id, active?, pin?}
//   POST CREATE_JOB {type, leadId|orderId, riderId?, note?}
//   POST ASSIGN {jobId, riderId|null}     POST CANCEL_JOB {jobId}
// Rider:
//   POST RIDER_LOGIN {phone, pin}         (public)
//   GET  (Bearer rider token)             my jobs, available jobs, done today
//   POST ACCEPT {jobId}                   POST PICKED_UP {jobId, note?}
//   POST DELIVERED {jobId, payment: 'Cash'|'Online'|'None', note?}
//   POST FAILED {jobId, reason}

import Pusher from 'pusher'
import { getDb, signToken, bearer, checkAuth, normPhone, ok, err, cors } from './_db.js'
import { hashPin, pinMatches, validPin } from './_pin.js'

const RIDER_SESSION_DAYS = 14
const ACTIVE = ['open', 'assigned']

function getPusher() {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) return null
  return new Pusher({ appId: PUSHER_APP_ID, key: PUSHER_KEY, secret: PUSHER_SECRET, cluster: PUSHER_CLUSTER, useTLS: true })
}
async function notify(payload) {
  const p = getPusher()
  if (p) await p.trigger('posh-dispatch', 'changed', payload).catch(() => {})
}

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS riders (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT UNIQUE NOT NULL,
      pin_hash   TEXT NOT NULL,
      active     BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS rider_jobs (
      id             TEXT PRIMARY KEY,
      type           TEXT NOT NULL CHECK (type IN ('pickup', 'delivery')),
      lead_id        TEXT,
      order_id       TEXT,
      tag_number     TEXT DEFAULT '',
      rider_id       TEXT,
      status         TEXT NOT NULL DEFAULT 'open',
      customer_name  TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      address        TEXT DEFAULT '',
      landmark       TEXT DEFAULT '',
      area           TEXT DEFAULT '',
      location_lat   DOUBLE PRECISION,
      location_lng   DOUBLE PRECISION,
      scheduled_for  TEXT DEFAULT '',
      pieces         INTEGER DEFAULT 0,
      amount_due     NUMERIC(10,2) DEFAULT 0,
      note           TEXT DEFAULT '',
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      assigned_at    TIMESTAMPTZ,
      completed_at   TIMESTAMPTZ,
      payment_collected TEXT DEFAULT '',
      outcome_note   TEXT DEFAULT ''
    )`
  await sql`CREATE INDEX IF NOT EXISTS idx_rider_jobs_status ON rider_jobs(status)`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS picked_up_by TEXT DEFAULT ''`
}

const jobRow = j => ({ ...j, amount_due: Number(j.amount_due || 0) })

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  let sql
  try { sql = getDb(); await ensureTables(sql) }
  catch (e) { return err(`Database unavailable: ${e.message}`, 500) }

  let body = {}
  if (event.httpMethod === 'POST') {
    try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid request') }
  }

  try {
    // ── Rider login (public) ────────────────────────────────────
    if (body.action === 'RIDER_LOGIN') {
      const phone = normPhone(body.phone)
      await new Promise(r => setTimeout(r, 400))
      const rider = (await sql`SELECT * FROM riders WHERE phone = ${phone}`)[0]
      if (!rider || !rider.active || !pinMatches(body.pin, rider.pin_hash)) return err('Phone number or PIN is wrong, or this rider is switched off', 401)
      return ok({ token: signToken({ role: 'rider', riderId: rider.id, name: rider.name }, RIDER_SESSION_DAYS * 86400), name: rider.name })
    }

    const who = bearer(event)
    const isStaff = checkAuth(event)
    const isRider = who && who.role === 'rider'
    if (!isStaff && !isRider) return err('Please log in again', 401)

    // ── Rider ───────────────────────────────────────────────────
    if (isRider) {
      const rider = (await sql`SELECT id, name, active FROM riders WHERE id = ${who.riderId}`)[0]
      if (!rider || !rider.active) return err('Please log in again', 401)

      if (event.httpMethod === 'GET') {
        const mine = await sql`SELECT * FROM rider_jobs WHERE rider_id = ${rider.id} AND status = 'assigned' ORDER BY created_at`
        const available = await sql`SELECT * FROM rider_jobs WHERE status = 'open' ORDER BY created_at`
        const done = await sql`
          SELECT * FROM rider_jobs WHERE rider_id = ${rider.id} AND status IN ('done', 'failed')
            AND completed_at > date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
          ORDER BY completed_at DESC`
        return ok({ me: { name: rider.name }, mine: mine.map(jobRow), available: available.map(jobRow), done: done.map(jobRow) })
      }

      const job = (await sql`SELECT * FROM rider_jobs WHERE id = ${String(body.jobId || '')}`)[0]
      if (!job) return err('This job no longer exists', 404)
      const note = String(body.note || body.reason || '').trim().slice(0, 500)

      if (body.action === 'ACCEPT') {
        const res = await sql`UPDATE rider_jobs SET rider_id = ${rider.id}, status = 'assigned', assigned_at = NOW() WHERE id = ${job.id} AND status = 'open' RETURNING id`
        if (!res.length) return err('Another rider already took this job', 409)
        await notify({ jobId: job.id })
        return ok({ success: true })
      }

      if (job.rider_id !== rider.id || job.status !== 'assigned') return err('This job isn’t assigned to you any more', 409)

      if (body.action === 'PICKED_UP') {
        if (job.type !== 'pickup') return err('This is a delivery job')
        await sql`UPDATE rider_jobs SET status = 'done', completed_at = NOW(), outcome_note = ${note} WHERE id = ${job.id}`
        if (job.lead_id) {
          await sql`UPDATE leads SET picked_up_at = NOW(), picked_up_by = ${rider.name},
                      status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END
                    WHERE id = ${job.lead_id}`
        }
        await notify({ jobId: job.id, kind: 'picked_up' })
        return ok({ success: true })
      }

      if (body.action === 'DELIVERED') {
        if (job.type !== 'delivery') return err('This is a pickup job')
        const payment = ['Cash', 'Online'].includes(body.payment) ? body.payment : 'None'
        await sql`UPDATE rider_jobs SET status = 'done', completed_at = NOW(), payment_collected = ${payment}, outcome_note = ${note} WHERE id = ${job.id}`
        if (job.order_id) {
          if (payment === 'None') {
            await sql`UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW()), ready_at = COALESCE(ready_at, NOW()), updated_at = NOW() WHERE id = ${job.order_id}`
          } else {
            await sql`
              UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW()), ready_at = COALESCE(ready_at, NOW()),
                payment_status = 'Paid', payment_method = ${payment},
                cash_amount = grand_total * ${payment === 'Cash' ? 1 : 0},
                online_amount = grand_total * ${payment === 'Online' ? 1 : 0},
                updated_at = NOW()
              WHERE id = ${job.order_id} AND payment_status <> 'Paid'`
            await sql`UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW()), ready_at = COALESCE(ready_at, NOW()), updated_at = NOW() WHERE id = ${job.order_id}`
          }
        }
        await notify({ jobId: job.id, kind: 'delivered', orderId: job.order_id })
        return ok({ success: true })
      }

      if (body.action === 'FAILED') {
        if (!note) return err('Tell the manager what happened')
        await sql`UPDATE rider_jobs SET status = 'failed', completed_at = NOW(), outcome_note = ${note} WHERE id = ${job.id}`
        await notify({ jobId: job.id, kind: 'failed' })
        return ok({ success: true })
      }

      return err('Unknown action')
    }

    // ── Staff ───────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const riders = await sql`SELECT id, name, phone, active, created_at FROM riders ORDER BY active DESC, name`
      const jobs = await sql`
        SELECT * FROM rider_jobs
        WHERE status IN ('open', 'assigned') OR created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC LIMIT 500`
      return ok({ riders, jobs: jobs.map(jobRow) })
    }

    if (body.action === 'ADD_RIDER') {
      const name = String(body.name || '').trim().slice(0, 60)
      const phone = normPhone(body.phone)
      if (!name) return err('Add the rider’s name')
      if (phone.length !== 10) return err('Enter a 10-digit phone number')
      if (!validPin(body.pin)) return err('PIN must be 4 to 6 digits')
      const exists = await sql`SELECT 1 FROM riders WHERE phone = ${phone}`
      if (exists.length) return err('A rider with this phone already exists', 409)
      await sql`INSERT INTO riders (id, name, phone, pin_hash) VALUES (${'R' + Date.now()}, ${name}, ${phone}, ${hashPin(body.pin)})`
      return ok({ success: true })
    }

    if (body.action === 'UPDATE_RIDER') {
      if (body.pin !== undefined) {
        if (!validPin(body.pin)) return err('PIN must be 4 to 6 digits')
        await sql`UPDATE riders SET pin_hash = ${hashPin(body.pin)} WHERE id = ${body.id}`
      }
      if (typeof body.active === 'boolean') {
        await sql`UPDATE riders SET active = ${body.active} WHERE id = ${body.id}`
        if (!body.active) await sql`UPDATE rider_jobs SET rider_id = NULL, status = 'open', assigned_at = NULL WHERE rider_id = ${body.id} AND status = 'assigned'`
      }
      await notify({ rider: body.id })
      return ok({ success: true })
    }

    if (body.action === 'CREATE_JOB') {
      const riderId = body.riderId || null
      const note = String(body.note || '').trim().slice(0, 500)
      if (body.type === 'pickup') {
        const lead = (await sql`SELECT * FROM leads WHERE id = ${String(body.leadId || '')}`)[0]
        if (!lead) return err('Pickup request not found', 404)
        const busy = await sql`SELECT 1 FROM rider_jobs WHERE lead_id = ${lead.id} AND status IN ('open', 'assigned')`
        if (busy.length) return err('A rider is already on this pickup', 409)
        const phone = normPhone(lead.customer_number)
        await sql`
          INSERT INTO rider_jobs (id, type, lead_id, rider_id, status, customer_name, customer_phone, address, landmark, area,
                                  location_lat, location_lng, scheduled_for, pieces, note, assigned_at)
          VALUES (${'J' + Date.now()}, 'pickup', ${lead.id}, ${riderId}, ${riderId ? 'assigned' : 'open'}, ${lead.customer_name}, ${phone},
                  ${lead.customer_address || ''}, ${lead.landmark || ''}, ${lead.customer_city || ''},
                  ${lead.location_lat ?? null}, ${lead.location_lng ?? null}, ${lead.pickup_date || ''}, ${lead.garment_count || 0}, ${note},
                  ${riderId ? new Date().toISOString() : null})`
        if (lead.status === 'new') await sql`UPDATE leads SET status = 'contacted' WHERE id = ${lead.id}`
      } else if (body.type === 'delivery') {
        const order = (await sql`SELECT * FROM orders WHERE id = ${String(body.orderId || '')} AND deleted = false`)[0]
        if (!order) return err('Order not found', 404)
        const busy = await sql`SELECT 1 FROM rider_jobs WHERE order_id = ${order.id} AND status IN ('open', 'assigned')`
        if (busy.length) return err('A rider is already on this delivery', 409)
        const phone = normPhone(order.customer_number)
        // Prefer the customer's saved address + GPS from their account
        let acct = {}
        try { acct = (await sql`SELECT address, landmark, area, location_lat, location_lng FROM customer_accounts WHERE phone = ${phone}`)[0] || {} } catch { /* table may not exist */ }
        const due = order.payment_status === 'Paid' ? 0 : Number(order.grand_total || 0)
        await sql`
          INSERT INTO rider_jobs (id, type, order_id, tag_number, rider_id, status, customer_name, customer_phone, address, landmark, area,
                                  location_lat, location_lng, scheduled_for, pieces, amount_due, note, assigned_at)
          VALUES (${'J' + Date.now()}, 'delivery', ${order.id}, ${order.tag_number}, ${riderId}, ${riderId ? 'assigned' : 'open'},
                  ${order.customer_name}, ${phone}, ${acct.address || order.customer_address || ''}, ${acct.landmark || ''},
                  ${acct.area || order.customer_city || ''}, ${acct.location_lat ?? null}, ${acct.location_lng ?? null},
                  ${order.delivery_date || ''}, ${order.total_garments || 0}, ${due}, ${note},
                  ${riderId ? new Date().toISOString() : null})`
      } else {
        return err('Unknown job type')
      }
      await notify({ created: true })
      return ok({ success: true })
    }

    if (body.action === 'ASSIGN') {
      const riderId = body.riderId || null
      const res = await sql`
        UPDATE rider_jobs SET rider_id = ${riderId}, status = ${riderId ? 'assigned' : 'open'}, assigned_at = ${riderId ? new Date().toISOString() : null}
        WHERE id = ${body.jobId} AND status IN ('open', 'assigned', 'failed') RETURNING id`
      if (!res.length) return err('This job is already finished', 409)
      await notify({ jobId: body.jobId })
      return ok({ success: true })
    }

    if (body.action === 'CANCEL_JOB') {
      await sql`UPDATE rider_jobs SET status = 'cancelled', completed_at = NOW() WHERE id = ${body.jobId} AND status IN ('open', 'assigned', 'failed')`
      await notify({ jobId: body.jobId })
      return ok({ success: true })
    }

    return err('Unknown action')
  } catch (e) {
    return err(`Something went wrong: ${e.message}`, 500)
  }
}
