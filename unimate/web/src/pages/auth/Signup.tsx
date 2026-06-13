import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { GraduationCap, Check, ChevronLeft, ChevronDown } from 'lucide-react'
import { API_BASE_URL } from '@/api/client'

const DEPARTMENTS = [
  '신학과','기독교교육과','사회복지학과','상담심리학과','유아교육과',
  '역사문화콘텐츠학과','한국어문학과','영어영문학과','중국어문화학과',
  '미디어영상광고학과','경영학과','국제통상학과','융합전자공학과',
  '컴퓨터공학과','정보통신학과','AI소프트웨어학과','AI데이터사이언스학과',
  '건축학과','건축공학과','스마트인프라공학과','시각·영상디자인학과',
  '산업디자인학과','태권도학과','스포츠건강학과','간호학과',
]

const INTERESTS = ['장학','공모전','교내행사','취업','수업','시설']

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-50 transition-all'

export default function Signup() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1
  const [form, setForm] = useState({ username:'', password:'', passwordConfirm:'', name:'', phone:'', department:'', studentNumber:'', grade:0 })
  const [usernameOk, setUsernameOk] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)

  // Step 2
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [verified, setVerified] = useState(false)
  const [timer, setTimer] = useState(0)

  // Step 3
  const [tags, setTags] = useState<string[]>([])

  const checkUsername = async () => {
    if (!form.username) return
    try {
      await axios.get(`${API_BASE_URL}/api/v1/auth/check-username?username=${form.username}`)
      setUsernameOk(true); setError('')
    } catch { setError('이미 사용 중인 아이디입니다.'); setUsernameOk(false) }
  }

  const sendCode = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_BASE_URL}/api/v1/auth/send-verification`, { email: `${email}@hs.ac.kr` })
      setCodeSent(true); setTimer(300); setError('')
      const t = setInterval(() => setTimer((v) => { if (v <= 1) { clearInterval(t); return 0 } return v - 1 }), 1000)
    } catch { setError('인증번호 발송에 실패했습니다.') } finally { setLoading(false) }
  }

  const verifyCode = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_BASE_URL}/api/v1/auth/verify-email`, { email: `${email}@hs.ac.kr`, code })
      setVerified(true); setError('')
    } catch { setError('인증번호가 올바르지 않습니다.') } finally { setLoading(false) }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const { data: res } = await axios.post(`${API_BASE_URL}/api/v1/auth/register`, {
        username: form.username, password: form.password,
        name: form.name, phone: form.phone, email: `${email}@hs.ac.kr`,
        department: form.department, grade: form.grade,
        student_number: form.studentNumber, interest_tags: tags,
      })
      const { access_token, refresh_token, user } = res.data
      setTokens(access_token)
      localStorage.setItem('unimate_refresh_token', refresh_token)
      setUser({ id: user.id, name: user.name, email: user.email, department: user.department, grade: user.grade })
      navigate('/home')
    } catch { setError('회원가입에 실패했습니다. 다시 시도해주세요.') } finally { setLoading(false) }
  }

  const stepLabels = ['기본 정보', '이메일 인증', '관심 분야']

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary-100">
            <GraduationCap size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">UniMate 회원가입</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* 스텝 */}
          <div className="flex items-center gap-0 mb-8">
            {stepLabels.map((label, i) => {
              const s = i + 1
              const done = step > s
              const active = step === s
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${done ? 'bg-primary-600 text-white' : active ? 'bg-primary-600 text-white shadow-sm shadow-primary-100' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <Check size={14} /> : s}
                    </div>
                    <span className={`text-xs mt-1 font-medium ${active ? 'text-primary-600' : 'text-gray-400'}`}>{label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${done ? 'bg-primary-600' : 'bg-gray-100'}`} />}
                </div>
              )
            })}
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={form.username} onChange={(e) => { setForm({...form, username: e.target.value}); setUsernameOk(false) }}
                  placeholder="아이디 (4~20자 영문·숫자)" className={`flex-1 ${inputCls}`} />
                <button onClick={checkUsername} className="px-4 py-3 border border-primary-600 text-primary-600 text-sm font-semibold rounded-xl hover:bg-primary-50 transition-colors whitespace-nowrap">중복확인</button>
              </div>
              {usernameOk && <p className="text-xs text-green-600">✓ 사용 가능한 아이디입니다</p>}
              <input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} placeholder="비밀번호 (영문+숫자 8자 이상)" className={inputCls} />
              <input type="password" value={form.passwordConfirm} onChange={(e) => setForm({...form, passwordConfirm: e.target.value})} placeholder="비밀번호 확인" className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="이름" className={inputCls} />
                <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="전화번호 010-0000-0000" className={inputCls} />
              </div>
              <div className="relative">
                <button type="button" onClick={() => setDeptOpen(!deptOpen)}
                  className={`w-full flex items-center justify-between ${inputCls} ${form.department ? 'text-gray-900' : 'text-gray-400'}`}>
                  {form.department || '학과 선택'} <ChevronDown size={16} className="text-gray-400" />
                </button>
                {deptOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-auto">
                    {DEPARTMENTS.map((d) => (
                      <button key={d} type="button" onClick={() => { setForm({...form, department: d}); setDeptOpen(false) }}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-primary-50 hover:text-primary-600 transition-colors">{d}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.studentNumber} onChange={(e) => setForm({...form, studentNumber: e.target.value})} placeholder="학번 (9자리)" maxLength={9} className={inputCls} />
                <div className="grid grid-cols-4 gap-1.5">
                  {[1,2,3,4].map((g) => (
                    <button key={g} type="button" onClick={() => setForm({...form, grade: g})}
                      className={`py-3 rounded-xl text-sm font-medium border transition-colors ${form.grade === g ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-500 hover:border-primary-300'}`}>{g}</button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button onClick={() => {
                if (!usernameOk) { setError('아이디 중복 확인을 해주세요.'); return }
                if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
                if (!form.department || !form.grade || !form.name) { setError('모든 항목을 입력해주세요.'); return }
                setError(''); setStep(2)
              }} className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors mt-1">다음</button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2"><ChevronLeft size={16} /> 이전</button>
              <p className="text-sm text-gray-500">한신대학교 이메일(@hs.ac.kr)로 인증해주세요.</p>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center border border-gray-200 rounded-xl focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-50 transition-all">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 앞부분" className="flex-1 px-4 py-3 text-sm outline-none rounded-xl" />
                  <span className="pr-4 text-sm text-gray-400 shrink-0">@hs.ac.kr</span>
                </div>
                <button onClick={sendCode} disabled={loading || !email} className="px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
                  {codeSent ? '재발송' : '발송'}
                </button>
              </div>
              {codeSent && (
                <div className="flex gap-2">
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="인증번호 6자리" maxLength={6} className={`flex-1 ${inputCls}`} />
                  <button onClick={verifyCode} disabled={loading || verified || code.length !== 6}
                    className="px-4 py-3 border border-primary-600 text-primary-600 text-sm font-semibold rounded-xl hover:bg-primary-50 disabled:opacity-60 transition-colors whitespace-nowrap">확인</button>
                </div>
              )}
              {verified && <p className="text-sm text-green-600 font-medium">✓ 인증이 완료됐습니다</p>}
              {timer > 0 && <p className="text-xs text-gray-400">유효시간: {Math.floor(timer/60)}:{String(timer%60).padStart(2,'0')}</p>}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button onClick={() => { if (!verified) { setError('이메일 인증을 완료해주세요.'); return } setError(''); setStep(3) }}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors">다음</button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <button type="button" onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"><ChevronLeft size={16} /> 이전</button>
              <div>
                <p className="text-sm text-gray-700 font-medium mb-1">관심 분야 선택</p>
                <p className="text-xs text-gray-400 mb-3">프로필에서 언제든 수정할 수 있어요.</p>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((tag) => (
                    <button key={tag} type="button" onClick={() => setTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag])}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${tags.includes(tag) ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors">
                {loading ? '가입 중...' : '가입 완료'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-primary-600 font-semibold hover:underline">로그인</Link>
        </p>
      </div>
    </div>
  )
}
