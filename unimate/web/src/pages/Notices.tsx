import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, BookmarkCheck, Search, ChevronRight } from 'lucide-react'
import { apiClient } from '@/api/client'

interface Notice { id: string; title: string; category: string; published_at: string | null; source_type: string; is_bookmarked: boolean }

const TABS = ['전체','학사','장학','행사','취업','공지사항']

const CAT_STYLE: Record<string, string> = {
  '학사': 'bg-indigo-50 text-indigo-600',
  '장학': 'bg-green-50 text-green-600',
  '취업': 'bg-amber-50 text-amber-600',
  '행사': 'bg-purple-50 text-purple-600',
  '공지사항': 'bg-blue-50 text-blue-600',
}

const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''

export default function Notices() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('전체')
  const [items, setItems]         = useState<Notice[]>([])
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)
  const [hasNext, setHasNext]     = useState(false)
  const [total, setTotal]         = useState(0)
  const [search, setSearch]       = useState('')

  const fetchData = useCallback(async (cat: string, p: number, append = false) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 }
      if (cat !== '전체') params.category = cat
      const r = await apiClient.get('/api/v1/notices', { params })
      const d = r.data.data
      setItems((prev) => append ? [...prev, ...d.items] : d.items)
      setHasNext(d.has_next)
      setTotal(d.total)
      setPage(p)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(activeTab, 1) }, [activeTab])

  const toggleBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await apiClient.post(`/api/v1/notices/${id}/bookmark`)
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_bookmarked: !n.is_bookmarked } : n))
  }

  const filtered = search ? items.filter((n) => n.title.toLowerCase().includes(search.toLowerCase())) : items

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">공지사항</h1>
            <p className="text-sm text-gray-400 mt-0.5">총 {total.toLocaleString()}건</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제목 검색..."
              className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-50 w-60 transition-all" />
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading && items.length === 0 ? (
            <div className="divide-y divide-gray-50">
              {Array.from({length: 10}).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-14 h-5 bg-gray-100 rounded-full animate-pulse" />
                  <div className="flex-1 h-4 bg-gray-100 rounded-full animate-pulse" />
                  <div className="w-24 h-4 bg-gray-100 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">공지사항이 없습니다.</div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {filtered.map((n) => (
                  <div key={n.id} onClick={() => navigate(`/notices/${n.id}`)}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors group">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${CAT_STYLE[n.category] ?? 'bg-gray-50 text-gray-500'}`}>{n.category}</span>
                    <p className="flex-1 text-sm text-gray-800 font-medium truncate group-hover:text-primary-600 transition-colors">{n.title}</p>
                    <span className="text-xs text-gray-400 shrink-0">{fmt(n.published_at)}</span>
                    <button onClick={(e) => toggleBookmark(n.id, e)} className="shrink-0 text-gray-300 hover:text-primary-500 transition-colors">
                      {n.is_bookmarked ? <BookmarkCheck size={17} className="text-primary-500" /> : <Bookmark size={17} />}
                    </button>
                    <ChevronRight size={15} className="text-gray-300 shrink-0" />
                  </div>
                ))}
              </div>
              {hasNext && (
                <div className="p-4 border-t border-gray-50 flex justify-center">
                  <button onClick={() => fetchData(activeTab, page + 1, true)}
                    className="px-6 py-2 border border-gray-200 text-sm text-gray-500 rounded-xl hover:border-primary-300 hover:text-primary-600 transition-colors">
                    더 보기
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
