import React, { useState } from 'react';
import { Sparkles, Send, Upload, FileText, X } from 'lucide-react';
import { sendAIMessage } from '../lib/api-functions';
import { ChatMessageContent } from './ChatMessageContent';

export function AIChat() {
  const [messages, setMessages] = useState<Array<{
    type: 'user' | 'ai';
    content: string;
    file?: { name: string; size: string };
  }>>([
    {
      type: 'ai',
      content: '안녕하세요! 👋 캠퍼스 AI 도우미입니다.\n장학금, 공모전, 신청서 작성 등 무엇이든 도와드릴게요!',
    },
    {
      type: 'ai',
      content: '💡 지금 관심 공지에 등록된 "제15회 대학생 창업경진대회" 신청서 작성을 도와드릴까요?',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && !uploadedFile) return;

    const userMessageContent = inputMessage || '파일을 업로드했습니다.';
    const newMessage: any = {
      type: 'user',
      content: userMessageContent,
    };

    if (uploadedFile) {
      newMessage.file = {
        name: uploadedFile.name,
        size: `${(uploadedFile.size / 1024).toFixed(1)}KB`,
      };
    }

    // 사용자 메시지 추가
    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    const currentFile = uploadedFile;
    setUploadedFile(null);
    setIsLoading(true);

    try {
      // 실제 AI API 호출
      const response = await sendAIMessage(1, userMessageContent); // user_id는 1로 고정 (MVP)
      
      let aiResponse = response.data.answer;
      
      // 파일 업로드가 있는 경우 추가 안내
      if (currentFile) {
        aiResponse = `📎 파일 "${currentFile.name}"을 받았습니다.\n\n${aiResponse}`;
      }

      // AI 응답 추가
      setMessages(prev => [...prev, {
        type: 'ai',
        content: aiResponse,
      }]);
    } catch (error) {
      console.error('AI 응답 오류:', error);
      // 에러 처리
      setMessages(prev => [...prev, {
        type: 'ai',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-12rem)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI 도우미</h1>
              <p className="text-purple-100">무엇이든 물어보세요</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100'
                }`}
              >
                {message.file && (
                  <div className={`flex items-center space-x-2 mb-2 pb-2 border-b ${
                    message.type === 'user' ? 'border-white/20' : 'border-purple-200'
                  }`}>
                    <FileText className={`w-4 h-4 ${
                      message.type === 'user' ? 'text-white' : 'text-purple-600'
                    }`} />
                    <span className={`text-sm ${
                      message.type === 'user' ? 'text-white' : 'text-purple-700'
                    }`}>
                      {message.file.name} ({message.file.size})
                    </span>
                  </div>
                )}
                <div className={message.type === 'user' ? 'text-white' : 'text-gray-700'}>
                  {message.type === 'ai' ? (
                    <ChatMessageContent content={message.content} />
                  ) : (
                    <p className="whitespace-pre-line">{message.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          {uploadedFile && (
            <div className="mb-3 flex items-center justify-between px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                  <p className="text-xs text-gray-500">{(uploadedFile.size / 1024).toFixed(1)}KB</p>
                </div>
              </div>
              <button
                onClick={() => setUploadedFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <label className="cursor-pointer p-3 hover:bg-gray-200 rounded-lg transition-colors">
              <Upload className="w-5 h-5 text-gray-600" />
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.hwp"
              />
            </label>
            
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="메시지를 입력하세요..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            
            <button
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && !uploadedFile) || isLoading}
              className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
