// src/pages/MyOrders.jsx — customer sign-in (phone + PIN) and order tracking

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getValidToken, CUSTOMER_TOKEN_KEY } from '../lib/api.js'
import './customer-site.css'

const STEPS = [
  { key: 'pending',   label: 'Received' },
  { key: 'inprocess', label: 'Cleaning' },
  { key: 'completed', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
]
const STATUS_TEXT = {
  pending:   'We’ve received it',
  inprocess: 'Being cleaned',
  completed: 'Ready for pickup',
  delivered: 'Delivered',
}
const WHATSAPP = 'https://wa.me/918899912859'
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const digits = v => v.replace(/\D/g, '')

function Header() {
  return (
    <header className="ps-header">
      <div className="ps-wrap ps-header-in">
        <Link className="ps-brand" to="/" aria-label="Posh home">
          <img src="/posh-tulip.png" alt="" />
          <span>
            <span className="ps-brand-word">POSH</span>
            <span className="ps-brand-sub">Fabric care &amp; dry cleaners</span>
          </span>
        </Link>
        <Link className="ps-btn ps-btn-ghost" to="/">Back to site</Link>
      </div>
    </header>
  )
}

function AuthForm({ onSignedIn }) {
  const [mode, setMode] = useState('signin') // signin | setup
  const [phone, setPhone] = useState('')
  const [tag, setTag] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (digits(phone).length < 10) return setError('Enter your 10-digit mobile number.')
    if (!/^\d{4,6}$/.test(pin)) return setError('Your PIN must be 4 to 6 digits.')
    if (mode === 'setup') {
      if (!tag.trim()) return setError('Enter a tag number from one of your receipts, for example P1010.')
      if (pin !== pin2) return setError('The two PINs don’t match. Type them again.')
    }
    setBusy(true)
    try {
      const res = mode === 'setup'
        ? await api.customer.setup(digits(phone), tag.trim(), pin)
        : await api.customer.signIn(digits(phone), pin)
      localStorage.setItem(CUSTOMER_TOKEN_KEY, res.token)
      onSignedIn(res.token)
    } catch (e2) {
      setError(e2.message || 'Couldn’t sign you in. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  const switchTo = m => { setMode(m); setError(''); setPin(''); setPin2('') }

  return (
    <div className="ps-account-auth">
      <div className="ps-account-intro">
        <h1 className="ps-display">{mode === 'setup' ? 'Create your PIN.' : 'Your orders.'}</h1>
        <p>
          {mode === 'setup'
            ? 'Use the mobile number you give at the store, plus the tag number printed on any of your receipts. That proves the orders are yours.'
            : 'See what’s being cleaned, what’s ready, and what you owe. Sign in with your mobile number and PIN.'}
        </p>
      </div>

      <form className="ps-form" onSubmit={submit} noValidate>
        <div className="ps-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => switchTo('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'setup'} className={mode === 'setup' ? 'on' : ''} onClick={() => switchTo('setup')}>First time here?</button>
        </div>
        {error && <div className="ps-error" role="alert">{error}</div>}
        <div className="ps-field-group">
          <label className="ps-label" htmlFor="a-phone">Mobile number</label>
          <input id="a-phone" className="ps-field" inputMode="numeric" autoComplete="tel" placeholder="10 digits" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        {mode === 'setup' && (
          <div className="ps-field-group">
            <label className="ps-label" htmlFor="a-tag">Tag number from a receipt</label>
            <input id="a-tag" className="ps-field" autoCapitalize="characters" placeholder="e.g. P1010" value={tag} onChange={e => setTag(e.target.value)} />
          </div>
        )}
        <div className={mode === 'setup' ? 'ps-row' : ''}>
          <div className="ps-field-group">
            <label className="ps-label" htmlFor="a-pin">{mode === 'setup' ? 'Choose a PIN' : 'PIN'} <span>(4–6 digits)</span></label>
            <input id="a-pin" className="ps-field ps-pin" type="password" inputMode="numeric" autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} maxLength={6} value={pin} onChange={e => setPin(digits(e.target.value))} />
          </div>
          {mode === 'setup' && (
            <div className="ps-field-group">
              <label className="ps-label" htmlFor="a-pin2">Type it again</label>
              <input id="a-pin2" className="ps-field ps-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2} onChange={e => setPin2(digits(e.target.value))} />
            </div>
          )}
        </div>
        <button className="ps-btn ps-btn-primary" type="submit" disabled={busy}>
          {busy ? 'Checking…' : mode === 'setup' ? 'Create PIN and sign in' : 'Sign in'}
        </button>
        <p className="ps-form-foot">
          Forgot your PIN? <a className="ps-link" href={WHATSAPP} target="_blank" rel="noreferrer">WhatsApp the store</a> and we’ll reset it.
        </p>
      </form>
    </div>
  )
}

function OrderCard({ o }) {
  const [open, setOpen] = useState(false)
  const idx = Math.max(0, STEPS.findIndex(s => s.key === o.status))
  const unpaid = o.paymentStatus !== 'Paid'
  return (
    <article className={`ps-order${o.status === 'completed' ? ' is-ready' : ''}`}>
      <div className="ps-order-top">
        <div>
          <div className="ps-order-status">{STATUS_TEXT[o.status] || o.status}</div>
          <div className="ps-order-meta">Tag {o.tagNumber}, {o.totalGarments} {o.totalGarments === 1 ? 'piece' : 'pieces'}, {o.serviceType}</div>
        </div>
        <div className="ps-order-total">
          ₹{Math.round(o.grandTotal).toLocaleString('en-IN')}
          <span className={unpaid ? 'due' : 'paid'}>{unpaid ? (o.paymentStatus === 'Partial' ? 'Part paid' : 'To pay') : 'Paid'}</span>
        </div>
      </div>

      <ol className="ps-track" aria-label="Order progress">
        {STEPS.map((s, i) => (
          <li key={s.key} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}>
            <span className="dot" />{s.label}
          </li>
        ))}
      </ol>

      <div className="ps-order-dates">
        <span>Given on {fmtDate(o.orderDate)}</span>
        {o.deliveryDate && o.status !== 'delivered' && <span>Expected {o.deliveryDate}</span>}
      </div>

      {o.items.length > 0 && (
        <>
          <button className="ps-order-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
            {open ? 'Hide items' : `Show ${o.items.length} ${o.items.length === 1 ? 'item' : 'items'}`}
          </button>
          {open && (
            <ul className="ps-order-items">
              {o.items.map((it, i) => <li key={i}><span>{it.qty} × {it.name}</span><b>₹{it.net}</b></li>)}
              {o.discountAmount > 0 && <li className="disc"><span>Discount</span><b>−₹{Math.round(o.discountAmount)}</b></li>}
            </ul>
          )}
        </>
      )}
    </article>
  )
}

function Orders({ token, onSignOut }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')

  useEffect(() => {
    api.customer.myOrders(token).then(setData).catch(e => {
      if (e.status === 401) onSignOut()
      else setError('Couldn’t load your orders. Check your connection and refresh.')
    })
  }, [token])

  if (error) return <div className="ps-error" role="alert" style={{ marginTop: 40 }}>{error}</div>
  if (!data) return <div className="ps-loading" aria-live="polite">Loading your orders…</div>

  const active = data.orders.filter(o => o.status !== 'delivered')
  const past = data.orders.filter(o => o.status === 'delivered')
  const ready = data.orders.filter(o => o.status === 'completed')
  const due = data.orders.filter(o => o.paymentStatus !== 'Paid').reduce((s, o) => s + o.grandTotal, 0)
  const shown = tab === 'active' ? active : past
  const firstName = (data.name || '').trim().split(' ')[0]

  return (
    <div className="ps-account">
      <div className="ps-account-head">
        <div>
          <h1 className="ps-display">{firstName ? `Salaam, ${firstName}.` : 'Your orders.'}</h1>
          <p>
            {ready.length > 0
              ? `${ready.length} ${ready.length === 1 ? 'order is' : 'orders are'} ready for pickup.`
              : active.length > 0 ? `${active.length} ${active.length === 1 ? 'order' : 'orders'} in progress.` : 'Nothing in progress right now.'}
          </p>
        </div>
        <button className="ps-staff" onClick={onSignOut}>Sign out</button>
      </div>

      <div className="ps-summary">
        <div><strong>{active.length}</strong>in progress</div>
        <div><strong>{data.orders.length}</strong>orders with us</div>
        <div className={due > 0 ? 'owe' : ''}><strong>₹{Math.round(due).toLocaleString('en-IN')}</strong>{due > 0 ? 'left to pay' : 'nothing to pay'}</div>
      </div>

      <div className="ps-tabs ps-tabs-inline" role="tablist">
        <button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>In progress ({active.length})</button>
        <button role="tab" aria-selected={tab === 'past'} className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>Delivered ({past.length})</button>
      </div>

      {shown.length === 0 ? (
        <div className="ps-empty">
          <p>{tab === 'active' ? 'You have no orders in progress.' : 'No delivered orders yet.'}</p>
          <Link className="ps-btn ps-btn-primary" to="/#book">Book a pickup</Link>
        </div>
      ) : (
        <div className="ps-orders">{shown.map(o => <OrderCard key={o.id} o={o} />)}</div>
      )}

      {data.bookings?.length > 0 && (
        <section className="ps-bookings">
          <h2>Your pickup requests</h2>
          <ul>
            {data.bookings.map(b => (
              <li key={b.id}>
                <span>{b.service_type}, {b.garment_count} {b.garment_count === 1 ? 'piece' : 'pieces'}{b.pickup_date ? `, pickup ${fmtDate(b.pickup_date)}` : ''}</span>
                <b>{{ new: 'Requested', contacted: 'Confirmed', converted: 'Picked up', cancelled: 'Cancelled' }[b.status] || b.status}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default function MyOrders() {
  const [token, setToken] = useState(() => getValidToken(localStorage, CUSTOMER_TOKEN_KEY))
  const signOut = () => { localStorage.removeItem(CUSTOMER_TOKEN_KEY); setToken(null) }
  return (
    <div className="ps">
      <Header />
      <main className="ps-wrap ps-account-main">
        {token ? <Orders token={token} onSignOut={signOut} /> : <AuthForm onSignedIn={setToken} />}
      </main>
    </div>
  )
}
