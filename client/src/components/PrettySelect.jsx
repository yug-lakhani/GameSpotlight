import React, { useEffect, useMemo, useRef, useState } from 'react';

function normalize(options) {
  return (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

export default function PrettySelect({ options = [], value, onChange, placeholder = 'Select...', className = '', id, ariaLabel = 'Select option' }) {
  const opts = normalize(options);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const selectedIndex = useMemo(
    () => opts.findIndex((option) => String(option.value) === String(value)),
    [opts, value]
  );

  const selected = selectedIndex >= 0 ? opts[selectedIndex] : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextHighlight = selectedIndex >= 0 ? selectedIndex : 0;
    setHighlight(nextHighlight);
  }, [open, selectedIndex]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }

    const activeOption = listRef.current.querySelector('[data-highlight="true"]');
    if (activeOption) {
      activeOption.scrollIntoView({ block: 'nearest' });
    }
  }, [open, highlight]);

  const commitSelection = (option) => {
    onChange && onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (!opts.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, opts.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open && opts[highlight]) {
        commitSelection(opts[highlight]);
      } else {
        setOpen(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`pretty-select-root ${className}`} id={id}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className="pretty-select-trigger input-field flex w-full items-center justify-between gap-3 text-left shadow-glow"
      >
        <span className="min-w-0 flex-1 truncate">
          <span className={selected ? 'text-white' : 'text-slate-400'}>{selected ? selected.label : placeholder}</span>
        </span>
        <svg className={`h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          id={id ? `${id}-listbox` : undefined}
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="pretty-select-menu reveal-up"
        >
          {opts.length === 0 ? (
            <div className="pretty-select-empty">No options available.</div>
          ) : null}

          {opts.map((option, index) => {
            const isActive = index === highlight;
            const isSelected = String(option.value) === String(value);
            return (
              <button
                key={`${option.value}-${option.label}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-highlight={isActive ? 'true' : 'false'}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitSelection(option)}
                className={`pretty-select-option ${isActive ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`}
              >
                <div className="font-semibold text-white">{option.label}</div>
                {option.description ? <div className="mt-1 text-xs leading-5 text-slate-400">{option.description}</div> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
