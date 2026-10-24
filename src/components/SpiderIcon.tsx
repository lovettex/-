import React from 'react';

export interface SpiderIconProps {
  className?: string;
}

export const SpiderIcon: React.FC<SpiderIconProps> = ({ className = 'w-4 h-4' }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Abdomen (Rear Segment) */}
      <ellipse cx="12" cy="15.2" rx="3.4" ry="4.4" />
      
      {/* Cephalothorax (Head/Thorax Segment) */}
      <circle cx="12" cy="8.6" r="2.2" />
      
      {/* Fangs / Pedipalps */}
      <path d="M10.8 6.6L10 5.2" />
      <path d="M13.2 6.6L14 5.2" />
      
      {/* 4 Left Legs */}
      <path d="M10 8.2C7.5 6.6 5 7.2 3.5 9.6" />
      <path d="M9.8 9.6C7 9.1 4.5 10.6 3 13.1" />
      <path d="M9.8 11.6C7 12.1 4.5 14.1 3.5 16.6" />
      <path d="M10.2 14.1C8 15.6 6 18.1 5 20.6" />
      
      {/* 4 Right Legs */}
      <path d="M14 8.2C16.5 6.6 19 7.2 20.5 9.6" />
      <path d="M14.2 9.6C17 9.1 19.5 10.6 21 13.1" />
      <path d="M14.2 11.6C17 12.1 19.5 14.1 20.5 16.6" />
      <path d="M13.8 14.1C16 15.6 18 18.1 19 20.6" />
    </svg>
  );
};
