// src/pages/RiderApp.jsx — rider app: pickups and deliveries on the phone

import { useEffect, useState, useCallback } from 'react'
import Pusher from 'pusher-js'
import { api, getValidToken, RIDER_TOKEN_KEY } from '../lib/api.js'
import './customer-site.css'
import './rider.css'
import WorkQueue from './WorkQueue.jsx'

const ROLE_KEY = 'posh-worker-role'
const ROLE_LABEL = { rider: 'Riders', washer: 'Washing', presser: 'Pressing & packing' }

const STORE_PHONE = '8899912859'
const digits = v => String(v || '').replace(/\D/g, '')
const navUrl = j => j.location_lat != null
  ? `https://www.google.com/maps/dir/?api=1&destination=${j.location_lat},${j.location_lng}`
  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([j.address, j.landmark, j.area, 'Srinagar'].filter(Boolean).join(', '))}`
const time = d => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

function Login({ onIn }) {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setError('')
    if (digits(phone).length < 10) return setError('Enter your 10-digit phone number.')
    setBusy(true)
    try {
      const r = await api.rider.signIn(digits(phone), pin)
      localStorage.setItem(RIDER_TOKEN_KEY, r.token); localStorage.setItem(ROLE_KEY, r.workerRole || 'rider'); onIn(r.token, r.workerRole || 'rider')
    } catch (e2) { setError(e2.message) } finally { setBusy(false) }
  }
  return (
    <div className="rd-login">
      <img src="/posh-tulip.png" alt="" />
      <h1 className="ps-display">Staff login</h1>
      <p>Riders, washermen and pressmen</p>
      <form className="ps-form" onSubmit={submit} noValidate>
        {error && <div className="ps-error" role="alert">{error}</div>}
        <div className="ps-field-group">
          <label className="ps-label" htmlFor="r-phone">Phone number</label>
          <input id="r-phone" className="ps-field" inputMode="numeric" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="ps-field-group">
          <label className="ps-label" htmlFor="r-pin">PIN</label>
          <input id="r-pin" className="ps-field ps-pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(digits(e.target.value))} />
        </div>
        <button className="ps-btn ps-btn-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
        <p className="ps-form-foot">Forgot your PIN? Ask the store manager to reset it.</p>
      </form>
    </div>
  )
}

function JobCard({ j, mode, onAction }) {
  const [step, setStep] = useState(null) // 'deliver' | 'fail'
  const [payment, setPayment] = useState(j.amount_due > 0 ? '' : 'None')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const pickup = j.type === 'pickup'

  async function run(action, extra = {}) {
    setBusy(true)
    try { await onAction(action, j.id, extra) } finally { setBusy(false) }
  }

  return (
    <article className={`rd-job rd-${j.type}`}>
      <div className="rd-job-top">
        <span className="rd-kind">{pickup ? 'Pickup' : 'Delivery'}{j.tag_number ? `, tag ${j.tag_number}` : ''}</span>
        {j.scheduled_for && <span className="rd-when">{pickup ? 'Pickup on ' : 'Due '}{j.scheduled_for}</span>}
      </div>
      <h3>{j.customer_name || 'Customer'}</h3>
      <p className="rd-addr">
        {[j.address, j.landmark && (/^near\b/i.test(j.landmark) ? j.landmark : `near ${j.landmark}`), j.area].filter(Boolean).join(', ') || 'No address given. Call the customer.'}
      </p>
      <div className="rd-facts">
        {j.pieces > 0 && <span>{j.pieces} {j.pieces === 1 ? 'piece' : 'pieces'}</span>}
        {!pickup && (j.amount_due > 0 ? <span className="rd-collect">Collect ₹{Math.round(j.amount_due)}</span> : <span className="rd-paid">Already paid</span>)}
        {j.location_lat != null && <span className="rd-gps">Exact location shared</span>}
      </div>
      {j.note && <p className="rd-note">Manager: {j.note}</p>}

      <div className="rd-actions">
        <a className="ps-btn ps-btn-ghost" href={`tel:+91${j.customer_phone}`}>Call</a>
        <a className="ps-btn ps-btn-ghost" href={navUrl(j)} target="_blank" rel="noreferrer">Navigate</a>
      </div>

      {mode === 'available' && (
        <button className="ps-btn ps-btn-primary rd-main" disabled={busy} onClick={() => run('ACCEPT')}>{busy ? 'Taking…' : 'Accept this job'}</button>
      )}

      {mode === 'mine' && !step && (
        <>
          {pickup
            ? <button className="ps-btn ps-btn-primary rd-main" disabled={busy} onClick={() => run('PICKED_UP')}>{busy ? 'Saving…' : 'Picked up'}</button>
            : <button className="ps-btn ps-btn-primary rd-main" onClick={() => setStep('deliver')}>Delivered</button>}
          <button className="rd-link" onClick={() => setStep('fail')}>Couldn’t complete this</button>
        </>
      )}

      {mode === 'mine' && step === 'deliver' && (
        <div className="rd-step">
          {j.amount_due > 0 ? (
            <>
              <div className="rd-q">Did the customer pay ₹{Math.round(j.amount_due)}?</div>
              <div className="rd-choice" role="radiogroup">
                {[['Cash', 'Paid cash'], ['Online', 'Paid online'], ['None', 'Not paid']].map(([k, l]) => (
                  <button key={k} role="radio" aria-checked={payment === k} className={payment === k ? 'on' : ''} onClick={() => setPayment(k)}>{l}</button>
                ))}
              </div>
            </>
          ) : <div className="rd-q">This order is already paid.</div>}
          <button className="ps-btn ps-btn-primary rd-main" disabled={busy || !payment} onClick={() => run('DELIVERED', { payment })}>{busy ? 'Saving…' : 'Confirm delivered'}</button>
          <button className="rd-link" onClick={() => setStep(null)}>Back</button>
        </div>
      )}

      {mode === 'mine' && step === 'fail' && (
        <div className="rd-step">
          <label className="rd-q" htmlFor={`f-${j.id}`}>What happened?</label>
          <textarea id={`f-${j.id}`} className="ps-field" rows={2} placeholder="e.g. Customer not home, phone switched off" value={note} onChange={e => setNote(e.target.value)} />
          <button className="ps-btn ps-btn-primary rd-main" disabled={busy || !note.trim()} onClick={() => run('FAILED', { reason: note })}>{busy ? 'Sending…' : 'Send back to manager'}</button>
          <button className="rd-link" onClick={() => setStep(null)}>Back</button>
        </div>
      )}
    </article>
  )
}

function Jobs({ token, onLogOut }) {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('mine')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(() => api.rider.jobs(token).then(d => { setData(d); setError('') }).catch(e => {
    if (e.status === 401) onLogOut(); else setError('Couldn’t load jobs. Check your internet.')
  }), [token])

  useEffect(() => { load() }, [load])
  // Live updates when the manager sends a new job; fallback refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30000)
    const key = import.meta.env.VITE_PUSHER_KEY, cluster = import.meta.env.VITE_PUSHER_CLUSTER
    if (!key || !cluster) return () => clearInterval(id)
    const p = new Pusher(key, { cluster }); const ch = p.subscribe('posh-dispatch'); ch.bind('changed', load)
    return () => { clearInterval(id); ch.unbind_all(); p.unsubscribe('posh-dispatch'); p.disconnect() }
  }, [load])

  async function onAction(action, jobId, extra) {
    try {
      await api.rider.act(token, action, jobId, extra)
      const msg = { ACCEPT: 'Job added to your list', PICKED_UP: 'Marked as picked up', DELIVERED: 'Marked as delivered', FAILED: 'Sent back to the manager' }[action]
      setToast(msg); setTimeout(() => setToast(''), 2500)
      if (action === 'ACCEPT') setTab('mine')
    } catch (e) { alert(e.message) }
    await load()
  }

  if (!data) return <div className="ps-loading">{error || 'Loading your jobs…'}</div>
  const lists = { mine: data.mine, available: data.available, done: data.done }
  const shown = lists[tab]

  return (
    <div className="rd-main-wrap">
      <div className="rd-head">
        <div>
          <h1 className="ps-display">Salaam, {data.me.name.split(' ')[0]}.</h1>
          <p>{data.mine.length ? `${data.mine.length} ${data.mine.length === 1 ? 'job' : 'jobs'} to do` : 'No jobs assigned to you right now.'}</p>
        </div>
        <button className="rd-link" onClick={onLogOut}>Log out</button>
      </div>
      {error && <div className="ps-error">{error}</div>}
      <div className="ps-tabs" role="tablist">
        {[['mine', `My jobs (${data.mine.length})`], ['available', `Available (${data.available.length})`], ['done', `Done today (${data.done.length})`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="ps-empty"><p>{tab === 'mine' ? 'Nothing assigned. Check Available for open jobs.' : tab === 'available' ? 'No open jobs right now.' : 'Nothing finished yet today.'}</p></div>
      ) : tab === 'done' ? (
        <ul className="ps-list">
          {shown.map(j => (
            <li key={j.id}>
              <div>
                <div className="ps-list-title">{j.type === 'pickup' ? 'Pickup' : 'Delivery'}, {j.customer_name}</div>
                <div className="ps-list-sub">{time(j.completed_at)}{j.payment_collected && j.payment_collected !== 'None' ? `, collected by ${j.payment_collected.toLowerCase()}` : ''}{j.outcome_note ? `. ${j.outcome_note}` : ''}</div>
              </div>
              <b className={`ps-pill ${j.status === 'done' ? 'ps-pill-converted' : 'ps-pill-cancelled'}`}>{j.status === 'done' ? (j.type === 'pickup' ? 'Picked up' : 'Delivered') : 'Not done'}</b>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rd-jobs">{shown.map(j => <JobCard key={j.id} j={j} mode={tab} onAction={onAction} />)}</div>
      )}

      <a className="rd-store" href={`tel:+91${STORE_PHONE}`}>Call the store</a>
      {toast && <div className="rd-toast" role="status">{toast}</div>}
    </div>
  )
}

export default function RiderApp() {
  const [token, setToken] = useState(() => getValidToken(localStorage, RIDER_TOKEN_KEY))
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY) || 'rider')
  const logOut = () => { localStorage.removeItem(RIDER_TOKEN_KEY); localStorage.removeItem(ROLE_KEY); setToken(null) }
  return (
    <div className="ps rd">
      <header className="ps-header">
        <div className="ps-wrap ps-header-in">
          <span className="ps-brand">
            <img src="/posh-tulip.png" alt="" />
            <span><span className="ps-brand-word">POSH</span><span className="ps-brand-sub">{token ? ROLE_LABEL[role] : 'Team'}</span></span>
          </span>
        </div>
      </header>
      <main className="ps-wrap">{!token ? <Login onIn={(t, r) => { setRole(r); setToken(t) }} />
        : role === 'washer' || role === 'presser' ? <WorkQueue token={token} onLogOut={logOut} />
        : <Jobs token={token} onLogOut={logOut} />}</main>
    </div>
  )
}
