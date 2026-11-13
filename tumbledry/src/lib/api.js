// src/lib/api.js — All Netlify Function calls
// No secrets live in the browser. Staff and customers each get a signed session token from the server.

const BASE = '/.netlify/functions'
export const STAFF_TOKEN_KEY = 'posh-staff-token'
export const CUSTOMER_TOKEN_KEY = 'posh-customer-token'

function tokenExpired(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')))
    return !p.exp || p.exp * 1000 < Date.now()
  } catch { return true }
}
export function getValidToken(storage, key) {
  const t = storage.getItem(key)
  if (t && !tokenExpired(t)) return t
  if (t) storage.removeItem(key)
  return null
}

async function call(path, { token, ...options } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  let data = {}
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    const e = new Error(data.error || 'Request failed')
    e.status = res.status
    throw e
  }
  return data
}

// Staff calls: on an expired/invalid session, drop the token and go back to sign-in
async function request(path, options = {}) {
  try {
    return await call(path, { ...options, token: getValidToken(sessionStorage, STAFF_TOKEN_KEY) })
  } catch (e) {
    if (e.status === 401) { sessionStorage.removeItem(STAFF_TOKEN_KEY); window.location.reload() }
    throw e
  }
}

export const api = {
  staff: {
    signIn: (storeId, password) => call('/staff-auth', { method: 'POST', body: JSON.stringify({ storeId, password }) }),
  },
  orders: {
    getAll:      ()        => request('/orders'),
    upsert:      (order)   => request('/orders', { method: 'POST', body: JSON.stringify({ order }) }),
    clearAll:    ()        => request('/orders', { method: 'POST', body: JSON.stringify({ action: 'CLEAR_ALL' }) }),
    insertBatch: (orders)  => request('/orders', { method: 'POST', body: JSON.stringify({ action: 'INSERT_BATCH', orders }) }),
  },
  attendance: {
    getAll: ()             => request('/attendance'),
    upsert: (date, attendance) =>
      request('/attendance', { method: 'POST', body: JSON.stringify({ date, attendance }) }),
  },
  leads: {
    getAll:       ()                              => request('/leads'),
    create:       (lead)                          => fetch(`${BASE}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }).then(r => r.json()),
    updateStatus: (id, status, convertedOrderId)  => request('/leads', { method: 'POST', body: JSON.stringify({ action: 'UPDATE_STATUS', id, status, convertedOrderId: convertedOrderId || null }) }),
    linkOrder:    (id, orderId)                   => request('/leads', { method: 'POST', body: JSON.stringify({ action: 'LINK_ORDER', id, orderId }) }),
    remove:       (id)                            => request('/leads', { method: 'POST', body: JSON.stringify({ action: 'DELETE', id }) }),
  },
  feedback: {
    getAll:     ()          => request('/feedback'),
    markCalled: (id, notes) => request('/feedback', { method: 'POST', body: JSON.stringify({ action: 'MARK_CALLED', id, notes }) }),
    saveNotes:  (id, notes) => request('/feedback', { method: 'POST', body: JSON.stringify({ action: 'UPDATE_NOTES', id, notes }) }),
  },
  customer: {
    setup:    (phone, tag, pin) => call('/customer', { method: 'POST', body: JSON.stringify({ action: 'SETUP', phone, tag, pin }) }),
    signIn:   (phone, pin)      => call('/customer', { method: 'POST', body: JSON.stringify({ action: 'LOGIN', phone, pin }) }),
    myOrders: (token)           => call('/customer', { token }),
    saveAddress: (token, a) => call('/customer', { token, method: 'POST', body: JSON.stringify({ action: 'SAVE_ADDRESS', ...a }) }),
    rateOrder: (token, orderId, rating, comment) => call('/customer', { token, method: 'POST', body: JSON.stringify({ action: 'FEEDBACK', orderId, rating, comment }) }),
    changePin: (token, currentPin, newPin) => call('/customer', { token, method: 'POST', body: JSON.stringify({ action: 'CHANGE_PIN', currentPin, newPin }) }),
    resetPin: (phone)           => request('/customer', { method: 'POST', body: JSON.stringify({ action: 'RESET_PIN', phone }) }),
  },
}
