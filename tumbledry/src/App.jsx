// src/App.jsx

import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useStore } from './store/index.js'
import Layout from './components/Layout.jsx'
import Login, { isAuthenticated } from './pages/Login.jsx'
import POS from './pages/POS.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Analytics from './pages/Analytics.jsx'
import Attendance from './pages/Attendance.jsx'
import PendingPayments from './pages/PendingPayments.jsx'
import CustomerProfiles from './pages/CustomerProfiles.jsx'
import Reports from './pages/Reports.jsx'
import RateCard from './pages/RateCard.jsx'
import Leads from './pages/Leads.jsx'
import CustomerBooking from './pages/CustomerBooking.jsx'

function AuthedApp() {
  const { darkMode, fetchOrders } = useStore()
  const [authed, setAuthed] = useState(isAuthenticated())

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  useEffect(() => {
    if (authed) fetchOrders()
  }, [authed])

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"           element={<POS />}             />
        <Route path="/dashboard"  element={<Dashboard />}       />
        <Route path="/analytics"  element={<Analytics />}       />
        <Route path="/pending"    element={<PendingPayments />}  />
        <Route path="/customers"  element={<CustomerProfiles />} />
        <Route path="/reports"    element={<Reports />}          />
        <Route path="/rates"      element={<RateCard />}         />
        <Route path="/attendance" element={<Attendance />}      />
        <Route path="/leads"      element={<Leads />}           />
      </Routes>
    </Layout>
  )
}

export default function App() {
  const location = useLocation()

  // Public route — no auth required
  if (location.pathname === '/book') {
    return <CustomerBooking />
  }

  return <AuthedApp />
}
