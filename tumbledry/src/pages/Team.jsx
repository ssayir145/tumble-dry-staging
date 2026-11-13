// src/pages/Team.jsx — KPI phase 2: workshop now, scorecards, late-order causes, targets, workers

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { scorecards, atRisk, lateCauses, STAGE_LABEL, fmtHours } from '../lib/kpi.js'
import { Users2, UserPlus, AlertTriangle, Printer, TrendingUp, TrendingDown } from 'lucide-react'

const ROLES = { washer: 'Washerman', presser: 'Pressman', rider: 'Rider' }
const STAGE_WORD = { wash: 'Washed', press: 'Pressed', pack: 'Packed' }
const COLUMNS = [
  { key: 'to_wash',  label: 'Waiting to wash' },
  { key: 'washing',  label: 'Washing' },
  { key: 'to_press', label: 'Waiting to press / pack' },
  { key: 'pressing', label: 'Pressing / packing' },
]
const STATUS_TEXT = { green: 'On track', amber: 'Needs attention', red: 'Falling behind', none: 'No work yet' }
const RANGES = { today: 'Today', week: 'Last 7 days', month: 'Last 30 days' }
const TARGET_FIELDS = [
  ['wash_hours', 'Washing', 'hours from when the order arrives'],
  ['press_hours', 'Pressing', 'hours after washing'],
  ['pack_hours', 'Packing (Wash & Fold)', 'hours after washing'],
  ['delivery_hours', 'Delivery', 'hours after it’s given to a rider'],
  ['pickup_hours', 'Pickup', 'hours after it’s given to a rider'],
  ['green_pct', 'Green when on time at least', '% of orders'],
  ['amber_pct', 'Amber when on time at least', '% of orders (below this is red)'],
]

function periods(range) {
  const end = new Date()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  if (range === 'week') start.setDate(start.getDate() - 6)
  if (range === 'month') start.setDate(start.getDate() - 29)
  const len = end - start
  return { from: start, to: end, prevFrom: new Date(start - Math.max(len, 86400000)), prevTo: start }
}
const age = d => fmtHours((Date.now() - new Date(d)) / 3600000)

function printReport(cards, label) {
  const w = window.open('', '_blank', 'width=900,height=700')
  const rows = cards.map(c => `<tr><td>${c.worker.name}</td><td>${ROLES[c.worker.role] || 'Rider'}</td><td>${c.done}</td><td>${c.onTimePct ?? '–'}${c.onTimePct === null ? '' : '%'}</td><td>${fmtHours(c.avgHours)}</td><td>${c.issues} ${c.issueLabel}</td><td>${STATUS_TEXT[c.status]}</td></tr>`).join('')
  w.document.write(`<html><head><title>Posh team report</title><style>body{font-family:Jost,Arial,sans-serif;padding:24px;color:#2E1219}h1{letter-spacing:.3em;font-weight:500;color:#822242}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:13px}th{background:#F4EBE0}</style></head><body><h1>POSH</h1><div>Team performance: ${label}, printed ${new Date().toLocaleString('en-IN')}</div><table><tr><th>Worker</th><th>Role</th><th>Done</th><th>On time</th><th>Avg time</th><th>Quality</th><th>Status</th></tr>${rows}</table></body></html>`)
  w.document.close(); w.print()
}

