import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Home, Megaphone, Calendar, MessageSquare, User, LogOut, GraduationCap } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const NAV = [
  { to: '/home',     icon: Home,          label: '홈' },
  { to: '/notices',  icon: Megaphone,     label: '공지' },
  { to: '/schedule', icon: Calendar,      label: '일정' },
  { to: '/chat',     icon: MessageSquare, label: 'AI 채팅' },
  { to: '/profile',  icon: User,          label: '프로필' },
]

export default function Layout() {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('unimate_refresh_token')
    clearUser()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        {/* 로고 */}
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm">
            <GraduationCap size={17} className="text-white" />
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">UniMate</span>
        </div>

        {/* 유저 카드 */}
        <div className="mx-3 mb-4 p-3 bg-primary-50 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user?.name?.[0] ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.department}</p>
            </div>
          </div>
        </div>

        {/* 내비게이션 */}
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* 로그아웃 */}
        <div className="p-3 border-t border-gray-50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <LogOut size={17} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
