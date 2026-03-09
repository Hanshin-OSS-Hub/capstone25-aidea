import React from 'react';

interface OpportunitiesFilterProps {
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
}

export function OpportunitiesFilter({ activeFilter, setActiveFilter }: OpportunitiesFilterProps) {
  const filters = ['전체', '장학금', '공모전', '공지사항'];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(filter => (
        <button
          key={filter}
          onClick={() => setActiveFilter(filter)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeFilter === filter
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
