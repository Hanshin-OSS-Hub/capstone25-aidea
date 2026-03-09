import React, { useState } from 'react';
import { Award, Trophy, Bell, Upload, FileText, X, ArrowLeft } from 'lucide-react';

interface ActivityHistoryProps {
  onBack?: () => void;
  completedActivities?: Array<{
    id: number;
    noticeId: number;
    result: string;
    completedDate: string;
  }>;
  opportunities?: Array<{
    id: number;
    title: string;
    category: string;
    [key: string]: any;
  }>;
}

export function ActivityHistory({ onBack, completedActivities = [], opportunities = [] }: ActivityHistoryProps = {}) {
  const [evidences, setEvidences] = useState<Record<number, Array<{
    id: number;
    name: string;
    type: 'certificate' | 'award' | 'proof';
  }>>>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<number | null>(null);

  // Merge default activities with completed activities from props
  const defaultActivities: Array<{
    id: number;
    title: string;
    category: string;
    completedDate: string;
    result: string;
  }> = [];

  const userCompletedActivities = completedActivities.map(activity => {
    const notice = opportunities.find(opp => opp.id === activity.noticeId);
    return {
      id: activity.id,
      title: notice?.title || '알 수 없는 활동',
      category: notice?.category || '기타',
      completedDate: activity.completedDate,
      result: activity.result,
    };
  });

  const allActivities = [...userCompletedActivities, ...defaultActivities];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '공모전':
        return <Trophy className="w-5 h-5" />;
      case '프로그램':
      case '학술':
        return <Award className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '공모전':
        return 'bg-purple-100 text-purple-700';
      case '프로그램':
        return 'bg-blue-100 text-blue-700';
      case '학술':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleUploadEvidence = (file: File, type: 'certificate' | 'award' | 'proof') => {
    if (selectedActivity !== null) {
      const newEvidence = {
        id: Date.now(),
        name: file.name,
        type,
      };
      setEvidences(prev => ({
        ...prev,
        [selectedActivity]: [...(prev[selectedActivity] || []), newEvidence],
      }));
      setShowUploadModal(false);
      setSelectedActivity(null);
    }
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
      
      <h1 className="text-3xl font-bold text-gray-900 mb-2">활동 이력</h1>
      <p className="text-gray-600 mb-8">참여했던 모든 활동 기록을 관리할 수 있습니다</p>

      {allActivities.length > 0 ? (
        <div className="space-y-4">
          {allActivities.map(activity => (
            <div
              key={activity.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(activity.category)}`}>
                      {getCategoryIcon(activity.category)}
                      <span>{activity.category}</span>
                    </span>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      {activity.result}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{activity.title}</h3>
                  <p className="text-sm text-gray-500">완료일: {activity.completedDate}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedActivity(activity.id);
                    setShowUploadModal(true);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>증빙 업로드</span>
                </button>
              </div>

              {/* Evidence Files */}
              {evidences[activity.id] && evidences[activity.id].length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">업로드된 증빙</h4>
                  <div className="space-y-2">
                    {evidences[activity.id].map(evidence => (
                      <div
                        key={evidence.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-purple-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{evidence.name}</p>
                            <p className="text-xs text-gray-500">
                              {evidence.type === 'certificate' && '수료증'}
                              {evidence.type === 'award' && '상장'}
                              {evidence.type === 'proof' && '참가 증빙'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center">활동 이력이 없습니다</p>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">증빙 자료 업로드</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedActivity(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <input
                  type="file"
                  onChange={(e) => e.target.files && handleUploadEvidence(e.target.files[0], 'certificate')}
                  className="hidden"
                  id="certificate-upload"
                />
                <div
                  onClick={() => document.getElementById('certificate-upload')?.click()}
                  className="cursor-pointer p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-center"
                >
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="font-medium text-gray-700">수료증 업로드</p>
                  <p className="text-xs text-gray-500">클릭하여 파일 선택</p>
                </div>
              </label>

              <label className="block">
                <input
                  type="file"
                  onChange={(e) => e.target.files && handleUploadEvidence(e.target.files[0], 'award')}
                  className="hidden"
                  id="award-upload"
                />
                <div
                  onClick={() => document.getElementById('award-upload')?.click()}
                  className="cursor-pointer p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-center"
                >
                  <Trophy className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="font-medium text-gray-700">상장 업로드</p>
                  <p className="text-xs text-gray-500">클릭하여 파일 선택</p>
                </div>
              </label>

              <label className="block">
                <input
                  type="file"
                  onChange={(e) => e.target.files && handleUploadEvidence(e.target.files[0], 'proof')}
                  className="hidden"
                  id="proof-upload"
                />
                <div
                  onClick={() => document.getElementById('proof-upload')?.click()}
                  className="cursor-pointer p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-center"
                >
                  <Award className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="font-medium text-gray-700">참가 증빙 업로드</p>
                  <p className="text-xs text-gray-500">클릭하여 파일 선택</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}