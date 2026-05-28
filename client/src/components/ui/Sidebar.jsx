import React from 'react';

export default function Sidebar({ children, className = '', sticky = true }) {
  return (
    <aside className={`w-80 flex-shrink-0 ${sticky ? 'sticky top-20' : ''} ${className}`}>
      <div className="section-shell">{children}</div>
    </aside>
  );
}
