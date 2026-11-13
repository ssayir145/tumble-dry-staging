// src/pages/WorkQueue.jsx — washerman / pressman screen (KPI phase 1: record who did what, when)

import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const ROLE = {
  washer:  { todo: 'To wash', doing: 'Washing', start: 'Start washing', finish: 'Washed' },
  presser: { todo: 'To press or pack', doing: 'Pressing / packing', start: 'Start', finish: 'Ready' },
}
const MONTH = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
function dueDate(str) {
  const p = String(str || '').split(' '); const d = parseInt(p[0]), m = MONTH[p[1]], y = 2000 + parseInt(p[2])
  return isNaN(d) || m === undefined ? null : new Date(y, m, d, 23, 59)
}
function ago(d) {
  const h = (Date.now() - new Date(d)) / 3600000
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`
}
const time = d => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

function Card({ o, selected, onToggle, extra }) {
  const due = dueDate(o.deliveryDate)
  const late = due && due < new Date()
  const soon = due && !late && due - new Date() < 36 * 3600000
  return (
    <div className={`wq-card${selected ? ' on' : ''}${late ? ' late' : ''}`}>
      <button className="wq-pick" role="checkbox" aria-checked={selected} onClick={onToggle}>
        <span className="wq-box" aria-hidden="true">{selected ? '✓' : ''}</span>
        <span className="wq-tag">{o.tag}</span>
        <span className="wq-info">
          <b>{o.service}{o.pressStage === 'pack' && o.phase !== 'to_wash' && o.phase !== 'washing' ? ' (pack only)' : ''}</b>
          <small>{o.pieces} {o.pieces === 1 ? 'piece' : 'pieces'} · {o.customer?.split(' ')[0]} · waiting {ago(o.since || o.orderDate)}</small>
          {o.sentBack && <small className="wq-back">Sent back: {o.sentBackNote}</small>}
        </span>
        <span className={`wq-due${late ? ' late' : soon ? ' soon' : ''}`}>{late ? 'Late' : 'Due'} {o.deliveryDate?.split(' ').slice(0, 2).join(' ')}</span>
      </button>
      {extra}
    </div>
  )
}

export default function WorkQueue({ token, onLogOut }) {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('todo')
  const [sel, setSel] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [backFor, setBackFor] = useState(null)
  const [backNote, setBackNote] = useState('')

  const load = useCallback(() => api.work.queue(token).then(d => setData(d)).catch(e => { if (e.status === 401 || e.status === 403) onLogOut() }), [token])
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])
  useEffect(() => { setSel(new Set()) }, [tab])

  if (!data) return <div className="ps-loading">Loading your work…</div>
  const R = ROLE[data.me.role]
  const list = tab === 'todo' ? [...data.todo].sort((a, b) => (dueDate(a.deliveryDate) || 0) - (dueDate(b.deliveryDate) || 0)) : data.inProgress
  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function run(action, extra) {
    setBusy(true)
    try {
      const r = await api.work.act(token, action, extra)
      const msg = action === 'START' ? `Started ${r.started}` : action === 'FINISH' ? `${R.finish}: ${r.finished}` : 'Sent back to washing'
      setToast(msg); setTimeout(() => setToast(''), 2500)
      setSel(new Set()); setBackFor(null); setBackNote('')
      if (action === 'START') setTab('doing')
    } catch (e) { alert(e.message) } finally { setBusy(false); load() }
  }

  return (
    <div className="rd-main-wrap">
      <div className="rd-head">
        <div>
          <h1 className="ps-display">Salaam, {data.me.name.split(' ')[0]}.</h1>
          <p>{data.todo.length} waiting · {data.inProgress.length} with you · {data.doneToday.length} done today</p>
        </div>
        <button className="rd-link" onClick={onLogOut}>Log out</button>
      </div>

      <div className="ps-tabs" role="tablist">
        {[['todo', `${R.todo} (${data.todo.length})`], ['doing', `${R.doing} (${data.inProgress.length})`], ['done', `Done today (${data.doneToday.length})`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'done' ? (
        data.doneToday.length === 0 ? <div className="ps-empty"><p>Nothing finished yet today.</p></div> : (
          <ul className="ps-list">
            {data.doneToday.map((d, i) => (
              <li key={i}>
                <div><div className="ps-list-title">Tag {d.tag_number}, {d.pieces} pcs</div><div className="ps-list-sub">{{ wash: 'Washed', press: 'Pressed', pack: 'Packed' }[d.stage]} at {time(d.finished_at)}, took {Math.max(1, Math.round((new Date(d.finished_at) - new Date(d.started_at)) / 60000))} min</div></div>
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <div className="ps-empty"><p>{tab === 'todo' ? 'Nothing waiting. Well done.' : `Nothing in ${R.doing.toLowerCase()} right now. Pick orders from ${R.todo}.`}</p></div>
      ) : (
        <>
          <div className="wq-selectall">
            <button className="rd-link" onClick={() => setSel(sel.size === list.length ? new Set() : new Set(list.map(o => o.id)))}>{sel.size === list.length ? 'Clear selection' : 'Select all'}</button>
            <span>Tap orders to select. You can do a whole machine load at once.</span>
          </div>
          <div className="wq-list">
            {list.map(o => (
              <Card key={o.id} o={o} selected={sel.has(o.id)} onToggle={() => toggle(o.id)}
                extra={tab === 'doing' && data.me.role === 'presser' && (
                  backFor === o.id ? (
                    <div className="wq-backform">
                      <input className="ps-field" placeholder="What needs fixing? e.g. stain on collar" value={backNote} onChange={e => setBackNote(e.target.value)} />
                      <button className="ps-btn ps-btn-ghost" disabled={busy || !backNote.trim()} onClick={() => run('SEND_BACK', { orderId: o.id, note: backNote })}>Send back</button>
                      <button className="rd-link" onClick={() => setBackFor(null)}>Cancel</button>
                    </div>
                  ) : <button className="rd-link wq-backbtn" onClick={() => { setBackFor(o.id); setBackNote('') }}>Not clean? Send back to washing</button>
                )} />
            ))}
          </div>
        </>
      )}

      {data.others?.length > 0 && tab === 'doing' && (
        <p className="wq-others">Others are working on {data.others.map(o => `${o.tag} (${o.holderName.split(' ')[0]})`).join(', ')}.</p>
      )}

      {sel.size > 0 && tab !== 'done' && (
        <div className="wq-bar">
          <button className="ps-btn ps-btn-primary" disabled={busy} onClick={() => run(tab === 'todo' ? 'START' : 'FINISH', { orderIds: [...sel] })}>
            {busy ? 'Saving…' : `${tab === 'todo' ? R.start : R.finish} (${sel.size})`}
          </button>
        </div>
      )}
      {toast && <div className="rd-toast" role="status">{toast}</div>}
    </div>
  )
}
