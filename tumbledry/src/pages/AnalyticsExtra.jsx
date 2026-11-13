// src/pages/AnalyticsExtra.jsx — Collections, Delivery, Satisfaction and Leads tabs for Analytics

import { useEffect, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { api } from '../lib/api.js'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_IDX = Object.fromEntries(MONTHS.map((m, i) => [m, i]))
const DAY = 86400000
const CRIMSON = "#B72638", LEAF = "#3D8060", GOLD = "#C8912E"
const inr = n => `₹${Math.round(n).toLocaleString('en-IN')}`
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const normPhone = v => String(v || '').replace(/\.0+$/, '').replace(/\D/g, '').slice(-10)

// Delivery dates are stored like "19 May 26 Mon"
function parseDelivery(str) {
  const p = String(str || '').trim().split(' ')
  const d = parseInt(p[0]), m = MONTH_IDX[p[1]], y = 2000 + parseInt(p[2])
  return isNaN(d) || m === undefined || isNaN(y) ? null : new Date(y, m, d, 23, 59, 59)
}

// Last n calendar months, oldest first: [{ key: '2026-11', label: 'Nov' }]
function lastMonths(n) {
  const now = new Date(), out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` })
  }
  return out
}
const monthKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}` }

const chartBase = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { x: { grid: { display: false }, ticks: { font: { family: 'Jost' } } }, y: { beginAtZero: true, grid: { color: 'rgba(130,34,66,0.08)' }, ticks: { font: { family: 'Jost' } } } },
}

function Stat({ value, label, tone }) {
  return <div className={`ax-stat${tone ? ' ax-' + tone : ''}`}><strong>{value}</strong><span>{label}</span></div>
}
function Panel({ title, note, children }) {
  return (
    <section className="ax-panel">
      <div className="ax-panel-head"><h3>{title}</h3>{note && <p>{note}</p>}</div>
      {children}
    </section>
  )
}

/* ── Collections ─────────────────────────────────────────────── */
export function CollectionsTab({ orders }) {
  const active = orders.filter(o => !o.deleted)
  const billed = active.reduce((s, o) => s + o.grandTotal, 0)
  const paid = active.filter(o => o.paymentStatus === 'Paid')
  const collected = paid.reduce((s, o) => s + o.grandTotal, 0)
  const outstanding = billed - collected
  const months = lastMonths(6).map(m => {
    const mo = active.filter(o => monthKey(o.orderDate) === m.key)
    const b = mo.reduce((s, o) => s + o.grandTotal, 0)
    const c = mo.filter(o => o.paymentStatus === 'Paid').reduce((s, o) => s + o.grandTotal, 0)
    return { ...m, billed: b, collected: c, rate: pct(c, b) }
  })

  return (
    <>
      <div className="ax-stats">
        <Stat value={`${pct(collected, billed)}%`} label="Collection rate, all time" tone={pct(collected, billed) >= 95 ? 'good' : 'warn'} />
        <Stat value={inr(billed)} label="Billed" />
        <Stat value={inr(collected)} label="Collected" tone="good" />
        <Stat value={inr(outstanding)} label="Still to collect" tone={outstanding > 0 ? 'bad' : undefined} />
      </div>
      <Panel title="Billed and collected, last 6 months" note="Collected counts orders marked Paid. Partly paid orders count as not yet collected.">
        <div className="ax-chart">
          <Bar
            data={{ labels: months.map(m => m.label), datasets: [
              { label: 'Billed', data: months.map(m => m.billed), backgroundColor: 'rgba(130,34,66,0.16)', borderRadius: 6 },
              { label: 'Collected', data: months.map(m => m.collected), backgroundColor: LEAF, borderRadius: 6 },
            ] }}
            options={{ ...chartBase, plugins: { legend: { display: true, labels: { font: { family: 'Jost' } } } } }}
          />
        </div>
        <div className="ax-table">
          {months.map(m => (
            <div key={m.key} className="ax-row"><span>{m.label}</span><span>{inr(m.billed)} billed</span><span>{inr(m.collected)} collected</span><b className={m.billed && m.rate < 90 ? 'ax-bad' : ''}>{m.billed ? `${m.rate}%` : '–'}</b></div>
          ))}
        </div>
      </Panel>
    </>
  )
}

/* ── Delivery: on-time rate, overdue, uncollected ───────────── */
const UNCOLLECTED_DAYS = 7

