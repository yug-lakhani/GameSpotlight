import React from 'react';
import Button from './ui/Button';

export default function Pagination({ currentPage, totalPages, onPageChange, isLoading }) {
  const handlePrevious = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="mt-8 flex items-center justify-between">
      <Button variant="secondary" onClick={handlePrevious} disabled={currentPage === 1 || isLoading} className="page-button">
        ← Previous
      </Button>

      <div className="text-center">
        <div className="text-sm text-slate-300">
          Page <span className="font-bold text-white">{currentPage}</span> of <span className="font-bold text-white">{totalPages}</span>
        </div>
      </div>

      <Button variant="secondary" onClick={handleNext} disabled={currentPage === totalPages || isLoading} className="page-button">
        Next →
      </Button>
    </div>
  );
}
