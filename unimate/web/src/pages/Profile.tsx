import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Bell, Lock, LogOut, Trash2 } from 'lucide-react'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

type Tab = 'info' | 'notification' | 'password'

interface Notif { all: boolean; notice: boolean; assignment: boolean; academic: boolean; briefing: boolean; briefing_time: string }

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-50 transition-all'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary-600' : 'bg-gray-200'}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, clearUser } = useAuthStore()
  const [tab, setTab] = useState<Tab>('info')

  const [notif, setNotif]   = useState<Notif>({ all: true, notice: true, assignment: true, academic: true, briefing: true, briefing_time: '09:00' })
  const [saved, setSaved]   = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwErr, setPwErr]   = useState('')
  const [pwLoad, setPwLoad] = useState(false)

  useEffect(() => {
    apiClient.get('/api/v1/users/me/notification-settings').then((r) => {
      const d = r.data.data
      if (d) setNotif({ all: d.all ?? true, notice: d.notice ?? true, assignment: d.assignment ?? true, academic: d.academic ?? true, briefing: d.briefing ?? true, briefing_time: d.briefing_time ?? '09:00' })
    }).catch(() => {})
  }, [])

  const saveNotif = async () => {
    await apiClient.put('/api/v1/users/me/notification-settings', notif)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const changePw = async () => {
    if (pwForm.next !== pwForm.confirm) { setPwErr('새 비밀번호가 일치하지 않습니다.'); return }
    setPwLoad(true); setPwErr('')
    try {
      await apiClient.post('/api/v1/auth/change-password', { current_password: pwForm.current, new_password: pwForm.next })
      localStorage.removeItem('unimate_refresh_token')
      clearUser(); navigate('/login')
    } catch (e: unknown) {
      setPwErr((e as { response?: { status: number } })?.response?.status === 401 ? '현재 비밀번호가 올바르지 않습니다.' : '변경에 실패했습니다.')
    } finally { setPwLoad(false) }
  }

  const logout = () => { localStorage.removeItem('unimate_refresh_token'); clearUser(); navigate('/login') }
  const withdraw = async () => {
    if (!window.confirm('정말 탈퇴하시겠습니까?')) return
    await apiClient.delete('/api/v1/users/me')
    logout()
  }

  const TABS: { key: Tab; icon: typeof User; label: string }[] = [
    { key: 'info', icon: User, label: '내 정보' },
    { key: 'notification', icon: Bell, label: '알림 설정' },
    { key: 'password', icon: Lock, label: '비밀번호 변경' },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">프로필</h1>

      {/* 프로필 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5 mb-6">
        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm shadow-primary-100 shrink-0">
          {user?.name?.[0] ?? 'U'}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{user?.department} · {user?.grade}학년</p>
          {user?.email && <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* 사이드 메뉴 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 h-fit space-y-0.5">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === key ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Icon size={16} />{label}
            </button>
          ))}
          <div className="pt-2 border-t border-gray-50 space-y-0.5">
            <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <LogOut size={16} />로그아웃
            </button>
            <button onClick={withdraw} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
              <Trash2 size={16} />회원탈퇴
            </button>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {tab === 'info' && (
            <div>
              <h3 className="font-bold text-gray-900 mb-6">내 정보</h3>
              <div className="space-y-4">
                {[{ l: '이름', v: user?.name }, { l: '학과', v: user?.department }, { l: '학년', v: user?.grade ? `${user.grade}학년` : '' }, { l: '이메일', v: user?.email }].map(({ l, v }) => (
                  <div key={l} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="w-16 text-sm text-gray-400 shrink-0">{l}</span>
                    <span className="text-sm text-gray-900 font-medium">{v ?? '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'notification' && (
            <div>
              <h3 className="font-bold text-gray-900 mb-6">알림 설정</h3>
              <div className="space-y-5">
                {[
                  { key: 'all',        label: '전체 알림',      desc: '모든 알림을 켜거나 끕니다' },
                  { key: 'notice',     label: '공지 알림',      desc: '새 공지사항 알림' },
                  { key: 'assignment', label: '과제 마감 알림', desc: '마감 임박 과제 알림' },
                  { key: 'academic',   label: '학사일정 알림', desc: '학사 일정 알림' },
                  { key: 'briefing',   label: 'AI 일일 브리핑', desc: '매일 아침 AI 브리핑' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                    <Toggle checked={notif[key as keyof Notif] as boolean} onChange={(v) => setNotif({ ...notif, [key]: v })} />
                  </div>
                ))}
              </div>
              <button onClick={saveNotif} className="mt-8 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                {saved ? '저장됐습니다 ✓' : '저장'}
              </button>
            </div>
          )}

          {tab === 'password' && (
            <div>
              <h3 className="font-bold text-gray-900 mb-1">비밀번호 변경</h3>
              <p className="text-xs text-gray-400 mb-6">변경 후 모든 기기에서 자동 로그아웃됩니다.</p>
              <div className="space-y-4 max-w-sm">
                {[{ k: 'current', l: '현재 비밀번호' }, { k: 'next', l: '새 비밀번호' }, { k: 'confirm', l: '새 비밀번호 확인' }].map(({ k, l }) => (
                  <div key={k}>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{l}</label>
                    <input type="password" value={pwForm[k as keyof typeof pwForm]}
                      onChange={(e) => setPwForm({ ...pwForm, [k]: e.target.value })} className={inputCls} />
                  </div>
                ))}
                {pwErr && <p className="text-sm text-red-500">{pwErr}</p>}
                <button onClick={changePw} disabled={pwLoad} className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-sm">
                  {pwLoad ? '변경 중...' : '변경하기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
