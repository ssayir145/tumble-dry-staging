// src/pages/RepeatCustomers.jsx — customers with 2+ orders, grouped by how recently they ordered

import { useMemo, useState } from 'react'
import { useStore } from '../store/index.js'
import { Repeat, MessageCircle, Flame, Sun, Snowflake, Moon } from 'lucide-react'

// Zone boundaries in days since last order — change here to adjust
const ZONES = [
  { key: 'hot',    label: 'Hot',    range: 'Ordered in the last 20 days', max: 20,       Icon: Flame,     tone: 'hot' },
  { key: 'warm',   label: 'Warm',   range: '21 to 40 days ago',           max: 40,       Icon: Sun,       tone: 'warm' },
  { key: 'cold',   label: 'Cold',   range: '41 to 90 days ago',           max: 90,       Icon: Snowflake, tone: 'cold' },
  { key: 'lapsed', label: 'Lapsed', range: 'More than 90 days ago',       max: Infinity, Icon: Moon,      tone: 'lapsed' },
]

const normPhone = v => String(v || '').replace(/\.0+$/, '').replace(/\D/g, '').slice(-10)
const DAY = 86400000

const MESSAGES = {
  hot:    n => `Hello ${n}! Thank you for being a regular at Posh Fabric Care & Dry Cleaners. Need a pickup this week? Just reply here.`,
  warm:   n => `Hello ${n}! It’s been a few weeks. Anything that needs cleaning or pressing? We can pick it up from your home. — Posh, Hazratbal`,
  cold:   n => `Hello ${n}, we miss you at Posh Fabric Care & Dry Cleaners! Winter is here, so if your blankets, coats or shawls need cleaning, reply and we’ll arrange a pickup.`,
  lapsed: n => `Hello ${n}, it’s been a while! Posh Fabric Care & Dry Cleaners in Hazratbal would love to see you again. Reply to book a pickup.`,
}

export default function RepeatCustomers() {
  const { orders, ordersLoading } = useStore()
  const [zone, setZone] = useState('hot')
  const [search, setSearch] = useState('')

  const customers = useMemo(() => {
    const map = {}
    orders.filter(o => !o.deleted).forEach(o => {
      const p = normPhone(o.customerNumber)
      if (p.length !== 10) return
      const c = map[p] || (map[p] = { phone: p, name: o.customerName, orders: 0, spend: 0, dates: [] })
      c.orders += 1
      c.spend += o.grandTotal || 0
      c.dates.push(new Date(o.orderDate).getTime())
    })
    const now = Date.now()
    return Object.values(map)
      .filter(c => c.orders >= 2)
      .map(c => {
        c.dates.sort((a, b) => a - b)
        const last = c.dates[c.dates.length - 1]
        const days = Math.floor((now - last) / DAY)
        const gap = Math.round((last - c.dates[0]) / DAY / (c.dates.length - 1))
        return { ...c, last, days, gap, zone: ZONES.find(z => days <= z.max).key }
      })
  }, [orders])

  if (ordersLoading) return <div className="page" style={{ color: 'var(--tx-tertiary)' }}>Loading customers…</div>

  const counts = Object.fromEntries(ZONES.map(z => [z.key, customers.filter(c => c.zone === z.key).length]))
  const q = search.trim().toLowerCase()
  const list = customers
    .filter(c => c.zone === zone)
    .filter(c => !q || (c.name || '').toLowerCase().includes(q) || c.phone.includes(q))
    .sort((a, b) => b.orders - a.orders || a.days - b.days)
  const active = ZONES.find(z => z.key === zone)

  return (
    <div className="page">
      <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.03em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Repeat size={22} strokeWidth={2} /> Repeat customers
      </h1>
      <p style={{ color: 'var(--tx-secondary)', fontSize: 14, marginBottom: 18 }}>
        {customers.length} customers have ordered more than once. Grouped by how long ago they last ordered.
      </p>

      <div className="rc-zones">
        {ZONES.map(z => (
          <button key={z.key} className={`rc-zone rc-${z.tone}${zone === z.key ? ' on' : ''}`} onClick={() => setZone(z.key)} aria-pressed={zone === z.key}>
            <span className="rc-zone-head"><z.Icon size={15} strokeWidth={2.2} /> {z.label}</span>
            <strong>{counts[z.key]}</strong>
            <span className="rc-zone-range">{z.range}</span>
          </button>
        ))}
      </div>

      <div className="rc-panel">
        <div className="rc-panel-head">
          <span>{active.label} customers, most orders first</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone" aria-label="Search customers" />
        </div>
        {list.length === 0 ? (
          <div className="rc-none">No {active.label.toLowerCase()} customers{q ? ` matching “${search}”` : ''}.</div>
        ) : (
          <div className="rc-table" role="table">
            <div className="rc-row rc-row-head" role="row">
              <span>Customer</span><span>Orders</span><span>Spent</span><span>Last order</span><span>Usually every</span><span />
            </div>
            {list.map(c => (
              <div className="rc-row" role="row" key={c.phone}>
                <span><b>{c.name}</b><small>{c.phone}</small></span>
                <span className="mono">{c.orders}</span>
                <span className="mono">₹{Math.round(c.spend).toLocaleString('en-IN')}</span>
                <span>{c.days === 0 ? 'Today' : `${c.days} days ago`}</span>
                <span>{c.gap > 0 ? `${c.gap} days` : 'same day'}</span>
                <span>
                  <a className="rc-wa" href={`https://web.whatsapp.com/send?phone=91${c.phone}&text=${encodeURIComponent(MESSAGES[c.zone](c.name.split(' ')[0]))}`} target="_blank" rel="noreferrer">
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
