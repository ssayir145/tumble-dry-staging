// src/pages/MyOrders.jsx — customer login (phone + PIN) and account area: orders, pickups, profile

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
const BOOKING_STATUS = { new: 'Requested', contacted: 'Confirmed', converted: 'Picked up', cancelled: 'Cancelled' }
const WHATSAPP = 'https://wa.me/918899912859'
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const digits = v => v.replace(/\D/g, '')
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function Header({ signedIn }) {
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
        <div className="ps-header-actions">
          <Link className="ps-btn ps-btn-ghost" to="/">Back to site</Link>
          {signedIn && <Link className="ps-btn ps-btn-primary ps-hide-sm" to="/#book">Book a pickup</Link>}
        </div>
      </div>
    </header>
  )
}

/* ── Login / create PIN ─────────────────────────────────────── */
function LoginPage({ onLoggedIn }) {
  const [mode, setMode] = useState('login') // login | create
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
    if (mode === 'create') {
      if (!tag.trim()) return setError('Enter a tag number from one of your receipts, for example P1010.')
      if (pin !== pin2) return setError('The two PINs don’t match. Type them again.')
    }
    setBusy(true)
    try {
      const res = mode === 'create'
        ? await api.customer.setup(digits(phone), tag.trim(), pin)
        : await api.customer.signIn(digits(phone), pin)
      localStorage.setItem(CUSTOMER_TOKEN_KEY, res.token)
      onLoggedIn(res.token)
    } catch (e2) {
      setError(e2.message || 'Couldn’t log you in. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  const switchTo = m => { setMode(m); setError(''); setPin(''); setPin2('') }

  return (
    <div className="ps-account-auth">
      <div className="ps-account-intro">
        <img className="ps-login-mark" src="/posh-tulip.png" alt="" />
        <h1 className="ps-display">{mode === 'create' ? 'Create your account.' : 'Welcome back.'}</h1>
        <p>
          {mode === 'create'
            ? 'Use the mobile number you give at the store and the tag number printed on any of your receipts. That’s how we know the orders are yours.'
            : 'Log in to see what’s being cleaned, what’s ready to collect, and what you owe.'}
        </p>
        <ul className="ps-login-perks">
          <li>Track every order from received to delivered</li>
          <li>See your bills and what’s left to pay</li>
          <li>Follow your pickup requests</li>
        </ul>
      </div>

      <form className="ps-form" onSubmit={submit} noValidate>
        <div className="ps-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchTo('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'on' : ''} onClick={() => switchTo('create')}>New here?</button>
        </div>
        {error && <div className="ps-error" role="alert">{error}</div>}
        <div className="ps-field-group">
          <label className="ps-label" htmlFor="a-phone">Mobile number</label>
          <input id="a-phone" className="ps-field" inputMode="numeric" autoComplete="tel" placeholder="10 digits" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        {mode === 'create' && (
          <div className="ps-field-group">
            <label className="ps-label" htmlFor="a-tag">Tag number from a receipt</label>
            <input id="a-tag" className="ps-field" autoCapitalize="characters" placeholder="e.g. P1010" value={tag} onChange={e => setTag(e.target.value)} />
          </div>
        )}
        <div className={mode === 'create' ? 'ps-row' : ''}>
          <div className="ps-field-group">
            <label className="ps-label" htmlFor="a-pin">{mode === 'create' ? 'Choose a PIN' : 'PIN'} <span>(4–6 digits)</span></label>
            <input id="a-pin" className="ps-field ps-pin" type="password" inputMode="numeric" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} maxLength={6} value={pin} onChange={e => setPin(digits(e.target.value))} />
          </div>
          {mode === 'create' && (
            <div className="ps-field-group">
              <label className="ps-label" htmlFor="a-pin2">Type it again</label>
              <input id="a-pin2" className="ps-field ps-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2} onChange={e => setPin2(digits(e.target.value))} />
            </div>
          )}
        </div>
        <button className="ps-btn ps-btn-primary" type="submit" disabled={busy}>
          {busy ? 'Checking…' : mode === 'create' ? 'Create account' : 'Log in'}
        </button>
        <p className="ps-form-foot">
          Forgot your PIN? <a className="ps-link" href={WHATSAPP} target="_blank" rel="noreferrer">WhatsApp the store</a> and we’ll reset it.
        </p>
      </form>
    </div>
  )
}

/* ── Orders ─────────────────────────────────────────────────── */
const STAR_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent']

function Stars({ value, size = 18 }) {
  return (
    <span className="ps-stars" aria-label={`${value} out of 5 stars`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= value ? 'on' : ''} aria-hidden="true">★</span>)}
    </span>
  )
}

