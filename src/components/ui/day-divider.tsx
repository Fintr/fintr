import React from "react";

interface DayDividerProps {
  date: string;
  className?: string;
  textClassName?: string;
}

export const DayDivider = ({ date, className = "", textClassName = "bg-white" }: DayDividerProps) => {
  return (
    <div className={`flex items-center my-5 ${className}`}>
      <div className="border-t border-gray-300" style={{ width: '2rem' }} />
      <span className={`text-xs font-semibold text-primary px-3 ${textClassName}`}>
        {date}
      </span>
      <div className="flex-grow border-t border-gray-300" />
    </div>
  );
};

export default DayDivider;
