import React, { useState } from 'react';
import { Award, Trophy, Bell, Calendar, ArrowLeft, X } from 'lucide-react';

interface ParticipatedNotice {
  id: number;
  title: string;
  category: string;
  deadline: string;
}

interface ParticipatedNoticesProps {
  participatedNotices: ParticipatedNotice[];
  onNoticeClick?: (id: number) => void;
  onBack?: () => void;
  onCompleteNotice?: (noticeId: number, result: string) => void;
  completedActivities?: Array<{
    id: number;
    noticeId: number;
    result: string;
    completedDate: string;
  }>;
}

export function ParticipatedNotices({ participatedNotices, onNoticeClick, onBack, onCompleteNotice, completedActivities = [] }: ParticipatedNoticesProps) {
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedNoticeForCompletion, setSelectedNoticeForCompletion] = useState<{
    id: number;
    category: string;
  } | null>(null);

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

  const handleCompletion = (noticeId: number, result: string) => {
    if (onCompleteNotice) {
      onCompleteNotice(noticeId, result);
    }
    setShowResultModal(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>돌아가기</span>
        </button>
      )}
      
      <h1 className="text-3xl font-bold text-gray-900 mb-8">참여 이력</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {participatedNotices.length > 0 ? (
          <div className="space-y-3">
            {participatedNotices.map(notice => {
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
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>마감일: {notice.deadline}</span>
                  </div>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNoticeForCompletion({ id: notice.id, category: notice.category });
                        // Only show modal for 공모전
                        if (notice.category === '공모전') {
                          setShowResultModal(true);
                        } else {
                          // Auto-complete for other categories
                          const result = notice.category === '프로그램' ? '수료' : (notice.category === '공지사항' || notice.category === '장학금') ? '신청 완료' : '참여 완료';
                          handleCompletion(notice.id, result);
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
        ) : (
          <div className="text-center py-12 text-gray-500">
            아직 참여한 공지사항이 없습니다.
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
                  onClick={() => handleCompletion(selectedNoticeForCompletion.id, award)}
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