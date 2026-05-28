import React from 'react';

export default function DownloadProgress({ progress, isVisible }) {
  if (!isVisible || progress < 0) return null;

  const displayProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      <div className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-lg px-6 py-4 shadow-xl">
        <div className="mb-3 text-center text-sm text-white font-medium">
          Downloading... {displayProgress}%
        </div>
        
        {/* Progress bar with animated gradient */}
        <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent via-blue-400 to-accent rounded-full transition-all duration-200 ease-out"
            style={{
              width: `${displayProgress}%`,
              animation: displayProgress < 100 ? 'shimmer 2s infinite' : 'none'
            }}
          />
        </div>

        {/* Animated dots */}
        <div className="mt-3 text-center">
          <div className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
