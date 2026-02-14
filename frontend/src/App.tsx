import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { TodayUpcoming } from './components/TodayUpcoming';
import { OpportunitiesFilter } from './components/OpportunitiesFilter';
import { OpportunityCard } from './components/OpportunityCard';
import { CalendarPreview } from './components/CalendarPreview';
import { AIAssistant } from './components/AIAssistant';
import { NoticeDetail } from './components/NoticeDetail';
import { FullCalendar } from './components/FullCalendar';
import { AIChat } from './components/AIChat';
import { MyPage } from './components/MyPage';
import { ActivityHistory } from './components/ActivityHistory';
import { ProfileDetail } from './components/ProfileDetail';
import { BookmarkedNotices } from './components/BookmarkedNotices';
import { ParticipatedNotices } from './components/ParticipatedNotices';
import { useNotices } from './hooks/useNotices';
import { useCalendar } from './hooks/useCalendar';
import { getNoticeDetail } from './lib/api-functions';

export default function App() {
  // API 데이터 훅
  const { notices, favoriteNotices, loading: noticesLoading, toggleFavorite } = useNotices(1);
  const { events, loadEvents, addEvent, removeEvent, addEventFromNotice } = useCalendar(1);
  
  // UI 상태
  const [activeFilter, setActiveFilter] = useState('전체');
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'notices' | 'calendar' | 'ai' | 'mypage' | 'activity-history' | 'profile-detail' | 'bookmarked-notices' | 'participated-notices'>('dashboard');
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [participatedNotices, setParticipatedNotices] = useState<number[]>([]);
  const [completedActivities, setCompletedActivities] = useState<Array<{
    id: number;
    noticeId: number;
    result: string;
    completedDate: string;
  }>>([]);
  const [activityEvidences, setActivityEvidences] = useState<Record<number, Array<{
    id: number;
    name: string;
    type: 'certificate' | 'award' | 'proof';
    uploadDate: string;
  }>>>({});
  const [showNoticeDetail, setShowNoticeDetail] = useState(false);
  // Notice page filters
  const [noticeStatusFilter, setNoticeStatusFilter] = useState<'전체' | '마감 임박' | '마감'>('전체');
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState('전체');

  // Helper function to calculate days left
  const calculateDaysLeft = (deadline: string): number => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const normalizeCategory = (category: string | null | undefined): string => {
    if (!category) return '공지사항';
    const raw = String(category).trim();
    const lower = raw.toLowerCase();

    if (raw.includes('장학') || lower === 'scholarship') return '장학금';
    if (raw.includes('공모') || raw.includes('대회') || raw.includes('프로그램') || lower === 'event' || lower === 'career') return '공모전';
    if (raw.includes('학사') || lower === 'academic') return '공지사항';
    if (raw.includes('공지')) return '공지사항';

    return '공지사항';
  };

  // 공지사항 상세 데이터 로드
  const loadNoticeDetail = async (noticeId: number) => {
    try {
      const response = await getNoticeDetail(noticeId, 1);
      if (response.success) {
        const apiNotice = response.data;
        const ai = apiNotice.ai;

        const endDate: string = ai?.end_date || '';
        const startDate: string = ai?.start_date || '';
        const summaryLines: string[] = Array.isArray(ai?.summary_3lines) ? ai.summary_3lines : [];
        const summaryText = summaryLines.filter(Boolean).join(' ');

        const extracted = ai?.extracted_json || {};
        const category = normalizeCategory(ai?.category || apiNotice?.tags?.[0]);

        const viewModel = {
          id: apiNotice.notice_id,
          title: apiNotice.title,
          category,
          deadline: endDate,
          daysLeft: endDate ? calculateDaysLeft(endDate) : 0,
          description: summaryText || (apiNotice.content ? String(apiNotice.content).slice(0, 140) + '...' : ''),
          isNew: false,
          department: '',
          publishDate: endDate || '',
          detailContent: {
            summary: {
              일정: startDate && endDate ? `${startDate} ~ ${endDate}` : (endDate ? `~ ${endDate}` : '일정 정보 없음'),
              시간: '',
              장소: extracted.location || '',
              대상: extracted.target || '',
              핵심안내: summaryText || 'AI 요약 정보가 없습니다.',
            },
            fullContent: apiNotice.content || '',
            keywords: [],
            attachments: [],
            originalLink: apiNotice.original_url || '',
          },
        };

        setSelectedNotice(viewModel);
        setShowNoticeDetail(true);
      }
    } catch (err) {
      console.error('공지사항 상세 로딩 오류:', err);
    }
  };

  // Mock data for opportunities (fallback)
  const mockOpportunities = [
    {
      id: 1,
      title: '2026학년도 1학기 국가장학금 신청',
      category: '장학금',
      deadline: '2026-01-23',
      daysLeft: calculateDaysLeft('2026-01-23'),
      description: '소득 8분위 이하 대학생 대상 국가장학금 신청 기간입니다.',
      uploadDate: '2026-01-10',
      isNew: true,
      department: '학생지원팀',
      publishDate: '2026년 1월 8일',
      detailContent: {
        summary: {
          일정: '2026년 1월 10일부터 시작됩니다',
          시간: '오전 9시 ~ 오후 6시 (온라인 24시간)',
          장소: '한국장학재단 홈페이지 (www.kosaf.go.kr)',
          대상: '소득 8분위 이하 재학생 및 신입생',
          핵심안내: '국가장학금 2차 신청이 1월 10일부터 시작됩니다. 2월 15일까지 신청 가능하며, 가구원 동의가 필요합니다.',
        },
        fullContent: '2026학년도 1학기 국가장학금 2차 신청을 아래와 같이 안내합니다. 신청기간: 2026.01.10 ~ 2026.02.15, 신청대상: 재학생 및 신입생, 제출서류: 가구원 동의 등 필수.',
        keywords: ['장학', '국가장학금', '학생지원'],
        attachments: [
          { name: '국가장학금_신청안내.pdf', size: '2.3MB', type: 'PDF' },
          { name: '신청서_양식.hwp', size: '1.8MB', type: 'HWP' },
        ],
        originalLink: 'https://www.kosaf.go.kr/ko/notice.do?pg=scholarship',
      },
    },
    {
      id: 2,
      title: '제15회 대학생 창업경진대회',
      category: '공모전',
      deadline: '2026-02-05',
      daysLeft: calculateDaysLeft('2026-02-05'),
      description: '혁신적인 아이디어를 가진 대학생 창업팀을 모집합니다.',
      uploadDate: '2026-01-15',
      isNew: false,
      department: '창업지원센터',
      publishDate: '2026년 1월 15일',
      detailContent: {
        summary: {
          일정: '2026년 1월 15일 ~ 2월 5일 (접수마감)',
          시간: '본선: 2026년 2월 20일 오후 2시',
          장소: '서울 스타트업 허브 (본선 발표)',
          대상: '전국 대학(원)생 3인 이내 팀 구성',
          핵심안내: '우수팀 총 상금 3,000만원. 대상 1팀(1,000만원), 최우수상 2팀(각 500만원), 우수상 3팀(각 300만원). 서류 심사 후 본선 진출팀 발표.',
        },
        fullContent: '제15회 대학생 창업경진대회를 개최합니다. 혁신적인 아이디어로 미래를 준비하는 대학생 여러분의 많은 참여 바랍니다.',
        keywords: ['공모전', '창업', '경진대회'],
        attachments: [
          { name: '창업경진대회_공고문.pdf', size: '3.1MB', type: 'PDF' },
          { name: '사업계획서_양식.docx', size: '45KB', type: 'DOCX' },
        ],
        originalLink: 'https://startup.go.kr/competition/2024',
      },
    },
    {
      id: 3,
      title: '2026 봄학기 교환학생 프로그램 안내',
      category: '공지사항',
      deadline: '2026-01-21',
      daysLeft: calculateDaysLeft('2026-01-21'),
      description: '유럽 및 아시아 자매대학 교환학생 프로그램 신청 안내',
      uploadDate: '2026-01-12',
      detailContent: {
        summary: {
          일정: '2026년 8월 ~ 12월 (1학기) 또는 2027년 1 ~ 6월 (2학기)',
          시간: '신청 마감: 2026년 1월 21일 오후 5시',
          장소: '국제교류처 (신청 후 개별 면접)',
          대상: '재학생 중 평점 3.0 이상, TOEFL 80점 또는 IELTS 6.0 이상',
          핵심안내: '파견 대학: 독일 베를린대, 프랑스 소르본대, 일본 와세다대 등 15개교. 학점 인정 가능. 장학금 지원 별도 선발.',
        },
        attachments: [
          { name: '교환학생_파견대학목록.pdf', size: '2.7MB' },
          { name: '신청서_양식.hwp', size: '120KB' },
        ],
        originalLink: 'https://international.university.ac.kr/exchange',
      },
    },
    {
      id: 4,
      title: '성적우수장학금 신청 안내',
      category: '장학금',
      deadline: '2026-01-25',
      daysLeft: calculateDaysLeft('2026-01-25'),
      description: '직전 학기 평점 3.8 이상 학생 대상 장학금',
      uploadDate: '2026-01-08',
      detailContent: {
        summary: {
          일정: '2026년 1월 10일 ~ 1월 25일',
          시간: '신청 및 서류 제출: 평일 오전 9시 ~ 오후 5시',
          장소: '학생지원처 장학담당 (온라인 신청 가능)',
          대상: '직전 학기 평점 3.8 이상 재학생',
          핵심안내: '등록금의 30% 지원. 학과별 상위 10% 이내 자동 선발. 추가 신청자는 성적 및 가계 소득 종합 평가.',
        },
        attachments: [
          { name: '성적우수장학금_안내.pdf', size: '1.5MB' },
        ],
        originalLink: 'https://scholarship.university.ac.kr/merit',
      },
    },
    {
      id: 5,
      title: '2026 빅데이터 분석 공모전',
      category: '공모전',
      deadline: '2026-02-10',
      daysLeft: calculateDaysLeft('2026-02-10'),
      description: 'AI 및 빅데이터 활용 우수 사례 공모',
      uploadDate: '2026-01-05',
      detailContent: {
        summary: {
          일정: '2026년 1월 5일 ~ 2월 10일 (제출 마감)',
          시간: '최종 발표: 2026년 3월 5일 오후 1시',
          장소: 'AI 연구센터 대강당',
          대상: '전공 무관, 개인 또는 팀 (최대 4인)',
          핵심안내: '주제: 공공데이터 활용 사회문제 해결. Python, R, SQL 등 자유 활용. 최우수상 500만원, 우수상 300만원, 장려상 100만원.',
        },
        attachments: [
          { name: '공모전_세부사항.pdf', size: '2.9MB' },
          { name: '데이터셋_다운로드_안내.pdf', size: '850KB' },
        ],
        originalLink: 'https://bigdata.contest.ac.kr/2024',
      },
    },
    {
      id: 6,
      title: '학생회관 리모델링 공사 안내',
      category: '공지사항',
      deadline: '2026-01-20',
      daysLeft: calculateDaysLeft('2026-01-20'),
      description: '1월 20일부터 2월 10일까지 학생회관 일부 시설 이용 제한',
      uploadDate: '2026-01-13',
      detailContent: {
        summary: {
          일정: '2026년 1월 20일 ~ 2월 10일 (약 3주간)',
          시간: '공사 시간: 평일 오전 8시 ~ 오후 6시',
          장소: '학생회관 1층 및 지하 1층 (당, 편의점, 휴게실)',
          대상: '전체 재학생',
          핵심안내: '공사 기간 중 1층 식당 운영 중단. 대체 식당은 제2학생회관 이용 가능. 편의점은 임시 매장(도서관 옆) 운영. 불편 최소화 노력 중.',
        },
        attachments: [
          { name: '리모델링_공사계획.pdf', size: '4.2MB' },
        ],
        originalLink: 'https://facility.university.ac.kr/notice/remodeling',
      },
    },
    // 한신대학교 관련 공지사항
    {
      id: 7,
      title: '한신대학교 AI·빅데이터 융합 특강',
      category: '프로그램',
      deadline: '2026-01-28',
      daysLeft: calculateDaysLeft('2026-01-28'),
      description: '한신대학교 소프트웨어융합학부 주최 AI 특강 및 실습 프로그램',
      uploadDate: '2026-01-18',
      detailContent: {
        summary: {
          일정: '2026년 2월 3일 ~ 2월 7일 (5일간)',
          시간: '오후 2시 ~ 5시 (일 3시간)',
          장소: '한신대학교 IT융합관 401호',
          대상: '한신대 재학생 및 타 대학 학생 (선착순 50명)',
          핵심안내: 'ChatGPT, 머신러닝 기초, 데이터 시각화 등 실습 중심 교육. 수료증 발급. 노트북 지참 필수. 참가비 무료.',
        },
        attachments: [
          { name: 'AI특강_커리큘럼.pdf', size: '1.9MB' },
          { name: '신청서_양식.docx', size: '78KB' },
        ],
        originalLink: 'https://hanshin.ac.kr/software/notice',
      },
    },
    {
      id: 8,
      title: '한신대학교 중앙도서관 24시간 열람실 운영',
      category: '공지사항',
      deadline: '2026-02-28',
      daysLeft: calculateDaysLeft('2026-02-28'),
      description: '시험기간 대비 중앙도서관 24시간 열람실 특별 운영 안내',
      uploadDate: '2026-01-19',
      detailContent: {
        summary: {
          일정: '2026년 1월 27일 ~ 2월 28일',
          시간: '24시간 운영 (휴관일 없음)',
          장소: '한신대학교 중앙도서관 3층 열람실',
          대상: '한신대학교 재학생 (학생증 필수)',
          핵심안내: '좌석 사전 예약제 운영. 도서관 모바일 앱에서 약 가능. 음식물 반입 금지. 조용한 학습 환경 조성을 위해 화 지.',
        },
        attachments: [
          { name: '좌석예약_이용안내.pdf', size: '1.2MB' },
        ],
        originalLink: 'https://library.hanshin.ac.kr/notice',
      },
    },
    {
      id: 9,
      title: '한신대학교 제32회 학술제 논문 발표자 모집',
      category: '공모전',
      deadline: '2026-02-15',
      daysLeft: calculateDaysLeft('2026-02-15'),
      description: '한신대 학술제 학술논문 및 연구 프로젝트 발표자 모집',
      uploadDate: '2026-01-16',
      detailContent: {
        summary: {
          일정: '논문 접수: 2026년 1월 20일 ~ 2월 15일 / 발표: 3월 12일',
          시간: '발표대회: 2026년 3월 12일 오전 10시',
          장소: '한신대학교 학생회관 대강당',
          대상: '한신대 재학생 (개인 또는 팀, 최대 3인)',
          핵심안내: '전 학과 참여 가능. 우수논문상 200만원, 최우수상 100만원, 장려상 50만원. 심사는 교수진 및 외부 전문가로 구성.',
        },
        attachments: [
          { name: '학술제_공고문.pdf', size: '2.1MB' },
          { name: '논문양식_템플릿.hwp', size: '156KB' },
        ],
        originalLink: 'https://hanshin.ac.kr/academic/festival',
      },
    },
    // 추가 일반 공지사항 5개
    {
      id: 10,
      title: '2026 취업 역량 강화 특강',
      category: '프로그램',
      deadline: '2026-02-01',
      daysLeft: calculateDaysLeft('2026-02-01'),
      description: '이력서 작성부터 면접 준비까지 취업 전 과정 완벽 대비',
      uploadDate: '2026-01-14',
      detailContent: {
        summary: {
          일정: '2026년 2월 5일 ~ 2월 14일 (주 2회, 총 6회)',
          시간: '매주 화·목 오후 3시 ~ 5시',
          장소: '학생지원센터 세미나실',
          대상: '3, 4학년 재학생 및 졸업예정자',
          핵심안내: '현직 HR 담당자 초청 특강. 이력서·자기소개서 첨삭, 모의 면접 실습 포함. 참가자 전원 수료증 발급.',
        },
        attachments: [
          { name: '취업특강_상세안내.pdf', size: '1.6MB' },
        ],
        originalLink: 'https://career.university.ac.kr/programs',
      },
    },
    {
      id: 11,
      title: '2026 봄학기 동아리 박람회 개최',
      category: '공지사항',
      deadline: '2026-01-30',
      daysLeft: calculateDaysLeft('2026-01-30'),
      description: '새학기 동아리 신입회원 모집 박람회 안내',
      uploadDate: '2026-01-17',
      detailContent: {
        summary: {
          일정: '2026년 2월 4일 ~ 2월 5일 (2일간)',
          시간: '오전 10시 ~ 오후 5시',
          장소: '대운동장 및 학생회관 앞 장',
          대상: '전체 재학생',
          핵심안내: '80여개 동아리 참가. 공연, 전시, 체험 부스 운영. 현장 가입 시 소정의 기념품 증정. 우천 시 학생회관 내부에서 진행.',
        },
        attachments: [
          { name: '참가동아리_목록.pdf', size: '980KB' },
        ],
        originalLink: 'https://student.university.ac.kr/club/festival',
      },
    },
    {
      id: 12,
      title: '학생증 재발급 및 모바일 학생증 신청 안내',
      category: '공지사항',
      deadline: '2026-03-15',
      daysLeft: calculateDaysLeft('2026-03-15'),
      description: '분실·훼손 학생증 재발급 및 모바일 학생증 발급 신청',
      uploadDate: '2026-01-11',
      detailContent: {
        summary: {
          일정: '상시 신청 가능 (2026년 1월 ~ 3월)',
          시간: '평일 오전 9시 ~ 오후 5시',
          장소: '학생지원처 (온라인 신청 후 방문 수령)',
          대상: '재학생 전체',
          핵심안내: '재발급 비용: 5,000원. 모바일 학생증은 무료. 온라인 신청 후 3일 내 발급. 모바일 학생증은 전용 앱 다운로드 필요.',
        },
        attachments: [
          { name: '학생증_재발급_신청서.pdf', size: '520KB' },
          { name: '모바일학생증_이용안내.pdf', size: '1.1MB' },
        ],
        originalLink: 'https://student.university.ac.kr/id-card',
      },
    },
    {
      id: 13,
      title: '2026-1학기 기숙사 입사 신청',
      category: '공지사항',
      deadline: '2026-01-27',
      daysLeft: calculateDaysLeft('2026-01-27'),
      description: '봄학기 기숙사 입사생 모집 (신입생 및 재학생)',
      uploadDate: '2026-01-09',
      detailContent: {
        summary: {
          일정: '신청 기간: 2026년 1월 15일 ~ 1월 27일',
          시간: '입사일: 2026년 2월 20일',
          장소: '교내 기숙사 (남학생동, 여학생동)',
          대상: '신입생 우선 배정, 재학생 성적순 선발',
          핵심안내: '2인 1실 기준. 학기당 120만원 (식비 별도). 합격자는 2월 3일 발표. 입사 시 보증금 10만원 별도.',
        },
        attachments: [
          { name: '기숙사_입사안내.pdf', size: '2.5MB' },
          { name: '신청서_양식.hwp', size: '92KB' },
        ],
        originalLink: 'https://dorm.university.ac.kr/apply',
      },
    },
    {
      id: 14,
      title: '대학생 봉사활동 프로그램 참가자 모집',
      category: '프로그램',
      deadline: '2026-02-12',
      daysLeft: calculateDaysLeft('2026-02-12'),
      description: '지역사회 연계 봉사활동 프로그램 (봉사시간 인정)',
      uploadDate: '2026-01-07',
      detailContent: {
        summary: {
          일정: '2026년 2월 17일 ~ 2월 28일 (주 2회)',
          시간: '매주 화·목 오후 1시 ~ 5시 (4시간)',
          장소: '지역 복지센터, 경로당, 도서관 등',
          대상: '전체 재학생 (선착순 30명)',
          핵심안내: '총 봉사시간 24시간 인정. 1365 자원봉사 포털 연계. 참가비 무료. 교통비 일부 지원. 봉사활동 확인서 발급.',
        },
        attachments: [
          { name: '봉사활동_프로그램안내.pdf', size: '1.4MB' },
        ],
        originalLink: 'https://volunteer.university.ac.kr/programs',
      },
    },
  ];

  // 실제 API 데이터 우선 사용, 없으면 Mock 데이터 사용
  const opportunities = notices.length > 0
    ? notices.map(notice => ({
        id: notice.notice_id,
        title: notice.title,
        category: normalizeCategory(notice.category),
        deadline: notice.end_date || '',
        daysLeft: typeof notice.d_day === 'number' ? notice.d_day : (notice.end_date ? calculateDaysLeft(notice.end_date) : 0),
        description: '상세 보기로 확인하세요.',
        uploadDate: '',
        isNew: false,
        department: '',
        publishDate: '',
        tags: notice.tags,
        detailContent: null as any,
      }))
    : mockOpportunities;

  const filteredOpportunities = activeFilter === '전체'
    ? opportunities
    : opportunities.filter(opp => opp.category === activeFilter);

  const handleNoticeClick = async (id: number) => {
    await loadNoticeDetail(id);
  };

  const handleBackToDashboard = () => {
    setSelectedNotice(null);
    setShowNoticeDetail(false);
  };

  const handleNavigateToNotices = () => {
    setCurrentPage('notices');
  };

  const handleNavigateToDashboard = () => {
    setCurrentPage('dashboard');
  };

  const handleNavigateToCalendar = () => {
    setCurrentPage('calendar');
  };

  const handleNavigateToAI = () => {
    setCurrentPage('ai');
  };

  const handleNavigateToMyPage = () => {
    setCurrentPage('mypage');
  };

  const handleNavigateToActivityHistory = () => {
    setCurrentPage('activity-history');
  };

  const handleNavigateToProfileDetail = () => {
    setCurrentPage('profile-detail');
  };

  const handleNavigateToBookmarkedNotices = () => {
    setCurrentPage('bookmarked-notices');
  };

  const handleNavigateToParticipatedNotices = () => {
    setCurrentPage('participated-notices');
  };

  const handleBookmarkToggle = async (id: number) => {
    await toggleFavorite(id);
  };

  // 관심 등록된 공지사항 ID 목록
  const bookmarkedNoticeIds = favoriteNotices.map(n => n.notice_id);
  // 기존 코드 호환용 (includes 사용)
  const bookmarkedNotices = bookmarkedNoticeIds;

  const handleParticipateToggle = (id: number) => {
    setParticipatedNotices(prev =>
      prev.includes(id)
        ? prev.filter(noticeId => noticeId !== id)
        : [...prev, id]
    );
  };

  const handleAddPersonalSchedule = async (schedule: {
    title: string;
    date: string;
    type?: '일' | '과제';
    priority?: '낮음' | '중간' | '높음';
    time?: string;
    description?: string;
  }) => {
    try {
      const startTime = schedule.time || '09:00:00';
      const startAt = `${schedule.date}T${startTime}`;
      const endAt = `${schedule.date}T23:59:59`;
      
      await addEvent({
        title: schedule.title,
        start_at: startAt,
        end_at: endAt,
        memo: schedule.description || '',
      });
    } catch (err) {
      console.error('일정 추가 오류:', err);
    }
  };

  const handleDeletePersonalSchedule = async (id: number) => {
    try {
      await removeEvent(id);
    } catch (err) {
      console.error('일정 삭제 오류:', err);
    }
  };

  // 개인 일정 변환 (캘린더 API 데이터 -> 기존 형식)
  const personalSchedules = events.filter(e => e.source === 'manual').map(e => ({
    id: e.event_id,
    title: e.title,
    date: e.start_at.split('T')[0],
    time: e.start_at.split('T')[1]?.substring(0, 5),
    description: e.memo || '',
  }));

  const handleCompleteNotice = (noticeId: number, result: string) => {
    // Add to completed activities
    setCompletedActivities(prev => [...prev, {
      id: Date.now(),
      noticeId: noticeId,
      result: result,
      completedDate: '2026-01-23',
    }]);
  };

  const currentNotice = selectedNotice;

  // Sort opportunities by upload date (newest first) for the full notice list
  const sortedOpportunities = [...opportunities].sort((a, b) => {
    return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
  });

  // Get bookmarked notices for calendar (favoriteNotices from API)
  const bookmarkedNoticeSchedules = favoriteNotices.map(notice => ({
    id: notice.notice_id,
    title: notice.title,
    category: normalizeCategory(notice.category),
    deadline: notice.end_date || '',
    daysLeft: notice.d_day || 0,
    description: '상세 보기로 확인하세요.',
    uploadDate: '',
    tags: notice.tags,
  }));

  if (currentPage === 'calendar') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
        <FullCalendar
          bookmarkedNotices={bookmarkedNoticeSchedules}
          personalSchedules={personalSchedules}
          onNoticeClick={handleNoticeClick}
          onAddSchedule={handleAddPersonalSchedule}
          onDeleteSchedule={handleDeletePersonalSchedule}
        />
        <AIAssistant />
        {currentNotice && (
          <NoticeDetail
            notice={currentNotice}
            isBookmarked={bookmarkedNotices.includes(currentNotice.id)}
            onBack={handleBackToDashboard}
            onBookmarkToggle={() => handleBookmarkToggle(currentNotice.id)}
          />
        )}
      </div>
    );
  }

  if (currentPage === 'notices') {
    // Filter notices based on status filter
    let statusFilteredNotices = sortedOpportunities;
    
    if (noticeStatusFilter === '마감 임박') {
      statusFilteredNotices = sortedOpportunities.filter(opp => opp.daysLeft >= 0 && opp.daysLeft <= 3);
    } else if (noticeStatusFilter === '마감') {
      statusFilteredNotices = sortedOpportunities.filter(opp => opp.daysLeft < 0);
    }
    
    // Filter by category
    let finalFilteredNotices = statusFilteredNotices;
    if (noticeCategoryFilter !== '전체') {
      finalFilteredNotices = statusFilteredNotices.filter(opp => {
        if (noticeCategoryFilter === '장학') return opp.category === '장학금';
        if (noticeCategoryFilter === '학사') return opp.category === '공지사항';
        return opp.category === noticeCategoryFilter;
      });
    }
    
    // Get unique categories from opportunities
    const uniqueCategories = Array.from(new Set(opportunities.map(opp => opp.category)));
    const categoryTabs = ['전체', '장학', '학사', ...uniqueCategories.filter(cat => cat !== '장학금' && cat !== '공지사항')];
    
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">전체 공지</h1>
          </div>

          {/* Status Filter Tabs */}
          <div className="mb-3">
            <div className="inline-flex gap-2 p-1 bg-gray-100 rounded-lg">
              {(['전체', '마감 임박', '마감'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setNoticeStatusFilter(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    noticeStatusFilter === status
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="mb-6">
            <div className="inline-flex gap-2 p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
              {categoryTabs.map((category) => (
                <button
                  key={category}
                  onClick={() => setNoticeCategoryFilter(category)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    noticeCategoryFilter === category
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {finalFilteredNotices.map(opportunity => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                onClick={() => handleNoticeClick(opportunity.id)}
              />
            ))}
          </div>
          
          {finalFilteredNotices.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              해당 조건의 공지사항이 없습니다.
            </div>
          )}
        </main>
        <AIAssistant />
        {currentNotice && (
          <NoticeDetail
            notice={currentNotice}
            isBookmarked={bookmarkedNotices.includes(currentNotice.id)}
            onBack={handleBackToDashboard}
            onBookmarkToggle={() => handleBookmarkToggle(currentNotice.id)}
          />
        )}
      </div>
    );
  }

  if (currentPage === 'ai') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AIChat />
        </main>
      </div>
    );
  }

  if (currentPage === 'mypage') {
    const participatedNoticesList = opportunities.filter(opp => 
      participatedNotices.includes(opp.id)
    );

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <MyPage 
            onNavigateToActivityHistory={handleNavigateToActivityHistory}
            onNavigateToProfileDetail={handleNavigateToProfileDetail}
            onNavigateToBookmarkedNotices={handleNavigateToBookmarkedNotices}
            onNavigateToParticipatedNotices={handleNavigateToParticipatedNotices}
            onCompleteNotice={handleCompleteNotice}
            participatedCount={participatedNotices.length}
            participatedNotices={participatedNoticesList}
            completedActivities={completedActivities}
          />
        </main>
        <AIAssistant />
      </div>
    );
  }

  if (currentPage === 'activity-history') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ActivityHistory 
            onBack={handleNavigateToMyPage} 
            completedActivities={completedActivities}
            opportunities={opportunities}
          />
        </main>
      </div>
    );
  }

  if (currentPage === 'profile-detail') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ProfileDetail onBack={handleNavigateToMyPage} />
        </main>
      </div>
    );
  }

  if (currentPage === 'bookmarked-notices') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <BookmarkedNotices 
            bookmarkedNotices={bookmarkedNoticeSchedules}
            onNoticeClick={handleNoticeClick}
          />
        </main>
        {currentNotice && (
          <NoticeDetail
            notice={currentNotice}
            isBookmarked={bookmarkedNotices.includes(currentNotice.id)}
            onBack={handleBackToDashboard}
            onBookmarkToggle={() => handleBookmarkToggle(currentNotice.id)}
          />
        )}
      </div>
    );
  }

  if (currentPage === 'participated-notices') {
    const participatedNoticesList = opportunities.filter(opp => 
      participatedNotices.includes(opp.id)
    );

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ParticipatedNotices 
            participatedNotices={participatedNoticesList}
            onNoticeClick={handleNoticeClick}
            onBack={() => setCurrentPage('mypage')}
            onCompleteNotice={handleCompleteNotice}
            completedActivities={completedActivities}
          />
        </main>
        {currentNotice && (
          <NoticeDetail
            notice={currentNotice}
            isBookmarked={bookmarkedNotices.includes(currentNotice.id)}
            onBack={handleBackToDashboard}
            onBookmarkToggle={() => handleBookmarkToggle(currentNotice.id)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation currentPage={currentPage} onNavigateToDashboard={handleNavigateToDashboard} onNavigateToNotices={handleNavigateToNotices} onNavigateToCalendar={handleNavigateToCalendar} onNavigateToAI={handleNavigateToAI} onNavigateToMyPage={handleNavigateToMyPage} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Today & Upcoming Section */}
        <TodayUpcoming 
          opportunities={opportunities} 
          personalSchedules={personalSchedules}
          onNoticeClick={handleNoticeClick} 
        />

        {/* Opportunities & Notices Section */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">관심 공지사항</h2>
          </div>

          <OpportunitiesFilter 
            activeFilter={activeFilter} 
            setActiveFilter={setActiveFilter}
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
            {filteredOpportunities
              .filter(opp => bookmarkedNotices.includes(opp.id))
              .map(opportunity => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  onClick={() => handleNoticeClick(opportunity.id)}
                  isParticipated={participatedNotices.includes(opportunity.id)}
                  onParticipate={() => handleParticipateToggle(opportunity.id)}
                />
              ))}
            {filteredOpportunities.filter(opp => bookmarkedNotices.includes(opp.id)).length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                북마크한 공지사항이 없습니다. 관심있는 공지사항을 북마크해보세요!
              </div>
            )}
          </div>
        </section>

        {/* Calendar Preview Section */}
        <CalendarPreview opportunities={opportunities} onNoticeClick={handleNoticeClick} onNavigateToNotices={handleNavigateToNotices} />

        {/* AI Assistant Entry Point */}
        <AIAssistant />
      </main>

      {/* Notice Detail Modal Overlay */}
      {currentNotice && (
        <NoticeDetail
          notice={currentNotice}
          isBookmarked={bookmarkedNotices.includes(currentNotice.id)}
          onBack={handleBackToDashboard}
          onBookmarkToggle={() => handleBookmarkToggle(currentNotice.id)}
        />
      )}
    </div>
  );
}