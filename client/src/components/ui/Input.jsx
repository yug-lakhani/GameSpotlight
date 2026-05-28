import React from 'react';

export default function Input({ label, id, value, onChange, placeholder = '', type = 'text', className = '', ...props }) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label ? <label htmlFor={id} className="label-text">{label}</label> : null}
      <input id={id} type={type} value={value} onChange={(e) => onChange && onChange(e.target.value)} placeholder={placeholder} className="input-field" {...props} />
    </div>
  );
}
