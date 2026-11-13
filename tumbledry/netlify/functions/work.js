// netlify/functions/work.js — KPI phase 1: washing and pressing/packing stage tracking
//
// Worker (Bearer token from dispatch RIDER_LOGIN with workerRole washer|presser):
//   GET                                    my queue: todo, inProgress (mine), doneToday
//   POST START  { orderIds: [] }           start washing / pressing / packing (batch)
//   POST FINISH { orderIds: [] }           washed / ready (pressman finishing sets the order Ready)
//   POST SEND_BACK { orderId, note }       pressman: stain remains, back to washing
// Staff:
//   GET ?view=board                        stage rows (last 30 days) + workers, for the Team page

import { getDb, bearer, checkAuth, ok, err, cors } from './_db.js'

const WINDOW_DAYS = 30
const needsWash = service => !/steam\s*iron/i.test(service || '')
const pressStage = service => (/fold/i.test(service || '') ? 'pack' : 'press')

async function ensureTables(sql) {
  await sql`ALTER TABLE riders ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'rider'`
  await sql`
    CREATE TABLE IF NOT EXISTS order_stages (
      id          TEXT PRIMARY KEY,
      order_id    TEXT NOT NULL,
      tag_number  TEXT DEFAULT '',
      stage       TEXT NOT NULL CHECK (stage IN ('wash', 'press', 'pack')),
      worker_id   TEXT NOT NULL,
      worker_name TEXT DEFAULT '',
      pieces      INTEGER DEFAULT 0,
      started_at  TIMESTAMPTZ DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      sent_back   BOOLEAN DEFAULT false,
      note        TEXT DEFAULT ''
    )`
  await sql`CREATE INDEX IF NOT EXISTS idx_order_stages_order ON order_stages(order_id)`
}

