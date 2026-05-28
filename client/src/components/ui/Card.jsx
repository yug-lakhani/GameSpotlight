import React from 'react';

export default function Card({ children, className = '', media, footer }) {
  return (
    <article className={`surface-card ${className}`}>
      {media ? <div className="mb-4 overflow-hidden rounded-lg">{media}</div> : null}
      <div className="card-body">
        {children}
      </div>
      {footer ? <div className="card-footer mt-4">{footer}</div> : null}
    </article>
  );
}
