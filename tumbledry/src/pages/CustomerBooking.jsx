// src/pages/CustomerBooking.jsx — Posh public website + pickup booking

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getValidToken, CUSTOMER_TOKEN_KEY } from '../lib/api.js'
import { GARMENT_RATES, SERVICE_KG_RATES } from '../lib/garments.js'
import { Account } from './MyOrders.jsx'
import './customer-site.css'

const PHONE = '8899912859'
const WHATSAPP = `https://wa.me/91${PHONE}`
const INSTAGRAM = 'https://www.instagram.com/tumbledryhazratbal'
const ADDRESS = 'Banday Lane, Dargah Hazratbal, Srinagar 190006'
const MAPS = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Banday Lane, Dargah Hazratbal, Srinagar 190006')

const r = name => GARMENT_RATES[name]
const minOf = names => Math.min(...names.map(r).filter(Boolean))

const KASHMIRI = [
  { word: 'پشمینہ', name: 'Pashmina',  price: r('Shawl Pashmina'), text: 'The finest wool from the valley. Cleaned gently, folded the way it was woven.' },
  { word: 'پھیرن',  name: 'Pheran',    price: r('Pheran Men'),     text: 'Winter’s most loved garment, cleaned and pressed with its embroidery kept intact.' },
  { word: 'شیروانی', name: 'Sherwani & achkan', price: r('Sherwani'), text: 'Wedding-season wear handled piece by piece, buttons and zari checked before it leaves.' },
  { word: 'شال',    name: 'Shawls & stoles', price: minOf(['Shawl Plain', 'Stole Plain']), text: 'Plain, heavy or very heavy, each priced by weight of the weave, never lumped together.' },
]

const SERVICES = [
  { name: 'Dry cleaning',     price: `from ₹${minOf(['Shirt', 'Pants', 'Kurta'])}`, text: 'Suits, coats, kurtas, silks and everything that says “dry clean only” on the label.' },
  { name: 'Wash & iron',      price: `₹${SERVICE_KG_RATES['Wash & Iron (Per KG)']} / kg`, text: 'Everyday clothes washed, dried and pressed, priced by weight.' },
  { name: 'Wash & fold',      price: `₹${SERVICE_KG_RATES['Wash & Fold (Per KG)']} / kg`, text: 'Fresh, soft and folded. Ideal for the family’s weekly load.' },
  { name: 'Steam ironing',    price: 'per piece', text: 'Crisp collars and sharp creases without a wash.' },
  { name: 'Premium laundry',  price: 'per piece', text: 'Extra care for delicate fabrics, whites and designer pieces.' },
  { name: 'Shoe cleaning',    price: `from ₹${r('Sport Shoes')}`, text: 'Sports shoes, leather and suede, cleaned and conditioned.' },
  { name: 'Home furnishings', price: `from ₹${minOf(['Curtain Window', 'Sofa Cover Small', 'Curtain Door'])}`, text: 'Curtains, sofa covers, quilt covers, blankets and sleeping bags.' },
  { name: 'Bridal & occasion wear', price: `from ₹${r('Saree Heavy')}`, text: 'Heavy sarees, sherwanis and wedding outfits, cleaned with their work protected.' },
]

const WINTER = [
  ['Double blanket, 2 ply', r('Blanket Double 2 Ply')],
  ['Very heavy quilt', r('Quilt Very Heavy')],
  ['Long coat', r('Long Coat')],
  ['Leather jacket', r('Leather Jacket')],
  ['Heavy shawl', r('Shawl Heavy')],
]

const BOOK_SERVICES = ['Dry Clean', 'Wash & Iron (Per KG)', 'Wash & Fold (Per KG)', 'Steam Iron', 'Premium Laundry', 'Shoe Cleaning', 'Home furnishings', 'Pashmina & shawls']

const todayISO = () => new Date().toISOString().split('T')[0]

