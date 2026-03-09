import React from 'react';

/**
 * 챗봇 메시지 마크다운 렌더링
 * - **볼드** → <strong>
 * - 줄바꿈, 리스트(- ) 지원
 */
export function ChatMessageContent({ content, className = '' }: { content: string; className?: string }) {
  // **text** → <strong>text</strong> 파싱
  const parseBold = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldStart = remaining.indexOf('**');
      if (boldStart === -1) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
      if (boldStart > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldStart)}</span>);
      }
      const boldEnd = remaining.indexOf('**', boldStart + 2);
      if (boldEnd === -1) {
        parts.push(<span key={key++}>{remaining.slice(boldStart)}</span>);
        break;
      }
      parts.push(
        <strong key={key++} className="font-semibold text-gray-900">
          {remaining.slice(boldStart + 2, boldEnd)}
        </strong>
      );
      remaining = remaining.slice(boldEnd + 2);
    }
    return parts;
  };

  const lines = content.split('\n');
  return (
    <div className={`space-y-2 ${className}`}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-purple-500 shrink-0">•</span>
              <span>{parseBold(trimmed.slice(2))}</span>
            </div>
          );
        }
        return (
          <div key={i}>
            {parseBold(line)}
          </div>
        );
      })}
    </div>
  );
}
