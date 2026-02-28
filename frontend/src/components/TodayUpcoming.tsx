import React from 'react';
import { Clock, AlertCircle, Calendar } from 'lucide-react';

interface Opportunity {
  id: number;
  title: string;
  category: string;
  deadline: string;
  daysLeft: number;
  description: string;
}

interface PersonalSchedule {
  id: number;
  title: string;
  date: string;
  type?: '일' | '과제';
  priority?: '낮음' | '중간' | '높음';
  time?: string;
  description?: string;
}

interface TodayUpcomingProps {
  opportunities: Opportunity[];
  personalSchedules: PersonalSchedule[];
  onNoticeClick: (id: number) => void;
}

export function TodayUpcoming({ opportunities, personalSchedules, onNoticeClick }: TodayUpcomingProps) {
  // Calculate days left for personal schedules
  const calculateDaysLeft = (dateStr: string): number => {
    const today = new Date('2026-01-23');
    const targetDate = new Date(dateStr);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter and sort personal schedules (D-5 to D-DAY)
  const urgentPersonalSchedules = personalSchedules
    .map(schedule => ({
      ...schedule,
      daysLeft: calculateDaysLeft(schedule.date),
      isPersonal: true,
    }))
    .filter(schedule => schedule.daysLeft <= 5 && schedule.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Filter and sort opportunities (D-5 to D-DAY)
  const urgentOpportunities = opportunities
    .filter(opp => opp.daysLeft <= 5 && opp.daysLeft >= 0)
    .map(opp => ({ ...opp, isPersonal: false }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Combine with personal schedules first, then opportunities, max 4 items
  const combinedItems = [
    ...urgentPersonalSchedules,
    ...urgentOpportunities,
  ].slice(0, 4);

  const getDdayLabel = (days: number) => {
    if (days === 0) return 'D-DAY';
    if (days < 0) return '마감';
    return `D-${days}`;
  };

  const getDdayColor = (days: number) => {
    if (days < 0) return 'bg-gray-400';  // 마감 이후
    if (days === 0) return 'bg-red-500';  // D-DAY
    if (days <= 3) return 'bg-orange-500'; // D-3~1
    return 'bg-green-500';  // D-4 이상
  };

  return (
    <section className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 shadow-sm border border-purple-100">
      <div className="flex items-center space-x-2 mb-4">
        <Clock className="w-6 h-6 text-purple-600" />
        <h2 className="text-xl font-bold text-gray-900">오늘과 다가오는 일정</h2>
      </div>

      {combinedItems.length > 0 ? (
        <div className="space-y-3">
          {combinedItems.map(item => (
            <div
              key={item.id}
              onClick={() => onNoticeClick(item.id)}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">{item.category || item.type}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{item.deadline || item.date}까지</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`${getDdayColor(item.daysLeft)} text-white px-3 py-1 rounded-full text-sm font-bold`}>
                    {getDdayLabel(item.daysLeft)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">임박한 마감 일정이 없습니다</p>
        </div>
      )}
    </section>
  );
}