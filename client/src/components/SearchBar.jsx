import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchBar({ value, onChange, showSuggestions, setShowSuggestions, suggestions = [], didYouMean = '', loading = false }) {
  const navigate = useNavigate();

  const submitSearch = (event) => {
    event.preventDefault();
    if (value?.trim()) navigate(`/catalog?aiQuery=${encodeURIComponent(value.trim())}`);
  };

  return (
    <form onSubmit={submitSearch} className="hidden flex-1 md:flex">
      <div className="relative w-full">
        <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 shadow-glow transition focus-within:border-accent/40 focus-within:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => value.trim() && setShowSuggestions(true)} placeholder="Search titles, studios, genres, or aliases" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" />
        </div>

        {showSuggestions && (value.trim() || loading) ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-ink/95 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
              {loading ? 'Finding matches...' : 'Suggestions'}
            </div>
            {didYouMean ? (
              <button type="button" onClick={() => { onChange(didYouMean); setShowSuggestions(false); navigate(`/catalog?aiQuery=${encodeURIComponent(didYouMean)}`); }} className="flex w-full items-center justify-between border-b border-white/10 bg-accent/10 px-4 py-3 text-left text-sm text-white transition hover:bg-accent/20">
                <span>Did you mean <span className="font-semibold">{didYouMean}</span>?</span>
                <span className="text-xs uppercase tracking-[0.2em] text-accent2">Use</span>
              </button>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="max-h-72 overflow-auto p-2">
                {suggestions.map((item) => (
                  <button key={item} type="button" onClick={() => { onChange(item); setShowSuggestions(false); navigate(`/catalog?aiQuery=${encodeURIComponent(item)}`); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8 hover:text-white">
                    <span>{item}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Search</span>
                  </button>
                ))}
              </div>
            ) : !loading ? (
              <div className="px-4 py-4 text-sm text-slate-400">No suggestions yet. Try a title, studio, genre, or alias.</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
