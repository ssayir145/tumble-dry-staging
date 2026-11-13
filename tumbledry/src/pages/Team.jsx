// src/pages/Team.jsx — KPI phase 1: workshop board + who did what, when (no targets yet)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { Users2, UserPlus } from 'lucide-react'

const ROLES = { washer: 'Washerman', presser: 'Pressman', rider: 'Rider' }
const STAGE_WORD = { wash: 'Washed', press: 'Pressed', pack: 'Packed' }
const COLUMNS = [
  { key: 'to_wash',  label: 'Waiting to wash' },
  { key: 'washing',  label: 'Washing' },
  { key: 'to_press', label: 'Waiting to press / pack' },
  { key: 'pressing', label: 'Pressing / packing' },
]
const hours = ms => ms / 3600000
const fmtDur = mins => (mins < 1 ? 'under 1 min' : mins < 60 ? `${Math.round(mins)} min` : `${(mins / 60).toFixed(1)} h`)
const age = d => { const h = hours(Date.now() - new Date(d)); return h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d` }
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

function workerStats(stages, workerId, since) {
  const mine = stages.filter(s => s.worker_id === workerId && new Date(s.started_at) >= since)
  const done = mine.filter(s => s.finished_at && !s.sent_back)
  const mins = done.map(s => (new Date(s.finished_at) - new Date(s.started_at)) / 60000)
  return {
    orders: done.length,
    pieces: done.reduce((t, s) => t + (s.pieces || 0), 0),
    avgMin: mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : null,
    sentBack: mine.filter(s => s.sent_back).length,
    holding: stages.filter(s => s.worker_id === workerId && !s.finished_at && !s.sent_back).length,
  }
}

export default function Team() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState('today')
  const [form, setForm] = useState({ name: '', phone: '', pin: '', role: 'washer' })
  const [msg, setMsg] = useState(null)

  const load = useCallback(() => api.work.board().then(d => { setData(d); setError('') }).catch(e => setError(e.message)), [])
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])

  const since = useMemo(() => { const d = startOfToday(); if (range === 'week') d.setDate(d.getDate() - 6); if (range === 'month') d.setDate(d.getDate() - 29); return d }, [range, data])

  if (error) return <div className="page"><div className="fb-error">Couldn’t load the team: {error}</div></div>
  if (!data) return <div className="page" style={{ color: 'var(--tx-tertiary)' }}>Loading…</div>

  const shop = data.workers.filter(w => w.role === 'washer' || w.role === 'presser')
  const recent = data.stages.filter(s => s.finished_at).slice(0, 40)

  return (
    <div className="page">
      <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Users2 size={22} strokeWidth={2} /> Team &amp; workshop
      </h1>
      <p style={{ color: 'var(--tx-secondary)', fontSize: 14, marginBottom: 16 }}>
        Phase 1: recording who washes, presses and packs each order, and how long it takes. Workers log in at <b>/work</b>. Targets and scores come in phase 2.
      </p>

      {/* Workshop board */}
      <div className="tm-board">
        {COLUMNS.map(c => {
          const items = data.board.filter(o => o.phase === c.key)
          const oldest = items.reduce((m, o) => (!m || new Date(o.since) < new Date(m) ? o.since : m), null)
          return (
            <section key={c.key} className="tm-col">
              <header><span>{c.label}</span><b>{items.length}</b></header>
              {oldest && <div className="tm-oldest">Oldest: {age(oldest)}</div>}
              <ul>
                {items.slice(0, 12).map(o => (
                  <li key={o.id}>
                    <b>{o.tag}</b><span>{o.pieces} pcs{o.holderName ? ` · ${o.holderName.split(' ')[0]}` : ''}{o.sentBack ? ' · sent back' : ''}</span>
                  </li>
                ))}
                {items.length > 12 && <li className="tm-more">+{items.length - 12} more</li>}
              </ul>
            </section>
          )
        })}
      </div>

      {/* Per-worker activity */}
      <section className="ax-panel">
        <div className="ax-panel-head dp-head-search">
          <div><h3>Who did what</h3><p>Orders finished, pieces, average time per order, and orders the pressman sent back to washing.</p></div>
          <div className="fb-filters" style={{ margin: 0 }}>
            {[['today', 'Today'], ['week', '7 days'], ['month', '30 days']].map(([k, l]) => (
              <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>
            ))}
          </div>
        </div>
        {shop.length === 0 ? <div className="ax-empty">No washermen or pressmen yet. Add them below.</div> : (
          <div className="ax-table">
            <div className="ax-row tm-row tm-head"><span>Worker</span><span>Orders</span><span>Pieces</span><span>Avg time</span><span>Sent back</span><span>Working on now</span></div>
            {shop.map(w => {
              const s = workerStats(data.stages, w.id, since)
              return (
                <div key={w.id} className="ax-row tm-row">
                  <span><b>{w.name}{!w.active && ' (off)'}</b><small>{ROLES[w.role]}</small></span>
                  <span className="mono">{s.orders}</span>
                  <span className="mono">{s.pieces}</span>
                  <span>{s.avgMin === null ? '–' : fmtDur(s.avgMin)}</span>
                  <span className={w.role === 'washer' && s.sentBack ? 'ax-bad' : ''}>{w.role === 'washer' ? s.sentBack : '–'}</span>
                  <span>{s.holding}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section className="ax-panel">
        <div className="ax-panel-head"><h3>Latest activity</h3></div>
        {recent.length === 0 ? <div className="ax-empty">Nothing recorded yet. Activity appears as workers mark orders in /work.</div> : (
          <div className="ax-table">
            {recent.map(s => (
              <div key={s.id} className="ax-row">
                <span><b>Tag {s.tag_number}</b><small>{s.pieces} pcs</small></span>
                <span>{STAGE_WORD[s.stage]} by {s.worker_name}{s.sent_back ? `, sent back by the pressman: ${s.note}` : ''}</span>
                <span>{new Date(s.finished_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                <b>{fmtDur((new Date(s.finished_at) - new Date(s.started_at)) / 60000)}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Workers */}
      <section className="ax-panel">
        <div className="ax-panel-head"><h3><UserPlus size={14} /> Add a washerman or pressman</h3><p>They log in at <b>/work</b> with this phone number and PIN. Riders are added the same way and also appear under Pickups &amp; deliveries.</p></div>
        <form className="dp-add tm-add" onSubmit={async e => {
          e.preventDefault(); setMsg(null)
          try { await api.dispatch.addRider(form.name, form.phone, form.pin, form.role); setMsg({ ok: true, t: `${form.name} added as ${ROLES[form.role].toLowerCase()}.` }); setForm(f => ({ ...f, name: '', phone: '', pin: '' })); load() }
          catch (e2) { setMsg({ ok: false, t: e2.message }) }
        }}>
          <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} aria-label="Name" />
          <input placeholder="Phone" inputMode="numeric" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} aria-label="Phone" />
          <input placeholder="PIN (4–6 digits)" inputMode="numeric" maxLength={6} value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))} aria-label="PIN" />
          <select className="dp-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} aria-label="Role">
            {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="fb-btn fb-btn-primary" type="submit">Add</button>
        </form>
        {msg && <div className={msg.ok ? 'fb-call' : 'fb-error'} style={{ margin: '0 16px 16px' }}>{msg.t}</div>}
        {data.workers.map(w => (
          <div key={w.id} className="dp-row">
            <div className="dp-row-main"><b>{w.name}{!w.active && ' (switched off)'}</b><small>{ROLES[w.role] || 'Rider'} · {w.phone}</small></div>
            <select className="dp-select" value={w.role || 'rider'} aria-label={`Role for ${w.name}`} onChange={async e => { await api.dispatch.updateRider(w.id, { role: e.target.value }); load() }}>
              {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <span className="tm-actions">
              <button className="lead-btn" onClick={async () => { const pin = prompt(`New PIN for ${w.name} (4–6 digits)`); if (pin) { try { await api.dispatch.updateRider(w.id, { pin }) } catch (e2) { alert(e2.message) } } }}>Reset PIN</button>
              <button className={`lead-btn${w.active ? ' lead-btn-danger' : ''}`} onClick={async () => { await api.dispatch.updateRider(w.id, { active: !w.active }); load() }}>{w.active ? 'Switch off' : 'Switch on'}</button>
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}
