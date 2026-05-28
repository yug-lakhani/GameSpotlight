import React from 'react';

export default function IconStar({ className = '', size = 18 }) {
  return (
    <svg
      className={`icon-animated ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="g1" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#3DD6C6" />
          <stop offset="100%" stopColor="#6C8CFF" />
        </linearGradient>
      </defs>
      <path d="M12 2.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.9l-5.2 2.6.99-5.78L3.58 8.62l5.82-.85L12 2.5z" fill="url(#g1)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
    </svg>
  );
}
