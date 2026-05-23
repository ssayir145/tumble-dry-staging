// src/pages/CustomerBooking.jsx — Public customer booking page

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

const SERVICES = [
  'Dry Clean', 'Wash & Iron', 'Iron Only',
  'Wash Only', 'Premium Wash', 'Shoe Cleaning',
]

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function CustomerBooking() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    customerName: '',
    customerNumber: '',
    customerCity: '',
    pickupDate: '',
    serviceType: 'Dry Clean',
    garmentCount: 1,
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Load Google Fonts for this page
  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,900&family=DM+Sans:wght@400;500;600;700&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => { if (document.head.contains(link)) document.head.removeChild(link) }
  }, [])

  function setField(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.customerName.trim()) return setError('Please enter your name.')
    if (!form.customerNumber.trim() || form.customerNumber.trim().length < 10) return setError('Please enter a valid 10-digit phone number.')
    if (!form.pickupDate) return setError('Please select a preferred pickup date.')
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        customerName:    form.customerName.trim(),
        customerNumber:  form.customerNumber.trim(),
        customerCity:    form.customerCity.trim(),
        pickupDate:      form.pickupDate,
        serviceType:     form.serviceType,
        garmentCount:    parseInt(form.garmentCount) || 1,
        notes:           form.notes.trim(),
      }
      const res = await api.leads.create(payload)
      if (res.success) {
        setSubmitted(true)
      } else {
        setError(res.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Could not connect. Please check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={pg}>
        <style>{CSS}</style>
        <div className="cb-success-card">
          <div className="cb-check">✓</div>
          <h2 className="cb-success-h">Booking Received!</h2>
          <p className="cb-success-p">
            We've received your request and will contact you to confirm your pickup slot.
          </p>
          <div className="cb-info-rows">
            <div className="cb-info-row">
              <span className="cb-info-label">Store</span>
              <span className="cb-info-val">Tumbledry Hazratbal</span>
            </div>
            <div className="cb-info-row">
              <span className="cb-info-label">Address</span>
              <span className="cb-info-val">Banday Lane, Dargah Hazratbal, 190006</span>
            </div>
            <div className="cb-info-row">
              <span className="cb-info-label">Call / WhatsApp</span>
              <span className="cb-info-val">+91 88999 12859</span>
            </div>
          </div>
          <a
            href="https://wa.me/918899912859"
            target="_blank"
            rel="noreferrer"
            className="cb-wa-btn"
          >
            <WaIcon /> Chat on WhatsApp
          </a>
          <button
            className="cb-another-btn"
            onClick={() => { setSubmitted(false); setForm({ customerName:'',customerNumber:'',customerCity:'',pickupDate:'',serviceType:'Dry Clean',garmentCount:1,notes:'' }) }}
          >
            Book Another
          </button>
        </div>
        <button className="cb-admin-link" onClick={() => navigate('/pos')}>Staff Login →</button>
      </div>
    )
  }

  return (
    <div style={pg}>
      <style>{CSS}</style>

      {/* Hero */}
      <header className="cb-hero">
        <div className="cb-hero-bg" aria-hidden="true">
          <div className="cb-blob cb-blob-1" />
          <div className="cb-blob cb-blob-2" />
          <div className="cb-garment-bg" aria-hidden="true">
            <ShirtBg />
          </div>
        </div>

        <div className="cb-hero-inner">
          <div className="cb-logo-row">
            <div className="cb-logo-icon"><ShirtIcon /></div>
            <div>
              <div className="cb-logo-name">Tumbledry</div>
              <div className="cb-logo-loc">Hazratbal · Srinagar</div>
            </div>
          </div>
          <h1 className="cb-hero-title">
            Fresh clothes,<br />
            <em>delivered to your door.</em>
          </h1>
          <p className="cb-hero-sub">
            Professional dry cleaning &amp; laundry in Srinagar.<br />
            Book a pickup in under a minute.
          </p>
          <div className="cb-pills">
            {['Dry Clean','Wash & Iron','Shoe Cleaning','Premium Wash'].map(s => (
              <span key={s} className="cb-pill">{s}</span>
            ))}
          </div>
        </div>
      </header>

      {/* Form section */}
      <section className="cb-form-section">
        <div className="cb-form-card">
          <div className="cb-form-header">
            <div className="cb-form-step">Book a Pickup</div>
            <p className="cb-form-desc">We'll call to confirm your slot.</p>
          </div>

          <form onSubmit={handleSubmit} className="cb-form">

            <div className="cb-field">
              <label className="cb-label">Your Name *</label>
              <input
                className="cb-input"
                type="text"
                placeholder="Mohammad Aslam"
                value={form.customerName}
                onChange={e => setField('customerName', e.target.value)}
              />
            </div>

            <div className="cb-field">
              <label className="cb-label">Phone Number *</label>
              <input
                className="cb-input"
                type="tel"
                placeholder="10-digit mobile number"
                value={form.customerNumber}
                onChange={e => setField('customerNumber', e.target.value)}
              />
            </div>

            <div className="cb-row">
              <div className="cb-field" style={{ flex: 1 }}>
                <label className="cb-label">Preferred Pickup Date *</label>
                <input
                  className="cb-input"
                  type="date"
                  min={todayISO()}
                  value={form.pickupDate}
                  onChange={e => setField('pickupDate', e.target.value)}
                />
              </div>
              <div className="cb-field" style={{ flex: 1 }}>
                <label className="cb-label">Area / Locality</label>
                <input
                  className="cb-input"
                  type="text"
                  placeholder="e.g. Hazratbal"
                  value={form.customerCity}
                  onChange={e => setField('customerCity', e.target.value)}
                />
              </div>
            </div>

            <div className="cb-row">
              <div className="cb-field" style={{ flex: 1 }}>
                <label className="cb-label">Service Type</label>
                <select
                  className="cb-input"
                  value={form.serviceType}
                  onChange={e => setField('serviceType', e.target.value)}
                >
                  {SERVICES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="cb-field" style={{ flex: '0 0 100px' }}>
                <label className="cb-label">Garments</label>
                <input
                  className="cb-input"
                  type="number"
                  min="1"
                  max="500"
                  value={form.garmentCount}
                  onChange={e => setField('garmentCount', e.target.value)}
                />
              </div>
            </div>

            <div className="cb-field">
              <label className="cb-label">Notes <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
              <textarea
                className="cb-input cb-textarea"
                placeholder="Stains, special care, preferred time window…"
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                rows={3}
              />
            </div>

            {error && <div className="cb-error">{error}</div>}

            <button
              type="submit"
              className="cb-submit"
              disabled={submitting}
            >
              {submitting ? (
                <span className="cb-spinner" />
              ) : (
                <>Request Pickup <span style={{ marginLeft: 4 }}>→</span></>
              )}
            </button>
          </form>
        </div>

        {/* Store footer */}
        <div className="cb-store-footer">
          <div className="cb-store-row">
            <span>📍</span>
            <span>Banday Lane, Dargah Hazratbal, Srinagar — 190006</span>
          </div>
          <div className="cb-store-row">
            <span>📞</span>
            <a href="tel:8899912859" className="cb-store-link">+91 88999 12859</a>
          </div>
          <div className="cb-store-row">
            <span>📸</span>
            <a href="https://www.instagram.com/tumbledryhazratbal?igsh=OGw2NTFyZmI4dmpi" target="_blank" rel="noreferrer" className="cb-store-link">@tumbledryhazratbal</a>
          </div>
        </div>

        <button className="cb-admin-link" onClick={() => navigate('/pos')}>
          Staff Login →
        </button>
      </section>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────
function ShirtIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/>
    </svg>
  )
}

