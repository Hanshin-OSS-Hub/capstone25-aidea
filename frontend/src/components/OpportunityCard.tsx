import React from 'react';
import { Calendar, Award, Trophy, Bell, Bookmark, BookmarkCheck } from 'lucide-react';

interface Opportunity {
  id: number;
  title: string;
  category: string;
  deadline: string;
  daysLeft: number;
  description: string;
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick: () => void;
  isParticipated?: boolean;
  onParticipate?: () => void;
  isBookmarked?: boolean;
  onBookmarkToggle?: (e: React.MouseEvent) => void;
}

export function OpportunityCard({ opportunity, onClick, isParticipated = false, onParticipate, isBookmarked = false, onBookmarkToggle }: OpportunityCardProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '장학금':
        return <Award className="w-5 h-5" />;
      case '공모전':
        return <Trophy className="w-5 h-5" />;
      case '공지사항':
        return <Bell className="w-5 h-5" />;
      default:
        return null;
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

  const getDdayColor = (daysLeft: number) => {
    if (daysLeft < 0) {
      return 'text-gray-400';  // 마감 이후
    } else if (daysLeft === 0) {
      return 'text-red-600';   // D-DAY
    } else if (daysLeft <= 3) {
      return 'text-orange-600'; // D-3~1
    } else {
      return 'text-green-600';  // D-4 이상
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-5 shadow-sm hover:shadow-lg transition-all cursor-pointer border border-gray-100 hover:border-purple-200 flex flex-col h-[240px]"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(opportunity.category)}`}>
          {getCategoryIcon(opportunity.category)}
          <span>{opportunity.category}</span>
        </span>
        <div className="flex items-center gap-2">
          {onBookmarkToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBookmarkToggle(e);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                isBookmarked ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400 hover:bg-purple-50 hover:text-purple-500'
              }`}
              title={isBookmarked ? '북마크 해제' : '북마크'}
            >
              {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
            </button>
          )}
          <span className={`text-sm font-bold ${getDdayColor(opportunity.daysLeft)}`}>
            {opportunity.daysLeft === 0 ? 'D-DAY' : opportunity.daysLeft < 0 ? '마감' : `D-${opportunity.daysLeft}`}
          </span>
        </div>
      </div>

      <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 h-[3.5rem]">
        {opportunity.title}
      </h3>

      <p className="text-sm text-gray-600 mb-4 line-clamp-2 h-[2.5rem]">
        {opportunity.description}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>{opportunity.deadline}</span>
        </div>
        {onParticipate ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onParticipate();
            }}
            className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
              isParticipated
                ? 'bg-green-100 text-green-700 cursor-default'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            {isParticipated ? '참여 완료' : '참여하기'}
          </button>
        ) : (
          <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
            자세히 →
          </button>
        )}
      </div>
    </div>
  );
}