import React from 'react';
import { LayoutDashboard, Bell, Calendar, Sparkles, User } from 'lucide-react';
import logoImage from 'figma:asset/40da4457701a8b241a1dea09ee05fc26bab60037.png';

interface NavigationProps {
  currentPage?: 'dashboard' | 'notices' | 'calendar' | 'detail' | 'ai' | 'mypage';
  onNavigateToDashboard?: () => void;
  onNavigateToNotices?: () => void;
  onNavigateToCalendar?: () => void;
  onNavigateToAI?: () => void;
  onNavigateToMyPage?: () => void;
}

export function Navigation({ currentPage = 'dashboard', onNavigateToDashboard, onNavigateToNotices, onNavigateToCalendar, onNavigateToAI, onNavigateToMyPage }: NavigationProps) {
  return (
    <>
      {/* Top Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src={logoImage} alt="Logo" className="w-10 h-10 flex-shrink-0 object-contain" />
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent leading-none">
                학교 생활 도우미
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-around h-16">
            <button
              onClick={onNavigateToDashboard}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                currentPage === 'dashboard'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="w-6 h-6 flex-shrink-0" />
              <span className="text-xs font-medium mt-1">대시보드</span>
            </button>
            
            <button
              onClick={onNavigateToNotices}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                currentPage === 'notices'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Bell className="w-6 h-6 flex-shrink-0" />
              <span className="text-xs font-medium mt-1">공지사항</span>
            </button>
            
            <button
              onClick={onNavigateToCalendar}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                currentPage === 'calendar'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-6 h-6 flex-shrink-0" />
              <span className="text-xs font-medium mt-1">캘린더</span>
            </button>
            
            <button
              onClick={onNavigateToAI}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                currentPage === 'ai'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Sparkles className="w-6 h-6 flex-shrink-0" />
              <span className="text-xs font-medium mt-1">AI 도우미</span>
            </button>
            
            <button
              onClick={onNavigateToMyPage}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                currentPage === 'mypage'
                  ? 'text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-6 h-6 flex-shrink-0" />
              <span className="text-xs font-medium mt-1">마이페이지</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}