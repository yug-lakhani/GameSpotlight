import React from 'react';

export default function Badge({ children, className = '' }) {
  return (
    <span className={`status-pill ${className}`}>
      {children}
    </span>
  );
}
