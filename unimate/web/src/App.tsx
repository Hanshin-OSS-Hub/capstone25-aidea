import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { apiClient, API_BASE_URL } from '@/api/client'
import Layout from '@/components/Layout'
import Login from '@/pages/auth/Login'
import Signup from '@/pages/auth/Signup'
import Home from '@/pages/Home'
import Notices from '@/pages/Notices'
import NoticeDetail from '@/pages/NoticeDetail'
import Chat from '@/pages/Chat'
import Schedule from '@/pages/Schedule'
import Profile from '@/pages/Profile'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { setTokens, setUser, clearUser } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      const rt = localStorage.getItem('unimate_refresh_token')
      if (!rt) { setReady(true); return }
      try {
        const { data: res } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { refresh_token: rt })
        const { access_token, refresh_token: newRt } = res.data
        setTokens(access_token)
        localStorage.setItem('unimate_refresh_token', newRt)
        const ur = await apiClient.get('/api/v1/users/me')
        const u = ur.data.data
        setUser({ id: u.id, name: u.name, email: u.email, department: u.department, grade: u.grade })
      } catch {
        localStorage.removeItem('unimate_refresh_token')
        clearUser()
      } finally {
        setReady(true)
      }
    })()
  }, [])

  if (!ready) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="notices" element={<Notices />} />
          <Route path="notices/:id" element={<NoticeDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
