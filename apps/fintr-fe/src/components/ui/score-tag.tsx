"use client";

import React from 'react';

interface ScoreTagProps {
  percentage: string;
  score: number;
  color: string; // Tailwind color class, e.g., "bg-teal-600"
}

const ScoreTag: React.FC<ScoreTagProps> = ({ percentage, score, color }) => {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center justify-center rounded-sm ${color} px-2 py-1 text-xs font-medium text-white ring-1 ring-inset`}>
        {percentage}
      </span>
      <span className={`text-sm font-medium ${color.replace('bg-', 'text-')}`}>
        {score}
      </span>
    </div>
  );
};

export default ScoreTag; 
