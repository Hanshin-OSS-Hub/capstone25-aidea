import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Bookmark, BookmarkCheck, ExternalLink, Sparkles } from 'lucide-react'
import { apiClient } from '@/api/client'

interface Notice {
  id: string; title: string; category: string
  published_at: string | null; source_type: string
  content: string; summary: string | null
  source_url: string | null; is_bookmarked: boolean
}

const CAT_STYLE: Record<string, string> = {
  '학사': 'bg-indigo-50 text-indigo-600',
  '장학': 'bg-green-50 text-green-600',
  '취업': 'bg-amber-50 text-amber-600',
  '행사': 'bg-purple-50 text-purple-600',
  '공지사항': 'bg-blue-50 text-blue-600',
}

export default function NoticeDetail() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [notice, setNotice]   = useState<Notice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    apiClient.get(`/api/v1/notices/${id}`)
      .then((r) => setNotice(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const toggleBookmark = async () => {
    if (!notice) return
    await apiClient.post(`/api/v1/notices/${notice.id}/bookmark`)
    setNotice((p) => p ? { ...p, is_bookmarked: !p.is_bookmarked } : p)
  }

  if (loading) return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <div className="h-5 w-28 bg-gray-100 rounded-full animate-pulse" />
      <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-4">
        <div className="h-6 bg-gray-100 rounded-full animate-pulse w-2/3" />
        <div className="h-4 bg-gray-100 rounded-full animate-pulse w-1/3" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse mt-4" />
      </div>
    </div>
  )

  if (!notice) return (
    <div className="p-8 text-center text-gray-400">공지를 찾을 수 없습니다.</div>
  )

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ChevronLeft size={17} /> 목록으로
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* 헤더 */}
        <div className="p-8 border-b border-gray-50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${CAT_STYLE[notice.category] ?? 'bg-gray-50 text-gray-500'}`}>{notice.category}</span>
              <h1 className="text-xl font-bold text-gray-900 mt-3 leading-snug">{notice.title}</h1>
              <p className="text-sm text-gray-400 mt-2">
                {notice.published_at ? new Date(notice.published_at).toLocaleDateString('ko-KR') : ''} · {notice.source_type}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={toggleBookmark} className="p-2.5 border border-gray-200 rounded-xl hover:border-primary-300 transition-colors">
                {notice.is_bookmarked
                  ? <BookmarkCheck size={17} className="text-primary-500" />
                  : <Bookmark size={17} className="text-gray-400" />}
              </button>
              {notice.source_url && (
                <a href={notice.source_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  원문 보기 <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* AI 요약 */}
        {notice.summary && (
          <div className="mx-8 my-6 bg-primary-50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles size={14} className="text-primary-600" />
              <span className="text-sm font-bold text-primary-600">AI 요약</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{notice.summary}</p>
          </div>
        )}

        {/* 본문 */}
        <div className="px-8 pb-8">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {notice.content || '본문 내용이 없습니다.'}
          </p>
        </div>
      </div>
    </div>
  )
}
