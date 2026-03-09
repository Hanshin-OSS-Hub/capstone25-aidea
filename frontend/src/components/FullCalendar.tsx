import React, { useState, useRef } from 'react';
import { Calendar, Plus, Bell, User as UserIcon, Clock, MapPin, X, Trash2, ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';

interface Notice {
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

interface FullCalendarProps {
  bookmarkedNotices: Notice[];
  personalSchedules: PersonalSchedule[];
  onNoticeClick: (id: number) => void;
  onAddSchedule: (schedule: {
    title: string;
    date: string;
    type?: '일' | '과제';
    priority?: '낮음' | '중간' | '높음';
    time?: string;
    description?: string;
  }) => void;
  onDeleteSchedule: (id: number) => void;
}

export function FullCalendar({
  bookmarkedNotices,
  personalSchedules,
  onNoticeClick,
  onAddSchedule,
  onDeleteSchedule,
}: FullCalendarProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<PersonalSchedule | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    title: '',
    date: '',
    type: '일' as '일' | '과제',
    priority: '중간' as '낮음' | '중간' | '높음',
    time: '',
    description: '',
  });
  
  // Date and time dropdown states
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);

  // Generate date options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const getDaysInSelectedMonth = () => {
    return Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, i) => i + 1);
  };
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Combine all schedules
  const allSchedules = [
    ...bookmarkedNotices.map(notice => ({
      type: 'notice' as const,
      id: notice.id,
      title: notice.title,
      date: notice.deadline,
      category: notice.category,
      daysLeft: notice.daysLeft,
    })),
    ...personalSchedules.map(schedule => ({
      type: 'personal' as const,
      id: schedule.id,
      title: schedule.title,
      date: schedule.date,
      scheduleType: schedule.type,
      priority: schedule.priority,
      time: schedule.time,
      description: schedule.description,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getSchedulesForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return allSchedules.filter(schedule => schedule.date === dateStr);
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    setExpandedDay(null);
    setHoveredDay(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
  };

  const handleDayMouseEnter = (day: number) => {
    setHoveredDay(day);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setExpandedDay(day);
    }, 1500);
  };

  const handleDayMouseLeave = () => {
    setHoveredDay(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    setExpandedDay(null);
  };

  const renderCalendarGrid = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
    const days = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Calculate total weeks in the calendar
    const totalCells = startingDayOfWeek + daysInMonth;
    const totalWeeks = Math.ceil(totalCells / 7);

    // Empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-gray-100 bg-gray-50 min-h-24"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateSchedules = getSchedulesForDate(date);
      const isToday = new Date().toDateString() === date.toDateString();
      const isExpanded = expandedDay === day;
      
      // Calculate which week this day is in (1-indexed)
      const dayPosition = startingDayOfWeek + day - 1;
      const weekNumber = Math.floor(dayPosition / 7) + 1;
      const isLastWeek = weekNumber === totalWeeks;

      days.push(
        <div
          key={day}
          className={`relative p-2 border border-gray-100 min-h-24 ${isToday ? 'bg-purple-50' : 'bg-white'} hover:bg-gray-50 transition-all ${
            isExpanded ? 'z-50' : 'z-0'
          }`}
          onMouseEnter={() => handleDayMouseEnter(day)}
          onMouseLeave={handleDayMouseLeave}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-purple-600' : 'text-gray-700'}`}>
            {day}
          </div>
          
          {isExpanded && dateSchedules.length > 2 ? (
            <div className={`absolute left-0 ${isLastWeek ? 'bottom-8' : 'top-8'} bg-white border-2 border-purple-300 rounded-lg shadow-2xl p-3 min-w-[200px] max-w-[250px] z-50`}>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {dateSchedules
                  .sort((a, b) => {
                    const getPriorityValue = (schedule: any) => {
                      if (schedule.type === 'notice') return 4;
                      const priority = schedule.priority || '중간';
                      if (priority === '높음') return 3;
                      if (priority === '중간') return 2;
                      return 1;
                    };
                    return getPriorityValue(b) - getPriorityValue(a);
                  })
                  .map((schedule, idx) => {
                    let cardColorClass = '';
                    if (schedule.type === 'notice') {
                      cardColorClass = 'bg-blue-100 text-blue-700 hover:bg-blue-200';
                    } else {
                      const priority = schedule.priority || '중간';
                      if (priority === '낮음') {
                        cardColorClass = 'bg-green-100 text-green-700 hover:bg-green-200';
                      } else if (priority === '중간') {
                        cardColorClass = 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200';
                      } else if (priority === '높음') {
                        cardColorClass = 'bg-red-100 text-red-700 hover:bg-red-200';
                      }
                    }
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => handleScheduleClick(schedule)}
                        className={`text-xs px-2 py-1.5 rounded cursor-pointer ${cardColorClass}`}
                      >
                        {schedule.title}
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {dateSchedules
                .sort((a, b) => {
                  const getPriorityValue = (schedule: any) => {
                    if (schedule.type === 'notice') return 4;
                    const priority = schedule.priority || '중간';
                    if (priority === '높음') return 3;
                    if (priority === '중간') return 2;
                    return 1;
                  };
                  return getPriorityValue(b) - getPriorityValue(a);
                })
                .slice(0, 2)
                .map((schedule, idx) => {
                  let cardColorClass = '';
                  if (schedule.type === 'notice') {
                    cardColorClass = 'bg-blue-100 text-blue-700 hover:bg-blue-200';
                  } else {
                    const priority = schedule.priority || '중간';
                    if (priority === '낮음') {
                      cardColorClass = 'bg-green-100 text-green-700 hover:bg-green-200';
                    } else if (priority === '중간') {
                      cardColorClass = 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200';
                    } else if (priority === '높음') {
                      cardColorClass = 'bg-red-100 text-red-700 hover:bg-red-200';
                    }
                  }
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => handleScheduleClick(schedule)}
                      className={`text-xs px-2 py-1 rounded cursor-pointer truncate ${cardColorClass}`}
                    >
                      {schedule.title}
                    </div>
                  );
                })}
              {dateSchedules.length > 2 && (
                <div className="text-xs text-gray-500 px-2">
                  +{dateSchedules.length - 2} more
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const handleAddSchedule = () => {
    if (newSchedule.title) {
      // Format date from dropdowns
      const formattedDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      
      // Format time from dropdowns
      const formattedTime = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
      
      onAddSchedule({
        ...newSchedule,
        date: formattedDate,
        time: formattedTime,
      });
      
      // Reset form
      setNewSchedule({ title: '', date: '', type: '일' as '일' | '과제', priority: '중간' as '낮음' | '중간' | '높음', time: '', description: '' });
      setSelectedYear(2026);
      setSelectedMonth(1);
      setSelectedDay(1);
      setSelectedHour(9);
      setSelectedMinute(0);
      setShowAddModal(false);
    }
  };

  const handleScheduleClick = (schedule: any) => {
    if (schedule.type === 'notice') {
      onNoticeClick(schedule.id);
    } else {
      const fullSchedule = personalSchedules.find(s => s.id === schedule.id);
      if (fullSchedule) {
        setSelectedSchedule(fullSchedule);
      }
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">전체 캘린더</h1>
          <p className="text-gray-600 mt-1">관심 공지와 개인 일정을 한눈에 확인하세요</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span className="text-sm font-medium">캘린더</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="text-sm font-medium">리스트</span>
            </button>
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>일정 추가</span>
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <h2 className="text-xl font-bold text-gray-900">
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </h2>
            
            <button
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-0 mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                <div
                  key={day}
                  className={`text-center text-sm font-semibold py-2 ${
                    idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-0 border-t border-l border-gray-100">
              {renderCalendarGrid()}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {allSchedules.length > 0 ? (
            <div className="space-y-3">
              {allSchedules.map((schedule, index) => {
                const scheduleDate = new Date(schedule.date);
                const dayOfWeek = scheduleDate.toLocaleDateString('ko-KR', { weekday: 'short' });
                const dayOfMonth = scheduleDate.getDate();
                const month = scheduleDate.getMonth() + 1;

                return (
                  <div
                    key={`${schedule.type}-${schedule.id}`}
                    onClick={() => handleScheduleClick(schedule)}
                    className="flex items-center space-x-4 p-4 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer border border-gray-100"
                  >
                    <div className="flex-shrink-0 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex flex-col items-center justify-center">
                        <span className="text-xs text-purple-600 font-medium">{month}월</span>
                        <span className="text-xl font-bold text-purple-700">{dayOfMonth}</span>
                        <span className="text-xs text-purple-600">{dayOfWeek}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {schedule.type === 'notice' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Bell className="w-3 h-3" />
                            <span>공지</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <UserIcon className="w-3 h-3" />
                            <span>내 일정</span>
                          </span>
                        )}
                        {schedule.type === 'notice' && (
                          <span className="text-xs text-gray-500">{schedule.category}</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1">{schedule.title}</h4>
                      {schedule.type === 'personal' && schedule.time && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{schedule.time}</span>
                        </div>
                      )}
                      {schedule.type === 'personal' && schedule.description && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1">
                          <MapPin className="w-4 h-4" />
                          <span>{schedule.description}</span>
                        </div>
                      )}
                    </div>

                    {(() => {
                      let daysLeft: number;
                      
                      if (schedule.type === 'notice' && 'daysLeft' in schedule) {
                        daysLeft = schedule.daysLeft as number;
                      } else if (schedule.type === 'personal' && schedule.date) {
                        const scheduleDate = new Date(schedule.date);
                        const today = new Date('2026-01-23');
                        today.setHours(0, 0, 0, 0);
                        scheduleDate.setHours(0, 0, 0, 0);
                        const diffTime = scheduleDate.getTime() - today.getTime();
                        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      } else {
                        return null;
                      }

                      let colorClass = '';
                      if (daysLeft < 0) {
                        colorClass = 'text-gray-400';  // 마감 이후
                      } else if (daysLeft === 0) {
                        colorClass = 'text-red-600';   // D-DAY
                      } else if (daysLeft <= 3) {
                        colorClass = 'text-orange-600'; // D-3~1
                      } else {
                        colorClass = 'text-green-600';  // D-4 이상
                      }
                      
                      return (
                        <div className="flex-shrink-0">
                          <span className={`text-sm font-medium ${colorClass}`}>
                            {daysLeft === 0 ? 'D-DAY' : daysLeft < 0 ? '마감' : `D-${daysLeft}`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <Calendar className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">등록된 일정이 없습니다</p>
              <p className="text-sm text-gray-400">관심 공지를 등록하거 개인 일정을 추가해보세요</p>
            </div>
          )}
        </div>
      )}

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">일정 추가하기</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  일정 제목 *
                </label>
                <input
                  type="text"
                  value={newSchedule.title}
                  onChange={(e) => setNewSchedule({ ...newSchedule, title: e.target.value })}
                  placeholder="일정 제목을 입력하세요"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  유형 *
                </label>
                <select
                  value={newSchedule.type}
                  onChange={(e) => setNewSchedule({ ...newSchedule, type: e.target.value as '일' | '과제' })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="일">일</option>
                  <option value="과제">과제</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  우선 순위 *
                </label>
                <select
                  value={newSchedule.priority}
                  onChange={(e) => setNewSchedule({ ...newSchedule, priority: e.target.value as '낮음' | '중간' | '높음' })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="낮음">낮음</option>
                  <option value="중간">중간</option>
                  <option value="높음">높음</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  날짜 *
                </label>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="연도"
                      className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">년</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="월"
                      min="1"
                      max="12"
                      className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">월</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="일"
                      min="1"
                      max="31"
                      className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">일</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시간
                </label>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={selectedHour}
                      onChange={(e) => setSelectedHour(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="시"
                      min="0"
                      max="23"
                      className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">시</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={selectedMinute}
                      onChange={(e) => setSelectedMinute(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="분"
                      min="0"
                      max="59"
                      className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{ MozAppearance: 'textfield' } as React.CSSProperties}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">분</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={newSchedule.description}
                  onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
                  placeholder="일정에 대한 설명을 입력하세요"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={handleAddSchedule}
                disabled={!newSchedule.title}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal Schedule Detail Modal */}
      {selectedSchedule && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setSelectedSchedule(null)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">일정 상세</h2>
              <button
                onClick={() => setSelectedSchedule(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{selectedSchedule.title}</h3>
                <div className="flex items-center space-x-1 text-sm">
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    <UserIcon className="w-3 h-3" />
                    <span>내 일정</span>
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-500">날짜</div>
                    <div className="text-gray-900">{selectedSchedule.date}</div>
                  </div>
                </div>

                {selectedSchedule.time && (
                  <div className="flex items-start space-x-3">
                    <Clock className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">시간</div>
                      <div className="text-gray-900">{selectedSchedule.time}</div>
                    </div>
                  </div>
                )}

                {selectedSchedule.description && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">설명</div>
                    <div className="text-gray-900">{selectedSchedule.description}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={() => {
                  onDeleteSchedule(selectedSchedule.id);
                  setSelectedSchedule(null);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
              >
                <Trash2 className="w-4 h-4" />
                <span>삭제</span>
              </button>
              <button
                onClick={() => setSelectedSchedule(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}