function RateOrder({ o, token, onRated }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (o.feedback) {
    return (
      <div className="ps-rated">
        <div><Stars value={o.feedback.rating} /> <span>You rated this order</span></div>
        {o.feedback.comment && <p>“{o.feedback.comment}”</p>}
      </div>
    )
  }

  async function submit() {
    if (!rating) return setError('Tap a star to rate.')
    setBusy(true); setError('')
    try {
      await api.customer.rateOrder(token, o.id, rating, comment)
      onRated(o.id, { rating, comment: comment.trim() })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const shown = hover || rating
  return (
    <div className="ps-rate">
      <div className="ps-rate-q">How was this order?</div>
      <div className="ps-rate-stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>★</button>
        ))}
        <span className="ps-rate-word">{STAR_WORDS[shown]}</span>
      </div>
      {rating > 0 && (
        <>
          <textarea className="ps-field" rows={3} maxLength={1000}
            placeholder={rating <= 3 ? 'What went wrong? We’ll call you to make it right.' : 'Anything you’d like to tell us? (optional)'}
            value={comment} onChange={e => setComment(e.target.value)} />
          {error && <div className="ps-error" role="alert">{error}</div>}
          <button className="ps-btn ps-btn-primary" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send rating'}</button>
        </>
      )}
      {!rating && error && <div className="ps-error" role="alert">{error}</div>}
    </div>
  )
}

function OrderCard({ o, token, onRated }) {
  const [open, setOpen] = useState(false)
  const idx = Math.max(0, STEPS.findIndex(s => s.key === o.status))
  const unpaid = o.paymentStatus !== 'Paid'
  return (
    <article className={`ps-order${o.status === 'completed' ? ' is-ready' : ''}`}>
      <div className="ps-order-top">
        <div>
          <div className="ps-order-status">{STATUS_TEXT[o.status] || o.status}</div>
          <div className="ps-order-meta">Tag {o.tagNumber}, {plural(o.totalGarments, 'piece', 'pieces')}, {o.serviceType}</div>
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
            {open ? 'Hide items' : `Show ${plural(o.items.length, 'item', 'items')}`}
          </button>
          {open && (
            <ul className="ps-order-items">
              {o.items.map((it, i) => <li key={i}><span>{it.qty} × {it.name}</span><b>₹{it.net}</b></li>)}
              {o.discountAmount > 0 && <li className="disc"><span>Discount</span><b>−₹{Math.round(o.discountAmount)}</b></li>}
            </ul>
          )}
        </>
      )}

      {(o.status === 'completed' || o.status === 'delivered') && <RateOrder o={o} token={token} onRated={onRated} />}
    </article>
  )
}

function OrdersSection({ orders, token, onRated }) {
  const [tab, setTab] = useState('active')
  const active = orders.filter(o => o.status !== 'delivered')
  const past = orders.filter(o => o.status === 'delivered')
  const shown = tab === 'active' ? active : past
  return (
    <>
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
        <div className="ps-orders">{shown.map(o => <OrderCard key={o.id} o={o} token={token} onRated={onRated} />)}</div>
      )}
    </>
  )
}

/* ── Pickups ────────────────────────────────────────────────── */
function PickupsSection({ bookings }) {
  if (!bookings.length) {
    return (
      <div className="ps-empty">
        <p>You haven’t requested a pickup online yet.</p>
        <Link className="ps-btn ps-btn-primary" to="/#book">Book a pickup</Link>
      </div>
    )
  }
  return (
    <ul className="ps-list">
      {bookings.map(b => (
        <li key={b.id}>
          <div>
            <div className="ps-list-title">{b.service_type}</div>
            <div className="ps-list-sub">{plural(b.garment_count, 'piece', 'pieces')}{b.pickup_date ? `, pickup on ${fmtDate(b.pickup_date)}` : ''}</div>
          </div>
          <b className={`ps-pill ps-pill-${b.status}`}>{BOOKING_STATUS[b.status] || b.status}</b>
        </li>
      ))}
    </ul>
  )
}

