import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { apiClient } from '@/api/client'

interface Schedule { id: string; title: string; date: string; time: string | null; category: string; source: string; is_completed: boolean }

const CAT_COLOR: Record<string, string> = { '개인': 'bg-blue-400', '학사': 'bg-indigo-500', '과제': 'bg-amber-400', '시험': 'bg-red-400' }
const CAT_DOT:   Record<string, string> = { '개인': 'bg-blue-400', '학사': 'bg-indigo-500', '과제': 'bg-amber-400', '시험': 'bg-red-400' }

export default function Schedule() {
  const [cur, setCur]             = useState(new Date())
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [newTitle, setNewTitle]   = useState('')
  const [newDate, setNewDate]     = useState('')
  const [newCat, setNewCat]       = useState('개인')

  const year = cur.getFullYear(), month = cur.getMonth()
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

  useEffect(() => {
    apiClient.get('/api/v1/schedules', { params: { month: monthKey } })
      .then((r) => setSchedules(r.data.data ?? [])).catch(() => {})
  }, [monthKey])

  const firstDay   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)
  const todayStr = new Date().toISOString().slice(0, 10)

  const ds = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const daySch = (d: number) => schedules.filter((s) => s.date === ds(d))
  const selSch  = selected ? schedules.filter((s) => s.date === selected) : []

  const addSchedule = async () => {
    if (!newTitle || !newDate) return
    await apiClient.post('/api/v1/schedules', { title: newTitle, start_at: `${newDate}T00:00:00.000Z`, category: newCat, is_allday: true, source: 'user' })
    const r = await apiClient.get('/api/v1/schedules', { params: { month: monthKey } })
    setSchedules(r.data.data ?? [])
    setShowForm(false); setNewTitle(''); setNewDate('')
  }

  const del = async (id: string) => {
    await apiClient.delete(`/api/v1/schedules/${id}`)
    setSchedules((p) => p.filter((s) => s.id !== id))
  }

  const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-50 transition-all'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">일정</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          <Plus size={16} /> 일정 추가
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 캘린더 */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <button onClick={() => setCur(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={17} /></button>
            <h2 className="font-bold text-gray-900">{year}년 {month + 1}월</h2>
            <button onClick={() => setCur(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={17} /></button>
          </div>
          <div className="grid grid-cols-7">
            {['일','월','화','수','목','금','토'].map((d) => (
              <div key={d} className="py-3 text-center text-xs font-semibold text-gray-400">{d}</div>
            ))}
            {cells.map((d, i) => {
              const dateStr = d ? ds(d) : ''
              const isToday = dateStr === todayStr
              const isSel   = dateStr === selected
              const dots    = d ? daySch(d) : []
              return (
                <div key={i} onClick={() => d && setSelected(isSel ? null : dateStr)}
                  className={`min-h-[72px] p-2 border-t border-gray-50 transition-colors ${d ? 'cursor-pointer hover:bg-gray-50' : ''} ${isSel ? 'bg-primary-50' : ''}`}>
                  {d && (
                    <>
                      <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-sm font-medium ${isToday ? 'bg-primary-600 text-white' : isSel ? 'text-primary-600 font-bold' : 'text-gray-700'}`}>{d}</span>
                      <div className="mt-1 space-y-0.5">
                        {dots.slice(0, 3).map((s) => (
                          <div key={s.id} className={`h-1 rounded-full ${CAT_COLOR[s.category] ?? 'bg-gray-300'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 선택일 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-900">
              {selected ? new Date(selected + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '날짜를 선택하세요'}
            </h3>
          </div>
          <div className="flex-1 divide-y divide-gray-50 overflow-auto">
            {selSch.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">{selected ? '일정이 없습니다.' : ''}</div>
            ) : selSch.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${CAT_DOT[s.category] ?? 'bg-gray-300'}`} />
                  <div>
                    <p className={`text-sm font-medium ${s.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.time ?? '종일'} · {s.category}</p>
                  </div>
                </div>
                {s.source === 'user' && (
                  <button onClick={() => del(s.id)} className="text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">일정 추가</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">제목</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="일정 제목" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">날짜</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">카테고리</label>
                <div className="grid grid-cols-4 gap-2">
                  {['개인','학사','과제','시험'].map((c) => (
                    <button key={c} type="button" onClick={() => setNewCat(c)}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${newCat === c ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-500 hover:border-primary-300'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <button onClick={addSchedule} className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors mt-1 shadow-sm">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
