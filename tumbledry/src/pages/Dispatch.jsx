// src/pages/Dispatch.jsx — manager view: send riders, track pickups and deliveries, manage riders

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useStore } from '../store/index.js'
import { api } from '../lib/api.js'
import { Bike, PackageCheck, Truck, MapPin, UserPlus, RotateCcw, X } from 'lucide-react'

const fmtTime = d => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''
const mapUrl = j => j.location_lat != null ? `https://www.google.com/maps/search/?api=1&query=${j.location_lat},${j.location_lng}` : null
const STATUS = { open: 'Waiting for a rider', assigned: 'With rider', done: 'Done', failed: 'Not completed', cancelled: 'Cancelled' }

function RiderSelect({ riders, value, onChange, disabled, label = 'Rider' }) {
  return (
    <select className="dp-select" aria-label={label} value={value || ''} disabled={disabled} onChange={e => onChange(e.target.value || null)}>
      <option value="">Any rider (shared list)</option>
      {riders.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  )
}

function SendRow({ title, sub, extra, riders, onSend, onCollected }) {
  const [rider, setRider] = useState(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="dp-row">
      <div className="dp-row-main"><b>{title}</b><small>{sub}</small>{extra}</div>
      <RiderSelect riders={riders} value={rider} onChange={setRider} />
      <button className="fb-btn fb-btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await onSend(rider) } finally { setBusy(false) } }}>
        {busy ? 'Sending…' : 'Send rider'}
      </button>
      {onCollected && <button className="lead-btn dp-collected" onClick={() => confirm('Mark these clothes as collected at the store (no rider needed)?') && onCollected()}>Collected at store</button>}
    </div>
  )
}

export default function Dispatch() {
  const { orders, leads, fetchOrders, fetchLeads } = useStore()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('send')
  const [orderSearch, setOrderSearch] = useState('')
  const [newRider, setNewRider] = useState({ name: '', phone: '', pin: '' })
  const [riderMsg, setRiderMsg] = useState(null)
  const [collected, setCollected] = useState(() => new Set()) // hide instantly; server is source of truth

  const load = useCallback(() => api.dispatch.getAll().then(d => { setData(d); setError('') }).catch(e => setError(e.message)), [])
  useEffect(() => { load() }, [load])
  // Layout re-broadcasts rider updates as a window event
  useEffect(() => { const h = () => load(); window.addEventListener('posh-dispatch-changed', h); return () => window.removeEventListener('posh-dispatch-changed', h) }, [load])

  // Washermen and pressmen share the workers table; only riders do pickups and deliveries
  const riders = (data?.riders || []).filter(r => (r.role || 'rider') === 'rider')
  const jobs = data?.jobs || []
  const riderName = id => riders.find(r => r.id === id)?.name || '—'
  const active = jobs.filter(j => j.status === 'open' || j.status === 'assigned' || j.status === 'failed')
  const finished = jobs.filter(j => j.status === 'done' || j.status === 'cancelled')
  const busyLeads = new Set(jobs.filter(j => j.lead_id && (j.status === 'open' || j.status === 'assigned')).map(j => j.lead_id))
  const busyOrders = new Set(jobs.filter(j => j.order_id && (j.status === 'open' || j.status === 'assigned')).map(j => j.order_id))

  // Every request still waiting for its clothes, including ones already converted to an order
  const pickupsToSend = leads.filter(l => l.status !== 'cancelled' && !l.picked_up_at && !busyLeads.has(l.id) && !collected.has(l.id))
  const tagOf = id => orders.find(o => o.id === id)?.tagNumber
  const readyOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase()
    return orders
      .filter(o => !o.deleted && o.status === 'completed' && !busyOrders.has(o.id))
      .filter(o => !q || (o.customerName || '').toLowerCase().includes(q) || (o.tagNumber || '').toLowerCase().includes(q) || (o.customerNumber || '').includes(q))
      .sort((a, b) => new Date(b.readyAt || b.orderDate) - new Date(a.readyAt || a.orderDate))
  }, [orders, orderSearch, jobs])

  const todayStr = new Date().toDateString()
  const doneToday = jobs.filter(j => j.status === 'done' && j.completed_at && new Date(j.completed_at).toDateString() === todayStr)

  async function act(fn, refresh = []) {
    try { await fn(); await load(); refresh.forEach(r => r()) } catch (e) { alert(e.message) }
  }

  if (error) return <div className="page"><div className="fb-error">Couldn’t load pickups and deliveries: {error}</div></div>
  if (!data) return <div className="page" style={{ color: 'var(--tx-tertiary)' }}>Loading…</div>

  return (
    <div className="page">
      <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Bike size={22} strokeWidth={2} /> Pickups &amp; deliveries
      </h1>
      <p style={{ color: 'var(--tx-secondary)', fontSize: 14, marginBottom: 16 }}>
        Riders use <b>/rider</b> on their phone. When they mark a delivery done, the order becomes Delivered everywhere.
      </p>

      <div className="ax-stats">
        <div className="ax-stat ax-warn"><strong>{jobs.filter(j => j.status === 'open').length}</strong><span>Waiting for a rider</span></div>
        <div className="ax-stat"><strong>{jobs.filter(j => j.status === 'assigned').length}</strong><span>With riders now</span></div>
        <div className="ax-stat ax-good"><strong>{doneToday.length}</strong><span>Done today</span></div>
        <div className={`ax-stat${jobs.some(j => j.status === 'failed') ? ' ax-bad' : ''}`}><strong>{jobs.filter(j => j.status === 'failed').length}</strong><span>Sent back by riders</span></div>
      </div>

      <div className="fb-filters" role="tablist">
        {[['send', `To send (${pickupsToSend.length + readyOrders.length})`], ['active', `In progress (${active.length})`], ['done', 'Completed'], ['riders', `Riders (${riders.filter(r => r.active).length})`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {riders.length === 0 && tab !== 'riders' && (
        <div className="ax-note">No riders yet. Add one under <button className="dp-inline" onClick={() => setTab('riders')}>Riders</button>, then send them pickups and deliveries.</div>
      )}

      {tab === 'send' && (
        <>
          <section className="ax-panel">
            <div className="ax-panel-head"><h3><PackageCheck size={14} /> Pickup requests ({pickupsToSend.length})</h3><p>Requests whose clothes haven’t been collected yet, including ones already turned into an order. Walk-in? Mark it collected at the store.</p></div>
            {pickupsToSend.length === 0 ? <div className="ax-empty">No pickups waiting.</div> : pickupsToSend.map(l => (
              <SendRow key={l.id} riders={riders}
                title={`${l.customer_name}, ${l.service_type}`}
                sub={`${[l.customer_address, l.landmark, l.customer_city].filter(Boolean).join(', ') || 'No address'}${l.pickup_date ? ` · pickup ${l.pickup_date}` : ''}`}
                extra={<>
                  {l.location_lat != null && <span className="dp-gps"><MapPin size={11} /> GPS</span>}
                  {l.status === 'converted' && <span className="dp-conv">Order already created{l.converted_order_id && tagOf(l.converted_order_id) ? `, tag ${tagOf(l.converted_order_id)}` : ''}. Clothes still to collect.</span>}
                </>}
                onCollected={() => act(async () => { await api.leads.markCollected(l.id); setCollected(s => new Set(s).add(l.id)) }, [fetchLeads])}
                onSend={riderId => act(() => api.dispatch.createJob({ type: 'pickup', leadId: l.id, riderId }), [fetchLeads])} />
            ))}
          </section>

          <section className="ax-panel">
            <div className="ax-panel-head dp-head-search">
              <div><h3><Truck size={14} /> Ready for delivery ({readyOrders.length})</h3><p>Orders marked Ready with no rider on them.</p></div>
              <input className="dp-search" placeholder="Search name, phone or tag" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} aria-label="Search ready orders" />
            </div>
            {readyOrders.length === 0 ? <div className="ax-empty">No ready orders waiting.</div> : readyOrders.slice(0, 40).map(o => (
              <SendRow key={o.id} riders={riders}
                title={`${o.customerName}, tag ${o.tagNumber}`}
                sub={`${o.totalGarments} pcs · ₹${Math.round(o.grandTotal)} ${o.paymentStatus === 'Paid' ? 'paid' : 'to collect'}${o.customerAddress ? ` · ${o.customerAddress}` : ''}`}
                onSend={riderId => act(() => api.dispatch.createJob({ type: 'delivery', orderId: o.id, riderId }))} />
            ))}
            {readyOrders.length > 40 && <div className="ax-empty">Showing the 40 most recent. Search to find older ones.</div>}
          </section>
        </>
      )}

      {tab === 'active' && (
        <section className="ax-panel">
          {active.length === 0 ? <div className="ax-empty">Nothing in progress.</div> : active.map(j => (
            <div key={j.id} className={`dp-job dp-${j.status}`}>
              <div className="dp-row-main">
                <span className={`dp-type dp-type-${j.type}`}>{j.type === 'pickup' ? 'Pickup' : `Delivery, tag ${j.tag_number}`}</span>
                <b>{j.customer_name}</b>
                <small>{[j.address, j.landmark, j.area].filter(Boolean).join(', ') || 'No address'}{j.amount_due > 0 ? ` · collect ₹${Math.round(j.amount_due)}` : ''}</small>
                <small className="dp-status">{STATUS[j.status]}{j.status === 'assigned' ? `: ${riderName(j.rider_id)} since ${fmtTime(j.assigned_at)}` : ''}{j.status === 'failed' ? `: ${riderName(j.rider_id)} said “${j.outcome_note}”` : ''}</small>
              </div>
              <div className="dp-job-actions">
                {mapUrl(j) && <a className="lead-map" href={mapUrl(j)} target="_blank" rel="noreferrer"><MapPin size={12} /> Map</a>}
                <RiderSelect riders={riders} value={j.status === 'failed' ? null : j.rider_id} label="Reassign rider"
                  onChange={rid => act(() => api.dispatch.assign(j.id, rid))} />
                {j.status === 'failed' && <button className="lead-btn" onClick={() => act(() => api.dispatch.assign(j.id, null))}><RotateCcw size={12} /> Send again</button>}
                <button className="lead-btn lead-btn-danger" onClick={() => confirm('Cancel this job?') && act(() => api.dispatch.cancel(j.id))}><X size={12} /> Cancel</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'done' && (
        <section className="ax-panel">
          <div className="ax-panel-head"><h3>Last 30 days</h3></div>
          {finished.length === 0 ? <div className="ax-empty">Nothing completed yet.</div> : (
            <div className="ax-table">
              {finished.map(j => (
                <div key={j.id} className="ax-row ax-row-5">
                  <span><b>{j.customer_name}</b><small>{j.type === 'pickup' ? 'Pickup' : `Delivery, tag ${j.tag_number}`}</small></span>
                  <span>{riderName(j.rider_id)}</span>
                  <span>{fmtTime(j.completed_at)}</span>
                  <span>{j.type === 'delivery' && j.status === 'done' ? (j.payment_collected === 'None' ? (j.amount_due > 0 ? 'Not paid' : 'Was prepaid') : `Paid ${j.payment_collected.toLowerCase()}`) : ''}</span>
                  <b className={j.status === 'done' ? 'ax-good' : ''}>{j.status === 'done' ? (j.type === 'pickup' ? 'Picked up' : 'Delivered') : 'Cancelled'}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'riders' && (
        <>
          <section className="ax-panel">
            <div className="ax-panel-head"><h3><UserPlus size={14} /> Add a rider</h3><p>They log in at <b>/rider</b> with this phone number and PIN. Washermen and pressmen are added under Team &amp; workshop.</p></div>
            <form className="dp-add" onSubmit={async e => {
              e.preventDefault(); setRiderMsg(null)
              try { await api.dispatch.addRider(newRider.name, newRider.phone, newRider.pin); setRiderMsg({ ok: true, t: `${newRider.name} added. Share the phone and PIN with them.` }); setNewRider({ name: '', phone: '', pin: '' }); load() }
              catch (e2) { setRiderMsg({ ok: false, t: e2.message }) }
            }}>
              <input placeholder="Name" value={newRider.name} onChange={e => setNewRider(r => ({ ...r, name: e.target.value }))} aria-label="Rider name" />
              <input placeholder="Phone" inputMode="numeric" value={newRider.phone} onChange={e => setNewRider(r => ({ ...r, phone: e.target.value }))} aria-label="Rider phone" />
              <input placeholder="PIN (4–6 digits)" inputMode="numeric" maxLength={6} value={newRider.pin} onChange={e => setNewRider(r => ({ ...r, pin: e.target.value.replace(/\D/g, '') }))} aria-label="Rider PIN" />
              <button className="fb-btn fb-btn-primary" type="submit">Add rider</button>
            </form>
            {riderMsg && <div className={riderMsg.ok ? 'fb-call' : 'fb-error'} style={{ margin: '0 16px 16px' }}>{riderMsg.t}</div>}
          </section>
          <section className="ax-panel">
            {riders.length === 0 ? <div className="ax-empty">No riders yet.</div> : riders.map(r => {
              const today = doneToday.filter(j => j.rider_id === r.id).length
              const withThem = jobs.filter(j => j.rider_id === r.id && j.status === 'assigned').length
              return (
                <div key={r.id} className="dp-row">
                  <div className="dp-row-main"><b>{r.name}{!r.active && ' (switched off)'}</b><small>{r.phone} · {withThem} with them now · {today} done today</small></div>
                  <button className="lead-btn" onClick={() => { const pin = prompt(`New PIN for ${r.name} (4–6 digits)`); if (pin) act(() => api.dispatch.updateRider(r.id, { pin })) }}>Reset PIN</button>
                  <button className={`lead-btn${r.active ? ' lead-btn-danger' : ''}`} onClick={() => act(() => api.dispatch.updateRider(r.id, { active: !r.active }))}>{r.active ? 'Switch off' : 'Switch on'}</button>
                </div>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}
