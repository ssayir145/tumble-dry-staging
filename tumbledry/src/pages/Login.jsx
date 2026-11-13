// src/pages/Login.jsx

import { useState } from 'react'
import { api, getValidToken, STAFF_TOKEN_KEY } from '../lib/api.js'

export function isAuthenticated() {
  return !!getValidToken(sessionStorage, STAFF_TOKEN_KEY)
}

export function logout() {
  sessionStorage.removeItem(STAFF_TOKEN_KEY)
  window.location.reload()
}

export default function Login({ onLogin }) {
  const [storeId,   setStoreId]   = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await api.staff.signIn(storeId.trim(), password)
      sessionStorage.setItem(STAFF_TOKEN_KEY, token)
      onLogin()
    } catch (e2) {
      setError(e2.status === 401 ? 'Store ID or password is incorrect' : e2.message)
    }
    setLoading(false)
  }

  const fieldStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1.5px solid var(--bd-subtle)',
    fontSize: 15,
    fontFamily: 'inherit',
    fontWeight: 500,
    background: 'var(--bg-input)',
    color: 'var(--tx-primary)',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--tx-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        right: '-10%',
        width: '50vmin',
        height: '50vmin',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(183,38,56,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        left: '-8%',
        width: '40vmin',
        height: '40vmin',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(183,121,31,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeUp 0.4s var(--ease-out) both' }}>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/posh-tulip.png"
            alt=""
            style={{ width: 64, height: 88, objectFit: "contain", margin: "0 auto 18px", display: "block", filter: "drop-shadow(0 10px 18px rgba(143,28,46,0.18))" }}
          />
          <h1 style={{ fontSize: 34, fontWeight: 500, color: "var(--posh-burgundy)", letterSpacing: "0.32em", marginRight: "-0.32em", lineHeight: 1, marginBottom: 10 }}>
            POSH
          </h1>
          <p style={{ fontSize: 14, color: "var(--tx-secondary)", fontWeight: 500 }}>
            Staff sign-in
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 18,
          border: '1px solid var(--bd-subtle)',
          boxShadow: 'var(--shadow-xl)',
          padding: '28px 28px 24px',
        }}>
          <form onSubmit={handleLogin}>

            {/* Store ID */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Store ID</label>
              <input
                style={fieldStyle}
                type="text"
                value={storeId}
                onChange={e => { setStoreId(e.target.value); setError('') }}
                placeholder="e.g. Dargah001"
                autoFocus
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...fieldStyle, paddingRight: 46 }}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 17,
                    color: 'var(--tx-tertiary)',
                    padding: 4,
                    lineHeight: 1,
                    minHeight: 'auto',
                  }}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: 14,
                padding: '10px 13px',
                background: 'var(--rose-dim)',
                border: '1px solid rgba(194,80,30,0.2)',
                borderRadius: 9,
                fontSize: 13,
                color: 'var(--rose)',
                fontWeight: 600,
                animation: 'fadeUp 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !storeId || !password}
              style={{
                width: '100%',
                padding: '14px',
                background: loading || !storeId || !password
                  ? 'var(--bg-raised)'
                  : 'linear-gradient(135deg, #8F1C2E, #B72638)',
                color: loading || !storeId || !password
                  ? 'var(--tx-tertiary)'
                  : 'white',
                border: '1.5px solid var(--bd-subtle)',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 14,
                cursor: loading || !storeId || !password ? 'not-allowed' : 'pointer',
                boxShadow: loading || !storeId || !password
                  ? 'none'
                  : 'var(--shadow-teal)',
                transition: 'transform 0.2s var(--ease-out), opacity 0.2s',
                letterSpacing: '0.2px',
              }}
            >
              {loading ? '⏳ Signing in…' : '🔐 Sign In'}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: 18,
          fontSize: 12,
          color: 'var(--tx-tertiary)',
          lineHeight: 1.5,
        }}>
          Store ID and password provided by your store manager
        </p>
      </div>
    </div>
  )
}