export function DeliveryTab({ orders }) {
  const active = orders.filter(o => !o.deleted)
  const now = new Date()

  const tracked = active.filter(o => o.readyAt && parseDelivery(o.deliveryDate))
  const onTime = tracked.filter(o => new Date(o.readyAt) <= parseDelivery(o.deliveryDate))
  const recent = tracked.filter(o => now - new Date(o.readyAt) <= 30 * DAY)
  const recentOnTime = recent.filter(o => new Date(o.readyAt) <= parseDelivery(o.deliveryDate))

  const overdue = active
    .filter(o => (o.status === 'pending' || o.status === 'inprocess') && parseDelivery(o.deliveryDate) && parseDelivery(o.deliveryDate) < now)
    .map(o => ({ ...o, late: Math.ceil((now - parseDelivery(o.deliveryDate)) / DAY) }))
    .sort((a, b) => b.late - a.late)

  const uncollected = active
    .filter(o => o.status === 'completed')
    .map(o => {
      const since = o.readyAt ? new Date(o.readyAt) : parseDelivery(o.deliveryDate)
      return { ...o, waiting: since ? Math.floor((now - since) / DAY) : null, exact: !!o.readyAt }
    })
    .filter(o => o.waiting !== null && o.waiting >= UNCOLLECTED_DAYS)
    .sort((a, b) => b.waiting - a.waiting)
  const uncollectedValue = uncollected.reduce((s, o) => s + o.grandTotal, 0)

  const remind = o => `https://web.whatsapp.com/send?phone=91${normPhone(o.customerNumber)}&text=${encodeURIComponent(
    `Hello ${o.customerName}! Your order (Tag ${o.tagNumber}, ${o.totalGarments} pieces) is ready and waiting for you at Posh Fabric Care & Dry Cleaners, Banday Lane, Hazratbal. Please collect it at your convenience. Thank you!`)}`

  return (
    <>
      <div className="ax-stats">
        <Stat value={tracked.length ? `${pct(onTime.length, tracked.length)}%` : '–'} label={`Ready on time (${tracked.length} tracked)`} tone={tracked.length ? (pct(onTime.length, tracked.length) >= 90 ? 'good' : 'warn') : undefined} />
        <Stat value={recent.length ? `${pct(recentOnTime.length, recent.length)}%` : '–'} label="On time, last 30 days" />
        <Stat value={overdue.length} label="Late right now" tone={overdue.length ? 'bad' : 'good'} />
        <Stat value={uncollected.length} label={`Ready but not collected (${UNCOLLECTED_DAYS}+ days)`} tone={uncollected.length ? 'warn' : 'good'} />
      </div>
      {!tracked.length && (
        <p className="ax-note">On-time tracking starts now: each order records the moment it’s marked Ready, so this rate fills in as new orders move through. “Late right now” already works for every order.</p>
      )}

      <Panel title={`Ready but not collected, ${inr(uncollectedValue)} waiting`} note={`Orders marked Ready at least ${UNCOLLECTED_DAYS} days ago. Older orders without a Ready time are counted from their due date.`}>
        {uncollected.length === 0 ? <div className="ax-empty">Every ready order has been collected within {UNCOLLECTED_DAYS} days.</div> : (
          <div className="ax-table">
            {uncollected.slice(0, 50).map(o => (
              <div key={o.id} className="ax-row ax-row-5">
                <span><b>{o.customerName}</b><small>Tag {o.tagNumber}</small></span>
                <span>{o.waiting} days{o.exact ? '' : '*'}</span>
                <span>{inr(o.grandTotal)}</span>
                <span className={o.paymentStatus === 'Paid' ? 'ax-good' : 'ax-bad'}>{o.paymentStatus}</span>
                <a className="ax-wa" href={remind(o)} target="_blank" rel="noreferrer">Remind</a>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Late right now" note="Received or in process, and past the promised delivery date.">
        {overdue.length === 0 ? <div className="ax-empty">Nothing is late.</div> : (
          <div className="ax-table">
            {overdue.slice(0, 50).map(o => (
              <div key={o.id} className="ax-row">
                <span><b>{o.customerName}</b><small>Tag {o.tagNumber}</small></span>
                <span>Due {o.deliveryDate}</span>
                <span>{o.status === 'pending' ? 'Received' : 'In process'}</span>
                <b className="ax-bad">{o.late} {o.late === 1 ? 'day' : 'days'} late</b>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}

/* ── Satisfaction trend ─────────────────────────────────────── */
export function SatisfactionTab() {
  const [fb, setFb] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.feedback.getAll().then(r => setFb(r.feedback)).catch(e => setError(e.message)) }, [])
  if (error) return <div className="ax-empty">Couldn’t load ratings: {error}</div>
  if (!fb) return <div className="ax-empty">Loading ratings…</div>

  const avg = fb.length ? fb.reduce((s, f) => s + f.rating, 0) / fb.length : 0
  const low = fb.filter(f => f.rating < 4)
  const calledLow = low.filter(f => f.status === 'called' && f.called_at)
  const avgHoursToCall = calledLow.length ? calledLow.reduce((s, f) => s + (new Date(f.called_at) - new Date(f.created_at)), 0) / calledLow.length / 3600000 : null
  const months = lastMonths(6).map(m => {
    const mo = fb.filter(f => monthKey(f.created_at) === m.key)
    return { ...m, n: mo.length, avg: mo.length ? +(mo.reduce((s, f) => s + f.rating, 0) / mo.length).toFixed(2) : null, low: mo.filter(f => f.rating < 4).length }
  })

  return (
    <>
      <div className="ax-stats">
        <Stat value={fb.length ? avg.toFixed(1) + ' ★' : '–'} label={`Average rating (${fb.length})`} tone={avg >= 4.3 ? 'good' : fb.length ? 'warn' : undefined} />
        <Stat value={`${pct(low.length, fb.length)}%`} label="Rated below 4 stars" tone={low.length ? 'bad' : 'good'} />
        <Stat value={`${calledLow.length}/${low.length}`} label="Unhappy customers called" />
        <Stat value={avgHoursToCall === null ? '–' : avgHoursToCall < 24 ? `${Math.round(avgHoursToCall)} h` : `${(avgHoursToCall / 24).toFixed(1)} days`} label="Average time to call back" />
      </div>
      <Panel title="Average rating by month" note="Ratings come from customers rating ready or delivered orders in their account.">
        {fb.length === 0 ? <div className="ax-empty">No ratings yet.</div> : (
          <>
            <div className="ax-chart">
              <Line
                data={{ labels: months.map(m => m.label), datasets: [{ data: months.map(m => m.avg), borderColor: GOLD, backgroundColor: 'rgba(200,145,46,0.12)', fill: true, tension: 0.35, spanGaps: true, pointRadius: 4, pointBackgroundColor: GOLD }] }}
                options={{ ...chartBase, scales: { ...chartBase.scales, y: { ...chartBase.scales.y, beginAtZero: false, min: 1, max: 5, ticks: { stepSize: 1 } } } }}
              />
            </div>
            <div className="ax-table">
              {months.map(m => <div key={m.key} className="ax-row"><span>{m.label}</span><span>{m.n} ratings</span><span>{m.low} below 4★</span><b>{m.avg ?? '–'}</b></div>)}
            </div>
          </>
        )}
      </Panel>
    </>
  )
}

/* ── Lead conversion ────────────────────────────────────────── */
export function LeadsTab({ leads }) {
  const total = leads.length
  const by = s => leads.filter(l => l.status === s).length
  const converted = by('converted'), cancelled = by('cancelled'), open = by('new') + by('contacted')
  const closed = converted + cancelled
  const months = lastMonths(6).map(m => {
    const mo = leads.filter(l => monthKey(l.created_at) === m.key)
    const c = mo.filter(l => l.status === 'converted').length
    return { ...m, n: mo.length, c, rate: pct(c, mo.length) }
  })
  const bySvc = Object.entries(leads.reduce((a, l) => { const k = l.service_type || 'Other'; (a[k] ||= { n: 0, c: 0 }); a[k].n++; if (l.status === 'converted') a[k].c++; return a }, {}))
    .sort((a, b) => b[1].n - a[1].n)

  return (
    <>
      <div className="ax-stats">
        <Stat value={`${pct(converted, total)}%`} label={`Pickup requests that became orders (${converted}/${total})`} tone={total ? (pct(converted, total) >= 60 ? 'good' : 'warn') : undefined} />
        <Stat value={closed ? `${pct(converted, closed)}%` : '–'} label="Win rate on closed requests" />
        <Stat value={open} label="Still open (new or contacted)" tone={by('new') ? 'warn' : undefined} />
        <Stat value={cancelled} label="Cancelled" />
      </div>
      <Panel title="Requests and conversions, last 6 months">
        {total === 0 ? <div className="ax-empty">No pickup requests yet. They come from the booking form on the website.</div> : (
          <>
            <div className="ax-chart">
              <Bar
                data={{ labels: months.map(m => m.label), datasets: [
                  { label: 'Requests', data: months.map(m => m.n), backgroundColor: 'rgba(78,110,142,0.25)', borderRadius: 6 },
                  { label: 'Became orders', data: months.map(m => m.c), backgroundColor: CRIMSON, borderRadius: 6 },
                ] }}
                options={{ ...chartBase, plugins: { legend: { display: true, labels: { font: { family: 'Jost' } } } }, scales: { ...chartBase.scales, y: { ...chartBase.scales.y, ticks: { stepSize: 1, precision: 0 } } } }}
              />
            </div>
            <div className="ax-table">
              {bySvc.map(([svc, v]) => <div key={svc} className="ax-row"><span>{svc}</span><span>{v.n} requests</span><span>{v.c} orders</span><b>{pct(v.c, v.n)}%</b></div>)}
            </div>
          </>
        )}
      </Panel>
    </>
  )
}

