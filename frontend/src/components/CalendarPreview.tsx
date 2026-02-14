import React, { useState } from 'react';
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react';

interface Opportunity {
  id: number;
  title: string;
  category: string;
  deadline: string;
  daysLeft: number;
  description: string;
}

interface CalendarPreviewProps {
  opportunities: Opportunity[];
  onNoticeClick: (id: number) => void;
  onNavigateToNotices?: () => void;
}

export function CalendarPreview({ opportunities, onNoticeClick, onNavigateToNotices }: CalendarPreviewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;

  const getCurrentMonth = () => {
    return new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  };

  // Get all upcoming events sorted by daysLeft
  const allUpcomingEvents = opportunities
    .filter(opp => opp.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Calculate total pages
  const totalPages = Math.ceil(allUpcomingEvents.length / itemsPerPage);

  // Get current page events
  const startIndex = currentPage * itemsPerPage;
  const upcomingEvents = allUpcomingEvents.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
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
    <section className="mt-8">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Bell className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">공지 미리보기</h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 font-medium">{getCurrentMonth()}</span>
            <div className="flex items-center space-x-2">
              <button 
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className={`p-2 rounded-lg transition-colors ${
                  currentPage === 0 
                    ? 'opacity-30 cursor-not-allowed' 
                    : 'hover:bg-gray-100'
                }`}
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                onClick={handleNextPage}
                disabled={currentPage >= totalPages - 1}
                className={`p-2 rounded-lg transition-colors ${
                  currentPage >= totalPages - 1 
                    ? 'opacity-30 cursor-not-allowed' 
                    : 'hover:bg-gray-100'
                }`}
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {upcomingEvents.map(event => {
              const eventDate = new Date(event.deadline);
              const dayOfWeek = eventDate.toLocaleDateString('ko-KR', { weekday: 'short' });
              const dayOfMonth = eventDate.getDate();
              
              return (
                <div
                  key={event.id}
                  onClick={() => onNoticeClick(event.id)}
                  className="flex items-center space-x-4 p-4 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer"
                >
                  <div className="flex-shrink-0 text-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xs text-purple-600 font-medium">{dayOfWeek}</span>
                      <span className="text-xl font-bold text-purple-700">{dayOfMonth}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium text-gray-500">{event.category}</span>
                      {event.daysLeft <= 3 && event.daysLeft >= 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                          긴급
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900 truncate">{event.title}</h4>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`text-sm font-medium ${getDdayColor(event.daysLeft)}`}>
                      {event.daysLeft === 0 ? 'D-DAY' : event.daysLeft < 0 ? '마감' : `D-${event.daysLeft}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">예정된 일정이 없습니다</p>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onNavigateToNotices}
            className="text-purple-600 hover:text-purple-700 font-medium text-sm"
          >
            전체 공지사항 보기 →
          </button>
        </div>
      </div>
    </section>
  );
}