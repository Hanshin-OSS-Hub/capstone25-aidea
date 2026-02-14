import React from 'react';
import { User, School, GraduationCap, Calendar, Award, BookOpen, Clock, Plus, Trash2, ArrowLeft } from 'lucide-react';

export function ProfileDetail({ onBack }: { onBack?: () => void }) {
  const [courses, setCourses] = React.useState([
    { 
      id: 1,
      name: '자료구조', 
      code: 'CS201', 
      day: 1, // 월
      startTime: 9, 
      duration: 2, 
      color: 'bg-purple-200',
      room: '공대 301'
    },
    { 
      id: 2,
      name: '데이터베이스', 
      code: 'CS305', 
      day: 1, // 월
      startTime: 1, 
      duration: 2, 
      color: 'bg-blue-200',
      room: '공대 205'
    },
    { 
      id: 3,
      name: '알고리즘', 
      code: 'CS302', 
      day: 2, // 화
      startTime: 10, 
      duration: 2, 
      color: 'bg-green-200',
      room: '공대 401'
    },
    { 
      id: 4,
      name: '인공지능', 
      code: 'CS401', 
      day: 2, // 화
      startTime: 2, 
      duration: 2, 
      color: 'bg-pink-200',
      room: '공대 503'
    },
    { 
      id: 5,
      name: '운영체제', 
      code: 'CS303', 
      day: 3, // 수
      startTime: 9, 
      duration: 2, 
      color: 'bg-yellow-200',
      room: '공대 301'
    },
    { 
      id: 6,
      name: '웹프로그래밍', 
      code: 'CS304', 
      day: 3, // 수
      startTime: 1, 
      duration: 3, 
      color: 'bg-indigo-200',
      room: '공대 502'
    },
    { 
      id: 7,
      name: '데이터베이스', 
      code: 'CS305', 
      day: 4, // 목
      startTime: 1, 
      duration: 2, 
      color: 'bg-blue-200',
      room: '공대 205'
    },
    { 
      id: 8,
      name: '알고리즘', 
      code: 'CS302', 
      day: 5, // 금
      startTime: 10, 
      duration: 2, 
      color: 'bg-green-200',
      room: '공대 401'
    },
    { 
      id: 9,
      name: '캡스톤디자인', 
      code: 'CS402', 
      day: 5, // 금
      startTime: 2, 
      duration: 3, 
      color: 'bg-teal-200',
      room: '공대 601'
    },
  ]);

  const [academicPerformance, setAcademicPerformance] = React.useState([
    { id: 1, semester: '2023-2', gpa: 4.15, credits: 18, rank: '상위 5%' },
    { id: 2, semester: '2023-1', gpa: 4.08, credits: 21, rank: '상위 7%' },
    { id: 3, semester: '2022-2', gpa: 3.95, credits: 18, rank: '상위 10%' },
    { id: 4, semester: '2022-1', gpa: 3.87, credits: 19, rank: '상위 12%' },
  ]);

  const [isEditingTimetable, setIsEditingTimetable] = React.useState(false);
  const [isEditingGrades, setIsEditingGrades] = React.useState(false);

  const timeSlots = [
    { label: '9', time: '09:00' },
    { label: '10', time: '10:00' },
    { label: '11', time: '11:00' },
    { label: '12', time: '12:00' },
    { label: '1', time: '13:00' },
    { label: '2', time: '14:00' },
    { label: '3', time: '15:00' },
    { label: '4', time: '16:00' },
    { label: '5', time: '17:00' },
    { label: '6', time: '18:00' },
    { label: '7', time: '19:00' },
  ];

  const days = ['월', '화', '수', '목', '금'];

  const getCourseAtPosition = (day: number, timeSlot: number) => {
    return courses.find(
      course => course.day === day && course.startTime === timeSlot
    );
  };

  const isOccupiedByPreviousCourse = (day: number, timeSlot: number) => {
    return courses.some(
      course =>
        course.day === day &&
        course.startTime < timeSlot &&
        course.startTime + course.duration > timeSlot
    );
  };

  const overallGPA = (academicPerformance.reduce((sum, sem) => sum + sem.gpa, 0) / academicPerformance.length).toFixed(2);

  const handleAddCourse = () => {
    alert('수업 추가 기능이 곧 추가될 예정입니다!');
  };

  const handleDeleteCourse = (courseId: number) => {
    setCourses(courses.filter(c => c.id !== courseId));
  };

  const handleAddGrade = () => {
    alert('성적 추가 기능이 곧 추가될 예정입니다!');
  };

  const handleDeleteGrade = (gradeId: number) => {
    setAcademicPerformance(academicPerformance.filter(g => g.id !== gradeId));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>돌아가기</span>
        </button>
      )}
      <h1 className="text-3xl font-bold text-gray-900 mb-8">프로필 상세</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">김학생</h2>
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <School className="w-4 h-4" />
                <span>서울대학교</span>
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

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">{overallGPA}</div>
            <div className="text-sm text-gray-600">전체 평점</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">76</div>
            <div className="text-sm text-gray-600">이수 학점</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">5%</div>
            <div className="text-sm text-gray-600">학과 석차</div>
          </div>
        </div>
      </div>

      {/* Timetable */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 overflow-x-auto">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-6 h-6 text-purple-600" />
          <h3 className="text-xl font-bold text-gray-900">현재 시간표</h3>
        </div>

        <div className="min-w-[600px]">
          {/* Timetable Grid */}
          <div className="grid grid-cols-6 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            {/* Header Row */}
            <div className="border-r border-gray-200 bg-gray-50"></div>
            {days.map((day, idx) => (
              <div
                key={idx}
                className="border-r border-gray-200 last:border-r-0 bg-purple-100 text-purple-800 text-center py-3 font-semibold"
              >
                {day}
              </div>
            ))}

            {/* Time Rows */}
            {timeSlots.map((slot, rowIdx) => (
              <React.Fragment key={rowIdx}>
                {/* Time Label */}
                <div className="border-r border-t border-gray-200 bg-gray-50 text-gray-700 text-center py-4 text-sm font-medium">
                  {slot.label}
                </div>

                {/* Day Columns */}
                {days.map((day, dayIdx) => {
                  const dayNumber = dayIdx + 1;
                  const course = getCourseAtPosition(dayNumber, slot.label === '9' ? 9 : slot.label === '10' ? 10 : slot.label === '11' ? 11 : slot.label === '12' ? 12 : parseInt(slot.label));
                  const isOccupied = isOccupiedByPreviousCourse(dayNumber, slot.label === '9' ? 9 : slot.label === '10' ? 10 : slot.label === '11' ? 11 : slot.label === '12' ? 12 : parseInt(slot.label));

                  if (course) {
                    return (
                      <div
                        key={dayIdx}
                        className={`border-r border-t border-gray-200 last:border-r-0 p-3 ${course.color} relative`}
                        style={{
                          gridRow: `span ${course.duration}`,
                        }}
                      >
                        <div className="text-gray-800 font-semibold text-sm leading-tight">
                          {course.name}
                        </div>
                        <div className="text-gray-600 text-xs mt-1">
                          {course.code}
                        </div>
                        <div className="text-gray-600 text-xs">
                          {course.room}
                        </div>
                        <button
                          className="absolute top-1 right-1 text-gray-500 hover:text-gray-700"
                          onClick={() => handleDeleteCourse(course.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  } else if (isOccupied) {
                    return null;
                  } else {
                    return (
                      <div
                        key={dayIdx}
                        className="border-r border-t border-gray-200 last:border-r-0 bg-white hover:bg-gray-50 transition-colors"
                      ></div>
                    );
                  }
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <button
            className="inline-flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
            onClick={handleAddCourse}
          >
            <Plus className="w-4 h-4 mr-2" />
            수업 추가
          </button>
        </div>
      </div>

      {/* Academic Performance */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center space-x-2 mb-4">
          <Award className="w-6 h-6 text-purple-600" />
          <h3 className="text-xl font-bold text-gray-900">학업 성적</h3>
        </div>

        <div className="space-y-3">
          {academicPerformance.map((semester, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg relative group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xs text-purple-600 font-medium">{semester.semester}</div>
                    <BookOpen className="w-5 h-5 text-purple-600 mx-auto mt-1" />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{semester.semester} 학기</p>
                  <p className="text-sm text-gray-500">이수 학점: {semester.credits}학점</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-600">{semester.gpa}</p>
                  <p className="text-sm text-gray-500">{semester.rank}</p>
                </div>
                <button
                  className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteGrade(semester.id)}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button
            className="inline-flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
            onClick={handleAddGrade}
          >
            <Plus className="w-4 h-4 mr-2" />
            성적 추가
          </button>
        </div>
      </div>
    </div>
  );
}