function ShirtBg() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <path d="M140 20L160 30L200 80L180 90L180 180H20V90L0 80L40 30L60 20C60 20 72 40 100 40C128 40 140 20 140 20Z" fill="rgba(114,191,44,0.08)" stroke="rgba(114,191,44,0.15)" strokeWidth="2"/>
    </svg>
  )
}

function WaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// ── Styles ─────────────────────────────────────────────────────
const pg = {
  minHeight: '100vh',
  background: '#FAFAF5',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  overflowX: 'hidden',
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,900&family=DM+Sans:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; }

  .cb-hero {
    position: relative;
    background: #0f1f06;
    padding: 36px 24px 56px;
    overflow: hidden;
  }

  .cb-hero-bg {
    position: absolute; inset: 0;
    pointer-events: none;
  }

  .cb-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
  }

  .cb-blob-1 {
    width: 300px; height: 300px;
    background: rgba(114,191,44,0.25);
    top: -80px; right: -60px;
    animation: cbFloat 8s ease-in-out infinite;
  }

  .cb-blob-2 {
    width: 200px; height: 200px;
    background: rgba(252,194,0,0.15);
    bottom: -40px; left: 20px;
    animation: cbFloat 10s ease-in-out infinite reverse;
  }

  .cb-garment-bg {
    position: absolute;
    right: -10px; top: 0; bottom: 0;
    width: 200px;
    opacity: 0.5;
  }

  @keyframes cbFloat {
    0%, 100% { transform: translateY(0) scale(1); }
    50%       { transform: translateY(-16px) scale(1.05); }
  }

  .cb-hero-inner {
    position: relative;
    max-width: 520px;
    margin: 0 auto;
    animation: cbFadeUp 0.6s ease both;
  }

  @keyframes cbFadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .cb-logo-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 32px;
    animation: cbFadeUp 0.5s 0.05s ease both;
  }

  .cb-logo-icon {
    width: 44px; height: 44px;
    border-radius: 12px;
    background: #72BF2C;
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .cb-logo-name {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    line-height: 1.1;
  }

  .cb-logo-loc {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    margin-top: 2px;
    font-weight: 500;
  }

  .cb-hero-title {
    font-family: 'Fraunces', Georgia, serif;
    font-size: clamp(30px, 8vw, 44px);
    font-weight: 900;
    color: #fff;
    line-height: 1.12;
    letter-spacing: -0.03em;
    margin: 0 0 16px;
    animation: cbFadeUp 0.55s 0.1s ease both;
  }

  .cb-hero-title em {
    font-style: italic;
    color: #72BF2C;
  }

  .cb-hero-sub {
    font-size: 14px;
    color: rgba(255,255,255,0.6);
    line-height: 1.6;
    margin: 0 0 24px;
    font-weight: 400;
    animation: cbFadeUp 0.55s 0.15s ease both;
  }

  .cb-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    animation: cbFadeUp 0.55s 0.2s ease both;
  }

  .cb-pill {
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid rgba(114,191,44,0.4);
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.7);
    background: rgba(114,191,44,0.1);
    letter-spacing: 0.2px;
  }

  .cb-form-section {
    padding: 0 16px 48px;
    max-width: 560px;
    margin: 0 auto;
  }

  .cb-form-card {
    background: #fff;
    border-radius: 20px;
    padding: 28px 24px;
    margin-top: -28px;
    position: relative;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.04),
      0 8px 32px rgba(0,0,0,0.10),
      0 2px 8px rgba(0,0,0,0.05);
    animation: cbFadeUp 0.6s 0.25s ease both;
  }

  .cb-form-header {
    margin-bottom: 22px;
    padding-bottom: 18px;
    border-bottom: 1px solid #f0f0eb;
  }

  .cb-form-step {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: #1a2e0a;
    margin-bottom: 4px;
  }

  .cb-form-desc {
    font-size: 13px;
    color: #7a8a6a;
    margin: 0;
  }

  .cb-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .cb-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cb-row {
    display: flex;
    gap: 12px;
  }

  @media (max-width: 420px) {
    .cb-row { flex-direction: column; }
  }

  .cb-label {
    font-size: 11px;
    font-weight: 700;
    color: #5a7a3a;
    text-transform: uppercase;
    letter-spacing: 0.7px;
  }

  .cb-input {
    padding: 11px 14px;
    border-radius: 10px;
    border: 1.5px solid #e4edda;
    font-size: 15px;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-weight: 500;
    color: #1a2e0a;
    background: #f8fdf3;
    outline: none;
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s;
    appearance: none;
    -webkit-appearance: none;
  }

  .cb-input:focus {
    border-color: #72BF2C;
    box-shadow: 0 0 0 3px rgba(114,191,44,0.15);
  }

  .cb-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .cb-error {
    background: #fff5f5;
    border: 1px solid #fca5a5;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: #dc2626;
    font-weight: 500;
  }

  .cb-submit {
    padding: 14px;
    border-radius: 12px;
    background: #72BF2C;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    font-family: 'DM Sans', system-ui, sans-serif;
    border: none;
    cursor: pointer;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: background 0.15s, transform 0.1s;
    margin-top: 4px;
  }

  .cb-submit:hover { background: #62aa20; }
  .cb-submit:active { transform: scale(0.98); }
  .cb-submit:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

  .cb-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: cbSpin 0.7s linear infinite;
    display: inline-block;
  }

  @keyframes cbSpin { to { transform: rotate(360deg); } }

  .cb-store-footer {
    margin: 24px 0 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px 20px;
    background: rgba(114,191,44,0.06);
    border: 1px solid rgba(114,191,44,0.15);
    border-radius: 14px;
    animation: cbFadeUp 0.6s 0.35s ease both;
  }

  .cb-store-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    color: #3a5a1a;
    font-weight: 500;
    line-height: 1.4;
  }

  .cb-store-link {
    color: #4a8a1a;
    text-decoration: none;
    font-weight: 600;
  }

  .cb-admin-link {
    display: block;
    width: 100%;
    text-align: center;
    background: none;
    border: none;
    font-size: 12px;
    font-weight: 600;
    color: #aaa;
    cursor: pointer;
    padding: 8px;
    font-family: 'DM Sans', system-ui, sans-serif;
    letter-spacing: 0.3px;
    transition: color 0.15s;
  }

  .cb-admin-link:hover { color: #72BF2C; }

  /* Success */
  .cb-success-card {
    max-width: 480px;
    margin: 40px auto;
    background: #fff;
    border-radius: 20px;
    padding: 36px 28px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.10);
    animation: cbFadeUp 0.5s ease both;
  }

  .cb-check {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: #72BF2C;
    color: #fff;
    font-size: 30px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 20px;
  }

  .cb-success-h {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 26px;
    font-weight: 900;
    color: #1a2e0a;
    text-align: center;
    margin: 0 0 10px;
  }

  .cb-success-p {
    font-size: 14px;
    color: #5a7a3a;
    text-align: center;
    line-height: 1.6;
    margin: 0 0 24px;
  }

  .cb-info-rows {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid #f0f0eb;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 20px;
  }

  .cb-info-row {
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
    border-bottom: 1px solid #f0f0eb;
  }

  .cb-info-row:last-child { border-bottom: none; }

  .cb-info-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #aaa;
    margin-bottom: 2px;
  }

  .cb-info-val {
    font-size: 14px;
    font-weight: 600;
    color: #1a2e0a;
  }

  .cb-wa-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 13px;
    border-radius: 12px;
    background: #25D366;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    font-family: 'DM Sans', system-ui, sans-serif;
    text-decoration: none;
    margin-bottom: 10px;
  }

  .cb-another-btn {
    display: block;
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    background: #f0f9e8;
    color: #4a8a1a;
    font-size: 14px;
    font-weight: 700;
    border: 1.5px solid #72BF2C;
    cursor: pointer;
    font-family: 'DM Sans', system-ui, sans-serif;
  }
`