export default function Team() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('now')
  const [range, setRange] = useState('week')
  const [form, setForm] = useState({ name: '', phone: '', pin: '', role: 'washer' })
  const [msg, setMsg] = useState(null)
  const [targetsDraft, setTargetsDraft] = useState(null)
  const [targetsMsg, setTargetsMsg] = useState(null)

  const load = useCallback(() => api.work.board().then(d => { setData(d); setError('') }).catch(e => setError(e.message)), [])
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])
  useEffect(() => { if (data && !targetsDraft) setTargetsDraft(data.targets) }, [data])

  const p = useMemo(() => periods(range), [range, data])
  const cards = useMemo(() => (data ? scorecards(data, p.from, p.to) : []), [data, p])
  const prevCards = useMemo(() => (data ? scorecards(data, p.prevFrom, p.prevTo) : []), [data, p])
  const risk = useMemo(() => (data ? atRisk(data.board, data.targets) : []), [data])
  const late = useMemo(() => (data ? lateCauses(data, p.from, new Date(p.to.getTime() + 1)) : null), [data, p])

  if (error) return <div className="page"><div className="fb-error">Couldn’t load the team: {error}</div></div>
  if (!data) return <div className="page" style={{ color: 'var(--tx-tertiary)' }}>Loading…</div>

  const counts = { red: cards.filter(c => c.status === 'red').length, amber: cards.filter(c => c.status === 'amber').length }

  return (
    <div className="page">
      <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Users2 size={22} strokeWidth={2} /> Team &amp; workshop
      </h1>
      <p style={{ color: 'var(--tx-secondary)', fontSize: 14, marginBottom: 16 }}>
        Each worker is timed from when an order reaches them, against the targets you set. Workers log in at <b>/work</b>.
      </p>

      <div className="fb-filters" role="tablist">
        {[['now', `Now${risk.length ? ` · ${risk.length} at risk` : ''}`], ['scores', `Scorecards${counts.red ? ` · ${counts.red} red` : ''}`], ['late', 'Late orders'], ['targets', 'Targets'], ['workers', 'Workers']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── NOW: at-risk + board ── */}
      {tab === 'now' && (
        <>
          <section className={`ax-panel${risk.length ? ' tm-risk' : ''}`}>
            <div className="ax-panel-head"><h3><AlertTriangle size={14} /> Orders at risk ({risk.length})</h3><p>Over their stage target, or will miss the promised date at target pace. Act on these first.</p></div>
            {risk.length === 0 ? <div className="ax-empty">Nothing at risk. Every order in the workshop is on pace.</div> : (
              <div className="ax-table">
                {risk.slice(0, 30).map(o => (
                  <div key={o.id} className="ax-row tm-risk-row">
                    <span><b>{o.tag}</b><small>{o.customer?.split(' ')[0]} · {o.pieces} pcs · {o.service}</small></span>
                    <span>{o.stageName}{o.holderName ? ` · with ${o.holderName.split(' ')[0]}` : ' · not started'}</span>
                    <span>Due {o.deliveryDate?.split(' ').slice(0, 2).join(' ')}</span>
                    <b className="ax-bad">{o.reasons[0]}</b>
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="tm-board">
            {COLUMNS.map(c => {
              const items = data.board.filter(o => o.phase === c.key)
              const oldest = items.reduce((m, o) => (!m || new Date(o.since) < new Date(m) ? o.since : m), null)
              const riskIds = new Set(risk.map(r => r.id))
              return (
                <section key={c.key} className="tm-col">
                  <header><span>{c.label}</span><b>{items.length}</b></header>
                  {oldest && <div className="tm-oldest">Oldest: {age(oldest)}</div>}
                  <ul>
                    {items.slice(0, 12).map(o => (
                      <li key={o.id} className={riskIds.has(o.id) ? 'risk' : ''}>
                        <b>{o.tag}</b><span>{o.pieces} pcs{o.holderName ? ` · ${o.holderName.split(' ')[0]}` : ''}{o.sentBack ? ' · re-wash' : ''}</span>
                      </li>
                    ))}
                    {items.length > 12 && <li className="tm-more">+{items.length - 12} more</li>}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}

      {/* ── SCORECARDS ── */}
      {tab === 'scores' && (
        <>
          <div className="tm-toolbar">
            <div className="fb-filters" style={{ margin: 0 }}>
              {Object.entries(RANGES).map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}
            </div>
            <button className="fb-btn" onClick={() => printReport(cards, RANGES[range])}><Printer size={13} /> Print report</button>
          </div>
          {cards.length === 0 ? <div className="ax-empty">No active workers yet. Add them under Workers.</div> : (
            <div className="tm-cards">
              {cards.map(c => {
                const prev = prevCards.find(x => x.worker.id === c.worker.id)
                const delta = c.onTimePct !== null && prev?.onTimePct != null ? c.onTimePct - prev.onTimePct : null
                return (
                  <article key={c.worker.id} className={`tm-card tm-${c.status}`}>
                    <header>
                      <div><b>{c.worker.name}</b><small>{ROLES[c.worker.role] || 'Rider'} · target {c.target}</small></div>
                      <span className="tm-pill">{STATUS_TEXT[c.status]}</span>
                    </header>
                    <div className="tm-big">
                      <strong>{c.onTimePct === null ? '–' : `${c.onTimePct}%`}</strong>
                      <span>on time</span>
                      {delta !== null && delta !== 0 && (
                        <em className={delta > 0 ? 'up' : 'down'}>{delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {Math.abs(delta)} pts vs previous</em>
                      )}
                    </div>
                    <dl>
                      <div><dt>Done</dt><dd>{c.done}{c.pieces !== null ? ` orders · ${c.pieces} pcs` : ''}</dd></div>
                      <div><dt>Average time</dt><dd>{fmtHours(c.avgHours)}</dd></div>
                      <div><dt>Quality</dt><dd className={c.issues ? 'bad' : ''}>{c.issues} {c.issueLabel}</dd></div>
                    </dl>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── LATE ORDERS ── */}
      {tab === 'late' && late && (
        <>
          <div className="tm-toolbar">
            <div className="fb-filters" style={{ margin: 0 }}>
              {Object.entries(RANGES).map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}
            </div>
          </div>
          <div className="ax-stats">
            <div className="ax-stat ax-bad"><strong>{late.total}</strong><span>Orders that missed their date</span></div>
            {['wash', 'press', 'pack', 'waiting', 'untracked'].filter(k => late.counts[k]).slice(0, 3).map(k => (
              <div key={k} className="ax-stat"><strong>{Math.round(late.counts[k] / late.total * 100)}%</strong><span>{STAGE_LABEL[k]}</span></div>
            ))}
          </div>
          <section className="ax-panel">
            <div className="ax-panel-head"><h3>Why each order was late</h3><p>The stage that went furthest over its target. “Not tracked” means the order wasn’t moved through /work.</p></div>
            {late.total === 0 ? <div className="ax-empty">No late orders in this period.</div> : (
              <div className="ax-table">
                {late.rows.map(r => (
                  <div key={r.order.id} className="ax-row">
                    <span><b>{r.order.tag_number}</b><small>{r.order.customer_name}</small></span>
                    <span>Due {r.order.delivery_date}</span>
                    <span>{STAGE_LABEL[r.cause]}{r.who ? ` (${r.who.split(' ')[0]})` : ''}</span>
                    <b className="ax-bad">{r.overBy ? `${fmtHours(r.overBy)} over` : ''}</b>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── TARGETS ── */}
      {tab === 'targets' && targetsDraft && (
        <section className="ax-panel">
          <div className="ax-panel-head"><h3>Time targets</h3><p>Set these from what’s realistic in your shop. Scores and at-risk alerts update straight away.</p></div>
          <form className="tm-targets" onSubmit={async e => {
            e.preventDefault(); setTargetsMsg(null)
            try { const r = await api.work.saveTargets(targetsDraft); setTargetsDraft(r.targets); setTargetsMsg({ ok: true, t: 'Targets saved.' }); load() }
            catch (e2) { setTargetsMsg({ ok: false, t: e2.message }) }
          }}>
            {TARGET_FIELDS.map(([k, label, unit]) => (
              <label key={k}>
                <span>{label}</span>
                <input type="number" min="1" max={k.endsWith('_pct') ? 100 : 240} value={targetsDraft[k]} onChange={e => setTargetsDraft(t => ({ ...t, [k]: e.target.value }))} />
                <small>{unit}</small>
              </label>
            ))}
            <div className="tm-targets-foot">
              {targetsMsg && <span className={targetsMsg.ok ? 'tm-ok' : 'ax-bad'}>{targetsMsg.t}</span>}
              <button className="fb-btn fb-btn-primary" type="submit">Save targets</button>
            </div>
          </form>
        </section>
      )}

      {/* ── WORKERS ── */}
      {tab === 'workers' && (
        <>
          <section className="ax-panel">
            <div className="ax-panel-head"><h3><UserPlus size={14} /> Add a worker</h3><p>Washermen and pressmen log in at <b>/work</b>; riders at <b>/rider</b>. Same phone + PIN login.</p></div>
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
          <section className="ax-panel">
            <div className="ax-panel-head"><h3>Latest activity</h3></div>
            {data.stages.filter(s => s.finished_at).length === 0 ? <div className="ax-empty">Nothing recorded yet.</div> : (
              <div className="ax-table">
                {[...data.stages].filter(s => s.finished_at).sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at)).slice(0, 40).map(s => (
                  <div key={s.id} className="ax-row">
                    <span><b>Tag {s.tag_number}</b><small>{s.pieces} pcs</small></span>
                    <span>{STAGE_WORD[s.stage]} by {s.worker_name}{s.sent_back ? `, sent back: ${s.note}` : ''}</span>
                    <span>{new Date(s.finished_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    <b className={s.on_time === false ? 'ax-bad' : 'ax-good'}>{fmtHours(s.hours_taken)}{s.on_time === false ? ' (late)' : ''}</b>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
