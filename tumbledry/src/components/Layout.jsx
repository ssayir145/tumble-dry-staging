// src/components/Layout.jsx

import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useStore } from '../store/index.js'
import { logout } from '../pages/Login.jsx'
import {
  ShoppingBag, LayoutDashboard, CreditCard, Users,
  TrendingUp, FileText, Tag, UserCheck,
  Sun, Moon, LogOut, MoreHorizontal, Shirt, Inbox,
} from 'lucide-react'

const NAV_PRIMARY = [
  { path: '/',          icon: ShoppingBag,    label: 'POS'       },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/pending',   icon: CreditCard,      label: 'Payments'  },
  { path: '/leads',     icon: Inbox,           label: 'Leads'     },
]

const NAV_MORE = [
  { path: '/customers', icon: Users,      label: 'Customers' },
  { path: '/analytics',  icon: TrendingUp, label: 'Analytics' },
  { path: '/reports',    icon: FileText,   label: 'Reports'   },
  { path: '/rates',      icon: Tag,        label: 'Rate Card' },
  { path: '/attendance', icon: UserCheck,  label: 'Attendance'},
]

const NAV_ALL = [...NAV_PRIMARY, ...NAV_MORE]

function NavIcon({ icon: Icon, size = 16 }) {
  return <Icon size={size} strokeWidth={2} style={{ flexShrink: 0 }} />
}

export default function Layout({ children }) {
  const { darkMode, toggleDark, ordersLoading, newLeadsCount, fetchLeads } = useStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const isMoreActive = NAV_MORE.some(n => location.pathname === n.path)

  // Poll for new leads every 30 seconds
  useEffect(() => {
    fetchLeads()
    const id = setInterval(fetchLeads, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="app-layout">

      {/* ── Desktop Sidebar ── */}
      <aside className="app-sidebar">
        {/* Logo */}
        <div className="nav-logo">
          <span className="nav-logo-icon"><Shirt size={20} strokeWidth={2.5} /></span>
          <span className="nav-logo-text">Tumbledry</span>
        </div>

        <div className="nav-section-label">Menu</div>

        {NAV_ALL.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-item-icon"><NavIcon icon={item.icon} /></span>
            {item.label}
            {item.path === '/leads' && newLeadsCount > 0 && (
              <span style={{
                marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                background: 'var(--rose)', color: '#fff',
                fontSize: 10, fontWeight: 700, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                padding: '0 5px',
              }}>{newLeadsCount}</span>
            )}
          </NavLink>
        ))}

        {/* Bottom controls */}
        <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 1, background: 'var(--bd-subtle)', margin: '4px 0 8px' }} />
          <button onClick={toggleDark} className="nav-item" title={darkMode ? 'Light mode' : 'Dark mode'}>
            <span className="nav-item-icon">
              {darkMode ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
            </span>
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={logout} className="nav-item" style={{ color: 'var(--rose)' }}>
            <span className="nav-item-icon"><LogOut size={16} strokeWidth={2} /></span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="app-main">
        {ordersLoading && (
          <div className="loading-bar-wrap">
            <div className="loading-bar" />
          </div>
        )}
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="app-bottom-nav">
        <div className="bottom-nav-inner">
          {NAV_PRIMARY.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="bn-icon" style={{ position: 'relative' }}>
                <NavIcon icon={item.icon} size={20} />
                {item.path === '/leads' && newLeadsCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: 'var(--rose)', color: '#fff',
                    fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px',
                  }}>{newLeadsCount}</span>
                )}
              </span>
              <span className="bn-label">{item.label}</span>
            </NavLink>
          ))}
          <button
            className={`bottom-nav-item${isMoreActive ? ' active' : ''}`}
            onClick={() => setMoreOpen(true)}
          >
            <span className="bn-icon"><MoreHorizontal size={20} strokeWidth={2} /></span>
            <span className="bn-label">More</span>
          </button>
        </div>
      </nav>

      {/* ── More sheet (mobile) ── */}
      {moreOpen && (
        <>
          <div className="sheet-overlay" onClick={() => setMoreOpen(false)} />
          <div className="sheet-panel">
            <div className="sheet-handle" />
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--tx-tertiary)', marginBottom: 14 }}>More Pages</div>
            <div className="sheet-grid">
              {NAV_MORE.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sheet-nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="sheet-nav-icon"><NavIcon icon={item.icon} size={18} /></span>
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button
                onClick={() => { toggleDark(); setMoreOpen(false) }}
                style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--bg-raised)', border: '1px solid var(--bd-subtle)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--tx-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                {darkMode ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={() => { logout(); setMoreOpen(false) }}
                style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,0.2)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
