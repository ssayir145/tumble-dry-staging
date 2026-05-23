// src/pages/CustomerBooking.jsx — Public booking form (no auth required)

import { useState } from 'react'
import { api } from '../lib/api.js'

const SERVICES = ['Dry Clean', 'Wash & Iron', 'Iron Only', 'Wash Only', 'Premium Wash', 'Shoe Cleaning']

export default function CustomerBooking() {
  const [form, setForm] = useState({
    customerName: '',
    customerNumber: '',
    customerAddress: '',
    customerCity: '',
    serviceType: 'Dry Clean',
    garmentCount: 1,
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.customerName.trim()) return setError('Please enter your name')
    if (!form.customerNumber.trim()) return setError('Please enter your phone number')
    setError('')
    setSubmitting(true)
    try {
      const res = await api.leads.create(form)
      if (res.success) {
        setSubmitted(true)
      } else {
        setError(res.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Could not submit. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Booking Received!</h2>
          <p style={styles.successText}>
            We've received your request and will contact you shortly to confirm pickup details.
          </p>
          <div style={styles.successDetail}>
            <span style={styles.successDetailLabel}>Store</span>
            <span style={styles.successDetailValue}>Tumbledry Hazratbal</span>
          </div>
          <div style={styles.successDetail}>
            <span style={styles.successDetailLabel}>Address</span>
            <span style={styles.successDetailValue}>Banday Lane, Dargah Hazratbal, 190006</span>
          </div>
          <div style={styles.successDetail}>
            <span style={styles.successDetailLabel}>Phone</span>
            <span style={styles.successDetailValue}>8899912859</span>
          </div>
          <a
            href="https://wa.me/918899912859"
            target="_blank"
            rel="noreferrer"
            style={styles.waButton}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Chat on WhatsApp
          </a>
          <button
            onClick={() => { setSubmitted(false); setForm({ customerName:'', customerNumber:'', customerAddress:'', customerCity:'', serviceType:'Dry Clean', garmentCount:1, notes:'' }) }}
            style={styles.anotherButton}
          >
            Book Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoText}>Tumbledry</div>
            <div style={styles.logoSub}>Hazratbal, Srinagar</div>
          </div>
        </div>
        <h1 style={styles.headerTitle}>Book a Pickup</h1>
        <p style={styles.headerSub}>Fill in the form below and we'll get in touch to confirm your pickup time.</p>
      </div>

      {/* Form */}
      <div style={styles.card}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Your Name *</label>
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. Mohammad Aslam"
              value={form.customerName}
              onChange={e => set('customerName', e.target.value)}
              required
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Phone Number *</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="10-digit mobile number"
              value={form.customerNumber}
              onChange={e => set('customerNumber', e.target.value)}
              required
            />
          </div>

          <div style={styles.row}>
            <div style={{ ...styles.fieldGroup, flex: 1 }}>
              <label style={styles.label}>Area / Locality</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. Hazratbal"
                value={form.customerCity}
                onChange={e => set('customerCity', e.target.value)}
              />
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Service Type</label>
            <select
              style={styles.select}
              value={form.serviceType}
              onChange={e => set('serviceType', e.target.value)}
            >
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Approx. Number of Garments</label>
            <input
              style={styles.input}
              type="number"
              min="1"
              max="200"
              value={form.garmentCount}
              onChange={e => set('garmentCount', parseInt(e.target.value) || 1)}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Additional Notes</label>
            <textarea
              style={styles.textarea}
              placeholder="Any special instructions, stains to note, preferred time, etc."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
            />
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{ ...styles.submitButton, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Submitting...' : 'Request Pickup'}
          </button>
        </form>

        <div style={styles.footerNote}>
          By submitting you agree to be contacted on the number provided.
        </div>
      </div>

      {/* Store info */}
      <div style={styles.storeCard}>
        <div style={styles.storeRow}>
          <span style={styles.storeIcon}>📍</span>
          <span style={styles.storeText}>Banday Lane, Dargah Hazratbal, Srinagar — 190006</span>
        </div>
        <div style={styles.storeRow}>
          <span style={styles.storeIcon}>📞</span>
          <a href="tel:8899912859" style={styles.storeLink}>8899912859</a>
        </div>
        <div style={styles.storeRow}>
          <span style={styles.storeIcon}>📸</span>
          <a href="https://www.instagram.com/tumbledryhazratbal?igsh=OGw2NTFyZmI4dmpi" target="_blank" rel="noreferrer" style={styles.storeLink}>@tumbledryhazratbal</a>
        </div>
      </div>
    </div>
  )
}

const brand = '#72BF2C'
const brandDark = '#5a9e20'

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #EFF8E6 0%, #d8f0c0 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px 40px',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  header: {
    width: '100%',
    maxWidth: 480,
    textAlign: 'center',
    marginBottom: 24,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: brand,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 800,
    color: '#1a2e0a',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: 12,
    color: '#5a7a3a',
    fontWeight: 500,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: '#1a2e0a',
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  headerSub: {
    fontSize: 14,
    color: '#4a6a2a',
    margin: 0,
    lineHeight: 1.5,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: '#fff',
    borderRadius: 20,
    padding: '28px 24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    marginBottom: 16,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  row: {
    display: 'flex',
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: '#4a6a2a',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  input: {
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #d1e8b8',
    fontSize: 15,
    fontFamily: 'inherit',
    fontWeight: 500,
    color: '#1a2e0a',
    background: '#f8fdf3',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    transition: 'border-color 0.15s',
  },
  select: {
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #d1e8b8',
    fontSize: 15,
    fontFamily: 'inherit',
    fontWeight: 500,
    color: '#1a2e0a',
    background: '#f8fdf3',
    outline: 'none',
    width: '100%',
    cursor: 'pointer',
  },
  textarea: {
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #d1e8b8',
    fontSize: 14,
    fontFamily: 'inherit',
    fontWeight: 500,
    color: '#1a2e0a',
    background: '#f8fdf3',
    outline: 'none',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
  },
  errorBox: {
    background: '#fff0f0',
    border: '1px solid #fca5a5',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#dc2626',
    fontWeight: 500,
  },
  submitButton: {
    padding: '14px',
    borderRadius: 12,
    background: brand,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    transition: 'background 0.15s, transform 0.1s',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: '#8aaa6a',
    marginTop: 16,
  },
  storeCard: {
    width: '100%',
    maxWidth: 480,
    background: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    backdropFilter: 'blur(8px)',
  },
  storeRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: '#3a5a1a',
    fontWeight: 500,
  },
  storeIcon: {
    fontSize: 15,
    flexShrink: 0,
    lineHeight: 1.4,
  },
  storeText: {
    lineHeight: 1.4,
  },
  storeLink: {
    color: brandDark,
    textDecoration: 'none',
    fontWeight: 600,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: brand,
    color: '#fff',
    fontSize: 32,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#1a2e0a',
    textAlign: 'center',
    margin: '0 0 8px',
  },
  successText: {
    fontSize: 14,
    color: '#4a6a2a',
    textAlign: 'center',
    lineHeight: 1.6,
    margin: '0 0 20px',
  },
  successDetail: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '10px 0',
    borderBottom: '1px solid #eee',
  },
  successDetailLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#8aaa6a',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  successDetailValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a2e0a',
  },
  waButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    padding: '13px',
    borderRadius: 12,
    background: '#25D366',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
  },
  anotherButton: {
    display: 'block',
    width: '100%',
    marginTop: 10,
    padding: '12px',
    borderRadius: 12,
    background: '#f0f9e8',
    color: brandDark,
    fontSize: 14,
    fontWeight: 700,
    border: `1.5px solid ${brand}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
