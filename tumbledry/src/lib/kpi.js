// src/lib/kpi.js — KPI phase 2: scorecards, at-risk orders and late-order causes

const MONTH = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
const H = 3600000

// Delivery dates are stored like "19 May 26 Mon"; the promise is "by end of that day"
export function deliveryDeadline(str) {
  const p = String(str || '').trim().split(' ')
  const d = parseInt(p[0]), m = MONTH[p[1]], y = 2000 + parseInt(p[2])
  return isNaN(d) || m === undefined || isNaN(y) ? null : new Date(y, m, d, 23, 59, 59)
}

export const STAGE_LABEL = { wash: 'Washing', press: 'Pressing', pack: 'Packing', delivery: 'Delivery', pickup: 'Pickup', waiting: 'Waiting before work started', untracked: 'Not tracked in /work' }

function status(pct, issues, targets) {
  if (pct === null) return 'none'
  let s = pct >= targets.green_pct ? 'green' : pct >= targets.amber_pct ? 'amber' : 'red'
  if (issues > 0.1 && s === 'green') s = 'amber' // more than 10% redone / failed caps the score at amber
  return s
}

function inRange(d, from, to) { const t = new Date(d); return t >= from && t < to }

// One scorecard per active worker for [from, to)
export function scorecards({ workers, stages, jobs, targets }, from, to) {
  return workers.filter(w => w.active).map(w => {
    if (w.role === 'washer' || w.role === 'presser') {
      const mine = stages.filter(s => s.worker_id === w.id && s.finished_at && inRange(s.finished_at, from, to))
      const timed = mine.filter(s => !s.sent_back || w.role === 'washer')
      const onTime = timed.filter(s => s.on_time).length
      const sentBack = w.role === 'washer' ? mine.filter(s => s.sent_back).length : 0
      const hours = timed.map(s => s.hours_taken).filter(h => h !== null)
      const pct = timed.length ? Math.round(onTime / timed.length * 100) : null
      return {
        worker: w, done: mine.filter(s => !s.sent_back).length, pieces: mine.filter(s => !s.sent_back).reduce((t, s) => t + (s.pieces || 0), 0),
        onTimePct: pct, avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
        issues: sentBack, issueLabel: 'sent back for re-wash', issueRate: mine.length ? sentBack / mine.length : 0,
        status: status(pct, mine.length ? sentBack / mine.length : 0, targets),
        target: w.role === 'washer' ? `${targets.wash_hours} h to wash` : `${targets.press_hours} h press, ${targets.pack_hours} h pack`,
      }
    }
    // Riders: pickups and deliveries, timed from when the job was given to them
    const mine = jobs.filter(j => j.rider_id === w.id && (j.status === 'done' || j.status === 'failed') && j.completed_at && inRange(j.completed_at, from, to))
    const done = mine.filter(j => j.status === 'done')
    const timed = done.map(j => ({ h: (new Date(j.completed_at) - new Date(j.assigned_at || j.created_at)) / H, t: j.type === 'pickup' ? targets.pickup_hours : targets.delivery_hours }))
    const onTime = timed.filter(x => x.h <= x.t).length
    const failed = mine.length - done.length
    const pct = timed.length ? Math.round(onTime / timed.length * 100) : null
    return {
      worker: w, done: done.length, pieces: null, onTimePct: pct,
      avgHours: timed.length ? timed.reduce((a, x) => a + x.h, 0) / timed.length : null,
      issues: failed, issueLabel: 'not completed', issueRate: mine.length ? failed / mine.length : 0,
      status: status(pct, mine.length ? failed / mine.length : 0, targets),
      target: `${targets.delivery_hours} h per delivery`,
    }
  })
}

// Orders in the workshop that are over their stage target, or will miss the delivery date at target pace
export function atRisk(board, targets, now = new Date()) {
  return board.map(o => {
    const deadline = deliveryDeadline(o.deliveryDate)
    const pressT = o.pressStage === 'pack' ? targets.pack_hours : targets.press_hours
    const inWash = o.phase === 'to_wash' || o.phase === 'washing'
    const stageTarget = inWash ? targets.wash_hours : pressT
    const elapsed = (now - new Date(o.since || o.orderDate)) / H
    const over = elapsed - stageTarget
    const remaining = Math.max(0, stageTarget - elapsed) + (inWash ? pressT : 0)
    const projected = new Date(now.getTime() + remaining * H)
    const lateBy = deadline ? (projected - deadline) / H : null
    const reasons = []
    if (over > 0) reasons.push(`${fmtHours(over)} over the ${inWash ? 'washing' : o.pressStage === 'pack' ? 'packing' : 'pressing'} target`)
    if (deadline && now > deadline) reasons.push('already past the delivery date')
    else if (lateBy !== null && lateBy > 0) reasons.push('will miss the delivery date at this pace')
    return { ...o, over, lateBy, deadline, reasons, stageName: inWash ? 'Washing' : o.pressStage === 'pack' ? 'Packing' : 'Pressing' }
  }).filter(o => o.reasons.length)
    .sort((a, b) => (b.deadline && b.deadline < now) - (a.deadline && a.deadline < now) || (a.deadline || 0) - (b.deadline || 0))
}

// For orders that missed their delivery date: which stage overran the most
export function lateCauses({ orders, stages, jobs, targets }, from, to) {
  const now = new Date()
  const late = orders.filter(o => {
    const dl = deliveryDeadline(o.delivery_date)
    if (!dl || dl < from || dl >= to) return false
    const doneAt = o.ready_at ? new Date(o.ready_at) : null
    return doneAt ? doneAt > dl : now > dl
  })
  const rows = late.map(o => {
    const st = stages.filter(s => s.order_id === o.id)
    if (!st.length) return { order: o, cause: 'untracked', overBy: null }
    let worst = null
    st.forEach(s => {
      const taken = s.hours_taken ?? (now - new Date(s.reached_at)) / H
      const over = taken - s.target_hours
      if (over > 0 && (!worst || over > worst.over)) worst = { stage: s.stage, over, who: s.worker_name }
    })
    return worst ? { order: o, cause: worst.stage, overBy: worst.over, who: worst.who } : { order: o, cause: 'waiting', overBy: null }
  })
  const counts = rows.reduce((a, r) => { a[r.cause] = (a[r.cause] || 0) + 1; return a }, {})
  return { rows, counts, total: rows.length }
}

export const fmtHours = h => (h === null || h === undefined ? '–' : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${(h / 24).toFixed(1)} days`)
