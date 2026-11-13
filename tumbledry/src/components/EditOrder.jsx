// src/components/EditOrder.jsx

import { useState, useMemo } from 'react'
import { useStore } from '../store/index.js'
import { Modal } from './ui/index.jsx'
import { SERVICES, GARMENT_RATES } from '../lib/garments.js'

export default function EditOrder({ order, onClose }) {
  const { upsertOrder } = useStore()
  const [form, setForm] = useState({
    customerName:    order.customerName    || '',
    customerNumber:  order.customerNumber  || '',
    customerAddress: order.customerAddress || '',
    customerCity:    order.customerCity    || '',
    customerPincode: order.customerPincode || '',
    tagNumber:       order.tagNumber       || '',
    deliveryDate:    order.deliveryDate    || '',
    serviceType:     order.serviceType     || 'Dry Clean',
    status:          order.status          || 'pending',
    paymentMethod:   order.paymentMethod   || 'Cash',
    paymentStatus:   order.paymentStatus   || 'Pending',
    rackLocation:    order.rackLocation    || '',
    cashAmount:      order.cashAmount      || '',
    onlineAmount:    order.onlineAmount    || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // ── Editable items ──
  const rates = useMemo(() => {
    try { return { ...GARMENT_RATES, ...JSON.parse(localStorage.getItem('td-custom-rates') || '{}') } } catch { return GARMENT_RATES }
  }, [])
  const [cart, setCart] = useState(() => (order.cart || []).map(i => ({ ...i })))
  const [extraDisc, setExtraDisc] = useState(() => {
    const itemDisc = (order.cart || []).reduce((s, i) => s + (i.discountAmount || 0), 0)
    return Math.max(0, Math.round((order.discountAmount || 0) - itemDisc))
  })
  const [newItem, setNewItem] = useState('')

  function recalc(it) {
    const qty = Math.max(1, parseInt(it.qty) || 1)
    const price = parseFloat(it.unitPrice) || 0
    if (it.type === 'kg') {
      const w = parseFloat(it.weight) || 0
      return { ...it, qty, net: Math.round(w * price), discountAmount: 0, discountPct: 0 }
    }
    const pct = Math.min(100, Math.max(0, parseInt(it.discountPct) || 0))
    const gross = price * qty
    const discountAmount = Math.round(gross * pct / 100)
    return { ...it, qty, discountPct: pct, discountAmount, net: gross - discountAmount }
  }
  function updateItem(i, patch) { setCart(c => c.map((it, j) => (j === i ? recalc({ ...it, ...patch }) : it))) }
  function addItem() {
    const name = newItem.trim()
    if (!name) return
    setCart(c => [...c, recalc({ type: 'piece', name, printedTagName: name, serviceName: form.serviceType, unitPrice: rates[name] || 0, qty: 1, discountPct: 0 })])
    setNewItem('')
  }

  const totals = useMemo(() => {
    const itemDisc = cart.reduce((s, i) => s + (i.discountAmount || 0), 0)
    const net = cart.reduce((s, i) => s + (Number(i.net) || 0), 0)
    const extra = Math.max(0, Math.round(parseFloat(extraDisc) || 0))
    const grandTotal = Math.max(0, Math.round(net - extra))
    const discountAmount = Math.round(itemDisc + extra)
    const base = net + itemDisc
    return {
      grandTotal, discountAmount,
      discountPct: base > 0 ? Math.round(discountAmount / base * 1000) / 10 : 0,
      totalGarments: cart.reduce((s, i) => s + (parseInt(i.qty) || 1), 0),
    }
  }, [cart, extraDisc])

  const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid var(--bd-subtle)', fontSize:13, fontFamily:'inherit', fontWeight:500, background:'var(--bg-input)', color:'var(--tx-primary)', outline:'none', boxSizing:'border-box' }
  const lbl = { display:'block', marginBottom:5, fontSize:11, fontWeight:700, color:'var(--tx-secondary)', textTransform:'uppercase', letterSpacing:'0.5px' }

  function set(k, v) { setForm(f => ({...f, [k]: v})) }

  async function save() {
    setSaving(true)
    setError('')
    if (!cart.length) { setSaving(false); return setError('Add at least one item.') }
    if (cart.some(i => !String(i.name).trim())) { setSaving(false); return setError('Every item needs a name.') }
    try {
      const updated = { ...order, ...form, cart, ...totals }
      // Keep cash/online split in step with the new total when paid in a single method
      if (form.paymentMethod === 'Cash')   { updated.cashAmount = totals.grandTotal; updated.onlineAmount = 0 }
      if (form.paymentMethod === 'Online') { updated.onlineAmount = totals.grandTotal; updated.cashAmount = 0 }
      await upsertOrder(updated)
      onClose()
    } catch(e) {
      setError('❌ ' + e.message)
      setSaving(false)
    }
  }

  const STATUS_OPTIONS = [
    { value:'pending',   label:'Received'   },
    { value:'inprocess', label:'In Process' },
    { value:'completed', label:'Ready'       },
    { value:'delivered', label:'Delivered'   },
  ]

  return (
    <Modal open={true} onClose={onClose} title={`Edit — ${order.tagNumber}`} maxWidth={720}>
      <div style={{ display:'grid', gap:12 }}>

        {/* Customer section */}
        <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--tx-tertiary)', marginBottom:2 }}>Customer</div>
        <div className="form-two">
          <div><label style={lbl}>Name</label><input style={inp} value={form.customerName} onChange={e=>set('customerName',e.target.value)} /></div>
          <div><label style={lbl}>Phone</label><input style={inp} value={form.customerNumber} onChange={e=>set('customerNumber',e.target.value)} /></div>
          <div><label style={lbl}>Address</label><input style={inp} value={form.customerAddress} onChange={e=>set('customerAddress',e.target.value)} /></div>
          <div><label style={lbl}>City</label><input style={inp} value={form.customerCity} onChange={e=>set('customerCity',e.target.value)} /></div>
        </div>

        {/* Order section */}
        <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--tx-tertiary)', marginTop:6, marginBottom:2 }}>Order Details</div>
        <div className="form-three">
          <div><label style={lbl}>Tag #</label><input style={inp} value={form.tagNumber} onChange={e=>set('tagNumber',e.target.value)} /></div>
          <div><label style={lbl}>Delivery Date</label><input style={inp} value={form.deliveryDate} onChange={e=>set('deliveryDate',e.target.value)} /></div>
          <div>
            <label style={lbl}>Service</label>
            <select style={{...inp, cursor:'pointer'}} value={form.serviceType} onChange={e=>set('serviceType',e.target.value)}>
              {SERVICES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Status & Payment */}
        <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--tx-tertiary)', marginTop:6, marginBottom:2 }}>Status & Payment</div>

        <div>
          <label style={lbl}>Order Status</label>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {STATUS_OPTIONS.map(s => {
              const active = form.status === s.value
              return (
                <button key={s.value} onClick={()=>set('status',s.value)} style={{
                  padding:'8px 13px', borderRadius:8, cursor:'pointer',
                  fontFamily:'inherit', fontWeight:600, fontSize:12,
                  background: active ? 'rgba(183,38,56,0.1)' : 'transparent',
                  color: active ? 'var(--indigo)' : 'var(--tx-secondary)',
                  border: `2px solid ${active ? 'var(--indigo)' : 'var(--bd-subtle)'}`,
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}>
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="form-two">
          <div>
            <label style={lbl}>Payment Method</label>
            <select style={{...inp, cursor:'pointer'}} value={form.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)}>
              <option>Cash</option><option>Online</option><option>Split</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Payment Status</label>
            <select style={{...inp, cursor:'pointer'}} value={form.paymentStatus} onChange={e=>set('paymentStatus',e.target.value)}>
              <option>Paid</option><option>Pending</option><option>Partial</option>
            </select>
          </div>
        </div>

        {form.paymentMethod === 'Split' && (
          <div className="form-two" style={{ padding:'10px 12px', background:'rgba(183,38,56,0.05)', borderRadius:9, border:'1px solid rgba(183,38,56,0.15)' }}>
            <div>
              <label style={lbl}>Cash Amount ₹</label>
              <input style={inp} type="number" value={form.cashAmount} onChange={e=>{ set('cashAmount',e.target.value); set('onlineAmount', String(Math.max(0,(order.grandTotal||0)-(parseFloat(e.target.value)||0)))) }} />
            </div>
            <div>
              <label style={lbl}>Online Amount ₹</label>
              <input style={inp} type="number" value={form.onlineAmount} onChange={e=>{ set('onlineAmount',e.target.value); set('cashAmount', String(Math.max(0,(order.grandTotal||0)-(parseFloat(e.target.value)||0)))) }} />
            </div>
          </div>
        )}

        <div style={{marginTop:8}}>
          <label style={lbl}>Rack / Shelf Location</label>
          <input style={{...inp, maxWidth:200}} value={form.rackLocation} onChange={e=>set('rackLocation',e.target.value)} placeholder="e.g. A3, Shelf B2" />
        </div>

        {/* Items (editable) */}
        <div className="eo-items">
          <div className="eo-items-head">
            <span>Items</span>
            <span className="eo-hint">Change quantities, prices or discounts, remove wrong items or add missing ones.</span>
          </div>
          {cart.length === 0 && <div className="eo-empty">No items. Add at least one item below.</div>}
          {cart.map((it, i) => (
            <div key={i} className="eo-item">
              <input className="eo-name" value={it.name} aria-label="Item name" onChange={e => updateItem(i, { name: e.target.value, printedTagName: it.type === 'kg' ? it.printedTagName : e.target.value })} />
              {it.type === 'kg' ? (
                <>
                  <label>KG<input type="number" step="0.5" min="0" value={it.weight ?? ''} onChange={e => updateItem(i, { weight: e.target.value })} /></label>
                  <label>₹/KG<input type="number" min="0" value={it.unitPrice} onChange={e => updateItem(i, { unitPrice: e.target.value })} /></label>
                  <label>Pcs<input type="number" min="1" value={it.qty} onChange={e => updateItem(i, { qty: e.target.value })} /></label>
                </>
              ) : (
                <>
                  <label>Qty<input type="number" min="1" value={it.qty} onChange={e => updateItem(i, { qty: e.target.value })} /></label>
                  <label>₹<input type="number" min="0" value={it.unitPrice} onChange={e => updateItem(i, { unitPrice: e.target.value })} /></label>
                  <label>Disc %<input type="number" min="0" max="100" value={it.discountPct || 0} onChange={e => updateItem(i, { discountPct: e.target.value })} /></label>
                </>
              )}
              <span className="eo-net mono">₹{Math.round(it.net)}</span>
              <button className="eo-remove" aria-label={`Remove ${it.name}`} onClick={() => setCart(c => c.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}

          <div className="eo-add">
            <input list="eo-garments" placeholder="Add item: type a garment or a custom name" value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }} aria-label="Add item" />
            <datalist id="eo-garments">{Object.keys(rates).map(g => <option key={g} value={g}>₹{rates[g]}</option>)}</datalist>
            <button className="lead-btn" onClick={addItem} disabled={!newItem.trim()}>+ Add</button>
          </div>

          <div className="eo-totals">
            <label>Extra order discount ₹<input type="number" min="0" value={extraDisc} onChange={e => setExtraDisc(e.target.value)} /></label>
            <div><span>Garments</span><b>{totals.totalGarments}</b></div>
            {totals.discountAmount > 0 && <div><span>Discount</span><b>−₹{totals.discountAmount}</b></div>}
            <div className="eo-grand"><span>Total</span><b className="mono">₹{totals.grandTotal}</b></div>
            {totals.grandTotal !== Math.round(order.grandTotal || 0) && (
              <div className="eo-change">
                Was ₹{Math.round(order.grandTotal || 0)}.
                {form.paymentStatus === 'Paid' && (totals.grandTotal > order.grandTotal
                  ? ` Customer has paid; collect ₹${totals.grandTotal - Math.round(order.grandTotal)} more, or set payment to Partial.`
                  : ` Customer has paid; refund ₹${Math.round(order.grandTotal) - totals.grandTotal}.`)}
              </div>
            )}
          </div>
        </div>

        {error && <div style={{ fontSize:13, color:'var(--rose)', fontWeight:600, padding:'8px 12px', background:'rgba(194,80,30,0.06)', borderRadius:8 }}>{error}</div>}

        {/* Actions */}
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1, padding:12, background:'var(--bg-raised)', border:'1px solid var(--bd-subtle)', borderRadius:9, fontFamily:'inherit', fontWeight:600, cursor:'pointer', color:'var(--tx-secondary)', fontSize:13 }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:12, background:'linear-gradient(135deg,#8F1C2E,#B72638)', color:'white', border:'none', borderRadius:9, fontFamily:'inherit', fontWeight:700, cursor:saving?'not-allowed':'pointer', fontSize:14, opacity:saving?0.7:1 }}>
            {saving ? '⏳ Saving...' : '✅ Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
