import React from 'react';

export default function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = variant === 'primary' ? 'primary-button' : 'secondary-button';
  return (
    <button className={`${base} ${className}`} {...props}>
      {children}
    </button>
  );
}
