import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { API_BASE_URL } from '@/api/client'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  '이번 학기 장학금 신청 일정 알려줘',
  '수강신청 정정 기간이 언제야?',
  '근로장학생 신청 자격이 어떻게 돼?',
]

export default function Chat() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    setMessages((p) => [...p, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    setMessages((p) => [...p, { role: 'assistant', content: '' }])

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      })
      const raw = await res.text()
      let full = ''
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const parsed = JSON.parse(line.slice(6).trim())
        if (parsed.type === 'session_id') setSessionId(parsed.content)
        if (parsed.type === 'token') {
          full += parsed.content
          setMessages((p) => { const u = [...p]; u[u.length - 1] = { role: 'assistant', content: full }; return u })
        }
        if (parsed.type === 'done') break
      }
    } catch {
      setMessages((p) => { const u = [...p]; u[u.length - 1] = { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }; return u })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-8 py-5 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm shadow-primary-100">
          <Sparkles size={17} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900">AI 도우미</h1>
          <p className="text-xs text-gray-400">{loading ? '답변 생성 중...' : '무엇이든 물어보세요'}</p>
        </div>
      </div>

      {/* 메시지 */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center">
              <Sparkles size={26} className="text-primary-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">AI 도우미에게 물어보세요</p>
              <p className="text-sm text-gray-400 mt-1">장학금, 학사일정, 공지사항을 질문할 수 있어요</p>
            </div>
            <div className="grid gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-all text-left shadow-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Sparkles size={13} className="text-white" />
                  </div>
                )}
                <div className={`max-w-lg px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-md'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
                }`}>
                  {m.content || (loading && i === messages.length - 1
                    ? <span className="flex gap-1 py-0.5">
                        {[0,150,300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                      </span>
                    : null)}
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <User size={13} className="text-gray-500" />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="px-8 py-5 border-t border-gray-100 bg-white shrink-0">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="메시지를 입력하세요... (Enter로 전송)"
            rows={1}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-50 transition-all"
          />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            className="w-11 h-11 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-sm">
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