export default function CustomerBooking() {
  const navigate = useNavigate()
  const [token, setToken] = useState(() => getValidToken(localStorage, CUSTOMER_TOKEN_KEY))
  const loggedIn = !!token
  const [section, setSection] = useState('orders')
  // Arriving here after logging in keeps the old scroll position; start at the top (account first)
  useEffect(() => { if (!window.location.hash) window.scrollTo(0, 0) }, [])
  const goToAccount = s => { setSection(s); requestAnimationFrame(() => document.getElementById('me')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  // Logged-in customers book from their account (prefilled, saved address + GPS); visitors use the form below
  const bookLink = loggedIn
    ? { href: '#me', onClick: e => { e.preventDefault(); goToAccount('book') } }
    : { href: '#book' }
  const [form, setForm] = useState({ customerName: '', customerNumber: '', customerCity: '', pickupDate: '', serviceType: 'Dry Clean', garmentCount: 1, notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    const phone = form.customerNumber.replace(/\D/g, '').slice(-10)
    if (!form.customerName.trim()) return setError('Add your name so we know who to ask for.')
    if (phone.length !== 10) return setError('Enter a 10-digit mobile number. We’ll call it to confirm the pickup.')
    if (!form.pickupDate) return setError('Choose a pickup date.')
    setError(''); setSubmitting(true)
    try {
      const res = await api.leads.create({
        customerName: form.customerName.trim(), customerNumber: phone, customerCity: form.customerCity.trim(),
        pickupDate: form.pickupDate, serviceType: form.serviceType,
        garmentCount: parseInt(form.garmentCount) || 1, notes: form.notes.trim(),
      })
      if (res.success) { setSubmitted(true); window.scrollTo(0, 0) }
      else setError(res.error || 'The booking didn’t go through. Try again, or WhatsApp us.')
    } catch {
      setError('No connection. Check your internet and try again, or WhatsApp us.')
    } finally { setSubmitting(false) }
  }

  if (submitted) {
    return (
      <div className="ps">
        <div className="ps-success">
          <div>
            <img src="/posh-tulip.png" alt="" />
            <h1 className="ps-display">Shukriya, {form.customerName.trim().split(' ')[0]}.</h1>
            <p>Your pickup request is in. We’ll call {form.customerNumber} to confirm a time for {new Date(form.pickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}.</p>
            <div className="ps-hero-ctas" style={{ justifyContent: 'center' }}>
              <a className="ps-btn ps-btn-primary" href={WHATSAPP} target="_blank" rel="noreferrer">Message us on WhatsApp</a>
              <button className="ps-btn ps-btn-ghost" onClick={() => { setSubmitted(false); setForm(f => ({ ...f, notes: '', pickupDate: '' })) }}>Book another pickup</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ps">
      <header className="ps-header">
        <div className="ps-wrap ps-header-in">
          <a className="ps-brand" href="#top" aria-label="Posh home">
            <img src="/posh-tulip.png" alt="" />
            <span>
              <span className="ps-brand-word">POSH</span>
              <span className="ps-brand-sub">Fabric care &amp; dry cleaners</span>
            </span>
          </a>
          <nav className="ps-nav" aria-label="Sections">
            <a href="#kashmir">Kashmiri wear</a>
            <a href="#services">Services</a>
            <a href="#how">How it works</a>
          </nav>
          <div className="ps-header-actions">
            {loggedIn
              ? <a className="ps-btn ps-btn-ghost" href="#me" onClick={e => { e.preventDefault(); goToAccount('orders') }}>My account</a>
              : <a className="ps-btn ps-btn-ghost" href="/account" onClick={e => { e.preventDefault(); navigate('/account') }}>Log in</a>}
            <a className="ps-btn ps-btn-primary ps-hide-sm" {...bookLink}>Book a pickup</a>
          </div>
        </div>
      </header>

      {loggedIn && (
        <section className="ps-me" id="me" aria-label="Your account">
          <div className="ps-wrap">
            <Account token={token} section={section} setSection={setSection}
              onLogOut={() => { localStorage.removeItem(CUSTOMER_TOKEN_KEY); setToken(null); window.scrollTo(0, 0) }} />
          </div>
        </section>
      )}

      <main id="top">
        {/* Hero */}
        <section className="ps-hero">
          <div className="ps-wrap ps-hero-grid">
            <div>
              <img className="ps-hero-word" src="/posh-urdu.png" alt="" aria-hidden="true" />
              <h1 className="ps-display">Clothes cared for like flowers.</h1>
              <p className="ps-hero-lede">
                In Kashmiri, <em>posh</em> means flower. From our store in Hazratbal we dry clean, wash and press
                with that same tenderness, whether it’s a school shirt or your mother’s pashmina.
              </p>
              <div className="ps-hero-ctas">
                <a className="ps-btn ps-btn-primary" {...bookLink}>Book a free pickup</a>
                <a className="ps-btn ps-btn-ghost" href="#services">See prices</a>
              </div>
              {!loggedIn && (
                <p className="ps-hero-returning">
                  Already a customer? <a className="ps-link" href="/account" onClick={e => { e.preventDefault(); navigate('/account') }}>Log in to track your orders</a>
                </p>
              )}
              <div className="ps-hero-meta">
                <div><strong>9,000+</strong>garments cleaned</div>
                <div><strong>700+</strong>families in Srinagar</div>
                <div><strong>Every piece</strong>tagged and tracked</div>
              </div>
            </div>
            <div className="ps-hero-art" aria-hidden="true">
              <div className="ring" /><div className="halo" />
              <img src="/posh-tulip.png" alt="" />
            </div>
          </div>
        </section>

        {/* Kashmiri wardrobe */}
        <section className="ps-section ps-kashmir" id="kashmir">
          <div className="ps-wrap">
            <div className="ps-section-head">
              <h2 className="ps-display">Made for a Kashmiri wardrobe.</h2>
              <p>Pashmina, pherans and wedding wear aren’t everyday cotton, so we don’t treat them that way. Each has its own care and its own price.</p>
            </div>
            <div className="ps-kashmir-grid">
              {KASHMIRI.map(k => (
                <article className="ps-kcard" key={k.name}>
                  <span className="kw" aria-hidden="true">{k.word}</span>
                  <h3>{k.name}</h3>
                  <p>{k.text}</p>
                  <div className="ps-price">from <b>₹{k.price}</b></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="ps-section" id="services">
          <div className="ps-wrap">
            <div className="ps-section-head">
              <h2 className="ps-display">Everything we clean.</h2>
              <p>Clear prices, no surprises. Your bill lists every piece, and it comes to you on WhatsApp.</p>
            </div>
            <div className="ps-services">
              {SERVICES.map(s => (
                <div className="ps-service" key={s.name}>
                  <h3>{s.name}</h3>
                  <div className="ps-price"><b>{s.price}</b></div>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Winter */}
        <section className="ps-winter" aria-labelledby="winter-h">
          <div className="ps-snow" aria-hidden="true" />
          <div className="ps-winter-in">
            <div>
              <h2 id="winter-h">Ready before Chillai Kalan.</h2>
              <p>The forty coldest days are coming. Send us your blankets, quilts and long coats now, and they’ll be fresh and warm when the valley turns white.</p>
              <div className="ps-hero-ctas"><a className="ps-btn ps-btn-light" {...bookLink}>Book a winter pickup</a></div>
            </div>
            <div className="ps-winter-list">
              {WINTER.map(([n, p]) => <div key={n}><span>{n}</span><b>₹{p}</b></div>)}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="ps-section" id="how">
          <div className="ps-wrap">
            <div className="ps-section-head">
              <h2 className="ps-display">From your door and back.</h2>
            </div>
            <ol className="ps-steps">
              <li className="ps-step"><h3>Book a pickup</h3><p>Fill the form below or WhatsApp us. It takes a minute.</p></li>
              <li className="ps-step"><h3>We collect</h3><p>We call to confirm a time and pick up from your home.</p></li>
              <li className="ps-step"><h3>Cleaned and tagged</h3><p>Every piece gets a tag number, so nothing is ever mixed up.</p></li>
              <li className="ps-step"><h3>Back to you</h3><p>You get a WhatsApp when it’s ready, with your bill and delivery date.</p></li>
            </ol>
          </div>
        </section>

        {/* Booking */}
        <section className="ps-section" id="book">
          <div className="ps-wrap ps-book-grid">
            <div className="ps-visit">
              <h2 className="ps-display">Khush aamdeed.</h2>
              <p style={{ color: '#5A3A43', maxWidth: '30em' }}>Welcome. Book a pickup and we’ll come to you, or drop in at the store near the Dargah.</p>
              <dl>
                <div><dt>Store</dt><dd><a className="ps-link" href={MAPS} target="_blank" rel="noreferrer">{ADDRESS}</a></dd></div>
                <div><dt>Call or WhatsApp</dt><dd><a className="ps-link" href={`tel:+91${PHONE}`}>+91 88999 12859</a></dd></div>
                <div><dt>Instagram</dt><dd><a className="ps-link" href={INSTAGRAM} target="_blank" rel="noreferrer">@tumbledryhazratbal</a></dd></div>
              </dl>
            </div>

            {loggedIn ? (
              <div className="ps-form ps-form-loggedin">
                <h3>You’re logged in</h3>
                <p>Book from your account and we’ll use your saved address and location, so our rider comes straight to your door.</p>
                <button className="ps-btn ps-btn-primary" onClick={() => goToAccount('book')}>Book a pickup</button>
              </div>
            ) : (
              <form className="ps-form" onSubmit={handleSubmit} noValidate>
                <h3>Book a pickup</h3>
                <p>We’ll call you to confirm the time.</p>
                {error && <div className="ps-error" role="alert">{error}</div>}
                <div className="ps-field-group">
                  <label className="ps-label" htmlFor="b-name">Your name</label>
                  <input id="b-name" className="ps-field" autoComplete="name" value={form.customerName} onChange={e => setField('customerName', e.target.value)} />
                </div>
                <div className="ps-row">
                  <div className="ps-field-group">
                    <label className="ps-label" htmlFor="b-phone">Mobile number</label>
                    <input id="b-phone" className="ps-field" inputMode="numeric" autoComplete="tel" placeholder="10 digits" value={form.customerNumber} onChange={e => setField('customerNumber', e.target.value)} />
                  </div>
                  <div className="ps-field-group">
                    <label className="ps-label" htmlFor="b-date">Pickup date</label>
                    <input id="b-date" type="date" className="ps-field" min={todayISO()} value={form.pickupDate} onChange={e => setField('pickupDate', e.target.value)} />
                  </div>
                </div>
                <div className="ps-field-group">
                  <label className="ps-label" htmlFor="b-area">Area <span>(optional)</span></label>
                  <input id="b-area" className="ps-field" placeholder="e.g. Hazratbal, Nishat, Rajbagh" value={form.customerCity} onChange={e => setField('customerCity', e.target.value)} />
                </div>
                <div className="ps-row">
                  <div className="ps-field-group">
                    <label className="ps-label" htmlFor="b-svc">Service</label>
                    <select id="b-svc" className="ps-field" value={form.serviceType} onChange={e => setField('serviceType', e.target.value)}>
                      {BOOK_SERVICES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="ps-field-group">
                    <label className="ps-label" htmlFor="b-count">Number of pieces</label>
                    <input id="b-count" type="number" min="1" className="ps-field" value={form.garmentCount} onChange={e => setField('garmentCount', e.target.value)} />
                  </div>
                </div>
                <div className="ps-field-group">
                  <label className="ps-label" htmlFor="b-notes">Anything we should know? <span>(optional)</span></label>
                  <textarea id="b-notes" className="ps-field" placeholder="Stains, delicate fabrics, a good time to call" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                </div>
                <button className="ps-btn ps-btn-primary" type="submit" disabled={submitting}>{submitting ? 'Booking…' : 'Request pickup'}</button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="ps-footer">
        <div className="ps-wrap">
          <img className="ps-footer-word" src="/posh-urdu.png" alt="" aria-hidden="true" />
          <p>Posh Fabric Care &amp; Dry Cleaners, Hazratbal, Srinagar</p>
          <p>Shukriya for trusting us with your clothes.</p>
          <small>
            © {new Date().getFullYear()} Posh ·{' '}
            <button className="ps-staff" onClick={() => navigate('/pos')}>Staff sign-in</button>
          </small>
        </div>
      </footer>
    </div>
  )
}