// Where each recent order is in the workshop
async function workshopState(sql) {
  const orders = await sql`
    SELECT id, tag_number, customer_name, service_type, status, total_garments, order_date, delivery_date
    FROM orders
    WHERE deleted = false AND status IN ('pending', 'inprocess') AND order_date > NOW() - make_interval(days => ${WINDOW_DAYS})
    ORDER BY order_date`
  const ids = orders.map(o => o.id)
  const stages = ids.length ? await sql`SELECT * FROM order_stages WHERE order_id = ANY(${ids}) ORDER BY started_at` : []
  const byOrder = {}
  stages.forEach(s => (byOrder[s.order_id] ||= []).push(s))
  return orders.map(o => {
    const st = byOrder[o.id] || []
    const washes = st.filter(s => s.stage === 'wash')
    const lastWash = washes[washes.length - 1]
    const presses = st.filter(s => s.stage !== 'wash')
    const lastPress = presses[presses.length - 1]
    const washDone = !needsWash(o.service_type) || (lastWash && lastWash.finished_at && !lastWash.sent_back)
    let phase
    if (!washDone) phase = lastWash && !lastWash.finished_at && !lastWash.sent_back ? 'washing' : 'to_wash'
    else if (lastPress && lastPress.finished_at && !lastPress.sent_back) phase = 'done'
    else phase = lastPress && !lastPress.finished_at && !lastPress.sent_back ? 'pressing' : 'to_press'
    const holder = phase === 'washing' ? lastWash : phase === 'pressing' ? lastPress : null
    const waitingSince = phase === 'to_press' ? (lastWash?.finished_at || o.order_date) : phase === 'to_wash' ? (lastWash?.sent_back ? lastWash.finished_at || lastWash.started_at : o.order_date) : holder?.started_at
    return {
      id: o.id, tag: o.tag_number, customer: o.customer_name, service: o.service_type, pieces: o.total_garments,
      orderDate: o.order_date, deliveryDate: o.delivery_date, phase, pressStage: pressStage(o.service_type),
      holderId: holder?.worker_id || null, holderName: holder?.worker_name || '', since: waitingSince,
      sentBack: !!(lastWash && lastWash.sent_back && phase === 'to_wash'), sentBackNote: lastWash?.sent_back ? lastWash.note : '',
    }
  })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors()
  let sql
  try { sql = getDb(); await ensureTables(sql) }
  catch (e) { return err(`Database unavailable: ${e.message}`, 500) }

  try {
    // ── Staff board ───────────────────────────────────────────
    if (checkAuth(event)) {
      if (event.httpMethod !== 'GET') return err('Method not allowed', 405)
      const workers = await sql`SELECT id, name, phone, active, role FROM riders ORDER BY active DESC, role, name`
      const stages = await sql`SELECT * FROM order_stages WHERE started_at > NOW() - INTERVAL '30 days' ORDER BY started_at DESC LIMIT 3000`
      const board = await workshopState(sql)
      return ok({ workers, stages, board })
    }

    // ── Worker ─────────────────────────────────────────────────
    const who = bearer(event)
    if (!who || who.role !== 'rider') return err('Please log in again', 401)
    const me = (await sql`SELECT id, name, active, role FROM riders WHERE id = ${who.riderId}`)[0]
    if (!me || !me.active) return err('Please log in again', 401)
    if (me.role !== 'washer' && me.role !== 'presser') return err('This screen is for washermen and pressmen', 403)
    const isWasher = me.role === 'washer'

    if (event.httpMethod === 'GET') {
      const state = await workshopState(sql)
      const todo = state.filter(o => o.phase === (isWasher ? 'to_wash' : 'to_press'))
      const inProgress = state.filter(o => o.phase === (isWasher ? 'washing' : 'pressing') && o.holderId === me.id)
      const others = state.filter(o => o.phase === (isWasher ? 'washing' : 'pressing') && o.holderId !== me.id)
      const doneToday = await sql`
        SELECT tag_number, stage, pieces, started_at, finished_at FROM order_stages
        WHERE worker_id = ${me.id} AND finished_at IS NOT NULL AND sent_back = false
          AND finished_at > date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
        ORDER BY finished_at DESC`
      return ok({ me: { name: me.name, role: me.role }, todo, inProgress, others, doneToday })
    }

    let body
    try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid request') }
    const ids = Array.isArray(body.orderIds) ? body.orderIds.map(String).slice(0, 50) : []
    const state = await workshopState(sql)
    const byId = Object.fromEntries(state.map(o => [o.id, o]))

    if (body.action === 'START') {
      if (!ids.length) return err('Select at least one order')
      let started = 0
      for (const id of ids) {
        const o = byId[id]
        if (!o || o.phase !== (isWasher ? 'to_wash' : 'to_press')) continue
        const stage = isWasher ? 'wash' : o.pressStage
        await sql`INSERT INTO order_stages (id, order_id, tag_number, stage, worker_id, worker_name, pieces)
                  VALUES (${'S' + Date.now() + Math.random().toString(36).slice(2, 6)}, ${id}, ${o.tag}, ${stage}, ${me.id}, ${me.name}, ${o.pieces || 0})`
        await sql`UPDATE orders SET status = 'inprocess', updated_at = NOW() WHERE id = ${id} AND status = 'pending'`
        started++
      }
      if (!started) return err('Someone else already started these. Refresh the list.', 409)
      return ok({ success: true, started })
    }

    if (body.action === 'FINISH') {
      if (!ids.length) return err('Select at least one order')
      let finished = 0
      for (const id of ids) {
        const res = await sql`UPDATE order_stages SET finished_at = NOW()
                              WHERE order_id = ${id} AND worker_id = ${me.id} AND finished_at IS NULL AND sent_back = false RETURNING id`
        if (!res.length) continue
        finished++
        if (!isWasher) {
          await sql`UPDATE orders SET status = 'completed', ready_at = COALESCE(ready_at, NOW()), updated_at = NOW()
                    WHERE id = ${id} AND status IN ('pending', 'inprocess')`
        }
      }
      return ok({ success: true, finished })
    }

    if (body.action === 'SEND_BACK') {
      if (isWasher) return err('Only the pressman can send an order back to washing')
      const id = String(body.orderId || '')
      const note = String(body.note || '').trim().slice(0, 300)
      if (!note) return err('Say what needs fixing, e.g. stain on collar')
      const lastWash = (await sql`SELECT id FROM order_stages WHERE order_id = ${id} AND stage = 'wash' AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`)[0]
      if (!lastWash) return err('This order wasn’t washed through the app, so it can’t be sent back')
      await sql`UPDATE order_stages SET sent_back = true, note = ${note} WHERE id = ${lastWash.id}`
      await sql`DELETE FROM order_stages WHERE order_id = ${id} AND worker_id = ${me.id} AND stage <> 'wash' AND finished_at IS NULL`
      return ok({ success: true })
    }

    return err('Unknown action')
  } catch (e) {
    return err(`Something went wrong: ${e.message}`, 500)
  }
}
