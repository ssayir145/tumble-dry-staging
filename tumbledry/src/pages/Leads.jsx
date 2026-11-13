// src/pages/Leads.jsx — Admin leads management

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.js'
import { User, Phone, MapPin, Package, Clock, CheckCircle, XCircle, RefreshCw, ArrowRight, Calendar, AlertCircle } from 'lucide-react'

const STATUS_COLORS = {
  new:       { bg: 'var(--brand-yellow-dim, #fff8e0)', color: '#92700a', border: '#f5d800' },
  contacted: { bg: '#e8f0fe', color: '#1a5fb4', border: '#4a90d9' },
  converted: { bg: '#e8f9ee', color: '#1a6e35', border: '#2ec06b' },
  cancelled:  { bg: '#fde8e8', color: '#9b1c1c', border: '#f87171' },
}

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  cancelled: 'Cancelled',
}

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.new
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.4px', border: `1px solid ${s.border}`,
      background: s.bg, color: s.color,
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Leads() {
  const { leads, leadsLoading, leadsError, fetchLeads, updateLeadStatus, deleteLead, setPendingLeadCustomer, orders } = useStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('new')
  const [actioningId, setActioningId] = useState(null)

  useEffect(() => { fetchLeads() }, [])

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter)

  async function markContacted(lead) {
    setActioningId(lead.id)
    await updateLeadStatus(lead.id, 'contacted')
    setActioningId(null)
  }

  async function markCancelled(lead) {
    setActioningId(lead.id)
    await updateLeadStatus(lead.id, 'cancelled')
    setActioningId(null)
  }

  // Marks the request Converted straight away, then opens the POS pre-filled.
  // The saved order's id is linked back to the request when the order is processed.
  async function convertToOrder(lead) {
    setActioningId(lead.id)
    try { await updateLeadStatus(lead.id, 'converted') } catch (e) { setActioningId(null); return alert('Couldn’t convert: ' + e.message) }
    setActioningId(null)
    setPendingLeadCustomer({
      leadId:  lead.id,
      name:    lead.customer_name,
      number:  String(lead.customer_number || '').replace(/\D/g, '').slice(-10),
      address: [lead.customer_address, lead.landmark && (/^near/i.test(lead.landmark) ? lead.landmark : `Near ${lead.landmark}`)].filter(Boolean).join(', '),
      city:    lead.customer_city || '',
      pincode: '',
    })
    navigate('/pos')
  }

  async function undoConversion(lead) {
    if (!confirm(`Move ${lead.customer_name}'s request back to New?${lead.converted_order_id ? ' The order that was created stays in the system.' : ''}`)) return
    setActioningId(lead.id)
    try { await updateLeadStatus(lead.id, 'new') } finally { setActioningId(null) }
  }

  async function removeLead(lead) {
    if (!confirm(`Delete ${lead.customer_name}'s pickup request? This can’t be undone.`)) return
    setActioningId(lead.id)
    try { await deleteLead(lead.id) } catch (e) { alert('Couldn’t delete: ' + e.message) } finally { setActioningId(null) }
  }

  const tagFor = id => orders.find(o => o.id === id)?.tagNumber

  const counts = leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {})

  return (
    <div style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 500, color: 'var(--tx-primary)', letterSpacing: '-0.03em' }}>
            Customer Leads
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-secondary)' }}>
            Booking requests from the customer app
          </p>
        </div>
        <button
          onClick={fetchLeads}
          disabled={leadsLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: 'var(--bg-raised)', border: '1px solid var(--bd-subtle)',
            fontSize: 13, fontWeight: 600, color: 'var(--tx-secondary)',
            cursor: 'pointer', fontFamily: 'inherit',
            opacity: leadsLoading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: leadsLoading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { key: 'all',       label: 'All',        count: leads.length },
          { key: 'new',       label: 'New',        count: counts.new || 0 },
          { key: 'contacted', label: 'Contacted',  count: counts.contacted || 0 },
          { key: 'converted', label: 'Converted',  count: counts.converted || 0 },
          { key: 'cancelled', label: 'Cancelled',  count: counts.cancelled || 0 },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              border: filter === key ? '1.5px solid var(--brand-green)' : '1.5px solid var(--bd-subtle)',
              background: filter === key ? 'var(--brand-green)' : 'var(--bg-raised)',
              color: filter === key ? '#fff' : 'var(--tx-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {label}
            {count > 0 && (
              <span style={{
                background: filter === key ? 'rgba(255,255,255,0.3)' : 'var(--bg-elevated)',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {leadsError && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#fff5f5', border: '1px solid #fca5a5',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: '#dc2626',
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Could not load leads:</strong> {leadsError}
            <br />
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              Check that <code>API_SECRET</code> and <code>DATABASE_URL</code> are set in your Netlify environment variables.
            </span>
          </div>
        </div>
      )}

      {/* Loading */}
      {leadsLoading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--tx-tertiary)' }}>
          Loading leads…
        </div>
      )}

      {/* Empty */}
      {!leadsLoading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-secondary)' }}>
            No {filter === 'all' ? '' : filter} leads yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--tx-tertiary)', marginTop: 4 }}>
            Booking requests from the customer app will appear here.
          </div>
        </div>
      )}

      {/* Leads list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(lead => (
          <div
            key={lead.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--bd-subtle)',
              borderRadius: 14,
              padding: '16px 18px',
              transition: 'box-shadow 0.15s',
            }}
          >
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'var(--brand-green-dim, #e8f9ee)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <User size={18} color="var(--brand-green)" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-primary)' }}>
                    {lead.customer_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tx-tertiary)', marginTop: 1 }}>
                    {lead.id} · {timeAgo(lead.created_at)}
                  </div>
                </div>
              </div>
              <Badge status={lead.status} />
            </div>

            {/* Info grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginBottom: 14 }}>
              <div style={infoItem}>
                <Phone size={12} style={{ flexShrink: 0 }} />
                <a href={`tel:${lead.customer_number}`} style={{ color: 'var(--tx-primary)', textDecoration: 'none', fontWeight: 600 }}>
                  {lead.customer_number}
                </a>
              </div>
              {(lead.customer_city || lead.customer_address) && (
                <div style={infoItem}>
                  <MapPin size={12} style={{ flexShrink: 0 }} />
                  {[lead.customer_address, lead.landmark && (/^near/i.test(lead.landmark) ? lead.landmark : `near ${lead.landmark}`), lead.customer_city].filter(Boolean).join(', ')}
                </div>
              )}
              {lead.location_lat != null && lead.location_lng != null && (
                <a className="lead-map" href={`https://www.google.com/maps/dir/?api=1&destination=${lead.location_lat},${lead.location_lng}`} target="_blank" rel="noreferrer">
                  <MapPin size={12} /> Open in Maps
                </a>
              )}
              <div style={infoItem}>
                <Package size={12} style={{ flexShrink: 0 }} />
                {lead.service_type} · {lead.garment_count} garment{lead.garment_count !== 1 ? 's' : ''}
              </div>
              {lead.pickup_date && (
                <div style={infoItem}>
                  <Calendar size={12} style={{ flexShrink: 0 }} />
                  Pickup: {lead.pickup_date}
                </div>
              )}
            </div>

            {lead.notes && (
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 8,
                padding: '8px 12px', fontSize: 13, color: 'var(--tx-secondary)',
                marginBottom: 14, lineHeight: 1.5,
              }}>
                💬 {lead.notes}
              </div>
            )}

            {/* Actions */}
            {lead.status !== 'converted' && lead.status !== 'cancelled' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {lead.status === 'new' && (
                  <button
                    onClick={() => markContacted(lead)}
                    disabled={actioningId === lead.id}
                    style={{ ...actionBtn, background: '#e8f0fe', color: '#1a5fb4', border: '1px solid #4a90d9' }}
                  >
                    <Clock size={13} />
                    Mark Contacted
                  </button>
                )}
                <button
                  onClick={() => convertToOrder(lead)}
                  style={{ ...actionBtn, background: 'var(--brand-green)', color: '#fff', border: 'none' }}
                >
                  <ArrowRight size={13} />
                  Convert to Order
                </button>
                <button
                  onClick={() => markCancelled(lead)}
                  disabled={actioningId === lead.id}
                  style={{ ...actionBtn, background: 'var(--bg-raised)', color: 'var(--rose)', border: '1px solid rgba(194,80,30,0.3)' }}
                >
                  <XCircle size={13} />
                  Cancel
                </button>
                <a
                  href={`https://wa.me/91${lead.customer_number}?text=${encodeURIComponent(`Hello ${lead.customer_name}! 👋\n\nThank you for booking with Posh Fabric Care & Dry Cleaners! We've received your request for *${lead.service_type}* (${lead.garment_count} garments).\n\nWe'll contact you shortly to confirm the pickup time.\n\n📍 Banday Lane, Dargah Hazratbal, 190006\n📞 8899912859`)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...actionBtn, background: '#e8fdf0', color: '#166534', border: '1px solid #86efac', textDecoration: 'none', display: 'inline-flex' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
              </div>
            )}

            {(lead.status === 'converted' || lead.status === 'cancelled') && (
              <div className="lead-done">
                <span>
                  <CheckCircle size={13} />
                  {lead.status === 'cancelled'
                    ? 'Cancelled'
                    : lead.converted_order_id
                      ? `Converted to order ${tagFor(lead.converted_order_id) ? `tag ${tagFor(lead.converted_order_id)}` : `#${lead.converted_order_id}`}`
                      : 'Converted. The order will be linked once it’s saved in the POS.'}
                </span>
                <span className="lead-done-actions">
                  <button className="lead-btn" disabled={actioningId === lead.id} onClick={() => undoConversion(lead)}>Undo, move back to New</button>
                  <button className="lead-btn lead-btn-danger" disabled={actioningId === lead.id} onClick={() => removeLead(lead)}>Delete request</button>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const infoItem = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 13, color: 'var(--tx-secondary)', fontWeight: 500,
}

const actionBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 13px', borderRadius: 8,
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit', transition: 'opacity 0.1s',
}
