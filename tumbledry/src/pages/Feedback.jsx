// src/pages/Feedback.jsx — customer ratings, manager call follow-up

import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { MessageSquareHeart, Phone, PhoneCall, Check, Pencil } from 'lucide-react'

// Ratings below this many stars need a follow-up call from the manager
const CALL_BELOW = 4

const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = d => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function Stars({ n }) {
  return <span className="fb-stars" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map(i => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}</span>
}

function FeedbackCard({ f, onSaved }) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(f.call_notes || '')
  const [busy, setBusy] = useState(false)
  const called = f.status === 'called'
  const needsCall = f.rating < CALL_BELOW

  async function save() {
    setBusy(true)
    try {
      const { feedback } = called ? await api.feedback.saveNotes(f.id, notes) : await api.feedback.markCalled(f.id, notes)
      onSaved(feedback); setOpen(false)
    } catch (e) { alert('Couldn’t save: ' + e.message) } finally { setBusy(false) }
  }

  return (
    <article className={`fb-card${needsCall ? ' is-low' : ' is-happy'}${called ? ' is-called' : ''}`}>
      <div className="fb-top">
        <div>
          <div className="fb-name">{f.customer_name || 'Customer'}</div>
          <div className="fb-meta">
            Tag <b>{f.tag_number}</b>, {fmt(f.created_at)}
          </div>
        </div>
        <div className="fb-rating"><Stars n={f.rating} /><span>{f.rating}/5</span></div>
      </div>

      {f.comment ? <p className="fb-comment">“{f.comment}”</p> : <p className="fb-comment fb-empty">No comment left.</p>}

      {called && !open && (
        <div className="fb-call">
          <div className="fb-call-head"><Check size={13} strokeWidth={2.5} /> Called on {fmtTime(f.called_at)}</div>
          {f.call_notes ? <p>{f.call_notes}</p> : <p className="fb-empty">No notes added.</p>}
        </div>
      )}

      {open && (
        <div className="fb-notes">
          <label htmlFor={`n-${f.id}`}>What was discussed on the call?</label>
          <textarea id={`n-${f.id}`} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Apologised for the stain, offered a free re-clean on next visit" autoFocus />
          <div className="fb-actions">
            <button className="fb-btn fb-btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : called ? 'Save notes' : 'Confirm call and save'}</button>
            <button className="fb-btn" onClick={() => { setOpen(false); setNotes(f.call_notes || '') }}>Cancel</button>
          </div>
        </div>
      )}

      {!open && !needsCall && <div className="fb-nocall"><Check size={13} strokeWidth={2.5} /> Happy customer, no call needed</div>}

      {!open && needsCall && (
        <div className="fb-actions">
          <a className="fb-btn" href={`tel:+91${f.customer_phone}`}><Phone size={13} /> {f.customer_phone}</a>
          {called
            ? <button className="fb-btn" onClick={() => setOpen(true)}><Pencil size={13} /> Edit call notes</button>
            : <button className="fb-btn fb-btn-primary" onClick={() => setOpen(true)}><PhoneCall size={13} /> Mark as called</button>}
        </div>
      )}
    </article>
  )
}

export default function Feedback() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('new')

  useEffect(() => {
    api.feedback.getAll().then(r => setItems(r.feedback)).catch(e => setError(e.message))
  }, [])

  if (error) return <div className="page"><div className="fb-error">Couldn’t load feedback: {error}</div></div>
  if (!items) return <div className="page" style={{ color: 'var(--tx-tertiary)' }}>Loading feedback…</div>

  const avg = items.length ? items.reduce((s, f) => s + f.rating, 0) / items.length : 0
  const toCall = items.filter(f => f.rating < CALL_BELOW && f.status !== 'called')
  const low = items.filter(f => f.rating < CALL_BELOW).length
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, c: items.filter(f => f.rating === n).length }))

  const shown = (filter === 'new' ? toCall : filter === 'called' ? items.filter(f => f.status === 'called') : filter === 'happy' ? items.filter(f => f.rating >= CALL_BELOW) : items)
    .slice().sort((a, b) => filter === 'new' ? a.rating - b.rating || new Date(b.created_at) - new Date(a.created_at) : new Date(b.created_at) - new Date(a.created_at))

  const onSaved = updated => setItems(list => list.map(f => f.id === updated.id ? updated : f))

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <MessageSquareHeart size={22} strokeWidth={2} /> Customer feedback
      </h1>

      <div className="fb-summary">
        <div className="fb-summary-main">
          <div className="fb-avg">{items.length ? avg.toFixed(1) : '–'}</div>
          <div><Stars n={Math.round(avg)} /><div className="fb-sub">{items.length} {items.length === 1 ? 'rating' : 'ratings'}</div></div>
        </div>
        <div className="fb-dist">
          {dist.map(d => (
            <div key={d.n} className="fb-dist-row">
              <span>{d.n}★</span>
              <div className="fb-bar"><div style={{ transform: `scaleX(${items.length ? d.c / items.length : 0})` }} /></div>
              <span>{d.c}</span>
            </div>
          ))}
        </div>
        <div className="fb-summary-stats">
          <div><strong className={toCall.length ? 'warn' : ''}>{toCall.length}</strong>waiting for a call</div>
          <div><strong className={low ? 'bad' : ''}>{low}</strong>rated below 4 stars</div>
        </div>
      </div>

      <div className="fb-filters" role="tablist">
        {[['new', `Needs a call (${toCall.length})`], ['called', 'Called'], ['happy', '4–5 stars'], ['all', 'All']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {shown.length === 0
        ? <div className="fb-none">{filter === 'new' ? 'Every customer who left feedback has been called.' : 'No feedback here yet. Ratings appear when customers rate a ready or delivered order from their account.'}</div>
        : <div className="fb-list">{shown.map(f => <FeedbackCard key={f.id} f={f} onSaved={onSaved} />)}</div>}
    </div>
  )
}
