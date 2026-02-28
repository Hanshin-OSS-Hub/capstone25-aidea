import React, { useState } from 'react';
import { User, School, GraduationCap, CheckCircle, Award, Trophy, Bell, ChevronRight, X, Bookmark } from 'lucide-react';

interface MyPageProps {
  onNavigateToActivityHistory?: () => void;
  onNavigateToProfileDetail?: () => void;
  onNavigateToBookmarkedNotices?: () => void;
  onNavigateToParticipatedNotices?: () => void;
  onCompleteNotice?: (noticeId: number, result: string) => void;
  onBookmarkedNoticeClick?: (noticeId: number) => void;
  participatedCount?: number;
  bookmarkedNotices?: Array<{
    notice_id: number;
    title: string;
    category: string;
    end_date: string | null;
    d_day: number | null;
  }>;
  participatedNotices?: Array<{
    id: number;
    title: string;
    category: string;
    deadline: string;
  }>;
  completedActivities?: Array<{
    id: number;
    noticeId: number;
    result: string;
    completedDate: string;
  }>;
}

export function MyPage({ onNavigateToActivityHistory, onNavigateToProfileDetail, onNavigateToBookmarkedNotices, onNavigateToParticipatedNotices, onCompleteNotice, onBookmarkedNoticeClick, participatedCount = 0, bookmarkedNotices = [], participatedNotices = [], completedActivities = [] }: MyPageProps = {}) {
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedNoticeForCompletion, setSelectedNoticeForCompletion] = useState<{
    id: number;
    category: string;
  } | null>(null);

  const interestItems = [
    { id: 1, title: '제15회 대학생 창업경진대회', category: '공모전', deadline: '2024-03-05' },
    { id: 2, title: '2024 빅데이터 분석 공모전', category: '공모전', deadline: '2024-03-15' },
    { id: 3, title: '국가장학금 신청', category: '장학금', deadline: '2024-02-28' },
  ];

  const activityHistory: Array<{
    id: number;
    title: string;
    category: string;
    completedDate: string;
    result: string;
  }> = [];

  const handleMarkAsCompleted = (id: number) => {
    setCompletedActivities(prev => [...prev, id]);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '장학금':
        return <Award className="w-5 h-5" />;
      case '공모전':
        return <Trophy className="w-5 h-5" />;
      case '공지사항':
        return <Bell className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '장학금':
        return 'bg-blue-100 text-blue-700';
      case '공모전':
        return 'bg-purple-100 text-purple-700';
      case '공지사항':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleCompleteNotice = (noticeId: number, result: string) => {
    onCompleteNotice?.(noticeId, result);
    setShowResultModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">마이페이지</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">김학생</h2>
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <School className="w-4 h-4" />
                <span>한신대학교</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <GraduationCap className="w-4 h-4" />
                <span>컴퓨터공학과 3학년</span>
              </div>
              <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mt-2">
                재학 중
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={onNavigateToProfileDetail}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            프로필 상세보기
          </button>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl font-bold text-purple-600 mb-1">{bookmarkedNotices.length}</div>
          <div className="text-sm text-gray-600">북마크한 공지</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-1">{participatedCount}</div>
          <div className="text-sm text-gray-600">참여 완료</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="text-3xl font-bold text-green-600 mb-1">{completedActivities.length}</div>
          <div className="text-sm text-gray-600">활동 이력</div>
        </div>
      </div>

      {/* 북마크한 공지 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-purple-600" />
          북마크한 공지
        </h3>
        {bookmarkedNotices.length > 0 ? (
          <>
            <div className="space-y-3">
              {bookmarkedNotices.slice(0, 3).map(notice => (
                <div
                  key={notice.notice_id}
                  onClick={() => {
                    onBookmarkedNoticeClick?.(notice.notice_id);
                    onNavigateToBookmarkedNotices?.();
                  }}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(notice.category)} mb-2`}>
                      {notice.category}
                    </span>
                    <h4 className="font-semibold text-gray-900">{notice.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {notice.end_date ? `마감: ${notice.end_date}` : ''}
                      {notice.d_day != null && notice.d_day >= 0 ? ` (D-${notice.d_day})` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              ))}
            </div>
            {bookmarkedNotices.length > 3 && (
              <button
                onClick={onNavigateToBookmarkedNotices}
                className="mt-4 w-full px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-medium text-sm"
              >
                북마크한 공지 전체보기 ({bookmarkedNotices.length}건)
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p>아직 북마크한 공지가 없습니다.</p>
            <button
              onClick={onNavigateToBookmarkedNotices}
              className="mt-2 text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              공지사항에서 북마크하기 →
            </button>
          </div>
        )}
      </div>

      {/* Participated History */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">참여 이력</h3>
        {participatedNotices.length > 0 ? (
          <>
            <div className="space-y-3">
              {participatedNotices.slice(0, 2).map(notice => {
                const isCompleted = completedActivities.some(activity => activity.noticeId === notice.id);
                return (
                <div
                  key={notice.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(notice.category)}`}>
                        {getCategoryIcon(notice.category)}
                        <span>{notice.category}</span>
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{notice.title}</h4>
                    <p className="text-sm text-gray-500">마감일: {notice.deadline}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      참여 완료
                    </span>
                    {isCompleted ? (
                      <span className="px-3 py-1 bg-gray-200 text-gray-500 rounded-full text-sm font-medium cursor-not-allowed">
                        수료 완료
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedNoticeForCompletion({ id: notice.id, category: notice.category });
                          // Only show modal for 공모전
                          if (notice.category === '공모전') {
                            setShowResultModal(true);
                          } else {
                            // Auto-complete for other categories
                            const result = notice.category === '프로그램' ? '수료' : (notice.category === '공지사항' || notice.category === '장학금') ? '신청 완료' : '참여 완료';
                            onCompleteNotice?.(notice.id, result);
                          }
                        }}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium hover:bg-green-200 transition-colors"
                      >
                        수료하기
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
            {participatedNotices.length > 2 && (
              <div className="mt-4">
                <button
                  onClick={onNavigateToParticipatedNotices}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                >
                  참여 이력 더보기
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            아직 참여한 공지사항이 없습니다.
          </div>
        )}
      </div>

      {/* Activity History */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-4">활동 이력</h3>
        {completedActivities.length > 0 ? (
          <>
            <div className="space-y-3">
              {completedActivities.slice(0, 2).map(activity => {
                const notice = participatedNotices.find(n => n.id === activity.noticeId);
                if (!notice) return null;
                return (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(notice.category)}`}>
                          {getCategoryIcon(notice.category)}
                          <span>{notice.category}</span>
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1">{notice.title}</h4>
                      <p className="text-sm text-gray-500">완료일: {activity.completedDate}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {activity.result}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {completedActivities.length > 2 && (
              <div className="mt-4">
                <button
                  onClick={onNavigateToActivityHistory}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                >
                  활동 이력 더보기
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            아직 완료된 활동이 없습니다.
          </div>
        )}
      </div>

      {/* Result Modal */}
      {showResultModal && selectedNoticeForCompletion && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl p-6 shadow-2xl w-96 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">수상 결과 선택</h3>
              <button
                onClick={() => setShowResultModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">공모전 참여 결과를 선택해주세요</p>
            <div className="space-y-2">
              {['대상', '최우수상', '우수상', '장려상', '참가상', '참여 완료'].map((award) => (
                <button
                  key={award}
                  onClick={() => handleCompleteNotice(selectedNoticeForCompletion.id, award)}
                  className="w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors font-medium"
                >
                  {award}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}