/* ── Profile ────────────────────────────────────────────────── */
function ProfileSection({ token, name, phone, onLogOut }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function changePin(e) {
    e.preventDefault()
    setMsg(null)
    if (!/^\d{4,6}$/.test(next)) return setMsg({ bad: true, text: 'Your new PIN must be 4 to 6 digits.' })
    if (next !== next2) return setMsg({ bad: true, text: 'The two new PINs don’t match.' })
    setBusy(true)
    try {
      await api.customer.changePin(token, cur, next)
      setCur(''); setNext(''); setNext2('')
      setMsg({ bad: false, text: 'PIN changed. Use the new one next time you log in.' })
    } catch (e2) {
      setMsg({ bad: true, text: e2.message })
    } finally { setBusy(false) }
  }

  return (
    <div className="ps-profile">
      <dl className="ps-profile-card">
        <div><dt>Name</dt><dd>{name || 'Not on file yet'}</dd></div>
        <div><dt>Mobile number</dt><dd>+91 {phone.slice(0, 5)} {phone.slice(5)}</dd></div>
      </dl>
      <p className="ps-profile-note">Name or number wrong? <a className="ps-link" href={WHATSAPP} target="_blank" rel="noreferrer">WhatsApp the store</a> and we’ll update it.</p>

      <form className="ps-form ps-form-flat" onSubmit={changePin} noValidate>
        <h3>Change your PIN</h3>
        {msg && <div className={msg.bad ? 'ps-error' : 'ps-success-msg'} role="status">{msg.text}</div>}
        <div className="ps-field-group">
          <label className="ps-label" htmlFor="p-cur">Current PIN</label>
          <input id="p-cur" className="ps-field ps-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={cur} onChange={e => setCur(digits(e.target.value))} />
        </div>
        <div className="ps-row">
          <div className="ps-field-group">
            <label className="ps-label" htmlFor="p-new">New PIN</label>
            <input id="p-new" className="ps-field ps-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={next} onChange={e => setNext(digits(e.target.value))} />
          </div>
          <div className="ps-field-group">
            <label className="ps-label" htmlFor="p-new2">Type it again</label>
            <input id="p-new2" className="ps-field ps-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={next2} onChange={e => setNext2(digits(e.target.value))} />
          </div>
        </div>
        <button className="ps-btn ps-btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change PIN'}</button>
      </form>

      <button className="ps-btn ps-btn-ghost ps-logout" onClick={onLogOut}>Log out</button>
    </div>
  )
}

/* ── Account shell ──────────────────────────────────────────── */
function Account({ token, onLogOut }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [section, setSection] = useState('orders')

  useEffect(() => {
    api.customer.myOrders(token).then(setData).catch(e => {
      if (e.status === 401) onLogOut()
      else setError('Couldn’t load your account. Check your connection and refresh.')
    })
  }, [token])

  if (error) return <div className="ps-error" role="alert" style={{ marginTop: 40 }}>{error}</div>
  if (!data) return <div className="ps-loading" aria-live="polite">Loading your account…</div>

  const active = data.orders.filter(o => o.status !== 'delivered')
  const ready = data.orders.filter(o => o.status === 'completed')
  const due = data.orders.filter(o => o.paymentStatus !== 'Paid').reduce((s, o) => s + o.grandTotal, 0)
  const firstName = (data.name || '').trim().split(' ')[0]

  const SECTIONS = [
    { key: 'orders',  label: 'Orders',  count: data.orders.length },
    { key: 'pickups', label: 'Pickups', count: data.bookings?.length || 0 },
    { key: 'profile', label: 'Profile' },
  ]

  return (
    <div className="ps-account">
      <div className="ps-account-head">
        <h1 className="ps-display">{firstName ? `Salaam, ${firstName}.` : 'Your account.'}</h1>
        <p>
          {ready.length > 0
            ? `${plural(ready.length, 'order is', 'orders are')} ready to collect.`
            : active.length > 0 ? `${plural(active.length, 'order', 'orders')} in progress.` : 'Nothing in progress right now.'}
        </p>
      </div>

      <div className="ps-summary">
        <div><strong>{active.length}</strong>in progress</div>
        <div><strong>{ready.length}</strong>ready to collect</div>
        <div className={due > 0 ? 'owe' : ''}><strong>₹{Math.round(due).toLocaleString('en-IN')}</strong>{due > 0 ? 'left to pay' : 'nothing to pay'}</div>
      </div>

      <nav className="ps-account-nav" aria-label="Account sections">
        {SECTIONS.map(s => (
          <button key={s.key} className={section === s.key ? 'on' : ''} aria-current={section === s.key ? 'page' : undefined} onClick={() => setSection(s.key)}>
            {s.label}{s.count !== undefined && <span>{s.count}</span>}
          </button>
        ))}
      </nav>

      {section === 'orders' && (
        <OrdersSection orders={data.orders} token={token}
          onRated={(id, fb) => setData(d => ({ ...d, orders: d.orders.map(o => o.id === id ? { ...o, feedback: fb } : o) }))} />
      )}
      {section === 'pickups' && <PickupsSection bookings={data.bookings || []} />}
      {section === 'profile' && <ProfileSection token={token} name={data.name} phone={data.phone} onLogOut={onLogOut} />}
    </div>
  )
}

export default function MyOrders() {
  const [token, setToken] = useState(() => getValidToken(localStorage, CUSTOMER_TOKEN_KEY))
  const logOut = () => { localStorage.removeItem(CUSTOMER_TOKEN_KEY); setToken(null) }
  return (
    <div className="ps">
      <Header signedIn={!!token} />
      <main className="ps-wrap ps-account-main">
        {token ? <Account token={token} onLogOut={logOut} /> : <LoginPage onLoggedIn={setToken} />}
      </main>
    </div>
  )
}
