import React from 'react';
import { X, Calendar, FileText, Download, ExternalLink, Sparkles, Bookmark, BookmarkCheck } from 'lucide-react';

interface Notice {
  id: number;
  title: string;
  category: string;
  deadline: string;
  daysLeft: number;
  description: string;
  isNew?: boolean;
  department?: string;
  publishDate?: string;
  detailContent: {
    summary: {
      일정: string;
      시간: string;
      장소: string;
      대상: string;
      핵심안내: string;
    };
    fullContent?: string;
    keywords?: string[];
    attachments: Array<{
      name: string;
      size: string;
      type?: string;
    }>;
    originalLink: string;
  };
}

interface NoticeDetailProps {
  notice: Notice;
  isBookmarked: boolean;
  onBack: () => void;
  onBookmarkToggle: () => void;
}

export function NoticeDetail({
  notice,
  isBookmarked,
  onBack,
  onBookmarkToggle,
}: NoticeDetailProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case '장학금':
        return 'bg-pink-600 text-white';
      case '공모전':
        return 'bg-purple-100 text-purple-700';
      case '공지사항':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getDdayColor = (daysLeft: number) => {
    if (daysLeft < 0) {
      return 'bg-gray-400 text-white';  // 마감 이후
    } else if (daysLeft === 0) {
      return 'bg-red-600 text-white';   // D-DAY
    } else if (daysLeft <= 3) {
      return 'bg-orange-600 text-white'; // D-3~1
    } else {
      return 'bg-green-600 text-white';  // D-4 이상
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onBack}
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl transform transition-all scale-100 animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center space-x-2">
            {notice.isNew && (
              <span className="bg-black text-white px-2 py-0.5 rounded text-xs font-bold">
                NEW
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {notice.category}
            </span>
            <span className={`${getDdayColor(notice.daysLeft)} px-2 py-0.5 rounded text-xs font-medium`}>
              {notice.daysLeft === 0 ? 'D-DAY' : notice.daysLeft < 0 ? '마감' : `D-${notice.daysLeft}`}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              ~{notice.deadline}
            </span>
          </div>
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {notice.title}
          </h1>

          {/* Metadata */}
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
            <span>{notice.department || '학생지원팀'}</span>
            <span>•</span>
            <span>{notice.publishDate || notice.deadline}</span>
          </div>

          {/* AI Summary */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">AI 요약</h3>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              {notice.detailContent.summary.핵심안내}
            </p>
          </div>

          {/* Detailed Content */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-3">상세 내용</h3>
            <div className="text-gray-700 text-sm leading-relaxed space-y-2">
              {notice.detailContent.fullContent ? (
                <p>{notice.detailContent.fullContent}</p>
              ) : (
                <>
                  <p>{notice.description}</p>
                  <p className="mt-2">
                    <strong>일정:</strong> {notice.detailContent.summary.일정}
                    <br />
                    <strong>신청기간:</strong> {notice.deadline}까지
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Keywords */}
          {notice.detailContent.keywords && notice.detailContent.keywords.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-900 mb-3">키워드</h3>
              <div className="flex flex-wrap gap-2">
                {notice.detailContent.keywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {notice.detailContent.attachments.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-900 mb-3">첨부파일</h3>
              <div className="space-y-2">
                {notice.detailContent.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{file.name}</div>
                        <div className="text-xs text-gray-500">{file.type || 'PDF'}</div>
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <a
              href={notice.detailContent.originalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <ExternalLink className="w-5 h-5" />
              <span>원문 보기</span>
            </a>
            <button
              onClick={notice.daysLeft < 0 ? undefined : onBookmarkToggle}
              disabled={notice.daysLeft < 0}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                notice.daysLeft < 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isBookmarked
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {notice.daysLeft < 0 ? (
                <>
                  <Bookmark className="w-5 h-5" />
                  <span>마감됨</span>
                </>
              ) : isBookmarked ? (
                <>
                  <BookmarkCheck className="w-5 h-5" />
                  <span>북마크됨</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-5 h-5" />
                  <span>북마크</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}