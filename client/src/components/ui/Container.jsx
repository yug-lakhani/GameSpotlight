import React from 'react';

export default function Container({ children, className = '', ...props }) {
  return (
    <div className={`site-container ${className}`} {...props}>
      {children}
    </div>
  );
}
