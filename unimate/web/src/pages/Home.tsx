import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, FileText, Calendar, Flame, ChevronRight } from 'lucide-react'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

interface TopNotice { rank: number; id: string; title: string; category: string; published_at: string }

const CAT_STYLE: Record<string, string> = {
  '학사': 'bg-indigo-50 text-indigo-600',
  '장학': 'bg-green-50 text-green-600',
  '취업': 'bg-amber-50 text-amber-600',
  '행사': 'bg-purple-50 text-purple-600',
  '공지사항': 'bg-blue-50 text-blue-600',
}

const RANK_TXT  = ['text-amber-500', 'text-gray-400', 'text-orange-400']
const RANK_BG   = ['bg-amber-50',    'bg-gray-50',    'bg-orange-50'   ]

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-gray-100 rounded-full animate-pulse ${className}`} />
}

export default function Home() {
  const user    = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [briefing, setBriefing]           = useState('')
  const [briefingLoading, setBriefingLoading] = useState(true)
  const [summary, setSummary]             = useState<{ pendingAssignments: number; nextExamDday: number | null } | null>(null)
  const [tab, setTab]                     = useState<'daily' | 'weekly'>('daily')
  const [daily, setDaily]                 = useState<TopNotice[]>([])
  const [weekly, setWeekly]               = useState<TopNotice[]>([])
  const [topLoading, setTopLoading]       = useState(true)

  const todayLabel = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  useEffect(() => {
    apiClient.get('/api/v1/chat/daily-summary')
      .then((r) => setBriefing(r.data.data?.summary ?? ''))
      .catch(() => setBriefing(''))
      .finally(() => setBriefingLoading(false))

    Promise.all([
      apiClient.get('/api/v1/schedules/count', { params: { category: '과제' } }),
      apiClient.get('/api/v1/schedules/next-exam'),
    ]).then(([a, b]) =>
      setSummary({ pendingAssignments: a.data.data?.count ?? 0, nextExamDday: b.data.data?.dday ?? null })
    ).catch(() => {})

    Promise.all([
      apiClient.get('/api/v1/notices/daily-top3'),
      apiClient.get('/api/v1/notices/weekly-top3'),
    ]).then(([a, b]) => { setDaily(a.data.data ?? []); setWeekly(b.data.data ?? []) })
      .catch(() => {})
      .finally(() => setTopLoading(false))
  }, [])

  const topData = tab === 'daily' ? daily : weekly

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">안녕하세요, {user?.name}님 👋</h1>
        <p className="text-sm text-gray-400 mt-1">{todayLabel}</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 왼쪽 2/3 */}
        <div className="col-span-2 space-y-5">
          {/* AI 브리핑 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-primary-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-primary-600" />
                <span className="text-sm font-bold text-primary-600">AI 오늘의 브리핑</span>
              </div>
              <span className="text-xs text-primary-400">{todayLabel}</span>
            </div>
            <div className="px-6 py-5">
              {briefingLoading ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-3.5 w-11/12" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-8/12" />
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">{briefing || '브리핑을 준비 중입니다.'}</p>
              )}
            </div>
            <div className="px-6 py-3.5 border-t border-gray-50">
              <button onClick={() => navigate('/chat')} className="flex items-center gap-1 text-sm text-primary-600 font-semibold hover:underline ml-auto">
                AI에게 더 물어보기 <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                  <FileText size={17} className="text-amber-500" />
                </div>
                <span className="text-sm text-gray-400 font-medium">남은 과제</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {summary == null ? <Skeleton className="h-8 w-16 inline-block" /> : summary.pendingAssignments}
                {summary != null && <span className="text-base font-medium text-gray-300 ml-1">개</span>}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                  <Calendar size={17} className="text-red-400" />
                </div>
                <span className="text-sm text-gray-400 font-medium">시험 D-Day</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {summary == null ? <Skeleton className="h-8 w-16 inline-block" /> : summary.nextExamDday != null ? <>D-{summary.nextExamDday}</> : <span className="text-gray-300">없음</span>}
              </p>
            </div>
          </div>
        </div>

        {/* 오른쪽: 추천 공지 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 flex items-center gap-2 border-b border-gray-50">
            <Flame size={15} className="text-primary-600" />
            <span className="text-sm font-bold text-gray-900">많이 본 공지</span>
          </div>
          <div className="flex border-b border-gray-50">
            {(['daily','weekly'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-all ${tab === t ? 'text-primary-600 border-b-2 border-primary-600 -mb-px' : 'text-gray-400 hover:text-gray-600'}`}>
                {t === 'daily' ? '일간 TOP 3' : '주간 TOP 3'}
              </button>
            ))}
          </div>
          <div className="flex-1 divide-y divide-gray-50">
            {topLoading ? [1,2,3].map((i) => (
              <div key={i} className="p-4 flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-2.5 w-2/5" />
                </div>
              </div>
            )) : topData.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">데이터가 없습니다</div>
            ) : topData.map((n) => (
              <button key={n.rank} onClick={() => n.id && navigate(`/notices/${n.id}`)}
                className="w-full p-4 flex gap-3 hover:bg-gray-50 transition-colors text-left group">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${RANK_BG[n.rank-1]} ${RANK_TXT[n.rank-1]}`}>{n.rank}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-2 group-hover:text-primary-600 transition-colors">{n.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_STYLE[n.category] ?? 'bg-gray-50 text-gray-500'}`}>{n.category}</span>
                    <span className="text-xs text-gray-400">{n.published_at}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
